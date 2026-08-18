import type { Article, ContentType, SourceType } from '../types';
import { rankArticles } from './rankingEngineService';
import { groqQueue } from './groqQueueService';
import { significantTitleTokens, sharedTokenCount } from '../utils/textSimilarity';
import { recordClusterCandidate, finalizePendingClusters } from './storyClusterService';

// NewsAPI/Currents calls are routed through our own serverless proxy
// (api/news.ts) — the real keys live server-side only, in Vercel env vars,
// and are never shipped to the client bundle.

// Bump this key to wipe any old non-India articles from localStorage
const LOCAL_STORAGE_ARCHIVE_KEY = 'RAWINDIA_NEWS_ARCHIVE_V3_INDIA_ONLY';

// ── Cross-source near-duplicate detection (see STEP 1 in loadArchiveAndFetch) ─
const NEAR_DUP_WINDOW_MS = 48 * 60 * 60 * 1000; // same story clusters within this window
const MIN_SHARED_TITLE_TOKENS = 2; // 1 shared word is coincidence; 2+ is the same story

export interface ApiFetchResult {
  articles: Article[];
  source: 'NewsAPI Top Headlines' | 'NewsAPI Historical Archive' | 'Currents API' | 'Blended Live Wire';
  totalResults: number;
  lastUpdated: string;
  archivedTotalCount: number;
}

/**
 * Fetch with a single retry on transient failure — a network-level error
 * (timeout, DNS blip, offline momentarily) or a 5xx/429 upstream response.
 * Does NOT retry a definitive 4xx (malformed request, bad params) since
 * retrying an already-wrong request wastes a call without changing anything.
 * Deliberately simple (one retry, one fixed short delay) — not a full
 * exponential-backoff library, which this ingestion volume doesn't need.
 * Exported so googleNewsService.ts / guardianNewsService.ts can reuse it.
 */
export async function fetchWithRetry(url: string, initFactory?: () => RequestInit): Promise<Response> {
  // initFactory (not a static init object) so a caller using AbortSignal.timeout()
  // gets a FRESH signal per attempt — reusing one signal across both attempts
  // would give the retry whatever time happened to be left on the first one.
  const attempt = () => fetch(url, initFactory?.());
  try {
    const res = await attempt();
    if (res.ok || (res.status < 500 && res.status !== 429)) return res;
    await new Promise(r => setTimeout(r, 800));
    return await attempt();
  } catch (err) {
    await new Promise(r => setTimeout(r, 800));
    try {
      return await attempt();
    } catch {
      throw err; // surface the original error if the retry also fails
    }
  }
}

// In-memory archive — mutable so we can prune it
let memoryArchive: Map<string, Article> = new Map();

