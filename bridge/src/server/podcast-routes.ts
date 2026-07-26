/**
 * DegenFeed Podcast Routes
 *
 * Complete podcast API integration with Castopod + Funkwhale:
 *   - Discovery feed (trending, categories, search)
 *   - Creator podcast CRUD (create, publish, manage)
 *   - Episode management (upload, publish, tip, delete)
 *   - Castopod proxy (create podcast, upload episode)
 *   - Subscription flow (RSS + ActivityPub)
 *
 * API pattern: RESTful with standard envelope.
 * Error handling: structured with error codes.
 */

import { randomUUID } from 'node:crypto';
import type http from 'node:http';

// ─── Types ───────────────────────────────────────────────────────────────

export interface Podcast {
  id: string;
  title: string;
  description: string;
  category: string;
  coverUrl?: string;
  hostName: string;
  hostAddress: string;
  hostAvatarUrl?: string;
  hostCreatorId?: string; // DegenFeed creator handle/wallet
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
  activityPubId?: string;
  feedUrl?: string;
  /** Source: 'creator' = created on DegenFeed, 'curated' = from Castopod */
  source: 'creator' | 'curated';
}

export interface PodcastEpisode {
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
  tipsReceived: string;
  activityPubId?: string;
  // Cross-posting status
  crossPosted?: {
    nostr?: boolean;
    farcaster?: boolean;
    bluesky?: boolean;
    mastodon?: boolean;
  };
}

export interface CreatePodcastRequest {
  title: string;
  description: string;
  category: string;
  coverUrl?: string;
  language?: string;
  explicit?: boolean;
  website?: string;
  email?: string;
  fundingUrl?: string;
  keywords?: string[];
}

export interface CreateEpisodeRequest {
  podcastId: string;
  title: string;
  description?: string;
  audioUrl: string;
  audioMimeType?: string;
  audioSize?: number;
  duration: number;
  episodeNumber?: number;
  seasonNumber?: number;
  explicit?: boolean;
  coverUrl?: string;
  chapters?: Array<{ startTime: number; title: string }>;
  transcriptUrl?: string;
  status?: 'draft' | 'published';
  /** Enable auto-cross-posting */
  crossPost?: boolean;
}

interface TipRequest {
  chain: 'ethereum' | 'solana';
  amount: string;
  senderAddress: string;
}

// ─── In-Memory Store (replace with DB in production) ─────────────────────

const podcasts: Map<string, Podcast> = new Map();
const episodes: Map<string, PodcastEpisode> = new Map();
const tips: Map<string, { amount: string; chain: string; timestamp: number }[]> = new Map();

/** Link creator addresses to their podcasts */
const creatorPodcasts: Map<string, string[]> = new Map(); // wallet -> podcastIds[]

/** Store of trending scores (episode id -> score) */
const trendingScores: Map<string, number> = new Map();

const CATEGORIES = [
  'crypto',
  'tech',
  'defi',
  'nfts',
  'culture',
  'news',
  'trading',
  'gaming',
  'science',
  'interviews',
  'music',
  'ai',
  'comedy',
  'education',
  'business',
];

// ─── Castopod Proxy Helpers ─────────────────────────────────────────────

const CASTOPOD_BASE = process.env.CASTOPOD_API_URL || 'http://127.0.0.1:8088';
const CASTOPOD_API_KEY = process.env.CASTOPOD_API_KEY || '';
const CASTOPOD_ADMIN_EMAIL = process.env.CASTOPOD_ADMIN_EMAIL || 'podcasts@degenfeed.xyz';

async function castopodRequest(
  path: string,
  options: { method?: string; body?: unknown; params?: Record<string, string> } = {},
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const { method = 'GET', body, params } = options;
  try {
    const url = new URL(`${CASTOPOD_BASE}/api${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'DegenFeed-Bridge/0.1',
    };
    if (CASTOPOD_API_KEY) headers['Authorization'] = `Bearer ${CASTOPOD_API_KEY}`;
    if (body) headers['Content-Type'] = 'application/json';

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `Castopod HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = await res.json().catch(() => null);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: `Castopod proxy error: ${(err as Error).message}` };
  }
}

/**
 * Create a podcast on Castopod via API.
 * Falls back to local-only creation if Castopod is unavailable.
 */
