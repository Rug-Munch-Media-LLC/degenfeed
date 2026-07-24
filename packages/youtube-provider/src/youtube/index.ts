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
import { CATEGORY_KEYWORDS, isLowQualityVideo, QUALITY_FILTERS } from './filters';
import { fetchChannelFeed } from './parser';
import type { ChannelCategory, ChannelSubcategory, YouTubeVideoItem } from './types';

export { CHANNEL_BY_NAME, CRYPTO_CHANNELS } from './config';
export { CATEGORY_KEYWORDS, isLowQualityVideo, QUALITY_FILTERS } from './filters';
export { fetchChannelFeed } from './parser';
export type {
  ChannelCategory,
  ChannelSubcategory,
  FetchYouTubeOptions,
  RSSEntry,
  YouTubeChannel,
  YouTubeVideoItem,
} from './types';

// ─── Helpers ────────────────────────────────────────────────────────────

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0)
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
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

// ─── Main fetch function ────────────────────────────────────────────

export async function fetchYouTubeFeed(
  options: {
    category?: string;
    limit?: number;
    channels?: string[];
    channelCategories?: ChannelCategory[];
    channelSubcategories?: ChannelSubcategory[];
    signal?: AbortSignal;
    sort?: 'recent' | 'popular' | 'trending';
    maxAgeDays?: number;
    disableQualityFilter?: boolean;
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
  } = options;

  let channels = [...CRYPTO_CHANNELS];
  if (channelFilter) channels = channels.filter((c) => channelFilter.includes(c.name));
  if (channelCategories?.length)
    channels = channels.filter((c) => channelCategories.includes(c.category));
  if (channelSubcategories?.length)
    channels = channels.filter((c) => channelSubcategories.includes(c.subcategory));
  if (channels.length === 0) return [];

  if (__cbState('youtube') === 'OPEN') {
    console.warn('[circuit-breaker] youtube: skipping fetch \u2014 circuit open');
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
        description: entry.description,
        category: category ?? detectCategory(entry.title, entry.description),
        channelCategory: channelInfo?.category,
        channelSubcategory: channelInfo?.subcategory,
        channelWeight: channelInfo?.weight,
        niches: channelInfo?.niches,
        source: 'youtube',
      });
    }

    if (sort === 'recent') items.sort((a, b) => b.publishedMs - a.publishedMs);
    else if (sort === 'popular') items.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    else if (sort === 'trending')
      items.sort((a, b) => {
        const scoreA = (a.views ?? 0) / Math.max(1, (Date.now() - a.publishedMs) / 3600000);
        const scoreB = (b.views ?? 0) / Math.max(1, (Date.now() - b.publishedMs) / 3600000);
        return scoreB - scoreA;
      });

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
