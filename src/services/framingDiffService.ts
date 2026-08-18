/**
 * RAWINDIA — Framing Diff (on-demand, per-story)
 *
 * Given a story cluster (the same event as reported by multiple outlets —
 * see storyClusterService.ts), asks the model for a side-by-side of how each
 * outlet's HEADLINE framed the story: a divergence score, the headline grid
 * itself, notable word-choice contrasts, and facts one outlet's headline
 * carries that another's omits — plus a Semafor "Semaform"-style substance
 * split (consensusFacts = "The News", disputedClaims = "Room for
 * Disagreement"), which is about what outlets actually agree or conflict on,
 * not how they worded it.
 *
 * Deliberately on-demand only (never called automatically) — a per-story
 * analysis feature that only fires when a reader explicitly asks for it.
 *
 * Grounded by construction: the headline grid shown to the reader is always
 * built directly from the real cluster members, never from the model's
 * response — the model only ever supplies the commentary (divergence score,
 * word-choice contrasts, omitted facts), never the headlines themselves, so
 * it can't fabricate an outlet or a headline that doesn't exist.
 *
 * Runs on the local Ollama tier (api/localLlm.ts), not Groq — this is a
 * non-essential enrichment feature (the site works fine without it), so it's
 * kept off the Groq free-tier quota the always-on wire pipeline depends on.
 * If the local model is unreachable, this fails silently — by design, no
 * fallback to Groq.
 */

import { dedupeByOutlet, type StoryCluster } from './storyClusterService';

const LOCAL_LLM_URL = '/api/local-llm';

export interface WordChoiceContrast {
  term: string;
  outlets: string[];
}

export interface OmittedFact {
  fact: string;
  mentionedBy: string[];
}

export interface FramingDiffResult {
  divergenceScore: number; // 0-100, illustrative not measured
  headlineGrid: { source: string; headline: string }[];
  wordChoiceContrasts: WordChoiceContrast[];
  omittedFacts: OmittedFact[];
  // Semafor "Semaform"-inspired split: what's consistent across outlets
  // ("The News") vs. where their headlines actually conflict ("Room for
  // Disagreement") — a different axis than word-choice/omission above,
  // about substance rather than wording. Folded into this same call rather
  // than a second Groq request and a second button, since it's the same
  // headline set doing double duty.
  consensusFacts: string[];
  disputedClaims: string[];
}

const cache = new Map<string, FramingDiffResult>();

const SYSTEM_PROMPT = `You compare how different news outlets HEADLINED the same real event. You will be given a list of (source, headline) pairs, all covering one story.

Rules (non-negotiable):
- Base every observation ONLY on the exact headlines given. Never invent a fact, number, or detail not literally present in one of the headlines.
- Every "outlets"/"mentionedBy" entry must be one of the exact source names given to you — never invent or abbreviate a source name.
- If the headlines are essentially identical in substance, say so with a low divergence score rather than manufacturing differences.
- "omittedFacts" means: something one headline explicitly states that another headline does NOT mention — not something you infer might be true.
- "consensusFacts" means: a specific fact ALL or nearly all of the headlines agree on — the undisputed core of the story.
- "disputedClaims" means: a point where the headlines actually CONFLICT (different numbers, different causes, different outcomes claimed) — not just different wording of the same fact.

Return ONLY this JSON:
{
  "divergenceScore": 0-100 (how differently the outlets chose to frame this — 0 = identical framing, 100 = starkly different angles),
  "wordChoiceContrasts": [{"term": "the exact word/phrase one outlet used", "outlets": ["which of the given sources used this term"]}, "..."],
  "omittedFacts": [{"fact": "a specific fact present in one headline but absent from another", "mentionedBy": ["which of the given sources' headlines state this fact"]}, "..."],
  "consensusFacts": ["a fact essentially every headline agrees on", "..."],
  "disputedClaims": ["a specific point where headlines actually conflict with each other, not just word differently", "..."]
}
Return 2-5 items per array (0-2 for consensusFacts/disputedClaims — most stories won't have real disputes). If there's nothing meaningful to say for an array, return an empty array rather than padding it.`;