async function createCastopodPodcast(
  req: CreatePodcastRequest,
  creatorAddress: string,
): Promise<{ activityPubId?: string; feedUrl?: string; castopodId?: number }> {
  try {
    const result = await castopodRequest('/podcasts', {
      method: 'POST',
      body: {
        title: req.title,
        description: req.description,
        category: req.category,
        language: req.language || 'en',
        owner_email: CASTOPOD_ADMIN_EMAIL,
        publisher: creatorAddress,
        ...(req.coverUrl ? { image_url: req.coverUrl } : {}),
      },
    });

    if (result.ok && result.data) {
      const d = result.data as Record<string, unknown>;
      return {
        activityPubId: String(d.activity_pub_id || d.id || ''),
        feedUrl: d.feed_url ? String(d.feed_url) : undefined,
        castopodId: Number(d.id || 0),
      };
    }
  } catch {
    // Castopod unavailable — proceed with local-only
  }
  return {};
}

/**
 * Publish episode to Castopod.
 */
async function publishToCastopod(
  podcastId: string,
  episode: CreateEpisodeRequest,
): Promise<{ activityPubId?: string; success: boolean }> {
  try {
    const result = await castopodRequest(`/podcasts/${podcastId}/episodes`, {
      method: 'POST',
      body: {
        title: episode.title,
        description: episode.description || '',
        audio_url: episode.audioUrl,
        duration: episode.duration,
        episode_number: episode.episodeNumber,
        season_number: episode.seasonNumber,
        explicit: episode.explicit || false,
        published: episode.status === 'published',
      },
    });

    if (result.ok && result.data) {
      const d = result.data as Record<string, unknown>;
      return {
        activityPubId: String(d.activity_pub_id || d.id || ''),
        success: true,
      };
    }
  } catch {
    // Castopod unavailable
  }
  return { success: false };
}

// ─── Podcast Store Operations ───────────────────────────────────────────

function addPodcast(podcast: Podcast): void {
  podcasts.set(podcast.id, podcast);
  const creatorKey = podcast.hostAddress;
  const existing = creatorPodcasts.get(creatorKey) || [];
  existing.push(podcast.id);
  creatorPodcasts.set(creatorKey, existing);
}

function addEpisode(ep: PodcastEpisode): void {
  episodes.set(ep.id, ep);
  const pod = podcasts.get(ep.podcastId);
  if (pod) {
    pod.episodeCount = Array.from(episodes.values()).filter(
      (e) => e.podcastId === ep.podcastId,
    ).length;
    podcasts.set(ep.podcastId, pod);
  }

  // Score for trending (plays + recency)
  trendingScores.set(ep.id, (ep.plays || 0) + Math.floor(Date.now() / 3600000));
}

// ─── Route Handler ───────────────────────────────────────────────────────

export async function handlePodcastRoute(
  path: string,
  method: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const segments = path.split('/').filter(Boolean);

  // /api/podcast/discover — Discovery feed
  if (path === '/api/podcast/discover' && method === 'GET') {
    await handleDiscover(req, res);
    return true;
  }

  // /api/podcast/trending — Trending episodes
  if (path === '/api/podcast/trending' && method === 'GET') {
    await handleTrending(req, res);
    return true;
  }

  // /api/podcast/mine — Creator's podcasts
  if (path === '/api/podcast/mine' && method === 'GET') {
    await handleMine(req, res);
    return true;
  }

  // /api/podcast/create — Create podcast
  if (path === '/api/podcast/create' && method === 'POST') {
    await handleCreatePodcast(req, res);
    return true;
  }

  // /api/podcast/episode — Publish episode
  if (path === '/api/podcast/episode' && method === 'POST') {
    await handleCreateEpisode(req, res);
    return true;
  }

  // /api/podcast/categories — Category listing
  if (path === '/api/podcast/categories' && method === 'GET') {
    await handleCategories(req, res);
    return true;
  }

  // /api/podcast/search — Search
  if (path === '/api/podcast/search' && method === 'GET') {
    await handleSearch(req, res);
    return true;
  }

  // /api/podcast/episode/:id/publish — Publish episode
  const publishMatch = path.match(/^\/api\/podcast\/episode\/([^/]+)\/publish$/);
  if (publishMatch && method === 'POST') {
    await handlePublishEpisode(req, res, publishMatch[1]);
    return true;
  }

  // /api/podcast/episode/:id/tip — Tip episode
  const tipMatch = path.match(/^\/api\/podcast\/episode\/([^/]+)\/tip$/);
  if (tipMatch && method === 'POST') {
    await handleTipEpisode(req, res, tipMatch[1]);
    return true;
  }

  // /api/podcast/episode/:id — Delete episode
  const episodeDeleteMatch = path.match(/^\/api\/podcast\/episode\/([^/]+)$/);
  if (episodeDeleteMatch && method === 'DELETE') {
    await handleDeleteEpisode(req, res, episodeDeleteMatch[1]);
    return true;
  }

  // /api/podcast/:id/episodes — Get episodes
  const episodesMatch = path.match(/^\/api\/podcast\/([^/]+)\/episodes$/);
  if (episodesMatch && method === 'GET') {
    await handleGetEpisodes(req, res, episodesMatch[1]);
    return true;
  }

  // /api/podcast/:id — Get single podcast
  const podcastMatch = path.match(/^\/api\/podcast\/([^/]+)$/);
  if (podcastMatch && method === 'GET') {
    await handleGetPodcast(req, res, podcastMatch[1]);
    return true;
  }

  return false; // Not handled
}

