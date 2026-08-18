import React, { useState } from 'react';
import type { Article } from '../types';
import { calculateInterestScore } from '../services/rankingEngineService';
import { useModalA11y } from '../hooks/useModalA11y';

interface RankingInspectorModalProps {
  article: Article;
  onClose: () => void;
}

const SECTION_CONFIG = {
  homepageHero:     { interest: 0.50, importance: 0.50, label: 'Homepage Top Slot (50/50 Balanced)' },
  default:          { interest: 0.60, importance: 0.40, label: 'Standard Newsfeed (60/40)' },
  trendingRail:     { interest: 0.80, importance: 0.20, label: 'Trending / Buzz Rail (80/20 Interest-Heavy)' },
  nationalPolitics: { interest: 0.40, importance: 0.60, label: 'National & Policy (40/60 Substance-Heavy)' },
} as const;

type SectionKey = keyof typeof SECTION_CONFIG;

const TIER_COLORS: Record<string, string> = {
  P0: 'bg-error text-on-error',
  P1: 'bg-secondary text-on-secondary',
  P2: 'bg-primary text-on-primary',
  P3: 'bg-on-surface-variant text-on-primary',
  EVERGREEN: 'bg-surface-container-high text-on-surface',
};

const TIER_DESC: Record<string, string> = {
  P0: 'Breaking / Critical — Top homepage banner + push notification',
  P1: 'High Priority — Homepage top rails + category page lead',
  P2: 'Standard Wire — Normal category placement',
  P3: 'Low Priority — Archived, searchable, not actively promoted',
  EVERGREEN: 'Evergreen — Resurfaced contextually alongside breaking stories',
};

