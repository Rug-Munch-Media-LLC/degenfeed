/**
 * @degenfeed/api-worker — Video Bridge Routes
 *
 * Direct API endpoints for all video platform bridges.
 * "Follow creators, not platforms" — get content from every platform.
 *
 * Routes:
 *   GET /api/video/bridges/:platform/channel/:channel   — Channel videos from a specific platform
 *   GET /api/video/bridges/:platform/trending           — Trending on a specific platform
 *   GET /api/video/bridges/:platform/search?q=          — Search a specific platform
 *   GET /api/video/bridges/sources                      — List all available bridge sources
 *   GET /api/video/bridges/search?q=&platforms=         — Cross-platform search
 *
 * Supported platforms: youtube, twitch, rumble, odysee, dtube,
 *                      peertube, bitchute, dailymotion, vimeo
 */

import { Hono } from 'hono';
import type { UnifiedVideo } from '../feed/video-aggregator';
import { BRIDGE_SOURCE_META, BRIDGE_SOURCES } from '../feed/video-bridges';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';

// ─── Import bridge fetchers ────────────────────────────────────────────────

import {
  fetchBitchuteChannelVideos,
  fetchBitchuteTrending,
  searchBitchute,
} from '../feed/video-bridges/bitchute';
import {
  fetchDailymotionChannelVideos,
  fetchDailymotionTrending,
  searchDailymotion,
} from '../feed/video-bridges/dailymotion';

import {
  fetchDTubeChannelVideos,
  fetchDTubeTrending,
  searchDTube,
} from '../feed/video-bridges/dtube';
import {
  fetchOdyseeChannelVideos,
  fetchOdyseeTrending,
  searchOdysee,
} from '../feed/video-bridges/odysee';

import {
  fetchPeerTubeChannelVideos,
  fetchPeerTubeTrending,
  searchPeerTube,
  searchPeerTubeFederated,
} from '../feed/video-bridges/peertube';
import {
  fetchRumbleChannelVideos,
  fetchRumbleTrending,
  searchRumble,
} from '../feed/video-bridges/rumble';
import {
  fetchTwitchChannelVideos,
  fetchTwitchTrending,
  searchTwitch,
} from '../feed/video-bridges/twitch';
import {
  fetchVimeoChannelVideos,
  fetchVimeoTrending,
  searchVimeo,
} from '../feed/video-bridges/vimeo';

// ─── Type registry for dispatch ───────────────────────────────────────────

interface BridgeApi {
  fetchChannelVideos: (channelName: string, limit?: number) => Promise<UnifiedVideo[]>;
  fetchTrending: (category?: string, limit?: number) => Promise<UnifiedVideo[]>;
  search: (query: string, limit?: number) => Promise<UnifiedVideo[]>;
}

const BRIDGE_DISPATCH: Record<string, BridgeApi> = {
  odysee: {
    fetchChannelVideos: fetchOdyseeChannelVideos,
    fetchTrending: fetchOdyseeTrending,
    search: searchOdysee,
  },
  rumble: {
    fetchChannelVideos: fetchRumbleChannelVideos,
    fetchTrending: fetchRumbleTrending,
    search: searchRumble,
  },
  dtube: {
    fetchChannelVideos: fetchDTubeChannelVideos,
    fetchTrending: fetchDTubeTrending,
    search: searchDTube,
  },
  bitchute: {
    fetchChannelVideos: fetchBitchuteChannelVideos,
    fetchTrending: fetchBitchuteTrending,
    search: searchBitchute,
  },
  peertube: {
    fetchChannelVideos: fetchPeerTubeChannelVideos,
    fetchTrending: fetchPeerTubeTrending,
    search: searchPeerTube,
  },
  dailymotion: {
    fetchChannelVideos: fetchDailymotionChannelVideos,
    fetchTrending: fetchDailymotionTrending,
    search: searchDailymotion,
  },
  vimeo: {
    fetchChannelVideos: fetchVimeoChannelVideos,
    fetchTrending: fetchVimeoTrending,
    search: searchVimeo,
  },
  twitch: {
    fetchChannelVideos: fetchTwitchChannelVideos,
    fetchTrending: fetchTwitchTrending,
    search: searchTwitch,
  },
};

// ─── Router ────────────────────────────────────────────────────────────────

const videoBridges = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/bridges — List all available bridge sources
// ═══════════════════════════════════════════════════════════════════════════

