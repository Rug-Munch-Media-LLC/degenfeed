// ─── Local circuit breaker ───────────────────────────────────────────
const __cbStore = new Map<string, { failures: number; openUntil: number }>();

function __cbState(name: string, _threshold = 3, _cooldownMs = 60000): 'CLOSED' | 'OPEN' {
  const cb = __cbStore.get(name);
  if (!cb) return 'CLOSED';
  if (cb.openUntil > Date.now()) return 'OPEN';
  __cbStore.delete(name);
  return 'CLOSED';
}

function __cbFail(name: string, threshold = 3, cooldownMs = 60000): void {
  const now = Date.now();
  const cb = __cbStore.get(name) ?? { failures: 0, openUntil: 0 };
  cb.failures++;
  if (cb.failures >= threshold) {
    cb.openUntil = now + cooldownMs;
    console.warn(`[circuit-breaker] ${name}: OPEN after ${cb.failures} failures`);
  }
  __cbStore.set(name, cb);
}

function __cbSuccess(name: string): void {
  __cbStore.delete(name);
}

// ─── Imports ─────────────────────────────────────────────────────────

import { CHANNEL_BY_NAME, CRYPTO_CHANNELS } from './config';
import {
  CATEGORY_KEYWORDS,
  computeEngagementSignals,
  computeQualityScore,
  detectContentType,
  isLowQualityVideo,
  QUALITY_FILTERS,
  scoreCreatorRelevance,
} from './filters';
import { fetchChannelFeed } from './parser';
import type {
  ChannelCategory,
  ChannelSubcategory,
  DiscoveredCreator,
  VideoContentType,
  YouTubeVideoItem,
} from './types';

export { CHANNEL_BY_NAME, CRYPTO_CHANNELS } from './config';
export {
  CATEGORY_KEYWORDS,
  computeEngagementSignals,
  computeQualityScore,
  detectContentType,
  isLowQualityVideo,
  QUALITY_FILTERS,
  scoreCreatorRelevance,
} from './filters';
export { fetchChannelFeed } from './parser';
export type {
  ChannelCategory,
  ChannelSubcategory,
  DiscoveredCreator,
  EngagementSignals,
  FetchYouTubeOptions,
  QualityScore,
  RSSEntry,
  TrendingCategory,
  VideoContentType,
  YouTubeChannel,
  YouTubeVideoItem,
} from './types';

// ─── Invidious instances for trending/discovery ─────────────────────
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.fdn.fr',
  'https://invidious.privacydev.net',
  'https://yewtu.be',
  'https://inv.zzz.bn',
];

