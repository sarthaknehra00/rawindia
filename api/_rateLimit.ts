// Shared in-memory fixed-window rate limiter for the serverless proxies.
// Resets on cold start (no cross-instance shared state) — an accepted gap at
// demo scale; move to Upstash/Vercel KV if abuse ever becomes a real problem.

interface Window { count: number; windowStart: number; }

const buckets = new Map<string, Window>();

export function isRateLimited(key: string, limitPerMinute: number): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }

  existing.count++;
  return existing.count > limitPerMinute;
}

export function clientKey(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const fwd = req.headers['x-forwarded-for'];
  const ip = Array.isArray(fwd) ? fwd[0] : fwd;
  return (ip || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

// Loopback/local-dev traffic is never rate-limited. This limiter exists to
// stop abuse from real external users hitting a *deployed* site — throttling
// your own single local machine's dev testing serves no purpose and was
// causing self-inflicted 429 storms during normal development (many rapid
// page reloads share this same in-memory bucket). Safe in production too:
// a real external caller always arrives with a genuine forwarded IP, never
// a loopback address, so this can't be used to bypass the limit remotely.
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function isLoopback(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): boolean {
  return LOOPBACK_IPS.has(clientKey(req));
}
