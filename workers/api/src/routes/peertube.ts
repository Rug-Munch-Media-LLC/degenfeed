/**
 * @degenfeed/api-worker — PeerTube Video Platform Routes
 *
 * Full PeerTube integration for the DegenFeed API worker.
 * Routes bridge the frontend to our self-hosted PeerTube instance
 * at https://video.degenfeed.xyz (internal: 127.0.0.1:9011).
 *
 * Routes:
 *   Videos:
 *     POST   /api/peertube/upload         — Upload a video
 *     GET    /api/peertube/videos          — List videos (search, category, sort)
 *     GET    /api/peertube/videos/:id      — Get video details
 *     POST   /api/peertube/videos/:id/rate — Like/dislike a video
 *
 *   Channels:
 *     GET    /api/peertube/channels        — List channels
 *     POST   /api/peertube/channels        — Create a channel
 *
 *   Live Streams:
 *     POST   /api/peertube/live/create     — Create a live stream
 *     GET    /api/peertube/live/active      — List active live streams
 *     GET    /api/peertube/live/:id/viewers — Live viewer count
 *     POST   /api/peertube/live/:id/chat    — Post a chat message
 *     GET    /api/peertube/live/:id/chat    — Get chat messages
 *
 *   Federation:
 *     GET    /api/peertube/federation/following  — Instances we follow
 *     GET    /api/peertube/federation/followers  — Instances following us
 *     GET    /api/peertube/federation/stats      — Federation health stats
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';

// ─── Type Imports from SDK ─────────────────────────────────────────

interface PeerTubeVideo {
  id: number;
  uuid: string;
  shortUUID?: string;
  name: string;
  description?: string;
  shortDescription?: string;
  isLive: boolean;
  duration: number;
  views: number;
  likes: number;
  dislikes: number;
  publishedAt: string;
  updatedAt: string;
  category?: { id: number; label: string } | null;
  licence?: { id: number; label: string } | null;
  language?: { id: number; label: string } | null;
  privacy?: { id: number; label: string };
  nsfw: boolean;
  url: string;
  thumbnailPath: string | null;
  previewPath: string | null;
  embedPath: string;
  tags: string[];
  channel?: {
    id: number;
    name: string;
    displayName: string;
    url: string;
    avatar: { path: string } | null;
  } | null;
  account?: {
    id: number;
    name: string;
    displayName: string;
    url: string;
    avatar: { path: string } | null;
  } | null;
  files?: Array<{
    id: number;
    resolution: { id: number; label: string };
    size: number;
    fileUrl: string;
  }>;
  liveInfo?: {
    viewerCount: number;
    health: 'good' | 'bad' | 'unknown';
    state: 'waiting' | 'live' | 'ended' | 'error';
  };
}

interface PeerTubeChannel {
  id: number;
  name: string;
  displayName: string;
  description: string;
  support?: string;
  url: string;
  avatar: { path: string } | null;
  videosCount: number;
  viewsCount: number;
  followersCount: number;
  createdAt: string;
  ownerAccount?: {
    id: number;
    name: string;
    displayName: string;
    url: string;
  } | null;
}

interface PaginatedResponse<T> {
  total: number;
  data: T[];
}

// ─── Constants ─────────────────────────────────────────────────────

const PEERTUBE_DEFAULT = 'https://video.degenfeed.xyz';

const PEERTUBE_CATEGORIES: Record<number, string> = {
  1: 'Music',
  2: 'Films',
  3: 'Comics',
  4: 'Books',
  5: 'Science & Technology',
  6: 'Sports',
  7: 'Lifestyle',
  8: 'Art',
  9: 'Gaming',
  10: 'Entertainment',
  11: 'News & Politics',
  12: 'Education',
  13: 'Tech',
  14: 'Crypto & Web3',
};

// ─── Auth Helpers ─────────────────────────────────────────────────

async function getPeerTubeClient(env: Env): Promise<{ instanceUrl: string; accessToken: string }> {
  const instanceUrl = env.PEERTUBE_INSTANCE_URL ?? PEERTUBE_DEFAULT;

  // Check cached token
  const cached = await env.CACHE?.get('peertube:access_token_v2');
  if (cached) {
    const parsed = JSON.parse(cached) as { token: string; expiresAt: number };
    if (parsed.expiresAt > Date.now()) {
      return { instanceUrl, accessToken: parsed.token };
    }
  }

  // Get new token
  const clientId = env.PEERTUBE_CLIENT_ID;
  const clientSecret = env.PEERTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PEERTUBE_CLIENT_ID and PEERTUBE_CLIENT_SECRET must be set');
  }

  const tokenUrl = `${instanceUrl}/api/v1/oauth/token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'manage:videos manage:channels manage:live',
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown');
    throw new Error(`PeerTube OAuth failed: ${response.status} — ${body}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in?: number };
  const accessToken = data.access_token;
  const expiresIn = data.expires_in ?? 3600;
  const expiresAt = Date.now() + expiresIn * 1000 - 300000; // 5 min buffer

  await env.CACHE?.put(
    'peertube:access_token_v2',
    JSON.stringify({ token: accessToken, expiresAt }),
    { expirationTtl: expiresIn },
  );

  return { instanceUrl, accessToken };
}

async function peertubeFetch(
  env: Env,
  path: string,
  options: RequestInit & { params?: Record<string, string | number | boolean | undefined> } = {},
): Promise<Response> {
  const { instanceUrl, accessToken } = await getPeerTubeClient(env);
  const base = instanceUrl.replace(/\/$/, '');

  let url = `${base}${path}`;
  if (options.params) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers = new Headers(options.headers);
  headers.set('authorization', `Bearer ${accessToken}`);
  headers.set('accept', 'application/json');
  headers.set('user-agent', 'DegenFeed/1.0');

  if (options.body && typeof options.body === 'string' && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return fetch(url, { ...options, headers });
}

// ─── Category Helpers ──────────────────────────────────────────────

function getCategoryLabel(id: number | null | undefined): string {
  if (id == null) return 'Uncategorized';
  return PEERTUBE_CATEGORIES[id] ?? `Category ${id}`;
}

function mapVideoForResponse(video: PeerTubeVideo, instanceUrl: string) {
  return {
    id: video.uuid || String(video.id),
    numericId: video.id,
    title: video.name,
    description: video.description ?? '',
    shortDescription: video.shortDescription ?? '',
    url: video.url,
    embedUrl: video.embedPath
      ? `${instanceUrl}${video.embedPath}`
      : `${instanceUrl}/videos/embed/${video.uuid}`,
    thumbnailUrl: video.thumbnailPath ? `${instanceUrl}${video.thumbnailPath}` : null,
    previewUrl: video.previewPath ? `${instanceUrl}${video.previewPath}` : null,
    duration: video.duration,
    views: video.views,
    likes: video.likes,
    dislikes: video.dislikes,
    isLive: video.isLive,
    nsfw: video.nsfw,
    publishedAt: video.publishedAt,
    category: video.category ?? null,
    categoryLabel: getCategoryLabel(video.category?.id),
    tags: video.tags ?? [],
    channel: video.channel
      ? {
          id: video.channel.id,
          name: video.channel.name,
          displayName: video.channel.displayName,
          url: video.channel.url,
          avatarUrl: video.channel.avatar?.path
            ? `${instanceUrl}${video.channel.avatar.path}`
            : null,
        }
      : null,
    account: video.account
      ? {
          id: video.account.id,
          name: video.account.name,
          displayName: video.account.displayName,
          url: video.account.url,
          avatarUrl: video.account.avatar?.path
            ? `${instanceUrl}${video.account.avatar.path}`
            : null,
        }
      : null,
    liveInfo: video.liveInfo ?? null,
    files:
      video.files?.map((f) => ({
        resolution: f.resolution.label,
        size: f.size,
        fileUrl: f.fileUrl,
      })) ?? [],
  };
}

function mapChannelForResponse(channel: PeerTubeChannel, instanceUrl: string) {
  return {
    id: channel.id,
    name: channel.name,
    displayName: channel.displayName,
    description: channel.description,
    support: channel.support ?? '',
    url: channel.url,
    avatarUrl: channel.avatar?.path ? `${instanceUrl}${channel.avatar.path}` : null,
    videosCount: channel.videosCount,
    viewsCount: channel.viewsCount,
    followersCount: channel.followersCount,
    createdAt: channel.createdAt,
    owner: channel.ownerAccount
      ? {
          name: channel.ownerAccount.displayName,
          url: channel.ownerAccount.url,
        }
      : null,
  };
}

// ─── Router ────────────────────────────────────────────────────────

const peertubeRouter = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════════════
// VIDEOS
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/peertube/upload
 * Upload a video to our PeerTube instance.
 * Accepts multipart form data with video file, thumbnail, and metadata.
 */