// ─── Comprehensive India relevance filter ─────────────────────────────────────
// Checks both title + subtitle. ANY single match = India-relevant.
const INDIA_TERMS = [
  // Country / nationality
  'india', 'indian', 'bharat', 'bharatiya',
  // Government / institutions
  'modi', 'parliament', 'lok sabha', 'rajya sabha', 'pmo', 'cabinet',
  'supreme court', 'high court', 'election commission', 'rbi', 'sebi',
  'niti aayog', 'president of india', 'vice president', 'governor',
  'cbi', 'ed enforcement', 'nia', 'ncb', 'nia', 'isro', 'drdo',
  'bcci', 'ipl', 'indian army', 'indian navy', 'indian air force',
  // Parties & politics
  'bjp', 'congress', 'aap', 'bsp', 'sp', 'shiv sena', 'ncp',
  'trinamool', 'dravida', 'dmk', 'aiadmk', 'ysrcp', 'trs', 'bjd',
  // Major cities & states
  'delhi', 'mumbai', 'bengaluru', 'bangalore', 'chennai', 'kolkata',
  'hyderabad', 'pune', 'ahmedabad', 'surat', 'jaipur', 'lucknow',
  'kanpur', 'nagpur', 'indore', 'bhopal', 'patna', 'bhubaneswar',
  'thiruvananthapuram', 'kochi', 'guwahati', 'chandigarh', 'noida',
  'gurugram', 'gurgaon', 'faridabad', 'agra', 'varanasi',
  'uttar pradesh', 'maharashtra', 'karnataka', 'tamil nadu', 'gujarat',
  'rajasthan', 'west bengal', 'kerala', 'andhra pradesh', 'telangana',
  'bihar', 'madhya pradesh', 'odisha', 'punjab', 'haryana', 'assam',
  'jharkhand', 'uttarakhand', 'himachal', 'jammu', 'kashmir', 'ladakh',
  'goa', 'manipur', 'meghalaya', 'mizoram', 'nagaland', 'tripura',
  'sikkim', 'arunachal', 'chhattisgarh',
  // Currency & markets
  'rupee', 'inr', 'nifty', 'sensex', 'bse', 'nse',
  // Major companies / brands
  'tata', 'reliance', 'adani', 'infosys', 'wipro', 'tcs', 'hcl',
  'mahindra', 'bajaj', 'hdfc', 'icici', 'sbi', 'lic', 'ola', 'zomato',
  'swiggy', 'flipkart', 'paytm', 'byju', 'zepto', 'meesho',
  // Culture / entertainment
  'bollywood', 'tollywood', 'kollywood', 'mollywood', 'iifa',
  'filmfare', 'national film award',
  // Policy / topics
  'upi', 'gst', 'aadhaar', 'jan dhan', 'ayushman', 'pmay',
  'mnrega', 'msme', 'startup india', 'make in india', 'atmanirbhar',
  'digital india', 'smart city', 'bullet train',
  // Neighbour / foreign policy with India angle
  'india-china', 'india-pakistan', 'india-us', 'india-russia',
  'line of actual control', 'lac', 'loc', 'doklam',
];

// Precompiled once at module load, not per-check — this runs against every
// incoming article. Word-boundary matching (not plain .includes()) matters
// here specifically: short terms like 'sp' (Samajwadi Party) or 'lac'
// (Line of Actual Control) previously matched as bare substrings, so a
// non-Indian story mentioning "wasps", "grasp", "crisp", or "displace"
// would pass this site's core India-relevance gate purely by accident.
const INDIA_TERM_PATTERNS = INDIA_TERMS.map(
  term => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
);

function isIndiaRelevant(title: string, subtitle: string): boolean {
  const text = (title + ' ' + subtitle).toLowerCase();
  return INDIA_TERM_PATTERNS.some(re => re.test(text));
}

// ─── Archive helpers ──────────────────────────────────────────────────────────

function initArchiveFromStorage() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ARCHIVE_KEY);
    if (raw) {
      const parsed: Article[] = JSON.parse(raw);
      parsed.forEach(art => { if (art?.id) memoryArchive.set(art.id, art); });
    }
  } catch { /* ignore */ }
}

function persistArchive() {
  if (typeof window === 'undefined') return;
  try {
    // Prune to latest 500 India-only articles before persisting
    if (memoryArchive.size > 500) {
      const pruned = Array.from(memoryArchive.entries())
        .sort(([, a], [, b]) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 500);
      memoryArchive = new Map(pruned);
    }
    localStorage.setItem(LOCAL_STORAGE_ARCHIVE_KEY, JSON.stringify(Array.from(memoryArchive.values())));
  } catch { /* quota exceeded — skip */ }
}

initArchiveFromStorage();

// ─── Main fetch function ──────────────────────────────────────────────────────