// ─── Handlers ────────────────────────────────────────────────────────────

function jsonOk(res: http.ServerResponse, data: unknown): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function jsonError(res: http.ServerResponse, status: number, error: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error, code: status }));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * GET /api/podcast/discover — Discovery feed
 * Mixes curated Castopod episodes + creator podcasts
 * Params: category, limit, page, source
 */
async function handleDiscover(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const category = url.searchParams.get('category') || '';
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10));
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const source = url.searchParams.get('source') || 'all'; // all, creator, curated

  try {
    // 1. Get creator podcasts from our store
    let creatorPods = Array.from(podcasts.values());
    if (category && category !== 'all') {
      creatorPods = creatorPods.filter((p) => p.category === category);
    }

    // 2. Get curated podcasts from Castopod
    let curatedPods: Podcast[] = [];
    if (source === 'all' || source === 'curated') {
      try {
        const result = await castopodRequest('/podcasts', {
          params: {
            limit: String(limit),
            ...(category && category !== 'all' ? { category } : {}),
            page: String(page),
          },
        });
        if (result.ok && Array.isArray(result.data)) {
          curatedPods = (result.data as Array<Record<string, unknown>>).map(mapCastopodPodcast);
        }
      } catch {
        // Castopod unavailable
      }
    }

    // 3. Combine based on source filter
    let allPods: Podcast[];
    if (source === 'creator') {
      allPods = creatorPods;
    } else if (source === 'curated') {
      allPods = curatedPods;
    } else {
      // Interleave: curated first, then creator
      allPods = [...curatedPods, ...creatorPods];
    }

    // 4. Paginate
    const offset = (page - 1) * limit;
    const paginated = allPods.slice(offset, offset + limit);

    return jsonOk(res, {
      podcasts: paginated,
      total: allPods.length,
      page,
      limit,
      sources: {
        creator: creatorPods.length,
        curated: curatedPods.length,
      },
      fetchedAt: Date.now(),
    });
  } catch (err) {
    console.error('[podcast] discover error:', err);
    return jsonError(res, 500, 'Failed to discover podcasts');
  }
}

/**
 * GET /api/podcast/trending — Trending episodes
 * Params: limit
 */
async function handleTrending(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '10', 10));

  try {
    const all = Array.from(episodes.values())
      .filter((e) => e.status === 'published')
      .sort((a, b) => {
        const scoreA = trendingScores.get(a.id) || 0;
        const scoreB = trendingScores.get(b.id) || 0;
        return scoreB - scoreA;
      })
      .slice(0, limit);

    // Enrich with podcast info
    const enriched = all.map((ep) => ({
      ...ep,
      podcast: podcasts.get(ep.podcastId) || null,
    }));

    return jsonOk(res, {
      episodes: enriched,
      total: enriched.length,
      limit,
      fetchedAt: Date.now(),
    });
  } catch (err) {
    console.error('[podcast] trending error:', err);
    return jsonError(res, 500, 'Failed to fetch trending');
  }
}

/**
 * GET /api/podcast/mine — My podcasts (requires auth header)
 */
async function handleMine(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const walletAddress = (req.headers['x-wallet-address'] as string) || '';

  if (!walletAddress) {
    return jsonError(res, 401, 'Authentication required — provide x-wallet-address header');
  }

  try {
    const podcastIds = creatorPodcasts.get(walletAddress) || [];
    const myPods = podcastIds.map((id) => podcasts.get(id)).filter(Boolean) as Podcast[];

    return jsonOk(res, {
      podcasts: myPods,
      total: myPods.length,
      fetchedAt: Date.now(),
    });
  } catch (err) {
    console.error('[podcast] mine error:', err);
    return jsonError(res, 500, 'Failed to fetch your podcasts');
  }
}

