// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited, clientKey, isLoopback } from './_rateLimit.js';
import { isCoolingDown, recordKeyFailure, recordKeySuccess } from './_keyCooldown.js';

// Allowlist mirrors exactly what src/services/guardianNewsService.ts actually
// sends — anything else is rejected outright rather than silently forwarded,
// same pattern as api/news.ts, so this endpoint can't be used as an open,
// arbitrary query relay against our Guardian key/quota.
const ALLOWED_PARAMS = new Set([
  'q', 'from-date', 'to-date', 'page-size', 'page', 'order-by', 'show-fields',
]);

// Primary key first, then backups in order — only used as fallbacks when the
// primary is rate-limited or rejected, same failover pattern as api/groq.ts
// and api/news.ts. Falls back to Guardian's public 'test' demo key if none
// of these are configured.
const GUARDIAN_KEYS = [
  process.env.GUARDIAN_KEY,
  process.env.GUARDIAN_KEY_BACKUP_1,
  process.env.GUARDIAN_KEY_BACKUP_2,
].filter((k): k is string => Boolean(k));
if (GUARDIAN_KEYS.length === 0) GUARDIAN_KEYS.push('test');

const MAX_PAGE_SIZE  = 50;   // matches PAGE_SIZE in guardianNewsService.ts
const MAX_PAGE       = 20;   // app only ever requests up to 3, generous headroom
const MAX_TEXT_LEN   = 200;
const DATE_RE        = /^\d{4}-\d{2}-\d{2}$/;
const ORDER_BY_ALLOWED = new Set(['newest', 'oldest', 'relevance']); // Guardian's own enum
// Exact set of fields the app ever requests — Guardian's `show-fields` takes
// a comma-separated list, so validate each requested field against this.
const SHOW_FIELDS_ALLOWED = new Set(['headline', 'standfirst', 'bodyText', 'thumbnail', 'byline', 'trailText']);

function validateParam(key: string, value: string): boolean {
  switch (key) {
    case 'q':          return value.length > 0 && value.length <= MAX_TEXT_LEN;
    case 'from-date':
    case 'to-date':    return DATE_RE.test(value);
    case 'page-size':  { const n = Number(value); return Number.isInteger(n) && n > 0 && n <= MAX_PAGE_SIZE; }
    case 'page':       { const n = Number(value); return Number.isInteger(n) && n > 0 && n <= MAX_PAGE; }
    case 'order-by':   return ORDER_BY_ALLOWED.has(value);
    case 'show-fields': return value.split(',').every(f => SHOW_FIELDS_ALLOWED.has(f));
    default:           return false;
  }
}

/**
 * Tries each configured Guardian key in order. Only a 429 (this key's rate
 * limit) or 401 (invalid/revoked key) is worth retrying with a different
 * key — any other status is a final answer a different key wouldn't change.
 */
async function fetchWithKeyFallback(params: URLSearchParams, keys: string[]): Promise<Response> {
  let lastError: unknown = null;
  for (let i = 0; i < keys.length; i++) {
    const isLastKey = i === keys.length - 1;
    const key = keys[i];

    if (isCoolingDown(key) && !isLastKey) {
      console.warn(`[Guardian] key #${i + 1} is cooling down — skipping`);
      continue;
    }

    const attemptParams = new URLSearchParams(params);
    attemptParams.set('api-key', key);

    try {
      const upstream = await fetch(`https://content.guardianapis.com/search?${attemptParams.toString()}`);
      if (upstream.status === 429 || upstream.status === 401) {
        recordKeyFailure(key);
        if (!isLastKey) {
          console.warn(`[Guardian] key #${i + 1} failed with ${upstream.status} — falling back to next key`);
          continue;
        }
      } else {
        recordKeySuccess(key);
      }
      return upstream;
    } catch (err) {
      lastError = err;
      if (isLastKey) throw err;
      console.warn(`[Guardian] key #${i + 1} request failed — falling back to next key`, err);
    }
  }

  throw lastError;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isLoopback(req) && isRateLimited(`guardian:${clientKey(req)}`, 30)) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value !== 'string') {
      res.status(400).json({ error: `Invalid value for param "${key}"` });
      return;
    }
    if (!ALLOWED_PARAMS.has(key)) {
      res.status(400).json({ error: `Unexpected param "${key}"` });
      return;
    }
    if (!validateParam(key, value)) {
      res.status(400).json({ error: `Invalid value for param "${key}"` });
      return;
    }
    params.set(key, value);
  }

  try {
    const upstream = await fetchWithKeyFallback(params, GUARDIAN_KEYS);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Upstream Guardian request failed', detail: String(err) });
  }
}
