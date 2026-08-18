/**
 * RAWINDIA — Story Clustering & Coverage Provenance
 *
 * newsApiService.ts's cross-source dedup pass collapses near-duplicate
 * headlines (same story, different wire) down to one surviving article for
 * the feed — good for a clean feed, but it would otherwise throw away exactly
 * the data needed to answer "who else covered this, and how did their
 * framing differ?". This module is where those dropped near-duplicates go
 * instead of being discarded: lightweight metadata only (id/title/source/
 * publishedAt/url), keyed by the surviving ("primary") article's id.
 *
 * A cluster only exists here once a primary has 2+ members (itself plus at
 * least one duplicate) — the overwhelming majority of articles have no
 * cross-source echo, and storing a wasted single-member entry for every one
 * of them would bloat this for no benefit.
 */

import type { Article } from '../types';
import { significantTitleTokens, overlapRatio } from '../utils/textSimilarity';

export interface ClusterMember {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  url?: string;
}

export interface StoryCluster {
  primaryId: string;
  members: ClusterMember[]; // includes the primary itself, in no particular order
}

const STORAGE_KEY   = 'RAWINDIA_STORY_CLUSTERS_V1';
const MAX_CLUSTERS  = 200; // capped like the rest of the app's localStorage-backed state

let clusters: Map<string, StoryCluster> = new Map();
let loaded = false;

function toMember(a: Article): ClusterMember {
  return {
    id:          a.id,
    title:       a.title,
    source:      a.externalSource || 'Wire',
    publishedAt: a.publishedAt,
    url:         a.externalUrl,
  };
}

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) clusters = new Map(JSON.parse(raw));
  } catch { /* ignore — starts empty, same as every other persisted store here */ }
}

function persist(): void {
  try {
    if (clusters.size > MAX_CLUSTERS) {
      // Keep whichever clusters were most recently active (by their most
      // recent member's publish time) — the oldest are the least likely to
      // still be what a reader currently has open.
      const entries = Array.from(clusters.entries())
        .sort((a, b) => latestMemberMs(b[1]) - latestMemberMs(a[1]))
        .slice(0, MAX_CLUSTERS);
      clusters = new Map(entries);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(clusters.entries())));
  } catch { /* quota — same graceful no-op as the rest of the app's persistence */ }
}

function latestMemberMs(cluster: StoryCluster): number {
  return Math.max(...cluster.members.map(m => new Date(m.publishedAt).getTime()));
}

// Gathered during ONE dedup pass in newsApiService.ts, merged into the
// persisted store only via finalizePendingClusters() at the end of that
// pass — see the module comment for why single-member entries are skipped.
let pending: Map<string, ClusterMember[]> = new Map();

export function recordClusterCandidate(primary: Article, duplicate: Article): void {
  if (!pending.has(primary.id)) pending.set(primary.id, [toMember(primary)]);
  const members = pending.get(primary.id)!;
  if (!members.some(m => m.id === duplicate.id)) members.push(toMember(duplicate));
}

export function finalizePendingClusters(): void {
  if (pending.size === 0) return;
  load();

  for (const [primaryId, members] of pending) {
    if (members.length < 2) continue; // no actual duplicate was found for this one

    const existing = clusters.get(primaryId);
    if (!existing) {
      clusters.set(primaryId, { primaryId, members });
      continue;
    }
    // A later dedup pass can surface previously-unseen siblings for a
    // primary already tracked from an earlier pass — merge rather than
    // overwrite so earlier-discovered coverage isn't lost.
    const merged = [...existing.members];
    for (const m of members) if (!merged.some(x => x.id === m.id)) merged.push(m);
    clusters.set(primaryId, { primaryId, members: merged });
  }

  pending = new Map();
  persist();
}

export function getStoryCluster(primaryId: string): StoryCluster | null {
  load();
  return clusters.get(primaryId) || null;
}

