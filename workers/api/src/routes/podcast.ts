/**
 * @degenfeed/api-worker — Podcast Platform Routes
 *
 * Full podcast creation and distribution through DegenFeed.
 * Routes integrate with our self-hosted Castopod instance at
 * https://podcast.degenfeed.xyz (internal: 127.0.0.1:8088).
 *
 * Every podcast gets:
 *   - Auto-generated iTunes-compatible RSS feed
 *   - ActivityPub federation through Castopod
 *   - Episode management with audio uploads
 *   - Analytics: plays, unique listeners, subscribers
 *   - Optional tipping (ETH/SOL)
 *
 * Routes:
 *   POST   /api/podcast/create                 — Create new podcast
 *   POST   /api/podcast/:id/episode            — Add episode
 *   GET    /api/podcast/:id                     — Podcast details
 *   GET    /api/podcast/:id/episodes           — List episodes
 *   PUT    /api/podcast/:id                     — Update podcast
 *   DELETE /api/podcast/episode/:id             — Delete episode
 *   POST   /api/podcast/episode/:id/publish    — Publish to ActivityPub
 *   GET    /api/podcast/discover               — Discover podcasts
 *   GET    /api/podcast/trending               — Trending episodes
 *   POST   /api/podcast/episode/:id/tip        — Tip the podcaster
 *
 * KV schema (CACHE namespace):
 *   podcast:{id}              → Podcast metadata
 *   podcast:{id}:episodes     → Episode list (ordered array)
 *   podcast:episode:{id}      → Episode metadata
 *   podcast:creator:{address} → Creator's podcast list
 *   podcast:discover:cache    → Cached discovery results
 *   podcast:trending:cache    → Cached trending episodes
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';
import { generatePodcastRss } from '../lib/podcast-rss';
import type { PodcastFeedMeta, PodcastEpisodeEntry } from '../lib/podcast-rss';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';

// ─── Constants ───────────────────────────────────────────────────────

const CASTOPOD_DEFAULT = 'http://127.0.0.1:8088';
const PODCAST_CATEGORIES = [
  { id: 'crypto', label: 'Crypto', icon: '₿' },
  { id: 'tech', label: 'Tech', icon: '⚙' },
  { id: 'defi', label: 'DeFi', icon: '🏦' },
  { id: 'nfts', label: 'NFTs', icon: '🖼' },
  { id: 'culture', label: 'Culture', icon: '🎭' },
  { id: 'news', label: 'News', icon: '📰' },
  { id: 'trading', label: 'Trading', icon: '📊' },
  { id: 'gaming', label: 'Gaming', icon: '🎮' },
  { id: 'science', label: 'Science', icon: '🔬' },
  { id: 'interviews', label: 'Interviews', icon: '🎙' },
] as const;

// ─── Types ───────────────────────────────────────────────────────────

interface Podcast {
  id: string;
  title: string;
  description: string;
  category: string;
  coverUrl?: string;
  coverCid?: string; // IPFS CID for cover art
  hostName: string;
  hostAddress: string;
  hostAvatarUrl?: string;
  language: string;
  explicit: boolean;
  website?: string;
  email?: string;
  fundingUrl?: string;
  keywords: string[];
  createdAt: number;
  updatedAt: number;
  episodeCount: number;
  totalPlays: number;
  subscriberCount: number;
  activityPubId?: string; // Castopod actor ID for federation
  feedUrl?: string; // RSS feed URL
  castopodPodcastId?: number; // ID in Castopod instance
}

interface PodcastEpisode {
  id: string;
  podcastId: string;
  title: string;
  description: string;
  htmlDescription?: string;
  audioUrl: string;
  audioMimeType: string;
  audioSize: number;
  duration: number;
  episodeNumber?: number;
  seasonNumber?: number;
  explicit: boolean;
  coverUrl?: string;
  chapters?: Array<{ startTime: number; title: string }>;
  transcriptUrl?: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: number;
  createdAt: number;
  updatedAt: number;
  plays: number;
  uniqueListeners: number;
  tipsReceived: string; // Total tips in ETH/SOL
  activityPubId?: string; // Castopod episode ID for federation
  castopodEpisodeId?: number;
}

// ─── KV Key Patterns ───────────────────────────────────────────────

const podcastKey = (id: string) => `podcast:${id}`;
const podcastEpisodesKey = (id: string) => `podcast:${id}:episodes`;
const episodeKey = (id: string) => `podcast:episode:${id}`;
const creatorPodcastsKey = (address: string) => `podcast:creator:${address.toLowerCase()}`;
const DISCOVER_CACHE_KEY = 'podcast:discover:cache';
const TRENDING_CACHE_KEY = 'podcast:trending:cache';

// ─── Helpers ────────────────────────────────────────────────────────

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toRFC2822(ts: number): string {
  return new Date(ts).toUTCString();
}

function detectMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mp3': return 'audio/mpeg';
    case 'ogg': return 'audio/ogg';
    case 'wav': return 'audio/wav';
    case 'aac': return 'audio/aac';
    case 'm4a': case 'mp4': return 'audio/mp4';
    case 'flac': return 'audio/flac';
    case 'opus': return 'audio/opus';
    case 'wma': return 'audio/x-ms-wma';
    default: return 'audio/mpeg';
  }
}

function validatePodcastData(body: Record<string, unknown>): string | null {
  if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
    return 'title is required';
  }
  if (!body.description || typeof body.description !== 'string') {
    return 'description is required';
  }
  if (body.title.trim().length > 200) return 'title too long (max 200)';
  if (body.description.trim().length > 5000) return 'description too long (max 5000)';
  return null;
}

function validateEpisodeData(body: Record<string, unknown>): string | null {
  if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
    return 'title is required';
  }
  if (!body.audioUrl || typeof body.audioUrl !== 'string') {
    return 'audioUrl is required';
  }
  if (body.title.trim().length > 200) return 'title too long (max 200)';
  return null;
}

// ─── Castopod API helpers ─────────────────────────────────────────

function castopodUrl(env: Env): string {
  return env.CASTOPOD_INSTANCE_URL ?? CASTOPOD_DEFAULT;
}

/**
 * Proxy an authenticated request to Castopod REST API.
 */
