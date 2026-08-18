// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited, clientKey, isLoopback } from './_rateLimit.js';
import { isCoolingDown, recordKeyFailure, recordKeySuccess } from './_keyCooldown.js';

// Primary key first, then backups in order — same failover pattern as
// api/groq.ts / api/news.ts / api/guardian.ts. Falls back to an unauthenticated
// request (rss2json's low anonymous rate limit) only if none are configured.
const RSS2JSON_KEYS = [
  process.env.RSS2JSON_KEY,
  process.env.RSS2JSON_KEY_BACKUP_1,
  process.env.RSS2JSON_KEY_BACKUP_2,
  process.env.RSS2JSON_KEY_BACKUP_3,
  process.env.RSS2JSON_KEY_BACKUP_4,
].filter((k): k is string => Boolean(k));

// The app only ever asks rss2json to convert Google News India RSS search
// feeds — restrict this proxy to exactly that shape rather than letting it
// become an open "fetch any URL as JSON" relay through our rss2json quota.
const ALLOWED_RSS_URL_PREFIX = 'https://news.google.com/rss/search?';

/**
 * Tries each configured key in order. Only a 429 (this key's rate limit) or
 * 401/403 (invalid/revoked key) is worth retrying with a different key — any
 * other status is a final answer a different key wouldn't change. With zero
 * keys configured, makes one unauthenticated request (rss2json works without
 * a key, just at a much lower rate limit).
 */
async function fetchWithKeyFallback(rssUrl: string): Promise<Response> {
  const keys = RSS2JSON_KEYS.length > 0 ? RSS2JSON_KEYS : [undefined];
  let lastError: unknown = null;

  const startIndex = Math.floor(Math.random() * keys.length);

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const i = (startIndex + attempt) % keys.length;
    const isLastKey = attempt === keys.length - 1;
    // The no-key anonymous slot still gets its own cooldown tracking, keyed
    // by a fixed placeholder string rather than an actual credential.
    const cooldownKey = keys[i] ?? '__rss2json_anonymous__';

    if (isCoolingDown(cooldownKey) && !isLastKey) {
      console.warn(`[rss2json] key #${i + 1} is cooling down — skipping`);
      continue;
    }

    let cleanUrl = decodeURIComponent(rssUrl);
    // Google News RSS expects '+' for spaces in the query.
    // If we leave them as spaces, URLSearchParams encodes them to literal '+', which rss2json rejects.
    // If we replace them with '+', URLSearchParams encodes them to '%2B', which rss2json accepts perfectly.
    cleanUrl = cleanUrl.replace(/ /g, '+');
    
    const params = new URLSearchParams({ rss_url: cleanUrl });
    if (keys[i]) params.set('api_key', keys[i]!);

    try {
      const upstream = await fetch(`https://api.rss2json.com/v1/api.json?${params.toString()}`);
      if (upstream.status === 429 || upstream.status === 401 || upstream.status === 403 || upstream.status === 422 || upstream.status === 500) {
        // Also fall back on 422 and 500 because some keys are out of feed quota (429) and others might be hitting weird feed limits
        recordKeyFailure(cooldownKey);
        if (!isLastKey) {
          console.warn(`[rss2json] key #${i + 1} failed with ${upstream.status} — falling back to next key`);
          continue;
        }
      } else {
        recordKeySuccess(cooldownKey);
      }
      return upstream;
    } catch (err) {
      lastError = err;
      if (isLastKey) throw err;
      console.warn(`[rss2json] key #${i + 1} request failed — falling back to next key`, err);
    }
  }

  throw lastError;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Higher than the other proxies' 30/min: unlike them, one logical
  // "fetch news" action here fans out into several parallel topic-feed
  // requests from the same client (5 on initial load, 4 per cron cycle, plus
  // one per state clicked in the taxonomy explorer), so the same per-minute
  // ceiling trips far more easily on ordinary usage.
  if (!isLoopback(req) && isRateLimited(`rss2json:${clientKey(req)}`, 60)) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  let rssUrl = req.query.rss_url;
  if (typeof rssUrl === 'string') {
    try { rssUrl = decodeURIComponent(rssUrl); } catch { /* ignore */ }
  }
  if (typeof rssUrl !== 'string' || !rssUrl.startsWith(ALLOWED_RSS_URL_PREFIX)) {
    res.status(400).json({ error: 'rss_url must be a Google News India RSS search URL' });
    return;
  }

  try {
    const upstream = await fetchWithKeyFallback(rssUrl);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Upstream rss2json request failed', detail: String(err) });
  }
}