// One outlet can end up contributing more than one member to a cluster (a
// wire syndicated to two of its own regional editions, a re-fetch under a
// new id). Counting the same outlet twice would double-count it as if two
// separate publications had covered the story. Keep only each outlet's
// earliest entry — a republish doesn't count as a second echo.
export function dedupeByOutlet(members: ClusterMember[]): ClusterMember[] {
  const bySource = new Map<string, ClusterMember>();
  for (const m of members) {
    const key = m.source.trim().toLowerCase();
    const existing = bySource.get(key);
    if (!existing || new Date(m.publishedAt).getTime() < new Date(existing.publishedAt).getTime()) {
      bySource.set(key, m);
    }
  }
  return [...bySource.values()];
}

// A member timestamped more than a day in the future relative to "now" is
// almost certainly bad wire metadata (seen in practice from some RSS feeds),
// not a genuine scoop from tomorrow — don't let it steal "first reported by"
// credit it didn't earn. It still appears in the list, just can't win the
// race for first place.
const FUTURE_DATE_DISTRUST_MS = 24 * 60 * 60 * 1000;
function isPlausiblyTimed(member: ClusterMember, now: number): boolean {
  return new Date(member.publishedAt).getTime() <= now + FUTURE_DATE_DISTRUST_MS;
}

// ── Coverage provenance analysis ──────────────────────────────────────────────
// Pure text heuristic (no embeddings): the earliest-published member is the
// presumed first report; every later member is bucketed by how much title
// vocabulary it shares with that first report. Coarse by design — presented
// to readers as an approximate signal, not a forensic measurement.
export type CoverageClassification = 'First Report' | 'Near-Duplicate' | 'Rewrite' | 'Distinct Angle';

export interface CoverageEntry {
  member: ClusterMember;
  classification: CoverageClassification;
  echoLagMs: number; // 0 for the first report itself
}

export interface CoverageAnalysis {
  firstReport: ClusterMember;
  entries: CoverageEntry[]; // chronological, includes the first report
  // Fraction of echoes (entries after the first) that are near-duplicates —
  // a proxy for how much of the "coverage" is really just wire/press-release
  // copy rather than independent reporting.
  stenographyRatio: number;
}

export function analyzeCoverage(cluster: StoryCluster): CoverageAnalysis {
  const now = Date.now();
  const deduped = dedupeByOutlet(cluster.members);
  const sorted = [...deduped].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  );

  // Pick the earliest PLAUSIBLY-timed member as first report; if every
  // member somehow fails the plausibility check (all bad data), fall back
  // to the earliest one anyway rather than crashing on an empty pick.
  const first = sorted.find(m => isPlausiblyTimed(m, now)) ?? sorted[0];
  const firstMs   = new Date(first.publishedAt).getTime();
  const firstTokens = significantTitleTokens(first.title);

  const entries: CoverageEntry[] = sorted.map(member => {
    if (member.id === first.id) {
      return { member, classification: 'First Report', echoLagMs: 0 };
    }
    const ratio = overlapRatio(firstTokens, significantTitleTokens(member.title));
    const classification: CoverageClassification =
      ratio >= 0.75 ? 'Near-Duplicate' : ratio >= 0.4 ? 'Rewrite' : 'Distinct Angle';
    return { member, classification, echoLagMs: new Date(member.publishedAt).getTime() - firstMs };
  });

  const echoes = entries.filter(e => e.member.id !== first.id);
  const stenographyRatio = echoes.length === 0
    ? 0
    : echoes.filter(e => e.classification === 'Near-Duplicate').length / echoes.length;

  return { firstReport: first, entries, stenographyRatio };
}

/** "3h 12m", "45m", "2d 4h" — for displaying echo lag next to a coverage entry. */
export function formatLag(ms: number): string {
  if (ms < 60_000) return 'moments later';
  const totalMin = Math.floor(ms / 60_000);
  const days  = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins  = totalMin % 60;
  if (days  > 0) return `+${days}d ${hours}h`;
  if (hours > 0) return `+${hours}h ${mins}m`;
  return `+${mins}m`;
}
