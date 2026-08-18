import React, { useMemo, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Article } from '../types';
import { timeAgo } from '../utils/timeUtils';
import { tagToSlug } from '../utils/routing';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { getLatestArticles } from '../services/persistenceService';

interface TagFeedViewProps {
  articles: Article[];
  onSelectArticle: (article: Article) => void;
}

// One entry per calendar day (IST) that has at least one dispatch on this topic.
interface DayGroup {
  dateKey: string;       // YYYY-MM-DD, IST
  dateLabel: string;     // "14 Aug"
  articles: Article[];
}

function istDateKey(iso: string): string {
  // en-CA gives YYYY-MM-DD directly — the one Intl locale format that does.
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function groupByDay(articles: Article[]): DayGroup[] {
  const byDay = new Map<string, Article[]>();
  for (const art of articles) {
    const key = istDateKey(art.publishedAt);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(art);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // newest day first
    .map(([dateKey, dayArticles]) => ({
      dateKey,
      dateLabel: new Date(dateKey).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      articles: dayArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
    }));
}

export const TagFeedView: React.FC<TagFeedViewProps> = ({ articles, onSelectArticle }) => {
  const { tagSlug } = useParams();
  // The live feed pool (`articles` prop) is capped to the currently-loaded
  // window and doesn't reflect how far back this topic actually goes. A
  // "story evolution" view is the one place that gap actually matters, so
  // this pulls the full local archive once per topic rather than reusing
  // the capped in-memory pool everywhere else on the site relies on.
  const [archived, setArchived] = useState<Article[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setArchived(null);
    getLatestArticles(5000).then(all => { if (!cancelled) setArchived(all); }).catch(() => { if (!cancelled) setArchived([]); });
    return () => { cancelled = true; };
  }, [tagSlug]);

  const { matchedTag, tagged, days } = useMemo(() => {
    // Merge, don't replace — an empty (or still-loading) persisted archive
    // would otherwise blow away in-memory-only articles (seed/demo data, or
    // anything freshly fetched but not yet persisted) that genuinely do
    // carry this tag, making a tag page falsely claim "0 dispatches" for a
    // topic the reader just came from.
    const pool = archived === null
      ? articles
      : [...archived, ...articles.filter(a => !archived.some(x => x.id === a.id))];
    let found: string | undefined;
    const matches = tagSlug
      ? pool.filter(a => a.tags.some(t => {
          const isMatch = tagToSlug(t) === tagSlug;
          if (isMatch && !found) found = t;
          return isMatch;
        }))
      : [];
    return { matchedTag: found, tagged: matches, days: groupByDay(matches) };
  }, [archived, articles, tagSlug]);

  useDocumentMeta({
    title: `${matchedTag || tagSlug} — RAWINDIA`,
    description: `${tagged.length} RAWINDIA dispatches tagged ${matchedTag || tagSlug}.`,
  });

  const maxPerDay = Math.max(1, ...days.map(d => d.articles.length));
  const spanLabel = days.length >= 2
    ? `Tracked across ${days.length} days, ${days[days.length - 1].dateLabel} to ${days[0].dateLabel}`
    : null;

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg animate-fade-in">
      <div className="hairline-b pb-stack-md mb-stack-lg">
        <span className="font-label-caps text-label-caps uppercase text-secondary">Story So Far</span>
        <h1 className="font-headline-xl text-headline-xl font-bold text-primary leading-tight">
          {matchedTag || tagSlug}
        </h1>
        <p className="font-meta text-meta text-on-surface-variant mt-1">
          {archived === null
            ? 'Loading…'
            : `${tagged.length} ${tagged.length === 1 ? 'dispatch' : 'dispatches'}${spanLabel ? ` · ${spanLabel}` : ''}`}
        </p>
      </div>

      {archived === null ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="pb-stack-md">
              <div className="w-full h-44 mb-2 news-border bg-surface-container-low" />
              <div className="h-3 w-20 bg-surface-container-low mb-2" />
              <div className="h-4 w-full bg-surface-container-low mb-1" />
              <div className="h-4 w-2/3 bg-surface-container-low" />
            </div>
          ))}
        </div>
      ) : tagged.length === 0 ? (
        <div className="text-center py-16 news-border bg-surface-container-low">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No dispatches currently tagged with this topic.
          </p>
        </div>
      ) : (
        <>
          {/* ── Coverage intensity — how much this story has been in the wire, day by day. ── */}
          {days.length >= 3 && (
            <div className="mb-section-gap">
              <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">
                Coverage Intensity
              </h2>
              <div className="flex items-end gap-1 h-16" role="img" aria-label={`Coverage volume for ${matchedTag} across ${days.length} days`}>
                {[...days].reverse().map(d => (
                  <div
                    key={d.dateKey}
                    className="flex-1 flex flex-col items-center justify-end gap-1 group"
                    title={`${d.dateLabel}: ${d.articles.length} ${d.articles.length === 1 ? 'dispatch' : 'dispatches'}`}
                  >
                    <div
                      className="w-full bg-secondary/70 group-hover:bg-secondary transition-colors"
                      style={{ height: `${Math.max(8, (d.articles.length / maxPerDay) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-meta text-[10px] text-outline mt-1">
                <span>{days[days.length - 1].dateLabel}</span>
                <span>{days[0].dateLabel}</span>
              </div>
            </div>
          )}

          {/* ── The timeline itself — grouped by day, newest first. ── */}
          <div className="flex flex-col gap-section-gap">
            {days.map(day => (
              <div key={day.dateKey}>
                <div className="flex items-center gap-3 mb-stack-md">
                  <span className="pulse-dot" />
                  <h3 className="font-label-caps text-label-caps uppercase text-primary">
                    {day.dateLabel}
                  </h3>
                  <span className="font-meta text-[11px] text-outline">
                    {day.articles.length} {day.articles.length === 1 ? 'dispatch' : 'dispatches'}
                  </span>
                  <span className="flex-1 hairline-b" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
                  {day.articles.map(art => (
                    <article
                      key={art.id}
                      onClick={() => onSelectArticle(art)}
                      className="cursor-pointer group hairline-b pb-stack-md"
                    >
                      {art.heroImage ? (
                        <div className="img-wrapper mb-2">
                          <img
                            src={art.heroImage}
                            alt={art.title}
                            loading="lazy"
                            onError={e => { (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&auto=format&fit=crop&q=80`; }}
                            className="w-full h-44 object-cover editorial-img"
                          />
                        </div>
                      ) : (
                        <div className="img-placeholder w-full h-28 mb-2 news-border flex items-center justify-center">
                          <span className="font-label-caps text-[9px] uppercase text-outline">Image Archived</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-label-caps text-[10px] uppercase px-1.5 py-0.5 news-border text-primary">
                          {art.contentType}
                        </span>
                        <span className="font-meta text-[10px] text-outline">{timeAgo(art.publishedAt)}</span>
                      </div>
                      <h3 className="font-headline-lg text-base font-bold text-on-surface group-hover:text-secondary transition-colors leading-snug mb-1">
                        {art.title}
                      </h3>
                      <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2">
                        {art.subtitle}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
