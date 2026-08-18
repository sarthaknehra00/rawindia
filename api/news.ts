// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited, clientKey, isLoopback } from './_rateLimit.js';
import { isCoolingDown, recordKeyFailure, recordKeySuccess } from './_keyCooldown.js';

type Source = 'newsapi-top' | 'newsapi-everything' | 'currents';

// Primary key first, then backups in order — only used as fallbacks when the
// primary is rate-limited or rejected, same failover pattern as api/groq.ts.
const NEWSAPI_KEYS = [
  process.env.NEWSAPI_KEY,
  process.env.NEWSAPI_KEY_BACKUP_1,
  process.env.NEWSAPI_KEY_BACKUP_2,
].filter((k): k is string => Boolean(k));

const CURRENTS_KEYS = [
  process.env.CURRENTS_KEY,
  process.env.CURRENTS_KEY_BACKUP_1,
  process.env.CURRENTS_KEY_BACKUP_2,
].filter((k): k is string => Boolean(k));

// Allowlists mirror exactly what src/services/newsApiService.ts actually
// sends per source — anything else is rejected outright rather than
// silently forwarded, so this endpoint can't be used as an open, arbitrary
// query relay against our API keys/quota.
const ALLOWED_PARAMS: Record<Source, Set<string>> = {
  'newsapi-top':        new Set(['country', 'pageSize']),
  'newsapi-everything':  new Set(['q', 'language', 'sortBy', 'pageSize', 'from', 'to']),
  'currents':            new Set(['keywords', 'language', 'country']),
};

const MAX_PAGE_SIZE = 40;   // matches the only value the app ever requests
const MAX_TEXT_LEN  = 200;  // q / keywords
const COUNTRY_RE    = /^[A-Za-z]{2}$/;
const LANGUAGE_RE   = /^[A-Za-z]{2}$/;
const DATE_RE       = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/;
const SORTBY_ALLOWED = new Set(['publishedAt', 'relevancy', 'popularity']); // NewsAPI's own enum

function validateParam(key: string, value: string): boolean {
  switch (key) {
    case 'pageSize':  { const n = Number(value); return Number.isInteger(n) && n > 0 && n <= MAX_PAGE_SIZE; }
    case 'q':
    case 'keywords':  return value.length > 0 && value.length <= MAX_TEXT_LEN;
    case 'country':   return COUNTRY_RE.test(value);
    case 'language':  return LANGUAGE_RE.test(value);
    case 'from':
    case 'to':        return DATE_RE.test(value);
    case 'sortBy':    return SORTBY_ALLOWED.has(value);
    default:          return false; // unknown key — caught by the allowlist check below anyway
  }
}

/**
 * Tries each configured NewsAPI key in order, attaching it to the same params
 * each time. Only a 429 (this key's rate limit) or 401 (invalid/revoked key)
 * is worth retrying with a different key — any other status is a final
 * answer a different key wouldn't change.
 */
async function fetchWithKeyFallback(baseUrl: string, params: URLSearchParams, keys: string[]): Promise<Response> {
  let lastError: unknown = null;
  for (let i = 0; i < keys.length; i++) {
    const isLastKey = i === keys.length - 1;
    const key = keys[i];

    if (isCoolingDown(key) && !isLastKey) {
      console.warn(`[NewsAPI] key #${i + 1} is cooling down — skipping`);
      continue;
    }

    const attemptParams = new URLSearchParams(params);
    attemptParams.set('apiKey', key);

    try {
      const upstream = await fetch(`${baseUrl}?${attemptParams.toString()}`);
      if (upstream.status === 429 || upstream.status === 401) {
        recordKeyFailure(key);
        if (!isLastKey) {
          console.warn(`[NewsAPI] key #${i + 1} failed with ${upstream.status} — falling back to next key`);
          continue;
        }
      } else {
        recordKeySuccess(key);
      }
      return upstream;
    } catch (err) {
      lastError = err;
      if (isLastKey) throw err;
      console.warn(`[NewsAPI] key #${i + 1} request failed — falling back to next key`, err);
    }
  }

  throw lastError;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isLoopback(req) && isRateLimited(`news:${clientKey(req)}`, 60)) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  const source = req.query.source as Source | undefined;
  if (!source || !['newsapi-top', 'newsapi-everything', 'currents'].includes(source)) {
    res.status(400).json({ error: 'Invalid or missing source' });
    return;
  }

  // Forward only allowlisted, validated params for this source — reject
  // (loudly, not silently) anything unexpected or out of bounds, so a
  // legitimate new param the app starts sending fails fast in dev rather
  // than mysteriously vanishing.
  const allowed = ALLOWED_PARAMS[source];
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'source') continue;
    if (typeof value !== 'string') {
      res.status(400).json({ error: `Invalid value for param "${key}"` });
      return;
    }
    if (!allowed.has(key)) {
      res.status(400).json({ error: `Unexpected param "${key}" for source "${source}"` });
      return;
    }
    if (!validateParam(key, value)) {
      res.status(400).json({ error: `Invalid value for param "${key}"` });
      return;
    }
    params.set(key, value);
  }

  try {
    let upstream: Response;

    if (source === 'newsapi-top') {
      upstream = await fetchWithKeyFallback('https://newsapi.org/v2/top-headlines', params, NEWSAPI_KEYS);
    } else if (source === 'newsapi-everything') {
      upstream = await fetchWithKeyFallback('https://newsapi.org/v2/everything', params, NEWSAPI_KEYS);
    } else {
      upstream = await fetchWithKeyFallback('https://api.currentsapi.services/v1/search', params, CURRENTS_KEYS);
    }

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Upstream news request failed', detail: String(err) });
  }
}