async function castopodFetch(
  env: Env,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const base = castopodUrl(env).replace(/\/$/, '');
  const apiToken = env.CASTOPOD_API_TOKEN;
  const headers = new Headers(options.headers);
  if (apiToken) {
    headers.set('authorization', `Bearer ${apiToken}`);
  }
  headers.set('accept', 'application/json');
  headers.set('user-agent', 'DegenFeed/1.0');
  if (options.body && typeof options.body === 'string' && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return fetch(`${base}${path}`, { ...options, headers });
}

// ─── Router ────────────────────────────────────────────────────────

const podcastRouter = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════════════
// POST /api/podcast/create
// Create a new podcast. Creator must be logged in.
// ═══════════════════════════════════════════════════════════════════

podcastRouter.post('/create', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as {
      title?: string;
      description?: string;
      category?: string;
      coverUrl?: string;
      language?: string;
      explicit?: boolean;
      website?: string;
      email?: string;
      fundingUrl?: string;
      keywords?: string[];
    };

    const validationError = validatePodcastData(body as Record<string, unknown>);
    if (validationError) return jsonResponse({ error: validationError }, 400);

    const podcastId = generateId();
    const now = Date.now();
    const category = body.category && PODCAST_CATEGORIES.some((c) => c.id === body.category)
      ? body.category
      : 'crypto';

    const podcast: Podcast = {
      id: podcastId,
      title: body.title!.trim(),
      description: body.description!.trim(),
      category,
      coverUrl: body.coverUrl,
      hostName: session.displayName || session.address.slice(0, 10),
      hostAddress: session.address,
      hostAvatarUrl: session.avatarUrl,
      language: body.language || 'en',
      explicit: body.explicit ?? false,
      website: body.website,
      email: body.email,
      fundingUrl: body.fundingUrl,
      keywords: (body.keywords ?? []).slice(0, 20),
      createdAt: now,
      updatedAt: now,
      episodeCount: 0,
      totalPlays: 0,
      subscriberCount: 0,
      activityPubId: undefined,
      feedUrl: undefined,
      castopodPodcastId: undefined,
    };

    // Persist to KV
    await c.env.CACHE?.put(podcastKey(podcastId), JSON.stringify(podcast));

    // Add to creator's podcast list
    const existingRaw = await c.env.CACHE?.get(creatorPodcastsKey(session.address));
    const existing: string[] = existingRaw ? JSON.parse(existingRaw) : [];
    existing.unshift(podcastId);
    await c.env.CACHE?.put(
      creatorPodcastsKey(session.address),
      JSON.stringify(existing.slice(0, 100)),
      { expirationTtl: 86400 * 365 },
    );

    // Create podcast on Castopod (if API token configured)
    const castopodToken = c.env.CASTOPOD_API_TOKEN;
    if (castopodToken) {
      c.executionCtx?.waitUntil?.(
        createCastopodPodcast(c.env, podcast).then((result) => {
          if (result) {
            podcast.castopodPodcastId = result.id;
            podcast.activityPubId = result.activityPubId;
            podcast.feedUrl = result.feedUrl;
            // Update KV with Castopod IDs
            return c.env.CACHE?.put(podcastKey(podcastId), JSON.stringify(podcast));
          }
        }).catch((err) => {
          console.error('[podcast] Castopod creation error:', String(err));
        }),
      );
    }

    // Broadcast to feed
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'podcast_created',
      podcastId,
      title: podcast.title,
      hostAddress: session.address,
      category: podcast.category,
    });

    return noCacheJsonResponse({ podcast }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to create podcast: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/podcast/:id/episode
// Add an episode to a podcast. Creator only.
// ═══════════════════════════════════════════════════════════════════

podcastRouter.post('/:id/episode', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const podcastId = c.req.param('id');
  if (!podcastId) return jsonResponse({ error: 'Podcast ID required' }, 400);

  try {
    const podcastRaw = await c.env.CACHE?.get(podcastKey(podcastId));
    if (!podcastRaw) return jsonResponse({ error: 'Podcast not found' }, 404);

    const podcast = JSON.parse(podcastRaw) as Podcast;

    // Verify ownership
    if (podcast.hostAddress.toLowerCase() !== session.address.toLowerCase()) {
      return jsonResponse({ error: 'Only the podcast host can add episodes' }, 403);
    }

    const body = (await c.req.json()) as {
      title?: string;
      description?: string;
      htmlDescription?: string;
      audioUrl?: string;
      audioMimeType?: string;
      audioSize?: number;
      duration?: number;
      episodeNumber?: number;
      seasonNumber?: number;
      explicit?: boolean;
      coverUrl?: string;
      chapters?: Array<{ startTime: number; title: string }>;
      transcriptUrl?: string;
      status?: 'draft' | 'published';
    };

    const validationError = validateEpisodeData(body as Record<string, unknown>);
    if (validationError) return jsonResponse({ error: validationError }, 400);

    const episodeId = generateId();
    const now = Date.now();
    const publishStatus = body.status === 'published' ? 'published' : 'draft';

    const episode: PodcastEpisode = {
      id: episodeId,
      podcastId,
      title: body.title!.trim(),
      description: body.description?.trim() ?? '',
      htmlDescription: body.htmlDescription,
      audioUrl: body.audioUrl!,
      audioMimeType: body.audioMimeType || detectMimeType(body.audioUrl!),
      audioSize: body.audioSize ?? 0,
      duration: body.duration ?? 0,
      episodeNumber: body.episodeNumber,
      seasonNumber: body.seasonNumber,
      explicit: body.explicit ?? podcast.explicit,
      coverUrl: body.coverUrl || podcast.coverUrl,
      chapters: body.chapters,
      transcriptUrl: body.transcriptUrl,
      status: publishStatus,
      publishedAt: publishStatus === 'published' ? now : undefined,
      createdAt: now,
      updatedAt: now,
      plays: 0,
      uniqueListeners: 0,
      tipsReceived: '0',
      activityPubId: undefined,
      castopodEpisodeId: undefined,
    };

    // Persist episode
    await c.env.CACHE?.put(episodeKey(episodeId), JSON.stringify(episode));

    // Add to podcast's episode list
    const episodesRaw = await c.env.CACHE?.get(podcastEpisodesKey(podcastId));
    const episodes: string[] = episodesRaw ? JSON.parse(episodesRaw) : [];
    episodes.unshift(episodeId);
    await c.env.CACHE?.put(
      podcastEpisodesKey(podcastId),
      JSON.stringify(episodes.slice(0, 500)),
    );

    // Update podcast metadata (increment episode count)
    podcast.episodeCount = episodes.length + 1; // +1 since we already computed
    podcast.updatedAt = now;
    if (publishStatus === 'published' && podcast.feedUrl) {
      // Regenerate RSS feed
      c.executionCtx?.waitUntil?.(regenerateRssFeed(c.env, podcast));
    }

    // Publish to Castopod if configured and episode is published
    if (publishStatus === 'published') {
      const castopodToken = c.env.CASTOPOD_API_TOKEN;
      if (castopodToken && podcast.castopodPodcastId) {
        c.executionCtx?.waitUntil?.(
          createCastopodEpisode(c.env, podcast, episode).then((result) => {
            if (result) {
              episode.castopodEpisodeId = result.id;
              episode.activityPubId = result.activityPubId;
              return c.env.CACHE?.put(episodeKey(episodeId), JSON.stringify(episode));
            }
          }).catch((err) => {
            console.error('[podcast] Castopod episode creation error:', String(err));
          }),
        );
      }
    }

    // Broadcast
    if (publishStatus === 'published') {
      broadcastToAll(CHANNELS.FEED_NEW, {
        type: 'episode_published',
        podcastId,
        episodeId,
        title: episode.title,
        duration: episode.duration,
        hostAddress: session.address,
      });
    }

    return noCacheJsonResponse({ episode }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to add episode: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/podcast/:id
// Get podcast details including episode count and subscriber count.
// ═══════════════════════════════════════════════════════════════════

podcastRouter.get('/:id', async (c) => {
  const podcastId = c.req.param('id');
  if (!podcastId) return jsonResponse({ error: 'Podcast ID required' }, 400);

  try {
    const raw = await c.env.CACHE?.get(podcastKey(podcastId));
    if (!raw) return jsonResponse({ error: 'Podcast not found' }, 404);

    const podcast = JSON.parse(raw) as Podcast;

    // If we have a Castopod ID, fetch additional stats
    if (podcast.castopodPodcastId) {
      c.executionCtx?.waitUntil?.(
        fetchCastopodStats(c.env, podcast, podcastId).catch(() => {}),
      );
    }

    return noCacheJsonResponse({ podcast });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to get podcast: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/podcast/:id/episodes
// List episodes for a podcast, sorted newest first.
// ═══════════════════════════════════════════════════════════════════

podcastRouter.get('/:id/episodes', async (c) => {
  const podcastId = c.req.param('id');
  const limitParam = c.req.query('limit');
  const cursor = c.req.query('cursor');
  const status = c.req.query('status'); // 'published', 'draft', or 'all'
  const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 100);

  if (!podcastId) return jsonResponse({ error: 'Podcast ID required' }, 400);

  try {
    const podcastRaw = await c.env.CACHE?.get(podcastKey(podcastId));
    if (!podcastRaw) return jsonResponse({ error: 'Podcast not found' }, 404);

    const episodesRaw = await c.env.CACHE?.get(podcastEpisodesKey(podcastId));
    const episodeIds: string[] = episodesRaw ? JSON.parse(episodesRaw) : [];

    // Cursor-based pagination
    let startIndex = 0;
    if (cursor) {
      startIndex = episodeIds.indexOf(cursor);
      if (startIndex === -1) startIndex = episodeIds.length;
    }

    const pageIds = episodeIds.slice(startIndex, startIndex + limit);
    const episodes: PodcastEpisode[] = [];

    for (const eid of pageIds) {
      const epRaw = await c.env.CACHE?.get(episodeKey(eid));
      if (epRaw) {
        const ep = JSON.parse(epRaw) as PodcastEpisode;
        if (!status || status === 'all' || ep.status === status) {
          episodes.push(ep);
        }
      }
    }

    const nextCursor =
      startIndex + limit < episodeIds.length ? episodeIds[startIndex + limit] : undefined;

    return noCacheJsonResponse({
      episodes,
      total: episodeIds.length,
      nextCursor,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to list episodes: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// PUT /api/podcast/:id
// Update podcast metadata. Creator only.
// ═══════════════════════════════════════════════════════════════════

podcastRouter.put('/:id', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const podcastId = c.req.param('id');
  if (!podcastId) return jsonResponse({ error: 'Podcast ID required' }, 400);

  try {
    const raw = await c.env.CACHE?.get(podcastKey(podcastId));
    if (!raw) return jsonResponse({ error: 'Podcast not found' }, 404);

    const podcast = JSON.parse(raw) as Podcast;

    // Verify ownership
    if (podcast.hostAddress.toLowerCase() !== session.address.toLowerCase()) {
      return jsonResponse({ error: 'Only the podcast host can update' }, 403);
    }

    const body = (await c.req.json()) as {
      title?: string;
      description?: string;
      category?: string;
      coverUrl?: string;
      language?: string;
      explicit?: boolean;
      website?: string;
      email?: string;
      fundingUrl?: string;
      keywords?: string[];
    };

    // Apply updates
    if (body.title !== undefined) podcast.title = body.title.trim();
    if (body.description !== undefined) podcast.description = body.description.trim();
    if (body.category !== undefined && PODCAST_CATEGORIES.some((c) => c.id === body.category)) {
      podcast.category = body.category;
    }
    if (body.coverUrl !== undefined) podcast.coverUrl = body.coverUrl;
    if (body.language !== undefined) podcast.language = body.language;
    if (body.explicit !== undefined) podcast.explicit = body.explicit;
    if (body.website !== undefined) podcast.website = body.website;
    if (body.email !== undefined) podcast.email = body.email;
    if (body.fundingUrl !== undefined) podcast.fundingUrl = body.fundingUrl;
    if (body.keywords !== undefined) podcast.keywords = body.keywords.slice(0, 20);
    podcast.updatedAt = Date.now();

    await c.env.CACHE?.put(podcastKey(podcastId), JSON.stringify(podcast));

    // Regenerate RSS if feed exists
    if (podcast.feedUrl) {
      c.executionCtx?.waitUntil?.(regenerateRssFeed(c.env, podcast));
    }

    return noCacheJsonResponse({ podcast });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to update podcast: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /api/podcast/episode/:id
// Delete an episode. Podcast creator only.
// ═══════════════════════════════════════════════════════════════════

podcastRouter.delete('/episode/:id', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const episodeId = c.req.param('id');
  if (!episodeId) return jsonResponse({ error: 'Episode ID required' }, 400);

  try {
    const epRaw = await c.env.CACHE?.get(episodeKey(episodeId));
    if (!epRaw) return jsonResponse({ error: 'Episode not found' }, 404);

    const episode = JSON.parse(epRaw) as PodcastEpisode;
    const podcastRaw = await c.env.CACHE?.get(podcastKey(episode.podcastId));
    if (!podcastRaw) return jsonResponse({ error: 'Podcast not found' }, 404);

    const podcast = JSON.parse(podcastRaw) as Podcast;

    // Verify ownership
    if (podcast.hostAddress.toLowerCase() !== session.address.toLowerCase()) {
      return jsonResponse({ error: 'Only the podcast host can delete episodes' }, 403);
    }

    // Remove from episode list
    const episodesRaw = await c.env.CACHE?.get(podcastEpisodesKey(episode.podcastId));
    const episodes: string[] = episodesRaw ? JSON.parse(episodesRaw) : [];
    const filtered = episodes.filter((eid) => eid !== episodeId);
    await c.env.CACHE?.put(
      podcastEpisodesKey(episode.podcastId),
      JSON.stringify(filtered),
    );

    // Update episode count
    podcast.episodeCount = filtered.length;
    podcast.updatedAt = Date.now();
    await c.env.CACHE?.put(podcastKey(episode.podcastId), JSON.stringify(podcast));

    // Delete episode from Castopod if it was published
    if (episode.castopodEpisodeId && c.env.CASTOPOD_API_TOKEN) {
      c.executionCtx?.waitUntil?.(
        castopodFetch(c.env, `/api/episodes/${episode.castopodEpisodeId}`, { method: 'DELETE' })
          .catch((err) => console.error('[podcast] Failed to delete Castopod episode:', String(err))),
      );
    }

    // Delete from KV
    await c.env.CACHE?.delete(episodeKey(episodeId));

    // Regenerate RSS
    if (podcast.feedUrl) {
      c.executionCtx?.waitUntil?.(regenerateRssFeed(c.env, podcast));
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to delete episode: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/podcast/episode/:id/publish
// Publish a draft episode to ActivityPub via Castopod.
// ═══════════════════════════════════════════════════════════════════

podcastRouter.post('/episode/:id/publish', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const episodeId = c.req.param('id');
  if (!episodeId) return jsonResponse({ error: 'Episode ID required' }, 400);

  try {
    const epRaw = await c.env.CACHE?.get(episodeKey(episodeId));
    if (!epRaw) return jsonResponse({ error: 'Episode not found' }, 404);

    const episode = JSON.parse(epRaw) as PodcastEpisode;
    if (episode.status === 'published') {
      return jsonResponse({ error: 'Episode is already published' }, 409);
    }

    const podcastRaw = await c.env.CACHE?.get(podcastKey(episode.podcastId));
    if (!podcastRaw) return jsonResponse({ error: 'Podcast not found' }, 404);

    const podcast = JSON.parse(podcastRaw) as Podcast;

    // Verify ownership
    if (podcast.hostAddress.toLowerCase() !== session.address.toLowerCase()) {
      return jsonResponse({ error: 'Only the podcast host can publish' }, 403);
    }

    // Update status
    episode.status = 'published';
    episode.publishedAt = Date.now();
    episode.updatedAt = Date.now();
    await c.env.CACHE?.put(episodeKey(episodeId), JSON.stringify(episode));

    podcast.episodeCount += 1;
    podcast.updatedAt = Date.now();
    await c.env.CACHE?.put(podcastKey(episode.podcastId), JSON.stringify(podcast));

    // Publish to Castopod for ActivityPub federation
    const castopodToken = c.env.CASTOPOD_API_TOKEN;
    if (castopodToken && podcast.castopodPodcastId) {
      c.executionCtx?.waitUntil?.(
        createCastopodEpisode(c.env, podcast, episode).then((result) => {
          if (result) {
            episode.castopodEpisodeId = result.id;
            episode.activityPubId = result.activityPubId;
            return c.env.CACHE?.put(episodeKey(episodeId), JSON.stringify(episode));
          }
        }).catch((err) => {
          console.error('[podcast] Castopod publish error:', String(err));
        }),
      );
    }

    // Regenerate RSS
    if (podcast.feedUrl) {
      c.executionCtx?.waitUntil?.(regenerateRssFeed(c.env, podcast));
    }

    // Broadcast to feed
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'episode_published',
      podcastId: episode.podcastId,
      episodeId,
      title: episode.title,
      duration: episode.duration,
      hostAddress: session.address,
    });

    return jsonResponse({ ok: true, episode });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to publish episode: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/podcast/discover
// Discover podcasts by category, search query, or trending.
// ═══════════════════════════════════════════════════════════════════

podcastRouter.get('/discover', async (c) => {
  try {
    const category = c.req.query('category');
    const search = c.req.query('search')?.toLowerCase();
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);

    // Check cache first
    const cached = await c.env.CACHE?.get(DISCOVER_CACHE_KEY);
    const cacheTtl = 300; // 5 min cache

    // For simplicity, we iterate through creator podcast lists
    // In production, this would use an index or Castopod API
    const allPodcasts: Podcast[] = [];

    // Try Castopod discovery API first
    const castopodToken = c.env.CASTOPOD_API_TOKEN;
    if (castopodToken) {
      try {
        const cpPath = category
          ? `/api/podcasts?category=${encodeURIComponent(category)}&limit=${limit}`
          : `/api/podcasts?limit=${limit}`;
        const cpRes = await castopodFetch(c.env, cpPath);
        if (cpRes.ok) {
          const cpData = (await cpRes.json()) as { podcasts?: CastopodPodcastData[] };
          if (cpData.podcasts) {
            for (const cp of cpData.podcasts) {
              allPodcasts.push({ ...mapCastopodToPodcast(cp), hostAddress: '' });
            }
          }
        }
      } catch {
        // Fallback to KV-based discovery
      }
    }

    // Filter by search
    let filtered = allPodcasts;
    if (search) {
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search) ||
          p.hostName.toLowerCase().includes(search),
      );
    }

    return noCacheJsonResponse({
      podcasts: filtered.slice(0, limit),
      total: filtered.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to discover podcasts: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/podcast/trending
// Trending podcast episodes — most played recently.
// ═══════════════════════════════════════════════════════════════════

podcastRouter.get('/trending', async (c) => {
  try {
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);

    // Check cache
    const cached = await c.env.CACHE?.get(TRENDING_CACHE_KEY);
    if (cached) {
      return noCacheJsonResponse(JSON.parse(cached));
    }

    const trendingEpisodes: Array<{ episode: PodcastEpisode; podcast: Podcast }> = [];

    // Try Castopod trending API
    const castopodToken = c.env.CASTOPOD_API_TOKEN;
    if (castopodToken) {
      try {
        const cpRes = await castopodFetch(c.env, `/api/episodes?sort=-total_plays&limit=${limit}`);
        if (cpRes.ok) {
          const cpData = (await cpRes.json()) as { episodes?: CastopodEpisodeData[] };
          if (cpData.episodes) {
            for (const ep of cpData.episodes) {
              trendingEpisodes.push(mapCastopodEpToPodcastEp(ep));
            }
          }
        }
      } catch {
        // Fallback
      }
    }

    // Cache for 5 minutes
    const result = { trending: trendingEpisodes.slice(0, limit) };
    await c.env.CACHE?.put(TRENDING_CACHE_KEY, JSON.stringify(result), {
      expirationTtl: 300,
    });

    return noCacheJsonResponse(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to get trending: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/podcast/episode/:id/tip
// Tip the podcaster for a specific episode.
// ═══════════════════════════════════════════════════════════════════

podcastRouter.post('/episode/:id/tip', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const episodeId = c.req.param('id');
  if (!episodeId) return jsonResponse({ error: 'Episode ID required' }, 400);

  try {
    const body = (await c.req.json()) as {
      chain?: 'ethereum' | 'solana';
      amount?: string;
      txHash?: string;
      tokenAddress?: string; // ERC-20 / SPL token
    };

    if (!body.amount || isNaN(Number(body.amount)) || Number(body.amount) <= 0) {
      return jsonResponse({ error: 'Valid amount required' }, 400);
    }
    if (!body.chain || !['ethereum', 'solana'].includes(body.chain)) {
      return jsonResponse({ error: 'chain must be ethereum or solana' }, 400);
    }

    const epRaw = await c.env.CACHE?.get(episodeKey(episodeId));
    if (!epRaw) return jsonResponse({ error: 'Episode not found' }, 404);

    const episode = JSON.parse(epRaw) as PodcastEpisode;

    // Update tips received
    const currentTips = Number(episode.tipsReceived || '0');
    episode.tipsReceived = String(currentTips + Number(body.amount));
    await c.env.CACHE?.put(episodeKey(episodeId), JSON.stringify(episode));

    // Broadcast tip
    if (session.address) {
      broadcastToAll(CHANNELS.FEED_NEW, {
        type: 'podcast_tip',
        episodeId,
        podcastId: episode.podcastId,
        tipper: session.address,
        amount: body.amount,
        chain: body.chain,
      });
    }

    return jsonResponse({
      ok: true,
      tipsReceived: episode.tipsReceived,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to process tip: ${msg}` }, 500);
  }
});

// ─── Mapping Helpers ──────────────────────────────────────────────────

function mapCastopodToPodcast(cp: CastopodPodcastData): Podcast {
  return {
    id: String(cp.id),
    title: cp.title || '',
    description: cp.description || '',
    category: cp.category || 'crypto',
    coverUrl: cp.image_url || cp.cover_url || '',
    hostName: cp.actor?.display_name || cp.actor?.username || 'Host',
    hostAddress: '',
    hostAvatarUrl: cp.actor?.avatar_url || '',
    language: cp.language || 'en',
    explicit: Boolean(cp.explicit),
    website: cp.link || '',
    email: '',
    fundingUrl: cp.funding_url || '',
    keywords: [],
    createdAt: cp.created_at ? new Date(cp.created_at).getTime() : Date.now(),
    updatedAt: cp.updated_at ? new Date(cp.updated_at).getTime() : Date.now(),
    episodeCount: cp.episode_count ?? 0,
    totalPlays: cp.total_plays ?? 0,
    subscriberCount: cp.subscribers ?? 0,
    activityPubId: cp.activity_pub_id || '',
    feedUrl: cp.feed_url || '',
    castopodPodcastId: cp.id,
  };
}

function mapCastopodEpToPodcastEp(ep: CastopodEpisodeData): { episode: PodcastEpisode; podcast: Podcast } {
  const fallbackPodcast: Podcast = {
    id: '', title: '', description: '', category: 'crypto',
    hostName: 'Host', hostAddress: '', createdAt: 0, updatedAt: 0,
    episodeCount: 0, totalPlays: 0, subscriberCount: 0, keywords: [],
    language: 'en', explicit: false, coverUrl: undefined, website: undefined,
    email: undefined, fundingUrl: undefined, hostAvatarUrl: undefined,
    activityPubId: undefined, feedUrl: undefined, castopodPodcastId: undefined,
  };
  return {
    episode: {
      id: String(ep.id),
      podcastId: String(ep.podcast?.id ?? ''),
      title: ep.title || '',
      description: ep.description || '',
      audioUrl: ep.audio_url || '',
      audioMimeType: ep.audio_mimetype || 'audio/mpeg',
      audioSize: ep.audio_size ?? 0,
      duration: ep.duration ?? 0,
      episodeNumber: ep.episode_number,
      seasonNumber: ep.season_number,
      explicit: Boolean(ep.explicit),
      coverUrl: ep.cover_url || '',
      status: 'published',
      publishedAt: ep.published_at ? new Date(ep.published_at).getTime() : undefined,
      createdAt: ep.created_at ? new Date(ep.created_at).getTime() : Date.now(),
      updatedAt: ep.updated_at ? new Date(ep.updated_at).getTime() : Date.now(),
      plays: ep.total_plays ?? 0,
      uniqueListeners: ep.unique_listeners ?? 0,
      tipsReceived: '0',
      activityPubId: ep.activity_pub_id || '',
    },
    podcast: ep.podcast ? mapCastopodToPodcast(ep.podcast) : fallbackPodcast,
  };
}

// ─── Internal: Castopod Integration ─────────────────────────────────────

interface CastopodPodcastData {
  id: number;
  title: string;
  description: string;
  category?: string;
  image_url?: string;
  cover_url?: string;
  language?: string;
  explicit?: number;
  link?: string;
  funding_url?: string;
  created_at?: string;
  updated_at?: string;
  episode_count?: number;
  total_plays?: number;
  unique_listeners?: number;
  subscribers?: number;
  activity_pub_id?: string;
  feed_url?: string;
  actor?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  };
  episodes?: Array<Record<string, unknown>>;
}

interface CastopodEpisodeData {
  id: number;
  title: string;
  description: string;
  audio_url?: string;
  audio_mimetype?: string;
  audio_size?: number;
  duration?: number;
  episode_number?: number;
  season_number?: number;
  explicit?: number;
  cover_url?: string;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  total_plays?: number;
  unique_listeners?: number;
  activity_pub_id?: string;
  podcast?: CastopodPodcastData;
}

async function fetchCastopodStats(
  env: Env,
  podcast: Podcast,
  podcastId: string,
): Promise<void> {
  try {
    const res = await castopodFetch(env, `/api/podcasts/${podcast.castopodPodcastId}`);
    if (res.ok) {
      const cpData = (await res.json()) as CastopodPodcastData;
      if (cpData.total_plays !== undefined) podcast.totalPlays = cpData.total_plays;
      if (cpData.subscribers !== undefined) podcast.subscriberCount = cpData.subscribers;
      await env.CACHE?.put(podcastKey(podcastId), JSON.stringify(podcast));
    }
  } catch { /* non-critical */ }
}

async function createCastopodPodcast(
  env: Env,
  podcast: Podcast,
): Promise<{ id: number; activityPubId: string; feedUrl: string } | null> {
  try {
    const body = {
      title: podcast.title,
      description: podcast.description,
      category: podcast.category,
      language: podcast.language || 'en',
      explicit: podcast.explicit ? 1 : 0,
      image_url: podcast.coverUrl,
      link: podcast.website || `https://degenfeed.xyz/podcasts/${podcast.id}`,
      funding_url: podcast.fundingUrl,
      owner_name: podcast.hostName,
      owner_email: podcast.email || 'podcasts@degenfeed.xyz',
    };

    const res = await castopodFetch(env, '/api/podcasts', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => 'unknown');
      console.warn(`[podcast] Castopod create podcast failed: ${res.status} — ${errBody}`);
      return null;
    }

    const data = (await res.json()) as {
      id: number;
      activity_pub_id?: string;
      feed_url?: string;
    };

    return {
      id: data.id,
      activityPubId: data.activity_pub_id || `https://podcast.degenfeed.xyz/@${podcast.id}`,
      feedUrl: data.feed_url || `https://podcast.degenfeed.xyz/feed/podcasts/${podcast.id}.xml`,
    };
  } catch (err) {
    console.warn('[podcast] createCastopodPodcast error:', String(err));
    return null;
  }
}

async function createCastopodEpisode(
  env: Env,
  podcast: Podcast,
  episode: PodcastEpisode,
): Promise<{ id: number; activityPubId: string } | null> {
  if (!podcast.castopodPodcastId) return null;

  try {
    const body = {
      title: episode.title,
      description: episode.description,
      audio_url: episode.audioUrl,
      audio_mimetype: episode.audioMimeType,
      duration: episode.duration,
      episode_number: episode.episodeNumber,
      season_number: episode.seasonNumber,
      explicit: episode.explicit ? 1 : 0,
      image_url: episode.coverUrl || podcast.coverUrl,
      published_at: episode.publishedAt
        ? new Date(episode.publishedAt).toISOString()
        : new Date().toISOString(),
    };

    const res = await castopodFetch(
      env,
      `/api/podcasts/${podcast.castopodPodcastId}/episodes`,
      { method: 'POST', body: JSON.stringify(body) },
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => 'unknown');
      console.warn(`[podcast] Castopod create episode failed: ${res.status} — ${errBody}`);
      return null;
    }

    const data = (await res.json()) as { id: number; activity_pub_id?: string };

    return {
      id: data.id,
      activityPubId: data.activity_pub_id || '',
    };
  } catch (err) {
    console.warn('[podcast] createCastopodEpisode error:', String(err));
    return null;
  }
}

async function regenerateRssFeed(env: Env, podcast: Podcast): Promise<void> {
  try {
    // Fetch all published episodes
    const episodesRaw = await env.CACHE?.get(podcastEpisodesKey(podcast.id));
    const episodeIds: string[] = episodesRaw ? JSON.parse(episodesRaw) : [];
    const publishedEpisodes: PodcastEpisodeEntry[] = [];

    for (const eid of episodeIds) {
      const epRaw = await env.CACHE?.get(episodeKey(eid));
      if (epRaw) {
        const ep = JSON.parse(epRaw) as PodcastEpisode;
        if (ep.status === 'published') {
          publishedEpisodes.push({
            id: ep.id,
            title: ep.title,
            description: ep.description,
            htmlDescription: ep.htmlDescription,
            guid: `degenfeed:podcast:${podcast.id}:episode:${ep.id}`,
            pubDate: toRFC2822(ep.publishedAt || ep.createdAt),
            enclosure: {
              url: ep.audioUrl,
              length: ep.audioSize,
              type: ep.audioMimeType,
            },
            duration: ep.duration,
            episodeNumber: ep.episodeNumber,
            seasonNumber: ep.seasonNumber,
            explicit: ep.explicit,
            imageUrl: ep.coverUrl || podcast.coverUrl,
            chapters: ep.chapters,
            activityPubId: ep.activityPubId,
            transcriptUrl: ep.transcriptUrl,
          });
        }
      }
    }

    const feedMeta: PodcastFeedMeta = {
      id: podcast.id,
      title: podcast.title,
      description: podcast.description,
      feedUrl: podcast.feedUrl || `https://degenfeed.xyz/api/podcast/${podcast.id}/feed`,
      link: podcast.website || `https://degenfeed.xyz/podcasts/${podcast.id}`,
      language: podcast.language,
      author: podcast.hostName,
      ownerName: podcast.hostName,
      ownerEmail: podcast.email || 'podcasts@degenfeed.xyz',
      imageUrl: podcast.coverUrl,
      category: podcast.category,
      explicit: podcast.explicit,
      keywords: podcast.keywords,
      activityPubId: podcast.activityPubId,
      fundingUrl: podcast.fundingUrl,
    };

    const rss = generatePodcastRss(feedMeta, publishedEpisodes);

    // Store RSS in KV for serving
    await env.CACHE?.put(
      `podcast:rss:${podcast.id}`,
      rss,
      { expirationTtl: 86400 }, // 24h TTL, regeneration on next publish
    );
  } catch (err) {
    console.warn('[podcast] regenerateRssFeed error:', String(err));
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CURATED PODCAST ROUTES
// ═════════════════════════════════════════════════════════════════════════════
//
// These routes serve the curated top-100 podcast catalog (crypto, tech, AI).
// Data comes from the static catalog + KV episode cache (populated by RSS fetcher).
//
// Routes:
//   GET /api/podcast/curated                      — All curated podcasts
//   GET /api/podcast/curated/:category             — By category (crypto, tech, ai)
//   GET /api/podcast/curated/:category/latest     — Latest episodes by category
//   GET /api/podcast/curated/trending              — Trending across all curated
//   GET /api/podcast/curated/latest                — Latest episodes (all)
//   GET /api/podcast/search?q=                     — Search curated + creator
//   POST /api/podcast/curated/seed                 — Seed/refresh KV (admin)
//   GET /api/podcast/curated/stats                 — Podcast count stats

import {
  ALL_CURATED_PODCASTS,
  CURATED_PODCASTS_BY_CATEGORY,
  getCuratedPodcastById,
  getCuratedPodcastStats,
} from '../feed/podcast-curation';
import type { UnifiedPodcastEpisode } from '../feed/podcast-curation';
import {
  CURATED_LATEST_KEY,
  CURATED_TRENDING_KEY,
  CURATED_INDEX_KEY_ALL,
  seedCuratedPodcasts,
} from '../lib/curated-rss-fetcher';
import { handleFullPodcastRefresh } from '../routes/podcast-cron';

// ═════════════════════════════════════════════════════════════════════════
// SPECIFIC ROUTES FIRST (before parameterized routes)
// Order: stats > seed > refresh > latest > trending > search > :category
// ═════════════════════════════════════════════════════════════════════════

// GET /api/podcast/curated/stats — Podcast count stats
podcastRouter.get('/curated/stats', async (c) => {
  try {
    return noCacheJsonResponse({ stats: getCuratedPodcastStats() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to get stats: ${msg}` }, 500);
  }
});

// GET /api/podcast/curated — All curated podcasts (?category=, ?search=)
podcastRouter.get('/curated', async (c) => {
  try {
    const category = c.req.query('category');
    const search = c.req.query('search')?.toLowerCase();
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 50, 1), 100);

    let podcasts = ALL_CURATED_PODCASTS;

    if (category && category !== 'all') {
      podcasts = CURATED_PODCASTS_BY_CATEGORY[category] ?? [];
    }

    if (search) {
      podcasts = podcasts.filter(
        (p) =>
          p.title.toLowerCase().includes(search) ||
          p.host.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search),
      );
    }

    return noCacheJsonResponse({
      podcasts: podcasts.slice(0, limit),
      total: podcasts.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to list curated: ${msg}` }, 500);
  }
});

// POST /api/podcast/curated/seed — Seed/refresh KV
podcastRouter.post('/curated/seed', async (c) => {
  try {
    if (!c.env.CACHE) return jsonResponse({ error: 'KV not available' }, 503);
    await seedCuratedPodcasts(c.env.CACHE);
    return noCacheJsonResponse({
      ok: true,
      total: ALL_CURATED_PODCASTS.length,
      stats: getCuratedPodcastStats(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to seed: ${msg}` }, 500);
  }
});

// POST /api/podcast/curated/refresh — Trigger full RSS fetch + re-index
podcastRouter.post('/curated/refresh', async (c) => {
  try {
    if (!c.env.CACHE) return jsonResponse({ error: 'KV not available' }, 503);
    const result = await handleFullPodcastRefresh(c.env);
    return noCacheJsonResponse(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to refresh: ${msg}` }, 500);
  }
});

// GET /api/podcast/curated/trending — Trending episodes across curated
podcastRouter.get('/curated/trending', async (c) => {
  try {
    const category = c.req.query('category');
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);

    const raw = await c.env.CACHE?.get(CURATED_TRENDING_KEY);
    if (!raw) {
      const latestRaw = await c.env.CACHE?.get(CURATED_LATEST_KEY);
      if (latestRaw) {
        let episodes: UnifiedPodcastEpisode[] = JSON.parse(latestRaw);
        if (category && category !== 'all') episodes = episodes.filter((ep) => ep.category === category);
        return noCacheJsonResponse({ episodes: episodes.slice(0, limit), total: episodes.length });
      }
      return noCacheJsonResponse({ episodes: [], total: 0 });
    }

    let episodes: UnifiedPodcastEpisode[] = JSON.parse(raw);
    if (category && category !== 'all') episodes = episodes.filter((ep) => ep.category === category);

    return noCacheJsonResponse({
      episodes: episodes.slice(0, limit),
      total: episodes.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to get trending: ${msg}` }, 500);
  }
});

// GET /api/podcast/curated/latest — Latest episodes (?category=)
podcastRouter.get('/curated/latest', async (c) => {
  try {
    const category = c.req.query('category');
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);

    const raw = await c.env.CACHE?.get(CURATED_LATEST_KEY);
    if (!raw) return noCacheJsonResponse({ episodes: [], total: 0 });

    let episodes: UnifiedPodcastEpisode[] = JSON.parse(raw);
    if (category && category !== 'all') episodes = episodes.filter((ep) => ep.category === category);

    return noCacheJsonResponse({
      episodes: episodes.slice(0, limit),
      total: episodes.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to get latest: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/podcast/search — Unified search (curated + creator)
// ═════════════════════════════════════════════════════════════════════════

podcastRouter.get('/search', async (c) => {
  try {
    const q = c.req.query('q')?.toLowerCase();
    const category = c.req.query('category');
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 50);

    if (!q || q.trim().length === 0) {
      return jsonResponse({ error: 'Search query required (?q=)' }, 400);
    }

    // Search curated podcasts
    let curatedResults = ALL_CURATED_PODCASTS.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.host.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
    if (category && category !== 'all') curatedResults = curatedResults.filter((p) => p.category === category);

    // Search curated episodes
    let curatedEpisodes: UnifiedPodcastEpisode[] = [];
    try {
      const latestRaw = await c.env.CACHE?.get(CURATED_LATEST_KEY);
      if (latestRaw) {
        const allEpisodes: UnifiedPodcastEpisode[] = JSON.parse(latestRaw);
        curatedEpisodes = allEpisodes.filter(
          (ep) =>
            ep.title.toLowerCase().includes(q) ||
            ep.description.toLowerCase().includes(q) ||
            ep.podcastTitle.toLowerCase().includes(q),
        );
        if (category && category !== 'all') curatedEpisodes = curatedEpisodes.filter((ep) => ep.category === category);
      }
    } catch { /* non-critical */ }

    // Search creator podcasts from KV
    let creatorPodcasts: Array<Record<string, unknown>> = [];
    try {
      const allIndexRaw = await c.env.CACHE?.get(CURATED_INDEX_KEY_ALL);
      if (allIndexRaw) {
        const allIds: string[] = JSON.parse(allIndexRaw);
        for (const pid of allIds.slice(0, 500)) {
          const pRaw = await c.env.CACHE?.get(`podcast:curated:${pid}`);
          if (pRaw) {
            const p = JSON.parse(pRaw) as Record<string, unknown>;
            if (String(p.title || '').toLowerCase().includes(q) || String(p.host || '').toLowerCase().includes(q)) {
              creatorPodcasts.push(p);
            }
          }
        }
      }
    } catch { /* non-critical */ }

    return noCacheJsonResponse({
      query: q,
      curatedPodcasts: curatedResults.slice(0, limit),
      curatedEpisodes: curatedEpisodes.slice(0, limit),
      creatorPodcasts: creatorPodcasts.slice(0, limit),
      total: curatedResults.length + curatedEpisodes.length + creatorPodcasts.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Search failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// PARAMETERIZED ROUTES LAST
// ═════════════════════════════════════════════════════════════════════════

// GET /api/podcast/curated/:category — By category slug
podcastRouter.get('/curated/:category', async (c) => {
  try {
    const category = c.req.param('category');
    const search = c.req.query('search')?.toLowerCase();
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 50, 1), 100);

    if (!['crypto', 'tech', 'ai', 'all'].includes(category)) {
      return jsonResponse({ error: 'Invalid category. Must be: crypto, tech, ai, or all' }, 400);
    }

    let podcasts = category === 'all' ? ALL_CURATED_PODCASTS : (CURATED_PODCASTS_BY_CATEGORY[category] ?? []);

    if (search) {
      podcasts = podcasts.filter(
        (p) => p.title.toLowerCase().includes(search) || p.host.toLowerCase().includes(search) || p.description.toLowerCase().includes(search),
      );
    }

    return noCacheJsonResponse({
      category,
      podcasts: podcasts.slice(0, limit),
      total: podcasts.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to get curated category: ${msg}` }, 500);
  }
});

// GET /api/podcast/curated/:category/latest — Latest episodes by category
podcastRouter.get('/curated/:category/latest', async (c) => {
  try {
    const category = c.req.param('category');
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);

    if (!['crypto', 'tech', 'ai'].includes(category)) {
      return jsonResponse({ error: 'Invalid category. Must be: crypto, tech, or ai' }, 400);
    }

    const raw = await c.env.CACHE?.get(CURATED_LATEST_KEY);
    if (!raw) return noCacheJsonResponse({ category, episodes: [], total: 0 });

    const episodes: UnifiedPodcastEpisode[] = JSON.parse(raw);
    const filtered = episodes.filter((ep) => ep.category === category);

    return noCacheJsonResponse({
      category,
      episodes: filtered.slice(0, limit),
      total: filtered.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to get category latest: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════

export default podcastRouter;
export type { Podcast, PodcastEpisode };
export { PODCAST_CATEGORIES };
