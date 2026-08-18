import { TAXONOMY_DATA } from '../data/taxonomyData';
import type { Article, ActiveTab } from '../types';

// ── Tab <-> path mapping ───────────────────────────────────────────────────
// activeTab is derived FROM the route (single source of truth) rather than
// mirrored to it — see pathToTab(). tabToPath() is only used to build the
// href/navigate target when something still thinks in terms of a tab name.

export function tabToPath(tab: ActiveTab): string {
  switch (tab) {
    case 'home':     return '/';
    case 'live':      return '/live';
    case 'timeline':  return '/timeline';
    case 'today':     return '/today';
    case 'week':      return '/week';
    case 'month':     return '/month';
    case 'taxonomy':  return '/section'; // caller should prefer verticalToPath when a vertical is known
    case 'article':   return '/';        // article navigation goes through articleToPath, not this
    default:          return '/';
  }
}

export function verticalToPath(verticalId: number | null): string {
  if (verticalId === null) return '/';
  const vertical = TAXONOMY_DATA.find(v => v.id === verticalId);
  return vertical ? `/section/${vertical.slug}` : '/';
}

export function verticalIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/section\/([^/]+)/);
  if (!match) return null;
  const vertical = TAXONOMY_DATA.find(v => v.slug === match[1]);
  return vertical ? vertical.id : null;
}

export function pathToTab(pathname: string): ActiveTab {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/section')) return 'taxonomy';
  if (pathname.startsWith('/timeline')) return 'timeline';
  if (pathname.startsWith('/live')) return 'live';
  if (pathname.startsWith('/today')) return 'today';
  if (pathname.startsWith('/week')) return 'week';
  if (pathname.startsWith('/month')) return 'month';
  if (pathname.startsWith('/article')) return 'article';
  return 'home';
}

// ── Article <-> URL slug-id mapping ────────────────────────────────────────
// Articles have no backend, so the URL encodes enough to re-resolve the
// article from whatever's currently loaded client-side (IndexedDB archive /
// live-fetched pool). `slug` alone isn't guaranteed unique across sources, so
// the real `id` rides along in the URL too.

export function articleToSlugId(article: Article): string {
  return `${article.slug}-${article.id}`;
}

export function resolveArticleFromSlugId(slugId: string | undefined, pool: Article[]): Article | undefined {
  if (!slugId) return undefined;
  const exact = pool.find(a => articleToSlugId(a) === slugId);
  if (exact) return exact;
  // Fallback: id is a suffix of slugId — covers slug drift or hand-typed URLs.
  return pool.find(a => slugId.endsWith(a.id));
}

// ── Tag <-> URL slug mapping ───────────────────────────────────────────────

export function tagToSlug(tag: string): string {
  return tag.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function tagToPath(tag: string): string {
  return `/tag/${tagToSlug(tag)}`;
}

// ── Institution (quoted speaker) <-> URL slug mapping ──────────────────────

// Groq's quoteHighlight.speaker schema is "Name, Role" (see
// groqWriterService.ts's SYSTEM_PROMPT) — the same real person shows up
// across different dispatches as "Narendra Modi, Prime Minister" in one and
// "Narendra Modi, PM" in another, since the role varies even when the name
// doesn't. Without stripping it, institutionLedgerService.ts's grouping
// (which keys directly on this string) would fragment one real person into
// several separate leaderboard rows. The role is presentational context,
// not part of who they are — only the part before the first comma is kept.
export function canonicalizeInstitutionName(name: string): string {
  return name.split(',')[0].trim();
}

// Same slugging rule as tags — reused so the same (canonicalized) speaker
// name always maps to the same URL regardless of which article's quote or
// exact role-suffix phrasing it came from.
export function institutionToSlug(name: string): string {
  return tagToSlug(canonicalizeInstitutionName(name));
}

export function institutionToPath(name: string): string {
  return `/institution/${institutionToSlug(name)}`;
}
