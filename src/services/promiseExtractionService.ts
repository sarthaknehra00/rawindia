/**
 * RAWINDIA — Promise & Verdict Extraction (Operation Vaada)
 *
 * The CLIENT-side half of the engine behind the Vaada Clock and the L/W
 * Ledger — runs on the local Ollama tier, hooked into every article as it's
 * synthesized (same point as getSpinPhrases/ensureArticleEmbedded in
 * groqQueueService.ts), never the raw multi-source firehose. There's also a
 * SERVER-side twin (api/cron/ledger-extract.ts) that runs once a day via
 * Vercel Cron regardless of whether anyone's browser is open, using Groq
 * instead of Ollama (which only runs on a local machine, unreachable from
 * Vercel) over a small batch of that day's real headlines. Both write to the
 * same shared store (see sharedLedgerService.ts) with identical trust rules.
 *
 * Nothing either path produces is ever shown to a reader directly. A 7B (or
 * 20B) model making a structured factual claim about a real, named
 * politician — a date, a deadline, a status — is exactly the kind of output
 * that looks confident and is sometimes wrong, and there's no fact-checking
 * budget to catch that after the fact. So every candidate is written with
 * trustTier:'ai-flagged' and is invisible to every reader-facing view; only
 * a human clearing it through /ops/review (see ReviewQueueView.tsx) can flip
 * it to 'verified'. See PRD §9 for the full reasoning — automating discovery
 * doesn't change that bar.
 */

import type { Article } from '../types';
import { type TrackedPromise, type VerdictEvent } from './persistenceService';
import { submitCandidates, getLedgerBundle } from './sharedLedgerService';
import { embedQuestion, cosineSimilarity } from './archiveEmbeddingService';

const LOCAL_LLM_URL = '/api/local-llm';
const MAX_CHARS = 3000;

const SYSTEM_PROMPT = `You read one news dispatch and look for exactly two things — nothing else:

1. A PROMISE: a named politician, party, ministry, or government body committing to a future, dated action ("will complete X by [date]", "has promised Y before [date]"). Only flag this if a real, specific deadline (a date, month, or year) is actually stated.

2. A VERDICT: a clear, concrete outcome in this dispatch that plainly helped one named party/institution and hurt another (a policy taking effect, a ruling, a decision) — NOT a routine announcement with no real winner or loser.

Rules (non-negotiable):
- Every field must be grounded in this exact dispatch — never invent a name, date, or outcome not actually stated in the text.
- subjectName must be a real, specific named person, party, ministry, or institution — never a vague group ("officials", "the government" is only acceptable if no more specific name is given).
- If nothing in this dispatch is a genuine dated promise, "promise" must be null. If nothing is a clear win/loss outcome, "verdict" must be null. Most dispatches will have both null — that is the expected, common case, not a failure.
- deadline must be an ISO date (YYYY-MM-DD). If only a month/year is given, use the 1st of that month.

Return ONLY this JSON:
{"promise": null | {"subjectName": "...", "promiseText": "...", "category": "...", "deadline": "YYYY-MM-DD"},
 "verdict": null | {"subjectName": "...", "headline": "...", "verdict": "W" | "L"}}`;

function articleText(article: Article): string {
  return [article.title, article.subtitle, ...article.bodyParagraphs].filter(Boolean).join(' ').slice(0, MAX_CHARS);
}

function articleEvidence(article: Article): string[] {
  return article.externalUrl ? [article.externalUrl] : [];
}

interface ExtractionResult {
  promise?: { subjectName: string; promiseText: string; category: string; deadline: string } | null;
  verdict?: { subjectName: string; headline: string; verdict: 'W' | 'L' } | null;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());
}

/**
 * The single most similar existing tracked promise (any trust tier — the
 * review queue UI is the one place that needs to see across the ai-flagged/
 * verified boundary, so a reviewer can catch "this is actually an extension
 * of promise #X" rather than it silently becoming a duplicate). Null if
 * nothing clears a real similarity bar, or if embeddings are unavailable.
 */
export async function findSimilarPromise(vector: number[], excludeId?: string): Promise<{ promise: TrackedPromise; score: number } | null> {
  const { promises: all } = await getLedgerBundle();
  let best: { promise: TrackedPromise; score: number } | null = null;
  for (const p of all) {
    if (p.id === excludeId || !p.matchVector) continue;
    const score = cosineSimilarity(vector, p.matchVector);
    if (score > 0.86 && (!best || score > best.score)) best = { promise: p, score };
  }
  return best;
}

/** Fire-and-forget safe — never throws, silently no-ops if the local model is unreachable. */
export async function extractFromArticle(article: Article): Promise<void> {
  const text = articleText(article);
  if (text.trim().length < 80) return; // too little real content to extract anything grounded

  let parsed: ExtractionResult;
  try {
    const res = await fetch(LOCAL_LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        temperature:     0.1,
        max_tokens:       350,
        response_format: { type: 'json_object' },
      }),
      // Local CPU inference — this always runs in the background, never
      // blocking a reader-facing action, so generous headroom is fine.
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return;
    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content;
    if (!raw) return;
    parsed = JSON.parse(raw);
  } catch {
    return; // local model unreachable or returned unparseable output — silent no-op, same as every other local-tier feature
  }

  const now = new Date().toISOString();
  const evidence = articleEvidence(article);
  const excerpt = text.slice(0, 500);
  const newPromises: TrackedPromise[] = [];
  const newVerdicts: VerdictEvent[] = [];

  const p = parsed.promise;
  if (p && isNonEmptyString(p.subjectName) && isNonEmptyString(p.promiseText) && isIsoDate(p.deadline)) {
    const matchVector = await embedQuestion(`${p.subjectName}: ${p.promiseText}`);
    const entry: TrackedPromise = {
      id:               `promise-${article.id}-${Date.now().toString(36)}`,
      subjectName:      p.subjectName.trim(),
      promiseText:      p.promiseText.trim(),
      category:         isNonEmptyString(p.category) ? p.category.trim() : article.verticalName,
      originalDeadline: p.deadline,
      currentDeadline:  p.deadline,
      extensionHistory: [],
      status:           'in-progress',
      evidenceLinks:    evidence,
      sourceExcerpt:    excerpt,
      articleId:        article.id,
      trustTier:        'ai-flagged',
      createdAt:        now,
      ...(matchVector ? { matchVector } : {}),
    };
    newPromises.push(entry);
  }

  const v = parsed.verdict;
  if (v && isNonEmptyString(v.subjectName) && isNonEmptyString(v.headline) && (v.verdict === 'W' || v.verdict === 'L')) {
    const entry: VerdictEvent = {
      id:            `verdict-${article.id}-${Date.now().toString(36)}`,
      headline:      v.headline.trim(),
      verdict:       v.verdict,
      subjectName:   v.subjectName.trim(),
      sourceUrl:      evidence[0] || '',
      sourceExcerpt: excerpt,
      articleId:     article.id,
      trustTier:     'ai-flagged',
      createdAt:     now,
    };
    newVerdicts.push(entry);
  }

  if (newPromises.length || newVerdicts.length) {
    await submitCandidates(newVerdicts, newPromises);
  }
}
