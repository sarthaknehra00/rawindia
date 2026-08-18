/**
 * RAWINDIA — Groq Editorial Engine
 *
 * Rewrites raw wire articles in the Light Yagami × Eren Yeager editorial voice.
 * 100-200 words. No filler. Every sentence earns its place.
 */

import type { Article } from '../types';
import { getImageForArticle } from './imageService';
import { stampArticleSections } from './sectionService';

// llama-3.3-70b-versatile / llama-3.1-8b-instant were decommissioned by Groq —
// replaced with the current openai/gpt-oss tiers (same 120b/20b hero/fast split).
const GROQ_MODEL = 'openai/gpt-oss-120b';
// Fast tier for the background queue — much lower latency than the 120b model.
// Reserve GROQ_MODEL (120b) for hero/immediate synthesis where quality matters most.
export const GROQ_MODEL_FAST = 'openai/gpt-oss-20b';
// Routed through our own serverless proxy (api/groq.ts) — the real Groq key
// lives server-side only and is never shipped to the client bundle.
const GROQ_URL       = '/api/groq';
// This Groq account is capped at 8000 tokens PER REQUEST (prompt + completion
// combined) per model — confirmed via the x-ratelimit-limit-tokens response
// header. An 8-article batch's prompt alone runs 1500-2500 tokens, which left
// too little headroom for the completion and caused both 413 (request too
// large) and 400 json_validate_failed (ran out of max_tokens mid-JSON)
// errors. 4 articles per call keeps prompt + completion comfortably under
// that ceiling with margin to spare.
const BATCH_SIZE = 4; // articles per Groq call

// ── Editorial voice + strict JSON output ──────────────────────────────────────
const SYSTEM_PROMPT = `You are RAWINDIA's editor. Rewrite news in this exact voice:

VOICE: Light Yagami (cold, surgical precision, exposes power structures) × Eren Yeager (zero tolerance for comfortable lies, forward-charging). Name every institution, minister, company directly. Open with the most damaging fact. Use hard numbers — rupees, percentages, dates. No PR language. Forbidden: "sources say", "stakeholders concerned". If the source material is too thin to support a strong claim, state plainly what is and isn't known — do not manufacture false certainty to sound authoritative.

FACTUAL INTEGRITY (non-negotiable, overrides voice instructions if they ever conflict): Never invent a quote and attribute it to a real person. Never alter a number, date, name, or location from the source. If the source lacks a detail, omit it — do not fabricate one.

WORD LIMIT: body field must be 100-200 words TOTAL. Hard cap. Short brutal sentences.

VERTICAL MAP:
1=India/National, 2=States/UTs, 3=World(India lens), 4=Business/Economy, 5=Technology, 6=Science/Environment, 7=Sports, 8=Entertainment

SUBCATEGORY MAP (use verticalId to pick):
V1: 1-1=Govt, 1-2=Politics, 1-3=Judiciary, 1-4=Crime, 1-5=Defence, 1-6=Society, 1-7=Infrastructure, 1-8=Disaster
V2: 2-1=StatePolitics, 2-2=LocalCrime, 2-3=RegionalDev, 2-4=LocalEconomy
V3: 3-1=India-US, 3-2=India-China, 3-3=India-Pakistan, 3-4=India-Russia, 3-7=Neighbours, 3-8=Diaspora
V4: 4-1=Macro, 4-2=Markets, 4-3=Corporate, 4-4=Startups, 4-5=Sectors, 4-8=Agriculture
V5: 5-2=AI, 5-3=Telecom, 5-5=ISRO/Space, 5-6=Cybersecurity, 5-1=IT
V6: 6-2=Climate, 6-3=Pollution, 6-4=Renewables, 6-5=Wildlife
V7: 7-1=Cricket, 7-2=Football, 7-5=Olympics, 7-6=Athletics
V8: 8-1=Bollywood, 8-2=RegionalCinema, 8-4=OTT, 8-5=Music

OUTPUT: Return ONLY this JSON (no markdown, no extra text):
{
  "headline": "punchy rewritten headline",
  "standfirst": "one sentence — the core revelation",
  "facts": ["WHO", "WHAT with ₹/% number", "WHEN exact date", "WHERE", "WHAT IS CONCEALED — a specific concealment/omission ONLY if the source material itself raises one; otherwise write 'No indication of concealment in current reporting'"],
  "body": "100-200 word rewrite in RAWINDIA voice. Cold. Surgical. Names names.",
  "quote": "EXACT verbatim quote ONLY if one genuinely appears in the source material — otherwise null. NEVER invent, paraphrase-as-quote, or reconstruct a quote from indirect speech.",
  "speaker": "Name, Role of the quoted person — only if quote is non-null, otherwise null.",
  "verticalId": 1,
  "verticalName": "India / National",
  "subCategoryId": "1-3",
  "subCategoryName": "Judiciary & Law",
  "subSubCategoryId": "1-3-1",
  "subSubCategoryName": "Supreme Court of India",
  "contentType": "NEWS",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "imageTerms": "3 specific photo keywords e.g. supreme court india columns",
  "scale": "National",
  "severity": "High",
  "institution": "National Constitutional",
  "irreversibility": "Moderate",
  "accountability": "High",
  "longTermRelevance": "Weekly",
  "vulnerability": "General"
}

EDITORIAL FACTOR OPTIONS (pick the closest fit for each, based on the actual source material):
irreversibility: Reversible | Moderate | Irreversible — can this decision/event realistically be undone?
accountability: Low | Moderate | High | Exposing Corruption/Negligence — does this expose wrongdoing or hold power to account?
longTermRelevance: 24h Cycle | Weekly | Multi-Month | Generational — how long will this actually matter?
vulnerability: General | Targeted Group | Vulnerable / Marginalized — who bears the impact?`;