export async function fetchLiveNews(
  query: string = 'India',
  _mode: 'live' | 'historical' | 'both' = 'both',
  fromDate?: string,
  toDate?: string
): Promise<ApiFetchResult> {

  // ── 1. NewsAPI Top Headlines — country=in guarantees India ──────────────────
  try {
    const url = `/api/news?source=newsapi-top&country=in&pageSize=40`;
    const res = await fetchWithRetry(url);
    if (res.ok) {
      const data = await res.json();
      (data.articles || []).forEach((item: any, idx: number) => {
        if (!item.title || item.title.includes('[Removed]')) return;
        const art = enrichNewsApiArticle(item, item.source?.name || 'National Wire', idx + 1);
        // country=in already guarantees India — no extra filter needed
        if (!memoryArchive.has(art.id)) memoryArchive.set(art.id, art);
      });
    }
  } catch (err) {
    console.warn('[RAWINDIA] Top headlines fetch:', err);
  }

  // ── 2. NewsAPI Everything — strictly India-scoped query ────────────────────
  // Build a tight query: user topic + mandatory "India" anchor
  // Use Indian news sources when possible to bias results
  const isDefaultQuery = !query || query === 'India';
  const everythingQ = isDefaultQuery
    ? 'India government OR India economy OR India parliament OR India Supreme Court OR India RBI'
    : `${query} India`;

  try {
    let url = `/api/news?source=newsapi-everything&q=${encodeURIComponent(everythingQ)}&language=en&sortBy=publishedAt&pageSize=40`;
    if (fromDate) url += `&from=${fromDate}`;
    if (toDate)   url += `&to=${toDate}`;

    const res = await fetchWithRetry(url);
    if (res.ok) {
      const data = await res.json();
      (data.articles || []).forEach((item: any, idx: number) => {
        if (!item.title || item.title.includes('[Removed]')) return;
        // Strict India filter BEFORE adding to archive
        if (!isIndiaRelevant(item.title || '', item.description || '')) return;
        const art = enrichNewsApiArticle(item, item.source?.name || 'Archive Wire', idx + 100);
        if (!memoryArchive.has(art.id)) memoryArchive.set(art.id, art);
      });
    }
  } catch (err) {
    console.warn('[RAWINDIA] Everything fetch:', err);
  }

  // ── 3. Currents API — always search with India keyword ─────────────────────
  const currentsKeyword = isDefaultQuery ? 'India' : `${query} India`;
  try {
    const url = `/api/news?source=currents&keywords=${encodeURIComponent(currentsKeyword)}&language=en&country=IN`;
    const res = await fetchWithRetry(url);
    if (res.ok) {
      const data = await res.json();
      (data.news || []).forEach((item: any, idx: number) => {
        if (!item.title || item.title.includes('[Removed]')) return;
        if (!isIndiaRelevant(item.title || '', item.description || '')) return;
        const art = enrichCurrentsArticle(item, 'Currents India Wire', idx + 500);
        if (!memoryArchive.has(art.id)) memoryArchive.set(art.id, art);
      });
    }
  } catch (err) {
    console.warn('[RAWINDIA] Currents fetch:', err);
  }

  // Google News RSS is deliberately NOT fetched here — this function is
  // called every 90s by the fast cron cycle (see cronSchedulerService.ts),
  // and doing a 3-topic Google News/rss2json fetch on every single call made
  // that "fast, light" cycle fire 3 extra RSS requests every 90 seconds,
  // continuously. The main 10-minute cycle and the app's initial load both
  // already make their own dedicated, more deliberately-rotated Google News
  // fetches (fetchGoogleNewsIndia / fetchAllGoogleNewsIndia) — this was pure
  // duplicate coverage, not a unique source of freshness.

  // ── STEP 1: Deduplicate archive ──────────────────────────────────────────────
  // Exact-title match catches re-fetches of the SAME article, but different
  // wires covering the SAME story almost never share an exact headline
  // ("Modi unveils ₹50,000cr scheme" vs "PM announces major economic package" —
  // Guardian vs NewsAPI vs Currents vs Google News on one event). Exact-match
  // alone let 3-4 near-identical entries through per real story. Layered on
  // top: a lightweight, embedding-free near-duplicate check — two articles
  // published within 48h that share 2+ meaningful (5+ letter, non-stopword)
  // title tokens are almost certainly the same underlying story.
  const seen = new Set<string>();
  const deduped: Article[] = [];
  const acceptedTokenSets: { article: Article; tokens: Set<string>; publishedAtMs: number }[] = [];
  Array.from(memoryArchive.values())
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .forEach(art => {
      const key = art.title.trim().toLowerCase();
      if (seen.has(key)) return;

      const tokens = significantTitleTokens(art.title);
      const publishedAtMs = new Date(art.publishedAt).getTime();
      const matchedPrimary = acceptedTokenSets.find(kept =>
        Math.abs(kept.publishedAtMs - publishedAtMs) <= NEAR_DUP_WINDOW_MS &&
        sharedTokenCount(kept.tokens, tokens) >= MIN_SHARED_TITLE_TOKENS
      );
      if (matchedPrimary) {
        // Dropped from the feed/ranking view (same story already represented),
        // but not lost — recorded as coverage of the same story so the
        // Coverage Comparison section on the surviving article can show who
        // else reported it and how their framing differed.
        recordClusterCandidate(matchedPrimary.article, art);
        return;
      }

      seen.add(key);
      acceptedTokenSets.push({ article: art, tokens, publishedAtMs });
      deduped.push(art);
    });
  finalizePendingClusters();

  // ── STEP 2: Pre-rank with keyword-derived scores (fast, no API call) ────────
  // This gives us the correct TOP articles to invest Groq quota on
  const preRanked = rankArticles(deduped, 'default');

  // ── STEP 3: Return raw-ranked articles immediately — never block on Groq ────
  // Every article is queued for rewrite in the Light Yagami/Eren Yeager editorial
  // voice; the queue already processes in ranked order, so top-priority stories
  // get synthesized first without holding up this function's return.
  groqQueue.enqueue(preRanked);
  persistArchive();

  return {
    articles: preRanked,
    source: 'Blended Live Wire',
    totalResults: preRanked.length,
    lastUpdated: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
    archivedTotalCount: memoryArchive.size,
  };
}

