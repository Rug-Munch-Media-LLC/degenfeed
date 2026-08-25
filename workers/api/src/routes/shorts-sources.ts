import { kvGetJson } from '../lib/kv-json';
/**
 * @routes/shorts-sources — Shorts Source Management Routes
 *
 * Manage content sources for the shorts aggregation engine.
 *
 * GET    /api/shorts/sources              — List configured sources with health
 * POST   /api/shorts/sources              — Add a new source (RSS feed, channel, hashtag)
 * DELETE /api/shorts/sources/:id          — Remove a source
 * POST   /api/shorts/sources/:id/refresh  — Force refresh content from source
 * GET    /api/shorts/sources/suggestions  — Suggested sources to add
 */

import {
  ALL_SOURCES,
  type ExtendedSource,
  ShortsAggregatorV2,
  SOURCE_META,
} from '../feed/shorts-aggregator-v2';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────

export interface ManagedSource {
  id: string;
  type: 'rss_feed' | 'channel' | 'hashtag' | 'community' | 'instance';
  label: string;
  url: string;
  protocol: ExtendedSource;
  enabled: boolean;
  createdAt: number;
  lastFetchedAt?: number;
  errorCount: number;
  tags?: string[];
}

export interface SourceSuggestion {
  type: ManagedSource['type'];
  label: string;
  url: string;
  protocol: ExtendedSource;
  reason: string;
}

// ─── KV key patterns ─────────────────────────────────────────────────────

const KV_PREFIX = 'shorts:sources:';
const KV_CONFIG_KEY = 'shorts:source_config';

// ─── Handler: List sources with health ─────────────────────────────────

