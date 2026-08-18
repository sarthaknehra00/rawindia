import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited, clientKey, isLoopback } from './_rateLimit.ts';

// Embeddings tier for "Chat With The Archive" — a separate endpoint from
// api/localLlm.ts because Ollama's embeddings API has a different
// request/response shape than chat completions, not because it targets a
// different model host. Same local-only, non-essential, zero-cost tier as
// the rest of the local Ollama features — see api/localLlm.ts's header for
// the full reasoning.
const LOCAL_LLM_URL     = process.env.LOCAL_LLM_URL || 'http://localhost:11434';
const EMBEDDING_MODEL   = 'nomic-embed-text';
const UPSTREAM_TIMEOUT_MS = 60_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isLoopback(req) && isRateLimited(`localembed:${clientKey(req)}`, 60)) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  const { prompt } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }
  // Embedding models have their own (much smaller) context window than chat
  // models — cap input length rather than let a huge article silently get
  // truncated by Ollama itself with no way for us to know it happened.
  if (prompt.length > 8000) {
    res.status(400).json({ error: 'prompt exceeds 8000 characters' });
    return;
  }

  try {
    const upstream = await fetch(`${LOCAL_LLM_URL}/api/embeddings`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, prompt }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(503).json({ error: 'Local embedding model unavailable', detail: String(err) });
  }
}