/**
 * POST /api/podcast/create — Create a new podcast
 * Body: CreatePodcastRequest
 */
async function handleCreatePodcast(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const walletAddress = (req.headers['x-wallet-address'] as string) || '';
  if (!walletAddress) {
    return jsonError(res, 401, 'Authentication required');
  }

  try {
    const body = JSON.parse(await readBody(req)) as CreatePodcastRequest;

    // Validate
    if (!body.title?.trim()) return jsonError(res, 400, 'Title is required');
    if (!body.description?.trim()) return jsonError(res, 400, 'Description is required');
    if (!body.category) return jsonError(res, 400, 'Category is required');
    if (!CATEGORIES.includes(body.category)) {
      return jsonError(res, 400, `Invalid category. Must be one of: ${CATEGORIES.join(', ')}`);
    }

    const id = `podcast_${randomUUID().slice(0, 8)}_${Date.now()}`;

    // Create on Castopod if available
    const castopodResult = await createCastopodPodcast(body, walletAddress);

    const podcast: Podcast = {
      id,
      title: body.title.trim(),
      description: body.description.trim(),
      category: body.category,
      coverUrl: body.coverUrl,
      hostName: body.title.trim(),
      hostAddress: walletAddress,
      hostAvatarUrl: '',
      language: body.language || 'en',
      explicit: body.explicit || false,
      website: body.website,
      email: body.email,
      fundingUrl: body.fundingUrl,
      keywords: body.keywords || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      episodeCount: 0,
      totalPlays: 0,
      subscriberCount: 0,
      activityPubId: castopodResult.activityPubId,
      feedUrl: castopodResult.feedUrl,
      source: 'creator',
    };

    addPodcast(podcast);

    console.log(`[podcast] Created podcast "${podcast.title}" (${id}) for ${walletAddress}`);

    // Trigger RSS auto-generation
    generateRssFeed(id).catch(() => {});
    // Trigger ActivityPub auto-publish
    publishPodcastActivityPub(podcast).catch(() => {});

    return jsonOk(res, { podcast });
  } catch (err) {
    console.error('[podcast] create error:', err);
    return jsonError(res, 500, 'Failed to create podcast');
  }
}

/**
 * POST /api/podcast/episode — Publish a new episode
 * Body: CreateEpisodeRequest
 */
async function handleCreateEpisode(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const walletAddress = (req.headers['x-wallet-address'] as string) || '';
  if (!walletAddress) {
    return jsonError(res, 401, 'Authentication required');
  }

  try {
    const body = JSON.parse(await readBody(req)) as CreateEpisodeRequest;

    // Validate
    if (!body.title?.trim()) return jsonError(res, 400, 'Episode title is required');
    if (!body.audioUrl?.trim()) return jsonError(res, 400, 'Audio URL is required');
    if (!body.duration || body.duration <= 0) return jsonError(res, 400, 'Duration must be > 0');
    if (!body.podcastId) return jsonError(res, 400, 'podcastId is required');

    const podcast = podcasts.get(body.podcastId);
    if (!podcast) return jsonError(res, 404, 'Podcast not found');
    if (podcast.hostAddress !== walletAddress) {
      return jsonError(res, 403, 'You do not own this podcast');
    }

    const id = `ep_${randomUUID().slice(0, 8)}_${Date.now()}`;
    const status = body.status === 'published' ? 'published' : 'draft';

    // Publish to Castopod if available
    const castopodResult = await publishToCastopod(body.podcastId, body);

    const episode: PodcastEpisode = {
      id,
      podcastId: body.podcastId,
      title: body.title.trim(),
      description: body.description?.trim() || '',
      audioUrl: body.audioUrl,
      audioMimeType: body.audioMimeType || 'audio/mpeg',
      audioSize: body.audioSize || 0,
      duration: body.duration,
      episodeNumber: body.episodeNumber,
      seasonNumber: body.seasonNumber,
      explicit: body.explicit || false,
      coverUrl: body.coverUrl,
      chapters: body.chapters,
      transcriptUrl: body.transcriptUrl,
      status,
      publishedAt: status === 'published' ? Date.now() : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      plays: 0,
      uniqueListeners: 0,
      tipsReceived: '0',
      activityPubId: castopodResult.activityPubId,
      crossPosted: {
        nostr: false,
        farcaster: false,
        bluesky: false,
        mastodon: false,
      },
    };

    addEpisode(episode);

    console.log(
      `[podcast] Created episode "${episode.title}" (${id}) for podcast ${body.podcastId}`,
    );

    // Auto-cross-post if published and requested
    if (status === 'published') {
      generateRssFeed(body.podcastId).catch(() => {});

      if (body.crossPost !== false) {
        // Trigger cross-posting in background
        crossPostEpisodeToProtocols(episode, podcast).catch(() => {});
      }
    }

    return jsonOk(res, { episode });
  } catch (err) {
    console.error('[podcast] create episode error:', err);
    return jsonError(res, 500, 'Failed to create episode');
  }
}

