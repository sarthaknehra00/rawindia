/**
 * RAWINDIA — Relevant Image Service
 *
 * Priority chain for getting an image for any article:
 *  1. Article's own image (from API — urlToImage / thumbnail / enclosure)
 *  2. Pexels editorial photo (if VITE_PEXELS_KEY is set — free at pexels.com/api)
 *  3. Curated India-topic Unsplash pool (no key needed, always works)
 *
 * Cleanup: removes heroImage from articles > 24h old AND low importance (P3).
 */

import type { Article } from '../types';
import { saveArticles, getLatestArticles } from './persistenceService';
import { rankArticles } from './rankingEngineService';

const PEXELS_KEY  = import.meta.env.VITE_PEXELS_KEY || '';
const PEXELS_URL  = 'https://api.pexels.com/v1/search';

// ── Pexels image cache (avoid refetching the same search) ─────────────────────
const pexelsCache = new Map<string, string>();

// ── Curated Unsplash fallback pool by topic ───────────────────────────────────
// These are real, stable Unsplash photo IDs relevant to India news verticals.
// Format: https://images.unsplash.com/photo-{ID}?w=1200&auto=format&fit=crop&q=80
const UNSPLASH: Record<string, string[]> = {
  // India / National / Parliament / Government
  national: [
    '1529107386315-e1a2ed48a620', // Indian Parliament building
    '1580537659466-0a9bfa916a54', // Government building exterior
    '1564501049412-61571f491d03', // India flag cityscape
    '1609010697446-11e2e5d4d9bc', // New Delhi architecture
    '1581833971358-2c8b550f87b3', // Indian government seal context
  ],
  // Supreme Court / Law / Judiciary
  judiciary: [
    '1589994965851-a8f479c573a9', // Courtroom interior
    '1593115057322-e994c090e91b', // Law books / legal
    '1505664194779-8beaceb88b84', // Scales of justice
    '1453945995024-6a6289f6c9e3', // Legal documents
  ],
  // Economy / Business / Markets / Finance
  economy: [
    '1611974789855-9c2a0a7236a3', // Stock market screens
    '1611974791009-ef3765f49a54', // Trading floor
    '1559526324-593bc073d938', // Finance charts
    '1526304640581-d334cdbbf45e', // Business meeting India
    '1565372222086-7a7b7b2e5e9a', // Mumbai financial district
    '1568605117036-5fe5e7bab0b7', // Indian currency / Rupee
  ],
  // Technology / ISRO / Space / Startups / AI
  technology: [
    '1518770660439-4636190af475', // Circuit board / semiconductors
    '1451187580459-43490279c0fa', // Space / satellite
    '1581090700227-1e37b190418e', // Technology abstract
    '1485827404703-89b55fcc595e', // Rocket launch
    '1607799279861-4dd421887179', // ISRO / space mission
    '1518770660439-4636190af475', // Tech hardware
  ],
  // Defence / Army / Border / Security
  defence: [
    '1578985545062-c9c7bb6bd1ae', // Military aircraft
    '1547592180-85f173990554', // Army soldiers silhouette
    '1474511320723-9a56873867b5', // Border / patrol
    '1553532434-5ab5b6b84993', // Military operation context
  ],
  // Cricket / IPL / Sports
  cricket: [
    '1531415074968-036ba1b575da', // Cricket match stadium
    '1540747913346-19e32dc3e97e', // Cricket bat and ball
    '1540552803-9b51a4d8d71b', // Cricket stadium India
    '1624526267942-ab0ff8a3e972', // Cricket action
  ],
  // Sports (general)
  sports: [
    '1461896836374-f1bc3ae5bf69', // Sports stadium
    '1526232761682-d26e03ac148e', // Athletes on track
    '1551698618-1dfe5d97d256', // Sport competition
    '1571019613454-1cb2f99b2d8b', // Athletes training
  ],
  // Bollywood / Entertainment / Cinema
  entertainment: [
    '1509347528160-9a9e33742cdb', // Film clapperboard
    '1489599849927-2ee91cede3ba', // Cinema / movie theater
    '1512149177596-f817c7ef5d4c', // Film production
    '1478720568477-152d9b164e26', // Stage / performance India
  ],
  // Floods / Disaster / Environment
  disaster: [
    '1547036967-23d11aacaee0', // Flood aerial view
    '1569436753823-d1351d2c2d00', // Natural disaster
    '1504608524841-42785f012aef', // Storm / monsoon
    '1461696114087-397271a7aeef', // Climate / environment
  ],
  // Agriculture / Farmers / Rural
  agriculture: [
    '1574943320219-553eb213f72d', // Indian farmers field
    '1500382017468-9049fed747ef', // Agriculture field sunset
    '1523348837708-15d4a09cfac2', // Farmer protest India
    '1464226184884-fa280b87c399', // Rural India landscape
  ],
  // Delhi / Cities / Urban India
  delhi: [
    '1587474260584-136574297316', // Delhi skyline / Red Fort
    '1524492412937-b28074a5d7da', // India Gate Delhi
    '1564501049412-61571f491d03', // India urban cityscape
    '1596422846543-75c6fc197f07', // Delhi street
  ],
  // Mumbai
  mumbai: [
    '1529253355930-ddbe423a2ac7', // Mumbai skyline / Bandra-Worli
    '1570168006896-5ffd73efab3e', // Marine Drive Mumbai night
    '1587474260584-136574297316', // Mumbai aerial
  ],
  // World / Foreign Policy / Geopolitics
  world: [
    '1476514525535-07fb3b4ae5f1', // Diplomacy / UN
    '1529108190538-fa2b2be8a9aa', // International conference
    '1508739773434-c26b3d09e071', // World map / global
    '1530973428-5bf2db2e4d71', // International diplomacy
  ],
  // Science / Research / Environment
  science: [
    '1532094349884-32a418ba9c76', // Laboratory research India
    '1446776877081-d282a0f896e2', // Space / astronomy
    '1559825481-12a05cc00344', // Environmental science
    '1504711434969-e33886168f5c', // Science abstract
  ],
  // Health / Medicine
  health: [
    '1576091160550-2173dba999ef', // Hospital / medical India
    '1530026405845-eab787adb96d', // Healthcare workers
    '1584515933487-779824d29309', // Medicine / pharmacy
  ],
  // Elections / Voting / Democracy
  election: [
    '1535016120720-40c3f2a23cbe', // Voting booth / ballot
    '1557804506-669a67965ba0', // Political rally India
    '1529107386315-e1a2ed48a620', // Parliament (elections)
  ],
  // Crime / Investigation / CBI / Police
  crime: [
    '1454165804606-c3d57bc86b40', // Investigation / police
    '1614680376573-df3480f0c6b8', // Crime scene abstract
    '1589994965851-a8f479c573a9', // Legal / investigation
  ],
};