peertubeRouter.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const videoFile = formData.get('videofile') as File | null;
    if (!videoFile) {
      return jsonResponse({ error: 'videofile is required' }, 400);
    }

    const name = (formData.get('name') as string)?.trim();
    if (!name) {
      return jsonResponse({ error: 'name is required' }, 400);
    }

    const { instanceUrl, accessToken } = await getPeerTubeClient(c.env);

    // Build a new FormData for PeerTube
    const ptForm = new FormData();
    ptForm.append('videofile', videoFile, videoFile.name);
    ptForm.append('name', name.slice(0, 120));
    ptForm.append('privacy', (formData.get('privacy') as string) ?? '1');
    ptForm.append('commentsEnabled', (formData.get('commentsEnabled') as string) ?? 'true');
    ptForm.append('downloadEnabled', (formData.get('downloadEnabled') as string) ?? 'false');
    ptForm.append('nsfw', (formData.get('nsfw') as string) ?? 'false');
    ptForm.append('waitTranscoding', 'true');

    const description = formData.get('description') as string;
    if (description) ptForm.append('description', description);

    const category = formData.get('category') as string;
    if (category) ptForm.append('category', category);

    const language = formData.get('language') as string;
    if (language) ptForm.append('language', language);

    const tags = formData.get('tags') as string;
    if (tags) {
      for (const tag of tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5)) {
        ptForm.append('tags', tag);
      }
    }
    ptForm.append('tags', 'degenfeed');

    const thumbnailFile = formData.get('thumbnailfile') as File | null;
    if (thumbnailFile) ptForm.append('thumbnailfile', thumbnailFile);

    // Add DegenFeed plugin metadata
    ptForm.append(
      'pluginData',
      JSON.stringify({
        degenfeed: {
          platform: 'degenfeed',
          version: '1.0',
        },
      }),
    );

    // Channel association
    const channelId = formData.get('channelId') as string;
    if (channelId) {
      ptForm.append('channelId', channelId);
    } else {
      // Use default channel — first channel for the root account
      ptForm.append('channelId', '1');
    }

    const uploadUrl = `${instanceUrl}/api/v1/videos/upload`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'user-agent': 'DegenFeed/1.0',
      },
      body: ptForm,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'unknown');
      return jsonResponse(
        { error: `PeerTube upload failed: ${response.status} — ${errBody}` },
        response.status,
      );
    }

    const result = (await response.json()) as {
      video: {
        id: number;
        uuid: string;
        shortUUID: string;
        name: string;
        url: string;
        embedPath: string;
      };
    };

    return noCacheJsonResponse(
      {
        video: {
          uuid: result.video.uuid,
          shortUUID: result.video.shortUUID,
          name: result.video.name,
          url: result.video.url,
          embedUrl: `${instanceUrl}${result.video.embedPath}`,
          embedCode: `<iframe width="560" height="315" src="${instanceUrl}${result.video.embedPath}" title="${result.video.name}" frameborder="0" allowfullscreen></iframe>`,
          id: result.video.id,
        },
      },
      201,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Upload failed: ${msg}` }, 500);
  }
});

/**
 * GET /api/peertube/videos
 * List videos with search, category, and sort filters.
 */
peertubeRouter.get('/videos', async (c) => {
  try {
    const query = {
      search: c.req.query('search'),
      categoryOneOf: c.req.query('category'),
      isLive: c.req.query('isLive'),
      sort: c.req.query('sort') ?? '-publishedAt',
      start: c.req.query('start') ?? '1',
      count: c.req.query('count') ?? '20',
      nsfw: c.req.query('nsfw'),
      tagsOneOf: c.req.query('tags'),
    };

    const response = await peertubeFetch(c.env, '/api/v1/videos', {
      params: query as Record<string, string | number | boolean | undefined>,
    });

    const data = (await response.json()) as PaginatedResponse<PeerTubeVideo>;
    const { instanceUrl } = await getPeerTubeClient(c.env);

    return noCacheJsonResponse({
      total: data.total,
      data: data.data.map((v) => mapVideoForResponse(v, instanceUrl)),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to list videos: ${msg}` }, 500);
  }
});

