/**
 * RAWINDIA — The Vaada Ledger
 *
 * The flagship reader-facing page from Operation Vaada: a running feed of
 * verified W/L takes, and the Vaada Clock's tracked promises with their full
 * deadline-extension history. Both tabs read ONLY 'verified' records — an
 * ai-flagged candidate that hasn't cleared /ops/review never appears here.
 * See PRD §4.1/§4.2.
 *
 * "Ledger at a Glance" + the Most Overdue / Most Extended spotlights below
 * are all pure computation over the same real, verified records already
 * rendered further down — nothing here is a separate estimate that could
 * drift from what a reader sees in the full lists.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, Scale, Clock, Flame, TrendingUp, ArrowUpRight } from 'lucide-react';
import type { VerdictEvent, TrackedPromise } from '../services/persistenceService';
import { getLedgerBundle } from '../services/sharedLedgerService';
import { institutionToPath } from '../utils/routing';
import { VerdictCardModal } from './VerdictCardModal';
import { VaadaClockCard } from './VaadaClockCard';
import { timeAgo } from '../utils/timeUtils';

type Tab = 'lw' | 'vaada';
type VerdictFilter = 'all' | 'W' | 'L';
type PromiseStatusFilter = 'all' | TrackedPromise['status'];

const OPEN_STATUSES: TrackedPromise['status'][] = ['in-progress', 'extended', 'stalled'];

function daysOverdue(p: TrackedPromise): number {
  if (!OPEN_STATUSES.includes(p.status)) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(p.originalDeadline).getTime()) / 86_400_000));
}

export const LedgerView: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('lw');
  const [verdicts, setVerdicts] = useState<VerdictEvent[] | null>(null);
  const [promises, setPromises] = useState<TrackedPromise[] | null>(null);
  const [shareVerdict, setShareVerdict] = useState<VerdictEvent | null>(null);
  const [sharePromise, setSharePromise] = useState<TrackedPromise | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all');
  const [statusFilter, setStatusFilter] = useState<PromiseStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    getLedgerBundle().then(({ verdicts: v, promises: p }) => {
      if (cancelled) return;
      setVerdicts(v.filter(x => x.trustTier === 'verified').sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setPromises(p.filter(x => x.trustTier === 'verified').sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    });
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    if (!verdicts || !promises) return null;
    const wins = verdicts.filter(v => v.verdict === 'W').length;
    const losses = verdicts.filter(v => v.verdict === 'L').length;
    const byStatus = (s: TrackedPromise['status']) => promises.filter(p => p.status === s).length;
    return {
      wins, losses,
      kept: byStatus('kept'), broken: byStatus('broken'),
      extended: byStatus('extended'), stalled: byStatus('stalled'), inProgress: byStatus('in-progress'),
      totalPromises: promises.length,
    };
  }, [verdicts, promises]);

  const mostOverdue = useMemo(() => {
    if (!promises) return [];
    return [...promises].filter(p => daysOverdue(p) > 0).sort((a, b) => daysOverdue(b) - daysOverdue(a)).slice(0, 5);
  }, [promises]);

  const mostExtended = useMemo(() => {
    if (!promises) return [];
    return [...promises].filter(p => p.extensionHistory.length > 0)
      .sort((a, b) => b.extensionHistory.length - a.extensionHistory.length).slice(0, 5);
  }, [promises]);

  const categories = useMemo(() => {
    if (!promises) return [];
    return Array.from(new Set(promises.map(p => p.category))).sort();
  }, [promises]);

  const filteredVerdicts = useMemo(() => {
    if (!verdicts) return null;
    return verdictFilter === 'all' ? verdicts : verdicts.filter(v => v.verdict === verdictFilter);
  }, [verdicts, verdictFilter]);

  const filteredPromises = useMemo(() => {
    if (!promises) return null;
    return promises.filter(p =>
      (statusFilter === 'all' || p.status === statusFilter) &&
      (categoryFilter === 'all' || p.category === categoryFilter)
    );
  }, [promises, statusFilter, categoryFilter]);

  return (
    <div className="max-w-5xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg animate-fade-in">
      <div className="hairline-b pb-stack-md mb-stack-lg">
        <span className="font-label-caps text-label-caps uppercase text-secondary">The Vaada Ledger</span>
        <h1 className="font-headline-xl text-headline-xl font-bold text-primary leading-tight">Who Kept Their Word</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 max-w-2xl">
          A running, sourced record of who a policy or ruling actually favored — and every promise still on the
          clock, with every deadline it's ever missed left on the record instead of quietly forgotten.
        </p>
      </div>

      {/* Ledger at a Glance — real aggregate stats, no separate estimate.
          Each tile jumps straight to that slice via the same tab/filter
          state the buttons below already use — not a separate view. */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-stack-lg">
          {[
            { label: 'Wins Logged', value: stats.wins, color: '#0f7a4d', onClick: () => { setTab('lw'); setVerdictFilter('W'); } },
            { label: 'Losses Logged', value: stats.losses, color: '#9b2c3c', onClick: () => { setTab('lw'); setVerdictFilter('L'); } },
            { label: 'Kept', value: stats.kept, color: '#0f7a4d', onClick: () => { setTab('vaada'); setStatusFilter('kept'); } },
            { label: 'Broken', value: stats.broken, color: '#9b2c3c', onClick: () => { setTab('vaada'); setStatusFilter('broken'); } },
            { label: 'Extended', value: stats.extended, color: '#8a5a10', onClick: () => { setTab('vaada'); setStatusFilter('extended'); } },
            { label: 'Still Tracking', value: stats.inProgress + stats.stalled, color: '#444748', onClick: () => { setTab('vaada'); setStatusFilter('in-progress'); } },
          ].map(s => (
            <button
              key={s.label}
              onClick={s.onClick}
              className="news-border bg-surface p-3 text-center hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              <div className="font-display-lg text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="font-label-caps text-[9px] uppercase text-on-surface-variant mt-1">{s.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Spotlights — real rankings over the same records shown below, not a separate claim */}
      {(mostOverdue.length > 0 || mostExtended.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter mb-stack-lg">
          {mostOverdue.length > 0 && (
            <div className="news-border bg-wash-warm p-stack-sm">
              <h3 className="font-label-caps text-label-caps uppercase font-bold text-secondary mb-2 flex items-center gap-1.5">
                <Flame size={13} /> Most Overdue Right Now
              </h3>
              <ul className="flex flex-col gap-2">
                {mostOverdue.map(p => (
                  <li
                    key={p.id}
                    onClick={() => navigate(institutionToPath(p.subjectName))}
                    className="flex items-baseline justify-between gap-2 font-meta text-[12px] cursor-pointer group"
                  >
                    <span className="text-on-surface truncate group-hover:text-secondary group-hover:underline transition-colors flex items-center gap-1">
                      {p.subjectName}
                      <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </span>
                    <span className="font-bold text-secondary flex-shrink-0">{daysOverdue(p).toLocaleString('en-IN')}d</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {mostExtended.length > 0 && (
            <div className="news-border bg-wash-warm p-stack-sm">
              <h3 className="font-label-caps text-label-caps uppercase font-bold text-[#8a5a10] mb-2 flex items-center gap-1.5">
                <TrendingUp size={13} /> Most Extended Promises
              </h3>
              <ul className="flex flex-col gap-2">
                {mostExtended.map(p => (
                  <li
                    key={p.id}
                    onClick={() => navigate(institutionToPath(p.subjectName))}
                    className="flex items-baseline justify-between gap-2 font-meta text-[12px] cursor-pointer group"
                  >
                    <span className="text-on-surface truncate group-hover:text-secondary group-hover:underline transition-colors flex items-center gap-1">
                      {p.subjectName}
                      <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </span>
                    <span className="font-bold text-[#8a5a10] flex-shrink-0">×{p.extensionHistory.length}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-6 hairline-b mb-stack-lg">
        <button
          onClick={() => setTab('lw')}
          className={`flex items-center gap-2 font-label-caps text-label-caps uppercase pb-3 border-b-2 transition-colors ${tab === 'lw' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-secondary'}`}
        >
          <Scale size={14} /> L/W Takes
        </button>
        <button
          onClick={() => setTab('vaada')}
          className={`flex items-center gap-2 font-label-caps text-label-caps uppercase pb-3 border-b-2 transition-colors ${tab === 'vaada' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-secondary'}`}
        >
          <Clock size={14} /> Vaada Clock
        </button>
      </div>

      {tab === 'lw' && (
        verdicts === null ? (
          <p className="font-meta text-meta text-on-surface-variant italic">Loading takes…</p>
        ) : verdicts.length === 0 ? (
          <EmptyState label="No verified takes yet — candidates surface here once a human clears them at /ops/review." />
        ) : (
          <>
            <div className="flex gap-2 mb-stack-md">
              {(['all', 'W', 'L'] as VerdictFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setVerdictFilter(f)}
                  className={`font-label-caps text-[10px] uppercase px-3 py-1.5 news-border transition-colors ${verdictFilter === f ? 'bg-primary text-on-primary' : 'hover:bg-surface-container'}`}
                >
                  {f === 'all' ? 'All' : f === 'W' ? 'Wins Only' : 'Losses Only'}
                </button>
              ))}
            </div>
            <ul className="flex flex-col gap-3">
              {filteredVerdicts!.map(v => (
                <li key={v.id} className="news-border bg-surface p-stack-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <span
                        className="font-headline-xl text-5xl font-bold leading-none flex-shrink-0"
                        style={{ color: v.verdict === 'W' ? '#0f7a4d' : '#9b2c3c' }}
                      >
                        {v.verdict}
                      </span>
                      <div>
                        <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">
                          {v.verdict === 'W' ? 'A win for' : 'An L for'} <strong className="text-primary">{v.subjectName}</strong>
                        </span>
                        <p className="font-body-serif text-body-md text-primary mt-1">{v.headline}</p>
                        <div className="flex items-center gap-3 mt-2 font-meta text-[11px] text-on-surface-variant">
                          {v.sourceUrl && (
                            <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline-link">Source</a>
                          )}
                          <span>{timeAgo(v.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShareVerdict(v)}
                      className="flex items-center gap-1 font-label-caps text-[10px] uppercase text-on-surface-variant hover:text-secondary transition-colors flex-shrink-0"
                      aria-label="Share this verdict"
                    >
                      <Share2 size={12} /> Share
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {filteredVerdicts!.length === 0 && (
              <EmptyState label="Nothing matches this filter yet." />
            )}
          </>
        )
      )}

      {tab === 'vaada' && (
        promises === null ? (
          <p className="font-meta text-meta text-on-surface-variant italic">Loading promises…</p>
        ) : promises.length === 0 ? (
          <EmptyState label="No verified promises yet — candidates surface here once a human clears them at /ops/review." />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-stack-md">
              {(['all', 'in-progress', 'extended', 'stalled', 'broken', 'kept'] as PromiseStatusFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`font-label-caps text-[10px] uppercase px-3 py-1.5 news-border transition-colors ${statusFilter === f ? 'bg-primary text-on-primary' : 'hover:bg-surface-container'}`}
                >
                  {f === 'all' ? 'All Statuses' : f.replace('-', ' ')}
                </button>
              ))}
              {categories.length > 1 && (
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="font-label-caps text-[10px] uppercase px-3 py-1.5 news-border bg-surface"
                >
                  <option value="all">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              {filteredPromises!.map(p => (
                <VaadaClockCard key={p.id} promise={p} onShare={setSharePromise} />
              ))}
            </div>
            {filteredPromises!.length === 0 && (
              <EmptyState label="Nothing matches this filter yet." />
            )}
          </>
        )
      )}

      <p className="font-meta text-[11px] text-on-surface-variant italic mt-stack-lg">
        Every entry here has been reviewed by a human against its actual source before appearing — an
        AI-flagged candidate that hasn't cleared review is never shown, ever.
      </p>

      {shareVerdict && <VerdictCardModal type="lw-verdict" verdict={shareVerdict} onClose={() => setShareVerdict(null)} />}
      {sharePromise && <VerdictCardModal type="promise-status" promise={sharePromise} onClose={() => setSharePromise(null)} />}
    </div>
  );
};

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="news-border bg-surface-container-low p-stack-lg text-center">
    <p className="font-body-sm text-body-sm text-on-surface-variant">{label}</p>
  </div>
);
