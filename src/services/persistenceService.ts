/**
 * RAWINDIA — Permanent Article Storage (IndexedDB)
 *
 * IndexedDB is the browser's built-in database engine:
 * - Stores GBs of data (vs localStorage's 5-10MB limit)
 * - Persists permanently — articles NEVER disappear
 * - Async, non-blocking — never freezes the UI
 * - Supports indexes for fast filtering by date, vertical, contentType
 *
 * Articles are stored once and updated in-place when Groq synthesizes them.
 * Nothing is ever deleted. This IS the backend.
 */

import type { Article } from '../types';

const DB_NAME    = 'rawindia_db';
const DB_VERSION = 4;
const STORE      = 'articles';
// v3 additions — see spinLedgerService.ts and archiveEmbeddingService.ts:
//  - SPIN_STORE:  one row per spin-phrase caught in an official quote, so
//    institutional accountability features (Roast the Spin, Institutional
//    Report Card) have real history to aggregate instead of starting empty.
//  - EMBED_STORE: one row per article's semantic embedding vector — originally
//    built for the now-removed "Chat With The Archive" chatbot, kept because
//    the embeddings themselves are genuinely reusable plumbing: see
//    promiseExtractionService.ts, which reuses this for candidate/existing-
//    promise matching instead of a fresh embedding scheme.
const SPIN_STORE  = 'spinLedger';
const EMBED_STORE = 'embeddings';
// v4 additions — Operation Vaada (see PROMISE_STORE/VERDICT_STORE below).
const PROMISE_STORE = 'promises';
const VERDICT_STORE = 'verdictEvents';

// Hard cap on total stored articles — without this, the one-year Guardian
// historical backfill (thousands of articles) plus continuous live ingestion
// grows this store unboundedly for the life of the browser profile. Generous
// relative to IndexedDB's much larger quota than localStorage's 5-10MB cap.
const MAX_STORED_ARTICLES = 5000;
// Pruning does a count() + cursor delete pass — cheap, but not free. Only
// check every Nth write rather than on every single save.
const PRUNE_CHECK_EVERY = 20;

// Singleton DB connection
let db: IDBDatabase | null = null;
let writesSinceLastPruneCheck = 0;

/** Delete the oldest records (by publishedAt) beyond MAX_STORED_ARTICLES. */
async function pruneIfOverCap(): Promise<void> {
  try {
    const total = await getArticleCount();
    const over  = total - MAX_STORED_ARTICLES;
    if (over <= 0) return;

    const idb = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx    = idb.transaction(STORE, 'readwrite');
      const index = tx.objectStore(STORE).index('publishedAt');
      let deleted = 0;
      // Ascending cursor over publishedAt = oldest first.
      const req = index.openCursor(null, 'next');
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (!cursor || deleted >= over) return;
        cursor.delete();
        deleted++;
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[persistenceService] prune-over-cap failed:', err);
  }
}

function openDB(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const idb = (e.target as IDBOpenDBRequest).result;

      // Drop old store if upgrading
      if (idb.objectStoreNames.contains(STORE)) idb.deleteObjectStore(STORE);

      const store = idb.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('publishedAt',  'publishedAt',  { unique: false });
      store.createIndex('verticalId',   'verticalId',   { unique: false });
      store.createIndex('contentType',  'contentType',  { unique: false });
      store.createIndex('isGroqSynthesized', 'isGroqSynthesized', { unique: false });

      // v3 stores — additive only, never dropped on upgrade (unlike the
      // articles store above, which is cheap to re-fetch; the spin ledger
      // and embeddings are the whole point of being durable over time).
      if (!idb.objectStoreNames.contains(SPIN_STORE)) {
        const spin = idb.createObjectStore(SPIN_STORE, { keyPath: 'id', autoIncrement: true });
        spin.createIndex('speaker', 'speaker', { unique: false });
      }
      if (!idb.objectStoreNames.contains(EMBED_STORE)) {
        idb.createObjectStore(EMBED_STORE, { keyPath: 'articleId' });
      }
      if (!idb.objectStoreNames.contains(PROMISE_STORE)) {
        const promises = idb.createObjectStore(PROMISE_STORE, { keyPath: 'id' });
        promises.createIndex('subjectName', 'subjectName', { unique: false });
        promises.createIndex('trustTier',   'trustTier',   { unique: false });
      }
      if (!idb.objectStoreNames.contains(VERDICT_STORE)) {
        const verdicts = idb.createObjectStore(VERDICT_STORE, { keyPath: 'id' });
        verdicts.createIndex('subjectName', 'subjectName', { unique: false });
        verdicts.createIndex('trustTier',   'trustTier',   { unique: false });
      }
    };

    req.onsuccess = (e) => {
      db = (e.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    req.onerror = () => reject(req.error);
  });
}

