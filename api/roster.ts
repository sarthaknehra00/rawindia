// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited, clientKey, isLoopback } from './_rateLimit.js';
import { isUpstashConfigured, upstashGetJSON, upstashSetJSON } from './_upstash.js';

/**
 * RAWINDIA — Accountability Roster (Netaji Report Card)
 *
 * The curated allowlist of India's main accountable leaders and institutions
 * that institutionLedgerService.ts filters against — nothing outside this
 * list ever gets a Netaji Report Card row, no matter how many times a name
 * gets quoted or verdict-tagged. Same shared-Upstash-with-local-fallback
 * pattern as api/ledger.ts, and reuses the SAME REVIEW_PASSPHRASE — one admin
 * secret for the whole ops surface, not a second one to manage.
 *
 * Leadership changes (cabinet reshuffles, state elections, a new CJI/RBI
 * Governor) are exactly why this needs to be editable without a redeploy —
 * see the admin dashboard's Roster tab.
 */
const ROSTER_KEY = 'rawindia:institutions:roster';
const REVIEW_PASSPHRASE = process.env.REVIEW_PASSPHRASE;

interface RosterBody {
  action: 'seed' | 'add' | 'update' | 'remove';
  passphrase?: string;
  roster?: unknown[];
  entry?: Record<string, unknown>;
  id?: string;
}

function isAuthorized(body: RosterBody): boolean {
  return Boolean(REVIEW_PASSPHRASE) && body.passphrase === REVIEW_PASSPHRASE;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isLoopback(req) && isRateLimited(`roster:${clientKey(req)}`, 60)) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  if (req.method === 'GET') {
    const roster = await upstashGetJSON(ROSTER_KEY, [] as unknown[]);
    res.status(200).json({ roster, configured: isUpstashConfigured() });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isUpstashConfigured()) {
    res.status(503).json({ error: 'Roster store is not configured yet' });
    return;
  }

  const body = req.body as RosterBody;

  try {
    if (body.action === 'seed') {
      // Self-limiting like api/ledger's 'seed' — only ever does anything
      // against a genuinely empty store, permanently inert after that. Safe
      // for every visitor's browser to check on load without a real secret.
      const existing = await upstashGetJSON<any[]>(ROSTER_KEY, []);
      if (existing.length > 0) {
        res.status(200).json({ ok: true, seeded: false, note: 'already seeded' });
        return;
      }
      const roster = Array.isArray(body.roster) ? body.roster : [];
      await upstashSetJSON(ROSTER_KEY, roster);
      res.status(200).json({ ok: true, seeded: true, count: roster.length });
      return;
    }

    // Every other action mutates the public-facing roster — passphrase-gated.
    if (!isAuthorized(body)) {
      res.status(401).json({ error: 'Invalid or missing passphrase' });
      return;
    }

    const all = await upstashGetJSON<any[]>(ROSTER_KEY, []);

    if (body.action === 'add' && body.entry) {
      await upstashSetJSON(ROSTER_KEY, [...all, body.entry]);
      res.status(200).json({ ok: true });
      return;
    }

    if (body.action === 'update' && body.entry) {
      const next = all.map(r => (r.id === body.entry!.id ? body.entry : r));
      await upstashSetJSON(ROSTER_KEY, next);
      res.status(200).json({ ok: true });
      return;
    }

    if (body.action === 'remove' && body.id) {
      await upstashSetJSON(ROSTER_KEY, all.filter(r => r.id !== body.id));
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    res.status(502).json({ error: 'Roster store request failed', detail: String(err) });
  }
}
