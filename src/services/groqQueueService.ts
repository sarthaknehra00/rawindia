/**
 * RAWINDIA — Background Groq Synthesis Queue (Batch Edition)
 *
 * Processes 8 articles per Groq call using the fast GROQ_MODEL_FAST
 * tier (background synthesis doesn't need hero-level quality — the hero
 * articles get that treatment separately via processBatch/GROQ_MODEL).
 *
 * A SINGLE worker, once every 15s: 8 articles / 15s ≈ 32 articles/min.
 * This used to be two staggered workers firing every ~2s combined (~240
 * articles/min) — that maximized background-rewrite throughput, but it also
 * meant a real network call roughly every 2 seconds, continuously, for as
 * long as a backlog existed, which reads as constant network chatter on
 * anything watching. That throughput isn't actually needed anymore: the
 * on-demand synthesis in ArticleView.tsx already rewrites whatever a reader
 * actually opens, in real time, the moment they open it — this queue only
 * needs to eventually catch up the rest of the archive, not race to do it.
 */

import { synthesizeBatch, GROQ_MODEL_FAST } from './groqWriterService';
import { saveArticle } from './persistenceService';
import { getSpinPhrases } from './spinDecoderService';
import { ensureArticleEmbedded } from './archiveEmbeddingService';
import { extractFromArticle } from './promiseExtractionService';
import type { Article } from '../types';

const QUEUE_KEY    = 'RAWINDIA_GROQ_QUEUE_V2';
const DONE_KEY     = 'RAWINDIA_GROQ_DONE_V2';
const ARTICLEMAP_KEY = 'RAWINDIA_GROQ_ARTICLEMAP_V1';
const BATCH_SIZE   = 8;      // articles per Groq call
const WORKER_GAP   = 15000; // single worker fires every 15s
const MAX_FAILURES  = 3;    // per-article failure cap before permanently dropping it
const PERSIST_CAP   = 300;  // matches the queue's own persistence cap

type QueueListener = (article: Article, queueLength: number) => void;

class GroqQueueService {
  private queue:      string[]         = [];
  private doneSet:    Set<string>      = new Set();
  private articleMap: Map<string, Article> = new Map();
  private failureCounts: Map<string, number> = new Map();
  private listeners:  Set<QueueListener>   = new Set();
  private timer1:     ReturnType<typeof setInterval> | null = null;
  private running:    boolean = false;
  private processing: boolean = false; // mutex to avoid concurrent batch calls

  constructor() { this.load(); }

  private load() {
    try {
      const q = localStorage.getItem(QUEUE_KEY);
      const d = localStorage.getItem(DONE_KEY);
      const m = localStorage.getItem(ARTICLEMAP_KEY);
      if (q) this.queue   = JSON.parse(q);
      if (d) this.doneSet = new Set(JSON.parse(d));
      // Restore the actual Article objects for whatever's still queued —
      // without this, a page refresh silently drops every queued rewrite
      // job (the id survives in `queue`, but processBatchChunk has nothing
      // to send to Groq for it and just clears it out as orphaned).
      if (m) this.articleMap = new Map(JSON.parse(m));
    } catch { /* ignore */ }
  }

