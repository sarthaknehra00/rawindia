/**
 * RAWINDIA — Netaji Report Card (formerly the Institutional Accountability
 * Ledger — "Roast the Spin" leaderboard + Institutional Report Card, now
 * merged with the Vaada Clock / L/W Ledger data into one scorecard per
 * institution, per PRD §4.3)
 *
 * Powers both the leaderboard view (InstitutionsView.tsx) and the per-
 * institution profile view (InstitutionProfileView.tsx) from the SAME
 * underlying data — they're really one feature looked at two ways: a ranked
 * list, and a detail page for any one row in it.
 *
 * Every row must match an entry on the Accountability Roster (see
 * accountabilityRoster.ts / rosterService.ts) — a curated allowlist of
 * India's main leaders and institutions. Previously this surfaced ANY name
 * that happened to get quoted, spin-decoded, or verdict-tagged, which let
 * one-off case parties, PSU corporations, and generic descriptions
 * ("Defendants in unsanctioned defamation cases") sit alongside real leaders.
 * The roster fixes that: unmatched names are silently dropped here, and
 * EVERY roster entry gets a row — even one with zero activity so far — so
 * this reads as a definitive directory, not just whoever got mentioned.
 *
 * Built from only what's honestly derivable from real recorded data:
 *   - Spin-phrase frequency (src/services/spinDecoderService.ts)
 *   - Article coverage count (articles where this person/institution is quoted)
 *   - Corrections issued on those articles (existing correctionLog field)
 *   - W/L tally and promise kept/broken/extended/stalled counts — but ONLY
 *     from 'verified' records (see persistenceService.ts's TrustTier). An
 *     ai-flagged candidate that hasn't cleared /ops/review never counts
 *     toward a real person's public score — see PRD §5/§9 for why.
 */

import {
  getAllSpinEvents, getLatestArticles,
  type SpinEvent, type VerdictEvent, type TrackedPromise,
} from './persistenceService';
import { getLedgerBundle } from './sharedLedgerService';
import { getRoster } from './rosterService';
import { matchRosterEntry, type RosterCategory } from '../data/accountabilityRoster';
import { institutionToSlug } from '../utils/routing';
import type { Article } from '../types';

export interface InstitutionSummary {
  name: string;
  slug: string;
  category: RosterCategory;
  role: string;
  spinCount: number;
  articleCount: number;
  correctionCount: number;
  lastSpinAt: string | null;
  wins: number;
  losses: number;
  promisesKept: number;
  promisesBroken: number;
  promisesExtended: number;
  promisesStalled: number;
}

export interface InstitutionProfile {
  summary: InstitutionSummary;
  spinEvents: SpinEvent[];       // newest first
  articles: Article[];           // articles quoting this person/institution
  verdicts: VerdictEvent[];      // verified only, newest first
  promises: TrackedPromise[];    // verified only, newest first
}