/**
 * GET /api/peertube/videos/:id
 * Get detailed video info by UUID or numeric ID.
 */
peertubeRouter.get('/videos/:id', async (c) => {
  try {
    const videoId = c.req.param('id');
    const response = await peertubeFetch(c.env, `/api/v1/videos/${videoId}`);
    const video = (await response.json()) as PeerTubeVideo;
    const { instanceUrl } = await getPeerTubeClient(c.env);

    return noCacheJsonResponse({ video: mapVideoForResponse(video, instanceUrl) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to get video: ${msg}` }, 500);
  }
});

/**
 * POST /api/peertube/videos/:id/rate
 * Like or dislike a video.
 * Body: { rating: 'like' | 'dislike' }
 */
peertubeRouter.post('/videos/:id/rate', async (c) => {
  try {
    const videoId = c.req.param('id');
    const body = (await c.req.json()) as { rating?: string };

    if (!body.rating || !['like', 'dislike'].includes(body.rating)) {
      return jsonResponse({ error: 'rating must be "like" or "dislike"' }, 400);
    }

    await peertubeFetch(c.env, `/api/v1/videos/${videoId}/rate`, {
      method: 'PUT',
      body: JSON.stringify({ rating: body.rating }),
    });

    return jsonResponse({ ok: true, rating: body.rating });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to rate video: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// CHANNELS
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/peertube/channels
 * List video channels.
 */
peertubeRouter.get('/channels', async (c) => {
  try {
    const query = {
      start: c.req.query('start') ?? '1',
      count: c.req.query('count') ?? '20',
      sort: c.req.query('sort') ?? '-updatedAt',
    };

    const response = await peertubeFetch(c.env, '/api/v1/video-channels', {
      params: query as Record<string, string | number | boolean | undefined>,
    });

    const data = (await response.json()) as PaginatedResponse<PeerTubeChannel>;
    const { instanceUrl } = await getPeerTubeClient(c.env);

    return noCacheJsonResponse({
      total: data.total,
      data: data.data.map((ch) => mapChannelForResponse(ch, instanceUrl)),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to list channels: ${msg}` }, 500);
  }
});