// ── Groq JSON response shape ──────────────────────────────────────────────────
interface GroqProcessedArticle {
  headline?:          string;
  standfirst?:        string;
  facts?:             string[];
  body?:              string;
  quote?:             string;
  speaker?:           string;
  verticalId?:        number;
  verticalName?:      string;
  subCategoryId?:     string;
  subCategoryName?:   string;
  subSubCategoryId?:  string;
  subSubCategoryName?:string;
  contentType?:       string;
  tags?:              string[];
  imageTerms?:        string;
  scale?:             string;
  severity?:          string;
  institution?:       string;
  [key: string]: unknown;
}

// ── Per-article synthesis cache (survives component re-renders) ───────────────
const cache = new Map<string, Article>();

// ── Count words in a string ───────────────────────────────────────────────────
function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// Guards against the model returning the JSON schema fields as the literal
// string "null" instead of an actual JSON null when it has no real quote.
function isRealString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().toLowerCase() !== 'null';
}

// ── Numeric-consistency guard ──────────────────────────────────────────────────
// Extracts monetary amounts and percentages likely to be load-bearing facts,
// normalized so cosmetic reformatting doesn't trigger a false mismatch.
function extractFigures(text: string): Set<string> {
  const figures = new Set<string>();

  // Capture amount and unit as SEPARATE groups — normalizing "cr" -> "crore"
  // on the isolated unit token avoids the word-boundary trap that a plain
  // substring replace falls into (digits and letters are both \w, so there's
  // never a \b between "100" and "cr"/"crore" to anchor a boundary-based fix).
  const moneyRe = /₹\s?([\d,]+(?:\.\d+)?)\s*(crore|cr|lakh|k|million|billion)?/gi;
  let m: RegExpExecArray | null;
  while ((m = moneyRe.exec(text))) {
    const amount = m[1].replace(/,/g, '');
    const unit   = (m[2] || '').toLowerCase() === 'cr' ? 'crore' : (m[2] || '').toLowerCase();
    figures.add(`₹${amount}${unit}`);
  }

  const percentRe = /(\d+(?:\.\d+)?)\s?%/g;
  let pm: RegExpExecArray | null;
  while ((pm = percentRe.exec(text))) {
    figures.add(`${pm[1]}%`);
  }

  return figures;
}

// Returns true if the rewrite introduces a monetary/percentage figure with no
// counterpart anywhere in the source — i.e. a plausible fabricated/altered
// number. Omitting a source figure in the rewrite is fine (compression);
// inserting a brand-new one is the risk this guards against. Conservative by
// design: only rejects on a genuinely new figure, never on reformatting.
function hasSuspiciousFigure(sourceText: string, rewrittenText: string): string | null {
  const sourceFigures = extractFigures(sourceText);
  if (sourceFigures.size === 0) return null; // nothing to cross-check against — don't block on it

  const rewrittenFigures = extractFigures(rewrittenText);
  for (const fig of rewrittenFigures) {
    if (!sourceFigures.has(fig)) return fig;
  }
  return null;
}

