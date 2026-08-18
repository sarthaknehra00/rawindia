import React, { useState, useMemo, useEffect } from 'react';
import { TAXONOMY_DATA, STATES_AND_UTS_LIST } from '../data/taxonomyData';
import type { Article } from '../types';
import { ChevronRight, Filter, MapPin, Search, X, TrendingUp } from 'lucide-react';
import { timeAgo, isJustIn } from '../utils/timeUtils';
import { fetchStateNews } from '../services/googleNewsService';
import { saveArticles } from '../services/persistenceService';

// ── Regional grouping for the States panel ───────────────────────────────────
const REGIONS: Record<string, string[]> = {
  'North':     ['Delhi (NCT)', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Ladakh', 'Punjab', 'Rajasthan', 'Uttar Pradesh', 'Uttarakhand', 'Chandigarh'],
  'South':     ['Andhra Pradesh', 'Goa', 'Karnataka', 'Kerala', 'Puducherry', 'Tamil Nadu', 'Telangana', 'Lakshadweep'],
  'East':      ['Bihar', 'Jharkhand', 'Odisha', 'Sikkim', 'West Bengal', 'Andaman & Nicobar Islands'],
  'West':      ['Chhattisgarh', 'Gujarat', 'Madhya Pradesh', 'Maharashtra', 'Dadra & Nagar Haveli and Daman & Diu'],
  'Northeast': ['Arunachal Pradesh', 'Assam', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Tripura'],
};

// States that typically generate the most news coverage
const HOT_STATES = ['Uttar Pradesh', 'Delhi (NCT)', 'Maharashtra', 'West Bengal', 'Bihar', 'Karnataka', 'Tamil Nadu', 'Gujarat'];


interface TaxonomyExplorerProps {
  selectedVerticalId: number | null;
  onSelectVertical: (id: number | null, subId?: string, subSubId?: string) => void;
  articles: Article[];
  onSelectArticle: (article: Article) => void;
}

// Major city keywords per state for broader matching
const STATE_KEYWORDS: Record<string, string[]> = {
  'Uttar Pradesh':     ['uttar pradesh', 'lucknow', 'kanpur', 'varanasi', 'allahabad', 'prayagraj', 'agra', 'noida', 'ghaziabad', 'meerut'],
  'Maharashtra':       ['maharashtra', 'mumbai', 'pune', 'nagpur', 'thane', 'nashik', 'aurangabad'],
  'Delhi':             ['delhi', 'new delhi', 'ncr', 'dwarka', 'rohini', 'chandni chowk'],
  'Karnataka':         ['karnataka', 'bengaluru', 'bangalore', 'mysuru', 'mysore', 'hubli'],
  'Tamil Nadu':        ['tamil nadu', 'chennai', 'coimbatore', 'madurai', 'trichy'],
  'Gujarat':           ['gujarat', 'ahmedabad', 'surat', 'vadodara', 'rajkot', 'gandhinagar', 'dholera'],
  'West Bengal':       ['west bengal', 'kolkata', 'howrah', 'darjeeling', 'siliguri'],
  'Rajasthan':         ['rajasthan', 'jaipur', 'jodhpur', 'udaipur', 'kota', 'ajmer'],
  'Madhya Pradesh':    ['madhya pradesh', 'bhopal', 'indore', 'gwalior', 'jabalpur'],
  'Andhra Pradesh':    ['andhra pradesh', 'amaravati', 'visakhapatnam', 'vijayawada'],
  'Telangana':         ['telangana', 'hyderabad', 'warangal', 'nizamabad'],
  'Kerala':            ['kerala', 'thiruvananthapuram', 'kochi', 'kozhikode', 'thrissur'],
  'Bihar':             ['bihar', 'patna', 'gaya', 'muzaffarpur', 'bhagalpur'],
  'Punjab':            ['punjab', 'chandigarh', 'amritsar', 'ludhiana', 'jalandhar'],
  'Haryana':           ['haryana', 'gurugram', 'gurgaon', 'faridabad', 'panipat'],
  'Assam':             ['assam', 'guwahati', 'dispur', 'silchar', 'dibrugarh'],
  'Odisha':            ['odisha', 'bhubaneswar', 'cuttack', 'rourkela'],
  'Jharkhand':         ['jharkhand', 'ranchi', 'jamshedpur', 'dhanbad'],
  'Chhattisgarh':      ['chhattisgarh', 'raipur', 'bilaspur'],
  'Uttarakhand':       ['uttarakhand', 'dehradun', 'haridwar', 'rishikesh'],
  'Himachal Pradesh':  ['himachal', 'shimla', 'manali', 'dharamsala'],
  'Goa':               ['goa', 'panaji', 'margao'],
  'Jammu & Kashmir':   ['jammu', 'kashmir', 'srinagar', 'anantnag', 'pulwama'],
  'Ladakh':            ['ladakh', 'leh', 'kargil'],
};

function escapeForRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Word-boundary match, not plain substring — a naive `text.includes(kw)` false-
// positives constantly: "Goa" matches inside "Goal" (every football headline),
// "NCR" matches inside "concrete"/"encroachment", short city keywords match
// inside unrelated words. `\b` anchors each keyword to real word edges so
// "goa" only matches the standalone word, not a substring of a longer one.
function articleMatchesState(art: Article, state: string): boolean {
  const keywords = STATE_KEYWORDS[state] || [state.toLowerCase()];
  const text = (art.title + ' ' + (art.subtitle || '') + ' ' + (art.state || '') + ' ' + art.tags.join(' ')).toLowerCase();
  return keywords.some(kw => new RegExp(`\\b${escapeForRegex(kw)}\\b`).test(text));
}

function getContentTypeClass(ct: string) {
  if (ct === 'GROUND REPORT') return 'bg-primary text-on-primary';
  if (ct === 'ANALYSIS')      return 'border border-on-surface-variant text-on-surface-variant bg-surface-container';
  if (ct === 'OPINION')       return 'bg-secondary text-on-secondary';
  return 'news-border text-primary';
}

export const TaxonomyExplorer: React.FC<TaxonomyExplorerProps> = ({
  selectedVerticalId,
  onSelectVertical,
  articles,
  onSelectArticle,
}) => {
  const currentVertical = TAXONOMY_DATA.find(v => v.id === (selectedVerticalId ?? 1)) ?? TAXONOMY_DATA[0];
  const [selectedState,       setSelectedState]       = useState('Uttar Pradesh');
  const [contentTypeFilter,   setContentTypeFilter]   = useState('ALL');
  const [verifiedOnly,        setVerifiedOnly]        = useState(false);
  const [selectedSubCategory, setSelectedSubCategory] = useState('ALL');
  const [stateArticles,       setStateArticles]       = useState<Article[]>([]);
  const [stateNewsLoading,    setStateNewsLoading]    = useState(false);
  // States panel filters
  const [stateSearch,         setStateSearch]         = useState('');
  const [regionFilter,        setRegionFilter]        = useState<'All' | 'North' | 'South' | 'East' | 'West' | 'Northeast' | 'UTs'>('All');

  // Compute article counts per state from the loaded article pool
  const stateArticleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STATES_AND_UTS_LIST.forEach(s => {
      counts[s.name] = articles.filter(a => articleMatchesState(a, s.name)).length;
    });
    return counts;
  }, [articles]);

  // Filtered & sorted state list
  const filteredStates = useMemo(() => {
    let list = STATES_AND_UTS_LIST;
    // Region / type filter
    if (regionFilter === 'UTs') {
      list = list.filter(s => s.type === 'UT');
    } else if (regionFilter !== 'All') {
      const regionNames = REGIONS[regionFilter] ?? [];
      list = list.filter(s => regionNames.includes(s.name));
    }
    // Text search
    if (stateSearch.trim()) {
      const q = stateSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.capital.toLowerCase().includes(q));
    }
    // Sort by article count desc, then alphabetically
    return [...list].sort((a, b) => (stateArticleCounts[b.name] ?? 0) - (stateArticleCounts[a.name] ?? 0) || a.name.localeCompare(b.name));
  }, [stateSearch, regionFilter, stateArticleCounts]);



  // A sub-category selection from a previous vertical doesn't apply to this
  // one — reset it on switch so a stale selection can't silently leave every
  // pill unhighlighted while filtering nothing.
  useEffect(() => {
    setSelectedSubCategory('ALL');
  }, [selectedVerticalId]);

  // Real, on-demand news for the selected state — previously this vertical
  // relied entirely on hoping the generic national pool happened to mention
  // a state's city by name, which with a small/rate-limited pool frequently
  // found nothing at all. Fetches genuine state-specific coverage instead.
  useEffect(() => {
    if (selectedVerticalId !== 2) return;
    let cancelled = false;
    setStateNewsLoading(true);
    fetchStateNews(selectedState)
      .then(fetched => {
        if (cancelled) return;
        setStateArticles(fetched);
        if (fetched.length > 0) saveArticles(fetched).catch(() => {});
      })
      .catch(() => { if (!cancelled) setStateArticles([]); })
      .finally(() => { if (!cancelled) setStateNewsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedVerticalId, selectedState]);

  // Merge freshly-fetched state news with whatever's already in the shared
  // pool (deduped by id, freshly-fetched wins since it's guaranteed on-topic).
  const articlesWithState = useMemo(() => {
    if (selectedVerticalId !== 2 || stateArticles.length === 0) return articles;
    const freshIds = new Set(stateArticles.map(a => a.id));
    return [...stateArticles, ...articles.filter(a => !freshIds.has(a.id))];
  }, [articles, selectedVerticalId, stateArticles]);

  // ── Vertical + state filter (fast, memoized) ─────────────────────────────
  const verticalFiltered = useMemo(() => {
    const vId = selectedVerticalId;
    if (!vId) return articlesWithState;

    // Build keyword set for this vertical from sub-category names and slugs
    const vKeywords = currentVertical.subCategories.flatMap(s => [
      ...s.name.toLowerCase().split(/[\s&,\/]+/).filter(w => w.length > 3),
      ...s.slug.split('-').filter(w => w.length > 3),
      ...(s.subSubCategories?.flatMap(ss => [
        ...ss.name.toLowerCase().split(/[\s&,\/\(\)]+/).filter(w => w.length > 3),
        ...ss.slug.split('-').filter(w => w.length > 3),
      ]) ?? []),
    ]);

    return articlesWithState.filter(art => {
      // State vertical: keyword match against state
      if (vId === 2) {
        return articleMatchesState(art, selectedState);
      }
      // Exact verticalId match (best signal)
      if (art.verticalId === vId) return true;
      // Vertical name match
      const vName = currentVertical.name.toLowerCase();
      const artText = (art.title + ' ' + (art.subtitle || '') + ' ' + (art.verticalName || '') + ' ' + art.tags.join(' ')).toLowerCase();
      if (artText.includes(vName)) return true;
      // Keyword match using sub-category keywords
      if (vKeywords.some(kw => artText.includes(kw))) return true;
      return false;
    });
  }, [articlesWithState, selectedVerticalId, selectedState, currentVertical]);

  // ── Content type + verified + sub-category filter ────────────────────────
  const finalFiltered = useMemo(() => {
    const sub = selectedSubCategory !== 'ALL'
      ? currentVertical.subCategories.find(s => s.id === selectedSubCategory)
      : undefined;

    // Build a rich keyword set for the selected sub-category so we match
    // articles that don't yet have subCategoryId assigned (most raw articles).
    // Keywords come from:
    //   1. Each individual word in the sub-category name (e.g. "Government", "Administration")
    //   2. Each slug segment (e.g. "government", "administration")
    //   3. Each sub-subcategory name's individual words
    const subKeywords: string[] = [];
    if (sub) {
      // Individual words from the sub-category name, filtered to meaningful length
      sub.name.toLowerCase().split(/[\s&,\/]+/).filter(w => w.length > 3).forEach(w => subKeywords.push(w));
      // Slug segments
      sub.slug.split('-').filter(w => w.length > 3).forEach(w => subKeywords.push(w));
      // Sub-subcategory names (words)
      sub.subSubCategories?.forEach(ss => {
        ss.name.toLowerCase().split(/[\s&,\/\(\)]+/).filter(w => w.length > 3).forEach(w => subKeywords.push(w));
        ss.slug.split('-').filter(w => w.length > 3).forEach(w => subKeywords.push(w));
      });
    }

    return verticalFiltered.filter(art => {
      if (contentTypeFilter !== 'ALL' && art.contentType !== contentTypeFilter) return false;
      if (verifiedOnly && art.sourceTransparency.some(s => s.type === 'Social-media claim (unverified)')) return false;
      if (sub) {
        // Try exact structural match first (assigned by Groq synthesis)
        if (art.subCategoryId === sub.id) return true;
        // Keyword match — check title, subtitle, tags against our keyword set
        const searchText = [
          art.title,
          art.subtitle || '',
          art.subCategoryName || '',
          ...art.tags,
        ].join(' ').toLowerCase();
        const matches = subKeywords.some(kw => searchText.includes(kw));
        if (!matches) return false;
      }
      return true;
    });
  }, [verticalFiltered, contentTypeFilter, verifiedOnly, selectedSubCategory, currentVertical]);

  const leadStory   = finalFiltered[0] ?? articlesWithState[0];
  const feedStories = finalFiltered.slice(1, 21); // max 20 in grid

  const isGroundReport = leadStory?.contentType === 'GROUND REPORT';

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg animate-fade-in">

      {/* Breadcrumb */}
      <div className="font-label-caps text-[11px] text-on-surface-variant mb-3 flex items-center gap-1.5 uppercase">
        <button onClick={() => onSelectVertical(null)} className="hover:text-primary transition-colors">Home</button>
        <ChevronRight size={11} />
        <span>Vertical {currentVertical.number}</span>
        <ChevronRight size={11} />
        <span className="text-primary font-bold">
          {selectedVerticalId === 2 ? selectedState : currentVertical.name}
        </span>
      </div>

      {/* Page header */}
      <div className="hairline-b pb-stack-md mb-stack-md">
        {currentVertical.id === 2 ? (
          <>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="font-headline-xl text-headline-xl font-bold text-primary">
                {selectedState.replace(' (NCT)', '')}
              </h1>
              {(() => {
                const stInfo = STATES_AND_UTS_LIST.find(s => s.name === selectedState);
                return stInfo ? (
                  <div className="flex items-center gap-2">
                    <span className={`font-label-caps text-[10px] px-2 py-0.5 uppercase ${stInfo.type === 'UT' ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant border border-outline-variant'}`}>
                      {stInfo.type === 'UT' ? 'Union Territory' : 'State'}
                    </span>
                    <span className="font-meta text-[11px] text-on-surface-variant flex items-center gap-1">
                      <MapPin size={10} /> {stInfo.capital}
                    </span>
                    {(stateArticleCounts[selectedState] ?? 0) > 0 && (
                      <span className="font-label-caps text-[10px] text-secondary">
                        {stateArticleCounts[selectedState]} dispatches
                      </span>
                    )}
                  </div>
                ) : null;
              })()}
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-3xl">
              Latest verified dispatches from {selectedState} — politics, governance, law enforcement, society, and ground reports.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-headline-xl text-headline-xl font-bold text-primary mb-2">
              {currentVertical.name}
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-3xl">{currentVertical.description}</p>
          </>
        )}
      </div>

      {/* ── States & UTs Selector — only visible on States vertical ── */}
      {currentVertical.id === 2 && (

        <div className="mb-stack-lg">

          {/* Header bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-secondary" />
              <span className="font-label-caps text-label-caps uppercase font-bold text-primary">
                States &amp; Union Territories
              </span>
              <span className="font-meta text-[10px] text-outline bg-surface-container px-1.5 py-0.5">
                {STATES_AND_UTS_LIST.length} total
              </span>
            </div>
            <span className="font-meta text-[11px] text-on-surface-variant">
              Viewing: <strong className="text-primary">{selectedState}</strong>
            </span>
          </div>

          {/* Trending / Hot States quick row */}
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp size={11} className="text-secondary" />
              <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">Top Coverage</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {HOT_STATES.map(name => {
                const count = stateArticleCounts[name] ?? 0;
                const isActive = selectedState === name;
                return (
                  <button
                    key={name}
                    onClick={() => setSelectedState(name)}
                    className={`flex items-center gap-1 px-2 py-1 border font-label-caps text-[11px] uppercase transition-colors ${
                      isActive
                        ? 'bg-secondary text-on-secondary border-secondary font-bold'
                        : 'border-outline-variant hover:border-secondary hover:text-secondary'
                    }`}
                  >
                    {name.replace(' (NCT)', '')}
                    {count > 0 && (
                      <span className={`text-[9px] px-1 py-0 ${isActive ? 'bg-on-secondary/20' : 'bg-surface-container'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search + Region filter tabs */}
          <div className="news-border p-3 bg-wash-warm">
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              {/* Search box */}
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-2.5 text-outline" />
                <input
                  type="text"
                  value={stateSearch}
                  onChange={e => setStateSearch(e.target.value)}
                  placeholder="Search state or capital..."
                  className="w-full pl-8 pr-8 py-2 border border-outline-variant bg-surface text-on-surface font-meta text-meta focus:outline-none focus:border-secondary text-[13px]"
                />
                {stateSearch && (
                  <button onClick={() => setStateSearch('')} className="absolute right-2 top-2.5 text-outline hover:text-primary">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Region tabs */}
              <div className="flex flex-wrap gap-1">
                {(['All', 'North', 'South', 'East', 'West', 'Northeast', 'UTs'] as const).map(region => (
                  <button
                    key={region}
                    onClick={() => setRegionFilter(region)}
                    className={`px-2.5 py-1.5 border font-label-caps text-[10px] uppercase transition-colors whitespace-nowrap ${
                      regionFilter === region
                        ? 'bg-primary text-on-primary border-primary font-bold'
                        : 'border-outline-variant hover:border-secondary hover:text-secondary'
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>

            {/* State grid */}
            {filteredStates.length === 0 ? (
              <p className="font-meta text-meta text-on-surface-variant text-center py-4">
                No states match "{stateSearch}"
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 max-h-64 overflow-y-auto pr-1">
                {filteredStates.map(st => {
                  const count = stateArticleCounts[st.name] ?? 0;
                  const isActive = selectedState === st.name;
                  return (
                    <button
                      key={st.name}
                      onClick={() => setSelectedState(st.name)}
                      title={`${st.name} · Capital: ${st.capital}`}
                      className={`flex flex-col items-start p-2 border text-left transition-colors group ${
                        isActive
                          ? 'bg-primary text-on-primary border-primary'
                          : 'border-outline-variant bg-surface hover:border-secondary'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-0.5">
                        <span className={`font-label-caps text-[10px] uppercase font-bold leading-tight ${isActive ? 'text-on-primary' : 'text-on-surface group-hover:text-secondary'}`}>
                          {st.name.replace(' (NCT)', '')}
                        </span>
                        {st.type === 'UT' && (
                          <span className={`font-label-caps text-[8px] px-1 ${isActive ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container text-outline'}`}>
                            UT
                          </span>
                        )}
                      </div>
                      <span className={`font-meta text-[9px] truncate w-full ${isActive ? 'text-on-primary/70' : 'text-outline'}`}>
                        {st.capital}
                      </span>
                      {count > 0 && (
                        <span className={`font-label-caps text-[9px] mt-0.5 ${isActive ? 'text-on-primary/80' : 'text-secondary'}`}>
                          {count} dispatch{count !== 1 ? 'es' : ''}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Filter summary */}
            <div className="flex items-center justify-between mt-2 pt-2 hairline-t">
              <span className="font-meta text-[10px] text-on-surface-variant">
                {filteredStates.length} of {STATES_AND_UTS_LIST.length} shown
                {regionFilter !== 'All' && ` · ${regionFilter} region`}
                {stateSearch && ` · "${stateSearch}"`}
              </span>
              {(regionFilter !== 'All' || stateSearch) && (
                <button
                  onClick={() => { setRegionFilter('All'); setStateSearch(''); }}
                  className="font-label-caps text-[10px] uppercase text-secondary hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Sub-category pills — hidden on States vertical (geographic, not topical) */}
      {currentVertical.id !== 2 && (
        <div className="flex flex-wrap gap-2 mb-stack-md font-label-caps text-[11px] uppercase overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setSelectedSubCategory('ALL')}
            className={`px-3 py-1 border transition-colors flex-shrink-0 ${
              selectedSubCategory === 'ALL' ? 'bg-primary text-on-primary border-primary font-bold' : 'border-outline-variant hover:border-secondary hover:text-secondary'
            }`}
          >
            All
          </button>
          {currentVertical.subCategories.map(sub => (
            <button
              key={sub.id}
              onClick={() => setSelectedSubCategory(sub.id)}
              className={`px-3 py-1 border transition-colors flex-shrink-0 ${
                selectedSubCategory === sub.id ? 'bg-primary text-on-primary border-primary font-bold' : 'border-outline-variant hover:border-secondary hover:text-secondary'
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      {/* For the States vertical: topic quick-filter row using India/National sub-cats */}
      {currentVertical.id === 2 && (
        <div className="flex flex-wrap gap-2 mb-stack-md font-label-caps text-[11px] uppercase overflow-x-auto hide-scrollbar">
          {[
            { id: 'ALL', name: 'All Topics' },
            { id: 'politics', name: 'Politics & Polls' },
            { id: 'crime', name: 'Crime & Law' },
            { id: 'infrastructure', name: 'Infrastructure' },
            { id: 'society', name: 'Society' },
            { id: 'disasters', name: 'Disasters' },
            { id: 'economy', name: 'Economy' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedSubCategory(t.id)}
              className={`px-3 py-1 border transition-colors flex-shrink-0 ${
                selectedSubCategory === t.id ? 'bg-primary text-on-primary border-primary font-bold' : 'border-outline-variant hover:border-secondary hover:text-secondary'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Format + verified filter row */}
      <div className="flex flex-wrap items-center justify-between hairline-t hairline-b py-2 mb-stack-lg font-label-caps text-[11px] uppercase gap-3">
        <div className="flex items-center gap-3">
          <Filter size={12} className="text-outline" />
          <select
            value={contentTypeFilter}
            onChange={e => setContentTypeFilter(e.target.value)}
            className="bg-transparent border-none focus:ring-0 font-label-caps text-[11px] uppercase cursor-pointer font-bold"
          >
            <option value="ALL">All Formats</option>
            <option value="NEWS">News</option>
            <option value="GROUND REPORT">Ground Report</option>
            <option value="ANALYSIS">Analysis</option>
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={e => setVerifiedOnly(e.target.checked)}
            className="h-3 w-3 rounded-none border-primary text-primary accent-primary focus:ring-primary"
          />
          <span className="font-bold">Verified Sources Only</span>
        </label>
      </div>

      {/* Loading state — fetching real state-specific news on demand */}
      {stateNewsLoading && finalFiltered.length === 0 && (
        <div className="news-border p-section-gap text-center animate-pulse">
          <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            Fetching {selectedState} dispatches…
          </p>
        </div>
      )}

      {/* Empty state */}
      {!stateNewsLoading && finalFiltered.length === 0 && (
        <div className="news-border p-section-gap text-center">
          <p className="font-headline-lg text-headline-lg font-bold text-primary mb-2">No dispatches found</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
            No {selectedVerticalId === 2 ? selectedState : currentVertical.name} news matches the selected filters.
          </p>
          <button
            onClick={() => { setContentTypeFilter('ALL'); setVerifiedOnly(false); }}
            className="bg-primary text-on-primary font-label-caps text-label-caps uppercase px-4 py-2 hover:bg-secondary transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}

      {finalFiltered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
          {/* ── MAIN CONTENT (8 cols) ── */}
          <div className="lg:col-span-8 flex flex-col gap-stack-lg">
            {/* Lead story */}
            {leadStory && (
              <article
                onClick={() => onSelectArticle(leadStory)}
                className="p-0 cursor-pointer group"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={leadStory.heroImage}
                    alt={leadStory.title}
                    loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&auto=format&fit=crop&q=80`; }}
                    className={`w-full h-72 md:h-80 object-cover ${isGroundReport ? 'editorial-img-hard' : 'editorial-img'}`}
                  />
                  <span className={`absolute top-3 left-3 font-label-caps text-label-caps px-2 py-1 ${getContentTypeClass(leadStory.contentType)}`}>
                    {leadStory.contentType}
                  </span>
                  {isJustIn(leadStory.publishedAt) && (
                    <span className="absolute top-3 right-3 bg-error text-on-error font-label-caps text-[10px] px-2 py-1 uppercase animate-pulse">
                      Just In
                    </span>
                  )}
                </div>
                <div className="p-stack-md">
                  <h2 className="font-headline-lg text-headline-lg font-bold mb-2 group-hover:text-secondary transition-colors leading-tight">
                    {leadStory.title}
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mb-3 leading-relaxed">
                    {leadStory.subtitle}
                  </p>
                  <div className="flex justify-between items-center font-meta text-meta text-outline hairline-t pt-2">
                    <span>By {leadStory.author.name}</span>
                    <span>{timeAgo(leadStory.publishedAt)}</span>
                  </div>
                </div>
              </article>
            )}

            {/* Feed grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              {feedStories.map(art => (
                <article
                  key={art.id}
                  onClick={() => onSelectArticle(art)}
                  className="hairline-b pb-stack-md cursor-pointer group transition-colors"
                >
                  {art.heroImage && (
                    <img
                      src={art.heroImage}
                      alt={art.title}
                      loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&auto=format&fit=crop&q=80`; }}
                      className={`w-full h-36 object-cover mb-2 ${
                        art.contentType === 'GROUND REPORT' ? 'editorial-img-hard' : 'editorial-img'
                      }`}
                    />
                  )}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`font-label-caps text-[10px] uppercase px-1.5 py-0.5 ${getContentTypeClass(art.contentType)}`}>
                      {art.contentType}
                    </span>
                    {art.isGroqSynthesized && (
                      <span className="font-meta text-[10px] text-secondary">✦</span>
                    )}
                    {isJustIn(art.publishedAt) && (
                      <span className="font-label-caps text-[9px] uppercase text-error">Just In</span>
                    )}
                  </div>
                  <h3 className="font-headline-lg text-base font-bold mb-1.5 group-hover:text-secondary transition-colors leading-snug">
                    {art.title}
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2 mb-2">
                    {art.subtitle}
                  </p>
                  <div className="font-meta text-[11px] text-outline flex justify-between">
                    <span>{art.author.name}</span>
                    <span>{timeAgo(art.publishedAt)}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* ── SIDEBAR (4 cols) ── */}
          <aside className="lg:col-span-4 flex flex-col gap-stack-lg">
            {/* Ranking info box */}
            <div className="news-border p-stack-md bg-wash-warm">
              <h3 className="font-label-caps text-label-caps uppercase font-bold text-primary mb-3 hairline-b pb-2">
                {selectedVerticalId === 2 ? `${selectedState} News` : `${currentVertical.name} Feed`}
              </h3>
              <div className="space-y-2 font-meta text-meta text-on-surface-variant">
                <div className="flex justify-between hairline-b pb-1">
                  <span>Total dispatches:</span>
                  <strong className="text-primary">{finalFiltered.length}</strong>
                </div>
                <div className="flex justify-between hairline-b pb-1">
                  <span>Groq synthesized:</span>
                  <strong className="text-secondary">{finalFiltered.filter(a => a.isGroqSynthesized).length}</strong>
                </div>
                <div className="flex justify-between hairline-b pb-1">
                  <span>P0 critical:</span>
                  <strong className="text-error">{finalFiltered.filter(a => a.ranking?.priorityTier === 'P0').length}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Last updated:</span>
                  <strong className="text-primary">{timeAgo(finalFiltered[0]?.publishedAt || new Date().toISOString())}</strong>
                </div>
              </div>
            </div>

            {/* P0 / Breaking stories in this vertical */}
            {finalFiltered.filter(a => a.ranking?.priorityTier === 'P0').length > 0 && (
              <div className="border border-error p-stack-md bg-error-container">
                <h3 className="font-label-caps text-label-caps uppercase font-bold text-on-error-container mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-error animate-pulse flex-shrink-0" />
                  Critical / P0 Stories
                </h3>
                {finalFiltered
                  .filter(a => a.ranking?.priorityTier === 'P0')
                  .slice(0, 3)
                  .map(art => (
                    <div
                      key={art.id}
                      onClick={() => onSelectArticle(art)}
                      className="border-b border-error/30 pb-2 mb-2 last:border-0 last:mb-0 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <p className="font-body-sm text-body-sm font-bold text-on-error-container leading-snug">
                        {art.title}
                      </p>
                      <span className="font-meta text-[10px] text-on-error-container opacity-70">{timeAgo(art.publishedAt)}</span>
                    </div>
                  ))
                }
              </div>
            )}

            {/* Ground Report teaser — pull from actual data */}
            {finalFiltered.find(a => a.contentType === 'GROUND REPORT') ? (
              <div
                className="bg-primary text-on-primary p-stack-md cursor-pointer"
                onClick={() => {
                  const gr = finalFiltered.find(a => a.contentType === 'GROUND REPORT');
                  if (gr) onSelectArticle(gr);
                }}
              >
                <div className="inline-block bg-secondary text-on-secondary font-label-caps text-label-caps px-2 py-1 mb-3 uppercase">
                  Ground Report
                </div>
                <img
                  src={finalFiltered.find(a => a.contentType === 'GROUND REPORT')?.heroImage}
                  alt="Ground Report"
                  loading="lazy"
                  onError={e => { (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&auto=format&fit=crop&q=80`; }}
                  className="w-full h-40 object-cover mb-3 editorial-img-hard"
                />
                <h3 className="font-headline-lg text-lg font-bold text-on-primary leading-tight mb-2">
                  {finalFiltered.find(a => a.contentType === 'GROUND REPORT')?.title}
                </h3>
                <span className="font-label-caps text-label-caps uppercase border border-on-primary px-3 py-1 hover:bg-on-primary hover:text-primary transition-colors">
                  Read Full Report →
                </span>
              </div>
            ) : (
              <div className="bg-primary text-on-primary p-stack-md">
                <div className="inline-block bg-secondary text-on-secondary font-label-caps text-label-caps px-2 py-1 mb-3 uppercase">
                  Ground Report
                </div>
                <h3 className="font-headline-lg text-lg font-bold text-on-primary leading-tight mb-2">
                  Exclusive: Ground-Level Intelligence from {selectedVerticalId === 2 ? selectedState : currentVertical.name}
                </h3>
                <p className="font-body-sm text-body-sm text-on-primary/70">
                  RAWINDIA field correspondents report on the ground reality — unfiltered.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};