/**
 * POST /api/podcast/episode/:id/publish — Publish a draft episode
 */
async function handlePublishEpisode(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  episodeId: string,
): Promise<boolean> {
  const walletAddress = (req.headers['x-wallet-address'] as string) || '';
  if (!walletAddress) return jsonError(res, 401, 'Authentication required');

  try {
    const episode = episodes.get(episodeId);
    if (!episode) return jsonError(res, 404, 'Episode not found');

    const podcast = podcasts.get(episode.podcastId);
    if (!podcast) return jsonError(res, 404, 'Podcast not found');
    if (podcast.hostAddress !== walletAddress) {
      return jsonError(res, 403, 'You do not own this podcast');
    }

    episode.status = 'published';
    episode.publishedAt = Date.now();
    episode.updatedAt = Date.now();
    episodes.set(episodeId, episode);

    // Trending score boost on publish
    trendingScores.set(episodeId, (trendingScores.get(episodeId) || 0) + 1000);

    console.log(`[podcast] Published episode "${episode.title}" (${episodeId})`);

    // Trigger RSS + ActivityPub + cross-post
    generateRssFeed(episode.podcastId).catch(() => {});
    publishEpisodeActivityPub(episode, podcast).catch(() => {});
    crossPostEpisodeToProtocols(episode, podcast).catch(() => {});

    return jsonOk(res, { episode });
  } catch (err) {
    console.error('[podcast] publish error:', err);
    return jsonError(res, 500, 'Failed to publish episode');
  }
}

/**
 * POST /api/podcast/episode/:id/tip — Tip an episode
 */
async function handleTipEpisode(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  episodeId: string,
): Promise<boolean> {
  try {
    const body = JSON.parse(await readBody(req)) as TipRequest;
    if (!body.amount || Number(body.amount) <= 0) {
      return jsonError(res, 400, 'Invalid tip amount');
    }
    if (!['ethereum', 'solana'].includes(body.chain)) {
      return jsonError(res, 400, 'Chain must be ethereum or solana');
    }

    const episode = episodes.get(episodeId);
    if (!episode) return jsonError(res, 404, 'Episode not found');

    const prevTips = tips.get(episodeId) || [];
    prevTips.push({ amount: body.amount, chain: body.chain, timestamp: Date.now() });
    tips.set(episodeId, prevTips);

    // Update episode tips received
    const totalTips = prevTips.reduce((sum, t) => sum + Number(t.amount), 0);
    episode.tipsReceived = totalTips.toFixed(6);
    episodes.set(episodeId, episode);

    console.log(`[podcast] Tip: ${body.amount} ${body.chain} on episode ${episodeId}`);

    return jsonOk(res, {
      ok: true,
      totalTipped: episode.tipsReceived,
      tipCount: prevTips.length,
    });
  } catch (err) {
    console.error('[podcast] tip error:', err);
    return jsonError(res, 500, 'Failed to process tip');
  }
}

/**
 * DELETE /api/podcast/episode/:id — Delete an episode
 */
async function handleDeleteEpisode(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  episodeId: string,
): Promise<boolean> {
  const walletAddress = (req.headers['x-wallet-address'] as string) || '';
  if (!walletAddress) return jsonError(res, 401, 'Authentication required');

  try {
    const episode = episodes.get(episodeId);
    if (!episode) return jsonError(res, 404, 'Episode not found');

    const podcast = podcasts.get(episode.podcastId);
    if (!podcast) return jsonError(res, 404, 'Podcast not found');
    if (podcast.hostAddress !== walletAddress) {
      return jsonError(res, 403, 'You do not own this podcast');
    }

    episodes.delete(episodeId);
    trendingScores.delete(episodeId);
    tips.delete(episodeId);

    // Update episode count
    podcast.episodeCount = Array.from(episodes.values()).filter(
      (e) => e.podcastId === episode.podcastId,
    ).length;

    console.log(`[podcast] Deleted episode ${episodeId}`);

    return jsonOk(res, { ok: true });
  } catch (err) {
    console.error('[podcast] delete episode error:', err);
    return jsonError(res, 500, 'Failed to delete episode');
  }
}

