/**
 * @degenfeed/utils — Time and number formatting
 *
 * Pure formatting helpers. Single responsibility: render a number (ms epoch,
 * seconds, count) as a human-readable string. No I/O, no locale state beyond
 * what `Intl`/`toLocale*` reads from the host.
 */

/**
 * Render a millisecond epoch timestamp as a relative age.
 *
 * Buckets: `<1m` → `now`, `<1h` → `Nm ago`, `<24h` → `Nh ago`, `<7d` →
 * `Nd ago`, otherwise a short calendar date (`Mon D`).
 */
export function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Compact a count with a single decimal: `1000` → `1.0K`, `1_000_000` → `1.0M`.
 * Values below 1000 and negative values are rendered as-is.
 */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Format a millisecond epoch timestamp.
 *
 * - `relative` delegates to {@link formatTimeAgo}
 * - today → `HH:MM`
 * - this year → `Mon D`
 * - otherwise → `Mon D, YYYY`
 */
export function formatDate(ts: number, style: 'relative' | 'short' | 'long' = 'short'): string {
  if (style === 'relative') return formatTimeAgo(ts);
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isThisYear = d.getFullYear() === now.getFullYear();
  if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (isThisYear) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format a duration in seconds as `M:SS` or `H:MM:SS`.
 * Negative values clamp to `0:00`; fractional seconds are floored.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Format a millisecond epoch timestamp as `Mon D, HH:MM`. */
export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