// ── Write ─────────────────────────────────────────────────────────────────────

/** Maybe run the over-cap prune check (throttled — not on every write). */
function maybePrune(): void {
  writesSinceLastPruneCheck++;
  if (writesSinceLastPruneCheck < PRUNE_CHECK_EVERY) return;
  writesSinceLastPruneCheck = 0;
  pruneIfOverCap().catch(() => { /* already logged inside pruneIfOverCap */ });
}

/**
 * Upsert a single article (insert or update by id).
 *
 * Never rejects — a write failure (e.g. quota exceeded) is logged and
 * swallowed here rather than left as a rejection callers might not catch.
 * Many existing call sites already do `.catch(() => {})`; making that the
 * guaranteed default at the source is more robust than relying on every
 * caller remembering to handle it.
 */
export async function saveArticle(article: Article): Promise<void> {
  try {
    const idb = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx    = idb.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.put(article);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
    maybePrune();
  } catch (err) {
    console.warn('[persistenceService] saveArticle failed:', err);
  }
}

/** Upsert many articles at once (batch transaction — fast). Never rejects — see saveArticle. */
export async function saveArticles(articles: Article[]): Promise<void> {
  if (!articles.length) return;
  try {
    const idb = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx    = idb.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      articles.forEach(a => store.put(a));
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
    maybePrune();
  } catch (err) {
    console.warn('[persistenceService] saveArticles failed:', err);
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Total article count */
export async function getArticleCount(): Promise<number> {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = idb.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/** Fetch the latest N articles sorted by publishedAt DESC */
export async function getLatestArticles(limit: number = 100, offset: number = 0): Promise<Article[]> {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx      = idb.transaction(STORE, 'readonly');
    const index   = tx.objectStore(STORE).index('publishedAt');
    const results: Article[] = [];
    let   skipped = 0;

    // IDBKeyRange: null = no bound. 'prev' = descending (newest first)
    const req = index.openCursor(null, 'prev');

    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor || results.length >= limit) {
        resolve(results);
        return;
      }
      if (skipped < offset) {
        skipped++;
        cursor.continue();
        return;
      }
      results.push(cursor.value as Article);
      cursor.continue();
    };

    req.onerror = () => reject(req.error);
  });
}

/** Fetch articles for a specific vertical */
export async function getArticlesByVertical(verticalId: number, limit: number = 50): Promise<Article[]> {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = idb.transaction(STORE, 'readonly');
    const index = tx.objectStore(STORE).index('verticalId');
    const range = IDBKeyRange.only(verticalId);
    const results: Article[] = [];

    const req = index.openCursor(range, 'prev');
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor || results.length >= limit) { resolve(results); return; }
      results.push(cursor.value as Article);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/** Fetch articles published on a specific date (YYYY-MM-DD) */
export async function getArticlesByDate(dateStr: string, limit: number = 100): Promise<Article[]> {
  const all = await getLatestArticles(5000); // fetch all, filter in JS (fast enough)
  return all.filter(a => a.publishedAt.startsWith(dateStr)).slice(0, limit);
}

