import React, { useState } from 'react';
import type { Article, ContentType } from '../types';
import { Search, X, ArrowRight } from 'lucide-react';
import { TAXONOMY_DATA } from '../data/taxonomyData';
import { timeAgo } from '../utils/timeUtils';
import { useModalA11y } from '../hooks/useModalA11y';

interface SearchModalProps {
  articles: Article[];
  onSelectArticle: (article: Article) => void;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ articles, onSelectArticle, onClose }) => {
  const dialogRef = useModalA11y<HTMLDivElement>(onClose, { initialFocusSelector: 'input[type="text"]' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVertical, setSelectedVertical] = useState<number | 'ALL'>('ALL');
  const [selectedContentType, setSelectedContentType] = useState<ContentType | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<'all' | '24h' | '7d'>('all');

  const q = searchTerm.trim().toLowerCase();
  // Word-boundary match, not a bare substring test — short acronym queries
  // like "RBI" or "ISRO" would otherwise spuriously match unrelated words
  // that merely contain those letters in sequence ("aRBItrary", "oRBIt").
  const qRegex = q ? new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') : null;
  const matches = (text: string) => !qRegex || qRegex.test(text);

  const filteredArticles = articles.filter(art => {
    const matchTerm = !q ||
      matches(art.title) ||
      matches(art.subtitle) ||
      art.tags.some(t => matches(t)) ||
      art.factBlock.bullets.some(b => matches(b)) ||
      matches(art.author.name || '');
    const matchVertical = selectedVertical === 'ALL' || art.verticalId === selectedVertical;
    const matchType = selectedContentType === 'ALL' || art.contentType === selectedContentType;
    const now = Date.now();
    const pub = new Date(art.publishedAt).getTime();
    const matchDate = dateFilter === 'all' ||
      (dateFilter === '24h' && now - pub < 86_400_000) ||
      (dateFilter === '7d' && now - pub < 604_800_000);
    return matchTerm && matchVertical && matchType && matchDate;
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Global Archive & Faceted Search"
        tabIndex={-1}
        className="modal-dialog max-w-3xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <button className="modal-close-btn" onClick={onClose} aria-label="Close search">✕</button>

        <div className="font-label-caps text-label-caps uppercase text-primary mb-stack-sm hairline-b pb-stack-sm">
          Global Archive & Faceted Search
        </div>

        {/* Search input */}
        <div className="relative mb-stack-md">
          <Search size={16} className="absolute left-3 top-3 text-outline" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search keywords, ministries, judges, bills, states, authors..."
            className="w-full pl-9 pr-10 py-2.5 news-border bg-surface text-on-surface font-meta text-meta focus:outline-none focus:border-primary"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} aria-label="Clear search" className="absolute right-3 top-3 text-outline hover:text-primary">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-stack-md p-stack-sm bg-wash-warm news-border">
          {[
            {
              label: 'Vertical', value: selectedVertical,
              onChange: (v: string) => setSelectedVertical(v === 'ALL' ? 'ALL' : Number(v)),
              options: [{ value: 'ALL', label: 'All 16 Verticals' }, ...TAXONOMY_DATA.map(v => ({ value: String(v.id), label: `${v.number}. ${v.name}` }))]
            },
            {
              label: 'Type', value: selectedContentType,
              onChange: (v: string) => setSelectedContentType(v as ContentType | 'ALL'),
              options: [
                { value: 'ALL', label: 'All Types' },
                { value: 'NEWS', label: 'NEWS' },
                { value: 'GROUND REPORT', label: 'GROUND REPORT' },
                { value: 'ANALYSIS', label: 'ANALYSIS' },
                { value: 'OPINION', label: 'OPINION' },
              ]
            },
            {
              label: 'Date', value: dateFilter,
              onChange: (v: string) => setDateFilter(v as 'all' | '24h' | '7d'),
              options: [
                { value: 'all', label: 'All Time' },
                { value: '24h', label: 'Past 24 Hours' },
                { value: '7d', label: 'Past 7 Days' },
              ]
            },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-2">
              <span className="font-label-caps text-[10px] uppercase text-outline">{f.label}:</span>
              <select
                value={String(f.value)}
                onChange={e => f.onChange(e.target.value)}
                className="bg-surface news-border py-1 px-2 font-label-caps text-[11px] focus:outline-none"
              >
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto flex flex-col gap-2">
          <div className="font-label-caps text-[10px] uppercase text-outline mb-1">
            Matching Dispatches ({filteredArticles.length})
          </div>

          {filteredArticles.length === 0 ? (
            <div className="text-center py-8 news-border bg-surface-container-low">
              <p className="font-body-sm text-body-sm text-on-surface-variant">No dispatches match your search.</p>
              <button
                onClick={() => { setSearchTerm(''); setSelectedVertical('ALL'); setSelectedContentType('ALL'); setDateFilter('all'); }}
                className="mt-2 font-label-caps text-label-caps uppercase text-secondary hover:underline text-[11px]"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            filteredArticles.map(art => (
              <div
                key={art.id}
                onClick={() => { onSelectArticle(art); onClose(); }}
                className="news-border p-3 bg-surface hover:bg-surface-container-low cursor-pointer flex items-center justify-between gap-3 group transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-label-caps text-[10px] uppercase news-border px-1.5 py-0.5">{art.contentType}</span>
                    <span className="font-meta text-[10px] text-outline">{art.verticalName}</span>
                    <span className="font-meta text-[10px] text-outline">{timeAgo(art.publishedAt)}</span>
                  </div>
                  <h4 className="font-headline-lg text-base font-bold text-primary leading-snug group-hover:text-secondary transition-colors line-clamp-2">
                    {art.title}
                  </h4>
                </div>
                <ArrowRight size={14} className="text-outline flex-shrink-0 group-hover:text-secondary transition-colors" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