export const RankingInspectorModal: React.FC<RankingInspectorModalProps> = ({ article, onClose }) => {
  const ranking = article.ranking;
  const [activeSection, setActiveSection] = useState<SectionKey>('homepageHero');
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  if (!ranking) return null;

  const w = SECTION_CONFIG[activeSection];

  // Recalculate interest score in case we need a fresh value
  const halfLife = article.isBreaking ? 2.5 : article.tags.includes('Evergreen') ? 24 : 4.5;
  const { interestScore: liveInterest } = calculateInterestScore(ranking.interestSignals, article.publishedAt, halfLife);

  // Recalculate combined priority for selected section weights
  let calculatedPriority = Math.round(liveInterest * w.interest + ranking.importanceScore * w.importance);
  if (ranking.importanceFloorOverride) calculatedPriority = Math.max(calculatedPriority, 82);

  const tierForSection = calculatedPriority >= 80 || ranking.importanceFloorOverride
    ? 'P0' : calculatedPriority >= 62 ? 'P1' : calculatedPriority >= 38 ? 'P2' : 'P3';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Why is this story ranked here?"
        tabIndex={-1}
        className="modal-dialog max-w-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="modal-close-btn" aria-label="Close">✕</button>

        {/* Header */}
        <div className="hairline-b pb-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-primary text-on-primary font-label-caps text-label-caps px-2 py-0.5 uppercase">
              Editorial Ranking Transparency
            </span>
            <span className={`font-label-caps text-label-caps px-2 py-0.5 uppercase ${TIER_COLORS[ranking.priorityTier] || 'bg-primary text-on-primary'}`}>
              Tier {ranking.priorityTier}
            </span>
          </div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-primary leading-tight">
            Why is this story ranked here?
          </h2>
          <p className="font-meta text-meta text-outline mt-1 truncate italic">
            {article.title}
          </p>
        </div>

        {/* Floor Override Alert */}
        {ranking.importanceFloorOverride && (
          <div className="border border-error bg-error-container p-stack-md mb-4 flex items-start gap-3">
            <span className="text-error text-xl flex-shrink-0">⚠</span>
            <div>
              <strong className="font-label-caps text-label-caps uppercase text-on-error-container block mb-1">
                Importance Floor Override Active
              </strong>
              <p className="font-body-sm text-body-sm text-on-error-container">
                This story triggers the Floor Override — it involves{' '}
                <strong>{ranking.importanceFactors.severity} severity</strong> on a{' '}
                <strong>{ranking.importanceFactors.scaleOfImpact}-scale</strong> event with{' '}
                <strong>{ranking.importanceFactors.institutionalSignificance}</strong> institutional significance.
                It is <strong>guaranteed a P0 protected slot</strong> regardless of current click volume, so critical
                public matters are never buried by celebrity buzz.
              </p>
            </div>
          </div>
        )}

        {/* Section weight selector + live score */}
        <div className="bg-wash-warm news-border p-stack-md mb-4">
          <div className="flex justify-between items-center mb-stack-sm flex-wrap gap-2">
            <div>
              <div className="font-label-caps text-label-caps uppercase text-primary mb-1">
                Combined Priority Score
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display-lg text-4xl font-bold text-primary">{calculatedPriority}</span>
                <span className="font-meta text-meta text-outline">/100</span>
                <span className={`font-label-caps text-label-caps px-2 py-0.5 ml-2 ${TIER_COLORS[tierForSection]}`}>
                  {tierForSection}
                </span>
              </div>
              <p className="font-meta text-meta text-outline mt-1 italic">{TIER_DESC[tierForSection]}</p>
            </div>
            <select
              value={activeSection}
              onChange={e => setActiveSection(e.target.value as SectionKey)}
              className="bg-surface news-border font-label-caps text-label-caps uppercase py-1.5 px-2 focus:outline-none"
            >
              <option value="homepageHero">Homepage Slot (50/50)</option>
              <option value="default">Standard Feed (60/40)</option>
              <option value="trendingRail">Trending Rail (80/20)</option>
              <option value="nationalPolitics">National & Policy (40/60)</option>
            </select>
          </div>

          {/* Score bars — update with selected section weights */}
          <div className="grid grid-cols-2 gap-3 pt-3 hairline-t font-meta text-meta">
            <div>
              <div className="flex justify-between mb-1">
                <span>Interest Score (I):</span>
                <strong>{liveInterest}/100</strong>
              </div>
              <div className="w-full bg-surface-variant h-2">
                <div className="bg-primary h-2 transition-all" style={{ width: `${liveInterest}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-outline">
                <span>Weight in this section: <strong>{Math.round(w.interest * 100)}%</strong></span>
                <span>Contribution: {Math.round(liveInterest * w.interest)}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>Importance Score (M):</span>
                <strong className="text-secondary">{ranking.importanceScore}/100</strong>
              </div>
              <div className="w-full bg-surface-variant h-2">
                <div className="bg-secondary h-2 transition-all" style={{ width: `${ranking.importanceScore}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-outline">
                <span>Weight in this section: <strong>{Math.round(w.importance * 100)}%</strong></span>
                <span>Contribution: {Math.round(ranking.importanceScore * w.importance)}</span>
              </div>
            </div>
          </div>

          <p className="font-meta text-meta text-outline mt-3 pt-2 hairline-t">
            Formula:{' '}
            <code className="bg-surface-container px-1 border border-outline-variant">
              ({liveInterest} × {w.interest}) + ({ranking.importanceScore} × {w.importance}){ranking.importanceFloorOverride ? ' + Floor Override → P0' : ''} = {calculatedPriority}
            </code>
          </p>
        </div>

        {/* Factor breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-meta text-meta">
          {/* Importance factors */}
          <div className="news-border p-stack-md bg-surface">
            <h4 className="font-label-caps text-label-caps uppercase font-bold text-secondary mb-3 hairline-b pb-2">
              Importance Factors (M — Magnitude)
            </h4>
            <div className="space-y-2">
              {[
                { label: 'Scale of Impact', value: ranking.importanceFactors.scaleOfImpact, weight: '25%' },
                { label: 'Severity',         value: ranking.importanceFactors.severity,       weight: '25%' },
                { label: 'Institution',      value: ranking.importanceFactors.institutionalSignificance, weight: '20%' },
                { label: 'Irreversibility',  value: ranking.importanceFactors.irreversibility, weight: '10%' },
                { label: 'Accountability',   value: ranking.importanceFactors.publicAccountabilityValue, weight: '10%' },
                { label: 'Long-Term Relevance', value: ranking.importanceFactors.longTermRelevance, weight: '5%' },
                { label: 'Vulnerability',    value: ranking.importanceFactors.vulnerabilityOfAffected, weight: '5%' },
              ].map(({ label, value, weight }) => (
                <div key={label} className="flex justify-between items-baseline hairline-b pb-1 last:border-0 last:pb-0">
                  <span className="text-outline">{label} <span className="text-[10px] opacity-60">({weight})</span></span>
                  <strong className={`text-xs ${
                    (value === 'Critical' || value === 'Global' || value === 'National Constitutional' || value === 'Exposing Corruption/Negligence')
                      ? 'text-error' : 'text-primary'
                  }`}>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Interest signals */}
          <div className="news-border p-stack-md bg-surface">
            <h4 className="font-label-caps text-label-caps uppercase font-bold text-primary mb-3 hairline-b pb-2">
              Demand Signals (I)
            </h4>
            <p className="font-meta text-[10px] text-outline italic mb-2">
              Three real, verifiable signals — no site-wide analytics exist, so nothing here is estimated or fabricated.
              Corroborating sources are literally other articles in the current pool; you can scroll the feed and count them yourself.
            </p>
            <div className="space-y-2">
              {[
                { label: 'Corroborating Sources',  value: `${ranking.interestSignals.corroboratingSources} other articles`, weight: '55%' },
                { label: 'Breaking / Live Urgency', value: ranking.interestSignals.isUrgent ? 'Yes' : 'No',                  weight: '25%' },
                { label: 'Local View Count (this browser)', value: `${ranking.interestSignals.localViewCount}`,             weight: '20%' },
              ].map(({ label, value, weight }) => (
                <div key={label} className="flex justify-between items-baseline hairline-b pb-1 last:border-0 last:pb-0">
                  <span className="text-outline">{label} <span className="text-[10px] opacity-60">({weight})</span></span>
                  <strong className="text-primary text-xs">{value}</strong>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 hairline-t text-outline">
              <div className="flex justify-between">
                <span>Time-Decay Half-Life:</span>
                <strong>t₁/₂ = {ranking.decayHalfLifeHours}h</strong>
              </div>
              <div className="flex justify-between mt-1">
                <span>Undecayed Raw Score:</span>
                <strong>{ranking.rawInterestScore}/100</strong>
              </div>
              <div className="flex justify-between mt-1">
                <span>Scored At:</span>
                <strong>{ranking.lastScoredAt}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Priority tier guide */}
        <div className="mt-4 news-border p-stack-md">
          <h4 className="font-label-caps text-label-caps uppercase font-bold text-primary mb-3 hairline-b pb-2">
            Priority Tier Reference
          </h4>
          <div className="space-y-1.5 font-meta text-meta">
            {Object.entries(TIER_DESC).map(([tier, desc]) => (
              <div key={tier} className={`flex items-start gap-2 ${tier === tierForSection ? 'opacity-100' : 'opacity-50'}`}>
                <span className={`font-label-caps text-[10px] px-1.5 py-0.5 flex-shrink-0 ${TIER_COLORS[tier] || ''}`}>{tier}</span>
                <span className="text-on-surface-variant">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 hairline-t flex justify-between items-center">
          <p className="font-meta text-meta text-outline italic">
            Recalculated live each time you open this inspector. Human editor override always available.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-on-primary font-label-caps text-label-caps uppercase hover:bg-secondary transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