/** One row per roster entry (even zero-activity ones), ranked by real signal volume descending. */
export async function getInstitutionSummaries(): Promise<InstitutionSummary[]> {
  const [spinEvents, articles, { verdicts, promises }, { roster }] = await Promise.all([
    getAllSpinEvents(),
    getLatestArticles(5000),
    getLedgerBundle(),
    getRoster(),
  ]);
  const verifiedVerdicts = verdicts.filter(v => v.trustTier === 'verified');
  const verifiedPromises = promises.filter(p => p.trustTier === 'verified');

  // Every grouping below resolves the raw name to its ROSTER entry (by
  // canonical name or alias) rather than keying on the raw string directly —
  // this is what keeps a random quoted bystander or a one-off case
  // description ("Defendants in unsanctioned defamation cases") from ever
  // getting a row: if it doesn't match a roster entry, it's dropped here,
  // full stop. Keying on the roster entry's own `name` also still collapses
  // "RBI" and "Reserve Bank of India" into one row, same as canonicalization
  // used to do for ", Role" suffixes alone.
  const spinByEntry = new Map<string, { count: number; last: string }>();
  for (const e of spinEvents) {
    const entry = matchRosterEntry(e.speaker, roster);
    if (!entry) continue;
    const cur = spinByEntry.get(entry.name);
    if (cur) {
      cur.count++;
      if (e.timestamp > cur.last) cur.last = e.timestamp;
    } else {
      spinByEntry.set(entry.name, { count: 1, last: e.timestamp });
    }
  }

  const articleByEntry = new Map<string, { articleCount: number; correctionCount: number }>();
  for (const a of articles) {
    const speaker = a.quoteHighlight?.speaker;
    if (!speaker) continue;
    const entry = matchRosterEntry(speaker, roster);
    if (!entry) continue;
    const corrections = a.correctionLog?.length ?? 0;
    const cur = articleByEntry.get(entry.name);
    if (cur) {
      cur.articleCount++;
      cur.correctionCount += corrections;
    } else {
      articleByEntry.set(entry.name, { articleCount: 1, correctionCount: corrections });
    }
  }

  const verdictByEntry = new Map<string, { wins: number; losses: number }>();
  for (const v of verifiedVerdicts) {
    // actorName (who's ACCOUNTABLE) first — subjectName (who this favors/costs) as a fallback for older or
    // cron-extracted records that put the institution directly in subjectName. See VerdictEvent's doc comment.
    const entry = matchRosterEntry(v.actorName || v.subjectName, roster);
    if (!entry) continue;
    const cur = verdictByEntry.get(entry.name) ?? { wins: 0, losses: 0 };
    if (v.verdict === 'W') cur.wins++; else cur.losses++;
    verdictByEntry.set(entry.name, cur);
  }

  const promiseByEntry = new Map<string, { kept: number; broken: number; extended: number; stalled: number }>();
  for (const p of verifiedPromises) {
    const entry = matchRosterEntry(p.subjectName, roster);
    if (!entry) continue;
    const cur = promiseByEntry.get(entry.name) ?? { kept: 0, broken: 0, extended: 0, stalled: 0 };
    if (p.status === 'kept') cur.kept++;
    else if (p.status === 'broken') cur.broken++;
    else if (p.status === 'extended') cur.extended++;
    else if (p.status === 'stalled') cur.stalled++;
    promiseByEntry.set(entry.name, cur);
  }

  // Every ROSTER entry gets a row, even one with zero activity so far — this
  // is what makes it read as a definitive directory of accountable leaders
  // and institutions rather than just whoever happened to get mentioned.
  return roster
    .map((entry): InstitutionSummary => ({
      name: entry.name,
      slug: institutionToSlug(entry.name),
      category: entry.category,
      role: entry.role,
      spinCount:        spinByEntry.get(entry.name)?.count ?? 0,
      articleCount:     articleByEntry.get(entry.name)?.articleCount ?? 0,
      correctionCount:  articleByEntry.get(entry.name)?.correctionCount ?? 0,
      lastSpinAt:       spinByEntry.get(entry.name)?.last ?? null,
      wins:             verdictByEntry.get(entry.name)?.wins ?? 0,
      losses:           verdictByEntry.get(entry.name)?.losses ?? 0,
      promisesKept:     promiseByEntry.get(entry.name)?.kept ?? 0,
      promisesBroken:   promiseByEntry.get(entry.name)?.broken ?? 0,
      promisesExtended: promiseByEntry.get(entry.name)?.extended ?? 0,
      promisesStalled:  promiseByEntry.get(entry.name)?.stalled ?? 0,
    }))
    // Real signal volume first (same ranking logic as before), roster order
    // as the tiebreak for zero-activity rows — not an arbitrary Set order.
    .sort((a, b) => {
      const totalA = a.spinCount + a.wins + a.losses + a.promisesKept + a.promisesBroken + a.promisesExtended + a.promisesStalled;
      const totalB = b.spinCount + b.wins + b.losses + b.promisesKept + b.promisesBroken + b.promisesExtended + b.promisesStalled;
      return totalB - totalA || b.articleCount - a.articleCount;
    });
}

export async function getInstitutionProfile(slug: string): Promise<InstitutionProfile | null> {
  const [summaries, spinEvents, articles, { verdicts, promises }, { roster }] = await Promise.all([
    getInstitutionSummaries(),
    getAllSpinEvents(),
    getLatestArticles(5000),
    getLedgerBundle(),
    getRoster(),
  ]);

  const summary = summaries.find(s => s.slug === slug);
  if (!summary) return null;

  // Resolve each raw name through the roster to its CANONICAL name before
  // slugging — matching institutionToSlug(rawName) directly against `slug`
  // would miss any record that used an alias (e.g. "RBI") instead of the
  // canonical form (e.g. "Reserve Bank of India"), even though that same
  // record correctly counted toward this summary's totals above.
  const matchesSlug = (rawName: string): boolean => {
    const entry = matchRosterEntry(rawName, roster);
    return Boolean(entry) && institutionToSlug(entry!.name) === slug;
  };

  return {
    summary,
    spinEvents: spinEvents
      .filter(e => matchesSlug(e.speaker))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    articles: articles
      .filter(a => a.quoteHighlight && matchesSlug(a.quoteHighlight.speaker))
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
    verdicts: verdicts
      .filter(v => v.trustTier === 'verified' && matchesSlug(v.actorName || v.subjectName))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    promises: promises
      .filter(p => p.trustTier === 'verified' && matchesSlug(p.subjectName))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
