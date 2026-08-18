import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Article } from '../types';
import { cronScheduler } from '../services/cronSchedulerService';
import type { CronStatus } from '../services/cronSchedulerService';
import { getLedgerBundle } from '../services/sharedLedgerService';
import type { VerdictEvent } from '../services/persistenceService';
import { RefreshCw, BadgeCheck, ArrowRight, ArrowUpRight, Scale } from 'lucide-react';
import { timeAgo, isJustIn } from '../utils/timeUtils';

interface HeroStoryProps {
  heroArticle: Article;
  sideStories: Article[];
  onSelectArticle: (article: Article) => void;
  onSelectVertical: (id: number) => void;
  onInspectRanking?: (article: Article) => void;
  // Stories the background wire already fetched but hasn't injected into the
  // feed yet — folded into this same Sync Wire control instead of a separate
  // full-width "N new stories available" banner (too visually loud/distracting).
  pendingNewCount?: number;
  onLoadNewStories?: () => void;
}

function getContentTypeTag(type: string) {
  const t = (type || '').toUpperCase();
  if (t === 'GROUND REPORT') return 'bg-primary text-on-primary';
  if (t === 'OPINION') return 'bg-secondary text-on-secondary';
  // ANALYSIS gets its own muted-grey treatment — previously identical to the
  // default NEWS tag below, contradicting the "hard color-coded tags for all
  // 4 content types" promise made in EditorialStandardModal.
  if (t === 'ANALYSIS') return 'border border-on-surface-variant text-on-surface-variant bg-surface-container';
  return 'news-border text-primary bg-transparent';
}

