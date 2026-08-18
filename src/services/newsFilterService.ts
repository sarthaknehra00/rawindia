/**
 * RAWINDIA — News Quality Filter
 *
 * Before any article is stored permanently or shown on the live feed,
 * it must pass this filter. Rules are deterministic (no API call needed).
 *
 * Filters out:
 * - Promotional / advertorial content
 * - Extremely short articles (no real content)
 * - Duplicate titles (title similarity check)
 * - Non-India content that slipped through the keyword filter
 * - Clickbait / sensationalist without factual anchors
 * - Removed/deleted articles
 */

import type { Article } from '../types';
import { recordClusterCandidate, finalizePendingClusters } from './storyClusterService';

// ── Patterns that disqualify an article ───────────────────────────────────────

const JUNK_PATTERNS = [
  /\[removed\]/i,
  /\[deleted\]/i,
  /buy now|shop now|discount|% off|deal of the day|sale ends/i,
  /sponsored|advertisement|advertorial|paid post|partner content/i,
  /click here to|learn more about|find out more/i,
  /quiz:|puzzle:|word of the day|horoscope|astrology/i,
  /\d+ things you (didn't|don't) know/i,
  /^watch:/i,
  /^video:/i,
  /^photos?:/i,
  /^gallery:/i,
];

const KNOWN_JUNK_SOURCES = [
  'entertainment weekly', 'celebrity news', 'gossip',
  'daily horoscope', 'numerology', 'vastu tips',
];

// ── Main filter function ───────────────────────────────────────────────────────

export function passesQualityFilter(article: Article): boolean {
  const title    = article.title || '';
  const subtitle = article.subtitle || '';
  const body     = article.bodyParagraphs?.join(' ') || '';

  // 1. Must have a real title
  if (title.length < 15) return false;
  if (title === 'Breaking Dispatch') return false;

  // 2. Must not match junk patterns
  const titleLower = title.toLowerCase();
  if (JUNK_PATTERNS.some(p => p.test(titleLower))) return false;

  // 3. Must not be from a known junk source
  const source = (article.externalSource || '').toLowerCase();
  if (KNOWN_JUNK_SOURCES.some(j => source.includes(j))) return false;

  // 4. Must have some content depth
  const totalWords = (subtitle + ' ' + body).split(/\s+/).filter(Boolean).length;
  if (totalWords < 15) return false;

  // 5. Must have been published recently enough to be real news
  // (reject articles with clearly wrong dates — before 2020 or in the future)
  const pubTime = new Date(article.publishedAt).getTime();
  const minDate = new Date('2020-01-01').getTime();
  const maxDate = Date.now() + 86_400_000; // 1 day in future max
  if (pubTime < minDate || pubTime > maxDate) return false;

  return true;
}

/** Filter an array of articles, returning only quality ones */
export function filterQualityArticles(articles: Article[]): Article[] {
  return articles.filter(passesQualityFilter);
}

const UPDATE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

// Fuzzy-match tuning. Both were chosen by hand-tracing real headline pairs
// (see the fuzzy-dedup section of the audit report) rather than picked
// arbitrarily:
//  - 0.72 sits comfortably above genuine reworded-same-story pairs (e.g.
//    "Modi says India will lead global growth" vs "PM Modi: India will lead
//    global growth" ≈ 0.75) while staying well above two DIFFERENT stories
//    that happen to share a long generic prefix (e.g. "Supreme Court hears
//    petition on electoral bonds" vs "...on farm loans" ≈ 0.56) — biased
//    toward precision: a missed duplicate is far less harmful than two
//    unrelated stories getting silently merged.
//  - Short titles inflate Jaccard misleadingly on a single coincidental
//    shared word (a 3-token title differing in only one word can already
//    read as 50% similar), so fuzzy matching is skipped entirely below this
//    token count and left to the exact-match checks instead.
const FUZZY_THRESHOLD = 0.72;
const MIN_TOKENS_FOR_FUZZY = 5;
const FUZZY_TIME_WINDOW_MS = 48 * 60 * 60 * 1000; // only compare within the same news cycle

interface FuzzyCandidate { article: Article; tokens: Set<string>; time: number }

