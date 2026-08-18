/**
 * RAWINDIA — Accountability Roster Client
 *
 * Same shared-with-local-fallback pattern as sharedLedgerService.ts: reads
 * and writes the roster through api/roster.ts when the shared Upstash store
 * is configured, and falls back to the static seed file otherwise (nothing
 * breaks in local dev without credentials — it just serves the shipped list
 * instead of the admin-editable one).
 */

import { ACCOUNTABILITY_ROSTER, type RosterEntry } from '../data/accountabilityRoster';

const ROSTER_URL = '/api/roster';
const SEED_CONFIRMED_KEY = 'rawindia_roster_shared_confirmed_v1';

export interface RosterBundle {
  roster: RosterEntry[];
  source: 'shared' | 'local';
}

export async function getRoster(): Promise<RosterBundle> {
  try {
    const res = await fetch(ROSTER_URL);
    if (res.ok) {
      const data = await res.json();
      if (data.configured) return { roster: data.roster || [], source: 'shared' };
    }
  } catch { /* fall through to local */ }
  return { roster: ACCOUNTABILITY_ROSTER, source: 'local' };
}

/** One-time seed of the researched roster into the shared store — see api/roster.ts's self-limiting 'seed' action. */
export async function seedRosterIfNeeded(): Promise<void> {
  if (localStorage.getItem(SEED_CONFIRMED_KEY)) return;
  try {
    const res = await fetch(ROSTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seed', roster: ACCOUNTABILITY_ROSTER }),
    });
    if (res.status === 503) return; // not configured yet — nothing to confirm
    if (res.ok) localStorage.setItem(SEED_CONFIRMED_KEY, '1');
  } catch { /* try again next load */ }
}

async function rosterAction(body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(ROSTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function addRosterEntry(entry: RosterEntry, passphrase: string): Promise<boolean> {
  return rosterAction({ action: 'add', entry, passphrase });
}

export async function updateRosterEntry(entry: RosterEntry, passphrase: string): Promise<boolean> {
  return rosterAction({ action: 'update', entry, passphrase });
}

export async function removeRosterEntry(id: string, passphrase: string): Promise<boolean> {
  return rosterAction({ action: 'remove', id, passphrase });
}
