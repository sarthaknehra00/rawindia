import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import type { ActiveTab, Article } from './types';
import { INITIAL_ARTICLES } from './data/articlesData';
import { TAXONOMY_DATA } from './data/taxonomyData';
import { fetchLiveNews, ingestArticles, updateArticleInArchive } from './services/newsApiService';
import { processBatch } from './services/groqWriterService';
import { fetchGoogleNewsIndia } from './services/googleNewsService';
import { loadFullYearHistory } from './services/guardianNewsService';
import { groqQueue } from './services/groqQueueService';
import { saveArticles, saveArticle, getLatestArticles } from './services/persistenceService';
import { filterQualityArticles } from './services/newsFilterService';
import { cleanupOldArticleImages } from './services/imageService';
import { stampArticleSections } from './services/sectionService';
import { cronScheduler } from './services/cronSchedulerService';
import { rankArticles } from './services/rankingEngineService';
import { seedLedgerIfNeeded } from './services/ledgerSeedService';
import { seedRosterIfNeeded } from './services/rosterService';
import { useDocumentMeta } from './hooks/useDocumentMeta';
import { recordView } from './services/localEngagementService';
import { pathToTab, verticalIdFromPath, verticalToPath, articleToSlugId, resolveArticleFromSlugId } from './utils/routing';
import { Header } from './components/Header';
import { BreakingTicker } from './components/BreakingTicker';
import { TaxonomyNav } from './components/TaxonomyNav';
import { HeroStory } from './components/HeroStory';
import { ArticleView } from './components/ArticleView';
import { LiveBlogView } from './components/LiveBlogView';
// Code-split: rare/secondary views and modals don't need to ship in the
// initial bundle — only the primary nav-adjacent components above do.
const LiveFeedView = lazy(() => import('./components/LiveFeedView').then(m => ({ default: m.LiveFeedView })));
const TimelineView = lazy(() => import('./components/TimelineView').then(m => ({ default: m.TimelineView })));
const SectionFeedView = lazy(() => import('./components/SectionFeedView').then(m => ({ default: m.SectionFeedView })));
const TaxonomyExplorer = lazy(() => import('./components/TaxonomyExplorer').then(m => ({ default: m.TaxonomyExplorer })));
const TagFeedView = lazy(() => import('./components/TagFeedView').then(m => ({ default: m.TagFeedView })));
const InstitutionsView = lazy(() => import('./components/InstitutionsView').then(m => ({ default: m.InstitutionsView })));
const InstitutionProfileView = lazy(() => import('./components/InstitutionProfileView').then(m => ({ default: m.InstitutionProfileView })));
const SearchModal = lazy(() => import('./components/SearchModal').then(m => ({ default: m.SearchModal })));
const EditorialStandardModal = lazy(() => import('./components/EditorialStandardModal').then(m => ({ default: m.EditorialStandardModal })));
const RankingInspectorModal = lazy(() => import('./components/RankingInspectorModal').then(m => ({ default: m.RankingInspectorModal })));
const LedgerView = lazy(() => import('./components/LedgerView').then(m => ({ default: m.LedgerView })));
const AdminDashboardView = lazy(() => import('./components/AdminDashboardView').then(m => ({ default: m.AdminDashboardView })));
import { Footer } from './components/Footer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ArticleSkeleton } from './components/skeletons';
import { ArrowUp } from 'lucide-react';
import './styles/index.css';

const DEFAULT_DESCRIPTION = 'RAWINDIA reports Indian and India-related news with zero sugar-coating. Facts first, source transparency ledger, and exhaustive 16-vertical 3-level taxonomy.';

const TAB_TITLES: Record<ActiveTab, string> = {
  home: 'RAWINDIA — The Raw Truth | 100% Raw. 100% Real. No Spin.',
  taxonomy: 'Explore Verticals — RAWINDIA',
  live: 'Live Wire — RAWINDIA',
  timeline: 'Timeline — Chronological Feed — RAWINDIA',
  today: "Today's Top News — RAWINDIA",
  week: "This Week's Top News — RAWINDIA",
  month: "This Month's Top News — RAWINDIA",
  specials: 'RAWINDIA',
  article: 'RAWINDIA',
  standards: 'Editorial Standards — RAWINDIA',
};