function tokenize(title: string): Set<string> {
  return new Set(
    title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Find an existing candidate whose title is fuzzy-similar AND close in time
 * to the incoming article — used as a fallback once exact title/URL checks
 * both miss. Returns null if no candidate clears the threshold, or if the
 * incoming/candidate titles are too short to fuzzy-compare reliably. */
function findFuzzyMatch(incomingTokens: Set<string>, incomingTime: number, candidates: FuzzyCandidate[]): FuzzyCandidate | null {
  if (incomingTokens.size < MIN_TOKENS_FOR_FUZZY) return null;
  for (const c of candidates) {
    if (c.tokens.size < MIN_TOKENS_FOR_FUZZY) continue;
    if (Math.abs(incomingTime - c.time) > FUZZY_TIME_WINDOW_MS) continue;
    if (jaccard(incomingTokens, c.tokens) >= FUZZY_THRESHOLD) return c;
  }
  return null;
}

/**
 * Deduplicate incoming articles against what's already stored, using three
 * signals, checked cheapest-first:
 *  - Normalized source URL — a strong signal since the same URL almost
 *    certainly means the same real-world story, even across providers that
 *    assign different ids to it (title-only comparison alone misses this,
 *    since NewsAPI's "top-headlines" and "everything" endpoints frequently
 *    return slightly different title phrasing for the identical story).
 *  - Normalized title (exact) — catches same-story-different-URL cases
 *    (e.g. syndicated wire copy re-hosted elsewhere).
 *  - Fuzzy title similarity (fallback, only tried once the two exact checks
 *    miss) — catches the same real-world story reported with meaningfully
 *    different headline phrasing across providers. Scoped to articles
 *    published within the same ~2-day window to keep this cheap (no full
 *    O(n²) scan against a large historical archive) and to avoid an old
 *    archived story with similar wording matching a fresh one.
 *
 * A "duplicate" (by any of the three signals) that's meaningfully newer
 * (>15 min) than the stored version is treated as a genuine update to a
 * developing story rather than silently dropped — a real, live wire update
 * (revised casualty count, new detail) would previously vanish here just
 * because the headline hadn't changed. We can't merge across different
 * provider ids, so a cross-provider update is let through to coexist rather
 * than lost; a same-id update is let through too, relying on
 * persistenceService's existing id-based upsert to overwrite the stale copy.
 */
export function deduplicateArticles(incoming: Article[], existing: Article[]): Article[] {
  const byTitle = new Map<string, Article>();
  const byUrl   = new Map<string, Article>();
  const fuzzyCandidates: FuzzyCandidate[] = [];

  existing.forEach(a => {
    byTitle.set(normTitle(a.title), a);
    const u = normUrl(a.externalUrl);
    if (u) byUrl.set(u, a);
    fuzzyCandidates.push({ article: a, tokens: tokenize(a.title), time: new Date(a.publishedAt).getTime() });
  });

  const result = incoming.filter(a => {
    const titleKey = normTitle(a.title);
    const urlKey   = normUrl(a.externalUrl);
    const incomingTime = new Date(a.publishedAt).getTime();

    // Identical source URL — same real-world story regardless of provider,
    // id, or headline phrasing. Always a duplicate; no update-window
    // exception needed since it's the literal same source article.
    const urlMatch = urlKey ? byUrl.get(urlKey) : undefined;
    if (urlMatch) {
      // This is the app's PRIMARY cross-source dedup pass (NewsAPI + Google
      // News + RBI merged here every main cron cycle) — previously this
      // dropped match was discarded with no trace, even though it's exactly
      // the "who else covered this" data storyClusterService.ts exists to
      // hold. newsApiService.ts's own (narrower, NewsAPI-vs-Currents-only)
      // dedup pass already fed that store; this far more commonly-hit path
      // never did, so Coverage Comparison and the ranking engine's
      // corroboration signal were both working off an incomplete picture.
      recordClusterCandidate(urlMatch, a);
      return false;
    }

    let match = byTitle.get(titleKey);

    // Neither exact check hit — fall back to fuzzy title similarity.
    if (!match) {
      const fuzzy = findFuzzyMatch(tokenize(a.title), incomingTime, fuzzyCandidates);
      if (fuzzy) match = fuzzy.article;
    }

    if (match) {
      const matchTime     = new Date(match.publishedAt).getTime();
      const isNewerUpdate = incomingTime - matchTime > UPDATE_THRESHOLD_MS;
      if (!isNewerUpdate) {
        recordClusterCandidate(match, a); // see comment above
        return false; // genuine duplicate, drop
      }
      // else: meaningfully newer — fall through and let it in as an update
    }

    // Register so later items in the same incoming batch still dedupe
    // against this one (preserves the original within-batch behavior).
    byTitle.set(titleKey, a);
    if (urlKey) byUrl.set(urlKey, a);
    fuzzyCandidates.push({ article: a, tokens: tokenize(a.title), time: incomingTime });
    return true;
  });

  finalizePendingClusters();
  return result;
}

function normTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80); // only compare first 80 chars — catches near-dupes
}

// Marketing/tracking params only — stripped so the same article shared via
// different referrers/campaigns still normalizes identically. NOT a general
// "drop all query params" list: several real sources (RBI's own
// BS_PressReleaseDisplay.aspx?prid=NNNNN, WordPress's ?p=123, etc.) put the
// actual resource identity in the query string, so blanket-stripping it
// would collapse every distinct article on such a site into one URL key.
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ref', 'ref_src', 'ito', 'cmpid',
]);

/** Normalize a source URL for cross-provider comparison: strip protocol,
 * "www.", tracking query params, fragment, and trailing slash, lowercase
 * the host — while preserving query params that identify the actual content. */
function normUrl(u: string | undefined): string | null {
  if (!u) return null;
  try {
    const parsed = new URL(u);
    const host   = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path   = parsed.pathname.replace(/\/+$/, '');
    const params = new URLSearchParams(parsed.search);
    TRACKING_PARAMS.forEach(p => params.delete(p));
    params.sort();
    const query = params.toString();
    return `${host}${path}${query ? `?${query}` : ''}`;
  } catch {
    return null;
  }
}
