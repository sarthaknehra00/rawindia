/**
 * RAWINDIA — Verdict Card Engine: quote-picking
 *
 * The 'quote' card type's only AI-dependent step: picks the single sharpest
 * line from an article to feature on the card (the other card types —
 * lw-verdict, promise-status — already have their text as structured data,
 * no picking needed). Rendering itself is plain HTML canvas, no AI involved —
 * see VerdictCardModal.tsx.
 *
 * Runs on the local Ollama tier (api/localLlm.ts) to choose+trim the line,
 * but always resolves to something usable: if the local model is
 * unreachable, this falls back to the article's own quote/standfirst/title
 * directly rather than failing — a card feature that sometimes can't
 * generate an image at all would be a worse experience than one that's
 * occasionally just a bit less "smart" about which line it picked.
 */

import type { Article } from '../types';

const LOCAL_LLM_URL = '/api/local-llm';

const SYSTEM_PROMPT = `You pick the single sharpest, most shareable line from a news dispatch to feature on a social-media card. Rules:
- The line must be an exact or lightly-trimmed excerpt of text that is already in the material given to you — never write a new sentence, never combine two different sentences into one, never add a number or claim not present in the text.
- Prefer a line with a concrete number, a named institution, or a striking fact over a vague one.
- Maximum 140 characters. Trim trailing/leading words if needed, but never alter the meaning.
- Return ONLY the line itself — no quotation marks, no explanation, no "Here's the line:" preamble.`;

function localFallback(article: Article): string {
  return (
    article.quoteHighlight?.quote ||
    article.subtitle ||
    article.factBlock?.bullets?.[0] ||
    article.title
  ).slice(0, 200);
}

/** Always resolves to a usable line — falls back to article data if the local model is unreachable. */
export async function pickCardLine(article: Article): Promise<string> {
  const material = [
    `HEADLINE: ${article.title}`,
    article.subtitle ? `STANDFIRST: ${article.subtitle}` : '',
    article.quoteHighlight?.quote ? `QUOTE: "${article.quoteHighlight.quote}"` : '',
    article.factBlock?.bullets?.length ? `FACTS:\n${article.factBlock.bullets.join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    const res = await fetch(LOCAL_LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: material },
        ],
        temperature: 0.3,
        max_tokens:  80,
      }),
      // Local CPU inference (~7 tok/s on unaccelerated hardware) is much
      // slower than Groq's cloud GPUs.
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return localFallback(article);

    const data = await res.json();
    const text: string | undefined = data.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, '');
    if (!text) return localFallback(article);

    return text.slice(0, 200);
  } catch {
    return localFallback(article);
  }
}
