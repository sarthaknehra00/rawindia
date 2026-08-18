/**
 * RAWINDIA — Vaada Clock Card
 *
 * One tracked promise's deadline history, rendered as a literal running
 * clock: the original deadline, every push since, and — for anything still
 * open — a live "days overdue" count. Shared between the Ledger's Vaada
 * Clock tab and the Netaji Report Card, so a promise looks identical
 * wherever it's shown. See PRD §4.2/§8.
 */

import React from 'react';
import { Share2 } from 'lucide-react';
import type { TrackedPromise } from '../services/persistenceService';

const STATUS_STYLE: Record<TrackedPromise['status'], { label: string; color: string }> = {
  kept:        { label: 'Kept',        color: '#0f7a4d' },
  broken:      { label: 'Broken',      color: '#9b2c3c' },
  extended:    { label: 'Extended',    color: '#8a5a10' },
  stalled:     { label: 'Stalled',     color: '#8a5a10' },
  'in-progress': { label: 'In Progress', color: '#444748' },
};

function fmt(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

interface VaadaClockCardProps {
  promise: TrackedPromise;
  onShare?: (promise: TrackedPromise) => void;
}

export const VaadaClockCard: React.FC<VaadaClockCardProps> = ({ promise, onShare }) => {
  const style = STATUS_STYLE[promise.status];
  const isOpen = promise.status === 'in-progress' || promise.status === 'extended' || promise.status === 'stalled';
  const overdueDays = isOpen ? daysBetween(promise.originalDeadline, new Date().toISOString()) : null;
  const dates = [promise.originalDeadline, ...promise.extensionHistory.map(e => e.to)];

  return (
    <div className="news-border bg-surface p-stack-sm">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="font-label-caps text-[10px] uppercase font-bold" style={{ color: style.color }}>
          {style.label}
          {promise.extensionHistory.length > 0 && ` · Extended ×${promise.extensionHistory.length}`}
        </span>
        {onShare && (
          <button
            onClick={() => onShare(promise)}
            className="flex items-center gap-1 font-label-caps text-[10px] uppercase text-on-surface-variant hover:text-secondary transition-colors flex-shrink-0"
            aria-label="Share this promise card"
          >
            <Share2 size={12} /> Share
          </button>
        )}
      </div>

      <p className="font-body-serif text-body-md text-primary mb-3">"{promise.promiseText}"</p>
      <p className="font-meta text-[11px] text-on-surface-variant mb-3">{promise.subjectName}</p>

      <div className="flex items-center gap-2 flex-wrap font-meta text-[12px] mb-2">
        {dates.map((d, i) => {
          const isLast = i === dates.length - 1;
          return (
            <React.Fragment key={i}>
              <span className={isLast ? 'font-bold' : 'line-through text-on-surface-variant'} style={isLast ? { color: style.color } : undefined}>
                {fmt(d)}
              </span>
              {!isLast && <span className="text-outline">→</span>}
            </React.Fragment>
          );
        })}
      </div>

      {overdueDays !== null && overdueDays > 0 && (
        <p className="font-display-lg text-2xl font-bold" style={{ color: style.color }}>
          {overdueDays.toLocaleString('en-IN')}
          <span className="font-label-caps text-[10px] uppercase text-on-surface-variant font-normal ml-2">
            days overdue on the original deadline
          </span>
        </p>
      )}

      {promise.evidenceLinks.length > 0 && (
        <a
          href={promise.evidenceLinks[0]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-link font-meta text-[11px] text-on-surface-variant mt-2 inline-block"
        >
          Source
        </a>
      )}
    </div>
  );
};
