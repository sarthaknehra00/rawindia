/**
 * RAWINDIA — The Guardian API: 1-Year Historical India News Archive
 *
 * Routed through our own serverless proxy (api/guardian.ts) — the real key
 * lives server-side only, in Vercel env vars, and is never shipped to the
 * client bundle. Supports date-range queries going back to 1999.
 *
 * Docs: https://open-platform.theguardian.com/documentation/
 */

import type { Article, ContentType, SourceType } from '../types';
import { fetchWithRetry } from './newsApiService';

const GUARDIAN_BASE = '/api/guardian';
const PAGE_SIZE     = 50;

// India-focused search queries for The Guardian — covers all major verticals
const INDIA_QUERIES = [
  'india government parliament modi',
  'india supreme court judgment law',
  'india economy RBI budget inflation',
  'india china pakistan border diplomacy',
  'india technology ISRO startup',
  'india cricket IPL BCCI',
  'india floods disaster climate',
  'india election BJP Congress',
  'india corporate business market',
  'india education health society',
];

interface GuardianField {
  headline?:    string;
  standfirst?:  string;
  bodyText?:    string;
  thumbnail?:   string;
  byline?:      string;
  trailText?:   string;
}

interface GuardianResult {
  id:                   string;
  webTitle:             string;
  webUrl:               string;
  webPublicationDate:   string;
  sectionName?:         string;
  fields?:              GuardianField;
}

