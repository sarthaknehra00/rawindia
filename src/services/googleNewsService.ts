/**
 * RAWINDIA — Google News RSS Scraper
 *
 * Fetches India news from Google News RSS feeds via our own serverless proxy
 * (api/rss2json.ts) — the real rss2json key(s) live server-side only, in
 * Vercel env vars, and are never shipped to the client bundle.
 * Every article is then rewritten through Groq and images are extracted from the feed.
 *
 * Image extraction chain per article:
 *  1. item.thumbnail   (rss2json field — maps from media:content/enclosure)
 *  2. item.enclosure.link (RSS enclosure tag)
 *  3. <img src="..."> in item.description HTML
 *  4. <img src="..."> in item.content HTML
 *  5. Curated Unsplash pool (topic-matched fallback)
 */

import type { Article, ContentType, SourceType } from '../types';
import { getImageForArticle } from './imageService';
import { fetchWithRetry } from './newsApiService';

const RSS2JSON_BASE = '/api/rss2json?rss_url=';
const GNEWS_SEARCH  = 'https://news.google.com/rss/search?hl=en-IN&gl=IN&ceid=IN:en&q=';
const GNEWS_COUNT   = '&num=20';

// ── India-specific topic queries (one per cycle rotation) ─────────────────────
export const GNEWS_INDIA_TOPICS: { query: string; verticalId: number; verticalName: string }[] = [
  { query: 'india parliament government modi cabinet',        verticalId: 1, verticalName: 'India / National' },
  { query: 'india supreme court high court judgment verdict', verticalId: 1, verticalName: 'India / National' },
  { query: 'india RBI economy budget inflation rupee',        verticalId: 4, verticalName: 'Business & Economy' },
  { query: 'india defense army navy air force border',        verticalId: 1, verticalName: 'India / National' },
  { query: 'ISRO space mission india science',                verticalId: 5, verticalName: 'Technology' },
  { query: 'india AI startup unicorn tech funding',           verticalId: 5, verticalName: 'Technology' },
  { query: 'india cricket IPL BCCI team match',               verticalId: 7, verticalName: 'Sports' },
  { query: 'india bollywood film OTT release box office',     verticalId: 8, verticalName: 'Entertainment' },
  { query: 'india election BJP Congress AAP politics',        verticalId: 1, verticalName: 'India / National' },
  { query: 'india flood cyclone disaster relief NDRF',        verticalId: 1, verticalName: 'India / National' },
  { query: 'india sensex nifty stock market BSE NSE',         verticalId: 4, verticalName: 'Business & Economy' },
  { query: 'india CBI ED crime arrest investigation',         verticalId: 1, verticalName: 'India / National' },
  { query: 'india state assembly politics uttar pradesh',     verticalId: 2, verticalName: 'States & UTs' },
  { query: 'india china pakistan foreign policy border LAC',  verticalId: 3, verticalName: 'World (India Lens)' },
  { query: 'india climate pollution environment solar',       verticalId: 6, verticalName: 'Science & Environment' },
];

// ── RSS item type (rss2json response) ─────────────────────────────────────────
interface RSS2JSONItem {
  title:       string;
  pubDate:     string;
  link:        string;
  guid:        string;
  author:      string;
  thumbnail?:  string;               // ← rss2json maps media:content here
  description: string;
  content:     string;
  enclosure:   { link?: string; type?: string; length?: number };
  categories:  string[];
}

interface RSS2JSONResponse {
  status: 'ok' | 'error';
  feed:   { url: string; title: string };
  items:  RSS2JSONItem[];
}