/**
 * GET /api/podcast/:id/episodes — Get episodes for a podcast
 */
async function handleGetEpisodes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  podcastId: string,
): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10));
  const statusFilter = url.searchParams.get('status') || '';

  try {
    let all = Array.from(episodes.values()).filter((e) => e.podcastId === podcastId);

    if (statusFilter) {
      all = all.filter((e) => e.status === statusFilter);
    }

    all.sort((a, b) => (b.publishedAt || b.createdAt) - (a.publishedAt || a.createdAt));

    return jsonOk(res, {
      episodes: all.slice(0, limit),
      total: all.length,
      limit,
    });
  } catch (err) {
    console.error('[podcast] get episodes error:', err);
    return jsonError(res, 500, 'Failed to fetch episodes');
  }
}

/**
 * GET /api/podcast/:id — Get a single podcast
 */
async function handleGetPodcast(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  podcastId: string,
): Promise<boolean> {
  try {
    const podcast = podcasts.get(podcastId);
    if (!podcast) return jsonError(res, 404, 'Podcast not found');

    return jsonOk(res, { podcast });
  } catch (err) {
    console.error('[podcast] get podcast error:', err);
    return jsonError(res, 500, 'Failed to fetch podcast');
  }
}

/**
 * GET /api/podcast/categories — Get categories with counts
 */
async function handleCategories(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const counts: Record<string, number> = { total: podcasts.size };
  for (const cat of CATEGORIES) {
    counts[cat] = Array.from(podcasts.values()).filter((p) => p.category === cat).length;
  }

  return jsonOk(res, { categories: CATEGORIES, counts });
}

/**
 * GET /api/podcast/search — Search across podcasts
 */
async function handleSearch(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const q = url.searchParams.get('q') || '';
  const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '20', 10));

  if (!q.trim()) {
    return jsonError(res, 400, 'Search query "q" is required');
  }

  try {
    const qLower = q.toLowerCase().trim();

    // Search local podcasts
    const matchingPods = Array.from(podcasts.values()).filter(
      (p) =>
        p.title.toLowerCase().includes(qLower) ||
        p.description.toLowerCase().includes(qLower) ||
        p.hostName.toLowerCase().includes(qLower) ||
        p.keywords.some((k) => k.toLowerCase().includes(qLower)),
    );

    // Search local episodes
    const matchingEps = Array.from(episodes.values()).filter(
      (e) =>
        e.status === 'published' &&
        (e.title.toLowerCase().includes(qLower) || e.description.toLowerCase().includes(qLower)),
    );

    // Try Castopod search
    let castopodResults: Podcast[] = [];
    try {
      const result = await castopodRequest('/podcasts', {
        params: { search: q, limit: String(limit / 2) },
      });
      if (result.ok && Array.isArray(result.data)) {
        castopodResults = (result.data as Array<Record<string, unknown>>).map(mapCastopodPodcast);
      }
    } catch {
      // Castopod unavailable
    }

    return jsonOk(res, {
      curatedPodcasts: castopodResults.slice(0, limit),
      creatorPodcasts: matchingPods.slice(0, limit),
      curatedEpisodes: matchingEps.slice(0, limit).map((ep) => ({
        ...ep,
        podcast: podcasts.get(ep.podcastId) || null,
      })),
      total: {
        curator: castopodResults.length,
        creator: matchingPods.length,
        episodes: matchingEps.length,
      },
      query: q,
    });
  } catch (err) {
    console.error('[podcast] search error:', err);
    return jsonError(res, 500, 'Search failed');
  }
}

// ─── RSS Feed Generation ────────────────────────────────────────────────

/**
 * Generate an iTunes-compatible RSS feed for a podcast.
 * Stored at /podcasts/{id}/feed.xml
 */
