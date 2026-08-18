import type {
  Article,
  ArticleRanking,
  ImportanceFactors,
  InterestSignals,
  PriorityTier
} from '../types';
import { getViewCount } from './localEngagementService';
import { getStoryCluster, dedupeByOutlet } from './storyClusterService';

export interface SectionWeights {
  interestWeight: number;
  importanceWeight: number;
}

// Configurable per-section weights per PRD §2
export const SECTION_WEIGHTS: Record<string, SectionWeights> = {
  default:            { interestWeight: 0.60, importanceWeight: 0.40 },
  homepageHero:       { interestWeight: 0.50, importanceWeight: 0.50 },
  trendingRail:       { interestWeight: 0.80, importanceWeight: 0.20 },
  nationalPolitics:   { interestWeight: 0.40, importanceWeight: 0.60 },
  businessEconomy:    { interestWeight: 0.45, importanceWeight: 0.55 },
  entertainmentSports:{ interestWeight: 0.85, importanceWeight: 0.15 },
};

// Per PRD: OPINION & Entertainment lean Interest-heavy.
// PULSE content is never allowed to skip the Importance check; cap at P2 until verified.
function resolveWeights(article: Article, explicitSection: string): SectionWeights {
  if (explicitSection !== 'default') return SECTION_WEIGHTS[explicitSection] || SECTION_WEIGHTS.default;
  if (article.contentType === 'OPINION') return SECTION_WEIGHTS.entertainmentSports;
  if (article.verticalName?.match(/sports|entertainment|cricket|bollywood/i)) return SECTION_WEIGHTS.entertainmentSports;
  if (article.verticalName?.match(/national|politics|judiciary|defense|economy/i)) return SECTION_WEIGHTS.nationalPolitics;
  return SECTION_WEIGHTS.default;
}

/**
 * Compute the Importance Score (M - Magnitude) from the editorial checklist.
 * Weights per PRD §1-B: Scale 25%, Severity 25%, Institution 20%,
 * Irreversibility 10%, Accountability 10%, LongTerm 5%, Vulnerability 5%.
 */
export function calculateImportanceScore(factors: ImportanceFactors): number {
  const scaleMap:         Record<string, number> = { Local: 25,   State: 55,   National: 85,   Global: 100 };
  const severityMap:      Record<string, number> = { Minor: 20,   Moderate: 50, High: 80,      Critical: 100 };
  const institutionMap:   Record<string, number> = { None: 10,    Municipal: 35, State: 65,    'National Constitutional': 100 };
  const irreversibilityMap: Record<string, number> = { Reversible: 20, Moderate: 60, Irreversible: 100 };
  const accountabilityMap:  Record<string, number> = { Low: 20, Moderate: 50, High: 80, 'Exposing Corruption/Negligence': 100 };
  const longTermMap:       Record<string, number> = { '24h Cycle': 20, Weekly: 50, 'Multi-Month': 80, Generational: 100 };
  const vulnerabilityMap:  Record<string, number> = { General: 20, 'Targeted Group': 60, 'Vulnerable / Marginalized': 100 };

  const score =
    (scaleMap[factors.scaleOfImpact]              ?? 55) * 0.25 +
    (severityMap[factors.severity]                ?? 50) * 0.25 +
    (institutionMap[factors.institutionalSignificance] ?? 35) * 0.20 +
    (irreversibilityMap[factors.irreversibility]  ?? 60) * 0.10 +
    (accountabilityMap[factors.publicAccountabilityValue] ?? 50) * 0.10 +
    (longTermMap[factors.longTermRelevance]       ?? 50) * 0.05 +
    (vulnerabilityMap[factors.vulnerabilityOfAffected] ?? 20) * 0.05;

  return Math.round(score);
}

/**
 * Per PRD §2: Importance Floor Override triggers when a story hits Very High on
 * Scale of Impact OR Severity OR Institutional Significance.
 * When triggered, the story is GUARANTEED a P0 slot regardless of Interest Score.
 */
export function checkImportanceFloorOverride(factors: ImportanceFactors): boolean {
  if (factors.scaleOfImpact === 'Global') return true;
  if (factors.scaleOfImpact === 'National' && (factors.severity === 'Critical' || factors.severity === 'High')) return true;
  if (factors.severity === 'Critical') return true;
  if (factors.institutionalSignificance === 'National Constitutional') return true;
  return false;
}

/**
 * Compute the Interest Score with exponential half-life time decay.
 *
 * Weights, chosen for signals that are all genuinely real (see
 * InterestSignals in types.ts and deriveDefaultInterestSignals below):
 *  - Corroborating sources 55% — the strongest honest proxy available for
 *    "this is a big story": how many other pool articles are covering the
 *    same real-world event. Directly spot-checkable by scrolling the feed.
 *  - Urgency flag 25% — real isBreaking/isLiveBlog ingestion signal.
 *  - Local view count 20% — real but thin (single-browser, and 0 for
 *    anything just published), so kept as the smallest of the three.
 */