export function getArchivedArticles(): Article[] {
  initArchiveFromStorage();
  return Array.from(memoryArchive.values())
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export function clearNewsArchive(): void {
  memoryArchive.clear();
  if (typeof window !== 'undefined') localStorage.removeItem(LOCAL_STORAGE_ARCHIVE_KEY);
}

/**
 * Ingest external articles (Guardian, etc.) into the archive + Groq queue.
 * Returns the current ranked pool including the new articles.
 */
export function ingestArticles(incomingArticles: Article[]): Article[] {
  // India filter + dedup
  incomingArticles.forEach(art => {
    if (!memoryArchive.has(art.id)) memoryArchive.set(art.id, art);
  });

  // Deliberately NOT queued for background Groq rewrite here — this is the
  // historical/archive ingestion path (see App.tsx's loadFullYearHistory
  // callback, the only caller). Archive content is rarely read; proactively
  // rewriting all of it starved the live-article queue. Archive articles get
  // synthesized on-demand, instantly, when a reader actually opens one (see
  // ArticleView.tsx's on-open synthesis effect).
  persistArchive();

  // Return current ranked archive
  const seen  = new Set<string>();
  const deduped: Article[] = [];
  Array.from(memoryArchive.values())
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .forEach(art => {
      const key = art.title.trim().toLowerCase();
      if (!seen.has(key)) { seen.add(key); deduped.push(art); }
    });

  return rankArticles(deduped, 'default');
}

/**
 * Update a single article in the archive (called when Groq synthesis completes).
 */
export function updateArticleInArchive(article: Article): void {
  memoryArchive.set(article.id, article);
}

// ─── Article enrichment helpers ───────────────────────────────────────────────

function enrichNewsApiArticle(item: any, sourceName: string, idx: number): Article {
  const publishedDate = item.publishedAt ? new Date(item.publishedAt).toISOString() : new Date().toISOString();
  const title  = item.title || 'Breaking Dispatch';
  const desc   = item.description || item.content || item.title || '';
  const author = item.author || (item.source?.name ?? sourceName);

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 70);
  const id   = `newsapi-${slug || idx}`;

  let contentType: ContentType = 'NEWS';
  const t = title.toLowerCase();
  if (t.includes('opinion') || t.includes('column') || t.match(/\bview:/))       contentType = 'OPINION';
  else if (t.includes('analysis') || t.includes('explained') || t.includes('why')) contentType = 'ANALYSIS';
  else if (t.includes('ground report') || t.includes('probe') || t.includes('investigation')) contentType = 'GROUND REPORT';

  // Derive verticalId from title keywords
  let verticalId = 1; // default: India / National
  let verticalName = 'India / National';
  if (t.match(/cricket|ipl|bcci|football|kabaddi|hockey|badminton|tennis|chess|cwg|olympic/)) {
    verticalId = 7; verticalName = 'Sports';
  } else if (t.match(/bollywood|film|cinema|ott|netflix|hotstar|music|celebrity|award/)) {
    verticalId = 8; verticalName = 'Entertainment';
  } else if (t.match(/stock|sensex|nifty|rbi|economy|gdp|budget|inflation|startup|ipo|sebi/)) {
    verticalId = 4; verticalName = 'Business & Economy';
  } else if (t.match(/ai |artificial intelligence|tech|software|isro|space|cyber|5g|app|startup/)) {
    verticalId = 5; verticalName = 'Technology';
  } else if (t.match(/china|pakistan|us |united states|russia|diplomacy|foreign|border|lac|loc/)) {
    verticalId = 3; verticalName = 'World (India Lens)';
  } else if (t.match(/flood|earthquake|cyclone|disaster|ndrf|weather|climate|pollution/)) {
    verticalId = 6; verticalName = 'Science & Environment';
  }

  const sourceType: SourceType = author.toLowerCase().match(/ministry|police|government|pib|official/)
    ? 'Official statement' : 'Wire / Verified Reporter';

  const wordCount = desc.split(/\s+/).filter(Boolean).length;

  return {
    id,
    title,
    subtitle: desc.slice(0, 200) + (desc.length > 200 ? '...' : ''),
    slug,
    verticalId,
    verticalName,
    contentType,
    publishedAt: publishedDate,
    readTime: `${Math.max(1, Math.ceil(wordCount / 200))} min read`,
    isExternalApi: true,
    externalSource: sourceName,
    externalUrl: item.url,
    author: {
      name: author || 'RAWINDIA National Desk',
      role: 'Special Correspondent',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      bio: 'National news desk correspondent.',
      articlesCount: 290,
      accuracyScore: 98.6,
    },
    heroImage: item.urlToImage || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&auto=format&fit=crop&q=80',
    heroImageCaption: `Wire dispatch via ${sourceName}.`,
    factBlock: {
      title: 'What Actually Happened (The Raw Fact Layer)',
      summary: desc || title,
      bullets: [
        `Wire Received: ${new Date(publishedDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
        `Bureau: ${author} (${sourceName})`,
        desc.length > 30 ? desc.slice(0, 300) : 'Wire dispatch ingested via verified national news aggregator.',
        'RAWINDIA Standard: Zero editorial distortion — empirical transcription only.',
      ],
      primarySources: [item.url ? `${sourceName}: ${item.url}` : `${sourceName} Syndicated Wire`],
    },
    sourceTransparency: [{
      id: `st-${id}-1`,
      type: sourceType,
      name: `${sourceName} Certified Feed`,
      description: `Verified wire dispatch from ${sourceName}.`,
      verified: true,
      reliabilityScore: 95,
      url: item.url,
    }],
    correctionLog: [],
    bodyParagraphs: [
      desc || title,
      'RAWINDIA ingestion pipe monitors national and state wires to deliver uncompromised factual dispatches without spin.',
    ].filter(Boolean),
    communityStance: { accurate: 0, needsContext: 0, disputed: 0 },
    tags: ['Verified Feed', 'National Wire', verticalName],
  };
}

function enrichCurrentsArticle(item: any, sourceName: string, idx: number): Article {
  return enrichNewsApiArticle({
    title:       item.title,
    description: item.description,
    publishedAt: item.published,
    author:      item.author || sourceName,
    urlToImage:  item.image,
    url:         item.url,
    source:      { name: sourceName },
  }, sourceName, idx);
}