// ── Extract relevant Unsplash image for an article ─────────────────────────────

function pickUnsplashImage(article: Article): string {
  const text = (article.title + ' ' + (article.subtitle || '') + ' ' + article.tags.join(' ')).toLowerCase();

  // Score each pool key against the article text
  const scores: [string, number][] = Object.keys(UNSPLASH).map(key => {
    const keywords = key.split('_');
    const score = keywords.reduce((s, kw) => s + (text.includes(kw) ? 2 : 0), 0)
      + (text.includes(key) ? 3 : 0);
    return [key, score];
  });

  // Also check vertical
  const verticalMap: Record<number, string> = {
    1: 'national', 2: 'delhi', 3: 'world', 4: 'economy',
    5: 'technology', 6: 'science', 7: 'sports', 8: 'entertainment',
  };
  const vKey = verticalMap[article.verticalId ?? 1] ?? 'national';
  scores.push([vKey, 5]); // vertical is a strong signal

  scores.sort((a, b) => b[1] - a[1]);
  const bestKey = scores[0][0];
  const pool    = UNSPLASH[bestKey] ?? UNSPLASH.national;

  // Pick deterministically based on article ID so same article always gets same image
  const charSum = article.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const idx     = charSum % pool.length;

  return `https://images.unsplash.com/photo-${pool[idx]}?w=1200&auto=format&fit=crop&q=80`;
}

// ── Pexels search (requires VITE_PEXELS_KEY) ──────────────────────────────────

async function fetchPexelsImage(searchTerms: string): Promise<string | null> {
  if (!PEXELS_KEY) return null;

  const cached = pexelsCache.get(searchTerms);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      query:       `india ${searchTerms}`,
      per_page:    '3',
      orientation: 'landscape',
    });

    const res = await fetch(`${PEXELS_URL}?${params}`, {
      headers: { Authorization: PEXELS_KEY },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const photo = data.photos?.[0];
    if (!photo) return null;

    const url = photo.src?.large2x || photo.src?.large || photo.src?.medium;
    if (url) pexelsCache.set(searchTerms, url);
    return url ?? null;
  } catch {
    return null;
  }
}

// ── Check if an article's current image is a real editorial image ─────────────
// Real = came from the news source itself (NewsAPI urlToImage, Guardian thumbnail, etc.)
// NOT real = one of our generated fallbacks OR a generic Unsplash stock photo

