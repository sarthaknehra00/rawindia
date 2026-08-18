import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited, clientKey, isLoopback } from './_rateLimit.ts';
import { isCoolingDown, recordKeyFailure, recordKeySuccess } from './_keyCooldown.ts';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Primary key first, then backups in order — only used as fallbacks when the
// primary is rate-limited or rejected, never round-robined or load-balanced.
const GROQ_KEYS = [
  process.env.GROQ_KEY,
  process.env.GROQ_KEY_BACKUP_1,
  process.env.GROQ_KEY_BACKUP_2,
  process.env.GROQ_KEY_BACKUP_3,
].filter((k): k is string => Boolean(k));

const MAX_TOKENS_CAP = 8000;
// The app's real usage tops out around 8 short articles batched into one
// call (~1200 chars input each per src/services/groqWriterService.ts) —
// this cap gives real headroom while still bounding input-token cost on an
// otherwise-open, unauthenticated endpoint.
const MAX_INPUT_CHARS = 30_000;
// Only the two models this app actually uses — prevents the open endpoint
// from being used to route to an arbitrary (possibly pricier) Groq model.
const ALLOWED_MODELS = new Set(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
const ALLOWED_REASONING_EFFORTS = new Set(['low', 'medium', 'high']);

/**
 * Tries each configured Groq key in order. A 429 (this key's rate limit hit),
 * 401 (invalid/revoked key), or 413 (request too large for this key's
 * account/tier — Groq enforces a per-request token cap that varies by tier,
 * so a batch that's too big for one key's limit may fit comfortably under a
 * different key's) is worth retrying with a different key — any other status
 * (success, 400 bad request, 5xx) is a final answer that a different key
 * wouldn't change, so it's returned immediately without burning through the
 * rest of the list.
 */
async function fetchGroqWithFallback(body: string): Promise<Response> {
  let lastError: unknown = null;
  for (let i = 0; i < GROQ_KEYS.length; i++) {
    const isLastKey = i === GROQ_KEYS.length - 1;
    const key = GROQ_KEYS[i];

    // A key that's failed with 429 a couple of times recently is on
    // cooldown — skip it without spending a request, unless it's the only
    // key left (something beats an instant failure).
    if (isCoolingDown(key) && !isLastKey) {
      console.warn(`[Groq] key #${i + 1} is cooling down — skipping`);
      continue;
    }

    try {
      const upstream = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body,
      });

      if (upstream.status === 429 || upstream.status === 401 || upstream.status === 413) {
        // Don't record 413 as a cooldown-worthy failure — it says nothing
        // about this key being rate-limited or bad, only that this
        // particular request was too big for it. Cooling the key down would
        // needlessly skip it for smaller, perfectly fine requests later.
        if (upstream.status !== 413) recordKeyFailure(key);
        if (!isLastKey) {
          console.warn(`[Groq] key #${i + 1} failed with ${upstream.status} — falling back to next key`);
          continue;
        }
      } else {
        recordKeySuccess(key);
      }
      return upstream;
    } catch (err) {
      lastError = err;
      if (isLastKey) throw err;
      console.warn(`[Groq] key #${i + 1} request failed — falling back to next key`, err);
    }
  }

  throw lastError;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isLoopback(req) && isRateLimited(`groq:${clientKey(req)}`, 30)) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  const { model, messages, temperature, max_tokens, response_format, reasoning_effort } = req.body || {};

  if (!model || !Array.isArray(messages)) {
    res.status(400).json({ error: 'model and messages are required' });
    return;
  }

  if (!ALLOWED_MODELS.has(model)) {
    res.status(400).json({ error: `Unsupported model "${model}"` });
    return;
  }

  if (reasoning_effort !== undefined && !ALLOWED_REASONING_EFFORTS.has(reasoning_effort)) {
    res.status(400).json({ error: `Unsupported reasoning_effort "${reasoning_effort}"` });
    return;
  }

  if (typeof max_tokens === 'number' && max_tokens > MAX_TOKENS_CAP) {
    res.status(400).json({ error: `max_tokens exceeds cap of ${MAX_TOKENS_CAP}` });
    return;
  }

  const totalInputChars = messages.reduce((sum: number, m: { content?: unknown }) =>
    sum + (typeof m?.content === 'string' ? m.content.length : 0), 0);
  if (totalInputChars > MAX_INPUT_CHARS) {
    res.status(400).json({ error: `Combined messages content exceeds ${MAX_INPUT_CHARS} characters` });
    return;
  }

  if (GROQ_KEYS.length === 0) {
    res.status(500).json({ error: 'No Groq API key configured' });
    return;
  }

  try {
    const upstream = await fetchGroqWithFallback(
      JSON.stringify({ model, messages, temperature, max_tokens, response_format, reasoning_effort })
    );
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Upstream Groq request failed', detail: String(err) });
  }
}
