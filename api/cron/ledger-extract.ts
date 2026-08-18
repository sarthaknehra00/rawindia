// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isUpstashConfigured, upstashGetJSON, upstashSetJSON } from '../_upstash.js';

/**
 * RAWINDIA — Daily Ledger Extraction (Vercel Cron)
 *
 * Runs once a day (see vercel.json), server-side, independent of whether
 * anyone's browser is open — fixing the real gap the client-only Ollama
 * pipeline had: extraction could only ever run while a live tab happened to
 * be open. Uses Groq (not Ollama — Ollama only runs on a local machine, not
 * reachable from Vercel) over a small, real batch of the day's actual
 * headlines (RBI press releases + NewsAPI India top-headlines).
 *
 * Writes candidates as 'ai-flagged' ONLY — this job never publishes
 * anything. A human still clears every candidate at /ops/review before it's
 * visible anywhere. See PRD §9's reasoning for why that gate stays fixed
 * regardless of how the candidates get found.
 */

// Vercel's DEFAULT serverless function timeout is 5s — nowhere near enough
// for this job's two source fetches (up to 8s each) plus one Groq call (up
// to 45s). Hobby's free plan allows up to 60s if a function explicitly asks
// for it, which this does. Without this, the job would silently time out
// and fail every single day rather than actually extracting anything.
export const config = { maxDuration: 60 };

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY = process.env.GROQ_KEY;
const NEWSAPI_KEY = process.env.NEWSAPI_KEY;

const VERDICTS_KEY = 'rawindia:ledger:verdicts';
const PROMISES_KEY = 'rawindia:ledger:promises';
// Read by api/ledger's GET handler, surfaced on the admin dashboard's
// System Health tab — written on every real run (not the config-skip early
// returns above) so "last scan" status is honest even on a 0-extraction day.
const META_KEY = 'rawindia:ledger:meta';

function writeMeta(scanned: number, extractedVerdicts: number, extractedPromises: number): Promise<void> {
  return upstashSetJSON(META_KEY, {
    lastRunAt: new Date().toISOString(),
    scanned, extractedVerdicts, extractedPromises,
  }).catch(() => { /* status reporting is best-effort — never fail the job over it */ });
}

interface RawItem { title: string; snippet: string; url: string; }

async function fetchRbiItems(): Promise<RawItem[]> {
  try {
    const res = await fetch('https://www.rbi.org.in/pressreleases_rss.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    return blocks.slice(0, 5).map(block => {
      const title = (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || [])[1] || '';
      const desc  = (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || [])[1] || '';
      const link  = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
      return { title, snippet: desc.replace(/<[^>]+>/g, ' ').slice(0, 400), url: link };
    }).filter(i => i.title && i.url);
  } catch {
    return [];
  }
}