function getRandomInstance(): string {
  return INVIDIOUS_INSTANCES[Math.floor(Math.random() * INVIDIOUS_INSTANCES.length)]!;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0)
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(minutes).padStart(2, '0')}`;
}

function detectCategory(title: string, description?: string): string {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return category;
    }
  }
  return 'crypto';
}

// ─── Trending by category via Invidious ───────────────────────────

/**
 * Fetch trending YouTube videos by category using Invidious API.
 * No API key required — uses open-source Invidious instances.
 */
export async function fetchTrendingByCategory(
  category: string = 'all',
  limit: number = 20,
  signal?: AbortSignal,
): Promise<YouTubeVideoItem[]> {
  if (__cbState('youtube-trending') === 'OPEN') {
    console.warn('[circuit-breaker] youtube-trending: circuit open');
    return [];
  }

  const invidiousCategories: Record<string, string> = {
    all: '',
    gaming: 'gaming',
    music: 'music',
    news: 'news',
    science: 'science',
    education: 'education',
    entertainment: 'entertainment',
    sports: 'sports',
    tech: 'technology',
  };

  const catParam = invidiousCategories[category] || '';
  const instance = getRandomInstance();

  try {
    const url = catParam
      ? `${instance}/api/v1/trending?type=${encodeURIComponent(catParam)}&region=US`
      : `${instance}/api/v1/trending?region=US`;

    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.warn(`[youtube-provider] Invidious trending returned ${res.status}`);
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as Array<Record<string, unknown>>;
    const videos: YouTubeVideoItem[] = [];

    for (const v of data.slice(0, limit)) {
      const videoId = String(v.videoId ?? '');
      const title = String(v.title ?? '');
      if (!videoId || !title) continue;

      const publishedSec = Number(v.published ?? 0);
      const publishedMs = publishedSec * 1000;
      const durationSec = Number(v.lengthSeconds ?? 0);
      const contentType = detectContentType(title, String(v.description ?? ''), durationSec);

      videos.push({
        id: videoId,
        title,
        channelName: String(v.author ?? 'Unknown'),
        channelUrl: `https://www.youtube.com/channel/${String(v.authorId ?? '')}`,
        thumbnailUrl: String(
          (v.videoThumbnails as Array<{ url: string }> | undefined)?.[0]?.url ??
            `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        ),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: new Date(publishedMs).toISOString(),
        publishedMs,
        duration: durationSec > 0 ? formatDuration(durationSec) : undefined,
        views: Number(v.viewCount ?? 0),
        likes: Number(v.likeCount ?? 0),
        description: String(v.description ?? ''),
        category:
          category !== 'all' ? category : detectCategory(title, String(v.description ?? '')),
        contentType,
        tags: Array.isArray(v.keywords) ? v.keywords.map(String) : undefined,
        source: 'youtube',
      });
    }

    __cbSuccess('youtube-trending');
    return videos.slice(0, limit);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return [];
    __cbFail('youtube-trending');
    console.warn('[youtube-provider] Invidious trending fetch failed', String(err));
    return [];
  }
}

// ─── Creator discovery ──────────────────────────────────────────────

/**
 * Discover new YouTube creators in our niches using Invidious search.
 * Finds channels with high relevance to crypto/tech/AI keywords.
 */
export async function discoverCreators(
  niches: string[] = ['crypto', 'ai', 'tech'],
  limit: number = 30,
  signal?: AbortSignal,
): Promise<DiscoveredCreator[]> {
  if (__cbState('youtube-discovery') === 'OPEN') return [];

  const query = niches.join(' ');
  const instance = getRandomInstance();

  try {
    const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=channel&sort=relevance`;

    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as Array<Record<string, unknown>>;
    const discovered: DiscoveredCreator[] = [];

    for (const ch of data.slice(0, limit)) {
      const name = String(ch.author ?? '');
      const channelId = String(ch.ucid ?? '');
      if (!name || !channelId) continue;

      const description = String(ch.description ?? '');
      const subscriberCount = Number(ch.subCount ?? 0);
      const totalVideos = Number(ch.videoCount ?? 0);

      // Score relevance to our niches
      const relevanceScore = scoreCreatorRelevance(name, description, []);

      // Skip if irrelevant (score < 0.3)
      if (relevanceScore < 0.3) continue;

      // Skip channels we already track
      if (CHANNEL_BY_NAME[name]) continue;

      discovered.push({
        name,
        channelId,
        category: 'general_tech',
        subcategory: 'opensource-dev',
        weight: Math.min(1, relevanceScore * 0.8),
        niches: [],
        subscriberCount,
        totalVideos,
        relevanceScore,
        discoverySource: 'invidious',
      });
    }

    __cbSuccess('youtube-discovery');
    return discovered;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return [];
    __cbFail('youtube-discovery');
    console.warn('[youtube-provider] Creator discovery failed', String(err));
    return [];
  }
}

// ─── Auto-add discovered creators to config ─────────────────────────

/**
 * Integrate discovered creators — call this periodically to keep
 * the channel list fresh. Returns channels added.
 */
export async function autoDiscoverAndIntegrate(signal?: AbortSignal): Promise<YouTubeChannel[]> {
  const discovered = await discoverCreators(['crypto', 'ai', 'tech'], 20, signal);
  // Future: integrate into dynamic channel registry
  return discovered.map((d) => ({
    name: d.name,
    channelId: d.channelId,
    feed: `https://www.youtube.com/feeds/videos.xml?channel_id=${d.channelId}`,
    category: d.category,
    subcategory: d.subcategory,
    weight: d.weight,
    niches: d.niches,
  }));
}