export function calculateInterestScore(
  signals: InterestSignals,
  publishedAt: string,
  halfLifeHours: number = 4.5
): { interestScore: number; rawInterestScore: number; hoursElapsed: number } {
  const normCorroboration = Math.min(100, signals.corroboratingSources * 20);
  const normLocalViews    = Math.min(100, signals.localViewCount * 8);
  const normUrgency       = signals.isUrgent ? 100 : 0;

  const rawInterestScore = Math.round(
    normCorroboration * 0.55 +
    normUrgency       * 0.25 +
    normLocalViews    * 0.20
  );

  const pubTime = new Date(publishedAt).getTime();
  const hoursElapsed = Math.max(0, (Date.now() - pubTime) / (1000 * 60 * 60));
  const decayFactor = Math.pow(0.5, hoursElapsed / halfLifeHours);
  const interestScore = Math.max(5, Math.round(rawInterestScore * decayFactor));

  return { interestScore, rawInterestScore, hoursElapsed };
}

// ── Corroboration counting (real cross-source-attention signal) ────────────
// This used to be its own from-scratch jaccard title-matcher — duplicating,
// less completely, logic the app already had: storyClusterService.ts tracks
// exactly "which other outlets covered this same story", populated by the
// real dedup passes across the whole ingestion pipeline (newsApiService.ts's
// NewsAPI-vs-Currents pass AND newsFilterService.ts's cross-source
// NewsAPI+GoogleNews+RBI merge — see that file's deduplicateArticles). That
// data already exists and already backs the reader-facing Coverage
// Comparison section (CoverageComparison.tsx); reusing it here means the
// ranking engine's Interest signal and what a reader sees on the article
// page are the same real number, not two independently-computed estimates
// that could quietly drift apart.
export function computeCorroborationCounts(articles: Article[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const a of articles) {
    const cluster = getStoryCluster(a.id);
    // dedupeByOutlet(...).length includes this article's own outlet — the
    // count we want is OTHER outlets, hence -1 (floored at 0: an article
    // that's a cluster primary with only itself as a member, or no cluster
    // at all, has zero corroboration).
    counts.set(a.id, cluster ? Math.max(0, dedupeByOutlet(cluster.members).length - 1) : 0);
  }
  return counts;
}

/**
 * Full ranking evaluation for one article. `corroborationCount` should come
 * from a single computeCorroborationCounts() pass over the whole pool (see
 * rankArticles) — it's inherently a pool-wide comparison, not something one
 * article can compute about itself.
 */
export function scoreArticle(article: Article, section: string = 'default', corroborationCount: number = 0): ArticleRanking {
  const weights = resolveWeights(article, section);

  const importanceFactors: ImportanceFactors = article.ranking?.importanceFactors || deriveDefaultImportanceFactors(article);
  const importanceScore   = calculateImportanceScore(importanceFactors);
  const floorOverride     = checkImportanceFloorOverride(importanceFactors);

  const interestSignals: InterestSignals = article.ranking?.interestSignals || deriveDefaultInterestSignals(article, corroborationCount);
  // Per PRD: shorter half-life for breaking news, longer for evergreen
  const halfLifeHours = article.isBreaking ? 2.5 : article.tags.includes('Evergreen') ? 24 : 4.5;
  const { interestScore, rawInterestScore } = calculateInterestScore(interestSignals, article.publishedAt, halfLifeHours);

  let priorityScore = Math.round(interestScore * weights.interestWeight + importanceScore * weights.importanceWeight);

  // Per PRD §2: Floor Override GUARANTEES P0 — bump score past P0 threshold unconditionally.
  if (floorOverride) {
    priorityScore = Math.max(priorityScore, 82);
  }

  // Tier assignment per PRD §3
  let priorityTier: PriorityTier;
  if (article.tags.includes('Evergreen')) {
    priorityTier = 'EVERGREEN';
  } else if (floorOverride || priorityScore >= 80) {
    priorityTier = 'P0';
  } else if (priorityScore >= 62 || importanceScore >= 75) {
    priorityTier = 'P1';
  } else if (priorityScore >= 38) {
    priorityTier = 'P2';
  } else {
    priorityTier = 'P3';
  }

  // Per PRD §5: transparent "Why is this here?" label
  let whyIsThisHere: string;
  if (article.contentType === 'OPINION') {
    whyIsThisHere = `Reader Engagement — Opinion Weighted (Interest ${interestScore}/100)`;
  } else if (floorOverride) {
    const reason = importanceFactors.institutionalSignificance === 'National Constitutional'
      ? 'National Constitutional Institution'
      : importanceFactors.severity === 'Critical'
        ? 'Critical Severity'
        : `${importanceFactors.scaleOfImpact}-scale Impact`;
    whyIsThisHere = `Importance Floor Override — ${reason}`;
  } else if (interestScore > 75) {
    whyIsThisHere = `Trending Demand (${interestSignals.corroboratingSources} other outlets covering this)`;
  } else if (priorityTier === 'P0' || priorityTier === 'P1') {
    whyIsThisHere = `High Substance (${importanceScore}% Magnitude · ${interestScore}% Demand)`;
  } else {
    whyIsThisHere = `Standard Wire (${priorityTier})`;
  }

  return {
    interestScore,
    rawInterestScore,
    importanceScore,
    priorityScore,
    priorityTier,
    importanceFloorOverride: floorOverride,
    whyIsThisHere,
    importanceFactors,
    interestSignals,
    decayHalfLifeHours: halfLifeHours,
    lastScoredAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST'
  };
}