/** Search articles by keyword in title/subtitle */
export async function searchArticles(keyword: string, limit: number = 50): Promise<Article[]> {
  const kw  = keyword.toLowerCase();
  const all = await getLatestArticles(5000);
  return all
    .filter(a =>
      a.title.toLowerCase().includes(kw) ||
      (a.subtitle || '').toLowerCase().includes(kw) ||
      a.tags.some(t => t.toLowerCase().includes(kw))
    )
    .slice(0, limit);
}

/** Fetch one article by ID */
export async function getArticleById(id: string): Promise<Article | null> {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = idb.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

/** Check if an article ID already exists */
export async function articleExists(id: string): Promise<boolean> {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = idb.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count(id);
    req.onsuccess = () => resolve(req.result > 0);
    req.onerror   = () => reject(req.error);
  });
}

// ── Spin Ledger (Roast the Spin / Institutional Report Card) ──────────────────
// Append-only — never edited or deduped after the fact, so the leaderboard's
// history stays honest even as the underlying article ages out of the
// articles store's MAX_STORED_ARTICLES cap.

export interface SpinEvent {
  id?: number;          // autoIncrement key, absent until first saved
  speaker: string;      // e.g. "CCEA Spokesperson" — same identity used for institution profiles
  term: string;         // exact phrase as spoken
  translation: string;  // plain-English meaning
  articleId: string;
  articleTitle: string;
  timestamp: string;    // ISO — when this was recorded, not when the quote was originally given
}

/** Never rejects — a failed write here shouldn't break the reader-facing Spin Decoder call it rides along with. */
export async function logSpinEvent(entry: Omit<SpinEvent, 'id'>): Promise<void> {
  try {
    const idb = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(SPIN_STORE, 'readwrite');
      tx.objectStore(SPIN_STORE).add(entry);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[persistenceService] logSpinEvent failed:', err);
  }
}


export async function clearAllSpinEvents(): Promise<void> {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(SPIN_STORE, 'readwrite');
    const req = tx.objectStore(SPIN_STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllSpinEvents(): Promise<SpinEvent[]> {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = idb.transaction(SPIN_STORE, 'readonly');
    const req = tx.objectStore(SPIN_STORE).getAll();
    req.onsuccess = () => resolve(req.result as SpinEvent[]);
    req.onerror   = () => reject(req.error);
  });
}

// ── Archive Embeddings (Chat With The Archive) ────────────────────────────────

export interface ArticleEmbedding {
  articleId: string;
  vector: number[];
  excerpt: string; // stored alongside the vector so retrieval doesn't need a second article lookup
  title: string;
  slugId: string;  // pre-built article slug-id for a direct citation link
}

export async function saveEmbedding(entry: ArticleEmbedding): Promise<void> {
  try {
    const idb = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(EMBED_STORE, 'readwrite');
      tx.objectStore(EMBED_STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[persistenceService] saveEmbedding failed:', err);
  }
}

export async function hasEmbedding(articleId: string): Promise<boolean> {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = idb.transaction(EMBED_STORE, 'readonly');
    const req = tx.objectStore(EMBED_STORE).count(articleId);
    req.onsuccess = () => resolve(req.result > 0);
    req.onerror   = () => reject(req.error);
  });
}

export async function getAllEmbeddings(): Promise<ArticleEmbedding[]> {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = idb.transaction(EMBED_STORE, 'readonly');
    const req = tx.objectStore(EMBED_STORE).getAll();
    req.onsuccess = () => resolve(req.result as ArticleEmbedding[]);
    req.onerror   = () => reject(req.error);
  });
}

// ── Operation Vaada: Promises & Verdicts ───────────────────────────────────────
// Both stores share one "trust tier" gate: anything an LLM proposed lands as
// 'ai-flagged' and is invisible to every reader-facing view (Vaada Clock, L/W
// Ledger, Netaji Report Card) — only /ops/review can flip a record to
// 'verified', which is the only tier those views ever query for. There is no
// separate "review queue" store; the queue IS just the ai-flagged rows of
// these same two stores, filtered client-side. See PRD §9-10.