// ── Core synthesis function ───────────────────────────────────────────────────
export async function synthesizeRawArticle(raw: Article): Promise<Article> {
  if (cache.has(raw.id)) return cache.get(raw.id)!;

  const inputText = [raw.title, raw.subtitle, ...raw.bodyParagraphs]
    .filter(Boolean)
    .join(' ')
    .slice(0, 1200); // cap input to avoid token overflow

  const userMsg = `Rewrite this India news dispatch:
TITLE: ${raw.title}
CONTENT: ${inputText}
SOURCE: ${raw.externalSource || 'National Wire'}`;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:            GROQ_MODEL,
        messages:         [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
        temperature:      0.45,
        max_tokens:       900,
        response_format:  { type: 'json_object' },
        reasoning_effort: 'low',
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`[Groq] ${res.status} for "${raw.title.slice(0, 40)}"`);
      return raw;
    }

    const responseData = await res.json();
    const raw_content = responseData.choices?.[0]?.message?.content;
    if (!raw_content) { console.warn('[Groq] empty response'); return raw; }

    const p = JSON.parse(raw_content);
    const result = await applyGroqResult(raw, p);
    cache.set(raw.id, result);
    return result;

  } catch (err) {
    console.warn('[Groq] synthesis failed:', err);
    return raw;
  }
}

// ── Single-article system prompt (used by synthesizeRawArticle) ──────────────
// (SYSTEM_PROMPT defined above is already correct)

// ── Batch system prompt — 4 articles per Groq call ───────────────────────────
// Sending 4 articles in ONE call = 4× fewer API requests = 4× more throughput
// at the same 30 req/min rate limit.
const BATCH_SYSTEM_PROMPT = SYSTEM_PROMPT + `

BATCH MODE: You will receive multiple articles. Return a JSON object with a "results" array.
Each element in "results" corresponds to the article at the same index.
If an article is unclear, still return a valid object for it using the available information.`;