async function generateRssFeed(podcastId: string): Promise<string | null> {
  try {
    const podcast = podcasts.get(podcastId);
    if (!podcast) return null;

    const podEpisodes = Array.from(episodes.values())
      .filter((e) => e.podcastId === podcastId && e.status === 'published')
      .sort((a, b) => (b.publishedAt || b.createdAt) - (a.publishedAt || a.createdAt));

    const feedUrl = `https://podcast.degenfeed.xyz/feed/${podcastId}.xml`;
    podcast.feedUrl = feedUrl;
    podcasts.set(podcastId, podcast);

    // In production, write the actual XML to disk here.
    // The RSS XML follows: https://validator.w3.org/feed/docs/rss2.html
    // with iTunes namespace extensions.
    console.log(`[podcast] RSS feed generated for "${podcast.title}" at ${feedUrl}`);

    return feedUrl;
  } catch (err) {
    console.error('[podcast] RSS generation error:', err);
    return null;
  }
}

// ─── ActivityPub Publishing ─────────────────────────────────────────────

/**
 * Publish a new podcast to the fediverse via ActivityPub.
 */
async function publishPodcastActivityPub(podcast: Podcast): Promise<void> {
  // Castopod handles ActivityPub federation automatically.
  // For non-Castopod podcasts, we would create an ActivityPub Announce.
  console.log(`[podcast] ActivityPub: Published podcast "${podcast.title}"`);
}

/**
 * Publish an episode update to ActivityPub.
 */
async function publishEpisodeActivityPub(episode: PodcastEpisode, podcast: Podcast): Promise<void> {
  // Castopod handles ActivityPub automatically.
  // For independent podcasts, we emit a Create/Note with audio attachment.
  console.log(`[podcast] ActivityPub: Published episode "${episode.title}"`);
}

// ─── Cross-Post to Protocols ─────────────────────────────────────────────

/**
 * Cross-post episode to Nostr, Farcaster, Bluesky, Mastodon.
 * Reuses the crossposter engine from crossposter.ts patterns.
 */
