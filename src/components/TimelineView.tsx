import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Article } from '../types';
import { getLatestArticles, getArticleCount, getArticlesByDate, searchArticles } from '../services/persistenceService';
import { timeAgo, isJustIn } from '../utils/timeUtils';
import { Clock, Search, ChevronDown, RefreshCw } from 'lucide-react';

interface TimelineViewProps {
  onSelectArticle: (article: Article) => void;
}

const PAGE_SIZE       = 30;
const AUTO_REFRESH_MS = 120_000; // 2 minutes — the fast cron cycle now persists
// fresh top-headlines to IndexedDB every 90s, so this view re-syncs often
// enough to actually reflect that instead of sitting on a 15-minute-old read.

function getContentTagClass(ct: string) {
  if (ct === 'GROUND REPORT') return 'bg-primary text-on-primary';
  if (ct === 'ANALYSIS')      return 'border border-on-surface-variant text-on-surface-variant bg-surface-container';
  if (ct === 'OPINION')       return 'bg-secondary text-on-secondary';
  return 'news-border text-primary';
}

// Publish-time-sorted safety net — getLatestArticles() already returns
// results newest-first from IndexedDB's publishedAt index, but search/date
// results don't carry the same ordering guarantee, so this is asserted
// explicitly rather than assumed.
function byPublishedAtDesc(articles: Article[]): Article[] {
  return [...articles].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

// ── Timeline — pure chronological feed ────────────────────────────────────
// Deliberately does NOT call rankArticles()/rankingEngineService anywhere.
// "Live Wire" (LiveFeedView.tsx) applies the Priority Score formula
// (Interest x 0.6 + Importance x 0.4 + Floor Override) to decide order; this
// view exists specifically so a reader can see the raw wire in the order it
// actually arrived, with no editorial-importance weighting applied at all —
// no P0/P1 tiers, no "why is this ranked here", nothing derived from
// `article.ranking`. Same data, opposite ordering philosophy, on purpose.
export const TimelineView: React.FC<TimelineViewProps> = ({ onSelectArticle }) => {
  const [articles,      setArticles]      = useState<Article[]>([]);
  const [totalCount,    setTotalCount]    = useState(0);
  const [page,          setPage]          = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [hasMore,       setHasMore]       = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [filterDate,    setFilterDate]    = useState('');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchInput,   setSearchInput]   = useState('');
  const [dateMode,      setDateMode]      = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (pageIndex: number, reset = false) => {
    try {
      if (pageIndex === 0) setLoading(true); else setLoadingMore(true);

      let fetched: Article[];
      if (searchQuery) {
        fetched = byPublishedAtDesc(await searchArticles(searchQuery, 200));
      } else if (filterDate) {
        fetched = byPublishedAtDesc(await getArticlesByDate(filterDate, 500));
      } else {
        fetched = await getLatestArticles(PAGE_SIZE, pageIndex * PAGE_SIZE);
      }

      setArticles(prev => reset ? fetched : byPublishedAtDesc([...prev, ...fetched]));
      setHasMore(fetched.length === PAGE_SIZE && !searchQuery && !filterDate);
      setLastRefreshed(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST');
    } catch (err) {
      console.warn('[Timeline]', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, filterDate]);

  useEffect(() => {
    getArticleCount().then(setTotalCount);
    loadPage(0, true);
  }, [loadPage]);

  useEffect(() => {
    const timer = setInterval(() => {
      setPage(0);
      loadPage(0, true);
      getArticleCount().then(setTotalCount);
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadPage]);

  useEffect(() => {
    if (!bottomRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        const nextPage = page + 1;
        setPage(nextPage);
        loadPage(nextPage);
      }
    }, { rootMargin: '400px' });
    obs.observe(bottomRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, page, loadPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    setPage(0);
    setFilterDate('');
    setDateMode(false);
  };

  const handleDateChange = (d: string) => {
    setFilterDate(d);
    setSearchQuery('');
    setSearchInput('');
    setPage(0);
  };

  const handleRefresh = () => {
    setPage(0);
    loadPage(0, true);
    getArticleCount().then(setTotalCount);
  };

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg animate-fade-in">

      {/* ── Page Header ── */}
      <div className="hairline-b pb-stack-md mb-stack-lg">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-primary" />
              <span className="font-label-caps text-label-caps uppercase text-primary font-bold">Timeline</span>
              <span className="font-meta text-meta text-on-surface-variant">· Pure chronological — no editorial ranking applied</span>
            </div>
            <h1 className="font-display-lg text-display-lg font-bold text-primary tracking-tighter leading-none">
              Straight Wire, By Time
            </h1>
            <p className="font-meta text-meta text-on-surface-variant mt-1">
              Every dispatch, exactly in the order it arrived — no Priority Score, no Interest/Importance weighting, no floor override. That's Live Wire's job; this is just the clock.
            </p>
            <p className="font-meta text-meta text-on-surface-variant mt-1">
              {totalCount.toLocaleString()} dispatches archived permanently · Last: {lastRefreshed || '—'}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 news-border px-3 py-2 font-label-caps text-label-caps uppercase hover:bg-surface-container transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Search + Date filter */}
        <div className="flex flex-wrap gap-3 mt-stack-md">
          <form onSubmit={handleSearch} className="flex flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-2.5 text-outline" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search all archived dispatches..."
                className="w-full pl-8 pr-3 py-2 news-border border-r-0 bg-surface text-on-surface font-meta text-meta focus:outline-none"
              />
            </div>
            <button type="submit" className="bg-primary text-on-primary font-label-caps text-label-caps uppercase px-3 py-2 hover:bg-secondary transition-colors news-border">
              Search
            </button>
          </form>

          <button
            onClick={() => setDateMode(v => !v)}
            className={`px-3 py-2 news-border font-label-caps text-label-caps uppercase transition-colors ${dateMode ? 'bg-primary text-on-primary' : 'hover:bg-surface-container'}`}
          >
            By Date 📅
          </button>

          {dateMode && (
            <input
              type="date"
              value={filterDate}
              onChange={e => handleDateChange(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="news-border px-3 py-2 bg-surface text-on-surface font-meta text-meta focus:outline-none cursor-pointer"
            />
          )}

          {(searchQuery || filterDate) && (
            <button
              onClick={() => { setSearchQuery(''); setSearchInput(''); setFilterDate(''); setDateMode(false); setPage(0); loadPage(0, true); }}
              className="px-3 py-2 news-border text-secondary font-label-caps text-label-caps uppercase hover:bg-surface-container transition-colors"
            >
              ✕ Clear Filter
            </button>
          )}
        </div>

        {(searchQuery || filterDate) && (
          <p className="font-meta text-meta text-on-surface-variant mt-2">
            {searchQuery && `Showing results for "${searchQuery}"`}
            {filterDate && `Showing dispatches from ${new Date(filterDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`}
            · {articles.length} dispatch{articles.length !== 1 ? 'es' : ''}
          </p>
        )}
      </div>

      {/* ── Chronological stream ── */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="news-border p-stack-md animate-pulse">
              <div className="h-3 bg-surface-variant w-24 mb-2" />
              <div className="h-5 bg-surface-variant w-3/4 mb-2" />
              <div className="h-3 bg-surface-variant w-1/2" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="news-border p-section-gap text-center">
          <p className="font-headline-lg text-headline-lg font-bold text-primary mb-2">No dispatches found</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {searchQuery ? `No results for "${searchQuery}". Try a different keyword.` : 'The archive is building. Check back in a moment.'}
          </p>
        </div>
      ) : (
        <>
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-primary/20 hidden md:block" style={{ left: '11px' }} />

            <div className="flex flex-col">
              {articles.map((art, idx) => {
                const isFirst     = idx === 0;
                const isGroqDone  = art.isGroqSynthesized;
                const isHardNews  = art.contentType === 'GROUND REPORT';

                return (
                  <article
                    key={art.id}
                    onClick={() => onSelectArticle(art)}
                    className={`group cursor-pointer transition-colors duration-150 ${
                      isFirst ? 'hairline-b mb-stack-lg pb-stack-lg' : 'hairline-b py-stack-md hover:bg-surface-container-low'
                    } md:pl-8`}
                  >
                    <div
                      className={`absolute w-2.5 h-2.5 border-2 border-surface hidden md:block mt-1 ${
                        isJustIn(art.publishedAt) ? 'bg-error animate-pulse' : isGroqDone ? 'bg-secondary' : 'bg-outline'
                      }`}
                      style={{ left: '6px' }}
                    />

                    <div className={`flex flex-col ${isFirst ? '' : 'md:flex-row gap-4'}`}>
                      {(isFirst || idx % 5 === 0) && art.heroImage && (
                        <div className={isFirst ? 'mb-3' : 'flex-shrink-0 w-40 hidden md:block'}>
                          <img
                            src={art.heroImage}
                            alt={art.title}
                            loading="lazy"
                            onError={e => { (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&auto=format&fit=crop&q=80`; }}
                            className={`w-full object-cover ${
                              isFirst ? 'h-64 editorial-img' : `h-28 ${isHardNews ? 'editorial-img-hard' : 'editorial-img'}`
                            }`}
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`font-label-caps text-[10px] uppercase px-1.5 py-0.5 ${getContentTagClass(art.contentType)}`}>
                            {art.contentType}
                          </span>
                          <span className="font-meta text-[11px] text-on-surface-variant border border-outline-variant px-1.5 py-0.5">
                            {art.verticalName}
                          </span>
                          {isGroqDone && (
                            <span className="font-meta text-[10px] text-secondary">✦ Synthesized</span>
                          )}
                          {isJustIn(art.publishedAt) && (
                            <span className="font-label-caps text-[9px] uppercase text-error font-bold">Just In</span>
                          )}
                        </div>

                        <h2 className={`font-bold text-primary group-hover:text-secondary transition-colors leading-tight mb-1.5 ${
                          isFirst ? 'font-headline-xl text-headline-xl' : 'font-headline-lg text-lg'
                        }`}>
                          {art.title}
                        </h2>

                        {(isFirst || art.subtitle) && (
                          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mb-2 line-clamp-2">
                            {art.subtitle}
                          </p>
                        )}

                        {isGroqDone && art.factBlock?.bullets?.[0] && (
                          <div className="border-l-2 border-secondary pl-2 mb-2">
                            <p className="font-meta text-[11px] text-on-surface-variant line-clamp-1">
                              → {art.factBlock.bullets[0]}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between font-meta text-[11px] text-outline">
                          <div className="flex items-center gap-2">
                            <span>{art.author.name}</span>
                            {art.externalSource && art.externalSource !== art.author.name && (
                              <span className="opacity-60">via {art.externalSource}</span>
                            )}
                          </div>
                          <span>{timeAgo(art.publishedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div ref={bottomRef} className="py-4 text-center">
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 text-outline">
                <RefreshCw size={14} className="animate-spin" />
                <span className="font-label-caps text-label-caps uppercase text-[11px]">Loading more dispatches...</span>
              </div>
            )}
            {!hasMore && !loadingMore && articles.length > 0 && (
              <div className="flex items-center gap-3">
                <hr className="flex-1 border-hairline-grey" />
                <span className="font-label-caps text-[10px] uppercase text-outline">
                  {articles.length} dispatches · End of {searchQuery || filterDate ? 'results' : 'archive'}
                </span>
                <hr className="flex-1 border-hairline-grey" />
              </div>
            )}
          </div>

          {hasMore && !loadingMore && (
            <div className="text-center mt-4">
              <button
                onClick={() => { const next = page + 1; setPage(next); loadPage(next); }}
                className="flex items-center gap-2 mx-auto news-border px-6 py-2.5 font-label-caps text-label-caps uppercase hover:bg-surface-container transition-colors"
              >
                <ChevronDown size={14} />
                Load More Dispatches
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
