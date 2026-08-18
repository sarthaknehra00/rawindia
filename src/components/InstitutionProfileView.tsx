import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Swords, Share2 } from 'lucide-react';
import { getInstitutionProfile, type InstitutionProfile } from '../services/institutionLedgerService';
import type { VerdictEvent, TrackedPromise } from '../services/persistenceService';
import { VerdictCardModal } from './VerdictCardModal';
import { VaadaClockCard } from './VaadaClockCard';
import { timeAgo } from '../utils/timeUtils';
import type { Article } from '../types';

interface InstitutionProfileViewProps {
  onSelectArticle: (article: Article) => void;
}

/**
 * Netaji Report Card v2 — one page per institution/official, merging what
 * used to be two separate views (the spin/correction Institutional Report
 * Card, and nothing for promises/verdicts at all) into a single scorecard:
 * spin frequency, verified W/L record, and verified Vaada Clock promises.
 * See institutionLedgerService.ts for exactly what counts as "verified" and
 * why an unreviewed AI candidate never appears here.
 */
export const InstitutionProfileView: React.FC<InstitutionProfileViewProps> = ({ onSelectArticle }) => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<InstitutionProfile | null | undefined>(undefined); // undefined = loading
  const [shareVerdict, setShareVerdict] = useState<VerdictEvent | null>(null);
  const [sharePromise, setSharePromise] = useState<TrackedPromise | null>(null);

  useEffect(() => {
    setProfile(undefined);
    if (!slug) return;
    let cancelled = false;
    getInstitutionProfile(slug).then(p => { if (!cancelled) setProfile(p); });
    return () => { cancelled = true; };
  }, [slug]);

  if (profile === undefined) {
    return (
      <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg">
        <p className="font-meta text-meta text-on-surface-variant italic">Loading profile…</p>
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg">
        <button onClick={() => navigate('/institutions')} className="flex items-center gap-1.5 font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-secondary transition-colors font-bold mb-stack-md">
          <ArrowLeft size={13} /> Back to Ledger
        </button>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          No record found for this institution yet — they haven't been quoted or spin-decoded in anything RAWINDIA has published.
        </p>
      </div>
    );
  }

  const { summary, spinEvents, articles, verdicts, promises } = profile;

  return (
    <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg animate-fade-in">
      <button onClick={() => navigate('/institutions')} className="flex items-center gap-1.5 font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-secondary transition-colors font-bold mb-stack-md">
        <ArrowLeft size={13} /> Back to Ledger
      </button>

      <div className="hairline-b pb-stack-md mb-stack-lg">
        <span className="font-label-caps text-label-caps uppercase text-secondary">Netaji Report Card</span>
        <h1 className="font-headline-xl text-headline-xl font-bold text-primary leading-tight">{summary.name}</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{summary.role}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-gutter mb-section-gap">
        <div className="news-border bg-surface p-stack-sm text-center">
          <div className="font-display-lg text-3xl font-bold" style={{ color: '#0f7a4d' }}>{summary.wins}</div>
          <div className="font-label-caps text-[10px] uppercase text-on-surface-variant mt-1">Wins</div>
        </div>
        <div className="news-border bg-surface p-stack-sm text-center">
          <div className="font-display-lg text-3xl font-bold text-secondary">{summary.losses}</div>
          <div className="font-label-caps text-[10px] uppercase text-on-surface-variant mt-1">Losses</div>
        </div>
        <div className="news-border bg-surface p-stack-sm text-center">
          <div className="font-display-lg text-3xl font-bold text-primary">{summary.promisesKept}/{summary.promisesKept + summary.promisesBroken + summary.promisesExtended + summary.promisesStalled}</div>
          <div className="font-label-caps text-[10px] uppercase text-on-surface-variant mt-1">Promises Kept</div>
          {summary.promisesKept + summary.promisesBroken + summary.promisesExtended + summary.promisesStalled > 0 && (
            <div className="w-full h-1.5 bg-surface-container mt-2 flex rounded-sm overflow-hidden">
              <div style={{ width: `${(summary.promisesKept / (summary.promisesKept + summary.promisesBroken + summary.promisesExtended + summary.promisesStalled)) * 100}%`, backgroundColor: '#0f7a4d' }} title="Kept" />
              <div style={{ width: `${(summary.promisesExtended / (summary.promisesKept + summary.promisesBroken + summary.promisesExtended + summary.promisesStalled)) * 100}%`, backgroundColor: '#d97706' }} title="Extended" />
              <div style={{ width: `${(summary.promisesStalled / (summary.promisesKept + summary.promisesBroken + summary.promisesExtended + summary.promisesStalled)) * 100}%`, backgroundColor: '#9ca3af' }} title="Stalled" />
              <div style={{ width: `${(summary.promisesBroken / (summary.promisesKept + summary.promisesBroken + summary.promisesExtended + summary.promisesStalled)) * 100}%`, backgroundColor: '#9b2c3c' }} title="Broken" />
            </div>
          )}
        </div>
        <div className="news-border bg-surface p-stack-sm text-center">
          <div className="font-display-lg text-3xl font-bold text-secondary">{summary.spinCount}</div>
          <div className="font-label-caps text-[10px] uppercase text-on-surface-variant mt-1">Spin Caught</div>
        </div>
        <div className="news-border bg-surface p-stack-sm text-center">
          <div className="font-display-lg text-3xl font-bold text-primary">{summary.correctionCount}</div>
          <div className="font-label-caps text-[10px] uppercase text-on-surface-variant mt-1">Corrections</div>
        </div>
      </div>

      {promises.length > 0 && (
        <section className="mb-section-gap">
          <h2 className="font-label-caps text-label-caps uppercase font-bold text-primary hairline-b pb-2 mb-3">
            Vaada Clock — Tracked Promises
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            {promises.map(p => (
              <VaadaClockCard key={p.id} promise={p} onShare={setSharePromise} />
            ))}
          </div>
        </section>
      )}

      {verdicts.length > 0 && (
        <section className="mb-section-gap">
          <h2 className="font-label-caps text-label-caps uppercase font-bold text-primary hairline-b pb-2 mb-3">
            L/W Ledger — Verified Takes
          </h2>
          <ul className="flex flex-col gap-2">
            {verdicts.map(v => (
              <li key={v.id} className="news-border bg-surface-container-low p-3 flex items-start justify-between gap-3">
                <div>
                  <span className="font-label-caps text-[10px] uppercase font-bold" style={{ color: v.verdict === 'W' ? '#0f7a4d' : '#9b2c3c' }}>
                    {v.verdict === 'W' ? 'Win' : 'Loss'}
                  </span>
                  <p className="font-body-sm text-body-sm text-primary mt-1">{v.headline}</p>
                </div>
                <button
                  onClick={() => setShareVerdict(v)}
                  className="flex items-center gap-1 font-label-caps text-[10px] uppercase text-on-surface-variant hover:text-secondary transition-colors flex-shrink-0"
                >
                  <Share2 size={12} /> Share
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-section-gap">
        <h2 className="font-label-caps text-label-caps uppercase font-bold text-primary hairline-b pb-2 mb-3 flex items-center gap-2">
          <Swords size={14} /> Spin Caught, Newest First
        </h2>
        {spinEvents.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant bg-surface-container-low p-4 news-border">No spin phrases logged for them yet. This section populates automatically when RAWINDIA publishes a dispatch quoting them and our Spin Decoder detects PR-softened language.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {spinEvents.map((e, i) => (
              <li key={i} className="news-border bg-surface-container-low p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-body-sm font-bold text-secondary">"{e.term}"</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant"> — {e.translation}</span>
                  </div>
                  <span className="font-meta text-[11px] text-outline whitespace-nowrap flex-shrink-0">{timeAgo(e.timestamp)}</span>
                </div>
                <p className="font-meta text-[11px] text-on-surface-variant mt-1 italic">From: "{e.articleTitle}"</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {shareVerdict && <VerdictCardModal type="lw-verdict" verdict={shareVerdict} onClose={() => setShareVerdict(null)} />}
      {sharePromise && <VerdictCardModal type="promise-status" promise={sharePromise} onClose={() => setSharePromise(null)} />}

      <section>
        <h2 className="font-label-caps text-label-caps uppercase font-bold text-primary hairline-b pb-2 mb-3">
          Dispatches Quoting {summary.name}
        </h2>
        {articles.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant bg-surface-container-low p-4 news-border">No dispatches on file. As RAWINDIA covers decisions involving {summary.name}, their direct quotes will appear here automatically.</p>
        ) : (
          <ul className="flex flex-col gap-2 divide-y divide-hairline-grey">
            {articles.map(a => (
              <li
                key={a.id}
                onClick={() => onSelectArticle(a)}
                className="pt-3 first:pt-0 cursor-pointer group"
              >
                <span className="font-meta text-meta text-secondary mb-1 block">{timeAgo(a.publishedAt)}</span>
                <h3 className="font-body-sm text-body-sm font-bold group-hover:underline">{a.title}</h3>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