// Shared Suspense fallback for lazy-loaded routes/modals — reuses the same
// centered, uppercase, pulsing label-caps treatment as ArticleRoute's own
// "still loading" state, rather than a foreign spinner graphic.
const LoadingFallback: React.FC = () => (
  <div className="max-w-2xl mx-auto px-margin-mobile md:px-margin-desktop py-24 text-center">
    <p className="font-label-caps text-label-caps uppercase text-on-surface-variant animate-pulse">Loading…</p>
  </div>
);

// Guards the initial-load effect below against StrictMode's dev-mode double-
// invoke — module-level (not a ref) so it survives the double-mount itself.
// Without this, every page load fired two full initial fetch passes (10
// concurrent rss2json requests instead of 5, double Groq queue enqueues,
// double saveArticles calls), which combined with our own low-per-minute
// rss2json proxy limit made that endpoint start 429ing on ordinary reloads.
let initialLiveLoadInFlight = false;

export const App: React.FC = () => (
  <BrowserRouter>
    <AppInner />
  </BrowserRouter>
);

const AppInner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // activeTab / selectedVerticalId are DERIVED from the route — the URL is
  // the single source of truth, not mirrored state that could drift from it.
  const activeTab: ActiveTab = pathToTab(location.pathname);
  const selectedVerticalId: number | null = verticalIdFromPath(location.pathname);

  // Scored and ranked articles pool
  const [articles, setArticles] = useState<Article[]>(() => rankArticles(INITIAL_ARTICLES, 'default'));
  // Flips true once the first real data pass (IndexedDB restore) settles —
  // used to tell "article not found because still loading" apart from
  // "article not found because it's a bad/expired link" (see ArticleRoute).
  const [dataReady, setDataReady] = useState(false);

  // "New stories available" notification
  const [pendingNewCount, setPendingNewCount] = useState<number>(0);
  const [pendingArticles, setPendingArticles] = useState<Article[]>([]);

  // True when neither the local archive nor any live source produced anything —
  // means what's on screen is fallback seed/demo content, not real news. Shown
  // as an honest banner instead of silently passing off demo data as live.
  const [liveFetchFailed, setLiveFetchFailed] = useState(false);

  const [historyProgress, setHistoryProgress] = useState<{ done: number; total: number } | null>(null);

  // "Back to top" visibility — appears once the reader has scrolled past the
  // header/nav/hero area, same threshold convention used across major
  // news sites for this control.
  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Modals
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [standardsOpen, setStandardsOpen] = useState<boolean>(false);
  const [inspectingRankingArticle, setInspectingRankingArticle] = useState<Article | null>(null);

  // Default per-tab <title>/meta — overridden by ArticleRoute/SectionRoute's
  // own useDocumentMeta call (child effects run after this one, so the more
  // specific title wins whenever one applies).
  useDocumentMeta({ title: TAB_TITLES[activeTab] || 'RAWINDIA', description: DEFAULT_DESCRIPTION });

  // One-time purge of old archives + run image cleanup on startup
  useEffect(() => {
    ['RAWINDIA_NEWS_ARCHIVE_V1', 'RAWINDIA_NEWS_ARCHIVE_V2'].forEach(k => localStorage.removeItem(k));
    cleanupOldArticleImages().catch(() => {});
  }, []);

  // One-time seed of researched L/W Ledger + Vaada Clock data — see
  // ledgerSeedService.ts for why this is 'verified' directly rather than
  // going through the ai-flagged review queue.
  useEffect(() => {
    seedLedgerIfNeeded().catch(() => {});
  }, []);

  // One-time seed of the researched Accountability Roster (Netaji Report
  // Card) — same self-limiting shared-store pattern as the ledger seed above.
  useEffect(() => {
    seedRosterIfNeeded().catch(() => {});
  }, []);

  // One-time cleanup: earlier builds persisted a language/theme preference —
  // drop any leftover keys so a returning visitor's browser doesn't carry
  // stale localStorage state for a feature that no longer exists.
  useEffect(() => {
    localStorage.removeItem('rawindia_lang');
    localStorage.removeItem('rawindia_theme');
    document.documentElement.setAttribute('data-theme', 'newspaper');
    document.documentElement.classList.remove('dark');
  }, []);

  // Initial live news load & Start Cron Job
  useEffect(() => {
    // 1. Immediately fetch real-time live news on startup
    const loadInitialLive = async () => {
      if (initialLiveLoadInFlight) return; // StrictMode dev double-invoke
      initialLiveLoadInFlight = true;
      try {
        // ── Phase 0: Restore IndexedDB instantly — NO waiting ─────────────────
        // User sees content in <100ms. Everything else is background.
        const stored = await getLatestArticles(300);
        if (stored.length > 0) setArticles(rankArticles(stored, 'default'));
        setDataReady(true);

        // ── Phase 1: Fetch fresh articles (non-blocking — show raw immediately) ─
        // Google News: 5 topics on initial load, not all 15 at once — that used
        // to fire 15 concurrent rss2json requests on every single page load.
        // The remaining topics still get covered; the main 10-minute cron cycle
        // rotates through the full topic pool over time regardless.
        const [apiResult, gnewsResult] = await Promise.allSettled([
          fetchLiveNews('India', 'both'),
          fetchGoogleNewsIndia(0, 5),
        ]);

        const newsApiArts = apiResult.status   === 'fulfilled' ? apiResult.value.articles : [];
        const googleArts  = gnewsResult.status === 'fulfilled' ? gnewsResult.value        : [];
        const fresh = filterQualityArticles([...newsApiArts, ...googleArts]).map(stampArticleSections);

        // Nothing cached locally AND nothing came back live — what's showing
        // is fallback seed data, not real news. Say so.
        setLiveFetchFailed(stored.length === 0 && fresh.length === 0);

        if (fresh.length > 0) {
          // Show raw articles IMMEDIATELY — no waiting for Groq
          await saveArticles(fresh);
          const withFresh = await getLatestArticles(300);
          setArticles(rankArticles(withFresh, 'default'));

          // ── Phase 2: Batch synthesize top 8 in background (non-blocking) ────
          // processBatch runs asynchronously — UI stays responsive
          processBatch(fresh, 8).then(async rewritten => {
            await saveArticles(rewritten);
            const updated = await getLatestArticles(300);
            setArticles(rankArticles(updated, 'default'));
          }).catch(() => {});

          // Queue everything else for background synthesis
          groqQueue.enqueue(fresh.slice(8));
        }

        // ── Phase 3: Guardian 1-year history — purely background ──────────────
        loadFullYearHistory(async (batch, progress) => {
          setHistoryProgress(progress);
          if (batch.length > 0) {
            const quality = filterQualityArticles(batch);
            if (quality.length > 0) {
              await saveArticles(quality);
              // Deliberately NOT enqueued for background Groq rewrite — see
              // ingestArticles()'s comment in newsApiService.ts. Historical
              // archive articles synthesize on-demand instead, in ArticleView.
              ingestArticles(quality);
              const all = await getLatestArticles(300);
              setArticles(rankArticles(all, 'default'));
            }
          }
          if (progress.done >= progress.total) setTimeout(() => setHistoryProgress(null), 4000);
        }).catch(() => {});

      } catch (err) {
        console.warn('Initial load error:', err);
        setDataReady(true);
        setLiveFetchFailed(true);
      } finally {
        initialLiveLoadInFlight = false;
      }
    };

    // Subscribe to Groq queue — debounced to avoid re-ranking 4× per second
    let pendingUpdates: Article[] = [];
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const flushUpdates = () => {
      if (!pendingUpdates.length) return;
      const batch = [...pendingUpdates];
      pendingUpdates = [];
      updateArticleInArchive(batch[batch.length - 1]); // update archive with last
      setArticles(prev => {
        const map = new Map(batch.map(a => [a.id, a]));
        return rankArticles(prev.map(a => map.get(a.id) || a), 'default');
      });
    };

    const unsubQueue = groqQueue.subscribe((synthesizedArt) => {
      pendingUpdates.push(synthesizedArt);
      if (debounceTimer) clearTimeout(debounceTimer);
      // Flush after 600ms of silence — smooth batched UI updates
      debounceTimer = setTimeout(flushUpdates, 600);
    });

    loadInitialLive();

    // 2. Start cron scheduler for background updates
    cronScheduler.start();

    const unsubscribe = cronScheduler.subscribe((newArticles, isBackgroundCron) => {
      if (newArticles.length > 0) setLiveFetchFailed(false);
      setArticles((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newToAdd = newArticles.filter((a) => !existingIds.has(a.id));

        // If background cron and user is on home tab, show "new stories" banner instead of silently swapping
        if (isBackgroundCron && newToAdd.length > 0) {
          setPendingArticles(queued => {
            const qIds = new Set(queued.map(a => a.id));
            const fresh = newToAdd.filter(a => !qIds.has(a.id));
            if (fresh.length > 0) setPendingNewCount(c => c + fresh.length);
            return [...fresh, ...queued];
          });
          return prev; // Don't inject yet — wait for user to click
        }

        const combined = [...newToAdd, ...prev];
        return rankArticles(combined, 'default');
      });
    });

    return () => {
      unsubscribe();
      unsubQueue();
      cronScheduler.stop();
    };
  }, []);

  const handleLoadNewStories = () => {
    setArticles(prev => {
      const combined = [...pendingArticles, ...prev];
      return rankArticles(combined, 'default');
    });
    setPendingNewCount(0);
    setPendingArticles([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectArticle = (article: Article) => {
    navigate(`/article/${articleToSlugId(article)}`, { state: article });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Called by ArticleView once its on-open, on-demand Groq synthesis
  // resolves (used for archive/historical articles that were deliberately
  // never bulk-queued — see ingestArticles()'s comment). Same "update
  // archive + persist + re-rank" pattern as the background queue's own
  // flushUpdates, just triggered by a single instant read instead of a
  // shared queue tick.
  const handleArticleSynthesized = (synthesized: Article) => {
    updateArticleInArchive(synthesized);
    saveArticle(synthesized).catch(() => {});
    setArticles(prev => rankArticles(prev.map(a => a.id === synthesized.id ? synthesized : a), 'default'));
  };

  const handleSelectTab = (tab: ActiveTab) => {
    if (tab === 'standards') { setStandardsOpen(true); return; }
    if (tab === 'home') { navigate('/'); return; }
    if (tab === 'taxonomy') { return; } // taxonomy always arrives paired with a vertical id — see handleSelectVertical
    navigate(`/${tab}`);
  };

  const handleSelectVertical = (id: number | null) => {
    navigate(verticalToPath(id));
  };

  // Main Lead Story: #1 ranked (live) article
  const heroArticle = articles[0] || INITIAL_ARTICLES[0];
  const sideArticles = articles.slice(1);
  // P0 tier can be reached via the Importance Floor Override regardless of
  // recency (by design, for homepage-lead ranking — see rankingEngineService.ts).
  // A live blog is inherently a current/ongoing event, but a P0/breaking/wire
  // article that's actually old (e.g. from the 1-year historical archive)
  // should never populate the "BREAKING" ticker just because it tripped the
  // floor override — gate ticker eligibility on recency, separately from tier.
  const BREAKING_TICKER_MAX_AGE_MS = 72 * 60 * 60 * 1000;
  const breakingArticles = articles.filter((a) => {
    if (a.isLiveBlog) return true;
    const isRecent = Date.now() - new Date(a.publishedAt).getTime() < BREAKING_TICKER_MAX_AGE_MS;
    return isRecent && (a.ranking?.priorityTier === 'P0' || a.isBreaking || a.isExternalApi);
  });

  return (
    <ErrorBoundary>
    <div className="bg-surface text-on-surface font-body-sm min-h-screen flex flex-col antialiased">
      {/* 1. Masthead Header */}
      <Header
        activeTab={activeTab}
        selectedVerticalId={selectedVerticalId}
        onSelectTab={handleSelectTab}
        onSelectVertical={handleSelectVertical}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenStandards={() => setStandardsOpen(true)}
      />

      {/* Honest "couldn't reach live sources" state — never silently pass off demo content as live */}
      {liveFetchFailed && (
        <div className="w-full bg-error-container border-b border-error">
          <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-1.5 flex items-center gap-2">
            <span className="font-label-caps text-[10px] uppercase text-on-error-container">
              ⚠ Couldn't reach live news sources — showing cached/demo dispatches. Retrying in the background.
            </span>
          </div>
        </div>
      )}

      {/* Historical archive loading progress */}
      {historyProgress && (
        <div className="w-full bg-surface-container-low border-b border-primary">
          <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-1 flex items-center justify-between">
            <span className="font-label-caps text-[10px] uppercase text-primary">
              Loading 1-Year Archive: {historyProgress.done}/{historyProgress.total} batches
            </span>
            <div className="w-48 h-1 bg-surface-variant">
              <div
                className="h-1 bg-primary transition-all duration-300"
                style={{ width: `${Math.round((historyProgress.done / historyProgress.total) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. Breaking News Ticker */}
      <BreakingTicker
        breakingArticles={breakingArticles}
        onSelectArticle={handleSelectArticle}
      />

      {/* 3. Taxonomy 16-Vertical Navigation Bar */}
      <TaxonomyNav
        selectedVerticalId={selectedVerticalId}
        onSelectVertical={handleSelectVertical}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
      />

      {/* 4. Main Dynamic View Container */}
      <main className="flex-grow">
        {/* Nested boundary: a render error in one route/article shows an error
            card in the content area only — header/nav/footer stay usable so
            the reader can still navigate away, instead of the whole page
            going blank behind the outer last-resort boundary. */}
        <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={
            <HeroStory
              heroArticle={heroArticle}
              sideStories={sideArticles}
              onSelectArticle={handleSelectArticle}
              onSelectVertical={handleSelectVertical}
              onInspectRanking={(art) => setInspectingRankingArticle(art)}
              pendingNewCount={pendingNewCount}
              onLoadNewStories={handleLoadNewStories}
            />
          } />

          <Route path="/section/:verticalSlug" element={
            <SectionRoute
              articles={articles}
              onSelectArticle={handleSelectArticle}
              onSelectVertical={handleSelectVertical}
            />
          } />

          <Route path="/live" element={
            <LiveFeedView onSelectArticle={handleSelectArticle} />
          } />

          <Route path="/timeline" element={
            <TimelineView onSelectArticle={handleSelectArticle} />
          } />

          <Route path="/today" element={
            <SectionFeedView section="today" onSelectArticle={handleSelectArticle} onSelectVertical={handleSelectVertical} />
          } />
          <Route path="/week" element={
            <SectionFeedView section="week" onSelectArticle={handleSelectArticle} onSelectVertical={handleSelectVertical} />
          } />
          <Route path="/month" element={
            <SectionFeedView section="month" onSelectArticle={handleSelectArticle} onSelectVertical={handleSelectVertical} />
          } />

          <Route path="/tag/:tagSlug" element={
            <TagFeedView articles={articles} onSelectArticle={handleSelectArticle} />
          } />

          <Route path="/institutions" element={<InstitutionsView />} />
          <Route path="/institution/:slug" element={
            <InstitutionProfileView onSelectArticle={handleSelectArticle} />
          } />

          <Route path="/ledger" element={<LedgerView />} />
          <Route path="/ops" element={<AdminDashboardView />} />
          <Route path="/ops/review" element={<AdminDashboardView initialTab="review" />} />
          <Route path="/ops/ledger" element={<AdminDashboardView initialTab="ledger" />} />
          <Route path="/ops/add" element={<AdminDashboardView initialTab="add" />} />
          <Route path="/ops/roster" element={<AdminDashboardView initialTab="roster" />} />
          <Route path="/ops/health" element={<AdminDashboardView initialTab="health" />} />

          <Route path="/article/:slugId" element={
            <ArticleRoute
              articles={articles}
              dataReady={dataReady}
              onSelectArticle={handleSelectArticle}
              onInspectRanking={(art) => setInspectingRankingArticle(art)}
              onArticleSynthesized={handleArticleSynthesized}
            />
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>

      {/* 5. Minimal Broadsheet Footer */}
      <Footer
        onSelectTab={handleSelectTab}
        onSelectVertical={handleSelectVertical}
        onOpenStandards={() => setStandardsOpen(true)}
      />

      {/* Modals */}
      {searchOpen && (
        <Suspense fallback={<LoadingFallback />}>
          <SearchModal
            articles={articles}
            onSelectArticle={handleSelectArticle}
            onClose={() => setSearchOpen(false)}
          />
        </Suspense>
      )}

      {standardsOpen && (
        <Suspense fallback={<LoadingFallback />}>
          <EditorialStandardModal
            onClose={() => setStandardsOpen(false)}
          />
        </Suspense>
      )}

      {/* Editorial Ranking & Priority Inspector Modal */}
      {inspectingRankingArticle && (
        <Suspense fallback={<LoadingFallback />}>
          <RankingInspectorModal
            article={inspectingRankingArticle}
            onClose={() => setInspectingRankingArticle(null)}
          />
        </Suspense>
      )}

      {/* Back to top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-40 w-11 h-11 flex items-center justify-center border-2 border-primary bg-surface text-primary hover:bg-primary hover:text-on-primary transition-colors animate-fade-in"
        >
          <ArrowUp size={18} />
        </button>
      )}
    </div>
    </ErrorBoundary>
  );
};

// ── Route-param-resolving wrappers ──────────────────────────────────────────
// Kept as stable, module-level components (not inline closures) so React
// Router doesn't remount them on every AppInner render.

interface SectionRouteProps {
  articles: Article[];
  onSelectArticle: (article: Article) => void;
  onSelectVertical: (id: number | null) => void;
}

const SectionRoute: React.FC<SectionRouteProps> = ({ articles, onSelectArticle, onSelectVertical }) => {
  const { verticalSlug } = useParams();
  const vertical = TAXONOMY_DATA.find(v => v.slug === verticalSlug);

  useDocumentMeta({
    title: vertical ? `${vertical.name} — RAWINDIA` : 'Explore Verticals — RAWINDIA',
    description: vertical?.description || DEFAULT_DESCRIPTION,
  });

  return (
    <TaxonomyExplorer
      selectedVerticalId={vertical?.id ?? null}
      onSelectVertical={onSelectVertical}
      articles={articles}
      onSelectArticle={onSelectArticle}
    />
  );
};

interface ArticleRouteProps {
  articles: Article[];
  dataReady: boolean;
  onSelectArticle: (article: Article) => void;
  onInspectRanking: (article: Article) => void;
  onArticleSynthesized: (article: Article) => void;
}

const ArticleRoute: React.FC<ArticleRouteProps> = ({ articles, dataReady, onSelectArticle, onInspectRanking, onArticleSynthesized }) => {
  const { slugId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const stateArticle = (location.state as Article | null) || undefined;

  const resolved = useMemo(() => {
    if (stateArticle && articleToSlugId(stateArticle) === slugId) return stateArticle;
    return resolveArticleFromSlugId(slugId, articles);
  }, [stateArticle, slugId, articles]);

  // Real, locally-recorded view count — feeds the ranking engine's interest
  // signal (see localEngagementService.ts). Never displayed as "most read";
  // internal ranking input only.
  useEffect(() => {
    if (resolved) recordView(resolved.id);
  }, [resolved]);

  useDocumentMeta(resolved ? {
    title: `${resolved.title} — RAWINDIA`,
    description: resolved.subtitle,
    ogImage: resolved.heroImage,
    articleSchema: {
      headline: resolved.title,
      datePublished: resolved.publishedAt,
      dateModified: resolved.updatedAt,
      image: resolved.heroImage ? [resolved.heroImage] : undefined,
      authorName: resolved.author?.name,
    },
  } : { title: 'RAWINDIA', description: DEFAULT_DESCRIPTION });

  if (!resolved) {
    if (!dataReady) {
      return <ArticleSkeleton />;
    }
    return (
      <div className="max-w-2xl mx-auto px-margin-mobile md:px-margin-desktop py-24 text-center flex flex-col items-center gap-stack-md">
        <h1 className="font-headline-xl text-headline-xl font-bold uppercase text-primary">Dispatch Not Found</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
          This story isn't in the local archive — the link may be old, or the article has aged out of the cache. It hasn't been deleted from the record; it just isn't held here anymore.
        </p>
        <button
          onClick={() => navigate('/')}
          className="font-label-caps text-label-caps uppercase border-2 border-primary text-primary px-4 py-2 hover:bg-primary hover:text-on-primary transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return resolved.isLiveBlog ? (
    <LiveBlogView article={resolved} onBack={() => navigate('/')} />
  ) : (
    <ArticleView
      article={resolved}
      onBack={() => navigate('/')}
      allArticles={articles}
      onSelectArticle={onSelectArticle}
      onInspectRanking={onInspectRanking}
      onArticleSynthesized={onArticleSynthesized}
    />
  );
};
