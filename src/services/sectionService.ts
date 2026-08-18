/**
 * RAWINDIA — Section Service (IST-based date logic)
 *
 * Manages automatic placement of articles into time-based sections:
 *   Live  → all processed articles (permanent)
 *   Today → articles whose publishedAt date = today IST
 *   Week  → articles whose publishedAt week = current Mon–Sun IST week
 *   Month → articles whose publishedAt month = current month IST
 *
 * Articles are NEVER deleted — they just move out of Today/Week/Month
 * when the respective time period ends, but remain in Live forever.
 */

import type { Article } from '../types';

// ── IST date helpers ──────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD for a given date in IST */
export function toISTDateStr(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Returns YYYY-MM for a given date in IST */
export function toISTMonthStr(date: Date = new Date()): string {
  return toISTDateStr(date).slice(0, 7);
}

/**
 * Returns YYYY-MM-DD of the Monday of the ISO week for the given date in IST.
 * Used for the "This Week" section — week = Monday to Sunday IST.
 */
export function toISTWeekStart(date: Date = new Date()): string {
  // Convert to IST midnight
  const istStr  = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const istDate = new Date(istStr + 'T00:00:00+05:30');
  // Get day of week: 0=Sun, 1=Mon … 6=Sat
  const dow         = istDate.getDay();
  // Days since Monday: 0 if Mon, 6 if Sun
  const daysToMon   = (dow + 6) % 7;
  const monday      = new Date(istDate.getTime() - daysToMon * 86_400_000);
  return monday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// ── Current section keys ──────────────────────────────────────────────────────

export function todayKey():  string { return toISTDateStr(); }
export function weekKey():   string { return toISTWeekStart(); }
export function monthKey():  string { return toISTMonthStr(); }

// ── Stamp an article with section metadata ────────────────────────────────────

export function stampArticleSections(article: Article): Article {
  const pub = new Date(article.publishedAt);
  return {
    ...article,
    sectionDay:   toISTDateStr(pub),
    sectionWeek:  toISTWeekStart(pub),
    sectionMonth: toISTMonthStr(pub),
  };
}

// ── Section membership checks ─────────────────────────────────────────────────

export function isInToday(article: Article):  boolean {
  return article.sectionDay   === todayKey();
}

export function isInThisWeek(article: Article): boolean {
  return article.sectionWeek  === weekKey();
}

export function isInThisMonth(article: Article): boolean {
  return article.sectionMonth === monthKey();
}

export type SectionKey = 'live' | 'today' | 'week' | 'month';

export function isInSection(article: Article, section: SectionKey): boolean {
  switch (section) {
    case 'live':  return true;                    // all articles are in live
    case 'today': return isInToday(article);
    case 'week':  return isInThisWeek(article);
    case 'month': return isInThisMonth(article);
  }
}

// ── Section metadata for display ─────────────────────────────────────────────

export function getSectionLabel(section: SectionKey): string {
  const today = new Date();
  switch (section) {
    case 'live':  return 'Live Wire';
    case 'today': return `Today — ${today.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' })}`;
    case 'week': {
      const mon = new Date(weekKey() + 'T00:00:00+05:30');
      const sun = new Date(mon.getTime() + 6 * 86_400_000);
      return `This Week — ${mon.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to ${sun.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    case 'month':
      return today.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' });
  }
}

export function getSectionDescription(section: SectionKey): string {
  switch (section) {
    case 'live':  return 'All articles — permanent archive. Nothing is ever deleted.';
    case 'today': return `Dispatches published on ${todayKey()} (IST). Auto-archives at midnight.`;
    case 'week':  return `Dispatches from ${weekKey()} (Mon) through Sunday IST. Auto-archives Sunday night.`;
    case 'month': return `All dispatches from ${monthKey()} (IST). Archives at month end.`;
  }
}

// ── Filter a pool of articles for a section ───────────────────────────────────

export function filterBySection(articles: Article[], section: SectionKey): Article[] {
  return articles.filter(a => isInSection(a, section));
}
