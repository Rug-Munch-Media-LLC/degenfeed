/**
 * @degenfeed/api-worker — Digest Types
 */

import type { Protocol } from '@degenfeed/types';

export type DigestFormatType =
  | 'daily-brief'
  | 'weekly-deep-dive'
  | 'topic-digest'
  | 'protocol-digest';

export interface DigestSection {
  type:
    | 'top-stories'
    | 'videos'
    | 'communities'
    | 'market'
    | 'trending'
    | 'for-you'
    | 'catch-up'
    | 'deep-dive'
    | 'on-this-day'
    | 'community-spotlight';
  title: string;
  items: DigestItem[];
}

export interface DigestItem {
  id: string;
  protocol: string;
  protocolColor: string;
  protocolEmoji: string;
  author: { displayName: string; avatarUrl?: string };
  title: string;
  excerpt: string;
  url: string;
  image?: string;
  niches: string[];
  createdAt: number;
  metrics: { likes: number; reposts: number; replies: number };
  readTime: number;
  score: number;
}

export interface MarketPrice {
  usd: number;
  usd_24h_change: number;
}

export interface DigestResponse {
  date: string;
  wallet: string | null;
  sections: DigestSection[];
  subject: string;
  featured?: DigestItem | null;
  format: DigestFormatType;
  shareUrl?: string;
  editorial?: {
    opening: string;
    marketOverview?: string;
    closing: string;
  };
  marketSummary?: {
    coins: Array<{
      symbol: string;
      price: number;
      change24h: number;
      sentiment: 'bullish' | 'bearish' | 'neutral';
    }>;
    totalMarketCap?: number;
    btcDominance?: number;
  };
  meta: {
    totalPosts: number;
    totalSections: number;
    fetchedAt: number;
    cachedAt?: number;
    readTimeMinutes?: number;
    trendingTopics?: Array<{ topic: string; count: number }>;
  };
}

export const DIGEST_CACHE_PREFIX = 'digest:v2:';
export const DIGEST_CACHE_TTL = 3600;
export const DIGEST_ARCHIVE_TTL = 60 * 60 * 24 * 7;

export const MARKET_COINS = 'bitcoin,ethereum,solana';
export const MARKET_CACHE_KEY = 'digest:market';
export const MARKET_CACHE_TTL = 60;

export function isValidEmail(s: string): boolean {
  if (typeof s !== 'string') return false;
  if (s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export function safeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

export function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function protocolEmoji(p: Protocol): string {
  const map: Record<string, string> = {
    nostr: '⚡', farcaster: '🟣', lens: '🌿', bluesky: '🦋',
    mastodon: '🐘', threads: '🧵', rss: '📡',
  };
  return map[p] ?? '●';
}

export function _formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function _excerpt(text: string, max = 160): string {
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, '')}…` : text;
}

export function readTime(text: string): number {
  const wpm = 200;
  return Math.max(1, Math.ceil(text.split(/\s+/).length / wpm));
}