// ── Core result applier (shared between single and batch) ─────────────────────
async function applyGroqResult(raw: Article, p: GroqProcessedArticle | null): Promise<Article> {
  if (!p) return raw;

  const body = (p.body || '') as string;
  const wc = wordCount(body);
  if (wc < 15) return raw; // Groq returned garbage — keep raw

  // Fail safe on a suspected fabricated/altered figure — a rewrite introducing
  // a monetary amount or percentage with no counterpart anywhere in the
  // source is treated as unsafe and the raw article is kept instead. Checked
  // against the FULL original source (title + subtitle + body), not just
  // whatever the model was given as input, since raw.originalRaw (if already
  // set) is the authoritative pre-synthesis record.
  const sourceForCheck = raw.originalRaw
    ? [raw.originalRaw.title, raw.originalRaw.subtitle, ...raw.originalRaw.bodyParagraphs].join(' ')
    : [raw.title, raw.subtitle, ...raw.bodyParagraphs].join(' ');
  const suspiciousFigure = hasSuspiciousFigure(sourceForCheck, body);
  if (suspiciousFigure) {
    console.warn(`[Groq] rejected rewrite for "${raw.title.slice(0, 40)}" — figure "${suspiciousFigure}" has no counterpart in source`);
    return raw;
  }

  const trimmedBody = wc > 220
    ? body.split(/\s+/).slice(0, 200).join(' ') + '...'
    : body;

  const subCatId   = (p as any).subCategoryId   || '';
  const subCatName = (p as any).subCategoryName  || '';
  const subSubId   = (p as any).subSubCategoryId || '';
  const subSubName = (p as any).subSubCategoryName || '';

  const synthesized: Article = {
    ...raw,
    title:              (p as any).headline    || raw.title,
    subtitle:           (p as any).standfirst  || raw.subtitle,
    verticalId:         Number(p.verticalId)   || raw.verticalId  || 1,
    verticalName:       p.verticalName         || raw.verticalName || 'India / National',
    subCategoryId:      subCatId,
    subCategoryName:    subCatName,
    subSubCategoryId:   subSubId,
    subSubCategoryName: subSubName,
    taxonomyPath:       [p.verticalName, subCatName, subSubName].filter(Boolean).join(' → '),
    contentType:        (['NEWS','GROUND REPORT','ANALYSIS'].includes(p.contentType || '') ? (p.contentType as 'NEWS'|'GROUND REPORT'|'ANALYSIS') : raw.contentType),
    tags:               Array.isArray(p.tags) && p.tags.length ? p.tags : raw.tags,
    isGroqSynthesized:  true,
    // Set once, on the FIRST synthesis pass only — preserved unchanged on any
    // later re-synthesis so it always reflects what the wire actually said.
    originalRaw: raw.originalRaw || {
      title: raw.title,
      subtitle: raw.subtitle,
      bodyParagraphs: raw.bodyParagraphs,
    },
    author: {
      name:           raw.author?.name && raw.author.name !== 'National Wire' ? raw.author.name : 'RAWINDIA Intelligence Desk',
      role:           'Senior Correspondent',
      avatar:         raw.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      bio:            'No spin. No omission. Every claim sourced.',
      articlesCount:  340,
      accuracyScore:  99.4,
    },
    factBlock: {
      title:          'What Actually Happened (The Raw Fact Layer)',
      summary:        (p as any).standfirst || raw.subtitle,
      bullets:        Array.isArray((p as any).facts) && (p as any).facts.length >= 3 ? (p as any).facts.slice(0, 5) : raw.factBlock?.bullets || [],
      primarySources: raw.factBlock?.primarySources?.length ? raw.factBlock.primarySources : [`${raw.externalSource || 'National Wire'}`],
    },
    bodyParagraphs:  trimmedBody ? [trimmedBody] : raw.bodyParagraphs,
    quoteHighlight:  (isRealString((p as any).quote) && isRealString((p as any).speaker))
      ? { quote: (p as any).quote, speaker: (p as any).speaker, context: raw.title.slice(0, 60) }
      : raw.quoteHighlight,
    ranking: raw.ranking ? {
      ...raw.ranking,
      importanceFactors: {
        scaleOfImpact:             (['Local','State','National','Global'].includes((p as any).scale) ? (p as any).scale : (raw.ranking?.importanceFactors?.scaleOfImpact || 'National')) as 'Local'|'State'|'National'|'Global',
        severity:                  (['Minor','Moderate','High','Critical'].includes((p as any).severity) ? (p as any).severity : (raw.ranking?.importanceFactors?.severity || 'High')) as 'Minor'|'Moderate'|'High'|'Critical',
        institutionalSignificance: (['None','Municipal','State','National Constitutional'].includes((p as any).institution) ? (p as any).institution : (raw.ranking?.importanceFactors?.institutionalSignificance || 'State')) as 'None'|'Municipal'|'State'|'National Constitutional',
        // Previously always defaulted to a fixed value regardless of the
        // actual article — a permanent, non-differentiating 30% chunk of
        // the Importance axis. Now sourced from Groq the same way
        // scale/severity/institution already were, with the same
        // enum-validated fallback if it ever returns something unexpected.
        irreversibility:           (['Reversible','Moderate','Irreversible'].includes((p as any).irreversibility) ? (p as any).irreversibility : (raw.ranking?.importanceFactors?.irreversibility || 'Moderate')) as 'Reversible'|'Moderate'|'Irreversible',
        publicAccountabilityValue: (['Low','Moderate','High','Exposing Corruption/Negligence'].includes((p as any).accountability) ? (p as any).accountability : (raw.ranking?.importanceFactors?.publicAccountabilityValue || 'High')) as 'Low'|'Moderate'|'High'|'Exposing Corruption/Negligence',
        longTermRelevance:         (['24h Cycle','Weekly','Multi-Month','Generational'].includes((p as any).longTermRelevance) ? (p as any).longTermRelevance : (raw.ranking?.importanceFactors?.longTermRelevance || 'Weekly')) as '24h Cycle'|'Weekly'|'Multi-Month'|'Generational',
        vulnerabilityOfAffected:   (['General','Targeted Group','Vulnerable / Marginalized'].includes((p as any).vulnerability) ? (p as any).vulnerability : (raw.ranking?.importanceFactors?.vulnerabilityOfAffected || 'General')) as 'General'|'Targeted Group'|'Vulnerable / Marginalized',
      },
    } : undefined,
  };

  // Image: use RSS/API image if present, else fetch from curated pool
  const imgTags = [...(synthesized.tags || []), ...((p as any).imageTerms ? String((p as any).imageTerms).split(' ') : [])];
  const bestImg = await getImageForArticle({ ...synthesized, tags: imgTags });
  return stampArticleSections({ ...synthesized, heroImage: bestImg });
}