/**
 * POST /api/peertube/channels
 * Create a new video channel.
 * Body: { name, displayName, description?, support? }
 */
peertubeRouter.post('/channels', async (c) => {
  try {
    const body = (await c.req.json()) as {
      name?: string;
      displayName?: string;
      description?: string;
      support?: string;
    };

    if (!body.name || !body.displayName) {
      return jsonResponse({ error: 'name and displayName are required' }, 400);
    }

    const response = await peertubeFetch(c.env, '/api/v1/video-channels', {
      method: 'POST',
      body: JSON.stringify({
        name: body.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .slice(0, 32),
        displayName: body.displayName,
        description: body.description ?? '',
        support: body.support ?? '',
      }),
    });

    const channel = (await response.json()) as PeerTubeChannel;
    const { instanceUrl } = await getPeerTubeClient(c.env);

    return noCacheJsonResponse({ channel: mapChannelForResponse(channel, instanceUrl) }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to create channel: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// LIVE STREAMS
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/peertube/live/create
 * Create a live stream.
 * Body: { channelId, name, description?, privacy?, category?, tags?, saveReplay? }
 */
peertubeRouter.post('/live/create', async (c) => {
  try {
    const body = (await c.req.json()) as {
      channelId?: number;
      name?: string;
      description?: string;
      privacy?: number;
      category?: number;
      tags?: string[];
      saveReplay?: boolean;
    };

    if (!body.channelId || !body.name) {
      return jsonResponse({ error: 'channelId and name are required' }, 400);
    }

    const { instanceUrl, accessToken } = await getPeerTubeClient(c.env);

    const createBody = {
      channelId: body.channelId,
      name: body.name.trim().slice(0, 120),
      description: body.description ?? '',
      privacy: body.privacy ?? 1,
      category: body.category ?? 13,
      tags: [...(body.tags ?? []), 'degenfeed', 'live'].slice(0, 5),
      commentsEnabled: true,
      downloadEnabled: false,
      nsfw: false,
      saveReplay: body.saveReplay ?? true,
      pluginData: {
        degenfeed: { platform: 'degenfeed', version: '1.0', isLive: true },
      },
    };

    // Create the live video
    const createUrl = `${instanceUrl}/api/v1/videos/live-streams`;
    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        'user-agent': 'DegenFeed/1.0',
      },
      body: JSON.stringify(createBody),
    });

    if (!createResponse.ok) {
      const errBody = await createResponse.text().catch(() => 'unknown');
      return jsonResponse(
        { error: `PeerTube live create failed: ${createResponse.status} — ${errBody}` },
        createResponse.status,
      );
    }

    const result = (await createResponse.json()) as {
      video: {
        id: number;
        uuid: string;
        shortUUID: string;
        name: string;
        url: string;
        embedPath: string;
      };
      liveSession?: { id: number; rtmpUrl?: string; streamKey?: string };
    };

    // Create live session if needed
    let streamKey: string | null = null;
    let rtmpUrl: string | null = null;

    if (result.liveSession?.streamKey) {
      streamKey = result.liveSession.streamKey;
      rtmpUrl = result.liveSession.rtmpUrl ?? `${instanceUrl}/live`;
    } else {
      try {
        const sessionUrl = `${instanceUrl}/api/v1/videos/${result.video.id}/live-session`;
        const sessionResponse = await fetch(sessionUrl, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
            'user-agent': 'DegenFeed/1.0',
          },
          body: JSON.stringify({}),
        });

        if (sessionResponse.ok) {
          const session = (await sessionResponse.json()) as {
            rtmpUrl?: string;
            streamKey?: string;
          };
          streamKey = session.streamKey ?? null;
          rtmpUrl = session.rtmpUrl ?? `${instanceUrl}/live`;
        }
      } catch {
        // Session creation best-effort
      }
    }

    return noCacheJsonResponse(
      {
        stream: {
          id: result.video.id,
          uuid: result.video.uuid,
          title: result.video.name,
          url: result.video.url,
          embedUrl: `${instanceUrl}${result.video.embedPath}`,
          embedCode: `<iframe width="560" height="315" src="${instanceUrl}${result.video.embedPath}" title="${result.video.name}" frameborder="0" allowfullscreen></iframe>`,
          streamKey,
          rtmpUrl,
          rtmpEndpoint: rtmpUrl ? `${rtmpUrl}/${streamKey}` : null,
        },
      },
      201,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to create live stream: ${msg}` }, 500);
  }
});

/**
 * GET /api/peertube/live/active
 * List currently active live streams.
 */
peertubeRouter.get('/live/active', async (c) => {
  try {
    const query = {
      isLive: 'true',
      start: c.req.query('start') ?? '1',
      count: c.req.query('count') ?? '20',
      sort: '-publishedAt',
    };

    const response = await peertubeFetch(c.env, '/api/v1/videos', {
      params: query as Record<string, string | number | boolean | undefined>,
    });

    const data = (await response.json()) as PaginatedResponse<PeerTubeVideo>;
    const { instanceUrl } = await getPeerTubeClient(c.env);

    return noCacheJsonResponse({
      total: data.total,
      streams: data.data.map((v) => ({
        ...mapVideoForResponse(v, instanceUrl),
        viewers: v.liveInfo?.viewerCount ?? 0,
        streamHealth: v.liveInfo?.health ?? 'unknown',
        streamState: v.liveInfo?.state ?? 'unknown',
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to list live streams: ${msg}` }, 500);
  }
});