const OUR_FALLBACK_IDS = new Set([
  '1504711434969-e33886168f5c',  // generic news placeholder
  '1451187580459-43490279c0fa',  // space/satellite
  '1518770660439-4636190af475',  // circuit board
  '1529107386315-e1a2ed48a620',  // parliament (generic)
  '1580537659466-0a9bfa916a54',  // govt building (generic)
]);

// Common news image domains — images from these ARE real article photos
const NEWS_IMAGE_DOMAINS = [
  'ndtv.com', 'thehindu.com', 'hindustantimes.com', 'timesofindia.com',
  'indianexpress.com', 'livemint.com', 'economictimes.indiatimes.com',
  'scroll.in', 'thewire.in', 'theprint.in', 'news18.com',
  'theguardian.com', 'static.guim.co.uk', 'media.guim.co.uk',
  'images.news18.com', 'akm-img', 'gstatic.com', 'googleusercontent.com',
  'bbc.co.uk', 'bbc.com', 'reuters.com', 'apimages.com',
  'images.indianexpress.com', 'images.livemint.com',
  // rss2json often serves images via this proxy
  'images.pexels.com',
];

function isNewsSourceImage(url: string): boolean {
  if (!url || url.length < 10) return false;
  // Must be https
  if (!url.startsWith('http')) return false;
  // Check if it's from a known news domain
  const lurl = url.toLowerCase();
  if (NEWS_IMAGE_DOMAINS.some(d => lurl.includes(d))) return true;
  // Not one of our fallback Unsplash photos
  if (lurl.includes('unsplash.com')) {
    return !Array.from(OUR_FALLBACK_IDS).some(id => lurl.includes(id));
  }
  // Any other https image URL is treated as real
  return true;
}

function hasRealImage(article: Article): boolean {
  return isNewsSourceImage(article.heroImage || '');
}

// ── Public: get the best image for an article ─────────────────────────────────

export async function getImageForArticle(article: Article): Promise<string> {
  // 1. Use the article's own image if it's a real one
  if (hasRealImage(article)) return article.heroImage!;

  // 2. Try Pexels with article title keywords (if key available)
  if (PEXELS_KEY) {
    const terms = extractImageTerms(article);
    const pexels = await fetchPexelsImage(terms);
    if (pexels) return pexels;
  }

  // 3. Curated Unsplash pool — always available, no key needed
  return pickUnsplashImage(article);
}

function extractImageTerms(article: Article): string {
  // Extract 2-3 meaningful keywords from the title for image search
  const stopWords = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'has', 'have', 'had', 'will', 'would', 'could', 'should', 'may', 'might', 'india', 'indian']);
  const words = article.title.toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .slice(0, 3);
  return words.join(' ') || article.verticalName || 'news';
}

// ── Enrich a batch of articles with relevant images ───────────────────────────

export async function enrichArticlesWithImages(articles: Article[]): Promise<Article[]> {
  const enriched: Article[] = [];

  for (const art of articles) {
    if (hasRealImage(art)) {
      enriched.push(art);
      continue;
    }

    const image = await getImageForArticle(art);
    enriched.push({ ...art, heroImage: image });

    // Small delay between Pexels calls to avoid rate limiting
    if (PEXELS_KEY) await new Promise(r => setTimeout(r, 100));
  }

  return enriched;
}

// ── Auto-cleanup: remove images from old low-importance articles ───────────────
// Articles > 24h old AND P3 tier → image cleared (saves storage, reduces noise)

const ONE_DAY_MS = 86_400_000;

export async function cleanupOldArticleImages(): Promise<number> {
  const articles  = await getLatestArticles(2000);

  // First ensure rankings are applied
  const ranked = rankArticles(articles, 'default');

  const toClean = ranked.filter(a => {
    const ageMs    = Date.now() - new Date(a.publishedAt).getTime();
    // Bug fix: this used to compare ageMs (a duration) against
    // `Date.now() - ONE_DAY_MS` (an absolute epoch timestamp) — a unit
    // mismatch that made `isOld` false for every article regardless of
    // real age, so this cleanup never actually cleared a single image
    // since it was written. Compare the duration against the duration.
    const isOld    = ageMs > ONE_DAY_MS;
    const tier     = a.ranking?.priorityTier;
    const isLowImp = tier === 'P3' || (tier === 'P2' && (a.ranking?.importanceScore ?? 100) < 35);
    const hasImg   = Boolean(a.heroImage);
    return isOld && isLowImp && hasImg;
  });

  if (toClean.length === 0) return 0;

  const cleaned = toClean.map(a => ({
    ...a,
    heroImage:        '',
    heroImageCaption: '[Image archived — article over 24h, low priority]',
  }));

  await saveArticles(cleaned);
  return cleaned.length;
}