  private save() {
    try {
      const queueSlice = this.queue.slice(0, PERSIST_CAP);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queueSlice));
      localStorage.setItem(DONE_KEY, JSON.stringify(Array.from(this.doneSet).slice(-3000)));
      // Only persist article data for what's actually still queued (bounded
      // by PERSIST_CAP) — no point keeping orphaned entries around.
      const entries = queueSlice
        .map(id => [id, this.articleMap.get(id)] as const)
        .filter((e): e is [string, Article] => Boolean(e[1]));
      localStorage.setItem(ARTICLEMAP_KEY, JSON.stringify(entries));
    } catch { /* quota — same graceful no-op as queue/doneSet already had */ }
  }

  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(article: Article) {
    this.listeners.forEach(fn => { try { fn(article, this.queue.length); } catch { /**/ } });
  }

  enqueue(articles: Article[]) {
    let added = 0;
    for (const art of articles) {
      if (this.doneSet.has(art.id) || art.isGroqSynthesized) continue;
      if (this.queue.includes(art.id)) continue;
      this.articleMap.set(art.id, art);
      this.queue.push(art.id);
      added++;
    }
    if (added > 0) this.save();
    if (!this.running && this.queue.length > 0) this.start();
  }

  get pendingCount(): number { return this.queue.length; }

  start() {
    if (this.running) return;
    this.running = true;

    // Single worker, fires immediately at 0, 15s, 30s...
    this.timer1 = setInterval(() => {
      if (document.visibilityState !== 'hidden') this.processBatchChunk();
    }, WORKER_GAP);
  }

  stop() {
    if (this.timer1) { clearInterval(this.timer1);  this.timer1 = null; }
    this.running = false;
  }

  private async processBatchChunk() {
    if (this.queue.length === 0) { this.stop(); return; }
    if (this.processing) return; // previous batch still running — skip tick

    this.processing = true;
    try {
      // Take next BATCH_SIZE items from queue
      const ids      = this.queue.slice(0, BATCH_SIZE);
      const toSynth  = ids
        .map(id => this.articleMap.get(id))
        .filter((a): a is Article => Boolean(a));

      if (!toSynth.length) {
        // IDs in queue but no article data — clear them
        this.queue.splice(0, BATCH_SIZE);
        this.save();
        return;
      }

      // Call Groq with entire batch (1 API call = BATCH_SIZE articles)
      // using the fast model tier — background synthesis prioritizes speed.
      const results = await synthesizeBatch(toSynth, GROQ_MODEL_FAST);

      // Update queue state
      this.queue.splice(0, BATCH_SIZE);

      for (const synthesized of results) {
        if (!synthesized.isGroqSynthesized) continue; // Groq failed for this one
        this.doneSet.add(synthesized.id);
        this.articleMap.delete(synthesized.id);
        this.failureCounts.delete(synthesized.id);

        // Persist to IndexedDB
        saveArticle(synthesized).catch(() => {});

        // Background spin-scan — this is what feeds "Roast the Spin" and the
        // Institutional Report Card real history, not just whatever a reader
        // happens to manually click "Decode the Spin" on. Fire-and-forget:
        // never blocks this cycle, and getSpinPhrases already logs to the
        // ledger itself once it resolves.
        if (synthesized.quoteHighlight?.quote) {
          getSpinPhrases(synthesized.quoteHighlight.quote, {
            speaker:      synthesized.quoteHighlight.speaker,
            articleId:    synthesized.id,
            articleTitle: synthesized.title,
          }).catch(() => {});
        }

        // Background embedding — reused by promise-matching below (originally
        // built for the now-removed archive-chat feature).
        ensureArticleEmbedded(synthesized).catch(() => {});

        // Background promise/verdict extraction — feeds the Vaada Clock and
        // L/W Ledger review queue (see promiseExtractionService.ts). Same
        // fire-and-forget discipline; everything it writes lands ai-flagged
        // and stays invisible until a human clears it at /ops/review.
        extractFromArticle(synthesized).catch(() => {});

        // Notify UI
        this.notify(synthesized);
      }

      this.save();

    } catch (err) {
      console.warn('[Queue] batch error:', err);
      // Requeue the ENTIRE attempted batch (not just one id) — otherwise the
      // 7 other ids in a failed batch sit untouched at the front and get
      // re-attempted next tick almost unchanged, effectively wedging the
      // whole queue behind one bad batch. Each id's failure count is bumped;
      // past MAX_FAILURES it's dropped for good (added to doneSet, which
      // enqueue() already checks) instead of retrying forever.
      const ids = this.queue.slice(0, BATCH_SIZE);
      this.queue.splice(0, ids.length);

      const stillRetryable: string[] = [];
      for (const id of ids) {
        const failures = (this.failureCounts.get(id) ?? 0) + 1;
        if (failures > MAX_FAILURES) {
          console.warn(`[Queue] dropping ${id} after ${failures} failed synthesis attempts`);
          this.doneSet.add(id);
          this.articleMap.delete(id);
          this.failureCounts.delete(id);
        } else {
          this.failureCounts.set(id, failures);
          stillRetryable.push(id);
        }
      }
      this.queue.push(...stillRetryable);
      this.save();
    } finally {
      this.processing = false;
    }
  }

  clearQueue() {
    this.queue = [];
    this.doneSet.clear();
    this.articleMap.clear();
    this.failureCounts.clear();
    localStorage.removeItem(QUEUE_KEY);
    localStorage.removeItem(DONE_KEY);
    localStorage.removeItem(ARTICLEMAP_KEY);
    this.stop();
  }
}

export const groqQueue = new GroqQueueService();