interface GuardianResponse {
  response: {
    status:      string;
    total:       number;
    currentPage: number;
    pages:       number;
    results:     GuardianResult[];
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ').trim();
}

function inferVertical(title: string, section: string): { verticalId: number; verticalName: string } {
  const t = (title + ' ' + section).toLowerCase();
  if (t.match(/cricket|ipl|bcci|football|kabaddi|olympic|sport/))     return { verticalId: 7, verticalName: 'Sports' };
  if (t.match(/film|bollywood|cinema|music|entertainment|celebrity/)) return { verticalId: 8, verticalName: 'Entertainment' };
  if (t.match(/economy|market|gdp|rbi|budget|inflation|stock|rupee/)) return { verticalId: 4, verticalName: 'Business & Economy' };
  if (t.match(/tech|isro|space|ai |cyber|software|startup|5g/))       return { verticalId: 5, verticalName: 'Technology' };
  if (t.match(/china|pakistan|us |russia|diplomacy|border|lac|loc/))  return { verticalId: 3, verticalName: 'World (India Lens)' };
  if (t.match(/climate|environment|flood|pollution|wildlife|solar/))  return { verticalId: 6, verticalName: 'Science & Environment' };
  if (t.match(/state|district|village|assembly|chief minister/))      return { verticalId: 2, verticalName: 'States & UTs' };
  return { verticalId: 1, verticalName: 'India / National' };
}

function guardianToArticle(item: GuardianResult): Article {
  const f        = item.fields ?? {};
  const title    = f.headline || item.webTitle || 'India Dispatch';
  const rawBody  = f.bodyText ? stripHtml(f.bodyText) : '';
  const subtitle = f.standfirst ? stripHtml(f.standfirst) : (rawBody.slice(0, 200) + (rawBody.length > 200 ? '...' : ''));
  const author   = f.byline || 'The Guardian India Bureau';
  const pubDate  = item.webPublicationDate ?? new Date().toISOString();
  const { verticalId, verticalName } = inferVertical(title, item.sectionName ?? '');

  const id = `guardian-${item.id.replace(/\//g, '-').slice(-50)}`;

  let contentType: ContentType = 'NEWS';
  const t = title.toLowerCase();
  if (t.match(/analysis|explained|why |how |what is/))                contentType = 'ANALYSIS';
  if (t.match(/investigation|probe|exclusive|ground|report|inside/))  contentType = 'GROUND REPORT';

  const sourceType: SourceType = 'Wire / Verified Reporter';
  const wordCount = rawBody.split(/\s+/).length;

  return {
    id,
    title,
    subtitle,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 70),
    verticalId,
    verticalName,
    contentType,
    publishedAt: pubDate,
    readTime: `${Math.max(1, Math.ceil(wordCount / 200))} min read`,
    isExternalApi: true,
    externalSource: 'The Guardian',
    externalUrl: item.webUrl,
    author: {
      name: author,
      role: 'Guardian India Correspondent',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      bio: 'India correspondent, The Guardian.',
      articlesCount: 0,
      accuracyScore: 97,
    },
    heroImage: f.thumbnail || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&auto=format&fit=crop&q=80',
    heroImageCaption: `Via The Guardian. Published ${new Date(pubDate).toLocaleDateString('en-IN')}.`,
    factBlock: {
      title: 'What Actually Happened (The Raw Fact Layer)',
      summary: subtitle,
      bullets: [
        `Source: The Guardian — Published ${new Date(pubDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
        rawBody.slice(0, 300) || subtitle,
        `Vertical: ${verticalName} · Section: ${item.sectionName || 'World'}`,
        'RAWINDIA Standard: Wire transcription pending Groq editorial synthesis.',
      ],
      primarySources: [`The Guardian: ${item.webUrl}`],
    },
    sourceTransparency: [{
      id:              `st-${id}`,
      type:            sourceType,
      name:            'The Guardian (Open Platform)',
      description:     'Verified international journalism via Guardian Open Platform API.',
      verified:        true,
      reliabilityScore: 96,
      url:             item.webUrl,
    }],
    correctionLog: [],
    bodyParagraphs: rawBody
      ? [rawBody.slice(0, 400), rawBody.slice(400, 800), rawBody.slice(800, 1200)].filter(Boolean)
      : [subtitle, 'Full article available at the original source.'],
    communityStance: { accurate: 0, needsContext: 0, disputed: 0 },
    tags: ['The Guardian', verticalName, 'Historical Archive'],
  };
}

// ── Fetch one month/query batch from Guardian ─────────────────────────────────

async function fetchGuardianPage(
  query: string,
  fromDate: string,
  toDate: string,
  page: number
): Promise<{ articles: Article[]; totalPages: number }> {
  const params = new URLSearchParams({
    q:               query,
    'from-date':     fromDate,
    'to-date':       toDate,
    'page-size':     String(PAGE_SIZE),
    page:            String(page),
    'order-by':      'newest',
    'show-fields':   'headline,standfirst,bodyText,thumbnail,byline,trailText',
  });

  const url = `${GUARDIAN_BASE}?${params.toString()}`;

  try {
    const res = await fetchWithRetry(url, () => ({ signal: AbortSignal.timeout(10_000) }));
    if (!res.ok) return { articles: [], totalPages: 0 };

    const data: GuardianResponse = await res.json();
    if (data.response.status !== 'ok') return { articles: [], totalPages: 0 };

    const articles = data.response.results
      .filter(r => r.webTitle && !r.webTitle.includes('[Removed]'))
      .map(r => guardianToArticle(r));

    return { articles, totalPages: Math.min(data.response.pages, 3) }; // cap at 3 pages per query
  } catch {
    return { articles: [], totalPages: 0 };
  }
}

// ── Build date-range pairs for the past N months ──────────────────────────────

function buildMonthRanges(monthsBack: number): { from: string; to: string }[] {
  const ranges: { from: string; to: string }[] = [];
  const now = new Date();

  for (let m = 0; m < monthsBack; m++) {
    const toDate   = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const fromDate = new Date(now.getFullYear(), now.getMonth() - m - 1, 1);
    ranges.push({
      from: fromDate.toISOString().split('T')[0],
      to:   toDate.toISOString().split('T')[0],
    });
  }

  return ranges;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch one cycle of historical Guardian articles.
 * Called progressively — each call fetches ~2 months to avoid rate limits.
 */
export async function fetchGuardianHistoricalChunk(
  cycleIndex: number = 0
): Promise<Article[]> {
  // Each cycle covers 2 consecutive months
  const monthsBack = 12;
  const ranges     = buildMonthRanges(monthsBack);
  const start      = (cycleIndex * 2) % ranges.length;
  const batch      = ranges.slice(start, start + 2);
  const query      = INDIA_QUERIES[cycleIndex % INDIA_QUERIES.length];

  const results: Article[] = [];

  for (const { from, to } of batch) {
    const { articles, totalPages } = await fetchGuardianPage(query, from, to, 1);
    results.push(...articles);

    // Fetch page 2 if available
    if (totalPages >= 2) {
      await new Promise(r => setTimeout(r, 300)); // respect rate limit
      const { articles: page2 } = await fetchGuardianPage(query, from, to, 2);
      results.push(...page2);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  return results;
}

// If every configured Guardian key is exhausted/rate-limited (or the network
// is down), each of the 120 batches below fails instantly — with no circuit
// breaker, the loop used to blindly march through all 120 anyway, showing as
// a wall of near-instant 429s with nothing to show for it. After this many
// CONSECUTIVE empty batches, stop early instead of continuing to hammer an
// API that's already told us nothing is going to succeed right now.
const CONSECUTIVE_FAILURE_LIMIT = 3;

// This MUST be module-level, not a local variable inside loadFullYearHistory
// — a per-call counter resets to zero every time the function is invoked
// again, and in dev this function gets re-invoked far more often than it
// looks like it should (React re-mounting the effect that calls it, Vite HMR
// reloading App.tsx on every save during active development, etc.). Each
// fresh call was starting the failure count over from 0, so the breaker
// below could trip and the very next invocation would just start hammering
// all over again — from the outside, indistinguishable from no breaker at
// all. This timestamp survives across calls within the same page load, so
// once Guardian is determined to be dead, EVERY subsequent call (no matter
// what re-triggered it) skips straight past without making a single request
// until the cooldown expires.
let guardianDeadUntil = 0;
const GUARDIAN_DEAD_COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes

// Guards against two structurally different sources of duplicate calls:
//
// 1. Same page load, same tick: React 19 StrictMode's dev-only double-invoke
//    (mount → cleanup → mount again) fires App.tsx's effect twice, and its
//    cleanup doesn't cancel the in-flight loadFullYearHistory() call — so
//    two copies of this loop ran concurrently, each with its own local
//    consecutiveFailures counter, doubling every request this function made
//    against the real Guardian quota. `guardianLoadInFlight` makes the
//    second concurrent call a no-op instead.
//
// 2. Across page loads: every full browser reload during active dev
//    re-mounts App.tsx from scratch, which re-runs this whole 120-batch loop
//    again — burning more of the same daily Guardian quota every single
//    refresh. `guardianLastAttemptAt` in localStorage (survives a reload,
//    unlike the in-memory guards above) makes reloads within the cooldown
//    window skip straight to "done" instead of re-attempting.
let guardianLoadInFlight = false;
const GUARDIAN_LAST_ATTEMPT_KEY = 'rawindia_guardian_last_attempt';

/**
 * Full 1-year historical load — runs in background, calls onBatch for each chunk.
 * Total: ~12 months × 10 queries × 2 pages × 50 articles = up to 12,000 articles.
 */
export async function loadFullYearHistory(
  onBatch: (articles: Article[], progress: { done: number; total: number }) => void
): Promise<void> {
  const monthsBack = 12;
  const ranges     = buildMonthRanges(monthsBack);
  const total      = ranges.length * INDIA_QUERIES.length;
  let done         = 0;
  let consecutiveFailures = 0;

  if (guardianLoadInFlight) {
    console.warn('[Guardian] historical load already in progress — skipping duplicate concurrent invocation (StrictMode dev double-invoke)');
    onBatch([], { done: total, total });
    return;
  }

  // Guardian was already determined dead recently (by this call or an
  // earlier, unrelated one) — don't make a single request, just report done.
  if (Date.now() < guardianDeadUntil) {
    console.warn(`[Guardian] skipping historical load — still in cooldown from a recent failure (${Math.ceil((guardianDeadUntil - Date.now()) / 1000)}s left)`);
    onBatch([], { done: total, total });
    return;
  }

  const lastAttempt = Number(localStorage.getItem(GUARDIAN_LAST_ATTEMPT_KEY) || 0);
  if (Date.now() - lastAttempt < GUARDIAN_DEAD_COOLDOWN_MS) {
    console.warn(`[Guardian] skipping historical load — attempted again too soon after a reload (${Math.ceil((GUARDIAN_DEAD_COOLDOWN_MS - (Date.now() - lastAttempt)) / 1000)}s left in cooldown)`);
    onBatch([], { done: total, total });
    return;
  }
  localStorage.setItem(GUARDIAN_LAST_ATTEMPT_KEY, String(Date.now()));

  guardianLoadInFlight = true;
  try {

  outer: for (const { from, to } of ranges) {
    for (const query of INDIA_QUERIES) {
      try {
        const { articles, totalPages } = await fetchGuardianPage(query, from, to, 1);
        const all = [...articles];

        for (let p = 2; p <= Math.min(totalPages, 3); p++) {
          await new Promise(r => setTimeout(r, 350));
          const { articles: more } = await fetchGuardianPage(query, from, to, p);
          all.push(...more);
        }

        // A batch with zero results is almost always a rate-limit/auth
        // failure (fetchGuardianPage swallows errors and returns an empty
        // array rather than throwing) — a genuinely quiet news query is
        // possible but rare given these are broad India-wide topic searches.
        if (all.length === 0) {
          consecutiveFailures++;
        } else {
          consecutiveFailures = 0;
        }

        onBatch(all, { done: ++done, total });

        if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
          guardianDeadUntil = Date.now() + GUARDIAN_DEAD_COOLDOWN_MS;
          console.warn(`[Guardian] ${consecutiveFailures} consecutive empty batches — stopping historical load early (likely all keys exhausted), cooling down for ${GUARDIAN_DEAD_COOLDOWN_MS / 60000}min. ${done}/${total} attempted.`);
          break outer;
        }

        await new Promise(r => setTimeout(r, 400)); // ~2.5 req/sec — well under 12/sec limit
      } catch {
        done++;
        consecutiveFailures++;
        if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
          guardianDeadUntil = Date.now() + GUARDIAN_DEAD_COOLDOWN_MS;
          console.warn(`[Guardian] ${consecutiveFailures} consecutive failures — stopping historical load early, cooling down for ${GUARDIAN_DEAD_COOLDOWN_MS / 60000}min. ${done}/${total} attempted.`);
          break outer;
        }
      }
    }
  }

  } finally {
    guardianLoadInFlight = false;
  }

  // Report as fully "done" regardless of whether it finished naturally or
  // stopped early — the caller's progress UI treats done>=total as complete
  // either way, and there's nothing more useful to say to the user than
  // "the archive load has finished (for now)".
  onBatch([], { done: total, total });
}
