// @ts-nocheck
// Shared in-memory per-key cooldown tracker for the serverless proxies' key
// failover logic. Without this, once every configured key for a service is
// rate-limited, every single incoming request still tries all of them again
// in sequence and gets an instant 429 from each — wasted latency on requests
// that were never going to succeed, and it keeps hitting an already-limited
// upstream key right as it might otherwise be recovering.
//
// Instead: a key that fails with 429 a couple of times in a row gets skipped
// entirely for a cooldown window — fallback moves straight to the next key
// (or, if it's the only key left, tries it anyway, since something beats an
// instant failure). A success clears its failure count immediately.
//
// Resets on cold start (no cross-instance shared state) — same accepted gap
// as api/_rateLimit.ts at this scale.

interface KeyState { failures: number; cooldownUntil: number; }

const FAILURE_THRESHOLD = 2;   // consecutive 429s before a key is put on cooldown
const COOLDOWN_MS       = 60_000; // 60s — long enough to matter, short enough to recover fast

const state = new Map<string, KeyState>();

export function isCoolingDown(key: string): boolean {
  const s = state.get(key);
  return !!s && Date.now() < s.cooldownUntil;
}

export function recordKeyFailure(key: string): void {
  const s = state.get(key) ?? { failures: 0, cooldownUntil: 0 };
  s.failures += 1;
  if (s.failures >= FAILURE_THRESHOLD) {
    s.cooldownUntil = Date.now() + COOLDOWN_MS;
    s.failures = 0; // cooldown itself is the signal now; don't keep piling up
  }
  state.set(key, s);
}

export function recordKeySuccess(key: string): void {
  state.delete(key);
}