// ─── Main fetch function ────────────────────────────────────────────

export async function fetchYouTubeFeed(
  options: {
    category?: string;
    limit?: number;
    channels?: string[];
    channelCategories?: ChannelCategory[];
    channelSubcategories?: ChannelSubcategory[];
    signal?: AbortSignal;
    sort?: 'recent' | 'popular' | 'trending' | 'engagement';
    maxAgeDays?: number;
    disableQualityFilter?: boolean;
    enableDiscovery?: boolean;
    minEngagementRate?: number;
    contentType?: VideoContentType | VideoContentType[];
    skipEnrichment?: boolean;
  } = {},
): Promise<YouTubeVideoItem[]> {
  const {
    category,
    limit = 20,
    channels: channelFilter,
    channelCategories,
    channelSubcategories,
    signal,
    sort = 'recent',
    maxAgeDays,
    disableQualityFilter = false,
    // @ts-expect-error -- kept for API compatibility
    enableDiscovery,
    minEngagementRate,
    contentType,
    skipEnrichment = false,
  } = options;

  let channels = [...CRYPTO_CHANNELS];
  if (channelFilter) channels = channels.filter((c) => channelFilter.includes(c.name));
  if (channelCategories?.length)
    channels = channels.filter((c) => channelCategories.includes(c.category));
  if (channelSubcategories?.length)
    channels = channels.filter((c) => channelSubcategories.includes(c.subcategory));
  if (channels.length === 0) return [];

  if (__cbState('youtube') === 'OPEN') {
    console.warn('[circuit-breaker] youtube: skipping fetch — circuit open');
    return [];
  }

  try {
    const effectiveMaxAgeDays = maxAgeDays ?? QUALITY_FILTERS.MAX_AGE_DAYS;
    const nowMs = Date.now();
    const concurrency = 4;
    const results: Array<import('./types').RSSEntry[]> = [];
    const queue = [...channels];

    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const channel = queue.shift();
        if (!channel) break;
        const entries = await fetchChannelFeed(channel, signal);
        if (entries.length > 0) {
          const filtered = disableQualityFilter
            ? entries
            : entries.filter((e) => !isLowQualityVideo(e, channel, nowMs, effectiveMaxAgeDays));
          if (filtered.length > 0) results.push(filtered);
        }
      }
    });
    await Promise.all(workers);

    const allEntries = results.flat();
    const seen = new Set<string>();
    const items: YouTubeVideoItem[] = [];

    for (const entry of allEntries) {
      if (seen.has(entry.videoId)) continue;
      seen.add(entry.videoId);
      const publishedMs = new Date(entry.published).getTime();
      const channelInfo = CHANNEL_BY_NAME[entry.channelName ?? ''];

      // Compute enrichment
      const engagement = skipEnrichment ? undefined : computeEngagementSignals(entry);
      const qs =
        skipEnrichment || !engagement
          ? undefined
          : computeQualityScore(
              entry,
              channelInfo ?? {
                name: entry.channelName ?? 'Unknown',
                channelId: entry.channelId ?? '',
                category: 'market_analysis',
                subcategory: 'daily-news',
                weight: 0.5,
                niches: [],
              },
              engagement,
            );
      const contentType_ = skipEnrichment
        ? undefined
        : detectContentType(entry.title, entry.description, entry.duration);

      // Content type filter
      if (contentType) {
        const types = Array.isArray(contentType) ? contentType : [contentType];
        if (contentType_ && !types.includes(contentType_)) continue;
      }

      // Engagement rate filter
      if (minEngagementRate !== undefined && engagement) {
        if (engagement.estimatedEngagementRate < minEngagementRate) continue;
      }

      items.push({
        id: entry.videoId,
        title: entry.title,
        channelName: entry.channelName ?? 'Unknown',
        channelUrl: `https://www.youtube.com/channel/${entry.channelId ?? ''}`,
        thumbnailUrl:
          entry.thumbnail ?? `https://img.youtube.com/vi/${entry.videoId}/maxresdefault.jpg`,
        url: entry.link ?? `https://www.youtube.com/watch?v=${entry.videoId}`,
        publishedAt: entry.published,
        publishedMs,
        duration: entry.duration !== undefined ? formatDuration(entry.duration) : undefined,
        views: entry.views,
        likes: entry.likes,
        comments: entry.comments,
        description: entry.description,
        category: category ?? detectCategory(entry.title, entry.description),
        channelCategory: channelInfo?.category,
        channelSubcategory: channelInfo?.subcategory,
        channelWeight: channelInfo?.weight,
        niches: channelInfo?.niches,
        source: 'youtube',
        contentType: contentType_,
        engagement,
        qualityScore: qs,
        tags: entry.tags,
      });
    }

    // Sorting
    if (sort === 'recent') items.sort((a, b) => b.publishedMs - a.publishedMs);
    else if (sort === 'popular') items.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    else if (sort === 'engagement' || sort === 'trending') {
      items.sort((a, b) => {
        const scoreA =
          (a.engagement?.growthVelocity ?? a.views ?? 0) /
          Math.max(1, (Date.now() - a.publishedMs) / 3600000);
        const scoreB =
          (b.engagement?.growthVelocity ?? b.views ?? 0) /
          Math.max(1, (Date.now() - b.publishedMs) / 3600000);
        return scoreB - scoreA;
      });
    }

    const filtered =
      category && category !== 'all' ? items.filter((v) => v.category === category) : items;
    if (!category && !channelCategories)
      filtered.sort(
        (a, b) => (b.channelWeight ?? 0) - (a.channelWeight ?? 0) || b.publishedMs - a.publishedMs,
      );

    __cbSuccess('youtube');
    return filtered.slice(0, limit);
  } catch (err) {
    __cbFail('youtube');
    throw err;
  }
}

