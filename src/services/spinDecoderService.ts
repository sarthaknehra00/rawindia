/**
 * RAWINDIA — Spin Decoder
 *
 * Officials love burying bad news in vague, PR-softened phrasing —
 * "fiscal consolidation" instead of "spending cuts," "personnel
 * rationalization" instead of "layoffs." This scans a quoted statement for
 * exactly that kind of euphemism and offers the plain-English translation
 * inline, right where the quote already appears.
 *
 * Runs on the local Ollama tier (api/localLlm.ts) — on-demand, per quote,
 * never automatic. If the local model is unreachable, this fails silently,
 * same as the other local-tier features.
 *
 * Grounded by construction: a returned phrase is only ever highlighted if it
 * appears verbatim (case-insensitive) in the actual quote text — a phrase
 * the model invents that isn't literally there is dropped rather than shown,
 * so this can never highlight something the speaker didn't actually say.
 *
 * Every phrase found (whether from a reader's manual click or the
 * background auto-scan in cronSchedulerService.ts) is logged to the spin
 * ledger — this is the data "Roast the Spin" and the Institutional Report
 * Card are built on. Logging happens once per unique (articleId, term) per
 * browser session (a lightweight in-memory guard, not a DB query) — cheap
 * insurance against double-counting the same quote decoded twice in one
 * session, not a guarantee across separate sessions.
 */

import { logSpinEvent } from './persistenceService';

const LOCAL_LLM_URL = '/api/local-llm';

export interface SpinPhrase {
  term: string;        // exact substring as it appears in the quote
  translation: string; // plain-English meaning
}

export interface SpinContext {
  speaker: string;
  articleId: string;
  articleTitle: string;
}

const loggedThisSession = new Set<string>();

const SYSTEM_PROMPT = `You spot vague, bureaucratic, or PR-softened phrases inside a quoted statement from an official, company, or institution — the kind of language used to make bad news sound neutral or good (e.g. "fiscal consolidation" for spending cuts, "personnel rationalization" for layoffs, "under review" for stalled/abandoned).

Rules (non-negotiable):
- Only flag a phrase if it is an EXACT, VERBATIM substring of the quote given to you — copy it character-for-character. Never paraphrase, shorten, or reconstruct it.
- If the quote is already plain, direct language with no real spin, return an empty array. Do not manufacture a euphemism that isn't genuinely there.
- The translation must be a short, plain-English statement of what the phrase most likely actually means in context — factual, not sarcastic or exaggerated.
- Flag at most 3 phrases — the clearest ones, not every borderline word choice.

Return ONLY this JSON: {"phrases": [{"term": "exact phrase from the quote", "translation": "plain-English meaning"}]}`;

// Cached per exact quote text — the same quote reused across pages (e.g. a
// wire-service statement) only ever costs one call.
const cache = new Map<string, SpinPhrase[]>();
const inflight = new Map<string, Promise<SpinPhrase[]>>();

/** Empty array if no spin detected, or the local model was unreachable. */
export async function getSpinPhrases(quote: string, context?: SpinContext): Promise<SpinPhrase[]> {
  const key = quote.trim();
  if (!key) return [];
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const promise = (async (): Promise<SpinPhrase[]> => {
    try {
      const res = await fetch(LOCAL_LLM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Quote: "${quote}"` },
          ],
          temperature:     0.2,
          max_tokens:       300,
          response_format: { type: 'json_object' },
        }),
        // Local CPU inference (~7 tok/s on unaccelerated hardware) is much
        // slower than Groq's cloud GPUs.
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) return [];

      const data = await res.json();
      const raw  = data.choices?.[0]?.message?.content;
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      const lowerQuote = quote.toLowerCase();

      const phrases: SpinPhrase[] = (Array.isArray(parsed.phrases) ? parsed.phrases : [])
        .filter((p: unknown): p is { term: unknown; translation: unknown } => typeof p === 'object' && p !== null)
        .map((p: { term: unknown; translation: unknown }) => ({
          term:        typeof p.term === 'string' ? p.term.trim() : '',
          translation: typeof p.translation === 'string' ? p.translation.trim() : '',
        }))
        // Grounding check: the exact phrase must actually appear in the quote.
        .filter((p: SpinPhrase) => p.term && p.translation && lowerQuote.includes(p.term.toLowerCase()))
        .slice(0, 3);

      cache.set(key, phrases);

      if (context) {
        for (const p of phrases) {
          const dedupeKey = `${context.articleId}::${p.term.toLowerCase()}`;
          if (loggedThisSession.has(dedupeKey)) continue;
          loggedThisSession.add(dedupeKey);
          logSpinEvent({
            speaker:      context.speaker,
            term:         p.term,
            translation:  p.translation,
            articleId:    context.articleId,
            articleTitle: context.articleTitle,
            timestamp:    new Date().toISOString(),
          });
        }
      }

      return phrases;
    } catch {
      return [];
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