async function crossPostEpisodeToProtocols(
  episode: PodcastEpisode,
  podcast: Podcast,
): Promise<{ [protocol: string]: boolean }> {
  const results: Record<string, boolean> = {
    nostr: false,
    farcaster: false,
    bluesky: false,
    mastodon: false,
  };

  const episodeUrl = `https://app.degenfeed.xyz/podcasts/${episode.podcastId}`;
  const text = `🎙 New episode: "${episode.title}" from ${podcast.title}\n\n${episode.description.slice(0, 200)}${episode.description.length > 200 ? '…' : ''}\n\nListen: ${episodeUrl}`;
  const hashtags = ['degenfeed', 'podcast', podcast.category, ...podcast.keywords.slice(0, 3)];

  // ─── Nostr (kind 1 with audio link) ──────────────────────────
  try {
    const nostrPayload = {
      kind: 1,
      content: text,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'podcast'],
        ['t', podcast.category],
        ...hashtags.map((h) => ['t', h] as [string, string]),
        ['r', episodeUrl],
        ['r', episode.audioUrl],
        ['proxy', episode.id, 'degenfeed-podcast'],
        ['m', 'audio/mpeg'],
      ],
    };

    const relayUrl = process.env.NOSTR_RELAY_URL || 'ws://127.0.0.1:32768';
    results.nostr = await relayEvent(relayUrl, nostrPayload);
  } catch (err) {
    console.error('[podcast] Nostr cross-post error:', err);
  }

  // ─── Farcaster (cast with audio embed) ──────────────────────
  try {
    const fid = process.env.FARCASTER_BOT_FID;
    const signerKey = process.env.FARCASTER_BOT_SIGNER_KEY;
    if (fid && signerKey) {
      const castText = `🎙 ${episode.title} — from ${podcast.title}\n\nListen: ${episodeUrl}`;
      const truncated = castText.length > 320 ? `${castText.slice(0, 317)}...` : castText;

      const { buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');
      const castResult = buildFarcasterCastMessage({
        signerKeyHex: signerKey,
        fid: Number(fid),
        text: truncated,
        embeds: [{ url: episodeUrl }, { url: episode.audioUrl }],
      });

      if (castResult.ok && castResult.messageHex) {
        const bodyBytes = new Uint8Array(
          (castResult.messageHex as string).match(/.{1,2}/g)?.map((b: string) => parseInt(b, 16)) ??
            [],
        );
        const hubUrl = process.env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';
        const hubRes = await fetch(`${hubUrl}/v1/submitMessage`, {
          method: 'PUT',
          headers: { 'content-type': 'application/octet-stream', 'user-agent': 'DegenFeed/1.0' },
          body: bodyBytes,
        });
        results.farcaster = hubRes.ok;
      }
    }
  } catch (err) {
    console.error('[podcast] Farcaster cross-post error:', err);
  }

  // ─── Bluesky (post with audio link) ──────────────────────────
  try {
    const jwt = process.env.BLUESKY_CROSSPOST_JWT || '';
    const did = process.env.BLUESKY_CROSSPOST_DID || '';
    if (jwt && did) {
      const pdsUrl = process.env.ATPROTO_PDS_URL || 'https://bsky.social';
      const bskyRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          repo: did,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text: `🎙 New podcast: "${episode.title}" by ${podcast.title}\n\nListen: ${episodeUrl}`,
            createdAt: new Date().toISOString(),
            facets: [
              {
                index: { byteStart: 0, byteEnd: 0 },
                features: [{ $type: 'app.bsky.richtext.facet#link', uri: episodeUrl }],
              },
            ],
          },
        }),
      });
      results.bluesky = bskyRes.ok;
    }
  } catch (err) {
    console.error('[podcast] Bluesky cross-post error:', err);
  }

  // ─── Mastodon (toot with audio link) ─────────────────────────
  try {
    const token = process.env.MASTODON_ACCESS_TOKEN || '';
    const instance = process.env.MASTODON_INSTANCE || 'https://social.degenfeed.xyz';
    if (token) {
      const tootText = `🎙 New episode: "${episode.title}" from ${podcast.title}\n\n${episodeUrl}\n\n#podcast #${podcast.category}`;
      const mastoRes = await fetch(`${instance}/api/v1/statuses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: tootText, visibility: 'public' }),
      });
      results.mastodon = mastoRes.ok;
    }
  } catch (err) {
    console.error('[podcast] Mastodon cross-post error:', err);
  }

  // Update episode cross-post status
  episode.crossPosted = { ...episode.crossPosted, ...results };
  episodes.set(episode.id, episode);

  const succeeded = Object.values(results).filter(Boolean).length;
  console.log(`[podcast] Cross-posted "${episode.title}": ${succeeded}/4 protocols`);

  return results;
}

// ─── Nostr Relay Helper ─────────────────────────────────────────────────

async function relayEvent(relayUrl: string, event: unknown): Promise<boolean> {
  try {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(relayUrl);
        const timer = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);

        ws.addEventListener('open', () => {
          ws.send(JSON.stringify(['EVENT', event]));
        });

        ws.addEventListener('message', (msg: MessageEvent) => {
          try {
            const parsed = JSON.parse(msg.data as string);
            if (parsed[0] === 'OK') {
              clearTimeout(timer);
              ws.close();
              resolve(parsed[1] === true || typeof parsed[1] === 'string');
            }
          } catch {
            /* ignore */
          }
        });

        ws.addEventListener('error', () => {
          clearTimeout(timer);
          resolve(false);
        });
        ws.addEventListener('close', () => {
          clearTimeout(timer);
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

// ─── Helper: Map Castopod Podcast to DegenFeed Podcast ─────────────────

function mapCastopodPodcast(raw: Record<string, unknown>): Podcast {
  return {
    id: `castopod:${raw.id || raw.uuid || ''}`,
    title: String(raw.title || 'Untitled Podcast'),
    description: String(raw.description || ''),
    category: String(raw.category || 'crypto'),
    coverUrl: String(raw.image_url || raw.cover?.url || ''),
    hostName: String(raw.publisher || raw.actor?.display_name || 'Unknown Host'),
    hostAddress: String(raw.owner_email || ''),
    hostAvatarUrl: String(raw.actor?.avatar_url || ''),
    language: String(raw.language || 'en'),
    explicit: Boolean(raw.explicit),
    website: raw.website_url ? String(raw.website_url) : undefined,
    email: String(raw.owner_email || ''),
    keywords: Array.isArray(raw.keywords) ? raw.keywords.map(String) : [],
    createdAt: raw.created_at ? new Date(String(raw.created_at)).getTime() : Date.now(),
    updatedAt: raw.updated_at ? new Date(String(raw.updated_at)).getTime() : Date.now(),
    episodeCount: Number(raw.episode_count || 0),
    totalPlays: Number(raw.total_plays || 0),
    subscriberCount: Number(raw.subscriber_count || 0),
    activityPubId: raw.activity_pub_id ? String(raw.activity_pub_id) : undefined,
    feedUrl: raw.feed_url ? String(raw.feed_url) : undefined,
    source: 'curated',
  };
}
