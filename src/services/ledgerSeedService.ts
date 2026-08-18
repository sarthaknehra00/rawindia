/**
 * RAWINDIA — One-time Ledger Seed
 *
 * Writes the researched seed dataset (seedLedgerData.ts) once. Tries the
 * shared Upstash store first (api/ledger.ts's 'seed' action is self-limiting
 * — a no-op against a store that already has data — so every visitor's
 * browser can safely attempt this on load without duplicating anything or
 * needing a real secret). Falls back to local IndexedDB, gated by a
 * localStorage flag, if the shared store isn't configured yet.
 *
 * Once the shared store is confirmed configured (whether THIS call is what
 * seeded it, or it already was), a local flag skips the check forever after
 * — on a free Upstash tier, every page load site-wide (not just /ledger)
 * running this same "is it seeded yet" check forever would be pure waste of
 * the monthly command budget for something that only ever matters once.
 */

import { saveVerdictEvent, savePromise, getAllVerdictEvents, getAllPromises, logSpinEvent, getAllSpinEvents, deleteVerdictEvent, deletePromise, clearAllSpinEvents } from './persistenceService';
import { seedShared } from './sharedLedgerService';
import { SEED_VERDICTS, SEED_PROMISES, BATCH2_VERDICTS, BATCH2_PROMISES, BATCH3_VERDICTS, BATCH3_PROMISES, BATCH4_VERDICTS, BATCH4_PROMISES, HISTORICAL_VERDICTS, HISTORICAL_PROMISES } from '../data/seedLedgerData';
import { SEED_SPIN_EVENTS } from '../data/seedSpinData';

const LOCAL_SEED_FLAG_KEY = 'rawindia_ledger_seeded_v11';
const SHARED_SEED_CONFIRMED_KEY = 'rawindia_ledger_shared_confirmed_v11';

const ALL_VERDICTS = [...SEED_VERDICTS, ...BATCH2_VERDICTS, ...BATCH3_VERDICTS, ...BATCH4_VERDICTS, ...HISTORICAL_VERDICTS];
const ALL_PROMISES = [...SEED_PROMISES, ...BATCH2_PROMISES, ...BATCH3_PROMISES, ...BATCH4_PROMISES, ...HISTORICAL_PROMISES];

export async function seedLedgerIfNeeded(): Promise<void> {
  // CLEANUP MOCK DATA: Run once to delete the fake "tons of data" we added
  if (!localStorage.getItem('rawindia_ledger_cleaned_mock_v1')) {
    try {
      const allV = await getAllVerdictEvents();
      const allP = await getAllPromises();
      await Promise.all(allV.filter(v => v.articleId === 'seed-generated').map(v => deleteVerdictEvent(v.id)));
      await Promise.all(allP.filter(p => p.articleId === 'seed-generated').map(p => deletePromise(p.id)));
      await clearAllSpinEvents(); // Nuke all spin events, we will re-insert them cleanly
      localStorage.setItem('rawindia_ledger_cleaned_mock_v1', '1');
      
      // Force reseeding of spin by removing the flag
      localStorage.removeItem('rawindia_spin_seeded_v5');
    } catch(e) {
      console.warn("Cleanup failed", e);
    }
  }
  // Spin events only live in local IndexedDB (no shared Upstash store for them).
  // Seed them if not already seeded locally.
  if (!localStorage.getItem('rawindia_spin_seeded_v5')) {
    try {
      const existingSpin = await getAllSpinEvents();
      const existingTerms = new Set(existingSpin.map(s => s.term));
      for (const event of SEED_SPIN_EVENTS) {
        if (!existingTerms.has(event.term)) {
          await logSpinEvent(event);
        }
      }
      localStorage.setItem('rawindia_spin_seeded_v5', '1');
    } catch (err) {
      console.warn('[ledgerSeedService] spin seeding failed:', err);
    }
  }

  // Shared backend already confirmed live (by this browser, at some earlier
  // load) — nothing left to check, ever, regardless of how many more times
  // this function gets called across the site.
  if (localStorage.getItem(SHARED_SEED_CONFIRMED_KEY)) return;

  const outcome = await seedShared(ALL_VERDICTS, ALL_PROMISES).catch(() => 'unavailable' as const);
  if (outcome === 'shared') {
    localStorage.setItem(SHARED_SEED_CONFIRMED_KEY, '1');
    return;
  }

  // Shared store isn't configured yet — deliberately NOT marking the
  // "confirmed" flag here, so this keeps retrying on future loads until
  // Upstash actually gets set up. Each retry while unconfigured costs
  // nothing real: api/ledger.ts's 'seed' action checks isUpstashConfigured()
  // and returns 503 before ever touching Upstash, so this is just a wasted
  // round-trip to our own function, never a real Upstash command.
  if (localStorage.getItem(LOCAL_SEED_FLAG_KEY)) return;
  localStorage.setItem(LOCAL_SEED_FLAG_KEY, '1');

  try {
    const [existingVerdicts, existingPromises] = await Promise.all([
      getAllVerdictEvents(),
      getAllPromises(),
    ]);
    const existingVerdictIds = new Set(existingVerdicts.map(v => v.id));
    const existingPromiseIds = new Set(existingPromises.map(p => p.id));

    await Promise.all([
      ...ALL_VERDICTS.filter(v => !existingVerdictIds.has(v.id)).map(v => saveVerdictEvent(v)),
      ...ALL_PROMISES.filter(p => !existingPromiseIds.has(p.id)).map(p => savePromise(p)),
    ]);
  } catch (err) {
    console.warn('[ledgerSeedService] local fallback seeding failed:', err);
  }
}
