/**
 * RAWINDIA News Scheduler
 *
 * Two cycles, BOTH of which persist to IndexedDB (Timeline/Live Wire read
 * from that store exclusively, so anything that only lives in memory is
 * invisible to them):
 *  • FAST (90s)  — top-headlines + Currents only, single query, no Google
 *                  News fetch, no image cleanup — kept light so it stays
 *                  fast enough to run this often.
 *  • MAIN (10min) — full pipeline: fetch all 4 sources → filter → persist →
 *                   Groq queue → re-rank.
 *
 * Full (main) cycle sequence:
 *   1. Fetch from all sources (NewsAPI + Google News + Currents)
 *   2. Quality filter (junk removed, dedup against stored articles)
 *   3. Persist surviving articles to IndexedDB permanently
 *   4. Enqueue ALL for Groq rewrite (background queue)
 *   5. Notify subscribers with ranked article pool
 */

import { fetchLiveNews } from './newsApiService';
import { fetchGoogleNewsIndia } from './googleNewsService';
import { fetchRbiPressReleases } from './rbiNewsService';
import { saveArticles, getLatestArticles } from './persistenceService';
import { filterQualityArticles, deduplicateArticles } from './newsFilterService';
import { groqQueue } from './groqQueueService';
import { cleanupOldArticleImages } from './imageService';
import { stampArticleSections } from './sectionService';
import type { Article } from '../types';

export interface CronStatus {
  lastRunTime:     string;
  nextRunTime:     string;
  cycleCount:      number;
  isRunning:       boolean;
  autoGroqActive:  boolean;
  statusMessage:   string;
  intervalSeconds: number;
  totalStored:     number;
}

type NewsUpdateListener = (articles: Article[], isBackgroundCron: boolean) => void;

const FAST_INTERVAL_MS = 90_000;   // 90 seconds — ticker refresh
const MAIN_INTERVAL_MS = 600_000;  // 10 minutes — full pipeline

// India topic pool for rotating queries
const QUERY_POOL = [
  'India government parliament cabinet',
  'India Supreme Court high court judgment',
  'India economy RBI budget inflation',
  'India defense army border security',
  'ISRO space India science',
  'India technology AI startup unicorn',
  'India election BJP Congress politics',
  'India crime CBI ED investigation arrest',
  'India floods disaster cyclone relief',
  'India agriculture farmer MSP protest',
  'India Bollywood cricket IPL BCCI',
  'India foreign policy China Pakistan US',
  'India health education society reform',
  'India corporate business market merger',
];

class CronSchedulerService {
  private fastTimerId: number | null = null;
  private mainTimerId: number | null = null;
  private cycleCount      = 0;
  private lastRunTime     = '';
  private nextMainRunTime = '';
  private isRunning       = false;
  private autoGroqActive  = true;
  private totalStored     = 0;
  private lastFastCycleTime = 0;
  private lastMainCycleTime = 0;
  private listeners: Set<NewsUpdateListener> = new Set();

  constructor() { this.updateNextMainRunTime(); }