export type TrustTier = 'ai-flagged' | 'verified';
export type PromiseStatus = 'kept' | 'broken' | 'extended' | 'stalled' | 'in-progress';

export interface PromiseExtension {
  from:        string; // ISO date — the deadline being replaced
  to:          string; // ISO date — the new deadline
  extendedOn:  string; // ISO date — when this extension was reported
  sourceUrl:   string;
}

export interface TrackedPromise {
  id:               string;
  subjectName:      string;
  promiseText:      string;
  category:         string;
  originalDeadline: string;          // ISO date — never overwritten, the clock's zero point
  currentDeadline:  string;          // ISO date — latest active deadline
  extensionHistory: PromiseExtension[];
  status:           PromiseStatus;
  evidenceLinks:    string[];        // non-empty required before a reader-facing view will render it
  sourceExcerpt:    string;          // the article text the extraction was drawn from — shown in the review queue
  articleId:        string;
  trustTier:        TrustTier;
  createdAt:        string;
  // Reuses the embedding infrastructure originally built for the now-removed
  // archive-chat feature (see archiveEmbeddingService.ts) so a later article
  // mentioning this same promise can be matched to it by semantic similarity
  // instead of exact-string matching on subjectName/promiseText.
  matchVector?:     number[];
}

export interface VerdictEvent {
  id:            string;
  headline:      string;
  verdict:       'W' | 'L';
  subjectName:   string;   // who/what the verdict favors or costs — the AFFECTED party, e.g. "Home and Auto Loan Borrowers"
  // Who actually MADE the decision — a leader or institution, e.g. "Reserve Bank of India". Separate from
  // subjectName on purpose: the L/W Ledger's own framing ("who this favors/costs") and the Netaji Report
  // Card's framing ("who is accountable") are different questions about the same event, and conflating them
  // meant almost nothing ever matched the Accountability Roster — see institutionLedgerService.ts. Optional
  // and falls back to subjectName when absent, since some older/cron-extracted records already put the
  // institution directly in subjectName.
  actorName?:    string;
  sourceUrl:     string;
  sourceExcerpt: string;
  articleId:     string;
  trustTier:     TrustTier;
  createdAt:     string;
}

export async function savePromise(entry: TrackedPromise): Promise<void> {
  try {
    const idb = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(PROMISE_STORE, 'readwrite');
      tx.objectStore(PROMISE_STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[persistenceService] savePromise failed:', err);
  }
}

export async function getAllPromises(): Promise<TrackedPromise[]> {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = idb.transaction(PROMISE_STORE, 'readonly');
    const req = tx.objectStore(PROMISE_STORE).getAll();
    req.onsuccess = () => resolve(req.result as TrackedPromise[]);
    req.onerror   = () => reject(req.error);
  });
}

export async function deletePromise(id: string): Promise<void> {
  try {
    const idb = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(PROMISE_STORE, 'readwrite');
      tx.objectStore(PROMISE_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[persistenceService] deletePromise failed:', err);
  }
}

export async function saveVerdictEvent(entry: VerdictEvent): Promise<void> {
  try {
    const idb = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(VERDICT_STORE, 'readwrite');
      tx.objectStore(VERDICT_STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[persistenceService] saveVerdictEvent failed:', err);
  }
}

export async function getAllVerdictEvents(): Promise<VerdictEvent[]> {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = idb.transaction(VERDICT_STORE, 'readonly');
    const req = tx.objectStore(VERDICT_STORE).getAll();
    req.onsuccess = () => resolve(req.result as VerdictEvent[]);
    req.onerror   = () => reject(req.error);
  });
}

export async function deleteVerdictEvent(id: string): Promise<void> {
  try {
    const idb = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(VERDICT_STORE, 'readwrite');
      tx.objectStore(VERDICT_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[persistenceService] deleteVerdictEvent failed:', err);
  }
}
