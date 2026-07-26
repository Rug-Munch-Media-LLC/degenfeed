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

export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  'threads',
  'rss',
  'mastodon',
  'reddit',
  'ethereum',
  'solana',
  'lemmy',
  'peertube',
  'youtube',
  'atproto',
  'zora',
  'telegram',
  'ens',
  'unstoppable',
  'ion',
  'keri',
  'veramo',
  'storj',
  'sia',
  'filecoin',
  'swarm-eth',
  'orbis',
  'snapshot',
  'tally',
  'syndicate',
  'juicebox',
  'coinvise',
  'unlock',
  'mintgate',
  'bonfida',
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
  peertube: '#f1680d',
  youtube: '#ff0000',
  atproto: '#0085ff',
  zora: '#0052FF',
  telegram: '#0088cc',
};

export const PROTOCOL_EMOJI: Record<string, string> = {
  nostr: '⚡',
  farcaster: '🟣',
  lens: '🌿',
  bluesky: '🦋',
  threads: '🧵',
  mastodon: '🐘',
  lemmy: '🍋',
  rss: '📡',
  reddit: '🔴',
  ethereum: '◆',
  solana: '◎',
  peertube: '📹',
  youtube: '▶️',
  atproto: '🦋',
  zora: '◆',
  telegram: '✈',
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

export type { TokenRef } from './detectTokens';
export { detectTokens } from './detectTokens';

// ─── Validation ───────────────────────────────────────────────────────

export function isValidEmail(s: string): boolean {
  if (typeof s !== 'string' || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

// ─── Protocol → currency mapping for tipping ──────────────────────────

export { CURRENCY_META } from './protocolCurrency';

// ─── Cross-protocol identity resolution ────────────────────────────────

export type { CrossProtocolIdentity, ProtocolId } from './crossProtocolIdentity';
export { IDENTITY_KV_PREFIX, identityKey, PROTOCOL_ID_REGISTRY } from './crossProtocolIdentity';

// ─── Universal Content Addressing (df:// URIs) ─────────────────────────

export type { ProtocolSource } from './contentUri';
export {
  decodeContentUri,
  encodeContentUri,
  getPostContentUri,
} from './contentUri';

// ─── Error reporting (lightweight Sentry) ─────────────────────────────

export { reportError } from './sentry';

// ─── Video detection ─────────────────────────────────────────────────────

export type {
  DirectVideoInfo,
  EmbedLike,
  PeerTubeInfo,
  PeerTubeVideoData,
  VideoInfo,
  YouTubeInfo,
} from './detectVideo';
export {
  detectVideoFromEmbeds,
  fetchPeerTubeVideo,
  isShortFormVideo,
  parseDirectVideoUrl,
  parsePeerTubeUrl,
  parseVideoUrl,
  parseYouTubeUrl,
} from './detectVideo';

// ─── Protocol content translation ─────────────────────────────────────

export type { TranslationResult } from './protocolTranslator';
export { estimateTranslationLoss, PROTOCOL_FORMATS, translateContent } from './protocolTranslator';

// ─── Content parsing (shared adapter utilities) ────────────────────────

export type { RssItem } from './content';
export { guessNiches, parseRssItems, stripHtml } from './content';

// ─── Cross-protocol communities ────────────────────────────────────────

export type { CrossProtocolCommunity } from './community';
export {
  COMMUNITY_INDEX_KEY,
  COMMUNITY_KV_PREFIX,
  communityFeedKey,
  communityKey,
  communityMembersKey,
  slugifyCommunity,
} from './community';
