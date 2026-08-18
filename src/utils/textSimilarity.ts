/**
 * RAWINDIA — Headline similarity primitives
 *
 * Shared by the cross-source dedup pass (newsApiService.ts) and the story
 * clustering service (storyClusterService.ts) — both need the same notion of
 * "these two headlines are almost certainly the same underlying story",
 * computed the same way so a pair that counts as a duplicate for feed
 * de-cluttering also counts as the same cluster for coverage comparison.
 */

// Generic words that carry no story-identifying signal — excluded so two
// unrelated articles that both happen to say "India" or "report" don't
// register as sharing a token.
const STOP_TITLE_TOKENS = new Set([
  'about', 'after', 'again', 'against', 'along', 'among', 'around', 'before', 'being',
  'between', 'below', 'could', 'during', 'first', 'found', 'from', 'have', 'their',
  'these', 'those', 'through', 'today', 'update', 'updates', 'video', 'while', 'which',
  'would', 'reported', 'reports', 'says', 'said', 'report', 'news', 'india', 'indian',
  'story', 'stories', 'watch', 'photos', 'more', 'over', 'this', 'that',
]);

export function significantTitleTokens(title: string): Set<string> {
  return new Set(
    title.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 5 && !STOP_TITLE_TOKENS.has(t))
  );
}

export function sharedTokenCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

/** Shared-token count as a fraction of the smaller title's token count — a
 * rough overlap ratio used to bucket "near-duplicate vs rewrite vs distinct
 * angle" without needing embeddings. Deliberately coarse: this is a text-only
 * heuristic, not a precise measurement, so callers should present it as
 * illustrative rather than exact. */
export function overlapRatio(a: Set<string>, b: Set<string>): number {
  const smaller = Math.min(a.size, b.size);
  if (smaller === 0) return 0;
  return sharedTokenCount(a, b) / smaller;
}