async function fetchNewsApiItems(): Promise<RawItem[]> {
  if (!NEWSAPI_KEY) return [];
  try {
    const params = new URLSearchParams({ country: 'in', pageSize: '8', apiKey: NEWSAPI_KEY });
    const res = await fetch(`https://newsapi.org/v2/top-headlines?${params.toString()}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json() as { articles?: any[] };
    return (data.articles || [])
      .filter((a: any) => a.title && !a.title.includes('[Removed]'))
      .map((a: any) => ({ title: a.title, snippet: (a.description || '').slice(0, 400), url: a.url }));
  } catch {
    return [];
  }
}

const SYSTEM_PROMPT = `You read a batch of real news dispatches and, for EACH ONE, look for exactly two things:
1. A PROMISE: a named politician, party, ministry, or government body committing to a future, dated action. Only flag if a real, specific deadline (date/month/year) is stated.
2. A VERDICT: a clear, concrete outcome that plainly helped one named party/institution and hurt another — not a routine announcement with no real winner or loser.

Rules: every field must be grounded in the exact dispatch given — never invent a name, date, or outcome. subjectName must be a specific real named person/party/ministry/institution, never vague ("officials"). Most dispatches will have both null — that's expected. deadline must be ISO (YYYY-MM-DD); if only month/year given, use the 1st.

Return ONLY this JSON: {"results": [
  {"promise": null | {"subjectName": "...", "promiseText": "...", "category": "...", "deadline": "YYYY-MM-DD"},
   "verdict": null | {"subjectName": "...", "headline": "...", "verdict": "W" | "L"}},
  ... one object per dispatch, in the SAME ORDER given
]}`;

function isNonEmpty(v: unknown): v is string { return typeof v === 'string' && v.trim().length > 0; }
function isIsoDate(v: unknown): v is string { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime()); }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel injects this header on genuine scheduled invocations — verifying
  // it stops this endpoint from being a public "burn our Groq quota on
  // demand" trigger.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!isUpstashConfigured()) {
    res.status(200).json({ skipped: 'Upstash not configured yet' });
    return;
  }
  if (!GROQ_KEY) {
    res.status(200).json({ skipped: 'GROQ_KEY not configured' });
    return;
  }

  const [rbi, newsapi] = await Promise.all([fetchRbiItems(), fetchNewsApiItems()]);
  const items = [...rbi, ...newsapi];
  if (items.length === 0) {
    await writeMeta(0, 0, 0);
    res.status(200).json({ ok: true, extracted: 0, note: 'no source items fetched today' });
    return;
  }

  const userMsg = items.map((it, i) => `DISPATCH ${i + 1}:\nTITLE: ${it.title}\nCONTENT: ${it.snippet}`).join('\n\n---\n\n');

  try {
    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
        temperature: 0.1,
        max_tokens: Math.min(4000, 300 * items.length),
        response_format: { type: 'json_object' },
        reasoning_effort: 'low',
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!groqRes.ok) {
      await writeMeta(items.length, 0, 0);
      res.status(200).json({ ok: false, note: `Groq returned ${groqRes.status}` });
      return;
    }

    const data = await groqRes.json() as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) { await writeMeta(items.length, 0, 0); res.status(200).json({ ok: false, note: 'empty Groq response' }); return; }

    const parsed = JSON.parse(raw);
    const results = Array.isArray(parsed.results) ? parsed.results : [];
    const now = new Date().toISOString();

    const newVerdicts: any[] = [];
    const newPromises: any[] = [];

    results.forEach((r: any, i: number) => {
      const source = items[i];
      if (!source) return;

      const p = r?.promise;
      if (p && isNonEmpty(p.subjectName) && isNonEmpty(p.promiseText) && isIsoDate(p.deadline)) {
        newPromises.push({
          id: `cron-promise-${Date.now().toString(36)}-${i}`,
          subjectName: p.subjectName.trim(),
          promiseText: p.promiseText.trim(),
          category: isNonEmpty(p.category) ? p.category.trim() : 'General',
          originalDeadline: p.deadline,
          currentDeadline: p.deadline,
          extensionHistory: [],
          status: 'in-progress',
          evidenceLinks: [source.url],
          sourceExcerpt: source.snippet || source.title,
          articleId: 'cron-daily-extraction',
          trustTier: 'ai-flagged',
          createdAt: now,
        });
      }

      const v = r?.verdict;
      if (v && isNonEmpty(v.subjectName) && isNonEmpty(v.headline) && (v.verdict === 'W' || v.verdict === 'L')) {
        newVerdicts.push({
          id: `cron-verdict-${Date.now().toString(36)}-${i}`,
          headline: v.headline.trim(),
          verdict: v.verdict,
          subjectName: v.subjectName.trim(),
          sourceUrl: source.url,
          sourceExcerpt: source.snippet || source.title,
          articleId: 'cron-daily-extraction',
          trustTier: 'ai-flagged',
          createdAt: now,
        });
      }
    });

    if (newVerdicts.length) {
      const existing = await upstashGetJSON<any[]>(VERDICTS_KEY, []);
      await upstashSetJSON(VERDICTS_KEY, [...existing, ...newVerdicts]);
    }
    if (newPromises.length) {
      const existing = await upstashGetJSON<any[]>(PROMISES_KEY, []);
      await upstashSetJSON(PROMISES_KEY, [...existing, ...newPromises]);
    }

    await writeMeta(items.length, newVerdicts.length, newPromises.length);
    res.status(200).json({
      ok: true,
      scanned: items.length,
      extracted: { verdicts: newVerdicts.length, promises: newPromises.length },
    });
  } catch (err) {
    await writeMeta(items.length, 0, 0);
    res.status(200).json({ ok: false, note: String(err) });
  }
}
