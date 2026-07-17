/**
 * @degenfeed/utils — Shared utilities used across the worker API, web app,
 * and provider packages. Keep this package dependency-free so it can be
 * imported from anywhere.
 */

import type { Protocol } from '@degenfeed/types';

// ─── Time formatting ─────────────────────────────────────────────────

export function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── HTML sanitization ────────────────────────────────────────────────

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;|&nbsp;/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

export function decodeXmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;|&lt;|&gt;|&quot;|&apos;/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .trim();
}

// ─── Protocol parsing ────────────────────────────────────────────────

const VALID_PROTOCOLS: Protocol[] = [
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'rss',
  'mastodon',
  'reddit',
  'ethereum',
  'solana',
];

export function parseProtocols(
  raw: string | null,
  allowed: Protocol[] = VALID_PROTOCOLS,
): Protocol[] {
  if (!raw) return allowed;
  const valid = new Set<Protocol>(allowed);
  return raw
    .split(',')
    .map((p) => p.trim() as Protocol)
    .filter((p): p is Protocol => valid.has(p));
}

// ─── Environment helpers ─────────────────────────────────────────────

export function rmiUrl(env: { RMI_BACKEND_URL?: string }): string {
  return env.RMI_BACKEND_URL || 'http://127.0.0.1:8000';
}

// ─── URL building ────────────────────────────────────────────────────

export function buildUrl(
  base: string,
  path: string,
  params?: Record<string, string | undefined>,
): string {
  const url = new URL(path, base);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

// ─── Concurrency control ──────────────────────────────────────────────

export async function withConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const queue = items.map((item, index) => ({ item, index }));
  const runners = new Set<Promise<void>>();

  while (queue.length > 0 || runners.size > 0) {
    while (runners.size < limit && queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      const { item, index } = next;
      const promise = fn(item)
        .then((result) => {
          results[index] = result;
        })
        .catch(() => {})
        .finally(() => {
          runners.delete(promise);
        });
      runners.add(promise);
    }
    if (runners.size > 0) {
      await Promise.race(runners);
    }
  }
  return results;
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const controller = new AbortController();
  const timeout = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      controller.abort();
      reject(new Error(`${label} timeout after ${ms}ms`));
    }, ms);
    void promise.finally(() => clearTimeout(id)).catch(() => {});
  });
  return Promise.race([promise, timeout]);
}

// ─── Protocol color/emoji maps ────────────────────────────────────────

export const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  threads: '#888888',
  mastodon: '#6364ff',
  lemmy: '#00b868',
  rss: '#ffa500',
  reddit: '#ff4500',
  ethereum: '#627eea',
  solana: '#9945ff',
};

export const PROTOCOL_EMOJI: Record<string, string> = {
  nostr: '⚡',
  farcaster: '🟣',
  lens: '🌿',
  bluesky: '🦋',
  threads: '🧵',
  mastodon: '🐘',
  rss: '📡',
  reddit: '🔴',
  ethereum: '◆',
  solana: '◎',
};

export function getProtocolColor(p: string): string {
  return PROTOCOL_COLORS[p] ?? '#666';
}

export function getProtocolEmoji(p: string): string {
  return PROTOCOL_EMOJI[p] ?? '●';
}

// ─── String utilities ────────────────────────────────────────────────

export function safeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

export function shortenAddress(addr: string, head = 6, tail = 4): string {
  if (addr.length < head + tail + 3) return addr;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

// ─── Token detection ──────────────────────────────────────────────────

export { detectTokens } from './detectTokens';
export type { TokenRef } from './detectTokens';

// ─── Validation ───────────────────────────────────────────────────────

export function isValidEmail(s: string): boolean {
  if (typeof s !== 'string' || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

// ─── Protocol → currency mapping for tipping ──────────────────────────

export {
  PROTOCOL_DEFAULT_CURRENCY,
  CURRENCY_META,
  getDefaultCurrency,
} from './protocolCurrency';

// ─── Error reporting (lightweight Sentry) ─────────────────────────────

export { reportError } from './sentry';
