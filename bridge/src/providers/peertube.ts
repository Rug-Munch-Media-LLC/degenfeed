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

/**
 * Federated PeerTube instances used to supplement the local VOD feed.
 * The local instance has only a handful of videos, so when it runs dry we
 * pull recent videos from public federated instances to keep the feed
 * populated with fresh content.
 *
 * Verified reachable public instances (2026-08-04) spanning makers/DIY,
 * science & tech, activism, crypto (Monero Talk) and general content.
 */
const PEERTUBE_FEDERATED = [
  'https://framatube.org',
  'https://peertube.tv',
  'https://makertube.net',
  'https://diode.zone',
  'https://video.tedomum.net',
  'https://videos.thegreenwizard.win',
  'https://peertube.lightnode.ru',
  'https://watch.monerotalk.live',
  'https://spectra.video',
];

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
  isLive?: boolean;
  viewers?: number;
  likes: number;
  dislikes?: number;
  thumbnailPath?: string;
  previewPath?: string;
  embedPath?: string;
  createdAt: string;
  publishedAt?: string;
  updatedAt: string;
  tags?: string[];
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

/** PeerTube video category map (id → label), e.g. { "1": "Music", "12": "How To" }. */
type CategoryMap = Record<string, string>;

/** Structured live-stream entry returned by the /api/feed/live aggregator. */
export interface PeerTubeLiveStream {
  platform: 'peertube';
  title: string;
  viewers: number;
  thumbnail: string;
  url: string;
  online: boolean;
  streamer: string;
  startedAt?: number;
  uuid: string;
}

/** Structured channel entry for the channel subscription feed. */
export interface PeerTubeChannel {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  url: string;
  avatarUrl?: string;
  bannerUrl?: string;
  followersCount: number;
  videosCount: number;
  isLocal: boolean;
}

// ─── Category cache ─────────────────────────────────────────────────

let categoryCache: CategoryMap | null = null;
let categoryCacheAt = 0;
const CATEGORY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetch the PeerTube video category map (id → label). PeerTube exposes
 * categories as a flat map at GET /api/v1/videos/categories, but the video
 * list endpoint only returns `category.id`. We cache the map for an hour
 * and use it to attach human-readable category labels to VOD posts.
 */
export async function fetchPeerTubeCategories(): Promise<CategoryMap> {
  if (categoryCache && Date.now() - categoryCacheAt < CATEGORY_CACHE_TTL_MS) {
    return categoryCache;
  }
  try {
    const res = await $fetch(`${PEERTUBE_BASE}/api/v1/videos/categories`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const raw = (await res.json()) as CategoryMap;
      if (raw && typeof raw === 'object') {
        categoryCache = raw;
        categoryCacheAt = Date.now();
        return raw;
      }
    }
  } catch {
    // Fall through — keep serving without categories
  }
  return {};
}

/**
 * Fetch the most-viewed / trending PeerTube videos from the local instance.
 * PeerTube supports `sort=-trendingScore` on recent versions; fall back to
 * `-views` when the sort key is not supported.
 */
export async function fetchPeerTubeTrending(limit = 12): Promise<UnifiedPost[]> {
  if (!checkRateLimit('peertube', { maxRequests: 50, windowMs: 60_000 })) {
    console.log('[peertube] Rate limited, skipping trending fetch');
    return [];
  }
  try {
    const url = `${PEERTUBE_BASE}/api/v1/videos?count=${Math.min(
      limit,
      50,
    )}&sort=-trendingScore`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // Fall back to view-count sort for instances without trendingScore
      console.log('[bridge] PeerTube trending: HTTP ' + res.status + ' — falling back to -views');
      const fallback = await $fetch(
        `${PEERTUBE_BASE}/api/v1/videos?count=${Math.min(limit, 50)}&sort=-views`,
        {
          headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!fallback.ok) return [];
      const data = (await fallback.json()) as PeerTubeResponse;
      return (data.data ?? []).slice(0, limit).map(videoToPost);
    }
    const data = (await res.json()) as PeerTubeResponse;
    return (data.data ?? []).slice(0, limit).map(videoToPost);
  } catch (err) {
    console.log(`[bridge] PeerTube trending: error - ${(err as Error).message}`);
    return [];
  }
}

/**
 * Fetch local PeerTube channels for the channel subscription feed.
 * Channels expose follower counts so we can surface "subscribe" targets.
 */
