/**
 * RAWINDIA — RBI Press Release Ingestion
 *
 * The one government source researched that's fully viable: no CAPTCHA, no
 * key, no paywall — a real public RSS feed plus real per-release PDF links.
 * Everything here is a genuine HTTP fetch through our own proxy (api/rbi.ts,
 * avoids browser CORS since the individual press-release pages don't send
 * CORS headers) followed by deterministic parsing. Nothing here is invented:
 * title/body come from the RSS feed's own fields, and the PDF citation URL
 * is only ever the one actually extracted from the real fetched HTML — if
 * a given release has no id='APDF_' anchor (e.g. some notices don't carry
 * a PDF), the source link falls back to the press-release page itself,
 * never a guessed PDF URL. Groq then rewrites title/body in RAWINDIA's
 * voice exactly like every other source — this only replaces where the
 * raw facts and citation come from.
 */

import type { Article, ContentType } from '../types';
import { getImageForArticle } from './imageService';
import { fetchWithRetry } from './newsApiService';

const RBI_FEED_URL = '/api/rbi?type=feed';
const RBI_PDF_URL  = (link: string) => `/api/rbi?type=pdf&link=${encodeURIComponent(link)}`;

interface RbiFeedItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ').trim();
}

async function fetchPdfLink(link: string): Promise<string | null> {
  try {
    const res = await fetchWithRetry(RBI_PDF_URL(link), () => ({ signal: AbortSignal.timeout(8000) }));
    if (!res.ok) return null;
    const data: { pdfUrl: string | null } = await res.json();
    return data.pdfUrl;
  } catch {
    return null;
  }
}

async function rbiItemToArticle(item: RbiFeedItem, idx: number): Promise<Article> {
  const title   = item.title;
  const rawDesc = stripHtml(item.description || '');
  const pubDate = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();

  const idBase = item.link || `rbi-${idx}`;
  const id     = `rbi-${idBase.replace(/[^a-zA-Z0-9]/g, '').slice(-40)}`;

  const t = title.toLowerCase();
  let contentType: ContentType = 'NEWS';
  if (t.match(/explained?|why |how |what is|q&a|faq/)) contentType = 'ANALYSIS';

  // The one real fact-check step in this whole pipeline: fetch the actual
  // press-release page and pull whatever real PDF link is really there.
  const pdfUrl = await fetchPdfLink(item.link);
  const citationUrl = pdfUrl || item.link;

  const rawArticle: Article = {
    id,
    title,
    subtitle: rawDesc.slice(0, 220) + (rawDesc.length > 220 ? '...' : ''),
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 70),
    verticalId: 4,
    verticalName: 'Business & Economy',
    subCategory: 'Macroeconomy & Policy',
    subSubCategory: 'RBI Monetary Policy & Repo Rates',
    contentType,
    publishedAt: pubDate,
    readTime: `${Math.max(1, Math.ceil(rawDesc.split(/\s+/).length / 200))} min read`,
    isExternalApi: true,
    externalSource: 'Reserve Bank of India',
    externalUrl: item.link,
    author: {
      name:          'Reserve Bank of India',
      role:          'Press Release',
      avatar:        'https://images.unsplash.com/photo-1601597111158-2fceff292cdc?w=150&auto=format&fit=crop&q=80',
      bio:           'Official press release from the Reserve Bank of India.',
      articlesCount: 0,
      accuracyScore: 99,
    },
    heroImage:        '',
    heroImageCaption: 'Reserve Bank of India, Mumbai.',
    factBlock: {
      title:   'What Actually Happened (The Raw Fact Layer)',
      summary: rawDesc.slice(0, 200),
      bullets: [
        `Source: Reserve Bank of India (official press release) — Published ${new Date(pubDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
        rawDesc.slice(0, 300) || title,
        'Vertical: Business & Economy — Macroeconomy & Policy',
        pdfUrl ? 'Primary source: original RBI PDF notification.' : 'Primary source: RBI press release page.',
      ],
      primarySources: [`Reserve Bank of India: ${citationUrl}`],
    },
    sourceTransparency: [{
      id:               `st-${id}`,
      type:             'Official statement',
      name:             'Reserve Bank of India — Official Press Release',
      description:      pdfUrl
        ? 'Direct link to the original RBI PDF notification.'
        : 'Direct link to the official RBI press-release page (no standalone PDF for this release).',
      verified:         true,
      reliabilityScore: 99,
      url:              citationUrl,
    }],
    correctionLog: [],
    bodyParagraphs: [rawDesc || title],
    communityStance: { accurate: 0, needsContext: 0, disputed: 0 },
    tags: ['RBI', 'Reserve Bank of India', 'Business & Economy'],
  };

  const img = await getImageForArticle(rawArticle);
  rawArticle.heroImage = img;

  return rawArticle;
}

// ── Public: fetch current RBI press releases ─────────────────────────────
export async function fetchRbiPressReleases(): Promise<Article[]> {
  try {
    const res = await fetchWithRetry(RBI_FEED_URL, () => ({ signal: AbortSignal.timeout(10_000) }));
    if (!res.ok) return [];

    const data: { items: RbiFeedItem[] } = await res.json();
    if (!data.items?.length) return [];

    return await Promise.all(data.items.map((item, i) => rbiItemToArticle(item, i)));
  } catch {
    return [];
  }
}