// Reuses the exact card treatment already established by the secondary-story
// grid below — same image/badge/headline/subtitle pattern, just factored out
// so the new homepage sections below don't hand-duplicate this JSX 3x.
function StoryCard({ story, onSelectArticle }: { story: Article; onSelectArticle: (article: Article) => void }) {
  return (
    <article
      onClick={() => onSelectArticle(story)}
      className="flex flex-col gap-stack-sm cursor-pointer group"
    >
      <div className="overflow-hidden">
        <img
          src={story.heroImage}
          alt={story.title}
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&auto=format&fit=crop&q=80`; }}
          className={`w-full h-48 object-cover transition-all duration-500 group-hover:scale-[1.04] ${
            story.contentType === 'GROUND REPORT' ? 'editorial-img-hard' : 'editorial-img'
          }`}
        />
      </div>
      <div className="flex items-center gap-stack-sm font-meta text-meta uppercase mt-2">
        <span className={`font-label-caps text-label-caps px-2 py-0.5 ${getContentTypeTag(story.contentType)}`}>
          {story.contentType || 'NEWS'}
        </span>
      </div>
      <h3 className="font-headline-lg text-headline-lg text-on-surface leading-tight group-hover:text-secondary transition-colors">
        {story.title}
      </h3>
      <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
        {story.subtitle}
      </p>
    </article>
  );
}

export const HeroStory: React.FC<HeroStoryProps> = ({
  heroArticle,
  sideStories,
  onSelectArticle,
  onInspectRanking,
  onSelectVertical,
  pendingNewCount = 0,
  onLoadNewStories,
}) => {
  const navigate = useNavigate();
  const [cronStatus, setCronStatus] = useState<CronStatus>(cronScheduler.getStatus());
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [ledgerTeaser, setLedgerTeaser] = useState<VerdictEvent[] | null>(null);

  // A feature nobody finds isn't a feature — this is the only place on the
  // homepage that surfaces the Ledger at all, otherwise it's header-icon or
  // footer-link only. Shows only real, already-verified takes (never an
  // ai-flagged candidate), same trust rule as the Ledger page itself.
  useEffect(() => {
    let cancelled = false;
    getLedgerBundle().then(({ verdicts }) => {
      if (cancelled) return;
      setLedgerTeaser(
        verdicts.filter(v => v.trustTier === 'verified')
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 3)
      );
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setCronStatus(cronScheduler.getStatus()), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleManualCronTrigger = async () => {
    setIsManualSyncing(true);
    await cronScheduler.triggerManualRun();
    setCronStatus(cronScheduler.getStatus());
    setTimeout(() => setIsManualSyncing(false), 800);
  };

  // When stories are already waiting in the background, this button's job
  // becomes pulling them into view (instant, no network call) rather than
  // kicking off a fresh fetch cycle — same control, whichever action is
  // actually useful right now.
  const handleSyncWireClick = () => {
    if (pendingNewCount > 0 && onLoadNewStories) {
      onLoadNewStories();
      return;
    }
    handleManualCronTrigger();
  };

  const briefs = sideStories.slice(2, 14).map((story, i) => ({
    category: story.verticalName?.toUpperCase() || ['SCIENCE', 'SPORTS', 'WORLD', 'BUSINESS'][i % 4],
    colorClass: i % 2 === 0 ? 'text-secondary' : 'text-primary',
    title: story.title,
    article: story
  }));

  // Analysis/Opinion rail — pulled from the same pre-ranked pool, deliberately
  // separated so long-form/opinion content isn't buried under the flat brief list.
  // Excludes whatever's already shown above (top-story secondary grid + Latest
  // Briefs) — without this, an ANALYSIS-tagged article in one of those slots
  // (e.g. the top-story grid's 2nd slot) would also get repeated down here.
  const analysisOpinion = useMemo(() => {
    const alreadyShown = new Set<string>([
      ...sideStories.slice(0, 2).map(s => s.id),
      ...sideStories.slice(2, 14).map(s => s.id),
    ]);
    return sideStories
      .filter(s => !alreadyShown.has(s.id) && (s.contentType === 'ANALYSIS' || s.contentType === 'OPINION'))
      .slice(0, 4);
  }, [sideStories]);

  // "Voices of RAWINDIA" — the most-published real bylines in the current
  // pool, with a REAL dispatch count (never a fabricated follower figure —
  // this app has no social graph, so showing one would be inventing data).
  // Clicking a voice opens their single most recent dispatch.
  const voices = useMemo(() => {
    const pool = [heroArticle, ...sideStories];
    const byAuthor = new Map<string, { name: string; avatar: string; count: number; latest: Article }>();
    for (const a of pool) {
      const name = a.author?.name;
      if (!name) continue;
      const cur = byAuthor.get(name);
      if (cur) {
        cur.count++;
        if (new Date(a.publishedAt).getTime() > new Date(cur.latest.publishedAt).getTime()) cur.latest = a;
      } else {
        byAuthor.set(name, { name, avatar: a.author.avatar, count: 1, latest: a });
      }
    }
    return Array.from(byAuthor.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 2);
  }, [heroArticle, sideStories]);

  // Dynamic category rows — surfaces whichever verticals have the most depth
  // in the remaining (not-yet-shown) pool, rather than a hardcoded section list.
  // Widened (more rows, more articles per row) so the homepage reads as a full
  // "All Stories" front page rather than a short curated sample.
  const categoryRows = useMemo(() => {
    const usedIds = new Set<string>([
      heroArticle.id,
      ...sideStories.slice(0, 2).map(s => s.id),
      ...sideStories.slice(2, 14).map(s => s.id),
      ...analysisOpinion.map(s => s.id),
    ]);

    const remaining = sideStories.filter(s => !usedIds.has(s.id));

    const byVertical = new Map<string, { verticalId: number; verticalName: string; articles: Article[] }>();
    remaining.forEach(article => {
      if (!article.verticalName) return;
      const key = article.verticalName;
      if (!byVertical.has(key)) {
        byVertical.set(key, { verticalId: article.verticalId, verticalName: article.verticalName, articles: [] });
      }
      byVertical.get(key)!.articles.push(article);
    });

    return Array.from(byVertical.values())
      .sort((a, b) => b.articles.length - a.articles.length)
      .slice(0, 6)
      .map(row => ({ ...row, articles: row.articles.slice(0, 4) }));
  }, [sideStories, heroArticle, analysisOpinion]);

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg animate-fade-in relative overflow-x-hidden">
      {/* Subtle brand watermark — decorative only, sits behind all content.
          `absolute` (not `fixed`) so it scrolls away with this section
          instead of staying pinned to the viewport through everything below it.
          `overflow-x-hidden` on this container clips its deliberate `-right-32`
          bleed-off — without it, the watermark was forcing the WHOLE page into
          horizontal scroll (its right edge landed exactly at the page's extra
          scrollWidth in testing). */}
      <div className="hidden lg:block absolute top-1/4 -right-32 text-[20vw] font-display-lg text-primary opacity-[0.02] pointer-events-none select-none rotate-90 origin-right whitespace-nowrap z-0">
        RAWINDIA
      </div>

      {/* Wire status bar */}
      <div className="flex flex-wrap items-center justify-between hairline-b pb-2 mb-6 text-[11px] font-meta text-outline">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-block w-2 h-2 bg-verified" />
          <span>Ranked by <strong className="text-on-surface">reader interest & editorial importance</strong> — click any tier badge to see why</span>
          <span>•</span>
          <span>Wire auto-rotating every <strong className="text-on-surface">{cronStatus.intervalSeconds}s</strong></span>
        </div>
        <div className="flex items-center gap-3">
          <span>Next: <strong className="text-on-surface">{cronStatus.nextRunTime}</strong></span>
          <button
            onClick={handleSyncWireClick}
            disabled={isManualSyncing}
            className={`flex items-center gap-1.5 font-label-caps text-[10px] uppercase font-bold transition-colors ${
              pendingNewCount > 0 ? 'text-secondary' : 'text-primary hover:text-secondary'
            }`}
            title={pendingNewCount > 0 ? `${pendingNewCount} new ${pendingNewCount === 1 ? 'story' : 'stories'} waiting — click to load` : 'Fetch the wire now'}
          >
            {pendingNewCount > 0 && <span className="pulse-dot" />}
            <RefreshCw size={10} className={isManualSyncing ? 'animate-spin' : ''} />
            {isManualSyncing ? 'Updating...' : pendingNewCount > 0 ? `${pendingNewCount} New — Sync Wire` : 'Sync Wire'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter items-start">
        {/* ── CENTER COLUMN: Hero + Secondary Stories (9 cols) ── */}
        <main className="col-span-1 md:col-span-9 flex flex-col gap-stack-lg">
          {/* Hero Top Story — borderless editorial treatment: whitespace and
              typography carry the hierarchy instead of a boxed border. */}
          <article
            className="flex flex-col gap-stack-md relative cursor-pointer group"
            onClick={() => onSelectArticle(heroArticle)}
          >
            <div className="flex items-center gap-2">
              <span className="pulse-dot" />
              <span className="font-label-caps text-label-caps text-secondary">Top Story</span>
            </div>

            <div className="img-wrapper img-wrapper-hero overflow-hidden relative">
              {heroArticle.heroImage ? (
                <img
                  src={heroArticle.heroImage}
                  alt={heroArticle.title}
                  fetchPriority="high"
                  onError={e => { (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1200&auto=format&fit=crop&q=80`; }}
                  className={`w-full h-auto object-cover aspect-video transition-transform duration-700 ease-out group-hover:scale-[1.03] ${
                    heroArticle.contentType === 'GROUND REPORT' ? 'editorial-img-hard' : 'editorial-img'
                  }`}
                />
              ) : (
                <div className="img-placeholder w-full aspect-video news-border">
                  <span className="font-label-caps text-label-caps uppercase text-outline">Image Archived</span>
                </div>
              )}
              {/* Only ever shown when a real source in the Transparency Ledger
                  is actually marked verified — never decorative, since this
                  is a factual claim about the dispatch, not a design flourish. */}
              {heroArticle.sourceTransparency?.some(s => s.verified) && (
                <div className="absolute top-4 left-4 bg-primary text-on-primary font-label-caps text-[10px] font-bold px-3 py-1.5 uppercase tracking-wider flex items-center gap-1.5 shadow-luminous">
                  <BadgeCheck size={13} className="text-verified" />
                  Fact Layer: Verified
                </div>
              )}
            </div>

            {/* Byline row — avatar, name, category, time */}
            <div className="flex items-center justify-between font-meta text-meta">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={heroArticle.author.avatar}
                  alt=""
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
                <span className="font-bold text-on-surface truncate">{heroArticle.author.name}</span>
                <span className="text-outline flex-shrink-0">|</span>
                <span className="text-on-surface-variant uppercase text-xs tracking-wide truncate">{heroArticle.verticalName}</span>
              </div>
              <span className="text-on-surface-variant flex-shrink-0 ml-3">{timeAgo(heroArticle.publishedAt)}</span>
            </div>

            <div className="flex flex-col gap-stack-sm">
              <div className="flex items-center gap-stack-sm font-meta text-meta uppercase">
                <span className={`font-label-caps text-label-caps px-2 py-0.5 ${getContentTypeTag(heroArticle.contentType)}`}>
                  {heroArticle.contentType}
                </span>
                {isJustIn(heroArticle.publishedAt) && (
                  <span className="bg-error text-on-error font-label-caps text-[10px] px-1.5 py-0.5 uppercase">
                    Just In
                  </span>
                )}
                {heroArticle.ranking && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onInspectRanking?.(heroArticle); }}
                    className="text-on-surface-variant hover:text-secondary transition-colors"
                    title="Why is this ranked here?"
                    aria-label="Why is this ranked here?"
                  >
                    [{heroArticle.ranking.priorityTier}]
                  </button>
                )}
              </div>

              <h2 className="font-headline-xl text-headline-xl text-on-surface leading-tight group-hover:text-secondary transition-colors">
                {heroArticle.title}
              </h2>

              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                {heroArticle.subtitle}
              </p>

              <span className="inline-flex items-center gap-1.5 font-label-caps text-label-caps uppercase font-bold text-on-surface group-hover:text-secondary transition-colors mt-1">
                Read Full Story
                <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </div>
          </article>

          {/* Secondary story grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter hairline-t pt-stack-lg">
            {sideStories.slice(0, 2).map((story) => (
              <article
                key={story.id}
                onClick={() => onSelectArticle(story)}
                className="flex flex-col gap-stack-sm cursor-pointer group"
              >
                <div className="overflow-hidden">
                  <img
                    src={story.heroImage}
                    alt={story.title}
                    loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&auto=format&fit=crop&q=80`; }}
                    className={`w-full h-48 object-cover transition-all duration-500 group-hover:scale-[1.04] ${
                      story.contentType === 'GROUND REPORT' ? 'editorial-img-hard' : 'editorial-img'
                    }`}
                  />
                </div>
                <div className="flex items-center gap-stack-sm font-meta text-meta uppercase mt-2">
                  <span className={`font-label-caps text-label-caps px-2 py-0.5 ${getContentTypeTag(story.contentType)}`}>
                    {story.contentType || 'NEWS'}
                  </span>
                </div>
                <h3 className="font-headline-lg text-headline-lg text-on-surface leading-tight group-hover:text-secondary transition-colors">
                  {story.title}
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                  {story.subtitle}
                </p>
              </article>
            ))}
          </div>

          {/* ── Analysis & Opinion Rail ── */}
          {/* Lives inside the main column (not as a separate full-width section
              below the grid) so the main column's total height reliably exceeds
              the "Latest Briefs" sidebar's — otherwise a short main column paired
              with a long sidebar in the same grid row leaves visible dead space
              beside the sidebar once the (shorter) main column's content ends. */}
          {analysisOpinion.length >= 2 && (
            <section className="hairline-t pt-stack-lg">
              <h3 className="font-label-caps text-label-caps uppercase hairline-b pb-stack-sm mb-stack-md">
                Analysis & Opinion
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                {analysisOpinion.map(story => (
                  <StoryCard key={story.id} story={story} onSelectArticle={onSelectArticle} />
                ))}
              </div>
            </section>
          )}

          {/* ── Dynamic category rows — adapts to whatever verticals have depth ── */}
          {categoryRows.map(row => (
            <section key={row.verticalId} className="hairline-t pt-stack-lg">
              <div className="flex items-center justify-between hairline-b pb-stack-sm mb-stack-md">
                <h3 className="font-label-caps text-label-caps uppercase">
                  {row.verticalName}
                </h3>
                <button
                  onClick={() => onSelectVertical(row.verticalId)}
                  className="font-label-caps text-label-caps uppercase text-primary hover:text-secondary transition-colors"
                >
                  View All →
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                {row.articles.map(story => (
                  <StoryCard key={story.id} story={story} onSelectArticle={onSelectArticle} />
                ))}
              </div>
            </section>
          ))}
        </main>

        {/* ── RIGHT COLUMN: Pulse Engine + Voices ── */}
        <aside className="col-span-1 md:col-span-3 flex flex-col gap-section-gap border-l-0 md:border-l md:border-outline-variant pl-0 md:pl-gutter order-3 hidden md:flex">
          <section>
            <h3 className="font-headline-lg text-2xl font-bold hairline-b pb-stack-sm mb-stack-md flex items-center justify-between">
              Pulse Engine
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-secondary" />
              </span>
            </h3>
            <div className="flex flex-col gap-stack-md">
              {briefs.map((b, i) => (
                <article
                  key={i}
                  onClick={() => b.article && onSelectArticle(b.article)}
                  className={`grid grid-cols-3 gap-3 cursor-pointer group ${i > 0 ? 'hairline-t pt-stack-md' : ''}`}
                >
                  <div className="col-span-1 overflow-hidden aspect-[4/3]">
                    <img
                      src={b.article?.heroImage}
                      alt=""
                      loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400&auto=format&fit=crop&q=80'; }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="col-span-2 flex flex-col justify-between py-0.5">
                    <h4 className="font-body-md text-[15px] font-bold leading-snug text-on-surface group-hover:underline decoration-2 underline-offset-2">
                      {b.title}
                    </h4>
                    <div className="flex items-center gap-2 font-meta text-[11px] text-on-surface-variant mt-2">
                      <img
                        src={b.article?.author.avatar}
                        alt=""
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                      />
                      <span className="truncate">{b.article?.author.name}</span>
                      <span className="ml-auto flex-shrink-0">{timeAgo(b.article?.publishedAt || '')}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* The Vaada Ledger teaser — real, already-verified W/L takes only */}
          {ledgerTeaser && ledgerTeaser.length > 0 && (
            <section>
              <div className="flex items-center justify-between hairline-b pb-stack-sm mb-stack-md">
                <h3 className="font-headline-lg text-2xl font-bold flex items-center gap-2">
                  <Scale size={18} /> The Vaada Ledger
                </h3>
                <button
                  onClick={() => navigate('/ledger')}
                  className="font-label-caps text-[10px] uppercase text-on-surface-variant hover:text-secondary transition-colors flex-shrink-0"
                >
                  See All →
                </button>
              </div>
              <div className="flex flex-col gap-stack-sm">
                {ledgerTeaser.map(v => (
                  <div
                    key={v.id}
                    onClick={() => navigate('/ledger')}
                    className="flex items-start gap-3 p-3 news-border bg-wash-warm hover:bg-surface-container-high transition-colors cursor-pointer group"
                  >
                    <span
                      className="font-headline-lg text-2xl font-bold leading-none flex-shrink-0"
                      style={{ color: v.verdict === 'W' ? '#0f7a4d' : '#9b2c3c' }}
                    >
                      {v.verdict}
                    </span>
                    <div className="min-w-0">
                      <p className="font-label-caps text-[10px] uppercase text-on-surface-variant">
                        {v.verdict === 'W' ? 'A win for' : 'An L for'} <strong className="text-primary">{v.subjectName}</strong>
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface mt-0.5 line-clamp-2 group-hover:text-secondary transition-colors">
                        {v.headline}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Voices of RAWINDIA — real bylines, ranked by real dispatch count
              in the current pool. No follower counts: this app has no social
              graph, and inventing one would be exactly the kind of fabricated
              number the rest of the site is built to avoid. */}
          {voices.length >= 2 && (
            <section>
              <h3 className="font-headline-lg text-2xl font-bold hairline-b pb-stack-sm mb-stack-md">
                Voices of RAWINDIA
              </h3>
              <div className="flex flex-col gap-stack-sm">
                {voices.map(v => (
                  <div
                    key={v.name}
                    onClick={() => onSelectArticle(v.latest)}
                    className="flex items-center justify-between p-3 news-border bg-wash-warm hover:bg-surface-container-high transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={v.avatar}
                        alt=""
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="font-body-sm text-body-sm font-bold text-on-surface truncate group-hover:text-secondary transition-colors">
                          {v.name}
                        </h4>
                        <p className="font-meta text-[11px] text-on-surface-variant">
                          {v.count} {v.count === 1 ? 'dispatch' : 'dispatches'}
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight size={16} className="text-on-surface-variant group-hover:text-secondary transition-colors flex-shrink-0" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};