export async function fetchPeerTubeChannels(limit = 20): Promise<PeerTubeChannel[]> {
  if (!checkRateLimit('peertube', { maxRequests: 50, windowMs: 60_000 })) {
    console.log('[peertube] Rate limited, skipping channel fetch');
    return [];
  }
  try {
    const url = `${PEERTUBE_BASE}/api/v1/video-channels?count=${Math.min(
      limit,
      50,
    )}&sort=-followersCount`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      total: number;
      data: Array<{
        id: number;
        name: string;
        displayName: string;
        description?: string;
        url: string;
        avatar?: { path: string };
        banner?: { path: string };
        followersCount: number;
        videosCount?: number;
        isLocal?: boolean;
      }>;
    };
    return (data.data ?? []).slice(0, limit).map((c) => ({
      id: c.id,
      name: c.name,
      displayName: c.displayName,
      description: c.description,
      url: c.url,
      avatarUrl: c.avatar?.path ? `${PEERTUBE_BASE}${c.avatar.path}` : undefined,
      bannerUrl: c.banner?.path ? `${PEERTUBE_BASE}${c.banner.path}` : undefined,
      followersCount: c.followersCount ?? 0,
      videosCount: c.videosCount ?? 0,
      isLocal: c.isLocal ?? true,
    }));
  } catch (err) {
    console.log(`[bridge] PeerTube channels: error - ${(err as Error).message}`);
    return [];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Format a PeerTube duration (seconds) as `m:ss` or `h:mm:ss`. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Format a PeerTube view count into a compact display string. */
export function formatViews(views: number): string {
  if (!Number.isFinite(views) || views < 0) return '0';
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(views);
}

/** Best available thumbnail: prefer previewPath (higher res) over thumbnailPath. */
export function videoThumbnailUrl(video: PeerTubeVideo): string {
  const path = video.previewPath || video.thumbnailPath;
  return path ? `${PEERTUBE_BASE}${path}` : '';
}

/** Full inline-player embed URL for a PeerTube video. */
export function videoEmbedUrl(video: PeerTubeVideo): string {
  if (video.embedPath) return `${PEERTUBE_BASE}${video.embedPath}`;
  return `${PEERTUBE_BASE}/videos/embed/${video.uuid}`;
}

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
  const thumbnailUrl = videoThumbnailUrl(video);
  const embedUrl = videoEmbedUrl(video);
  const categoryLabel = video.category?.label || 'Unknown';

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
      {
        kind: 'video',
        url: videoUrl,
        meta: {
          duration: video.duration,
          views: video.views,
          likes: video.likes,
          thumbnail: thumbnailUrl,
          embedUrl,
          category: categoryLabel,
          isLive: video.isLive ?? false,
        },
      },
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
    raw: {
      ...video,
      thumbnailUrl,
      embedUrl,
      categoryLabel,
      durationLabel: formatDuration(video.duration),
      viewsLabel: formatViews(video.views),
    },
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
  const all: UnifiedPost[] = [];

  // 1. Local instance — highest priority
  try {
    const url = `${PEERTUBE_BASE}/api/v1/videos?count=${Math.min(limit, 50)}&sort=-publishedAt`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = (await res.json()) as PeerTubeResponse;
      if (data.data && data.data.length > 0) {
        const categoryMap = await fetchPeerTubeCategories();
        all.push(
          ...data.data.slice(0, limit).map((video) => {
            const enriched = { ...video };
            const categoryId = video.category?.id;
            if (categoryId != null && categoryMap[String(categoryId)]) {
              enriched.category = {
                id: categoryId,
                label: categoryMap[String(categoryId)] ?? 'Unknown',
              };
            }
            return videoToPost(enriched);
          }),
        );
      }
    }
  } catch (err) {
    console.log(`[bridge] PeerTube local: error - ${(err as Error).message}`);
  }

  // 2. Federated instances — only when the local instance is thin, so the
  // feed never goes empty and stays fresh with new uploads.
  if (all.length < limit) {
    const federatedShare = Math.max(3, Math.ceil(limit / PEERTUBE_FEDERATED.length));
    const federated = await Promise.allSettled(
      PEERTUBE_FEDERATED.map(async (instance) => {
        try {
          const url = `${instance}/api/v1/videos?count=${Math.min(federatedShare, 50)}&sort=-publishedAt`;
          const res = await $fetch(url, {
            headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) return [] as UnifiedPost[];
          const data = (await res.json()) as PeerTubeResponse;
          return (data.data ?? []).slice(0, federatedShare).map(videoToPost);
        } catch {
          return [] as UnifiedPost[];
        }
      }),
    );
    for (const r of federated) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
  }

  // 3. Deduplicate by id
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] PeerTube: ${deduped.length} posts`);
  return deduped;
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchPeerTubePosts;

/**
 * Fetch currently-live PeerTube videos from the local instance.
 *
 * PeerTube exposes live streams through the same /api/v1/videos endpoint
 * with `isLive=true` (the legacy `filter=live` parameter is deprecated).
 * Live videos are real-time streams, so we map them into the unified
 * live-stream shape used by /api/feed/live.
 */
export async function fetchPeerTubeLiveStreams(limit = 20): Promise<PeerTubeLiveStream[]> {
  // Rate limit: 50 requests/minute (shared budget with VOD fetches)
  if (!checkRateLimit('peertube', { maxRequests: 50, windowMs: 60_000 })) {
    console.log('[peertube] Rate limited, skipping live fetch');
    return [];
  }
  try {
    const url = `${PEERTUBE_BASE}/api/v1/videos?isLive=true&count=${Math.min(
      limit,
      50,
    )}&sort=-publishedAt`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.log(`[bridge] PeerTube live: HTTP ${res.status}`);
      return [];
    }

    const data = (await res.json()) as PeerTubeResponse;
    if (!data.data || data.data.length === 0) {
      console.log('[bridge] PeerTube live: no live videos');
      return [];
    }

      const streams: PeerTubeLiveStream[] = [];
      for (const video of data.data) {
        if (!video.isLive) continue;
        const account = video.account || video.channel;
        const streamer = account?.displayName || account?.name || 'PeerTube';
        const viewers = video.viewers ?? video.views ?? 0;
        const videoUrl = video.url || `${PEERTUBE_BASE}/videos/watch/${video.uuid}`;
        streams.push({
          platform: 'peertube',
          title: video.name,
          viewers,
          thumbnail: videoThumbnailUrl(video),
          url: videoUrl,
          online: true,
          streamer,
          startedAt: video.publishedAt ? new Date(video.publishedAt).getTime() : Date.now(),
          uuid: video.uuid,
        });
      }

    console.log(`[bridge] PeerTube live: ${streams.length} stream(s)`);
    return streams.slice(0, limit);
  } catch (err) {
    console.log(`[bridge] PeerTube live: error - ${(err as Error).message}`);
    return [];
  }
}
