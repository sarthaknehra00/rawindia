import React from 'react';
import type { Article } from '../types';
import { ArrowLeft, ShieldCheck, Radio } from 'lucide-react';
import { timeAgo, toISTString } from '../utils/timeUtils';

interface LiveBlogViewProps {
  article: Article;
  onBack: () => void;
}

export const LiveBlogView: React.FC<LiveBlogViewProps> = ({ article, onBack }) => {
  const updates = article.liveUpdates ?? [];

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between hairline-b pb-3 mb-6 flex-wrap gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-primary transition-colors font-bold"
        >
          <ArrowLeft size={13} /> Back to Feed
        </button>
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-error animate-pulse" />
          <span className="font-label-caps text-label-caps uppercase text-error font-bold">Live Verified Blog</span>
        </div>
      </div>

      {/* Article header */}
      <header className="mb-stack-lg">
        <div className="inline-block border border-error px-3 py-1 mb-stack-sm">
          <span className="font-label-caps text-label-caps uppercase text-error">Breaking Live Stream</span>
        </div>
        <h1 className="font-headline-xl text-headline-xl font-bold text-primary mb-stack-sm leading-tight">
          {article.title}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-stack-md">
          {article.subtitle}
        </p>
        <div className="font-meta text-meta text-on-surface-variant hairline-t pt-2">
          By {article.author.name} · {toISTString(article.publishedAt)} · {timeAgo(article.publishedAt)}
        </div>
      </header>

      {/* Fact Block */}
      <div className="bg-wash-warm news-border p-stack-md mb-stack-lg relative">
        <div className="absolute -top-3 left-4 bg-primary text-on-primary px-3 py-1">
          <span className="font-label-caps text-label-caps uppercase flex items-center gap-2">
            <ShieldCheck size={13} /> Mission Brief
          </span>
        </div>
        <ul className="mt-stack-sm space-y-2">
          {article.factBlock.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 font-body-sm text-body-sm">
              <span className="text-secondary font-bold flex-shrink-0">→</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Timeline header */}
      <div className="hairline-b pb-2 mb-stack-lg flex items-center justify-between">
        <h3 className="font-headline-lg text-headline-lg font-bold uppercase">Verified Developments</h3>
        <span className="font-meta text-meta text-on-surface-variant italic">Reverse chronological</span>
      </div>

      {updates.length === 0 ? (
        <div className="news-border p-stack-lg text-center">
          <Radio size={24} className="text-outline mx-auto mb-2 animate-pulse" />
          <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">Live updates loading...</p>
          <p className="font-meta text-meta text-on-surface-variant mt-1">
            Our correspondents are on the ground. Refresh for latest.
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-hairline-grey" />
          <div className="flex flex-col gap-0">
            {updates.map((update, i) => (
              <div key={update.id} className={`relative pl-10 ${i < updates.length - 1 ? 'pb-stack-lg' : ''}`}>
                <div className="absolute left-3 top-1.5 w-2.5 h-2.5 bg-primary border-2 border-surface" />
                <div className="font-label-caps text-label-caps text-secondary uppercase mb-1">{update.time}</div>
                <div className="news-border p-stack-md bg-surface">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-primary text-on-primary font-label-caps text-[10px] px-2 py-0.5 uppercase">{update.sourceType}</span>
                      {update.verified && <span className="text-verified-text font-meta text-meta font-bold">✓ Verified</span>}
                    </div>
                    <span className="font-meta text-meta text-on-surface-variant">By {update.author}</span>
                  </div>
                  <h4 className="font-headline-lg text-headline-lg font-bold text-primary mb-2 leading-snug">{update.headline}</h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{update.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