videoBridges.get('/', (_c) => {
  const sources = BRIDGE_SOURCES.map((s) => ({
    id: s,
    label: BRIDGE_SOURCE_META[s]?.label ?? s,
    color: BRIDGE_SOURCE_META[s]?.color ?? '#666',
  }));
  return noCacheJsonResponse({ sources, total: sources.length });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/bridges/sources — Alias for listing sources
// ═══════════════════════════════════════════════════════════════════════════

videoBridges.get('/sources', (_c) => {
  const sources = BRIDGE_SOURCES.map((s) => ({
    id: s,
    label: BRIDGE_SOURCE_META[s]?.label ?? s,
    color: BRIDGE_SOURCE_META[s]?.color ?? '#666',
  }));
  return noCacheJsonResponse({ sources, total: sources.length });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/bridges/:platform/channel/:channel — Channel videos
// ═══════════════════════════════════════════════════════════════════════════

videoBridges.get('/:platform/channel/:channel', async (c) => {
  const platform = c.req.param('platform')?.toLowerCase();
  const channel = c.req.param('channel');
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 10, 1), 100);

  if (!channel || channel.length < 1) {
    return jsonResponse({ error: 'Channel name is required' }, 400);
  }

  const bridge = BRIDGE_DISPATCH[platform];
  if (!bridge) {
    const available = Object.keys(BRIDGE_DISPATCH).join(', ');
    return jsonResponse(
      {
        error: `Unsupported platform "${platform}". Available: ${available}`,
      },
      400,
    );
  }

  try {
    const videos = await bridge.fetchChannelVideos(channel, limit);
    return noCacheJsonResponse({
      platform,
      channel,
      videos,
      total: videos.length,
      source: BRIDGE_SOURCE_META[platform] ?? {
        label: platform,
        color: '#666',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to fetch ${platform} channel: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/bridges/:platform/trending — Trending on a platform
// ═══════════════════════════════════════════════════════════════════════════

videoBridges.get('/:platform/trending', async (c) => {
  const platform = c.req.param('platform')?.toLowerCase();
  const category = c.req.query('category') || '';
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);

  const bridge = BRIDGE_DISPATCH[platform];
  if (!bridge) {
    const available = Object.keys(BRIDGE_DISPATCH).join(', ');
    return jsonResponse(
      {
        error: `Unsupported platform "${platform}". Available: ${available}`,
      },
      400,
    );
  }

  try {
    const videos = await bridge.fetchTrending(category, limit);
    return noCacheJsonResponse({
      platform,
      category: category || 'all',
      videos,
      total: videos.length,
      source: BRIDGE_SOURCE_META[platform] ?? {
        label: platform,
        color: '#666',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to fetch ${platform} trending: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/bridges/:platform/search — Search on a platform
// ═══════════════════════════════════════════════════════════════════════════

videoBridges.get('/:platform/search', async (c) => {
  const platform = c.req.param('platform')?.toLowerCase();
  const query = c.req.query('q')?.trim();
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 10, 1), 100);

  if (!query || query.length < 2) {
    return jsonResponse({ error: 'Search query is required (min 2 chars)' }, 400);
  }

  const bridge = BRIDGE_DISPATCH[platform];
  if (!bridge) {
    const available = Object.keys(BRIDGE_DISPATCH).join(', ');
    return jsonResponse(
      {
        error: `Unsupported platform "${platform}". Available: ${available}`,
      },
      400,
    );
  }

  try {
    const videos = await bridge.search(query, limit);
    return noCacheJsonResponse({
      platform,
      query,
      videos,
      total: videos.length,
      source: BRIDGE_SOURCE_META[platform] ?? {
        label: platform,
        color: '#666',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to search ${platform}: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/bridges/search — Cross-platform search
// ═══════════════════════════════════════════════════════════════════════════

videoBridges.get('/search', async (c) => {
  const query = c.req.query('q')?.trim();
  const platformsParam = c.req.query('platforms');
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);

  if (!query || query.length < 2) {
    return jsonResponse({ error: 'Search query is required (min 2 chars)' }, 400);
  }

  // Determine which platforms to search
  const selectedPlatforms = platformsParam
    ? platformsParam.split(',').map((p) => p.trim().toLowerCase())
    : Object.keys(BRIDGE_DISPATCH);

  const fetchers: Promise<UnifiedVideo[]>[] = [];

  for (const platform of selectedPlatforms) {
    const bridge = BRIDGE_DISPATCH[platform];
    if (bridge) {
      fetchers.push(bridge.search(query, Math.ceil(limit / selectedPlatforms.length)));
    }
  }

  try {
    const results = await Promise.allSettled(fetchers);
    const allVideos: UnifiedVideo[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') allVideos.push(...r.value);
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const unique = allVideos.filter((v) => {
      const key = v.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by published date, newest first
    unique.sort((a, b) => b.publishedMs - a.publishedMs);

    const results_ = unique.slice(0, limit);

    // Source breakdown
    const sourceBreakdown: Record<string, number> = {};
    for (const v of results_) {
      sourceBreakdown[v.platform] = (sourceBreakdown[v.platform] ?? 0) + 1;
    }

    return noCacheJsonResponse({
      query,
      videos: results_,
      total: results_.length,
      sourceBreakdown,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Cross-platform search failed: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/bridges/peertube/federated — Federated PeerTube search
// ═══════════════════════════════════════════════════════════════════════════

videoBridges.get('/peertube/federated', async (c) => {
  const query = c.req.query('q')?.trim();
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 10, 1), 100);

  if (!query || query.length < 2) {
    return jsonResponse({ error: 'Search query is required (min 2 chars)' }, 400);
  }

  try {
    const videos = await searchPeerTubeFederated(query, limit);
    return noCacheJsonResponse({
      query,
      platform: 'peertube',
      mode: 'federated',
      videos,
      total: videos.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Federated PeerTube search failed: ${msg}` }, 500);
  }
});

// ─── Export ────────────────────────────────────────────────────────────────

export { videoBridges };
