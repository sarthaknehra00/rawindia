/**
 * RAWINDIA — Admin Control Panel (/ops)
 *
 * One passphrase-gated dashboard for everything an operator needs to run
 * Operation Vaada by hand: clear the AI review queue, browse/edit/delete
 * anything already published, add a fact you've personally verified straight
 * to the Ledger, and check whether the shared backend + daily automated scan
 * are actually alive. Replaces the old standalone /ops/review route — that
 * URL still works, it just opens straight to the Review Queue tab here.
 *
 * Every mutation goes through sharedLedgerService.ts, which already enforces
 * the one rule that matters: nothing reaches a reader until it's tagged
 * 'verified', and the passphrase is re-checked server-side on every write
 * regardless of what this UI shows. This file adds no new trust boundary —
 * it's a UI on top of actions api/ledger.ts already implements (approve,
 * edit-approve, reject, append-verified). See PRD §9-10.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, Check, X, Merge, LayoutDashboard, Inbox, Database, PlusCircle, Activity,
  Pencil, Trash2, RefreshCw, AlertTriangle, ArrowUpRight, Users,
} from 'lucide-react';
import type { TrackedPromise, VerdictEvent } from '../services/persistenceService';
import {
  getLedgerBundle, approve as approveShared, reject as rejectShared, editApprove,
  mergeExtension, addVerified, type LedgerBundle,
} from '../services/sharedLedgerService';
import { findSimilarPromise } from '../services/promiseExtractionService';
import { getRoster, addRosterEntry, updateRosterEntry, removeRosterEntry, type RosterBundle } from '../services/rosterService';
import type { RosterEntry, RosterCategory } from '../data/accountabilityRoster';
import { timeAgo } from '../utils/timeUtils';

const SESSION_KEY = 'rawindia_review_unlocked';
const PASSPHRASE_KEY = 'rawindia_review_passphrase';

function usePassphraseGate(): [boolean, string, (v: string) => boolean] {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
  const [passphrase, setPassphrase] = useState(() => sessionStorage.getItem(PASSPHRASE_KEY) || '');
  const attempt = (value: string): boolean => {
    const expected = import.meta.env.VITE_REVIEW_PASSPHRASE || '';
    if (!expected || value !== expected) return false;
    sessionStorage.setItem(SESSION_KEY, '1');
    sessionStorage.setItem(PASSPHRASE_KEY, value);
    setPassphrase(value);
    setUnlocked(true);
    return true;
  };
  return [unlocked, passphrase, attempt];
}

function isIsoDateStr(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());
}

export type AdminTab = 'overview' | 'review' | 'ledger' | 'add' | 'roster' | 'health';

export const AdminDashboardView: React.FC<{ initialTab?: AdminTab }> = ({ initialTab = 'overview' }) => {
  const [unlocked, passphrase, attempt] = usePassphraseGate();
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const configured = Boolean(import.meta.env.VITE_REVIEW_PASSPHRASE);

  if (!unlocked) {
    return (
      <div className="max-w-sm mx-auto px-margin-mobile py-stack-lg text-center animate-fade-in">
        <ShieldCheck size={28} className="mx-auto mb-3 text-on-surface-variant" />
        <h1 className="font-headline-lg text-headline-lg font-bold text-primary mb-2">Admin Dashboard</h1>
        {!configured ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No VITE_REVIEW_PASSPHRASE is set — this route is disabled until one is configured.
          </p>
        ) : (
          <>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
              Enter the passphrase to continue. The real check happens server-side on every action.
            </p>
            <input
              type="password"
              value={input}
              onChange={e => { setInput(e.target.value); setError(false); }}
              onKeyDown={e => { if (e.key === 'Enter') setError(!attempt(input)); }}
              className="w-full news-border px-3 py-2 mb-3 bg-surface text-primary font-body-sm"
              placeholder="Passphrase"
              autoFocus
            />
            <button
              onClick={() => setError(!attempt(input))}
              className="w-full bg-primary text-on-primary font-label-caps text-label-caps uppercase px-4 py-2 hover:bg-secondary transition-colors"
            >
              Unlock
            </button>
            {error && <p className="font-meta text-[11px] text-secondary mt-2">Incorrect passphrase.</p>}
          </>
        )}
      </div>
    );
  }

  return <AdminDashboardBoard passphrase={passphrase} initialTab={initialTab} />;
};

const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={14} /> },
  { id: 'review', label: 'Review Queue', icon: <Inbox size={14} /> },
  { id: 'ledger', label: 'Ledger Browser', icon: <Database size={14} /> },
  { id: 'add', label: 'Add Entry', icon: <PlusCircle size={14} /> },
  { id: 'roster', label: 'Roster', icon: <Users size={14} /> },
  { id: 'health', label: 'System Health', icon: <Activity size={14} /> },
];

const AdminDashboardBoard: React.FC<{ passphrase: string; initialTab: AdminTab }> = ({ passphrase, initialTab }) => {
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [bundle, setBundle] = useState<LedgerBundle | null>(null);
  const [roster, setRoster] = useState<RosterBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    Promise.all([getLedgerBundle(), getRoster()]).then(([b, r]) => {
      setBundle(b); setRoster(r); setLoading(false);
    });
  };

  useEffect(() => { reload(); }, []);

  const pendingCount = bundle
    ? bundle.verdicts.filter(v => v.trustTier === 'ai-flagged').length +
      bundle.promises.filter(p => p.trustTier === 'ai-flagged').length
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg animate-fade-in">
      <div className="hairline-b pb-stack-md mb-stack-lg flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="font-label-caps text-label-caps uppercase text-secondary">Ops / Admin Dashboard</span>
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary">Control Panel</h1>
        </div>
        <button
          onClick={reload}
          className="flex items-center gap-1.5 font-label-caps text-[10px] uppercase news-border px-3 py-1.5 hover:bg-surface-container transition-colors flex-shrink-0"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {actionError && (
        <div className="news-border bg-error-container p-3 mb-stack-md flex items-center gap-2">
          <AlertTriangle size={14} className="text-on-error-container flex-shrink-0" />
          <p className="font-meta text-[12px] text-on-error-container">{actionError}</p>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto hairline-b mb-stack-lg">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-1.5 font-label-caps text-label-caps uppercase px-3 py-3 border-b-2 whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-secondary'
            }`}
          >
            {t.icon} {t.label}
            {t.id === 'review' && pendingCount > 0 && (
              <span className="ml-0.5 bg-secondary text-on-secondary text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {!bundle || !roster ? (
        <p className="font-meta text-on-surface-variant italic">Loading dashboard…</p>
      ) : (
        <>
          {tab === 'overview' && <OverviewTab bundle={bundle} onNavigate={setTab} />}
          {tab === 'review' && (
            <ReviewQueueTab bundle={bundle} passphrase={passphrase} reload={reload} onError={setActionError} />
          )}
          {tab === 'ledger' && (
            <LedgerBrowserTab bundle={bundle} passphrase={passphrase} reload={reload} onError={setActionError} />
          )}
          {tab === 'add' && (
            <AddEntryTab passphrase={passphrase} reload={reload} onError={setActionError} />
          )}
          {tab === 'roster' && (
            <RosterTab roster={roster} passphrase={passphrase} reload={reload} onError={setActionError} />
          )}
          {tab === 'health' && <SystemHealthTab bundle={bundle} roster={roster} />}
        </>
      )}
    </div>
  );
};

// ── Overview ──────────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ bundle: LedgerBundle; onNavigate: (t: AdminTab) => void }> = ({ bundle, onNavigate }) => {
  const verifiedVerdicts = bundle.verdicts.filter(v => v.trustTier === 'verified');
  const verifiedPromises = bundle.promises.filter(p => p.trustTier === 'verified');
  const flaggedVerdicts = bundle.verdicts.filter(v => v.trustTier === 'ai-flagged');
  const flaggedPromises = bundle.promises.filter(p => p.trustTier === 'ai-flagged');
  const pending = flaggedVerdicts.length + flaggedPromises.length;

  const wins = verifiedVerdicts.filter(v => v.verdict === 'W').length;
  const losses = verifiedVerdicts.filter(v => v.verdict === 'L').length;
  const byStatus = (s: TrackedPromise['status']) => verifiedPromises.filter(p => p.status === s).length;

  return (
    <div className="flex flex-col gap-stack-lg">
      {pending > 0 && (
        <button
          onClick={() => onNavigate('review')}
          className="news-border bg-wash-warm p-stack-sm flex items-center justify-between gap-3 text-left hover:bg-surface-container-low transition-colors"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-secondary flex-shrink-0" />
            <div>
              <p className="font-label-caps text-label-caps uppercase font-bold text-secondary">Needs Attention</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {pending} candidate{pending === 1 ? '' : 's'} waiting in the Review Queue.
              </p>
            </div>
          </div>
          <ArrowUpRight size={16} className="text-secondary flex-shrink-0" />
        </button>
      )}

      <div>
        <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">L/W Takes</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Wins" value={wins} color="#0f7a4d" />
          <StatTile label="Losses" value={losses} color="#9b2c3c" />
          <StatTile label="Total Published" value={verifiedVerdicts.length} color="#000000" />
          <StatTile label="Pending Review" value={flaggedVerdicts.length} color="#8a5a10" />
        </div>
      </div>

      <div>
        <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">Vaada Clock</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Kept" value={byStatus('kept')} color="#0f7a4d" />
          <StatTile label="Broken" value={byStatus('broken')} color="#9b2c3c" />
          <StatTile label="Extended" value={byStatus('extended')} color="#8a5a10" />
          <StatTile label="Still Tracking" value={byStatus('in-progress') + byStatus('stalled')} color="#444748" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <StatTile label="Total Published" value={verifiedPromises.length} color="#000000" />
          <StatTile label="Pending Review" value={flaggedPromises.length} color="#8a5a10" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <QuickAction label="Review Queue" onClick={() => onNavigate('review')} />
        <QuickAction label="Browse & Edit Ledger" onClick={() => onNavigate('ledger')} />
        <QuickAction label="Add New Entry" onClick={() => onNavigate('add')} />
        <QuickAction label="Accountability Roster" onClick={() => onNavigate('roster')} />
        <QuickAction label="System Health" onClick={() => onNavigate('health')} />
      </div>
    </div>
  );
};

const StatTile: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="news-border bg-surface p-3 text-center">
    <div className="font-display-lg text-2xl font-bold" style={{ color }}>{value}</div>
    <div className="font-label-caps text-[9px] uppercase text-on-surface-variant mt-1">{label}</div>
  </div>
);

const QuickAction: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button onClick={onClick} className="font-label-caps text-[10px] uppercase px-3 py-2 news-border hover:bg-surface-container transition-colors">
    {label}
  </button>
);

// ── Review Queue ──────────────────────────────────────────────────────────────

interface ReviewCardCallbacks { onDone: () => void; onError: (msg: string | null) => void; }

const ReviewQueueTab: React.FC<{ bundle: LedgerBundle; passphrase: string; reload: () => void; onError: (m: string | null) => void }> = ({
  bundle, passphrase, reload, onError,
}) => {
  const promises = bundle.promises.filter(x => x.trustTier === 'ai-flagged');
  const verdicts = bundle.verdicts.filter(x => x.trustTier === 'ai-flagged');

  return (
    <div>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-md">
        Nothing below has been shown to a reader. Approve only what the source excerpt actually supports.
        Includes candidates from both the local extraction pass and the daily automated scan.
      </p>
      {promises.length === 0 && verdicts.length === 0 && (
        <EmptyState label="Queue is empty — nothing pending review." />
      )}
      <div className="flex flex-col gap-4">
        {promises.map(p => (
          <PromiseReviewCard key={p.id} promise={p} passphrase={passphrase} onDone={reload} onError={onError} />
        ))}
        {verdicts.map(v => (
          <VerdictReviewCard key={v.id} verdict={v} passphrase={passphrase} onDone={reload} onError={onError} />
        ))}
      </div>
    </div>
  );
};

const PromiseReviewCard: React.FC<{ promise: TrackedPromise; passphrase: string } & ReviewCardCallbacks> = ({ promise, passphrase, onDone, onError }) => {
  const [draft, setDraft] = useState(promise);
  const [similar, setSimilar] = useState<{ promise: TrackedPromise; score: number } | null>(null);

  useEffect(() => {
    if (promise.matchVector) {
      findSimilarPromise(promise.matchVector, promise.id).then(setSimilar);
    }
  }, [promise]);

  const canApprove = draft.evidenceLinks.length > 0 && draft.evidenceLinks[0].trim().length > 0;

  const doApprove = async () => {
    onError(null);
    const ok = await approveShared('promise', promise.id, passphrase, draft);
    if (ok) onDone(); else onError('Approve failed — wrong passphrase or the shared store rejected the request.');
  };
  const doReject = async () => {
    onError(null);
    const ok = await rejectShared('promise', promise.id, passphrase);
    if (ok) onDone(); else onError('Reject failed — wrong passphrase or the shared store rejected the request.');
  };
  const doMergeAsExtension = async () => {
    if (!similar) return;
    onError(null);
    const ok = await mergeExtension(promise.id, similar.promise.id, draft, passphrase);
    if (ok) onDone(); else onError('Merge failed — wrong passphrase or the shared store rejected the request.');
  };

  return (
    <div className="news-border bg-surface p-stack-sm">
      <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">Promise Candidate</span>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
        <Field label="Subject" value={draft.subjectName} onChange={v => setDraft({ ...draft, subjectName: v })} />
        <Field label="Category" value={draft.category} onChange={v => setDraft({ ...draft, category: v })} />
        <Field label="Promise text" value={draft.promiseText} onChange={v => setDraft({ ...draft, promiseText: v })} full />
        <Field label="Deadline (YYYY-MM-DD)" value={draft.currentDeadline} onChange={v => setDraft({ ...draft, currentDeadline: v })} />
        <Field label="Source URL" value={draft.evidenceLinks[0] || ''} onChange={v => setDraft({ ...draft, evidenceLinks: [v] })} />
      </div>
      <p className="font-meta text-[11px] text-on-surface-variant italic mt-3 news-border bg-surface-container-low p-2">
        Source excerpt: "{draft.sourceExcerpt.slice(0, 220)}…"
      </p>

      {similar && (
        <div className="news-border p-2 mt-3" style={{ background: '#f5efe0' }}>
          <p className="font-meta text-[11px] text-on-surface-variant">
            Similar existing promise ({Math.round(similar.score * 100)}% match): <strong>"{similar.promise.promiseText}"</strong> — currently due {similar.promise.currentDeadline}
          </p>
          <button onClick={doMergeAsExtension} className="flex items-center gap-1 font-label-caps text-[10px] uppercase text-primary hover:text-secondary mt-1">
            <Merge size={11} /> Merge as extension of this promise
          </button>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-3">
        <button onClick={doReject} className="flex items-center gap-1 font-label-caps text-label-caps uppercase px-3 py-1.5 news-border hover:bg-surface-container">
          <X size={12} /> Reject
        </button>
        <button
          onClick={doApprove}
          disabled={!canApprove}
          className="flex items-center gap-1 bg-primary text-on-primary font-label-caps text-label-caps uppercase px-3 py-1.5 hover:bg-secondary disabled:opacity-40"
        >
          <Check size={12} /> Approve
        </button>
      </div>
    </div>
  );
};

const VerdictReviewCard: React.FC<{ verdict: VerdictEvent; passphrase: string } & ReviewCardCallbacks> = ({ verdict, passphrase, onDone, onError }) => {
  const [draft, setDraft] = useState(verdict);
  const canApprove = draft.sourceUrl.trim().length > 0;

  const doApprove = async () => {
    onError(null);
    const ok = await approveShared('verdict', verdict.id, passphrase, draft);
    if (ok) onDone(); else onError('Approve failed — wrong passphrase or the shared store rejected the request.');
  };
  const doReject = async () => {
    onError(null);
    const ok = await rejectShared('verdict', verdict.id, passphrase);
    if (ok) onDone(); else onError('Reject failed — wrong passphrase or the shared store rejected the request.');
  };

  return (
    <div className="news-border bg-surface p-stack-sm">
      <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">Verdict Candidate</span>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
        <Field label="Subject" value={draft.subjectName} onChange={v => setDraft({ ...draft, subjectName: v })} />
        <div>
          <label className="font-label-caps text-[10px] uppercase text-on-surface-variant block mb-1">Verdict</label>
          <div className="flex gap-2">
            <button onClick={() => setDraft({ ...draft, verdict: 'W' })} className={`px-3 py-1 font-bold ${draft.verdict === 'W' ? 'bg-primary text-on-primary' : 'news-border'}`}>W</button>
            <button onClick={() => setDraft({ ...draft, verdict: 'L' })} className={`px-3 py-1 font-bold ${draft.verdict === 'L' ? 'bg-primary text-on-primary' : 'news-border'}`}>L</button>
          </div>
        </div>
        <Field label="Headline" value={draft.headline} onChange={v => setDraft({ ...draft, headline: v })} full />
        <Field label="Source URL" value={draft.sourceUrl} onChange={v => setDraft({ ...draft, sourceUrl: v })} full />
      </div>
      <p className="font-meta text-[11px] text-on-surface-variant italic mt-3 news-border bg-surface-container-low p-2">
        Source excerpt: "{draft.sourceExcerpt.slice(0, 220)}…"
      </p>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={doReject} className="flex items-center gap-1 font-label-caps text-label-caps uppercase px-3 py-1.5 news-border hover:bg-surface-container">
          <X size={12} /> Reject
        </button>
        <button
          onClick={doApprove}
          disabled={!canApprove}
          className="flex items-center gap-1 bg-primary text-on-primary font-label-caps text-label-caps uppercase px-3 py-1.5 hover:bg-secondary disabled:opacity-40"
        >
          <Check size={12} /> Approve
        </button>
      </div>
    </div>
  );
};

// ── Ledger Browser ────────────────────────────────────────────────────────────

const LedgerBrowserTab: React.FC<{ bundle: LedgerBundle; passphrase: string; reload: () => void; onError: (m: string | null) => void }> = ({
  bundle, passphrase, reload, onError,
}) => {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'verdicts' | 'promises'>('verdicts');

  const allVerifiedVerdicts = useMemo(() => bundle.verdicts.filter(v => v.trustTier === 'verified'), [bundle]);
  const allVerifiedPromises = useMemo(() => bundle.promises.filter(p => p.trustTier === 'verified'), [bundle]);

  const q = query.trim().toLowerCase();
  const verdicts = useMemo(() => allVerifiedVerdicts
    .filter(v => !q || v.subjectName.toLowerCase().includes(q) || v.headline.toLowerCase().includes(q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [allVerifiedVerdicts, q]);
  const promises = useMemo(() => allVerifiedPromises
    .filter(p => !q || p.subjectName.toLowerCase().includes(q) || p.promiseText.toLowerCase().includes(q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [allVerifiedPromises, q]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-stack-md">
        <div className="flex gap-2">
          <button
            onClick={() => setKind('verdicts')}
            className={`font-label-caps text-[10px] uppercase px-3 py-1.5 news-border transition-colors ${kind === 'verdicts' ? 'bg-primary text-on-primary' : 'hover:bg-surface-container'}`}
          >
            Verdicts ({allVerifiedVerdicts.length})
          </button>
          <button
            onClick={() => setKind('promises')}
            className={`font-label-caps text-[10px] uppercase px-3 py-1.5 news-border transition-colors ${kind === 'promises' ? 'bg-primary text-on-primary' : 'hover:bg-surface-container'}`}
          >
            Promises ({allVerifiedPromises.length})
          </button>
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by subject or text…"
          className="flex-1 min-w-[200px] news-border px-3 py-1.5 bg-surface font-body-sm text-body-sm"
        />
      </div>

      {kind === 'verdicts' ? (
        verdicts.length === 0
          ? <EmptyState label={q ? 'No published verdicts match that search.' : 'Nothing published yet.'} />
          : (
            <div className="flex flex-col gap-3">
              {verdicts.map(v => <VerdictBrowserRow key={v.id} verdict={v} passphrase={passphrase} reload={reload} onError={onError} />)}
            </div>
          )
      ) : (
        promises.length === 0
          ? <EmptyState label={q ? 'No published promises match that search.' : 'Nothing published yet.'} />
          : (
            <div className="flex flex-col gap-3">
              {promises.map(p => <PromiseBrowserRow key={p.id} promise={p} passphrase={passphrase} reload={reload} onError={onError} />)}
            </div>
          )
      )}
    </div>
  );
};

const VerdictBrowserRow: React.FC<{ verdict: VerdictEvent; passphrase: string; reload: () => void; onError: (m: string | null) => void }> = ({
  verdict, passphrase, reload, onError,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(verdict);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const save = async () => {
    onError(null);
    const ok = await editApprove('verdict', draft, passphrase);
    if (ok) { setEditing(false); reload(); } else onError('Save failed — wrong passphrase or the shared store rejected the request.');
  };
  const doDelete = async () => {
    onError(null);
    const ok = await rejectShared('verdict', verdict.id, passphrase);
    if (ok) reload(); else onError('Delete failed — wrong passphrase or the shared store rejected the request.');
  };

  if (editing) {
    return (
      <div className="news-border bg-surface p-stack-sm">
        <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">Editing Verdict</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          <Field label="Subject" value={draft.subjectName} onChange={v => setDraft({ ...draft, subjectName: v })} />
          <div>
            <label className="font-label-caps text-[10px] uppercase text-on-surface-variant block mb-1">Verdict</label>
            <div className="flex gap-2">
              <button onClick={() => setDraft({ ...draft, verdict: 'W' })} className={`px-3 py-1 font-bold ${draft.verdict === 'W' ? 'bg-primary text-on-primary' : 'news-border'}`}>W</button>
              <button onClick={() => setDraft({ ...draft, verdict: 'L' })} className={`px-3 py-1 font-bold ${draft.verdict === 'L' ? 'bg-primary text-on-primary' : 'news-border'}`}>L</button>
            </div>
          </div>
          <Field label="Headline" value={draft.headline} onChange={v => setDraft({ ...draft, headline: v })} full />
          <Field label="Source URL" value={draft.sourceUrl} onChange={v => setDraft({ ...draft, sourceUrl: v })} full />
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={() => { setDraft(verdict); setEditing(false); }} className="font-label-caps text-label-caps uppercase px-3 py-1.5 news-border hover:bg-surface-container">Cancel</button>
          <button onClick={save} disabled={!draft.sourceUrl.trim() || !draft.subjectName.trim() || !draft.headline.trim()} className="bg-primary text-on-primary font-label-caps text-label-caps uppercase px-3 py-1.5 hover:bg-secondary disabled:opacity-40">Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="news-border bg-surface p-stack-sm flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <span className="font-headline-xl text-3xl font-bold leading-none flex-shrink-0" style={{ color: verdict.verdict === 'W' ? '#0f7a4d' : '#9b2c3c' }}>
          {verdict.verdict}
        </span>
        <div className="min-w-0">
          <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">{verdict.subjectName}</span>
          <p className="font-body-serif text-body-sm text-primary truncate">{verdict.headline}</p>
          <div className="flex items-center gap-3 mt-1 font-meta text-[11px] text-on-surface-variant">
            {verdict.sourceUrl && <a href={verdict.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline-link">Source</a>}
            <span>{timeAgo(verdict.createdAt)}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={() => setEditing(true)} className="flex items-center gap-1 font-label-caps text-[10px] uppercase px-2.5 py-1.5 news-border hover:bg-surface-container">
          <Pencil size={11} /> Edit
        </button>
        <button
          onClick={() => (confirmingDelete ? doDelete() : setConfirmingDelete(true))}
          onBlur={() => setConfirmingDelete(false)}
          className={`flex items-center gap-1 font-label-caps text-[10px] uppercase px-2.5 py-1.5 news-border transition-colors ${confirmingDelete ? 'bg-secondary text-on-secondary' : 'hover:bg-surface-container'}`}
        >
          <Trash2 size={11} /> {confirmingDelete ? 'Confirm?' : 'Delete'}
        </button>
      </div>
    </div>
  );
};

const PromiseBrowserRow: React.FC<{ promise: TrackedPromise; passphrase: string; reload: () => void; onError: (m: string | null) => void }> = ({
  promise, passphrase, reload, onError,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(promise);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const canSave = draft.subjectName.trim() && draft.promiseText.trim() && isIsoDateStr(draft.currentDeadline) && draft.evidenceLinks[0]?.trim();

  const save = async () => {
    onError(null);
    const ok = await editApprove('promise', draft, passphrase);
    if (ok) { setEditing(false); reload(); } else onError('Save failed — wrong passphrase or the shared store rejected the request.');
  };
  const doDelete = async () => {
    onError(null);
    const ok = await rejectShared('promise', promise.id, passphrase);
    if (ok) reload(); else onError('Delete failed — wrong passphrase or the shared store rejected the request.');
  };

  const statusColor: Record<TrackedPromise['status'], string> = {
    kept: '#0f7a4d', broken: '#9b2c3c', extended: '#8a5a10', stalled: '#444748', 'in-progress': '#444748',
  };

  if (editing) {
    return (
      <div className="news-border bg-surface p-stack-sm">
        <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">Editing Promise</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          <Field label="Subject" value={draft.subjectName} onChange={v => setDraft({ ...draft, subjectName: v })} />
          <Field label="Category" value={draft.category} onChange={v => setDraft({ ...draft, category: v })} />
          <Field label="Promise text" value={draft.promiseText} onChange={v => setDraft({ ...draft, promiseText: v })} full />
          <Field label="Deadline (YYYY-MM-DD)" value={draft.currentDeadline} onChange={v => setDraft({ ...draft, currentDeadline: v })} />
          <div>
            <label className="font-label-caps text-[10px] uppercase text-on-surface-variant block mb-1">Status</label>
            <select
              value={draft.status}
              onChange={e => setDraft({ ...draft, status: e.target.value as TrackedPromise['status'] })}
              className="w-full news-border px-2 py-1.5 bg-surface text-primary font-body-sm text-body-sm"
            >
              {(['in-progress', 'extended', 'stalled', 'broken', 'kept'] as const).map(s => (
                <option key={s} value={s}>{s.replace('-', ' ')}</option>
              ))}
            </select>
          </div>
          <Field label="Source URL" value={draft.evidenceLinks[0] || ''} onChange={v => setDraft({ ...draft, evidenceLinks: [v] })} full />
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={() => { setDraft(promise); setEditing(false); }} className="font-label-caps text-label-caps uppercase px-3 py-1.5 news-border hover:bg-surface-container">Cancel</button>
          <button onClick={save} disabled={!canSave} className="bg-primary text-on-primary font-label-caps text-label-caps uppercase px-3 py-1.5 hover:bg-secondary disabled:opacity-40">Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="news-border bg-surface p-stack-sm flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">{promise.subjectName}</span>
          <span className="font-label-caps text-[9px] uppercase font-bold px-1.5 py-0.5 rounded" style={{ color: statusColor[promise.status], background: `${statusColor[promise.status]}1a` }}>
            {promise.status.replace('-', ' ')}
          </span>
        </div>
        <p className="font-body-serif text-body-sm text-primary">{promise.promiseText}</p>
        <div className="flex items-center gap-3 mt-1 font-meta text-[11px] text-on-surface-variant">
          <span>Due {promise.currentDeadline}</span>
          {promise.evidenceLinks[0] && <a href={promise.evidenceLinks[0]} target="_blank" rel="noopener noreferrer" className="underline-link">Source</a>}
          <span>{timeAgo(promise.createdAt)}</span>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={() => setEditing(true)} className="flex items-center gap-1 font-label-caps text-[10px] uppercase px-2.5 py-1.5 news-border hover:bg-surface-container">
          <Pencil size={11} /> Edit
        </button>
        <button
          onClick={() => (confirmingDelete ? doDelete() : setConfirmingDelete(true))}
          onBlur={() => setConfirmingDelete(false)}
          className={`flex items-center gap-1 font-label-caps text-[10px] uppercase px-2.5 py-1.5 news-border transition-colors ${confirmingDelete ? 'bg-secondary text-on-secondary' : 'hover:bg-surface-container'}`}
        >
          <Trash2 size={11} /> {confirmingDelete ? 'Confirm?' : 'Delete'}
        </button>
      </div>
    </div>
  );
};

// ── Add Entry ─────────────────────────────────────────────────────────────────

const AddEntryTab: React.FC<{ passphrase: string; reload: () => void; onError: (m: string | null) => void }> = ({ passphrase, reload, onError }) => {
  const [kind, setKind] = useState<'verdict' | 'promise'>('verdict');
  const [success, setSuccess] = useState<string | null>(null);

  const [verdictDraft, setVerdictDraft] = useState({ subjectName: '', headline: '', verdict: 'W' as 'W' | 'L', sourceUrl: '', sourceExcerpt: '' });
  const [promiseDraft, setPromiseDraft] = useState({ subjectName: '', promiseText: '', category: '', currentDeadline: '', evidenceUrl: '', sourceExcerpt: '' });

  const canSaveVerdict = Boolean(verdictDraft.subjectName.trim() && verdictDraft.headline.trim() && verdictDraft.sourceUrl.trim());
  const canSavePromise = Boolean(
    promiseDraft.subjectName.trim() && promiseDraft.promiseText.trim() &&
    isIsoDateStr(promiseDraft.currentDeadline) && promiseDraft.evidenceUrl.trim()
  );

  const saveVerdict = async () => {
    onError(null); setSuccess(null);
    const now = new Date().toISOString();
    const record: VerdictEvent = {
      id: `manual-verdict-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      headline: verdictDraft.headline.trim(),
      verdict: verdictDraft.verdict,
      subjectName: verdictDraft.subjectName.trim(),
      sourceUrl: verdictDraft.sourceUrl.trim(),
      sourceExcerpt: verdictDraft.sourceExcerpt.trim() || verdictDraft.headline.trim(),
      articleId: 'manual-entry',
      trustTier: 'verified',
      createdAt: now,
    };
    const ok = await addVerified([record], [], passphrase);
    if (ok) {
      setSuccess('Verdict added to the Ledger.');
      setVerdictDraft({ subjectName: '', headline: '', verdict: 'W', sourceUrl: '', sourceExcerpt: '' });
      reload();
    } else {
      onError('Add failed — wrong passphrase or the shared store rejected the request.');
    }
  };

  const savePromise = async () => {
    onError(null); setSuccess(null);
    const now = new Date().toISOString();
    const record: TrackedPromise = {
      id: `manual-promise-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      subjectName: promiseDraft.subjectName.trim(),
      promiseText: promiseDraft.promiseText.trim(),
      category: promiseDraft.category.trim() || 'General',
      originalDeadline: promiseDraft.currentDeadline,
      currentDeadline: promiseDraft.currentDeadline,
      extensionHistory: [],
      status: 'in-progress',
      evidenceLinks: [promiseDraft.evidenceUrl.trim()],
      sourceExcerpt: promiseDraft.sourceExcerpt.trim() || promiseDraft.promiseText.trim(),
      articleId: 'manual-entry',
      trustTier: 'verified',
      createdAt: now,
    };
    const ok = await addVerified([], [record], passphrase);
    if (ok) {
      setSuccess('Promise added to the Vaada Clock.');
      setPromiseDraft({ subjectName: '', promiseText: '', category: '', currentDeadline: '', evidenceUrl: '', sourceExcerpt: '' });
      reload();
    } else {
      onError('Add failed — wrong passphrase or the shared store rejected the request.');
    }
  };

  return (
    <div className="max-w-2xl">
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-md">
        Adds directly as <strong className="text-primary">verified</strong> — for facts you've already checked
        yourself, not AI extractions. A source link is required, same standard as everything else on the Ledger.
      </p>
      <div className="flex gap-2 mb-stack-md">
        <button onClick={() => setKind('verdict')} className={`font-label-caps text-[10px] uppercase px-3 py-1.5 news-border ${kind === 'verdict' ? 'bg-primary text-on-primary' : 'hover:bg-surface-container'}`}>New Verdict</button>
        <button onClick={() => setKind('promise')} className={`font-label-caps text-[10px] uppercase px-3 py-1.5 news-border ${kind === 'promise' ? 'bg-primary text-on-primary' : 'hover:bg-surface-container'}`}>New Promise</button>
      </div>

      {success && <p className="font-meta text-[12px] text-[#0f7a4d] mb-stack-md">{success}</p>}

      {kind === 'verdict' ? (
        <div className="news-border bg-surface p-stack-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Subject" value={verdictDraft.subjectName} onChange={v => setVerdictDraft({ ...verdictDraft, subjectName: v })} />
            <div>
              <label className="font-label-caps text-[10px] uppercase text-on-surface-variant block mb-1">Verdict</label>
              <div className="flex gap-2">
                <button onClick={() => setVerdictDraft({ ...verdictDraft, verdict: 'W' })} className={`px-3 py-1 font-bold ${verdictDraft.verdict === 'W' ? 'bg-primary text-on-primary' : 'news-border'}`}>W</button>
                <button onClick={() => setVerdictDraft({ ...verdictDraft, verdict: 'L' })} className={`px-3 py-1 font-bold ${verdictDraft.verdict === 'L' ? 'bg-primary text-on-primary' : 'news-border'}`}>L</button>
              </div>
            </div>
            <Field label="Headline" value={verdictDraft.headline} onChange={v => setVerdictDraft({ ...verdictDraft, headline: v })} full />
            <Field label="Source URL" value={verdictDraft.sourceUrl} onChange={v => setVerdictDraft({ ...verdictDraft, sourceUrl: v })} full />
            <Field label="Source excerpt (optional)" value={verdictDraft.sourceExcerpt} onChange={v => setVerdictDraft({ ...verdictDraft, sourceExcerpt: v })} full />
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={saveVerdict} disabled={!canSaveVerdict} className="bg-primary text-on-primary font-label-caps text-label-caps uppercase px-4 py-2 hover:bg-secondary disabled:opacity-40">Add to Ledger</button>
          </div>
        </div>
      ) : (
        <div className="news-border bg-surface p-stack-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Subject" value={promiseDraft.subjectName} onChange={v => setPromiseDraft({ ...promiseDraft, subjectName: v })} />
            <Field label="Category" value={promiseDraft.category} onChange={v => setPromiseDraft({ ...promiseDraft, category: v })} />
            <Field label="Promise text" value={promiseDraft.promiseText} onChange={v => setPromiseDraft({ ...promiseDraft, promiseText: v })} full />
            <Field label="Deadline (YYYY-MM-DD)" value={promiseDraft.currentDeadline} onChange={v => setPromiseDraft({ ...promiseDraft, currentDeadline: v })} />
            <Field label="Source URL" value={promiseDraft.evidenceUrl} onChange={v => setPromiseDraft({ ...promiseDraft, evidenceUrl: v })} />
            <Field label="Source excerpt (optional)" value={promiseDraft.sourceExcerpt} onChange={v => setPromiseDraft({ ...promiseDraft, sourceExcerpt: v })} full />
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={savePromise} disabled={!canSavePromise} className="bg-primary text-on-primary font-label-caps text-label-caps uppercase px-4 py-2 hover:bg-secondary disabled:opacity-40">Add to Vaada Clock</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Accountability Roster ─────────────────────────────────────────────────────

const ROSTER_CATEGORY_LABEL: Record<RosterCategory, string> = {
  'national-leader': 'National Leaders',
  'state-leader': 'State Leaders',
  institution: 'Institutions',
};

const RosterTab: React.FC<{ roster: RosterBundle; passphrase: string; reload: () => void; onError: (m: string | null) => void }> = ({
  roster, passphrase, reload, onError,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | RosterCategory>('all');
  const [adding, setAdding] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => roster.roster.filter(r =>
    (category === 'all' || r.category === category) &&
    (!q || r.name.toLowerCase().includes(q) || r.role.toLowerCase().includes(q))
  ), [roster, category, q]);

  const counts = useMemo(() => ({
    all: roster.roster.length,
    'national-leader': roster.roster.filter(r => r.category === 'national-leader').length,
    'state-leader': roster.roster.filter(r => r.category === 'state-leader').length,
    institution: roster.roster.filter(r => r.category === 'institution').length,
  }), [roster]);

  return (
    <div>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-md">
        The allowlist behind the Netaji Report Card — only a name matching one of these entries (by name or
        alias) ever gets a report-card row. Keep this current as cabinets reshuffle, states hold elections, or
        key appointments (CJI, RBI Governor, CEC, CAG) change.
        {roster.source === 'local' && ' Shared backend not connected — changes here only apply to this browser.'}
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-stack-md">
        {(['all', 'national-leader', 'state-leader', 'institution'] as const).map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`font-label-caps text-[10px] uppercase px-3 py-1.5 news-border transition-colors ${category === c ? 'bg-primary text-on-primary' : 'hover:bg-surface-container'}`}
          >
            {c === 'all' ? 'All' : ROSTER_CATEGORY_LABEL[c]} ({counts[c]})
          </button>
        ))}
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or role…"
          className="flex-1 min-w-[180px] news-border px-3 py-1.5 bg-surface font-body-sm text-body-sm"
        />
        <button
          onClick={() => setAdding(a => !a)}
          className="flex items-center gap-1 font-label-caps text-[10px] uppercase px-3 py-1.5 news-border hover:bg-surface-container transition-colors"
        >
          <PlusCircle size={12} /> {adding ? 'Cancel' : 'Add Roster Entry'}
        </button>
      </div>

      {adding && (
        <RosterAddForm passphrase={passphrase} reload={() => { reload(); setAdding(false); }} onError={onError} />
      )}

      {filtered.length === 0 ? (
        <EmptyState label="Nothing matches this filter." />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(entry => (
            <RosterRow key={entry.id} entry={entry} passphrase={passphrase} reload={reload} onError={onError} />
          ))}
        </div>
      )}
    </div>
  );
};

const RosterRow: React.FC<{ entry: RosterEntry; passphrase: string; reload: () => void; onError: (m: string | null) => void }> = ({
  entry, passphrase, reload, onError,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry);
  const [aliasesText, setAliasesText] = useState(entry.aliases.join(', '));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const save = async () => {
    onError(null);
    const updated: RosterEntry = { ...draft, aliases: aliasesText.split(',').map(a => a.trim()).filter(Boolean) };
    const ok = await updateRosterEntry(updated, passphrase);
    if (ok) { setEditing(false); reload(); } else onError('Save failed — wrong passphrase or the shared store rejected the request.');
  };
  const doDelete = async () => {
    onError(null);
    const ok = await removeRosterEntry(entry.id, passphrase);
    if (ok) reload(); else onError('Delete failed — wrong passphrase or the shared store rejected the request.');
  };

  if (editing) {
    return (
      <div className="news-border bg-surface p-stack-sm">
        <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">Editing Roster Entry</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          <Field label="Name" value={draft.name} onChange={v => setDraft({ ...draft, name: v })} />
          <div>
            <label className="font-label-caps text-[10px] uppercase text-on-surface-variant block mb-1">Category</label>
            <select
              value={draft.category}
              onChange={e => setDraft({ ...draft, category: e.target.value as RosterCategory })}
              className="w-full news-border px-2 py-1.5 bg-surface text-primary font-body-sm text-body-sm"
            >
              <option value="national-leader">National Leader</option>
              <option value="state-leader">State Leader</option>
              <option value="institution">Institution</option>
            </select>
          </div>
          <Field label="Role" value={draft.role} onChange={v => setDraft({ ...draft, role: v })} full />
          <Field label="Aliases (comma-separated)" value={aliasesText} onChange={setAliasesText} full />
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={() => { setDraft(entry); setAliasesText(entry.aliases.join(', ')); setEditing(false); }}
            className="font-label-caps text-label-caps uppercase px-3 py-1.5 news-border hover:bg-surface-container"
          >
            Cancel
          </button>
          <button onClick={save} disabled={!draft.name.trim() || !draft.role.trim()} className="bg-primary text-on-primary font-label-caps text-label-caps uppercase px-3 py-1.5 hover:bg-secondary disabled:opacity-40">
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="news-border bg-surface p-stack-sm flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span className="font-label-caps text-[9px] uppercase font-bold text-secondary">{ROSTER_CATEGORY_LABEL[entry.category]}</span>
        <p className="font-body-sm text-body-sm font-bold text-primary">{entry.name}</p>
        <p className="font-meta text-[11px] text-on-surface-variant">{entry.role}</p>
        {entry.aliases.length > 0 && (
          <p className="font-meta text-[10px] text-outline mt-0.5">aka {entry.aliases.join(', ')}</p>
        )}
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={() => setEditing(true)} className="flex items-center gap-1 font-label-caps text-[10px] uppercase px-2.5 py-1.5 news-border hover:bg-surface-container">
          <Pencil size={11} /> Edit
        </button>
        <button
          onClick={() => (confirmingDelete ? doDelete() : setConfirmingDelete(true))}
          onBlur={() => setConfirmingDelete(false)}
          className={`flex items-center gap-1 font-label-caps text-[10px] uppercase px-2.5 py-1.5 news-border transition-colors ${confirmingDelete ? 'bg-secondary text-on-secondary' : 'hover:bg-surface-container'}`}
        >
          <Trash2 size={11} /> {confirmingDelete ? 'Confirm?' : 'Delete'}
        </button>
      </div>
    </div>
  );
};

const RosterAddForm: React.FC<{ passphrase: string; reload: () => void; onError: (m: string | null) => void }> = ({ passphrase, reload, onError }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [category, setCategory] = useState<RosterCategory>('national-leader');
  const [aliasesText, setAliasesText] = useState('');

  const canSave = Boolean(name.trim() && role.trim());

  const save = async () => {
    onError(null);
    const entry: RosterEntry = {
      id: `roster-manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      role: role.trim(),
      category,
      aliases: aliasesText.split(',').map(a => a.trim()).filter(Boolean),
    };
    const ok = await addRosterEntry(entry, passphrase);
    if (ok) reload(); else onError('Add failed — wrong passphrase or the shared store rejected the request.');
  };

  return (
    <div className="news-border bg-surface p-stack-sm mb-stack-md">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Name" value={name} onChange={setName} />
        <div>
          <label className="font-label-caps text-[10px] uppercase text-on-surface-variant block mb-1">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as RosterCategory)}
            className="w-full news-border px-2 py-1.5 bg-surface text-primary font-body-sm text-body-sm"
          >
            <option value="national-leader">National Leader</option>
            <option value="state-leader">State Leader</option>
            <option value="institution">Institution</option>
          </select>
        </div>
        <Field label="Role" value={role} onChange={setRole} full />
        <Field label="Aliases (comma-separated, optional)" value={aliasesText} onChange={setAliasesText} full />
      </div>
      <div className="flex justify-end mt-3">
        <button onClick={save} disabled={!canSave} className="bg-primary text-on-primary font-label-caps text-label-caps uppercase px-4 py-2 hover:bg-secondary disabled:opacity-40">
          Add to Roster
        </button>
      </div>
    </div>
  );
};

// ── System Health ─────────────────────────────────────────────────────────────

const SystemHealthTab: React.FC<{ bundle: LedgerBundle; roster: RosterBundle }> = ({ bundle, roster }) => {
  const meta = bundle.meta;

  return (
    <div className="flex flex-col gap-stack-md max-w-2xl">
      <HealthRow
        label="Shared Backend (Upstash)"
        status={bundle.source === 'shared'}
        detail={bundle.source === 'shared'
          ? 'Connected — every visitor reads/writes the same data.'
          : "Not connected — running on this browser's local storage only."}
      />
      <HealthRow
        label="Daily Automated Scan"
        status={Boolean(meta)}
        detail={meta
          ? `Last ran ${timeAgo(meta.lastRunAt)} — scanned ${meta.scanned} dispatch${meta.scanned === 1 ? '' : 'es'}, found ${meta.extractedVerdicts} verdict${meta.extractedVerdicts === 1 ? '' : 's'} + ${meta.extractedPromises} promise${meta.extractedPromises === 1 ? '' : 's'}.`
          : "Has not run yet, or Upstash isn't configured — see vercel.json for the schedule (daily, 3am)."}
      />
      <HealthRow
        label="Accountability Roster"
        status={roster.source === 'shared'}
        detail={roster.source === 'shared'
          ? `Connected — ${roster.roster.length} entries, editable from the Roster tab.`
          : `Serving the shipped seed list only (${roster.roster.length} entries) — connect the shared backend to make it admin-editable.`}
      />
      <div className="news-border bg-surface p-stack-sm">
        <p className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">Record Counts</p>
        <div className="grid grid-cols-2 gap-3 font-meta text-[12px]">
          <span>Verdicts total: <strong className="text-primary">{bundle.verdicts.length}</strong></span>
          <span>Promises total: <strong className="text-primary">{bundle.promises.length}</strong></span>
          <span>Roster entries: <strong className="text-primary">{roster.roster.length}</strong></span>
        </div>
      </div>
      <p className="font-meta text-[11px] text-on-surface-variant italic">
        Passphrase note: the unlock screen only confirms VITE_REVIEW_PASSPHRASE is set in this browser's build.
        Every actual write (approve/reject/edit/add) is re-checked server-side against REVIEW_PASSPHRASE — a wrong
        or missing server-side value fails the action even if you got past the unlock screen.
      </p>
    </div>
  );
};

const HealthRow: React.FC<{ label: string; status: boolean; detail: string }> = ({ label, status, detail }) => (
  <div className="news-border bg-surface p-stack-sm flex items-start gap-3">
    <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${status ? 'bg-[#0f7a4d]' : 'bg-[#9b2c3c]'}`} />
    <div>
      <p className="font-label-caps text-label-caps uppercase font-bold text-primary">{label}</p>
      <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{detail}</p>
    </div>
  </div>
);

// ── Shared bits ───────────────────────────────────────────────────────────────

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; full?: boolean }> = ({ label, value, onChange, full }) => (
  <div className={full ? 'md:col-span-2' : ''}>
    <label className="font-label-caps text-[10px] uppercase text-on-surface-variant block mb-1">{label}</label>
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full news-border px-2 py-1.5 bg-surface text-primary font-body-sm text-body-sm"
    />
  </div>
);

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="news-border bg-surface-container-low p-stack-lg text-center">
    <p className="font-body-sm text-body-sm text-on-surface-variant">{label}</p>
  </div>
);