/**
 * GET /api/peertube/live/:id/viewers
 * Get live viewer count for a specific stream.
 */
peertubeRouter.get('/live/:id/viewers', async (c) => {
  try {
    const streamId = c.req.param('id');
    const { instanceUrl, accessToken } = await getPeerTubeClient(c.env);

    // Try live-session endpoint first (more accurate)
    let viewerCount = 0;
    let health: string | undefined;
    let state: string | undefined;

    try {
      const sessionUrl = `${instanceUrl}/api/v1/videos/${streamId}/live-session`;
      const sessionResponse = await fetch(sessionUrl, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
        },
      });

      if (sessionResponse.ok) {
        const session = (await sessionResponse.json()) as {
          viewerCount?: number;
          health?: string;
          state?: string;
          startedAt?: string;
        };
        viewerCount = session.viewerCount ?? 0;
        health = session.health;
        state = session.state;
      }
    } catch {
      // Fall back to video endpoint
    }

    // Fallback from video endpoint
    if (viewerCount === 0) {
      try {
        const videoUrl = `${instanceUrl}/api/v1/videos/${streamId}`;
        const videoResponse = await fetch(videoUrl, {
          headers: {
            authorization: `Bearer ${accessToken}`,
            accept: 'application/json',
          },
        });

        if (videoResponse.ok) {
          const video = (await videoResponse.json()) as {
            liveInfo?: { viewerCount?: number; health?: string; state?: string };
          };
          viewerCount = video.liveInfo?.viewerCount ?? 0;
          health ??= video.liveInfo?.health;
          state ??= video.liveInfo?.state;
        }
      } catch {
        // Best-effort
      }
    }

    return noCacheJsonResponse({
      streamId,
      viewerCount,
      health: health ?? 'unknown',
      state: state ?? 'unknown',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to get viewers: ${msg}` }, 500);
  }
});

/**
 * POST /api/peertube/live/:id/chat
 * Post a chat message to a live stream.
 */
peertubeRouter.post('/live/:id/chat', async (c) => {
  try {
    const streamId = c.req.param('id');
    const body = (await c.req.json()) as { message?: string };

    if (!body.message || body.message.trim().length === 0) {
      return jsonResponse({ error: 'message is required' }, 400);
    }

    await peertubeFetch(c.env, `/api/v1/videos/${streamId}/live-chat`, {
      method: 'POST',
      body: JSON.stringify({ message: body.message.slice(0, 500) }),
    });

    return jsonResponse({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to send chat message: ${msg}` }, 500);
  }
});

