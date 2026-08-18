/**
 * RAWINDIA — "The Basics" (Vox-inspired, cached, on-demand tag explainers)
 *
 * A reader unfamiliar with "UAPA" or "the repo rate" shouldn't have to leave
 * the article to find out what it means. Rather than auto-detecting which
 * terms need explaining (unreliable without real entity extraction), this
 * piggybacks on tags Groq already curated as significant to the article
 * during synthesis — a reader can ask "what is this?" for any of them.
 *
 * Cached globally by TERM, not per-article — the cost is paid once ever per
 * distinct tag across the whole site, not once per article that happens to
 * mention it. Fully on-demand: zero automatic calls.
 *
 * Runs on the local Ollama tier (api/localLlm.ts), not Groq — this is a
 * non-essential enrichment feature (the site works fine without it), so it's
 * kept off the Groq free-tier quota the always-on wire pipeline depends on.
 * If the local model is unreachable (laptop off, Ollama not running), this
 * fails silently, same as a low-confidence answer — by design, no fallback.
 */

const LOCAL_LLM_URL = '/api/local-llm';
const STORAGE_KEY = 'RAWINDIA_EXPLAINERS_V1';
const MAX_CACHED = 300;

let cache: Map<string, string> = new Map(); // lowercased term -> explainer text
let loaded = false;

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) cache = new Map(JSON.parse(raw));
  } catch { /* ignore — starts empty, same as every other persisted store here */ }
}

function persist(): void {
  try {
    if (cache.size > MAX_CACHED) {
      // Insertion order in a Map is preserved — slicing the tail keeps the
      // most-recently-added terms, a reasonable proxy for "still relevant."
      cache = new Map(Array.from(cache.entries()).slice(-MAX_CACHED));
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(cache.entries())));
  } catch { /* quota — same graceful no-op as the rest of the app's persistence */ }
}

// Deliberately NOT asked for a confident-sounding definition of everything —
// a common word or a bare first name has no useful factual "basics" to give,
// and guessing at one is exactly the kind of manufactured-authority behavior
// this app has spent this session removing. Failing closed (no explainer
// shown) is better than a plausible-sounding wrong one.
const SYSTEM_PROMPT = `You explain a single news topic/term/institution to an Indian reader who has never heard of it, in 1-2 short plain sentences. Purely factual background — no opinion, no analysis, no recent news about it. If you are not confident what this specifically refers to, or it's too generic/ambiguous to define usefully (e.g. a common word, a bare first name), respond with exactly: UNKNOWN`;

// Two tag pills for the same term clicked in quick succession — or the same
// term across two open articles — share one in-flight request instead of
// firing two identical calls.
const inflight = new Map<string, Promise<string | null>>();

/** Null if unavailable (request failed, or the model wasn't confident enough to answer). */
export async function getExplainer(term: string): Promise<string | null> {
  load();
  const key = term.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const promise = (async (): Promise<string | null> => {
    try {
      const res = await fetch(LOCAL_LLM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Term: "${term}"` },
          ],
          temperature: 0.2,
          max_tokens:  120,
        }),
        // Local CPU inference (~7 tok/s on unaccelerated hardware) is much
        // slower than Groq's cloud GPUs — 120 max_tokens can take ~20s+.
        signal: AbortSignal.timeout(35_000),
      });
      if (!res.ok) return null;

      const data = await res.json();
      const text: string | undefined = data.choices?.[0]?.message?.content?.trim();
      if (!text || text.toUpperCase().includes('UNKNOWN')) return null;

      cache.set(key, text);
      persist();
      return text;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
