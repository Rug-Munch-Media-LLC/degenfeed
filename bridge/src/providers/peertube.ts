/**
 * PeerTube Provider
 *
 * Rate Limit: 50 requests/minute
 *
 * Fetches videos from the self-hosted PeerTube instance (port 9011).
 * PeerTube is a federated video platform (ActivityPub). The local instance
 * has crypto security, tech explainer, and tutorial videos.
 *
 * API: GET /api/v1/videos?count=N&sort=-publishedAt
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const PEERTUBE_BASE = 'http://127.0.0.1:9011';

interface PeerTubeVideo {
  id: number;
  uuid: string;
  name: string;
  description?: string;
  category?: { id: number | null; label: string };
  licence?: { id: number | null; label: string };
  language?: { id: number | null; label: string };
  privacy?: { id: number; label: string };
  nsfw: boolean;
  url: string;
  duration: number;
  views: number;
  likes: number;
  dislikes?: number;
  thumbnailPath?: string;
  previewPath?: string;
  embedPath?: string;
  createdAt: string;
  publishedAt?: string;
  updatedAt: string;
  account?: {
    id: number;
    name: string;
    displayName: string;
    url: string;
    avatar?: { path: string };
  };
  channel?: {
    id: number;
    name: string;
    displayName: string;
    url: string;
    avatar?: { path: string };
  };
}

interface PeerTubeResponse {
  total: number;
  data: PeerTubeVideo[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function guessNiches(text: string, name: string): string[] {
  const niches: string[] = [];
  const lower = `${text} ${name}`.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|dog|shib)\b/.test(lower)) niches.push('memecoin');
  if (/\b(security|hack|exploit|audit|scam|phishing)\b/.test(lower)) niches.push('security');
  if (/\b(layer2|l2|arbitrum|optimism|base|polygon)\b/.test(lower)) niches.push('layer2');
  if (/\b(tutorial|guide|how.?to|learn|course|explain)\b/.test(lower)) niches.push('educational');
  if (/\b(review|unboxing|overview)\b/.test(lower)) niches.push('review');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

// ─── Mapping ─────────────────────────────────────────────────────────

export function videoToPost(video: PeerTubeVideo): UnifiedPost {
  const account = video.account || video.channel;
  const authorName = account?.displayName || account?.name || 'PeerTube';
  const authorUrl = account?.url || '';
  const avatarPath = account?.avatar?.path || '';

  const text = `${video.name}\n\n${video.description || ''}`.trim();
  const createdAt = video.publishedAt
    ? new Date(video.publishedAt).getTime()
    : new Date(video.createdAt).getTime();
  const videoUrl = video.url || `${PEERTUBE_BASE}/videos/watch/${video.uuid}`;

  return {
    id: `peertube:${video.uuid}`,
    protocol: 'peertube',
    author: {
      id: `peertube:${account?.name || 'unknown'}`,
      primary: { protocol: 'peertube', id: String(account?.id || 0) },
      handles: { rss: authorName },
      displayName: authorName,
      bio: '',
      avatarUrl: avatarPath ? `${PEERTUBE_BASE}${avatarPath}` : '',
      followerCount: 0,
      followingCount: 0,
      links: authorUrl ? [{ label: 'channel', url: authorUrl }] : [],
      keys: {},
    },
    text,
    contentType: 'video',
    embeds: [
      { kind: 'video', url: videoUrl, meta: { duration: video.duration, views: video.views } },
    ],
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
    metrics: {
      likes: video.likes || 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: video.views || 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: video.likes || 0, reposts: 0, replies: 0, quotes: 0, views: video.views || 0 },
    },
    raw: video,
    niches: guessNiches(text, video.name),
  };
}

// ─── Main ────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'peertube',
  name: 'PeerTube',
  description: 'Decentralized video platform on ActivityPub — local instance',
  endpoint: '/api/feed/peertube',
  requiresAuth: false,
  contentType: 'video',
};

export async function fetchPeerTubePosts(limit = 20): Promise<UnifiedPost[]> {
  // Rate limit: 50 requests/minute
  if (!checkRateLimit('peertube', { maxRequests: 50, windowMs: 60_000 })) {
    console.log('[peertube] Rate limited, skipping fetch');
    return [];
  }
  try {
    const url = `${PEERTUBE_BASE}/api/v1/videos?count=${Math.min(limit, 50)}&sort=-publishedAt`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.log(`[bridge] PeerTube: HTTP ${res.status}`);
      return [];
    }

    const data = (await res.json()) as PeerTubeResponse;
    if (!data.data || data.data.length === 0) {
      console.log('[bridge] PeerTube: empty response');
      return [];
    }

    const posts = data.data.slice(0, limit).map(videoToPost);
    console.log(`[bridge] PeerTube: ${posts.length} posts`);
    return posts;
  } catch (err) {
    console.log(`[bridge] PeerTube: error - ${(err as Error).message}`);
    return [];
  }
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchPeerTubePosts;