export async function handleListSources(_request: Request, env: Env): Promise<Response> {
  try {
    // 1. Load configured sources from KV
    const configuredSources = await loadSources(env);

    // 2. Check health of all sources
    const aggregator = new ShortsAggregatorV2(env);
    const healthResults = await aggregator.checkSourcesHealth();

    // 3. Merge configured + built-in sources with health
    const combined = ALL_SOURCES.map((source) => {
      const meta = SOURCE_META[source];
      const health = healthResults.find((h) => h.source === source);
      const config = configuredSources.find((s) => s.protocol === source);

      return {
        source,
        label: meta?.label ?? source,
        color: meta?.color,
        icon: meta?.icon,
        healthy: health?.healthy ?? false,
        lastCheck: health?.lastFetch ?? 0,
        error: health?.error,
        configured: !!config,
        config: config ?? null,
      };
    });

    // Add custom RSS feed sources
    const customFeeds = configuredSources.filter(
      (s) => s.type === 'rss_feed' || s.type === 'channel',
    );
    for (const feed of customFeeds) {
      combined.push({
        source: 'rss_bridge' as ExtendedSource,
        label: feed.label,
        color: SOURCE_META.rss_bridge.color,
        icon: 'RSS',
        healthy: true,
        lastCheck: feed.lastFetchedAt ?? 0,
        configured: true,
        config: feed,
      });
    }

    return noCacheJsonResponse({ sources: combined, count: combined.length });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to list sources',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

// ─── Handler: Add a new source ─────────────────────────────────────────

export async function handleAddSource(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as {
      type: ManagedSource['type'];
      label: string;
      url: string;
      protocol: ExtendedSource;
      tags?: string[];
    };

    if (!body.type || !body.label || !body.url) {
      return jsonResponse({ error: 'type, label, and url are required' }, 400);
    }

    if (!['rss_feed', 'channel', 'hashtag', 'community', 'instance'].includes(body.type)) {
      return jsonResponse(
        { error: 'type must be one of: rss_feed, channel, hashtag, community, instance' },
        400,
      );
    }

    const source: ManagedSource = {
      id: `${body.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: body.type,
      label: body.label,
      url: body.url,
      protocol: body.protocol || 'rss_bridge',
      enabled: true,
      createdAt: Date.now(),
      errorCount: 0,
      tags: body.tags ?? [],
    };

    await saveSource(source, env);

    return jsonResponse({ success: true, source }, 201);
  } catch (err) {
    return jsonResponse(
      { error: 'Failed to add source', details: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}

// ─── Handler: Remove a source ──────────────────────────────────────────

export async function handleRemoveSource(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);

  try {
    const url = new URL(request.url);
    const sourceId = url.pathname.split('/').pop(); // /api/shorts/sources/:id

    if (!sourceId || sourceId === 'sources') {
      return jsonResponse({ error: 'Source ID is required' }, 400);
    }

    const deleted = await deleteSource(sourceId, env);
    if (!deleted) {
      return jsonResponse({ error: 'Source not found' }, 404);
    }

    return jsonResponse({ success: true, removed: sourceId });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to remove source',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

// ─── Handler: Force refresh source ─────────────────────────────────────

export async function handleRefreshSource(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const sourceId = pathParts[pathParts.length - 2]; // /api/shorts/sources/:id/refresh

    if (!sourceId) {
      return jsonResponse({ error: 'Source ID is required' }, 400);
    }

    // Trigger refresh — for now, we just update the lastFetchedAt
    const sources = await loadSources(env);
    const source = sources.find((s) => s.id === sourceId);
    if (!source) {
      return jsonResponse({ error: 'Source not found' }, 404);
    }

    source.lastFetchedAt = Date.now();
    source.errorCount = 0;
    await saveSource(source, env);

    // Also run the aggregator to warm cache
    const aggregator = new ShortsAggregatorV2(env);
    const result = await aggregator.aggregate({
      sources: [source.protocol],
      limit: 20,
    });

    return jsonResponse({
      success: true,
      refreshed: sourceId,
      shortsFound: result.shorts.length,
      healthy: result.sourceHealth[0]?.healthy ?? false,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to refresh source',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

// ─── Handler: Source suggestions ────────────────────────────────────────

export async function handleSourceSuggestions(_request: Request, env: Env): Promise<Response> {
  try {
    const suggestions: SourceSuggestion[] = [
      // PeerTube instances
      {
        type: 'instance',
        label: 'PeerTube — video.degenfeed.xyz',
        url: 'https://video.degenfeed.xyz',
        protocol: 'peertube',
        reason: 'Your own PeerTube instance — best integration',
      },
      {
        type: 'instance',
        label: 'PeerTube — share.tube',
        url: 'https://share.tube',
        protocol: 'peertube',
        reason: 'Popular general-purpose PeerTube instance',
      },
      {
        type: 'instance',
        label: 'PeerTube — tilvids.com',
        url: 'https://tilvids.com',
        protocol: 'peertube',
        reason: 'Tech & education focused PeerTube instance',
      },
      // YouTube channels
      {
        type: 'channel',
        label: 'YouTube Shorts — Trending Crypto',
        url: 'https://www.youtube.com/hashtag/cryptoshorts',
        protocol: 'youtube',
        reason: 'Trending crypto shorts on YouTube',
      },
      {
        type: 'channel',
        label: 'YouTube — Coin Bureau',
        url: 'https://www.youtube.com/@CoinBureau',
        protocol: 'youtube',
        reason: 'Popular crypto analysis channel',
      },
      // TikTok via RSS-Bridge
      {
        type: 'hashtag',
        label: 'TikTok #crypto',
        url: 'https://www.tiktok.com/tag/crypto',
        protocol: 'tiktok_rss',
        reason: 'Trending crypto content on TikTok',
      },
      {
        type: 'hashtag',
        label: 'TikTok #defi',
        url: 'https://www.tiktok.com/tag/defi',
        protocol: 'tiktok_rss',
        reason: 'DeFi content on TikTok',
      },
      // Instagram
      {
        type: 'channel',
        label: 'Instagram — @crypto',
        url: 'https://www.instagram.com/crypto/',
        protocol: 'instagram',
        reason: 'Crypto reels on Instagram',
      },
      // RSS feeds
      {
        type: 'rss_feed',
        label: 'RSS — Crypto Shorts Feed',
        url: 'https://example.com/crypto-shorts.xml',
        protocol: 'rss_bridge',
        reason: 'Custom RSS feed with crypto short videos',
      },
      // Lemmy communities
      {
        type: 'community',
        label: 'Lemmy — !videos@lemmy.world',
        url: 'https://lemmy.world/c/videos',
        protocol: 'lemmy',
        reason: 'Video community on the largest Lemmy instance',
      },
      {
        type: 'community',
        label: 'Lemmy — !crypto@lemmy.ml',
        url: 'https://lemmy.ml/c/crypto',
        protocol: 'lemmy',
        reason: 'Crypto community on Lemmy',
      },
      // Pixelfed
      {
        type: 'instance',
        label: 'Pixelfed — pixelfed.social',
        url: 'https://pixelfed.social',
        protocol: 'pixelfed',
        reason: 'Largest Pixelfed instance with video support',
      },
      // Owncast
      {
        type: 'instance',
        label: 'Owncast — owncast.degenfeed.xyz',
        url: 'https://owncast.degenfeed.xyz',
        protocol: 'owncast',
        reason: 'Your own Owncast streaming instance',
      },
    ];

    // Filter already-configured sources
    const configured = await loadSources(env);
    const configuredUrls = new Set(configured.map((s) => s.url.toLowerCase()));
    const filtered = suggestions.filter((s) => !configuredUrls.has(s.url.toLowerCase()));

    return noCacheJsonResponse({ suggestions: filtered, count: filtered.length });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to load suggestions',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

// ─── KV Persistence ─────────────────────────────────────────────────────

async function loadSources(env: Env): Promise<ManagedSource[]> {
  try {
    const raw = await kvGetJson(env.SHORTS, KV_CONFIG_KEY);
    if (
      raw &&
      typeof raw === 'object' &&
      Array.isArray((raw as { sources: ManagedSource[] }).sources)
    ) {
      return (raw as { sources: ManagedSource[] }).sources as ManagedSource[];
    }
    // Legacy: load individual keys
    const list = await env.SHORTS?.list({ prefix: KV_PREFIX });
    if (list?.keys) {
      const sources: ManagedSource[] = [];
      for (const key of list.keys) {
        const rawSource = await env.SHORTS?.get(key.name);
        if (rawSource) {
          try {
            sources.push(JSON.parse(rawSource) as ManagedSource);
          } catch {
            /* skip corrupt */
          }
        }
      }
      return sources;
    }
  } catch {
    /* fail-open */
  }
  return [];
}

async function saveSource(source: ManagedSource, env: Env): Promise<void> {
  const sources = await loadSources(env);
  const existingIndex = sources.findIndex((s) => s.id === source.id);

  if (existingIndex >= 0) {
    sources[existingIndex] = { ...sources[existingIndex], ...source };
  } else {
    sources.push(source);
  }

  await env.SHORTS?.put(KV_CONFIG_KEY, JSON.stringify({ sources, updatedAt: Date.now() }));
}

async function deleteSource(sourceId: string, env: Env): Promise<boolean> {
  const sources = await loadSources(env);
  const index = sources.findIndex((s) => s.id === sourceId);
  if (index < 0) return false;

  sources.splice(index, 1);
  await env.SHORTS?.put(KV_CONFIG_KEY, JSON.stringify({ sources, updatedAt: Date.now() }));
  return true;
}
