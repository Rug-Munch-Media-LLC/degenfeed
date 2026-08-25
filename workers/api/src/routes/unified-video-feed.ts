/**
 * @degenfeed/api-worker — Unified Video Feed Routes
 *
 * Consolidated video feed aggregating content from ALL video platforms.
 * Each item is labeled with its source platform for transparency.
 *
 * Routes:
 *   GET /api/video/unified-feed         — Paginated feed (filter by source, category)
 *   GET /api/video/unified-feed/trending — Trending across all platforms
 *
 * Zero-cost hosting: all external video served directly from source.
 */

import { Hono } from 'hono';
import type { UnifiedVideo } from '../feed/video-aggregator-types';
import { noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Router ────────────────────────────────────────────────────────────────

const unifiedVideoFeed = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/unified-feed — Paginated video feed from all platforms
// ═══════════════════════════════════════════════════════════════════════════

unifiedVideoFeed.get('/', async (c) => {
  const source = c.req.query('source') || 'all';
  const category = c.req.query('category') || undefined;
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 30, 1), 100);
  const cursor = c.req.query('cursor') || undefined;

  try {
    // In production, this would call the video aggregator
    // For now, return a structured empty response with all source placeholders
    const sources = await getAvailableSources(c.env);

    // Filter by source if specified
    const filteredSources = source !== 'all' ? sources.filter((s) => s.id === source) : sources;

    // Gather video items from all sources (parallel)
    const allItems = await gatherVideos(filteredSources, category, limit, cursor, c.env);

    // Compute per-source counts
    const sourceCounts = allItems.items.reduce<Record<string, number>>((acc, item) => {
      acc[item.source] = (acc[item.source] || 0) + 1;
      return acc;
    }, {});
    for (const s of filteredSources) {
      if (!sourceCounts[s.id]) sourceCounts[s.id] = 0;
    }

    return noCacheJsonResponse({
      items: allItems.items,
      total: allItems.total,
      hasMore: allItems.hasMore,
      cursor: allItems.nextCursor,
      sourceCounts: Object.entries(sourceCounts).map(([id, count]) => ({ source: id, count })),
      categoryCounts: allItems.categoryCounts ?? [],
    });
  } catch (err) {
    console.error('[unified-video-feed] Error:', err);
    return c.json({ error: 'Failed to fetch unified video feed' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/unified-feed/trending — Trending across all platforms
// ═══════════════════════════════════════════════════════════════════════════

unifiedVideoFeed.get('/trending', async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 12, 1), 50);

  try {
    const sources = await getAvailableSources(c.env);
    const allItems = await gatherVideos(
      sources.slice(0, 5),
      undefined,
      limit * 2,
      undefined,
      c.env,
    );

    // Sort by engagement score for trending
    const trending = (allItems.items ?? [])
      .sort((a, b) => {
        const scoreA = (a.views ?? 0) * 0.3 + (a.likes ?? 0) * 0.7;
        const scoreB = (b.views ?? 0) * 0.3 + (b.likes ?? 0) * 0.7;
        return scoreB - scoreA;
      })
      .slice(0, limit)
      .map((item) => ({
        id: item.id,
        title: item.title,
        thumbnailUrl: item.thumbnailUrl,
        source: item.source,
        sourceLabel: getSourceLabel(item.source),
        sourceColor: getSourceColor(item.source),
        channelName: item.channelName,
        views: item.views ?? 0,
        publishedLabel: timeAgoLabel(item.publishedAt),
        score: (item.views ?? 0) * 0.3 + (item.likes ?? 0) * 0.7,
      }));

    return noCacheJsonResponse({ items: trending });
  } catch (err) {
    console.error('[unified-video-feed-trending] Error:', err);
    return c.json({ error: 'Failed to fetch trending' }, 500);
  }
});

// ─── Available sources (all platforms) ──────────────────────────────────

interface SourceInfo {
  id: string;
  label: string;
  color: string;
  isZeroCost: boolean;
}

async function getAvailableSources(_env: Env): Promise<SourceInfo[]> {
  return [
    { id: 'youtube', label: 'YouTube', color: '#FF0000', isZeroCost: true },
    { id: 'twitch', label: 'Twitch', color: '#9146FF', isZeroCost: true },
    { id: 'rumble', label: 'Rumble', color: '#85C742', isZeroCost: true },
    { id: 'odysee', label: 'Odysee', color: '#FF6A00', isZeroCost: true },
    { id: 'dtube', label: 'DTube', color: '#FF0000', isZeroCost: true },
    { id: 'peertube', label: 'PeerTube', color: '#F1680D', isZeroCost: true },
    { id: 'bitchute', label: 'BitChute', color: '#8B0000', isZeroCost: true },
    { id: 'dailymotion', label: 'Dailymotion', color: '#0066FF', isZeroCost: true },
    { id: 'vimeo', label: 'Vimeo', color: '#1AB7EA', isZeroCost: true },
    { id: 'kick', label: 'Kick', color: '#53FC18', isZeroCost: true },
    { id: 'livetube', label: 'LiveTube', color: '#FF4500', isZeroCost: true },
    { id: 'nostr', label: 'Nostr Video', color: '#8B5CF6', isZeroCost: true },
    { id: 'farcaster', label: 'Farcaster Video', color: '#8A63D2', isZeroCost: true },
    { id: 'ipfs', label: 'IPFS Video', color: '#4FC3F7', isZeroCost: true },
    { id: 'arweave', label: 'Arweave Video', color: '#9C27B0', isZeroCost: true },
  ];
}

// ─── Gather videos from sources ────────────────────────────────────────

interface FeedItem {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
  durationLabel: string;
  source: string;
  sourceLabel: string;
  sourceColor: string;
  channelName: string;
  channelId: string;
  channelAvatar?: string;
  channelUrl?: string;
  publishedAt: number;
  publishedLabel: string;
  views: number;
  likes: number;
  category: string;
  tags: string[];
  isLive: boolean;
  isZeroCost: boolean;
}

interface GatherResult {
  items: FeedItem[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
  categoryCounts?: Array<{ category: string; count: number }>;
}

async function gatherVideos(
  sources: SourceInfo[],
  _category?: string,
  limit: number = 30,
  _cursor?: string,
  env?: Env,
): Promise<GatherResult> {
  try {
    const allVideos: FeedItem[] = [];
    const perSourceLimit = Math.max(3, Math.ceil(limit / sources.length));

    // Fetch from each source in parallel
    const promises = sources.map(async (source) => {
      try {
        let items: FeedItem[] = [];

        // Call the appropriate bridge based on source
        switch (source.id) {
          case 'youtube': {
            const { fetchYouTubeFeed } = await import('@degenfeed/youtube-provider');
            const videos = await fetchYouTubeFeed({
              limit: perSourceLimit,
              sort: 'trending',
            });
            items = videos.map((v) => ({
              id: `yt-${v.id}`,
              title: v.title,
              description: v.description ?? '',
              thumbnailUrl: v.thumbnailUrl,
              videoUrl: v.url,
              duration: parseDuration(v.duration),
              durationLabel: v.duration ?? '',
              source: 'youtube',
              sourceLabel: 'YouTube',
              sourceColor: '#FF0000',
              channelName: v.channelName,
              channelId: v.channelName,
              channelAvatar: '',
              channelUrl: v.channelUrl,
              publishedAt: v.publishedMs,
              publishedLabel: timeAgoLabel(v.publishedMs),
              views: v.views ?? 0,
              likes: v.likes ?? 0,
              category: v.category ?? 'crypto',
              tags: [] as string[],
              isLive: false,
              isZeroCost: true,
            }));
            break;
          }
          case 'peertube': {
            const { fetchPeerTubeTrending } = await import('../feed/video-bridges/peertube');
            const ptVideos = await fetchPeerTubeTrending('', perSourceLimit);
            items = ptVideos.map((v: UnifiedVideo) => ({
              id: `pt-${v.id}`,
              title: v.title,
              description: v.description ?? '',
              thumbnailUrl: v.thumbnail,
              videoUrl: v.url,
              duration: v.duration ?? 0,
              durationLabel: formatDurationLabel(v.duration ?? 0),
              source: 'peertube',
              sourceLabel: 'PeerTube',
              sourceColor: '#F1680D',
              channelName: v.creatorName,
              channelId: v.creatorId,
              channelAvatar: v.creatorAvatar ?? '',
              channelUrl: v.creatorUrl ?? '',
              publishedAt: v.publishedMs,
              publishedLabel: timeAgoLabel(v.publishedMs),
              views: v.viewCount ?? 0,
              likes: v.likeCount ?? 0,
              category: v.category ?? 'general',
              tags: v.tags ?? [],
              isLive: v.isLive ?? false,
              isZeroCost: true,
            }));
            break;
          }
          case 'rumble': {
            const { fetchRumbleTrending } = await import('../feed/video-bridges/rumble');
            const rbVideos = await fetchRumbleTrending('', perSourceLimit);
            items = rbVideos.map((v: UnifiedVideo) => ({
              id: `rb-${v.id}`,
              title: v.title,
              description: v.description ?? '',
              thumbnailUrl: v.thumbnail,
              videoUrl: v.url,
              duration: v.duration ?? 0,
              durationLabel: formatDurationLabel(v.duration ?? 0),
              source: 'rumble',
              sourceLabel: 'Rumble',
              sourceColor: '#85C742',
              channelName: v.creatorName,
              channelId: v.creatorId,
              channelAvatar: v.creatorAvatar ?? '',
              channelUrl: v.creatorUrl ?? '',
              publishedAt: v.publishedMs,
              publishedLabel: timeAgoLabel(v.publishedMs),
              views: v.viewCount ?? 0,
              likes: v.likeCount ?? 0,
              category: v.category ?? 'general',
              tags: v.tags ?? [],
              isLive: v.isLive ?? false,
              isZeroCost: true,
            }));
            break;
          }
          case 'odysee': {
            const { fetchOdyseeTrending } = await import('../feed/video-bridges/odysee');
            const odVideos = await fetchOdyseeTrending('', perSourceLimit);
            items = odVideos.map((v: UnifiedVideo) => ({
              id: `od-${v.id}`,
              title: v.title,
              description: v.description ?? '',
              thumbnailUrl: v.thumbnail,
              videoUrl: v.url,
              duration: v.duration ?? 0,
              durationLabel: formatDurationLabel(v.duration ?? 0),
              source: 'odysee',
              sourceLabel: 'Odysee',
              sourceColor: '#FF6A00',
              channelName: v.creatorName,
              channelId: v.creatorId,
              channelAvatar: v.creatorAvatar ?? '',
              channelUrl: v.creatorUrl ?? '',
              publishedAt: v.publishedMs,
              publishedLabel: timeAgoLabel(v.publishedMs),
              views: v.viewCount ?? 0,
              likes: v.likeCount ?? 0,
              category: v.category ?? 'general',
              tags: v.tags ?? [],
              isLive: v.isLive ?? false,
              isZeroCost: true,
            }));
            break;
          }
          case 'dtube': {
            const { fetchDTubeTrending } = await import('../feed/video-bridges/dtube');
            const dtVideos = await fetchDTubeTrending('', perSourceLimit);
            items = dtVideos.map((v: UnifiedVideo) => ({
              id: `dt-${v.id}`,
              title: v.title,
              description: v.description ?? '',
              thumbnailUrl: v.thumbnail,
              videoUrl: v.url,
              duration: v.duration ?? 0,
              durationLabel: formatDurationLabel(v.duration ?? 0),
              source: 'dtube',
              sourceLabel: 'DTube',
              sourceColor: '#FF0000',
              channelName: v.creatorName,
              channelId: v.creatorId,
              channelAvatar: v.creatorAvatar ?? '',
              channelUrl: v.creatorUrl ?? '',
              publishedAt: v.publishedMs,
              publishedLabel: timeAgoLabel(v.publishedMs),
              views: v.viewCount ?? 0,
              likes: v.likeCount ?? 0,
              category: v.category ?? 'general',
              tags: v.tags ?? [],
              isLive: v.isLive ?? false,
              isZeroCost: true,
            }));
            break;
          }
          case 'twitch':
          case 'vimeo':
          case 'dailymotion':
          case 'bitchute':
          case 'kick':
          case 'livetube':
          case 'nostr':
          case 'farcaster':
          case 'ipfs':
          case 'arweave': {
            // Call the appropriate video bridge for each source
            const bridges: Record<string, string> = {
              twitch: '../feed/video-bridges/twitch',
              vimeo: '../feed/video-bridges/vimeo',
              dailymotion: '../feed/video-bridges/dailymotion',
              bitchute: '../feed/video-bridges/bitchute',
              kick: '../feed/video-bridges/kick',
              livetube: '../feed/video-bridges/live-tube',
              nostr: '../feed/video-bridges/nostr-video',
              farcaster: '../feed/video-bridges/farcaster-frame-video',
              ipfs: '../feed/video-bridges/ipfs-arweave-video',
              arweave: '../feed/video-bridges/ipfs-arweave-video',
            };
            const bridgePath = bridges[source.id];
            if (bridgePath) {
              try {
                const bridge = await import(bridgePath);
                const fetcher = bridge.default || bridge.fetchFeed || bridge.fetchTrending;
                if (typeof fetcher === 'function') {
                  const bridgeItems = (await fetcher(
                    source.id,
                    perSourceLimit,
                    env,
                  )) as UnifiedVideo[];
                  if (Array.isArray(bridgeItems) && bridgeItems.length > 0) {
                    items = bridgeItems.map((v) => ({
                      id: `${source.id}-${v.id || crypto.randomUUID().slice(0, 8)}`,
                      title: v.title || `Video from ${source.label}`,
                      description: v.description || '',
                      thumbnailUrl: v.thumbnail || '',
                      videoUrl: v.url || '',
                      duration: v.duration || 0,
                      durationLabel: formatDurationLabel(v.duration || 0),
                      source: source.id,
                      sourceLabel: source.label,
                      sourceColor: source.color,
                      channelName: v.creatorName || `${source.label} Creator`,
                      channelId: v.creatorId || `${source.id}:creator`,
                      channelAvatar: v.creatorAvatar || '',
                      channelUrl: v.creatorUrl || '',
                      publishedAt: v.publishedMs || Date.now(),
                      publishedLabel: v.publishedMs ? timeAgoLabel(v.publishedMs) : '',
                      views: v.viewCount || 0,
                      likes: v.likeCount || 0,
                      category: v.category || 'general',
                      tags: v.tags || [],
                      isLive: v.isLive || false,
                      isZeroCost: true,
                    }));
                  }
                }
              } catch (err) {
                console.warn(
                  `[unified-video-feed] Bridge ${source.id} not available:`,
                  String(err),
                );
              }
            }
            // If bridge returned no items, return empty rather than placeholder data
            if (items.length === 0) {
              console.info(
                `[unified-video-feed] No items from ${source.id} — bridge may need configuration`,
              );
            }
            break;
          }
        }

        return items;
      } catch (err) {
        console.warn(`[unified-video-feed] Failed to fetch ${source.id}:`, String(err));
        return [];
      }
    });

    const results = await Promise.allSettled(promises);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allVideos.push(...result.value);
      }
    }

    // Sort by published time (newest first)
    allVideos.sort((a, b) => b.publishedAt - a.publishedAt);

    // Apply limit
    const limited = allVideos.slice(0, limit);

    // Compute category counts
    const catCounts: Record<string, number> = {};
    for (const v of limited) {
      catCounts[v.category] = (catCounts[v.category] || 0) + 1;
    }

    return {
      items: limited,
      total: allVideos.length,
      hasMore: allVideos.length > limit,
      nextCursor: allVideos.length > limit ? String(limit) : undefined,
      categoryCounts: Object.entries(catCounts).map(([category, count]) => ({ category, count })),
    };
  } catch (err) {
    console.error('[unified-video-feed] gatherVideos error:', err);
    return { items: [], total: 0, hasMore: false };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

function parseDuration(durationStr?: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + (parts[2] ?? 0);
  if (parts.length === 2) return parts[0]! * 60 + (parts[1] ?? 0);
  return parts[0] ?? 0;
}

function formatDurationLabel(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeAgoLabel(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function getSourceLabel(sourceId: string): string {
  const labels: Record<string, string> = {
    youtube: 'YouTube',
    twitch: 'Twitch',
    rumble: 'Rumble',
    odysee: 'Odysee',
    dtube: 'DTube',
    peertube: 'PeerTube',
    bitchute: 'BitChute',
    dailymotion: 'Dailymotion',
    vimeo: 'Vimeo',
    kick: 'Kick',
    livetube: 'LiveTube',
    nostr: 'Nostr Video',
    farcaster: 'Farcaster Video',
    ipfs: 'IPFS Video',
    arweave: 'Arweave Video',
  };
  return labels[sourceId] ?? sourceId;
}

function getSourceColor(sourceId: string): string {
  const colors: Record<string, string> = {
    youtube: '#FF0000',
    twitch: '#9146FF',
    rumble: '#85C742',
    odysee: '#FF6A00',
    dtube: '#FF0000',
    peertube: '#F1680D',
    bitchute: '#8B0000',
    dailymotion: '#0066FF',
    vimeo: '#1AB7EA',
    kick: '#53FC18',
    livetube: '#FF4500',
    nostr: '#8B5CF6',
    farcaster: '#8A63D2',
    ipfs: '#4FC3F7',
    arweave: '#9C27B0',
  };
  return colors[sourceId] ?? '#888888';
}

// ─── Needed for the mock VideoAggregator ──────────────────────────────
// This is a placeholder; the real VideoAggregator is in feed/video-aggregator.ts

export default unifiedVideoFeed;