// ─── Single video lookup ─────────────────────────────────────────────

export async function getYouTubeVideoInfo(
  videoId: string,
  signal?: AbortSignal,
): Promise<YouTubeVideoItem | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      title: string;
      author_name: string;
      author_url: string;
      thumbnail_url: string;
      type: string;
    };
    return {
      id: videoId,
      title: data.title ?? 'Untitled',
      channelName: data.author_name ?? 'Unknown',
      channelUrl: data.author_url ?? '',
      thumbnailUrl: data.thumbnail_url ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt: new Date().toISOString(),
      publishedMs: Date.now(),
      source: 'youtube',
    };
  } catch {
    return null;
  }
}

// ─── Utility functions ───────────────────────────────────────────────

export function getChannelsByCategory(category: ChannelCategory): YouTubeChannel[] {
  return CRYPTO_CHANNELS.filter((c) => c.category === category).sort((a, b) => b.weight - a.weight);
}

export function getChannelsBySubcategory(subcategory: ChannelSubcategory): YouTubeChannel[] {
  return CRYPTO_CHANNELS.filter((c) => c.subcategory === subcategory).sort(
    (a, b) => b.weight - a.weight,
  );
}

export function getChannelStats() {
  const categories: Partial<Record<ChannelCategory, number>> = {};
  const subcategories: Partial<Record<ChannelSubcategory, number>> = {};
  for (const ch of CRYPTO_CHANNELS) {
    categories[ch.category] = (categories[ch.category] ?? 0) + 1;
    subcategories[ch.subcategory] = (subcategories[ch.subcategory] ?? 0) + 1;
  }
  return {
    total: CRYPTO_CHANNELS.length,
    categories,
    subcategories,
    nicheCount: new Set(CRYPTO_CHANNELS.flatMap((c) => c.niches)).size,
    livestreamExempt: QUALITY_FILTERS.LIVESTREAM_EXEMPT_CHANNELS.length,
    maxAgeDays: QUALITY_FILTERS.MAX_AGE_DAYS,
  };
}

import type { YouTubeChannel } from './types';
