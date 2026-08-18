import React, { useState, useEffect } from 'react';
import { ChevronDown, GitCompare } from 'lucide-react';
import {
  getStoryCluster,
  analyzeCoverage,
  formatLag,
  type CoverageAnalysis,
  type CoverageClassification,
} from '../services/storyClusterService';
import { getFramingDiff, type FramingDiffResult } from '../services/framingDiffService';
import { toISTString } from '../utils/timeUtils';

function classificationBadgeClass(c: CoverageClassification): string {
  switch (c) {
    case 'First Report':   return 'bg-primary text-on-primary';
    case 'Near-Duplicate':  return 'border border-outline-variant text-on-surface-variant';
    case 'Rewrite':          return 'border border-secondary text-secondary';
    case 'Distinct Angle':   return 'news-border text-primary';
  }
}

/**
 * Only renders when this article was one of several outlets covering the
 * same story — see storyClusterService.ts for where that data comes from.
 * Most articles have no cross-source echo at all, and for those this
 * component renders nothing: an honest absence rather than an empty box.
 */
export const CoverageComparison: React.FC<{ articleId: string }> = ({ articleId }) => {
  const [analysis, setAnalysis]   = useState<CoverageAnalysis | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [diff, setDiff]           = useState<FramingDiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffRequested, setDiffRequested] = useState(false);

  useEffect(() => {
    setDiff(null);
    setDiffRequested(false);
    const cluster = getStoryCluster(articleId);
    setAnalysis(cluster ? analyzeCoverage(cluster) : null);
  }, [articleId]);

  if (!analysis || analysis.entries.length < 2) return null;

  const echoes = analysis.entries.filter(e => e.classification !== 'First Report');
  const bucketCounts = {
    'Near-Duplicate': echoes.filter(e => e.classification === 'Near-Duplicate').length,
    'Rewrite':         echoes.filter(e => e.classification === 'Rewrite').length,
    'Distinct Angle':  echoes.filter(e => e.classification === 'Distinct Angle').length,
  };
  const stenographyPct = Math.round(analysis.stenographyRatio * 100);

  const handleCompareFraming = () => {
    if (diffRequested) return;
    setDiffRequested(true);
    setDiffLoading(true);
    const cluster = getStoryCluster(articleId);
    if (!cluster) { setDiffLoading(false); return; }
    getFramingDiff(cluster).then(result => {
      setDiff(result);
      setDiffLoading(false);
    });
  };

  return (
    <section className="news-border bg-surface p-stack-md mb-6">
      <div
        className="flex justify-between items-center cursor-pointer hairline-b pb-2 mb-3"
        onClick={() => setDrawerOpen(!drawerOpen)}
      >
        <h3 className="font-label-caps text-label-caps uppercase font-bold text-primary">
          Coverage Comparison ({analysis.entries.length} Outlets)
        </h3>
        <ChevronDown
          size={14}
          className={`transition-transform duration-150 ${drawerOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {drawerOpen && (
        <div className="flex flex-col gap-4">
          <p className="font-meta text-meta text-on-surface-variant">
            Broken by <strong className="text-primary">{analysis.firstReport.source}</strong>, echoed by{' '}
            {echoes.length} more {echoes.length === 1 ? 'outlet' : 'outlets'} ({stenographyPct}% near-duplicate,
            i.e. likely wire/press-release copy rather than independent reporting).
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 font-meta text-meta text-on-surface-variant">
            <span><strong className="text-primary">{bucketCounts['Near-Duplicate']}</strong> near-duplicate</span>
            <span><strong className="text-secondary">{bucketCounts['Rewrite']}</strong> rewrites</span>
            <span><strong className="text-primary">{bucketCounts['Distinct Angle']}</strong> distinct angle{bucketCounts['Distinct Angle'] === 1 ? '' : 's'}</span>
          </div>

          <ol className="flex flex-col gap-2">
            {analysis.entries.map(entry => (
              <li
                key={entry.member.id}
                className="p-3 bg-surface-container-low news-border flex flex-col md:flex-row md:items-center gap-2"
              >
                <div className="flex items-center gap-2 md:w-48 flex-shrink-0">
                  <span className={`font-label-caps text-[10px] px-1.5 py-0.5 uppercase ${classificationBadgeClass(entry.classification)}`}>
                    {entry.classification}
                  </span>
                  <span className="font-meta text-meta text-on-surface-variant whitespace-nowrap">
                    {entry.echoLagMs === 0 ? toISTString(entry.member.publishedAt) : formatLag(entry.echoLagMs)}
                  </span>
                </div>
                <div className="flex-1">
                  <span className="font-body-sm text-body-sm font-semibold text-primary mr-2">{entry.member.source}:</span>
                  {entry.member.url ? (
                    <a
                      href={entry.member.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body-sm text-body-sm underline decoration-primary/40 hover:decoration-primary hover:text-secondary transition-colors"
                    >
                      {entry.member.title} <span aria-hidden>↗</span>
                    </a>
                  ) : (
                    <span className="font-body-sm text-body-sm">{entry.member.title}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <p className="font-meta text-[11px] text-on-surface-variant italic">
            "Near-duplicate" means the headline shares ≥75% of significant words with the first-reported
            version — a proxy for shared wire copy, not a judgment on the reporting itself.
          </p>

          {!diffRequested ? (
            <button
              onClick={handleCompareFraming}
              className="self-start flex items-center gap-2 font-label-caps text-label-caps uppercase px-3 py-2 news-border text-primary hover:bg-primary hover:text-on-primary transition-colors"
            >
              <GitCompare size={14} /> Compare Coverage Across Outlets
            </button>
          ) : diffLoading ? (
            <p className="font-meta text-meta text-on-surface-variant italic">Comparing headlines…</p>
          ) : diff ? (
            <div className="hairline-t pt-stack-sm flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Framing Divergence:</span>
                <span className="font-bold text-primary">{diff.divergenceScore}/100</span>
              </div>
              {diff.consensusFacts.length > 0 && (
                <div>
                  <h4 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-1">The News — What's Agreed</h4>
                  <ul className="list-disc pl-5 flex flex-col gap-1">
                    {diff.consensusFacts.map((c, i) => (
                      <li key={i} className="font-body-sm text-body-sm">{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {diff.disputedClaims.length > 0 && (
                <div>
                  <h4 className="font-label-caps text-label-caps uppercase text-secondary mb-1">Room for Disagreement</h4>
                  <ul className="list-disc pl-5 flex flex-col gap-1">
                    {diff.disputedClaims.map((c, i) => (
                      <li key={i} className="font-body-sm text-body-sm">{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {diff.wordChoiceContrasts.length > 0 && (() => {
                const totalWeight = diff.wordChoiceContrasts.reduce((s, w) => s + w.outlets.length, 0);
                return (
                  <div>
                    <h4 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-1">Word-Choice Contrasts</h4>
                    {totalWeight > 0 && (
                      <div className="flex h-1.5 mb-2 overflow-hidden news-border" aria-hidden>
                        {diff.wordChoiceContrasts.map((w, i) => (
                          <div
                            key={i}
                            className={i % 2 === 0 ? 'bg-primary' : 'bg-secondary'}
                            style={{ width: `${(w.outlets.length / totalWeight) * 100}%` }}
                            title={`"${w.term}" — ${w.outlets.join(', ')}`}
                          />
                        ))}
                      </div>
                    )}
                    <ul className="list-disc pl-5 flex flex-col gap-1">
                      {diff.wordChoiceContrasts.map((w, i) => (
                        <li key={i} className="font-body-sm text-body-sm">
                          <span className="font-body-serif italic">"{w.term}"</span> — used by {w.outlets.join(', ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
              {diff.omittedFacts.length > 0 && (
                <div>
                  <h4 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-1">What Only Some Outlets Mentioned</h4>
                  <ul className="list-disc pl-5 flex flex-col gap-1">
                    {diff.omittedFacts.map((f, i) => (
                      <li key={i} className="font-body-sm text-body-sm">
                        {f.fact} <span className="font-meta text-[11px] text-on-surface-variant">— mentioned by {f.mentionedBy.join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {diff.wordChoiceContrasts.length === 0 && diff.omittedFacts.length === 0
                && diff.consensusFacts.length === 0 && diff.disputedClaims.length === 0 && (
                <p className="font-meta text-meta text-on-surface-variant italic">
                  No meaningful framing difference detected — outlets covered this essentially the same way.
                </p>
              )}
              <p className="font-meta text-[11px] text-on-surface-variant italic hairline-t pt-2">
                This is a snapshot of headline-level framing, not a fact-check. RAWINDIA does not endorse or
                dispute any outlet's version here — it only shows how coverage differed.
              </p>
            </div>
          ) : (
            <p className="font-meta text-meta text-on-surface-variant italic">Comparison unavailable right now.</p>
          )}
        </div>
      )}
    </section>
  );
};
