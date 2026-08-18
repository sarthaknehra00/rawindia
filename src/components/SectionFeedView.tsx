import React, { useState, useEffect, useMemo } from 'react';
import type { Article } from '../types';
import type { SectionKey } from '../services/sectionService';
import {
  filterBySection, getSectionLabel, getSectionDescription,
  todayKey, weekKey, monthKey,
} from '../services/sectionService';
import { getLatestArticles } from '../services/persistenceService';
import { rankArticles } from '../services/rankingEngineService';
import { timeAgo, isJustIn } from '../utils/timeUtils';
import { Radio, RefreshCw, Tag } from 'lucide-react';

interface SectionFeedViewProps {
  section: SectionKey;
  onSelectArticle: (article: Article) => void;
  onSelectVertical: (id: number) => void;
}

function contentTagClass(ct: string) {
  if (ct === 'GROUND REPORT') return 'bg-primary text-on-primary';
  if (ct === 'ANALYSIS')      return 'border border-on-surface-variant text-on-surface-variant bg-surface-container';
  return 'news-border text-primary';
}

const SECTION_COLORS: Record<SectionKey, string> = {
  live:  'text-error',
  today: 'text-secondary',
  week:  'text-primary',
  month: 'text-on-surface-variant',
};

export const SectionFeedView: React.FC<SectionFeedViewProps> = ({
  section, onSelectArticle, onSelectVertical,
}) => {
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    getLatestArticles(2000)
      .then(arts => {
        setAllArticles(rankArticles(arts, section === 'today' || section === 'live' ? 'homepageHero' : 'default'));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [section, refreshKey]);

  const sectionArticles = useMemo(
    () => filterBySection(allArticles, section),
    [allArticles, section]
  );

  // Vertical breakdown for this section
  const byVertical = useMemo(() => {
    const map = new Map<number, { name: string; articles: Article[] }>();
    sectionArticles.forEach(a => {
      if (!map.has(a.verticalId ?? 1)) {
        map.set(a.verticalId ?? 1, { name: a.verticalName ?? 'India / National', articles: [] });
      }
      map.get(a.verticalId ?? 1)!.articles.push(a);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].articles.length - a[1].articles.length);
  }, [sectionArticles]);

  const P0articles     = sectionArticles.filter(a => a.ranking?.priorityTier === 'P0');
  const P1articles     = sectionArticles.filter(a => a.ranking?.priorityTier === 'P1');
  const mainFeed       = sectionArticles.slice(0, 60);
  const synthesized    = sectionArticles.filter(a => a.isGroqSynthesized).length;

  const sectionLabel   = getSectionLabel(section);
  const sectionDesc    = getSectionDescription(section);
  const color          = SECTION_COLORS[section];

  // Section boundary info
  const sectionBoundary: Record<SectionKey, string> = {
    live:  'Permanent — never archived',
    today: `Auto-archives at midnight IST · Key: ${todayKey()}`,
    week:  `Auto-archives Sunday night IST · Week starts: ${weekKey()}`,
    month: `Auto-archives end of month IST · Month: ${monthKey()}`,
  };

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg animate-fade-in">

      {/* ── Page Header ── */}
      <div className="hairline-b pb-stack-md mb-stack-lg">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className={`flex items-center gap-2 mb-1 font-label-caps text-label-caps uppercase ${color}`}>
              {section === 'live' && <Radio size={12} className="animate-pulse" />}
              <span>{section === 'live' ? 'Live Wire' : section === 'today' ? "Today's Dispatches" : section === 'week' ? 'This Week' : 'This Month'}</span>
            </div>
            <h1 className="font-display-lg text-display-lg font-bold text-primary tracking-tighter leading-none">
              {sectionLabel}
            </h1>
            <p className="font-meta text-meta text-on-surface-variant mt-1">{sectionDesc}</p>
            <p className="font-meta text-[10px] text-outline mt-0.5 uppercase">{sectionBoundary[section]}</p>
          </div>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            disabled={loading}
            className="flex items-center gap-2 news-border px-3 py-2 font-label-caps text-label-caps uppercase hover:bg-surface-container transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Stats bar */}
        {!loading && (
          <div className="flex flex-wrap gap-6 mt-stack-md pt-stack-sm hairline-t font-meta text-meta text-on-surface-variant">
            <span><strong className="text-primary">{sectionArticles.length}</strong> dispatches</span>
            <span><strong className="text-error">{P0articles.length}</strong> P0 critical</span>
            <span><strong className="text-secondary">{P1articles.length}</strong> P1 high priority</span>
            <span><strong className="text-secondary">✦ {synthesized}</strong> Groq-synthesized</span>
            <span><strong className="text-primary">{byVertical.length}</strong> verticals covered</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="news-border p-stack-md animate-pulse">
              <div className="h-36 bg-surface-variant mb-3" />
              <div className="h-3 bg-surface-variant w-20 mb-2" />
              <div className="h-4 bg-surface-variant w-full mb-2" />
              <div className="h-3 bg-surface-variant w-3/4" />
            </div>
          ))}
        </div>
      ) : sectionArticles.length === 0 ? (
        <div className="news-border p-section-gap text-center">
          <p className="font-headline-lg text-headline-lg font-bold text-primary mb-2">
            No dispatches in this section yet
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {section === 'today' && 'No articles have been published today (IST). Check back after the next 10-minute refresh.'}
            {section === 'week' && 'No articles from this week yet. The pipeline collects news every 10 minutes.'}
            {section === 'month' && 'No articles from this month yet.'}
            {section === 'live' && 'The live feed is loading. First collection runs on startup.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">

          {/* ── Main feed (9 cols) ── */}
          <div className="lg:col-span-9">

            {/* P0 Critical row */}
            {P0articles.length > 0 && (
              <div className="mb-stack-lg">
                <div className="font-label-caps text-label-caps uppercase text-error mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-error animate-pulse flex-shrink-0" />
                  P0 Critical — Importance Floor Override Active
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter mb-stack-lg">
                  {P0articles.slice(0, 4).map(art => (
                    <article
                      key={art.id}
                      onClick={() => onSelectArticle(art)}
                      className="border-2 border-error p-stack-sm cursor-pointer group hover:bg-error-container transition-colors"
                    >
                      {art.heroImage && (
                        <img
                          src={art.heroImage}
                          alt={art.title}
                          loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&auto=format&fit=crop&q=80`; }}
                          className="w-full h-32 object-cover border border-error mb-2 editorial-img-hard"
                        />
                      )}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="bg-error text-on-error font-label-caps text-[10px] px-2 py-0.5 uppercase">P0 Critical</span>
                        <span className="font-meta text-[10px] text-outline">{timeAgo(art.publishedAt)}</span>
                      </div>
                      <h3 className="font-headline-lg text-base font-bold text-primary group-hover:text-error transition-colors leading-snug mb-1">
                        {art.title}
                      </h3>
                      <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2">{art.subtitle}</p>
                      {/* Taxonomy path */}
                      {art.taxonomyPath && (
                        <p className="font-meta text-[10px] text-outline mt-1.5 border-t border-error/20 pt-1">
                          {art.taxonomyPath}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
                <hr className="border-t border-hairline-grey mb-stack-lg" />
              </div>
            )}

            {/* Main article grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              {mainFeed.map((art, idx) => {
                const isLarge = idx === 0 || (P0articles.length === 0 && idx < 2);
                return (
                  <article
                    key={art.id}
                    onClick={() => onSelectArticle(art)}
                    className={`cursor-pointer group hairline-b pb-stack-md ${
                      isLarge ? 'md:col-span-3' : ''
                    }`}
                  >
                    {art.heroImage ? (
                      <div className="img-wrapper mb-2">
                        <img
                          src={art.heroImage}
                          alt={art.title}
                          loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&auto=format&fit=crop&q=80`; }}
                          className={`w-full object-cover ${
                            isLarge ? 'h-72 editorial-img' : 'h-44 editorial-img'
                          } ${art.contentType === 'GROUND REPORT' ? 'editorial-img-hard' : ''}`}
                        />
                      </div>
                    ) : (
                      <div className="img-placeholder w-full h-28 mb-2 news-border flex items-center justify-center">
                        <span className="font-label-caps text-[9px] uppercase text-outline">Image Archived</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`font-label-caps text-[10px] uppercase px-1.5 py-0.5 ${contentTagClass(art.contentType)}`}>
                        {art.contentType}
                      </span>
                      {art.ranking?.priorityTier === 'P1' && (
                        <span className="font-label-caps text-[9px] text-secondary border border-secondary px-1.5 py-0.5 uppercase">P1</span>
                      )}
                      {art.isGroqSynthesized && (
                        <span className="font-meta text-[10px] text-secondary">✦</span>
                      )}
                      {isJustIn(art.publishedAt) && (
                        <span className="font-label-caps text-[9px] text-error uppercase font-bold">Just In</span>
                      )}
                    </div>

                    <h3 className={`font-bold text-primary group-hover:text-secondary transition-colors leading-tight mb-1.5 ${
                      isLarge ? 'font-headline-xl text-headline-xl' : 'font-headline-lg text-base'
                    }`}>
                      {art.title}
                    </h3>

                    {(isLarge || art.subtitle) && (
                      <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed mb-2 line-clamp-3">
                        {art.subtitle}
                      </p>
                    )}

                    {/* Fact bullet preview on synthesized articles */}
                    {art.isGroqSynthesized && art.factBlock?.bullets?.[0] && (
                      <div className="border-l-2 border-secondary pl-2 mb-2">
                        <p className="font-meta text-[11px] text-on-surface-variant line-clamp-1">
                          → {art.factBlock.bullets[0]}
                        </p>
                      </div>
                    )}

                    {/* Tags linked to subcategory */}
                    {art.subCategoryName && (
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <Tag size={10} className="text-outline flex-shrink-0" />
                        <button
                          onClick={e => { e.stopPropagation(); onSelectVertical(art.verticalId ?? 1); }}
                          className="font-meta text-[10px] text-secondary hover:underline"
                        >
                          {art.subCategoryName}
                        </button>
                        {art.subSubCategoryName && (
                          <>
                            <span className="text-outline text-[10px]">›</span>
                            <span className="font-meta text-[10px] text-outline">{art.subSubCategoryName}</span>
                          </>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-center font-meta text-[11px] text-outline">
                      <span>{art.author.name}</span>
                      <span>{timeAgo(art.publishedAt)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* ── Sidebar (3 cols) ── */}
          <aside className="lg:col-span-3 flex flex-col gap-stack-lg">

            {/* By Vertical breakdown */}
            <div className="news-border p-stack-md">
              <h3 className="font-label-caps text-label-caps uppercase font-bold text-primary hairline-b pb-2 mb-3">
                By Vertical
              </h3>
              <div className="flex flex-col gap-2">
                {byVertical.slice(0, 10).map(([vId, { name, articles: varticles }]) => (
                  <button
                    key={vId}
                    onClick={() => onSelectVertical(vId)}
                    className="flex items-center justify-between hover:bg-surface-container px-1.5 py-1 transition-colors group"
                  >
                    <span className="font-body-sm text-body-sm text-on-surface group-hover:text-secondary transition-colors">{name}</span>
                    <span className="font-label-caps text-[10px] bg-primary text-on-primary px-1.5 py-0.5">{varticles.length}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tag cloud — linked to verticals */}
            <div className="news-border p-stack-md">
              <h3 className="font-label-caps text-label-caps uppercase font-bold text-primary hairline-b pb-2 mb-3">
                Topic Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(
                  new Set(sectionArticles.flatMap(a => a.tags).filter(Boolean))
                ).slice(0, 24).map(tag => (
                  <span
                    key={tag}
                    className="font-meta text-[10px] border border-outline-variant px-1.5 py-0.5 text-on-surface-variant hover:bg-surface-container cursor-default"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Section key info */}
            <div className="news-border p-stack-md bg-wash-warm">
              <h3 className="font-label-caps text-label-caps uppercase font-bold text-primary hairline-b pb-2 mb-3">
                Section Rules
              </h3>
              <div className="space-y-2 font-meta text-meta text-on-surface-variant">
                <div className="flex gap-2">
                  <span className="w-2 h-2 bg-error mt-1.5 flex-shrink-0" />
                  <span>Today: articles from <strong className="text-primary">{todayKey()}</strong> IST only</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-2 h-2 bg-secondary mt-1.5 flex-shrink-0" />
                  <span>Week: Mon <strong className="text-primary">{weekKey()}</strong> to Sunday IST</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-2 h-2 bg-primary mt-1.5 flex-shrink-0" />
                  <span>Month: <strong className="text-primary">{monthKey()}</strong> IST</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-2 h-2 bg-outline mt-1.5 flex-shrink-0" />
                  <span>Live: all articles, permanent archive</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
