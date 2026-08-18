/**
 * RAWINDIA — Archive Embeddings
 *
 * Computes and stores a semantic embedding vector per article, on the local
 * Ollama tier (api/localEmbeddings.ts), so "Chat With The Archive" can find
 * the right articles for a question without re-reading the whole archive on
 * every query.
 *
 * Runs incrementally in the background as articles get synthesized (see the
 * hook in cronSchedulerService.ts / groqQueueService.ts) — never a bulk
 * backfill of the whole archive at once. That's a deliberate choice: this
 * session already worked out that CPU-only local inference makes a fast
 * one-time sweep of a large archive impractical (see the Institutional
 * Report Card's own scope notes) — the same reasoning applies here.
 */

import type { Article } from '../types';
import { saveEmbedding, hasEmbedding, getAllEmbeddings, getLatestArticles, type ArticleEmbedding } from './persistenceService';
import { articleToSlugId } from '../utils/routing';

const LOCAL_EMBED_URL = '/api/local-embeddings';
const MAX_CHARS = 2000; // keeps well under the proxy's 8000-char cap with room for future field additions

async function embed(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(LOCAL_EMBED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text.slice(0, MAX_CHARS) }),
      // Local CPU inference is much slower than Groq's cloud GPUs, but
      // embeddings are cheap relative to generation — still generous
      // headroom since this always runs in the background, never blocking
      // a reader-facing action.
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.embedding) ? data.embedding : null;
  } catch {
    return null;
  }
}

function articleText(article: Article): string {
  return [article.title, article.subtitle, ...article.bodyParagraphs].filter(Boolean).join(' ');
}

/** Fire-and-forget safe — never throws, silently no-ops if the local model is unreachable. */
export async function ensureArticleEmbedded(article: Article): Promise<void> {
  if (await hasEmbedding(article.id)) return;

  const text = articleText(article);
  if (text.trim().length < 40) return; // too little real content to embed usefully

  const vector = await embed(text);
  if (!vector) return;

  const entry: ArticleEmbedding = {
    articleId: article.id,
    vector,
    excerpt: text.slice(0, 500),
    title: article.title,
    slugId: articleToSlugId(article),
  };
  await saveEmbedding(entry);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Null if the local embedding model is unreachable for the question itself. */
export async function embedQuestion(question: string): Promise<number[] | null> {
  return embed(question);
}

// One call site currently uses this — a shared in-flight guard so opening
// the chat modal twice in quick succession doesn't kick off two overlapping
// backfill passes.
let backfillInFlight = false;

/**
 * Embeds up to `limit` already-synthesized archive articles that predate
 * this feature (and so were never picked up by the incremental hooks in
 * cronSchedulerService.ts / groqQueueService.ts / ArticleView.tsx).
 *
 * Deliberately bounded and sequential, not a bulk sweep — this session
 * already established that CPU-only local inference makes a fast one-time
 * pass over a large archive impractical. Each call to this (e.g. once per
 * chat-modal open) makes a little more of the archive searchable rather
 * than trying to do it all at once. Returns how many it actually embedded.
 */
export async function embedBacklogBatch(limit = 15): Promise<number> {
  if (backfillInFlight) return 0;
  backfillInFlight = true;
  try {
    const [recent, existing] = await Promise.all([
      getLatestArticles(500),
      getAllEmbeddings(),
    ]);
    const alreadyEmbedded = new Set(existing.map(e => e.articleId));
    const candidates = recent
      .filter(a => a.isGroqSynthesized && !alreadyEmbedded.has(a.id))
      .slice(0, limit);

    let count = 0;
    for (const article of candidates) {
      await ensureArticleEmbedded(article);
      count++;
    }
    return count;
  } finally {
    backfillInFlight = false;
  }
}
