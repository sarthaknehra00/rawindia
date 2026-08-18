export type ContentType = 'NEWS' | 'GROUND REPORT' | 'ANALYSIS' | 'OPINION';

export type SourceType =
  | 'Official statement'
  | 'Document'
  | 'Eyewitness'
  | 'Social-media claim (unverified)'
  | 'Anonymous source'
  | 'Wire / Verified Reporter';

export interface SourceTransparencyItem {
  id: string;
  type: SourceType;
  name: string;
  description: string;
  verified: boolean;
  reliabilityScore: number; // 0 - 100
  url?: string;
}

export interface FactBlock {
  title: string; // "What actually happened"
  summary: string;
  bullets: string[];
  primarySources: string[];
  keyNumbers?: Array<{ label: string; value: string }>;
}

export interface CorrectionLogItem {
  timestamp: string;
  note: string;
  editor: string;
}

export interface LiveUpdateItem {
  id: string;
  time: string;
  headline: string;
  content: string;
  sourceType: SourceType;
  verified: boolean;
  author: string;
}

export interface DebateStance {
  author: string;
  authorRole: string;
  authorAvatar: string;
  title: string;
  summary: string;
  keyArguments: string[];
  declarationOfIndependence?: string;
}

export type PriorityTier = 'P0' | 'P1' | 'P2' | 'P3' | 'EVERGREEN';

export interface ImportanceFactors {
  scaleOfImpact: 'Local' | 'State' | 'National' | 'Global';
  severity: 'Minor' | 'Moderate' | 'High' | 'Critical';
  institutionalSignificance: 'None' | 'Municipal' | 'State' | 'National Constitutional';
  irreversibility: 'Reversible' | 'Moderate' | 'Irreversible';
  publicAccountabilityValue: 'Low' | 'Moderate' | 'High' | 'Exposing Corruption/Negligence';
  longTermRelevance: '24h Cycle' | 'Weekly' | 'Multi-Month' | 'Generational';
  vulnerabilityOfAffected: 'General' | 'Targeted Group' | 'Vulnerable / Marginalized';
}

// Redesigned around only what's honestly derivable with zero analytics budget
// (see rankingEngineService.ts's deriveDefaultInterestSignals) — no CTR,
// social-velocity, search-trend, read-time, comment-volume, push-open-rate,
// or pageview figures, since none of those are measurable here and the old
// shape faked all seven with one constant, making "Interest" a non-
// differentiating no-op for nearly every article regardless of section
// weighting. Three real signals instead:
export interface InterestSignals {
  // How many OTHER articles currently in the pool are covering the same
  // real-world story (fuzzy title match) — a genuine, verifiable proxy for
  // "multiple outlets are running this," computed once per ranking pass.
  corroboratingSources: number;
  // Real, this-browser-only view count (localEngagementService.ts) — thin
  // for anything just published, but never fabricated.
  localViewCount: number;
  // Real editorial/ingestion flags (isBreaking / isLiveBlog) — not a guess.
  isUrgent: boolean;
}

export interface ArticleRanking {
  interestScore: number; // 0 - 100 with time decay applied
  rawInterestScore: number;
  importanceScore: number; // 0 - 100
  priorityScore: number; // 0 - 100 combined
  priorityTier: PriorityTier;
  importanceFloorOverride: boolean;
  whyIsThisHere: string; // e.g. "High Public Importance (Constitutional Matter)"
  importanceFactors: ImportanceFactors;
  interestSignals: InterestSignals;
  decayHalfLifeHours: number;
  lastScoredAt: string;
}

export interface Article {
  id: string;
  title: string;
  subtitle: string;
  slug: string;
  verticalId: number; // 1 to 18
  verticalName: string;
  subCategory?: string;
  subSubCategory?: string;
  state?: string;
  city?: string;
  contentType: ContentType;
  publishedAt: string;
  updatedAt?: string;
  readTime: string;
  author: {
    name: string;
    role: string;
    avatar: string;
    bio: string;
    articlesCount: number;
    accuracyScore: number;
  };
  heroImage: string;
  heroImageCaption?: string;
  factBlock: FactBlock;
  sourceTransparency: SourceTransparencyItem[];
  correctionLog: CorrectionLogItem[];
  bodyParagraphs: string[];
  quoteHighlight?: {
    quote: string;
    speaker: string;
    context: string;
  };
  communityStance: {
    accurate: number;
    needsContext: number;
    disputed: number;
    userVoted?: 'accurate' | 'needsContext' | 'disputed';
  };
  ranking?: ArticleRanking;
  isLiveBlog?: boolean;
  liveUpdates?: LiveUpdateItem[];
  isCounterpoint?: boolean;
  counterpoint?: {
    debateTitle: string;
    stanceA: DebateStance;
    stanceB: DebateStance;
  };
  isBreaking?: boolean;
  isFeaturedHero?: boolean;
  tags: string[];
  isExternalApi?: boolean;
  externalSource?: string;
  externalUrl?: string;
  isGroqSynthesized?: boolean;

  // ── Permanent pre-synthesis audit trail ──────────────────────────────────
  // Snapshot of title/subtitle/bodyParagraphs taken BEFORE the first Groq
  // rewrite ever runs. Never overwritten by later synthesis passes — this is
  // what the wire actually said, kept so a rewrite can be checked against its
  // source instead of the "100% Raw" claim being unverifiable after the fact.
  originalRaw?: {
    title: string;
    subtitle: string;
    bodyParagraphs: string[];
  };

  // ── Section stamps (IST date strings, assigned at ingestion time) ────────
  sectionDay?:         string;   // YYYY-MM-DD — for Today section
  sectionWeek?:        string;   // YYYY-MM-DD of Monday — for This Week section
  sectionMonth?:       string;   // YYYY-MM — for This Month section

  // ── Deep taxonomy assignment (Groq-assigned at synthesis time) ──────────
  subCategoryId?:      string;   // e.g. '1-3' = Judiciary & Law
  subCategoryName?:    string;
  subSubCategoryId?:   string;   // e.g. '1-3-1' = Supreme Court of India
  subSubCategoryName?: string;
  taxonomyPath?:       string;   // Human-readable: "India/National → Judiciary → Supreme Court"
}

export interface TaxonomySubSubCategory {
  id: string;
  name: string;
  nameHi: string;
  slug: string;
}

export interface TaxonomySubCategory {
  id: string;
  number: string;
  name: string;
  nameHi: string;
  slug: string;
  subSubCategories: TaxonomySubSubCategory[];
}

export interface TaxonomyVertical {
  id: number;
  number: string;
  name: string;
  nameHi: string;
  slug: string;
  description: string;
  badgeColor: string;
  iconName: string;
  subCategories: TaxonomySubCategory[];
}

export type ActiveTab =
  | 'home'
  | 'taxonomy'
  | 'live'
  | 'timeline'
  | 'today'
  | 'week'
  | 'month'
  | 'specials'
  | 'article'
  | 'standards';
