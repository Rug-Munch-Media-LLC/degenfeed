/**
 * @degenfeed/ui — Lemmy Thread View Helpers
 */

// ─── Thread Colors (rainbow) ────────────────────────────────────────

export const THREAD_COLORS = [
  '#00b868', '#6364ff', '#ff4500', '#1185fe', '#abfe2c',
  '#e040fb', '#ffa726', '#06d6a0', '#ef476f', '#ffd166',
];

export function getThreadColor(depth: number): string {
  return THREAD_COLORS[depth % THREAD_COLORS.length] ?? '#6364ff';
}

export const MAX_NESTING_DEPTH = 8;

// ─── Number Formatting ──────────────────────────────────────────────

export function formatScore(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

export function getExactTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short',
  });
}

// ─── URL Detection ──────────────────────────────────────────────────

export function isImageUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|ico)$/i.test(path);
  } catch {
    return false;
  }
}

export function isVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (/\.(mp4|webm|mov|avi|mkv|m3u8)$/i.test(path)) return true;
    if (
      host.includes('youtube.com') || host.includes('youtu.be') ||
      host.includes('vimeo.com') || host.includes('peertube') ||
      host.includes('twitch.tv') || host.includes('dailymotion.com')
    ) return true;
    return false;
  } catch {
    return false;
  }
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function getFaviconUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=16`;
  } catch {
    return '';
  }
}
