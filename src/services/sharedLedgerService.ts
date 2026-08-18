/**
 * RAWINDIA — Shared Ledger Client
 *
 * The L/W Ledger and Vaada Clock now have a real shared backend (Upstash
 * Redis via api/ledger.ts) — every visitor reads and writes the same
 * growing data, and a daily Vercel Cron job (api/cron/ledger-extract.ts)
 * can add candidates even when nobody's browser is open. Before Upstash is
 * configured (or if the request fails), this degrades to the ORIGINAL
 * per-browser IndexedDB behavior — nothing breaks, it just goes back to
 * being local-only, same as before this existed.
 *
 * Every consumer (LedgerView, ReviewQueueView, institutionLedgerService,
 * promiseExtractionService) goes through this file rather than choosing
 * shared-vs-local itself — one fallback policy, not four.
 */

import {
  getAllVerdictEvents, getAllPromises, saveVerdictEvent, savePromise,
  deleteVerdictEvent, deletePromise,
  type VerdictEvent, type TrackedPromise,
} from './persistenceService';

const LEDGER_URL = '/api/ledger';

/** Written by api/cron/ledger-extract.ts after every real run — lets the
 * admin dashboard show honest "last automated scan" status instead of
 * guessing from record timestamps. Null until the cron has run at least once. */
export interface CronMeta {
  lastRunAt: string;
  scanned: number;
  extractedVerdicts: number;
  extractedPromises: number;
}

export interface LedgerBundle {
  verdicts: VerdictEvent[];
  promises: TrackedPromise[];
  source: 'shared' | 'local';
  meta: CronMeta | null;
}

/** Reads both stores — shared backend if configured, IndexedDB otherwise. */
export async function getLedgerBundle(): Promise<LedgerBundle> {
  try {
    const res = await fetch(LEDGER_URL);
    if (res.ok) {
      const data = await res.json();
      if (data.configured) {
        return { verdicts: data.verdicts || [], promises: data.promises || [], source: 'shared', meta: data.meta || null };
      }
    }
  } catch { /* fall through to local */ }

  const [verdicts, promises] = await Promise.all([getAllVerdictEvents(), getAllPromises()]);
  return { verdicts, promises, source: 'local', meta: null };
}

/** Submits fresh ai-flagged candidates found by the local Ollama extraction pass. */
export async function submitCandidates(verdicts: VerdictEvent[], promises: TrackedPromise[]): Promise<void> {
  try {
    const res = await fetch(LEDGER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'append-candidates', verdicts, promises }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.error === undefined) return; // shared write succeeded (or Upstash unconfigured, harmless no-op)
    }
  } catch { /* fall through to local */ }

  // Local fallback — same as this app's original behavior.
  await Promise.all([
    ...verdicts.map(v => saveVerdictEvent(v)),
    ...promises.map(p => savePromise(p)),
  ]);
}

type Store = 'verdict' | 'promise';

async function sharedAction(body: Record<string, unknown>): Promise<{ ok: boolean; usedShared: boolean }> {
  try {
    const res = await fetch(LEDGER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 503) return { ok: false, usedShared: false }; // not configured — caller should use local path
    return { ok: res.ok, usedShared: true };
  } catch {
    return { ok: false, usedShared: false };
  }
}

export async function approve(store: Store, id: string, passphrase: string, localRecord?: VerdictEvent | TrackedPromise): Promise<boolean> {
  const { ok, usedShared } = await sharedAction({ action: 'approve', store, id, passphrase });
  if (usedShared) return ok;

  // Local fallback: flip the in-memory record's trustTier and re-save.
  if (!localRecord) return false;
  const verified = { ...localRecord, trustTier: 'verified' as const };
  if (store === 'verdict') await saveVerdictEvent(verified as VerdictEvent);
  else await savePromise(verified as TrackedPromise);
  return true;
}

export async function editApprove(store: Store, record: VerdictEvent | TrackedPromise, passphrase: string): Promise<boolean> {
  const { ok, usedShared } = await sharedAction({ action: 'edit-approve', store, id: record.id, record: { ...record, trustTier: 'verified' }, passphrase });
  if (usedShared) return ok;

  const verified = { ...record, trustTier: 'verified' as const };
  if (store === 'verdict') await saveVerdictEvent(verified as VerdictEvent);
  else await savePromise(verified as TrackedPromise);
  return true;
}

export async function reject(store: Store, id: string, passphrase: string): Promise<boolean> {
  const { ok, usedShared } = await sharedAction({ action: 'reject', store, id, passphrase });
  if (usedShared) return ok;

  if (store === 'verdict') await deleteVerdictEvent(id);
  else await deletePromise(id);
  return true;
}

/**
 * One-time seed write. Self-limiting server-side (api/ledger.ts's 'seed'
 * action only ever does anything against genuinely empty stores), so this
 * is safe to attempt on every visitor's first load without a real secret.
 * Returns which path actually took the data, so the caller's local
 * one-time flag reflects reality (don't mark "seeded" locally if the
 * shared write silently no-op'd because Upstash isn't configured yet).
 */
export async function seedShared(verdicts: VerdictEvent[], promises: TrackedPromise[]): Promise<'shared' | 'unavailable'> {
  try {
    const res = await fetch(LEDGER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seed', verdicts, promises }),
    });
    if (res.status === 503) return 'unavailable';
    if (res.ok) return 'shared';
  } catch { /* fall through */ }
  return 'unavailable';
}

/**
 * Adds a brand-new record directly as 'verified' — for the admin dashboard's
 * "Add Entry" tab, where a human is asserting the fact themselves (not an AI
 * extraction awaiting review). Passphrase-gated server-side via the same
 * 'append-verified' action the batch data additions used — see api/ledger.ts.
 */
export async function addVerified(verdicts: VerdictEvent[], promises: TrackedPromise[], passphrase: string): Promise<boolean> {
  const { ok, usedShared } = await sharedAction({ action: 'append-verified', verdicts, promises, passphrase });
  if (usedShared) return ok;

  await Promise.all([
    ...verdicts.map(v => saveVerdictEvent({ ...v, trustTier: 'verified' })),
    ...promises.map(p => savePromise({ ...p, trustTier: 'verified' })),
  ]);
  return true;
}

export async function mergeExtension(
  id: string, targetId: string, record: TrackedPromise, passphrase: string
): Promise<boolean> {
  const { ok, usedShared } = await sharedAction({
    action: 'merge-extension', store: 'promise', id, targetId,
    record: { currentDeadline: record.currentDeadline, evidenceLinks: record.evidenceLinks },
    passphrase,
  });
  if (usedShared) return ok;
  return false; // local-only merge fallback isn't implemented — rare path, safe to just report failure
}
