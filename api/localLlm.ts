import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited, clientKey } from './_rateLimit.ts';

// Local-only enrichment tier — powers non-essential, on-demand features (tag
// explainers, cross-outlet coverage comparison) via a locally-running Ollama
// instance instead of Groq. Keeps these optional features at zero cost and
// off the same Groq free-tier quota the always-on wire pipeline depends on.
//
// In dev this points straight at localhost:11434 (Ollama's default port). In
// production, LOCAL_LLM_URL would need to point at something that actually
// reaches your machine (e.g. a Cloudflare Tunnel hostname) — until that's
// set up, this tier is simply unreachable for deployed visitors, which is
// intentional: by design (see conversation), this tier fails fast and silent
// rather than falling back to Groq, so it can never quietly eat into the
// essential pipeline's quota.
const LOCAL_LLM_URL   = process.env.LOCAL_LLM_URL || 'http://localhost:11434';
const LOCAL_LLM_MODEL = 'qwen2.5:7b-instruct';

// CPU-only local inference is genuinely slow compared to Groq's cloud GPUs —
// measured ~7 tokens/sec for qwen2.5:7b-instruct on this hardware (no usable
// GPU acceleration for Ollama on an AMD iGPU on Windows). A 900-max-tokens
// request can legitimately take over two minutes; this is a backstop against
// a truly hung/unreachable Ollama process, not a "should be fast" bound —
// individual callers set their own (shorter) timeouts for lighter requests.
const UPSTREAM_TIMEOUT_MS = 150_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (isRateLimited(`localllm:${clientKey(req)}`, 60)) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  const { messages, temperature, max_tokens, response_format } = req.body || {};
  if (!Array.isArray(messages)) {
    res.status(400).json({ error: 'messages is required' });
    return;
  }

  try {
    const upstream = await fetch(`${LOCAL_LLM_URL}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LOCAL_LLM_MODEL,
        messages,
        temperature,
        max_tokens,
        response_format,
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    // Ollama not running, laptop off, tunnel down, etc. — this tier is
    // designed to fail exactly this way rather than fall back to Groq.
    res.status(503).json({ error: 'Local model unavailable', detail: String(err) });
  }
}