/**
 * GET /api/peertube/live/:id/chat
 * Get chat messages for a live stream.
 */
peertubeRouter.get('/live/:id/chat', async (c) => {
  try {
    const streamId = c.req.param('id');
    const cursor = c.req.query('cursor');

    const params: Record<string, string | number | boolean | undefined> = {};
    if (cursor) params.cursor = cursor;

    const response = await peertubeFetch(c.env, `/api/v1/videos/${streamId}/live-chat`, { params });
    const data = (await response.json()) as {
      data: Array<{
        id: string;
        displayName: string;
        accountName: string;
        message: string;
        createdAt: string;
      }>;
      total: number;
      cursor?: string;
    };

    return noCacheJsonResponse({
      messages: data.data.map((msg) => ({
        id: msg.id,
        displayName: msg.displayName,
        accountName: msg.accountName,
        message: msg.message,
        createdAt: msg.createdAt,
      })),
      total: data.total,
      nextCursor: data.cursor,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to get chat: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// FEDERATION HEALTH
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/peertube/federation/following
 * List instances we follow.
 */
peertubeRouter.get('/federation/following', async (c) => {
  try {
    const query = {
      start: c.req.query('start') ?? '1',
      count: c.req.query('count') ?? '20',
      sort: '-createdAt',
      state: c.req.query('state'),
    };

    const response = await peertubeFetch(c.env, '/api/v1/server/following', {
      params: query as Record<string, string | number | boolean | undefined>,
    });

    const data = (await response.json()) as PaginatedResponse<{
      id: number;
      following: {
        id: number;
        name: string;
        displayName: string;
        host: string;
        url: string;
        avatar: { path: string } | null;
      };
      state: 'pending' | 'accepted' | 'rejected';
      createdAt: string;
    }>;

    return noCacheJsonResponse({
      total: data.total,
      data: data.data.map((f) => ({
        id: f.id,
        instance: {
          name: f.following.displayName || f.following.name,
          host: f.following.host,
          url: f.following.url,
          avatarUrl: f.following.avatar?.path
            ? `https://${f.following.host}${f.following.avatar.path}`
            : null,
        },
        state: f.state,
        followedAt: f.createdAt,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to list following: ${msg}` }, 500);
  }
});

/**
 * GET /api/peertube/federation/followers
 * List instances following us.
 */
peertubeRouter.get('/federation/followers', async (c) => {
  try {
    const query = {
      start: c.req.query('start') ?? '1',
      count: c.req.query('count') ?? '20',
      sort: '-createdAt',
      state: c.req.query('state'),
    };

    const response = await peertubeFetch(c.env, '/api/v1/server/followers', {
      params: query as Record<string, string | number | boolean | undefined>,
    });

    const data = (await response.json()) as PaginatedResponse<{
      id: number;
      follower: {
        id: number;
        name: string;
        displayName: string;
        host: string;
        url: string;
        avatar: { path: string } | null;
      };
      state: 'pending' | 'accepted' | 'rejected';
      createdAt: string;
    }>;

    return noCacheJsonResponse({
      total: data.total,
      data: data.data.map((f) => ({
        id: f.id,
        instance: {
          name: f.follower.displayName || f.follower.name,
          host: f.follower.host,
          url: f.follower.url,
          avatarUrl: f.follower.avatar?.path
            ? `https://${f.follower.host}${f.follower.avatar.path}`
            : null,
        },
        state: f.state,
        followedAt: f.createdAt,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to list followers: ${msg}` }, 500);
  }
});

/**
 * GET /api/peertube/federation/stats
 * Federation health stats — calculates health score.
 */
peertubeRouter.get('/federation/stats', async (c) => {
  try {
    const { instanceUrl, accessToken } = await getPeerTubeClient(c.env);
    const start = performance.now();
    const errors: string[] = [];

    // Fetch following and followers lists
    let following: Array<{ host: string; state: string }> = [];
    let followers: Array<{ host: string; state: string }> = [];
    let serverStats: {
      totalVideos?: number;
      totalLocalVideos?: number;
      totalViews?: number;
    } | null = null;

    try {
      const [followingRes, followersRes, statsRes] = await Promise.all([
        fetch(`${instanceUrl}/api/v1/server/following?count=100`, {
          headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
        }).then(
          (r) =>
            r.json() as Promise<PaginatedResponse<{ following: { host: string }; state: string }>>,
        ),
        fetch(`${instanceUrl}/api/v1/server/followers?count=100`, {
          headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
        }).then(
          (r) =>
            r.json() as Promise<PaginatedResponse<{ follower: { host: string }; state: string }>>,
        ),
        fetch(`${instanceUrl}/api/v1/server/stats`, {
          headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
        }).then(
          (r) =>
            r.json() as Promise<{
              totalVideos?: number;
              totalLocalVideos?: number;
              totalViews?: number;
            }>,
        ),
      ]);

      following = followingRes.data ?? [];
      followers = followersRes.data ?? [];
      serverStats = statsRes;
    } catch (err) {
      errors.push(
        `Failed to fetch federation data: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Calculate reachability of followed instances
    const uniqueHosts = [
      ...new Set(
        [...following.map((f) => f.host), ...followers.map((f) => f.host)].filter(Boolean),
      ),
    ];

    let reachableCount = 0;
    if (uniqueHosts.length > 0) {
      const results = await Promise.allSettled(
        uniqueHosts.map((host) =>
          fetch(`https://${host}/api/v1/config`, { signal: AbortSignal.timeout(5000) })
            .then((r) => r.ok)
            .catch(() => false),
        ),
      );
      reachableCount = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    }

    const latencyMs = Math.round(performance.now() - start);
    const instancesTotal = uniqueHosts.length;
    const reachablePercent =
      instancesTotal > 0 ? Math.round((reachableCount / instancesTotal) * 100) : 100;

    // Calculate health score (0-100)
    const reachabilityScore = reachablePercent;
    const pendingRatio =
      following.filter((f) => f.state === 'pending').length +
      followers.filter((f) => f.state === 'pending').length;
    const pendingScore = Math.max(0, 100 - pendingRatio * 10);
    const federationScore = Math.round(reachabilityScore * 0.7 + pendingScore * 0.3);

    const status = federationScore >= 80 ? 'up' : federationScore >= 50 ? 'degraded' : 'down';

    return noCacheJsonResponse({
      status,
      healthScore: federationScore,
      following: {
        total: following.length,
        accepted: following.filter((f) => f.state === 'accepted').length,
        pending: following.filter((f) => f.state === 'pending').length,
      },
      followers: {
        total: followers.length,
        accepted: followers.filter((f) => f.state === 'accepted').length,
        pending: followers.filter((f) => f.state === 'pending').length,
      },
      instanceReachability: {
        totalExamined: instancesTotal,
        reachable: reachableCount,
        unreachable: instancesTotal - reachableCount,
        reachablePercent,
      },
      latencyMs,
      serverStats: serverStats ?? {},
      errors: errors.length > 0 ? errors : undefined,
      lastChecked: Date.now(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to get federation stats: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/peertube/categories
 * List available PeerTube categories.
 */
peertubeRouter.get('/categories', (_c) => {
  const categories = Object.entries(PEERTUBE_CATEGORIES).map(([id, label]) => ({
    id: Number(id),
    label,
  }));
  return noCacheJsonResponse({ categories });
});

export default peertubeRouter;