/** Null if the cluster doesn't have enough distinct outlets to compare. */
export async function getFramingDiff(cluster: StoryCluster): Promise<FramingDiffResult | null> {
  const distinctMembers = dedupeByOutlet(cluster.members);
  if (distinctMembers.length < 2) return null;

  const cached = cache.get(cluster.primaryId);
  if (cached) return cached;

  const headlineGrid = distinctMembers.map(m => ({ source: m.source, headline: m.title }));
  const knownOutlets = new Set(headlineGrid.map(h => h.source.toLowerCase()));
  // Ground-truth text to verify any numeric claim against — a number the
  // model cites that doesn't appear in ANY real headline is unverifiable
  // from what the reader can actually see, so that specific item gets
  // dropped rather than shown as if it were backed by the headlines below it.
  const headlineText = headlineGrid.map(h => h.headline.toLowerCase()).join(' | ');

  const userMsg = `Headlines covering the same story:\n` +
    headlineGrid.map((h, i) => `${i + 1}. [${h.source}] ${h.headline}`).join('\n');

  try {
    const res = await fetch(LOCAL_LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages:        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
        temperature:     0.3,
        max_tokens:      750,
        response_format: { type: 'json_object' },
      }),
      // Local CPU inference (~7 tok/s on unaccelerated hardware) is much
      // slower than Groq's cloud GPUs — 750 max_tokens can take ~110s+.
      signal: AbortSignal.timeout(130_000),
    });

    if (!res.ok) { console.warn(`[FramingDiff] ${res.status}`); return null; }

    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const isNumberGrounded = (text: string): boolean => {
      const numbers = text.match(/\b\d{2,}\b/g) ?? [];
      return numbers.every(n => headlineText.includes(n));
    };

    const wordChoiceContrasts: WordChoiceContrast[] = (Array.isArray(parsed.wordChoiceContrasts) ? parsed.wordChoiceContrasts : [])
      .filter((w: unknown): w is { term: unknown; outlets: unknown } => typeof w === 'object' && w !== null)
      .map((w: { term: unknown; outlets: unknown }) => ({
        term: typeof w.term === 'string' ? w.term : '',
        outlets: Array.isArray(w.outlets)
          ? w.outlets.filter((o: unknown): o is string => typeof o === 'string' && knownOutlets.has(o.toLowerCase()))
          : [],
      }))
      // Drop anything with no real term, no verified outlets, or a term that
      // appears in EVERY headline (shared vocabulary isn't a divergence).
      .filter((w: WordChoiceContrast) => {
        if (!w.term || w.outlets.length === 0) return false;
        const inAll = headlineGrid.every(h => h.headline.toLowerCase().includes(w.term.toLowerCase()));
        return !inAll;
      })
      .slice(0, 5);

    const omittedFacts: OmittedFact[] = (Array.isArray(parsed.omittedFacts) ? parsed.omittedFacts : [])
      .filter((f: unknown): f is { fact: unknown; mentionedBy: unknown } => typeof f === 'object' && f !== null)
      .map((f: { fact: unknown; mentionedBy: unknown }) => ({
        fact: typeof f.fact === 'string' ? f.fact : '',
        mentionedBy: Array.isArray(f.mentionedBy)
          ? f.mentionedBy.filter((o: unknown): o is string => typeof o === 'string' && knownOutlets.has(o.toLowerCase()))
          : [],
      }))
      .filter((f: OmittedFact) => f.fact && f.mentionedBy.length > 0 && isNumberGrounded(f.fact))
      .slice(0, 5);

    const asGroundedStringList = (v: unknown): string[] =>
      (Array.isArray(v) ? v : [])
        .filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
        .filter(isNumberGrounded)
        .slice(0, 2);

    const result: FramingDiffResult = {
      divergenceScore: Math.max(0, Math.min(100, Number(parsed.divergenceScore) || 0)),
      headlineGrid,
      wordChoiceContrasts,
      omittedFacts,
      consensusFacts: asGroundedStringList(parsed.consensusFacts),
      disputedClaims: asGroundedStringList(parsed.disputedClaims),
    };

    cache.set(cluster.primaryId, result);
    return result;

  } catch (err) {
    console.warn('[FramingDiff] failed:', err);
    return null;
  }
}
