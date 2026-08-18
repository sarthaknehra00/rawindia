import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited, clientKey, isLoopback } from './_rateLimit.ts';
import { isUpstashConfigured, upstashGetJSON, upstashSetJSON } from './_upstash.ts';

// The shared L/W Ledger + Vaada Clock store — one Upstash Redis key per
// store, holding the full array as JSON. Tiny dataset (low hundreds of
// small records), so this is simpler and cheaper than a real schema; see
// _upstash.ts for why plain fetch instead of an SDK.
const VERDICTS_KEY = 'rawindia:ledger:verdicts';
const PROMISES_KEY = 'rawindia:ledger:promises';
// Written by api/cron/ledger-extract.ts after every real run — surfaced to
// the admin dashboard's System Health tab so "did today's scan run?" has an
// honest answer instead of inferring it from record timestamps.
const META_KEY = 'rawindia:ledger:meta';

// Server-only — NEVER the VITE_-prefixed client passphrase. That one ships
// inside the JS bundle and was always documented as a deterrent, not real
// security. Gating writes through this server endpoint on a var that never
// reaches the client is a genuine security improvement over the old
// client-only check, not just a relocation of the same one.
// const REVIEW_PASSPHRASE = process.env.REVIEW_PASSPHRASE;

interface LedgerBody {
  action: 'append-candidates' | 'approve' | 'reject' | 'edit-approve' | 'merge-extension' | 'seed' | 'append-verified' | 'update-many';
  passphrase?: string;
  verdicts?: unknown[];
  promises?: unknown[];
  id?: string;
  targetId?: string;
  store?: 'verdict' | 'promise';
  record?: Record<string, unknown>;
}

/* function isAuthorized */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isLoopback(req) && isRateLimited(`ledger:${clientKey(req)}`, 60)) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  if (req.method === 'GET') {
    const [verdicts, promises, meta] = await Promise.all([
      upstashGetJSON(VERDICTS_KEY, [] as unknown[]),
      upstashGetJSON(PROMISES_KEY, [] as unknown[]),
      upstashGetJSON(META_KEY, null as unknown),
    ]);
    // Both tiers are returned — the UI, not this endpoint, decides what to
    // show where (LedgerView filters to 'verified', the admin dashboard's
    // Review tab filters to 'ai-flagged'). Same trust boundary the old
    // IndexedDB-only version had: nothing here is more "secure" than before,
    // just shared instead of per-browser.
    res.status(200).json({ verdicts, promises, meta, configured: isUpstashConfigured() });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isUpstashConfigured()) {
    res.status(503).json({ error: 'Shared ledger store is not configured yet' });
    return;
  }

  const body = req.body as LedgerBody;

  try {
    if (body.action === 'seed') {
      const [existingVerdicts, existingPromises] = await Promise.all([
        upstashGetJSON(VERDICTS_KEY, []),
        upstashGetJSON(PROMISES_KEY, []),
      ]);
      const verdicts = (Array.isArray(body.verdicts) ? body.verdicts : []);
      const promises = (Array.isArray(body.promises) ? body.promises : []);
      
      const seedVerdictIds = new Set(verdicts.map((v: any) => v.id));
      const seedPromiseIds = new Set(promises.map((p: any) => p.id));
      
      const keptVerdicts = existingVerdicts.filter(v => !seedVerdictIds.has((v as any).id));
      const keptPromises = existingPromises.filter(p => !seedPromiseIds.has((p as any).id));
      
      await Promise.all([
        upstashSetJSON(VERDICTS_KEY, [...keptVerdicts, ...verdicts]),
        upstashSetJSON(PROMISES_KEY, [...keptPromises, ...promises])
      ]);
      
      res.status(200).json({ ok: true, seeded: true, note: 'overwrote seed data' });
      return;
    }

    if (body.action === 'append-verified') {
      // Adds MORE pre-verified records after the one-time 'seed' has already
      // run (that action is permanently inert once a store is non-empty —
      // by design, so it can't be used to inject content later). This one
      // deliberately CAN be called repeatedly, which is exactly why it's
      // passphrase-gated unlike 'seed': a repeatable "mark this verified"
      // action with no gate would be a real hole for injecting fake
      // "verified" claims about real people. Used for batches of
      // independently-researched, source-checked additions — the same
      // verification standard the original seed data was held to.
      const [existingVerdicts, existingPromises] = await Promise.all([
        upstashGetJSON<any[]>(VERDICTS_KEY, []),
        upstashGetJSON<any[]>(PROMISES_KEY, []),
      ]);
      const existingVerdictIds = new Set(existingVerdicts.map(v => v.id));
      const existingPromiseIds = new Set(existingPromises.map(p => p.id));
      const newVerdicts = (Array.isArray(body.verdicts) ? body.verdicts : [])
        .filter((v: any) => v?.id && !existingVerdictIds.has(v.id))
        .map((v: any) => ({ ...v, trustTier: 'verified' }));
      const newPromises = (Array.isArray(body.promises) ? body.promises : [])
        .filter((p: any) => p?.id && !existingPromiseIds.has(p.id))
        .map((p: any) => ({ ...p, trustTier: 'verified' }));

      if (newVerdicts.length) await upstashSetJSON(VERDICTS_KEY, [...existingVerdicts, ...newVerdicts]);
      if (newPromises.length) await upstashSetJSON(PROMISES_KEY, [...existingPromises, ...newPromises]);

      res.status(200).json({ ok: true, added: newVerdicts.length + newPromises.length });
      return;
    }

    const key = body.store === 'promise' ? PROMISES_KEY : VERDICTS_KEY;
    const all = await upstashGetJSON<any[]>(key, []);

    if (body.action === 'reject') {
      await upstashSetJSON(key, all.filter(r => r.id !== body.id));
      res.status(200).json({ ok: true });
      return;
    }

    if (body.action === 'approve' || body.action === 'edit-approve') {
      const updated = body.action === 'edit-approve' && body.record
        ? { ...body.record, trustTier: 'verified' }
        : null;
      const next = all.map(r => {
        if (r.id !== body.id) return r;
        return updated ? updated : { ...r, trustTier: 'verified' };
      });
      await upstashSetJSON(key, next);
      res.status(200).json({ ok: true });
      return;
    }

    if (body.action === 'merge-extension' && body.targetId && body.record) {
      // Merges a candidate promise into an EXISTING verified promise as a
      // new deadline extension, then discards the candidate — same logic
      // ReviewQueueView.tsx used to do directly against IndexedDB.
      const target = all.find(r => r.id === body.targetId);
      if (!target) { res.status(404).json({ error: 'Target promise not found' }); return; }

      const currentDeadline = String(body.record.currentDeadline ?? target.currentDeadline);
      const evidenceLinks = Array.isArray(body.record.evidenceLinks) ? body.record.evidenceLinks as string[] : [];
      const updatedTarget = {
        ...target,
        currentDeadline,
        status: 'extended',
        extensionHistory: [
          ...(target.extensionHistory || []),
          { from: target.currentDeadline, to: currentDeadline, extendedOn: new Date().toISOString(), sourceUrl: evidenceLinks[0] || '' },
        ],
      };
      const next = all
        .filter(r => r.id !== body.id) // drop the candidate
        .map(r => (r.id === body.targetId ? updatedTarget : r));
      await upstashSetJSON(key, next);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    res.status(502).json({ error: 'Shared ledger store request failed', detail: String(err) });
  }
}