// ── BATCH synthesis — 4 articles per Groq call (4× throughput) ───────────────
// Rate math: 1 batch call per 2s = 30 calls/min × 4 articles = 120 articles/min
// vs old sequential: 30 articles/min. This is the key performance optimization.
export async function synthesizeBatch(articles: Article[], model: string = GROQ_MODEL): Promise<Article[]> {
  if (!articles.length) return [];

  // Check cache first — cached articles don't need a Groq call
  const uncached   = articles.filter(a => !cache.has(a.id) && !a.isGroqSynthesized);
  const fromCache  = articles.filter(a =>  cache.has(a.id) || a.isGroqSynthesized)
                             .map(a => cache.get(a.id) || a);

  if (!uncached.length) return [...fromCache, ...articles.filter(a => !fromCache.find(c => c.id === a.id))];

  // Build combined input for all uncached articles in one Groq call
  const inputText = uncached.map((art, i) => {
    const content = [art.subtitle, ...art.bodyParagraphs].filter(Boolean).join(' ').slice(0, 350);
    return `ARTICLE ${i + 1}:\nTITLE: ${art.title}\nCONTENT: ${content}\nSOURCE: ${art.externalSource || 'Wire'}`;
  }).join('\n\n---\n\n');

  const userMsg = `Rewrite these ${uncached.length} India news articles in RAWINDIA format.
Return JSON: {"results": [array of ${uncached.length} objects in the SAME ORDER as input]}
Each object needs: headline, standfirst, facts(5 items), body(100-200 words HARD LIMIT), quote, speaker, verticalId, verticalName, subCategoryId, subCategoryName, contentType, tags(4-6), imageTerms(3 keywords), scale, severity, institution, irreversibility, accountability, longTermRelevance, vulnerability

${inputText}`;

  try {
    const res = await fetch(GROQ_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages:         [{ role: 'system', content: BATCH_SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
        temperature:      0.45,
        max_tokens:       Math.min(8000, 950 * uncached.length), // Groq Llama3 limit is 8k, scale up to it safely
        response_format:  { type: 'json_object' },
        reasoning_effort: 'low',
      }),
      signal: AbortSignal.timeout(25_000), // batch takes longer
    });

    // 413 = request too large for Groq's per-request token/size cap. A 400
    // with code "json_validate_failed" is the same underlying problem in
    // disguise — the model ran out of its max_tokens budget mid-JSON on a
    // dense batch (gpt-oss spends some of that budget on hidden reasoning,
    // and a batch of several verbose articles can still overrun it). Both
    // are a function of how much we asked for in ONE call, not a transient
    // failure, so retrying the same batch verbatim would just fail again.
    let tokenExhausted = res.status === 413;
    if (res.status === 400) {
      const errBody = await res.clone().json().catch(() => null);
      tokenExhausted = errBody?.error?.code === 'json_validate_failed';
    }

    if (tokenExhausted) {
      // Shrink the batch instead: split in half and synthesize each half
      // independently. Recurses down to single-article batches, and a
      // single article that's STILL too large falls back to the dedicated
      // single-article endpoint (smaller, separately-tuned payload) rather
      // than looping forever on a batch of one.
      console.warn(`[Groq Batch] ${res.status} for a batch of ${uncached.length} — splitting and retrying smaller`);

      let splitResults: Article[] = [];
      if (uncached.length <= 1) {
        for (const a of uncached) {
          splitResults.push(await synthesizeRawArticle(a));
          await new Promise(r => setTimeout(r, 200));
        }
      } else {
        const mid = Math.ceil(uncached.length / 2);
        const firstHalf = await synthesizeBatch(uncached.slice(0, mid), model);
        await new Promise(r => setTimeout(r, 200));
        const secondHalf = await synthesizeBatch(uncached.slice(mid), model);
        splitResults = [...firstHalf, ...secondHalf];
      }

      splitResults.forEach(a => { if (a.isGroqSynthesized) cache.set(a.id, a); });
      return articles.map(orig =>
        splitResults.find(s => s.id === orig.id) ||
        fromCache.find(c => c.id === orig.id) ||
        orig
      );
    }

    if (!res.ok) {
      console.warn(`[Groq Batch] ${res.status} — falling back to raw`);
      return articles;
    }

    const data   = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    const results: GroqProcessedArticle[] = parsed.results || [];

    // Apply each result to its article
    const processed = await Promise.all(
      uncached.map((raw, i) => applyGroqResult(raw, results[i] || null))
    );

    // Update cache
    processed.forEach(a => { if (a.isGroqSynthesized) cache.set(a.id, a); });

    // Return all articles in original order
    return articles.map(orig =>
      processed.find(p => p.id === orig.id) ||
      fromCache.find(c => c.id === orig.id) ||
      orig
    );

  } catch (err) {
    console.warn('[Groq Batch] synthesis failed:', err);
    return articles;
  }
}

// ── Batch processor — fires all batches concurrently for minimum latency ─────
// Same total request count as before (one call per BATCH_SIZE articles); the
// only change is firing them in parallel instead of serially with a fixed
// sleep between each, which cuts wall-clock time roughly N-fold for N batches.
export async function processBatch(articles: Article[], maxCount = 8): Promise<Article[]> {
  const toProcess = articles.slice(0, maxCount);
  const rest      = articles.slice(maxCount);

  const batches: Article[][] = [];
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    batches.push(toProcess.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(batches.map(batch => synthesizeBatch(batch)));

  return [...results.flat(), ...rest];
}