// ── Image extraction from RSS item ─────────────────────────────────────────────
// Google News RSS embeds images in multiple places — try all of them.
function extractRSSImage(item: RSS2JSONItem): string | null {
  // 1. rss2json thumbnail field (populated from media:content and enclosure)
  if (item.thumbnail && item.thumbnail.startsWith('http') && !item.thumbnail.includes('google.com/s2')) {
    return item.thumbnail;
  }

  // 2. enclosure.link (RSS enclosure tag)
  if (item.enclosure?.link && item.enclosure.link.startsWith('http')) {
    return item.enclosure.link;
  }

  // 3. <img src="..."> inside description HTML
  const descMatch = (item.description || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  if (descMatch?.[1] && descMatch[1].startsWith('http')) {
    return descMatch[1];
  }

  // 4. <img src="..."> inside content HTML
  const contentMatch = (item.content || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  if (contentMatch?.[1] && contentMatch[1].startsWith('http')) {
    return contentMatch[1];
  }

  return null;
}

// ── Strip HTML tags ───────────────────────────────────────────────────────────
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ').trim();
}

// ── Convert RSS item → raw Article (before Groq rewrite) ─────────────────────
async function gnewsItemToArticle(
  item: RSS2JSONItem,
  verticalId: number,
  verticalName: string,
  idx: number
): Promise<Article> {
  const title   = item.title || 'Breaking Dispatch';
  const rawDesc = stripHtml(item.description || item.content || '');
  const source  = item.author || 'Google News';
  const pubDate = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();

  const idBase = item.guid || item.link || `gnews-${idx}`;
  const id     = `gnews-${idBase.replace(/[^a-zA-Z0-9]/g, '').slice(-40)}`;

  const t = title.toLowerCase();
  let contentType: ContentType = 'NEWS';
  if (t.match(/analysis|explained?|why |how |what is/))         contentType = 'ANALYSIS';
  if (t.match(/probe|investigation|exclusive|inside|ground/))   contentType = 'GROUND REPORT';

  const sourceType: SourceType = source.toLowerCase().match(/ministry|police|pib|official/)
    ? 'Official statement' : 'Wire / Verified Reporter';

  // Extract the actual image that came with the article from Google News
  const rssImage = extractRSSImage(item);

  // Build the raw article first — Groq will rewrite title/body/image later
  const rawArticle: Article = {
    id,
    title,
    subtitle: rawDesc.slice(0, 220) + (rawDesc.length > 220 ? '...' : ''),
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 70),
    verticalId,
    verticalName,
    contentType,
    publishedAt: pubDate,
    readTime: `${Math.max(1, Math.ceil(rawDesc.split(/\s+/).length / 200))} min read`,
    isExternalApi: true,
    externalSource: source,
    externalUrl: item.link,
    author: {
      name:          source,
      role:          'News Bureau',
      avatar:        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      bio:           `Reporting via ${source} on Google News India feed.`,
      articlesCount: 0,
      accuracyScore: 94,
    },
    // Use extracted RSS image if available; otherwise curated pool will be used after Groq
    heroImage:        rssImage || '',
    heroImageCaption: `Via ${source}.`,
    factBlock: {
      title:          'What Actually Happened (The Raw Fact Layer)',
      summary:        rawDesc.slice(0, 200),
      bullets: [
        `Source: ${source} via Google News India — Published ${new Date(pubDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
        rawDesc.slice(0, 300) || title,
        `Vertical: ${verticalName}`,
        'RAWINDIA Standard: Pending editorial synthesis.',
      ],
      primarySources: [item.link ? `${source}: ${item.link}` : `${source} via Google News`],
    },
    sourceTransparency: [{
      id:              `st-${id}`,
      type:            sourceType,
      name:            `${source} via Google News India (gl=IN, hl=en-IN)`,
      description:     `Google News India RSS feed. Publisher: ${source}.`,
      verified:        true,
      reliabilityScore: 93,
      url:             item.link,
    }],
    correctionLog: [],
    bodyParagraphs: [rawDesc || title],
    communityStance: { accurate: 0, needsContext: 0, disputed: 0 },
    tags:          ['Google News', verticalName, source],
  };

  // If no RSS image was found, fetch a relevant image from our curated pool now
  // (Groq will later refine this when it rewrites the article)
  if (!rssImage) {
    const img = await getImageForArticle(rawArticle);
    rawArticle.heroImage = img;
  }

  return rawArticle;
}

// ── Fetch one topic feed ──────────────────────────────────────────────────────
async function fetchTopicFeed(
  query: string,
  verticalId: number,
  verticalName: string,
  idxOffset: number
): Promise<Article[]> {
  const gnewsUrl = `${GNEWS_SEARCH}${encodeURIComponent(query)}${GNEWS_COUNT}`;
  const fetchUrl = `${RSS2JSON_BASE}${encodeURIComponent(gnewsUrl)}`;

  try {
    const res = await fetchWithRetry(fetchUrl, () => ({ signal: AbortSignal.timeout(8000) }));
    if (!res.ok) return [];

    const data: RSS2JSONResponse = await res.json();
    if (data.status !== 'ok' || !data.items?.length) return [];

    const articles = await Promise.all(
      data.items
        .filter(item => item.title && !item.title.includes('[Removed]'))
        .map((item, i) => gnewsItemToArticle(item, verticalId, verticalName, idxOffset + i))
    );

    return articles;
  } catch {
    return [];
  }
}

// ── Public: real, on-demand news for a specific state/UT ─────────────────────
// The States & UTs explorer used to rely entirely on hoping a generic
// national-news pool happened to mention a state's city by name — with a
// small/rate-limited pool, that frequently turned up nothing, showing an
// honest-but-unhelpful "no dispatches" empty state. This fetches real,
// state-specific news on demand instead, and stamps the actual state name
// onto each result so later keyword-based matching (articleMatchesState in
// TaxonomyExplorer.tsx) has a guaranteed, reliable hit rather than a guess.
export async function fetchStateNews(stateName: string): Promise<Article[]> {
  const articles = await fetchTopicFeed(`${stateName} India news`, 2, 'States & UTs', 0);
  return articles.map(a => ({ ...a, state: stateName }));
}

// ── Public: fetch rotating set of India topic feeds ───────────────────────────
export async function fetchGoogleNewsIndia(
  cycleIndex: number = 0,
  topicsPerRun: number = 4
): Promise<Article[]> {
  const total  = GNEWS_INDIA_TOPICS.length;
  // Combine cycleIndex with the current time (e.g. 10-minute intervals) 
  // so that if a user constantly hard-refreshes the page, they don't get stuck 
  // checking the exact same first 4 topics forever.
  const timeOffset = Math.floor(Date.now() / (10 * 60 * 1000)); 
  const start  = ((cycleIndex + timeOffset) * topicsPerRun) % total;
  const topics = Array.from({ length: topicsPerRun }, (_, i) => GNEWS_INDIA_TOPICS[(start + i) % total]);

  const results = await Promise.allSettled(
    topics.map((t, i) => fetchTopicFeed(t.query, t.verticalId, t.verticalName, i * 20))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<Article[]> => r.status === 'fulfilled')
    .flatMap(r => r.value);
}

// ── Full initial load: all 15 India topic feeds ───────────────────────────────
export async function fetchAllGoogleNewsIndia(): Promise<Article[]> {
  const results = await Promise.allSettled(
    GNEWS_INDIA_TOPICS.map((t, i) => fetchTopicFeed(t.query, t.verticalId, t.verticalName, i * 20))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<Article[]> => r.status === 'fulfilled')
    .flatMap(r => r.value);
}
