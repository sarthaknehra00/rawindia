/**
 * RAWINDIA — Local Read-Tracking (a REAL, narrow-scope engagement signal)
 *
 * Tracks genuine article opens in THIS browser only. This is not global
 * analytics and not a "Most Read" feature — it is never surfaced anywhere in
 * the UI. It exists solely so the ranking engine has one real signal to
 * consult instead of the fixed placeholder constant every article previously
 * received regardless of whether anyone had ever actually read it.
 *
 * An article this browser has genuinely opened more than once gets a small,
 * bounded nudge to its derived Interest signals (see rankingEngineService.ts).
 * An article nobody's opened yet gets the exact same honest fallback
 * constant as before this file existed — nothing is invented.
 *
 * Honest scope: this reflects real behavior in one browser, not site-wide
 * readership. Do not present it as, or extend it toward, "most read"/trending
 * UI without first building real server-side analytics.
 */

const DB_NAME = 'rawindia_engagement_db';
const DB_VERSION = 1;
const STORE = 'views';

// A repeat open of the same article within this window doesn't bump the
// count — otherwise a single reading session (open, scroll away, come back)
// would inflate the number without reflecting genuine renewed interest.
const REVIEW_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

interface ViewRecord {
  id: string;
  count: number;
  lastViewedAt: number; // epoch ms
}

let db: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;

// In-memory mirror so the (synchronous) ranking engine can read a count
// without awaiting IndexedDB on every scoring pass. Populated once from
// storage at module load, kept current thereafter by recordView().
const cache = new Map<string, ViewRecord>();

function openDB(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);
  if (dbOpenPromise) return dbOpenPromise;

  dbOpenPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const idb = (e.target as IDBOpenDBRequest).result;
      if (!idb.objectStoreNames.contains(STORE)) {
        idb.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => { db = (e.target as IDBOpenDBRequest).result; resolve(db); };
    req.onerror   = () => reject(req.error);
  });
  return dbOpenPromise;
}

/** Load every existing view record into the in-memory cache, once. */
async function loadCache(): Promise<void> {
  try {
    const idb = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx  = idb.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (!cursor) { resolve(); return; }
        const rec = cursor.value as ViewRecord;
        cache.set(rec.id, rec);
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // IndexedDB unavailable (private-browsing restrictions, etc.) — the
    // ranking engine's fallback constant already handles an empty cache
    // gracefully, so this degrades to "no local signal", not a crash.
    console.warn('[localEngagementService] could not load view cache:', err);
  }
}

// Kick off the cache load once, at module init (browser only). Anything that
// calls getViewCount() before this resolves just sees 0 — the same as "never
// viewed" — which is the correct, honest default while data is still loading.
if (typeof window !== 'undefined') {
  loadCache();
}

function persist(rec: ViewRecord): void {
  openDB()
    .then(idb => new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    }))
    .catch(err => console.warn('[localEngagementService] failed to persist view:', err));
}

/**
 * Record a genuine article open in this browser. Call this once when an
 * article page actually mounts/displays — see the wiring note in this
 * task's report for the one call site this needs adding to.
 */
export function recordView(articleId: string): void {
  if (!articleId) return;
  const now = Date.now();
  const existing = cache.get(articleId);

  if (existing && now - existing.lastViewedAt < REVIEW_WINDOW_MS) {
    return; // same reading session — don't inflate the count
  }

  const updated: ViewRecord = {
    id: articleId,
    count: (existing?.count ?? 0) + 1,
    lastViewedAt: now,
  };
  cache.set(articleId, updated);
  persist(updated);
}

/** Real, local-browser-only view count for an article. 0 if never viewed (or cache still loading). */
export function getViewCount(articleId: string): number {
  return cache.get(articleId)?.count ?? 0;
}