/**
 * Rank an array of articles using the RAWINDIA framework.
 * Sort order: P0 with Floor Override → P0 → P1 → P2 → P3 → EVERGREEN.
 */
export function rankArticles(articles: Article[], section: string = 'default'): Article[] {
  const TIER_ORDER: Record<PriorityTier, number> = { P0: 0, P1: 1, P2: 2, P3: 3, EVERGREEN: 4 };

  // Computed once for the whole pool — corroboration is inherently a
  // pool-wide comparison, not something scoreArticle can derive per-article.
  const corroborationCounts = computeCorroborationCounts(articles);

  return articles
    .map(art => ({ ...art, ranking: scoreArticle(art, section, corroborationCounts.get(art.id) ?? 0) }))
    .sort((a, b) => {
      const aTier = TIER_ORDER[a.ranking!.priorityTier];
      const bTier = TIER_ORDER[b.ranking!.priorityTier];

      // Different tiers: tier order wins
      if (aTier !== bTier) return aTier - bTier;

      // Same tier: floor-override articles rank above non-override within same tier
      const aFloor = a.ranking!.importanceFloorOverride ? 0 : 1;
      const bFloor = b.ranking!.importanceFloorOverride ? 0 : 1;
      if (aFloor !== bFloor) return aFloor - bFloor;

      // Finally: higher combined score wins
      return b.ranking!.priorityScore - a.ranking!.priorityScore;
    });
}

// ── Derivation helpers (used when article has no pre-set signals) ──────────────

function deriveDefaultImportanceFactors(article: Article): ImportanceFactors {
  const text = (article.title + ' ' + (article.subtitle || '')).toLowerCase();

  let scaleOfImpact: ImportanceFactors['scaleOfImpact'] = 'National';
  if (text.includes('global') || text.includes('world') || text.includes('un ') || text.includes('imf')) {
    scaleOfImpact = 'Global';
  } else if (article.state || text.match(/\b(up|bihar|gujarat|maharashtra|bengaluru|chennai|mumbai)\b/)) {
    scaleOfImpact = 'State';
  } else if (text.match(/\bvillage|district|municipal|ward\b/)) {
    scaleOfImpact = 'Local';
  }

  let severity: ImportanceFactors['severity'] = 'Moderate';
  if (text.match(/dead|killed|disaster|flood|earthquake|terror|attack|riot|war|genocide/)) {
    severity = 'Critical';
  } else if (text.match(/crore|billion|scam|corruption|probe|inquiry|arrest|prison|conviction|crash/)) {
    severity = 'High';
  }

  let institutionalSignificance: ImportanceFactors['institutionalSignificance'] = 'State';
  if (text.match(/supreme court|cji|chief justice|attorney general|cabinet|union cabinet|parliament|lok sabha|rajya sabha|rbi|sebi|niti aayog|election commission|armed forces|pib|ministry|president of india|cbi|nia|enforcement directorate|g20/)) {
    institutionalSignificance = 'National Constitutional';
  } else if (text.match(/municipality|mayor|gram panchayat/)) {
    institutionalSignificance = 'Municipal';
  } else if (text.match(/state government|chief minister|high court|vidhan sabha/)) {
    institutionalSignificance = 'State';
  }

  return {
    scaleOfImpact,
    severity,
    institutionalSignificance,
    irreversibility: text.match(/verdict|approved|passed|enacted|signed|launched/) ? 'Irreversible' : 'Moderate',
    publicAccountabilityValue: text.match(/corruption|scam|fraud|leaked|expose|negligence/) ? 'Exposing Corruption/Negligence' : 'High',
    longTermRelevance: text.match(/policy|budget|infrastructure|amendment|reform|election/) ? 'Multi-Month' : 'Weekly',
    vulnerabilityOfAffected: text.match(/children|women|minority|migrant|tribal|dalit|farmer|poor/) ? 'Vulnerable / Marginalized' : 'General'
  };
}

// Previously this returned the SAME hardcoded engagement profile (a
// constant `sample = 25000`) for every article with no explicit signals —
// meaning virtually every article got an identical, non-differentiating
// Interest Score, and the elaborate per-section Interest/Importance
// weighting (e.g. 80/20 for the trending rail) had almost nothing real to
// weight. Replaced with only what's genuinely derivable: real cross-source
// corroboration, real ingestion flags, and real (if thin) local view count.
function deriveDefaultInterestSignals(article: Article, corroborationCount: number): InterestSignals {
  return {
    corroboratingSources: corroborationCount,
    localViewCount:       getViewCount(article.id),
    isUrgent:             Boolean(article.isBreaking || article.isLiveBlog),
  };
}