  subscribe(listener: NewsUpdateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(articles: Article[], isBackground: boolean) {
    this.listeners.forEach(fn => {
      try { fn(articles, isBackground); } catch { /* ignore */ }
    });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Kick off immediately
    this.runMainCycle();

    if (typeof window !== 'undefined') {
      // Fast ticker refresh every 90s
      this.fastTimerId = window.setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        this.runFastCycle();
      }, FAST_INTERVAL_MS);

      // Full pipeline every 15 minutes
      this.mainTimerId = window.setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        this.runMainCycle();
      }, MAIN_INTERVAL_MS);

      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  stop() {
    if (this.fastTimerId !== null) { clearInterval(this.fastTimerId); this.fastTimerId = null; }
    if (this.mainTimerId !== null) { clearInterval(this.mainTimerId); this.mainTimerId = null; }
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.isRunning = false;
  }

  async triggerManualRun(): Promise<void> {
    await this.runMainCycle();
  }

  toggleAutoGroq(): boolean {
    this.autoGroqActive = !this.autoGroqActive;
    return this.autoGroqActive;
  }

  private onVisibilityChange = () => {
    if (document.visibilityState !== 'visible' || !this.isRunning) return;
    // A backgrounded tab gets ZERO cron ticks at all (both interval callbacks
    // bail out while hidden) — so a tab left in the background for a while
    // can fall arbitrarily far behind. Catch up with a full pipeline run
    // immediately on refocus if it's been at least a main-cycle's worth of
    // time since the last one, rather than just re-running the fast cycle
    // and leaving IndexedDB stale until the next scheduled main-cycle tick
    // (which may itself be delayed/throttled after being backgrounded).
    if (Date.now() - this.lastMainCycleTime >= MAIN_INTERVAL_MS) {
      this.runMainCycle();
    } else {
      this.runFastCycle();
    }
  };

  /**
   * Fast cycle — refreshes the ticker AND persists fresh top-headlines to
   * IndexedDB every 90s. Previously this only pushed results to whatever
   * homepage tab was open in-memory (via notify()) without ever calling
   * saveArticles() — meaning Timeline/Live Wire, which read exclusively from
   * IndexedDB, could only ever be as fresh as the last MAIN cycle (10 min),
   * not the much more frequent fast ticker. Kept lighter than the main cycle
   * on purpose (single query, no Google News fetch, no image cleanup) so it
   * stays fast enough to run every 90s without becoming its own bottleneck.
   */
  private async runFastCycle() {
    // Guards against the setInterval tick and a visibilitychange event firing
    // near-simultaneously (e.g. a user backgrounds and quickly re-foregrounds
    // the tab right at a 90s tick boundary) — without this, both trigger
    // paths could each kick off a full 4-source fetchLiveNews at once.
    const now = Date.now();
    if (now - this.lastFastCycleTime < 10_000) return;
    this.lastFastCycleTime = now;

    try {
      const result = await fetchLiveNews('India', 'both');
      if (result.articles.length === 0) return;

      this.notify(result.articles, true);

      // Persist whatever's genuinely new so Timeline/Live Wire (IndexedDB
      // readers) see it too, not just an already-open homepage tab.
      const qualityPassed = filterQualityArticles(result.articles);
      const existing       = await getLatestArticles(500);
      const fresh          = deduplicateArticles(qualityPassed, existing);
      if (fresh.length === 0) return;

      const stamped = fresh.map(stampArticleSections);
      await saveArticles(stamped);
      this.totalStored += stamped.length;
      groqQueue.enqueue(stamped);
    } catch { /* silent */ }
  }

  /** Full 15-minute pipeline cycle */
  private async runMainCycle() {
    this.lastMainCycleTime = Date.now();
    this.lastRunTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
    this.cycleCount++;
    this.updateNextMainRunTime();

    try {
      const query = QUERY_POOL[this.cycleCount % QUERY_POOL.length];

      // ── 1. Fetch from all sources in parallel ──────────────────────────────
      const [newsApiResult, gnewsResult, rbiResult] = await Promise.allSettled([
        fetchLiveNews(query, 'both'),
        fetchGoogleNewsIndia(this.cycleCount, 4), // 4 topic feeds per cycle
        fetchRbiPressReleases(), // real gov't press releases with real PDF citations
      ]);

      const newsApiArts  = newsApiResult.status  === 'fulfilled' ? newsApiResult.value.articles : [];
      const gnewsArts    = gnewsResult.status    === 'fulfilled' ? gnewsResult.value            : [];
      const rbiArts      = rbiResult.status      === 'fulfilled' ? rbiResult.value              : [];
      const allIncoming  = [...newsApiArts, ...gnewsArts, ...rbiArts];

      if (allIncoming.length === 0) return;

      // ── 2. Quality filter ──────────────────────────────────────────────────
      const qualityPassed = filterQualityArticles(allIncoming);

      // ── 3. Deduplicate against what's already stored ───────────────────────
      const existing     = await getLatestArticles(500); // recent stored articles for dedup
      const fresh        = deduplicateArticles(qualityPassed, existing);

      if (fresh.length === 0) {
        // Nothing genuinely new this cycle. Notify with an empty array rather
        // than re-fetching the stored pool — subscribers treat any article
        // not already in their in-memory state as "new" (see App.tsx's
        // pendingArticles logic), so replaying the whole DB here would wrongly
        // resurrect old/out-of-band-saved articles (e.g. Guardian's background
        // historical backfill) as fresh wire hits. An empty notify still lets
        // subscribers re-rank their current pool for interest-decay.
        this.notify([], true);
        return;
      }

      // ── 4. Stamp section dates (IST) ──────────────────────────────────────
      const stamped = fresh.map(stampArticleSections);

      // ── 5. Persist raw articles immediately — never block a cycle on Groq ───
      await saveArticles(stamped);
      this.totalStored += stamped.length;

      // ── 6. Queue ALL articles for background Groq rewrite (fire-and-forget) ─
      // Queue processes in ranked order, so top-priority stories still get
      // rewritten first — just without holding up this cycle's notify().
      groqQueue.enqueue(stamped);

      // ── 7. Auto-cleanup old low-importance article images ──────────────────
      cleanupOldArticleImages().catch(() => { /* silent */ });

      // ── 8. Notify subscribers with just this cycle's genuinely new articles ─
      // NOT a full re-fetched pool — see the `fresh.length === 0` branch above
      // for why replaying the whole DB here mislabels old/already-stored
      // content as "new".
      this.notify(stamped, true);

    } catch (err) {
      console.warn('[RAWINDIA Cron]', err);
      // On error: nothing genuinely new to report this cycle.
      this.notify([], true);
    }
  }

  private updateNextMainRunTime() {
    const d          = new Date(Date.now() + MAIN_INTERVAL_MS);
    this.nextMainRunTime = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
  }

  getStatus(): CronStatus {
    return {
      lastRunTime:     this.lastRunTime     || 'Initializing...',
      nextRunTime:     this.nextMainRunTime || 'Calculating...',
      cycleCount:      this.cycleCount,
      isRunning:       this.isRunning,
      autoGroqActive:  this.autoGroqActive,
      statusMessage:   this.isRunning
        ? `Active — Full refresh every 10min · Ticker every 90s`
        : 'Paused',
      intervalSeconds: MAIN_INTERVAL_MS / 1000,
      totalStored:     this.totalStored,
    };
  }
}

export const cronScheduler = new CronSchedulerService();
