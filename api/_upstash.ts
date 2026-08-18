// @ts-nocheck
// RAWINDIA — Upstash Redis REST helper
//
// Plain fetch against Upstash's REST API — no SDK dependency needed for two
// commands (GET/SET on a couple of JSON blobs), consistent with this
// project's existing minimal-dependency style. This is the one shared store
// the L/W Ledger and Vaada Clock read/write, replacing per-browser IndexedDB
// as the source of truth for those two stores specifically (articles, the
// spin ledger, and embeddings stay IndexedDB-only — unaffected).

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/** True once real credentials are configured — callers use this to degrade gracefully. */
export function isUpstashConfigured(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

async function command(parts: string[]): Promise<unknown> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) throw new Error('Upstash not configured');
  const url = `${UPSTASH_URL}/${parts.map(p => encodeURIComponent(p)).join('/')}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } });
  if (!res.ok) throw new Error(`Upstash command failed: ${res.status}`);
  const data = await res.json() as { result: unknown };
  return data.result;
}

/** Reads a JSON value stored at `key`, or `fallback` if unset/unreadable. */
export async function upstashGetJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await command(['get', key]);
    if (typeof raw !== 'string') return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Writes a JSON value to `key`. Throws on failure — callers decide how to handle it. */
export async function upstashSetJSON(key: string, value: unknown): Promise<void> {
  await command(['set', key, JSON.stringify(value)]);
}
