import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords } from 'lucide-react';
import { getInstitutionSummaries, type InstitutionSummary } from '../services/institutionLedgerService';
import { institutionToPath } from '../utils/routing';

type CategoryFilter = 'all' | InstitutionSummary['category'];

type SortFilter = 'most-active' | 'most-wins' | 'most-losses' | 'most-promises' | 'most-spin' | 'name-asc';

const CATEGORY_LABEL: Record<InstitutionSummary['category'], string> = {
  'national-leader': 'National Leaders',
  'state-leader': 'State Leaders',
  institution: 'Institutions',
};

/**
 * The Netaji Report Card leaderboard — one row per entry on the
 * Accountability Roster (see accountabilityRoster.ts): India's top national
 * leaders, every state/UT Chief Minister, and the country's main
 * institutions. Every entry appears even with zero recorded activity so far
 * — this is a directory of who's accountable, not just whoever happened to
 * get quoted. Every non-zero column traces back to real data: spin-decoded
 * quotes, verified L/W Ledger takes, and verified Vaada Clock promises. See
 * institutionLedgerService.ts for exactly what this is (and isn't) built
 * from, and accountabilityRoster.ts for why a name not on the roster never
 * shows up here at all.
 */
export const InstitutionsView: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<InstitutionSummary[] | null>(null);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortFilter>('most-active');

  useEffect(() => {
    let cancelled = false;
    getInstitutionSummaries().then(r => { if (!cancelled) setRows(r); });
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => {
    if (!rows) return { all: 0, 'national-leader': 0, 'state-leader': 0, institution: 0 };
    return {
      all: rows.length,
      'national-leader': rows.filter(r => r.category === 'national-leader').length,
      'state-leader': rows.filter(r => r.category === 'state-leader').length,
      institution: rows.filter(r => r.category === 'institution').length,
    };
  }, [rows]);

  const overallStats = useMemo(() => {
    if (!rows) return { total: 0, w: 0, l: 0, activeClocks: 0, totalSpin: 0 };
    return rows.reduce((acc, r) => ({
      total: acc.total + 1,
      w: acc.w + r.wins,
      l: acc.l + r.losses,
      activeClocks: acc.activeClocks + r.promisesKept + r.promisesBroken + r.promisesExtended + r.promisesStalled, // actually total promises tracked
      totalSpin: acc.totalSpin + r.spinCount
    }), { total: 0, w: 0, l: 0, activeClocks: 0, totalSpin: 0 });
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    return rows.filter(r =>
      (category === 'all' || r.category === category) &&
      (!q || r.name.toLowerCase().includes(q) || r.role.toLowerCase().includes(q)) &&
      (!activeOnly || r.spinCount + r.wins + r.losses + r.promisesKept + r.promisesBroken + r.promisesExtended + r.promisesStalled > 0)
    ).sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'most-wins') return b.wins - a.wins || a.name.localeCompare(b.name);
      if (sortBy === 'most-losses') return b.losses - a.losses || a.name.localeCompare(b.name);
      if (sortBy === 'most-spin') return b.spinCount - a.spinCount || a.name.localeCompare(b.name);
      if (sortBy === 'most-promises') {
        const pA = a.promisesKept + a.promisesBroken + a.promisesExtended + a.promisesStalled;
        const pB = b.promisesKept + b.promisesBroken + b.promisesExtended + b.promisesStalled;
        return pB - pA || a.name.localeCompare(b.name);
      }
      // default: most-active
      const actA = a.wins + a.losses + a.spinCount + a.articleCount + a.promisesKept + a.promisesBroken + a.promisesExtended + a.promisesStalled;
      const actB = b.wins + b.losses + b.spinCount + b.articleCount + b.promisesKept + b.promisesBroken + b.promisesExtended + b.promisesStalled;
      return actB - actA || a.name.localeCompare(b.name);
    });
  }, [rows, category, query, activeOnly, sortBy]);

  return (
    <div className="max-w-5xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg animate-fade-in">
      <div className="hairline-b pb-stack-md mb-stack-lg">
        <span className="font-label-caps text-label-caps uppercase text-secondary flex items-center gap-2">
          <Swords size={14} /> Netaji Report Card
        </span>
        <h1 className="font-headline-xl text-headline-xl font-bold text-primary leading-tight">
          Institutional Accountability Ledger
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 max-w-2xl">
          Every entry on India's Accountability Roster — the President, PM, cabinet-rank ministers, every state's
          Chief Minister, and the country's main institutions — with a live scorecard: how often our Spin Decoder
          caught them using vague, PR-softened language, their verified L/W record, and where their promises
          actually stand. A name not on this roster never gets a row here, no matter how often it's quoted.
        </p>
      </div>

      {rows === null ? (
        <p className="font-meta text-meta text-on-surface-variant italic">Loading ledger…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-stack-lg">
            <div className="news-border bg-surface p-4 flex flex-col gap-1">
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">Total Tracked</span>
              <span className="font-headline-lg text-headline-lg font-bold text-primary">{overallStats.total}</span>
            </div>
            <div className="news-border bg-surface p-4 flex flex-col gap-1">
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">Verified Decisions</span>
              <div className="flex items-baseline gap-2 font-headline-lg text-headline-lg font-bold text-primary">
                {overallStats.w + overallStats.l}
                <span className="font-meta text-xs font-normal text-on-surface-variant ml-1">({overallStats.w}W / {overallStats.l}L)</span>
              </div>
            </div>
            <div className="news-border bg-surface p-4 flex flex-col gap-1">
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">Vaada Clocks</span>
              <span className="font-headline-lg text-headline-lg font-bold text-primary">{overallStats.activeClocks}</span>
            </div>
            <div className="news-border bg-surface p-4 flex flex-col gap-1">
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">Spin Caught</span>
              <span className="font-headline-lg text-headline-lg font-bold text-secondary">{overallStats.totalSpin}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-stack-md">
            {(['all', 'national-leader', 'state-leader', 'institution'] as CategoryFilter[]).map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`font-label-caps text-[10px] uppercase px-3 py-1.5 news-border transition-colors ${category === c ? 'bg-primary text-on-primary' : 'hover:bg-surface-container'}`}
              >
                {c === 'all' ? 'All' : CATEGORY_LABEL[c]} ({counts[c]})
              </button>
            ))}
            <label className="flex items-center gap-1.5 font-label-caps text-[10px] uppercase text-on-surface-variant ml-1 cursor-pointer">
              <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
              With Activity Only
            </label>
            <select 
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortFilter)}
              className="font-label-caps text-[10px] uppercase news-border bg-surface px-2 py-1.5 ml-2 cursor-pointer"
            >
              <option value="most-active">Sort: Most Active</option>
              <option value="most-wins">Sort: Most Wins</option>
              <option value="most-losses">Sort: Most Losses</option>
              <option value="most-promises">Sort: Most Promises</option>
              <option value="most-spin">Sort: Most Spin Caught</option>
              <option value="name-asc">Sort: Name (A-Z)</option>
            </select>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or role…"
              className="flex-1 min-w-[180px] news-border px-3 py-1.5 bg-surface font-body-sm text-body-sm"
            />
          </div>

          {filtered && filtered.length === 0 ? (
            <div className="news-border bg-surface-container-low p-stack-lg text-center">
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Nothing matches this filter. Try clearing the search or turning off "With Activity Only" — most
                roster entries start at zero until a dispatch quotes them, a verdict names them, or a promise of
                theirs gets tracked and reviewed.
              </p>
            </div>
          ) : (
            <div className="news-border bg-surface overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="hairline-b font-label-caps text-[10px] uppercase text-on-surface-variant">
                    <th className="p-3">#</th>
                    <th className="p-3">Institution / Official</th>
                    <th className="p-3 text-right">W / L</th>
                    <th className="p-3 text-right">Vaada Record</th>
                    <th className="p-3 text-right">Spin Phrases</th>
                    <th className="p-3 text-right">Dispatches</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered!.map((r, i) => (
                    <tr
                      key={r.slug}
                      onClick={() => navigate(institutionToPath(r.name))}
                      className="hairline-b cursor-pointer hover:bg-surface-container-low transition-colors"
                    >
                      <td className="p-3 font-meta text-meta text-outline">{i + 1}</td>
                      <td className="p-3">
                        <span className="font-body-sm text-body-sm font-bold text-primary block">{r.name}</span>
                        <span className="font-meta text-[10px] text-on-surface-variant">{r.role}</span>
                      </td>
                      <td className="p-3 text-right font-meta text-meta whitespace-nowrap">
                        {r.wins + r.losses === 0 ? <span className="text-outline">—</span> : (
                          <div className="flex flex-col items-end gap-1">
                            <div>
                              <span className="font-bold" style={{ color: '#0f7a4d' }}>{r.wins}W</span>
                              {' / '}
                              <span className="font-bold text-secondary">{r.losses}L</span>
                            </div>
                            <div className="w-16 h-1.5 bg-secondary flex rounded-sm overflow-hidden">
                              <div style={{ width: `${Math.round((r.wins / (r.wins + r.losses)) * 100)}%`, backgroundColor: '#0f7a4d' }} />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-meta text-[11px] text-on-surface-variant whitespace-nowrap">
                        {r.promisesKept + r.promisesBroken + r.promisesExtended + r.promisesStalled === 0
                          ? <span className="text-outline">—</span>
                          : `${r.promisesKept} kept · ${r.promisesBroken} broken · ${r.promisesExtended} extended`}
                      </td>
                      <td className="p-3 text-right font-bold text-secondary">
                        {r.spinCount === 0 ? <span className="text-outline font-normal">—</span> : r.spinCount}
                      </td>
                      <td className="p-3 text-right font-meta text-meta text-on-surface-variant">
                        {r.articleCount === 0 ? <span className="text-outline">—</span> : r.articleCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <p className="font-meta text-[11px] text-on-surface-variant italic mt-stack-md">
        Spin count only tracks how officials phrase things, not whether their decisions are good or bad. W/L
        and Vaada figures only ever count records a human has verified at /ops/review — never a raw AI guess.
      </p>
    </div>
  );
};
