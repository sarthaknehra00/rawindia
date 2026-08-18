/** Returns "Just now", "12m ago", "3h ago", "2d ago", or a date string */
export function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** True if article was published within the last 30 minutes */
export function isJustIn(dateStr: string): boolean {
  return (Date.now() - new Date(dateStr).getTime()) / 60_000 < 30;
}

/** True if published within last 6 hours */
export function isBreakingFresh(dateStr: string): boolean {
  return (Date.now() - new Date(dateStr).getTime()) / 3_600_000 < 6;
}

/** Calculate read time from concatenated text */
export function calcReadTime(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}

/** Format IST timestamp for bylines */
export function toISTString(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' IST';
}
