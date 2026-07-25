/**
 * @degenfeed/api-worker — Unified Image Feed Types
 *
 * Shared types, metadata, and utilities for the image feed.
 * Extracted from unified-image-feed.ts.
 *
 * Exports: UnifiedImage, ImageSource, ImageCategory, ImageFeedResponse,
 *          SOURCE_META, metaFor(), guessCategory(), fetchWithTimeout()
 */

import type { Env } from '../index';

// ─── Types ────────────────────────────────────────────────────────────────

export interface UnifiedImage {
  id: string;
  source: ImageSource;
  protocol: string;
  /** Image URL (medium/optimized) */
  imageUrl: string;
  /** Full resolution image URL */
  fullImageUrl?: string;
  /** Thumbnail URL (small, for grids) */
  thumbnailUrl?: string;
  /** Title or caption */
  title: string;
  /** Creator/author info */
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    handle?: string;
    walletAddress?: string;
  };
  /** Source badge */
  sourceBadge: string;
  sourceColor: string;
  sourceLabel: string;
  /** Category: art, photography, memes, nft, general */
  category: ImageCategory;
  /** Unix ms */
  createdAt: number;
  /** Width/height for aspect ratio */
  width?: number;
  height?: number;
  /** Aspect ratio (width/height) */
  aspectRatio: number;
  /** Engagement */
  likes: number;
  shares: number;
  comments: number;
  /** NFT-specific */
  isNFT: boolean;
  nftContract?: string;
  nftTokenId?: string;
  collectionName?: string;
  creatorAddress?: string;
  mintUrl?: string;
  /** Original post URL */
  url?: string;
  /** Blur hash */
  blurHash?: string;
  /** Tags */
  tags: string[];
  /** Protocol-specific metadata */
  meta?: Record<string, unknown>;
}

export type ImageSource =
  | 'pixelfed'
  | 'zora'
  | 'mastodon'
  | 'nostr'
  | 'bluesky'
  | 'lens'
  | 'ipfs'
  | 'arweave'
  | 'reddit'
  | 'immich'
  | 'lychee';

export type ImageCategory = 'art' | 'photography' | 'memes' | 'nft' | 'general' | 'ai';

export interface ImageFeedResponse {
  data: UnifiedImage[];
  nextCursor?: string;
  meta: {
    total: number;
    perSource: Record<string, number>;
    errors: string[];
    fetchedAt: number;
  };
}

// ─── Source metadata ──────────────────────────────────────────────────────

export const SOURCE_META: Record<string, { badge: string; color: string; label: string }> = {
  pixelfed: { badge: '📸', color: '#6366f1', label: 'Pixelfed' },
  zora: { badge: '🎨', color: '#8b5cf6', label: 'Zora' },
  mastodon: { badge: '🐘', color: '#6364ff', label: 'Mastodon' },
  nostr: { badge: '⚡', color: '#8e30eb', label: 'Nostr' },
  bluesky: { badge: '🦋', color: '#1185fe', label: 'Bluesky' },
  lens: { badge: '🌿', color: '#00501e', label: 'Lens' },
  ipfs: { badge: '🪐', color: '#4fc3f7', label: 'IPFS' },
  arweave: { badge: '🔗', color: '#9c27b0', label: 'Arweave' },
  reddit: { badge: '🤖', color: '#ff4500', label: 'Reddit' },
  immich: { badge: '🖼️', color: '#4250af', label: 'Immich' },
  lychee: { badge: '🍃', color: '#40a02b', label: 'Lychee' },
};

export function metaFor(source: string) {
  return SOURCE_META[source] ?? { badge: '📷', color: '#666', label: source };
}

// ─── Category guesser ─────────────────────────────────────────────────────

export function guessCategory(title: string, tags: string[], source: string): ImageCategory {
  const text = `${title} ${tags.join(' ')}`.toLowerCase();
  if (source === 'zora') return 'nft';
  if (/nft|mint|collect|token|edition/.test(text)) return 'nft';
  if (/meme|funny|humor|lol|lmao|rofl/.test(text)) return 'memes';
  if (/photo|photography|landscape|portrait|nature|travel/.test(text)) return 'photography';
  if (/art|digital|illustration|drawing|painting|design/.test(text)) return 'art';
  if (/ai|generated|diffusion|dalle|midjourney|stability/.test(text)) return 'ai';
  return 'general';
}

// ─── Utility: fetch with timeout ──────────────────────────────────────────

export async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeout?: number } = {},
): Promise<Response | null> {
  const { timeout = 5000, ...rest } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Strip HTML helper ────────────────────────────────────────────────────

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract image URL from Nostr content text */
export function extractImageUrl(content: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|avif))(?:\?[^\s]*)?/i;
  return urlRegex.exec(content)?.[1] ?? null;
}
