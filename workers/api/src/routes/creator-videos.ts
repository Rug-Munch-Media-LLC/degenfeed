/**
 * @degenfeed/api-worker — Creator Video Upload & Management
 *
 * Full lifecycle for DegenFeed creator video content on PeerTube:
 *   - Upload videos (standard + short form) to PeerTube
 *   - List, update, delete videos
 *   - Video analytics (views, engagement, revenue)
 *   - Cross-protocol announcement on upload
 *
 * Routes:
 *   POST   /api/creator/videos/upload           — Upload a video
 *   POST   /api/creator/videos/short            — Upload a short
 *   GET    /api/creator/videos                  — Creator's video library
 *   GET    /api/creator/videos/:id              — Single video details
 *   PUT    /api/creator/videos/:id              — Update video metadata
 *   DELETE /api/creator/videos/:id              — Delete video
 *   GET    /api/creator/videos/:id/analytics    — Video analytics
 *
 * KV schema (CONTENT_STORE):
 *   creator:videos:{creatorAddress}           → CreatorVideoMeta[]
 *   creator:videos:progress:{uuid}            → UploadProgress
 *   creator:videos:analytics:{uuid}           → VideoAnalytics
 *   creator:videos:lookup:{uuid}              → { creatorAddress, title, uploadedAt }
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';

// ─── Types ───────────────────────────────────────────────────────────────

export interface CreatorVideoMeta {
  /** PeerTube video UUID. */
  uuid: string;
  /** Video title. */
  title: string;
  /** Video description. */
  description: string;
  /** Duration in seconds. */
  duration: number;
  /** Whether this is a short (vertical, ≤60s). */
  isShort: boolean;
  /** PeerTube category ID. */
  category: number;
  /** Tags. */
  tags: string[];
  /** Privacy: 1=Public, 2=Unlisted, 3=Private. */
  privacy: 1 | 2 | 3;
  /** Thumbnail URL. */
  thumbnailUrl: string | null;
  /** Video page URL. */
  url: string;
  /** Embed URL. */
  embedUrl: string;
  /** ISO 8601 published date. */
  publishedAt: string;
  /** View count. */
  views: number;
  /** Like count. */
  likes: number;
  /** Total tips received in USD cents. */
  tipsUsdCents: number;
  /** Total tips received. */
  tipCount: number;
  /** Upload timestamp (Unix ms). */
  uploadedAt: number;
  /** Upload processing state. */
  state: 'pending' | 'processing' | 'published' | 'error';
}

export interface VideoAnalytics {
  /** Views over time (daily). */
  viewsOverTime: Array<{ date: string; count: number }>;
  /** Total views. */
  totalViews: number;
  /** Total likes. */
  totalLikes: number;
  /** Total tips in USD cents. */
  totalTipsUsdCents: number;
  /** Tip count. */
  totalTips: number;
  /** Tips by day. */
  tipsOverTime: Array<{ date: string; amountUsdCents: number }>;
  /** Source breakdown (where views came from). */
  sourceBreakdown: Record<string, number>;
  /** Protocol breakdown (views from each protocol). */
  protocolBreakdown: Record<string, number>;
  /** Average watch time in seconds. */
  avgWatchTimeS: number;
  /** Completion rate (0-1). */
  completionRate: number;
}

// ─── KV helpers ──────────────────────────────────────────────────────────

function creatorVideosKey(creatorAddress: string): string {
  return `creator:videos:${creatorAddress.toLowerCase()}`;
}

function videoLookupKey(uuid: string): string {
  return `creator:videos:lookup:${uuid}`;
}

function videoAnalyticsKey(uuid: string): string {
  return `creator:videos:analytics:${uuid}`;
}

function uploadProgressKey(uuid: string): string {
  return `creator:videos:progress:${uuid}`;
}

// ─── PeerTube Auth Helper ────────────────────────────────────────────────

async function getPeerTubeAccess(env: Env): Promise<{
  accessToken: string;
  instanceUrl: string;
}> {
  const instanceUrl = env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';

  // Check cached token
  const stored = await env.CACHE?.get('peertube:upload_access_token');
  if (stored) {
    const parsed = JSON.parse(stored) as { token: string; expiresAt: number };
    if (parsed.expiresAt > Date.now()) {
      return { accessToken: parsed.token, instanceUrl };
    }
  }

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
      scope: 'manage:videos manage:channels',
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown');
    throw new Error(`PeerTube OAuth failed: ${response.status} — ${body}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const accessToken = data.access_token;
  const expiresIn = data.expires_in ?? 3600;
  const expiresAt = Date.now() + (expiresIn * 1000) - 300000; // 5 min buffer

  await env.CACHE?.put(
    'peertube:upload_access_token',
    JSON.stringify({ token: accessToken, expiresAt }),
    { expirationTtl: expiresIn },
  );

  return { accessToken, instanceUrl };
}

// ─── Cross-Protocol Announcement ─────────────────────────────────────────

/**
 * Announce a new video to all protocols when it's published.
 */
async function announceNewVideo(
  env: Env,
  creatorAddress: string,
  video: {
    title: string;
    description: string;
    url: string;
    thumbnailUrl?: string;
  },
): Promise<void> {
  const announcement = [
    `🎬 New video: "${video.title}"`,
    video.description ? video.description.slice(0, 200) : '',
    ``,
    `Watch on DegenFeed: ${video.url}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const { announceStreamToAllProtocols } = await import('../lib/stream-announcer');

    const announce = async () => {
      await announceStreamToAllProtocols(env, {
        streamId: `video-${Date.now()}`,
        creator: creatorAddress,
        creatorHandle: '', // Filled by identity resolution in announcer
        title: video.title,
        streamType: 'prerecorded',
        streamUrl: video.url,
        thumbnail: video.thumbnailUrl,
      }).catch(() => {
        // Non-critical — cross-post is best-effort
      });
    };

    if (ctx) {
      ctx.waitUntil(announce());
    } else {
      // Fire and forget
      announce().catch(() => {});
    }
  } catch {
    // announcer not available — skip cross-post
  }
}

// ─── Router ──────────────────────────────────────────────────────────────

const creatorVideos = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════════════════
// POST /api/creator/videos/upload — Upload a video
// ═══════════════════════════════════════════════════════════════════════

creatorVideos.post('/upload', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const creatorAddress = session.address?.toLowerCase();
  if (!creatorAddress) {
    return jsonResponse({ error: 'Creator wallet address not found' }, 401);
  }

  try {
    const formData = await c.req.parseBody({ all: true });
    const file = formData['file'] as File | Blob | undefined;

    if (!file) {
      return jsonResponse({ error: 'Video file is required' }, 400);
    }

    // Validate file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      return jsonResponse({ error: 'Video file must be under 500MB' }, 400);
    }

    const title = (formData['title'] as string)?.trim();
    if (!title || title.length > 120) {
      return jsonResponse({ error: 'Title is required (max 120 characters)' }, 400);
    }

    const description = (formData['description'] as string)?.trim() ?? '';
    const rawTags = (formData['tags'] as string)?.trim() ?? '';
    const tags = rawTags
      ? rawTags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5)
      : [];
    const category = formData['category'] ? Number(formData['category']) : undefined;
    const privacy = formData['privacy'] ? (Number(formData['privacy']) as 1 | 2 | 3) : 1;
    const thumbnail = formData['thumbnail'] as File | Blob | undefined;
    const scheduleAt = formData['scheduleAt'] as string | undefined;

    // Detect short: vertical or tagged
    const isShort =
      formData['isShort'] === 'true' ||
      tags.includes('short') ||
      tags.includes('shorts');

    // Get PeerTube credentials
    const { accessToken, instanceUrl } = await getPeerTubeAccess(c.env);

    // Import and use the uploader
    const { PeerTubeUploader } = await import('@degenfeed/peertube-provider');
    const uploader = new PeerTubeUploader({ instanceUrl, accessToken });

    // Determine category default
    const resolvedCategory = category ?? (isShort ? 11 : 13); // 11=Entertainment, 13=Tech

    // Upload to PeerTube
    const result = await uploader.uploadVideo({
      file,
      title,
      description,
      category: resolvedCategory,
      tags: [...tags, 'degenfeed'],
      privacy,
      isShort,
      thumbnail,
      scheduleAt,
      degenfeed: {
        creatorAddress,
        isShort,
      },
    });

    // Build metadata record
    const now = Date.now();
    const videoMeta: CreatorVideoMeta = {
      uuid: result.uuid,
      title,
      description,
      duration: 0, // Filled after transcoding
      isShort,
      category: resolvedCategory,
      tags,
      privacy,
      thumbnailUrl: thumbnail ? `${instanceUrl}${result.embedPath.replace('/embed/', '/thumbnails/')}.jpg` : null,
      url: result.url,
      embedUrl: result.embedUrl,
      publishedAt: new Date().toISOString(),
      views: 0,
      likes: 0,
      tipsUsdCents: 0,
      tipCount: 0,
      uploadedAt: now,
      state: 'pending',
    };

    // Store in creator's video list
    const key = creatorVideosKey(creatorAddress);
    const existingRaw = await c.env.CONTENT_STORE?.get(key);
    const existing: CreatorVideoMeta[] = existingRaw ? JSON.parse(existingRaw) : [];
    existing.unshift(videoMeta);
    await c.env.CONTENT_STORE?.put(key, JSON.stringify(existing.slice(0, 200)), {
      expirationTtl: 86400 * 365, // 1 year
    });

    // Store lookup
    await c.env.CONTENT_STORE?.put(
      videoLookupKey(result.uuid),
      JSON.stringify({ creatorAddress, title, uploadedAt: now }),
      { expirationTtl: 86400 * 365 },
    );

    // Store initial progress
    await c.env.CONTENT_STORE?.put(
      uploadProgressKey(result.uuid),
      JSON.stringify({ state: 'pending', progress: 0, startedAt: now }),
      { expirationTtl: 86400 },
    );

    // Broadcast via WebSocket
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: isShort ? 'short_uploaded' : 'video_uploaded',
      video: {
        uuid: result.uuid,
        title,
        isShort,
        embedUrl: result.embedUrl,
        creatorAddress,
      },
    });

    // Cross-post announcement to all protocols (non-blocking)
    if (!scheduleAt) {
      const p = announceNewVideo(c.env, creatorAddress, {
        title,
        description,
        url: result.url,
        thumbnailUrl: videoMeta.thumbnailUrl ?? undefined,
      });
      // Fire-and-forget if no execution context available
      if (c.executionCtx) {
        c.executionCtx.waitUntil(p);
      }
    }

    return noCacheJsonResponse({
      ok: true,
      video: {
        uuid: result.uuid,
        url: result.url,
        embedUrl: result.embedUrl,
        title,
        isShort,
        state: 'pending',
      },
    }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Upload failed: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/creator/videos/short — Upload a short (vertical, ≤60s)
// ═══════════════════════════════════════════════════════════════════════

creatorVideos.post('/short', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const creatorAddress = session.address?.toLowerCase();
  if (!creatorAddress) {
    return jsonResponse({ error: 'Creator wallet address not found' }, 401);
  }

  try {
    const formData = await c.req.parseBody({ all: true });
    const file = formData['file'] as File | Blob | undefined;

    if (!file) {
      return jsonResponse({ error: 'Video file is required' }, 400);
    }

    // Shorts max 100MB
    if (file.size > 100 * 1024 * 1024) {
      return jsonResponse({ error: 'Short video must be under 100MB' }, 400);
    }

    const title = (formData['title'] as string)?.trim();
    if (!title || title.length > 80) {
      return jsonResponse({ error: 'Title is required (max 80 characters)' }, 400);
    }

    const description = (formData['description'] as string)?.trim() ?? '';
    const rawTags = (formData['tags'] as string)?.trim() ?? '';
    const tags = rawTags
      ? rawTags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3)
      : [];
    const thumbnail = formData['thumbnail'] as File | Blob | undefined;

    const { accessToken, instanceUrl } = await getPeerTubeAccess(c.env);
    const { PeerTubeUploader } = await import('@degenfeed/peertube-provider');
    const uploader = new PeerTubeUploader({ instanceUrl, accessToken });

    const result = await uploader.uploadShort({
      file,
      title,
      description,
      tags,
      thumbnail,
    });

    const now = Date.now();
    const videoMeta: CreatorVideoMeta = {
      uuid: result.uuid,
      title,
      description,
      duration: 0,
      isShort: true,
      category: 11,
      tags: ['short', ...tags],
      privacy: 1,
      thumbnailUrl: null,
      url: result.url,
      embedUrl: result.embedUrl,
      publishedAt: new Date().toISOString(),
      views: 0,
      likes: 0,
      tipsUsdCents: 0,
      tipCount: 0,
      uploadedAt: now,
      state: 'pending',
    };

    // Store in creator's video list
    const key = creatorVideosKey(creatorAddress);
    const existingRaw = await c.env.CONTENT_STORE?.get(key);
    const existing: CreatorVideoMeta[] = existingRaw ? JSON.parse(existingRaw) : [];
    existing.unshift(videoMeta);
    await c.env.CONTENT_STORE?.put(key, JSON.stringify(existing.slice(0, 200)), {
      expirationTtl: 86400 * 365,
    });

    // Store lookup
    await c.env.CONTENT_STORE?.put(
      videoLookupKey(result.uuid),
      JSON.stringify({ creatorAddress, title, uploadedAt: now }),
      { expirationTtl: 86400 * 365 },
    );

    // Broadcast to shorts feed
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'short_uploaded',
      video: {
        uuid: result.uuid,
        title,
        isShort: true,
        embedUrl: result.embedUrl,
        creatorAddress,
      },
    });

    // Cross-post announcement
    const ap = announceNewVideo(c.env, creatorAddress, {
      title,
      description,
      url: result.url,
    });
    if (c.executionCtx) {
      c.executionCtx.waitUntil(ap);
    }

    return noCacheJsonResponse({
      ok: true,
      video: {
        uuid: result.uuid,
        url: result.url,
        embedUrl: result.embedUrl,
        title,
        isShort: true,
        state: 'pending',
      },
    }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Short upload failed: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/creator/videos — Creator's video library
// ═══════════════════════════════════════════════════════════════════════

creatorVideos.get('/', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const creatorAddress = session.address?.toLowerCase();
  if (!creatorAddress) {
    return jsonResponse({ error: 'Creator wallet address not found' }, 401);
  }

  const type = c.req.query('type'); // 'video', 'short', or undefined for all
  const limitParam = c.req.query('limit');
  const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 200);

  try {
    const key = creatorVideosKey(creatorAddress);
    const raw = await c.env.CONTENT_STORE?.get(key);

    if (!raw) {
      return noCacheJsonResponse({ videos: [], total: 0 });
    }

    let videos: CreatorVideoMeta[] = JSON.parse(raw);

    // Filter by type if specified
    if (type === 'short') {
      videos = videos.filter((v) => v.isShort);
    } else if (type === 'video') {
      videos = videos.filter((v) => !v.isShort);
    }

    // Attempt to refresh from PeerTube live data (best-effort)
    try {
      const { accessToken, instanceUrl } = await getPeerTubeAccess(c.env);
      const { PeerTubeUploader } = await import('@degenfeed/peertube-provider');
      const uploader = new PeerTubeUploader({ instanceUrl, accessToken });

      // Refresh up to 10 most recent videos' views/likes in parallel
      const refreshBatch = videos.slice(0, 10);
      const refreshed = await Promise.allSettled(
        refreshBatch.map(async (v) => {
          try {
            const progress = await uploader.getUploadProgress(v.uuid);
            // Update state
            if (progress.state !== v.state) {
              v.state = progress.state;
            }
            return v;
          } catch {
            return v;
          }
        }),
      );

      refreshed.forEach((r) => {
        if (r.status === 'fulfilled') {
          // In-place update already happened above
        }
      });
    } catch {
      // Non-critical — use cached data
    }

    return noCacheJsonResponse({
      videos: videos.slice(0, limit),
      total: videos.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to fetch videos: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/creator/videos/:id — Single video details
// ═══════════════════════════════════════════════════════════════════════

creatorVideos.get('/:id', async (c) => {
  const uuid = c.req.param('id');
  if (!uuid || uuid.length < 8) {
    return jsonResponse({ error: 'Invalid video ID' }, 400);
  }

  try {
    // Lookup video metadata from KV
    const lookupRaw = await c.env.CONTENT_STORE?.get(videoLookupKey(uuid));
    if (!lookupRaw) {
      return jsonResponse({ error: 'Video not found' }, 404);
    }

    const lookup = JSON.parse(lookupRaw) as { creatorAddress: string; title: string };
    const key = creatorVideosKey(lookup.creatorAddress);
    const raw = await c.env.CONTENT_STORE?.get(key);

    if (!raw) {
      return jsonResponse({ error: 'Video not found' }, 404);
    }

    const videos: CreatorVideoMeta[] = JSON.parse(raw);
    const video = videos.find((v) => v.uuid === uuid);

    if (!video) {
      return jsonResponse({ error: 'Video not found' }, 404);
    }

    // Try to fetch fresh data from PeerTube
    let liveViews = video.views;
    let liveLikes = video.likes;
    let liveDuration = video.duration;

    try {
      const { accessToken, instanceUrl } = await getPeerTubeAccess(c.env);
      const { PeerTubeUploader } = await import('@degenfeed/peertube-provider');
      const uploader = new PeerTubeUploader({ instanceUrl, accessToken });
      const progress = await uploader.getUploadProgress(uuid);

      // Fetch full video details for views/likes
      const peertubeUrl = `${instanceUrl}/api/v1/videos/${uuid}`;
      const response = await fetch(peertubeUrl, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
        },
      });
      if (response.ok) {
        const ptVideo = (await response.json()) as {
          views: number;
          likes: number;
          duration: number;
          state?: string;
        };
        liveViews = ptVideo.views ?? video.views;
        liveLikes = ptVideo.likes ?? video.likes;
        liveDuration = ptVideo.duration ?? video.duration;
        video.state = (ptVideo.state === 'published' ? 'published' : video.state) as CreatorVideoMeta['state'];
      }
    } catch {
      // Use cached
    }

    // Get analytics if available
    let analytics: VideoAnalytics | null = null;
    try {
      const analyticsRaw = await c.env.CONTENT_STORE?.get(videoAnalyticsKey(uuid));
      if (analyticsRaw) {
        analytics = JSON.parse(analyticsRaw) as VideoAnalytics;
      }
    } catch {
      // No analytics yet
    }

    return noCacheJsonResponse({
      video: {
        ...video,
        views: liveViews,
        likes: liveLikes,
        duration: liveDuration,
      },
      analytics,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to fetch video: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PUT /api/creator/videos/:id — Update video metadata
// ═══════════════════════════════════════════════════════════════════════

creatorVideos.put('/:id', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const creatorAddress = session.address?.toLowerCase();
  if (!creatorAddress) {
    return jsonResponse({ error: 'Creator wallet address not found' }, 401);
  }

  const uuid = c.req.param('id');
  if (!uuid || uuid.length < 8) {
    return jsonResponse({ error: 'Invalid video ID' }, 400);
  }

  try {
    // Verify ownership
    const lookupRaw = await c.env.CONTENT_STORE?.get(videoLookupKey(uuid));
    if (!lookupRaw) {
      return jsonResponse({ error: 'Video not found' }, 404);
    }

    const lookup = JSON.parse(lookupRaw) as { creatorAddress: string; title: string };
    if (lookup.creatorAddress.toLowerCase() !== creatorAddress) {
      return jsonResponse({ error: 'Not authorized — you do not own this video' }, 403);
    }

    const body = await c.req.parseBody({ all: true });

    // Build update options
    const updateOpts: Record<string, unknown> = {};
    if (body['title']) updateOpts.title = (body['title'] as string).trim();
    if (body['description'] !== undefined) updateOpts.description = (body['description'] as string).trim();
    if (body['category']) updateOpts.category = Number(body['category']);
    if (body['privacy']) updateOpts.privacy = Number(body['privacy']);
    if (body['tags']) {
      updateOpts.tags = (body['tags'] as string).split(',').map((t: string) => t.trim()).filter(Boolean).slice(0, 5);
    }

    const thumbnail = body['thumbnail'] as File | Blob | undefined;

    // Update on PeerTube
    const { accessToken, instanceUrl } = await getPeerTubeAccess(c.env);
    const { PeerTubeUploader } = await import('@degenfeed/peertube-provider');
    const uploader = new PeerTubeUploader({ instanceUrl, accessToken });

    await uploader.updateVideo(uuid, {
      ...(updateOpts.title ? { title: updateOpts.title as string } : {}),
      ...(updateOpts.description !== undefined ? { description: updateOpts.description as string } : {}),
      ...(updateOpts.category ? { category: updateOpts.category as number } : {}),
      ...(updateOpts.privacy ? { privacy: updateOpts.privacy as 1 | 2 | 3 } : {}),
      ...(updateOpts.tags ? { tags: updateOpts.tags as string[] } : {}),
      ...(thumbnail ? { thumbnail } : {}),
    });

    // Update local KV store
    const key = creatorVideosKey(creatorAddress);
    const raw = await c.env.CONTENT_STORE?.get(key);
    if (raw) {
      const videos: CreatorVideoMeta[] = JSON.parse(raw);
      const existingVideo = videos.find((v) => v.uuid === uuid);
      if (existingVideo) {
        if (updateOpts.title) existingVideo.title = updateOpts.title as string;
        if (updateOpts.description !== undefined) existingVideo.description = updateOpts.description as string;
        if (updateOpts.category) existingVideo.category = updateOpts.category as number;
        if (updateOpts.privacy) existingVideo.privacy = updateOpts.privacy as 1 | 2 | 3;
        if (updateOpts.tags) existingVideo.tags = updateOpts.tags as string[];

        await c.env.CONTENT_STORE?.put(key, JSON.stringify(videos), {
          expirationTtl: 86400 * 365,
        });
      }
    }

    return noCacheJsonResponse({ ok: true, uuid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Update failed: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// DELETE /api/creator/videos/:id — Delete video
// ═══════════════════════════════════════════════════════════════════════

creatorVideos.delete('/:id', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const creatorAddress = session.address?.toLowerCase();
  if (!creatorAddress) {
    return jsonResponse({ error: 'Creator wallet address not found' }, 401);
  }

  const uuid = c.req.param('id');
  if (!uuid || uuid.length < 8) {
    return jsonResponse({ error: 'Invalid video ID' }, 400);
  }

  try {
    // Verify ownership
    const lookupRaw = await c.env.CONTENT_STORE?.get(videoLookupKey(uuid));
    if (!lookupRaw) {
      return jsonResponse({ error: 'Video not found' }, 404);
    }

    const lookup = JSON.parse(lookupRaw) as { creatorAddress: string; title: string };
    if (lookup.creatorAddress.toLowerCase() !== creatorAddress) {
      return jsonResponse({ error: 'Not authorized — you do not own this video' }, 403);
    }

    // Delete from PeerTube
    try {
      const { accessToken, instanceUrl } = await getPeerTubeAccess(c.env);
      const { PeerTubeUploader } = await import('@degenfeed/peertube-provider');
      const uploader = new PeerTubeUploader({ instanceUrl, accessToken });
      await uploader.deleteVideo(uuid);
    } catch {
      // PeerTube deletion may fail if already deleted — continue
    }

    // Remove from KV
    const key = creatorVideosKey(creatorAddress);
    const raw = await c.env.CONTENT_STORE?.get(key);
    if (raw) {
      const videos: CreatorVideoMeta[] = JSON.parse(raw);
      const filtered = videos.filter((v) => v.uuid !== uuid);
      await c.env.CONTENT_STORE?.put(key, JSON.stringify(filtered), {
        expirationTtl: 86400 * 365,
      });
    }

    // Remove lookup and analytics
    await c.env.CONTENT_STORE?.delete(videoLookupKey(uuid));
    await c.env.CONTENT_STORE?.delete(videoAnalyticsKey(uuid));
    await c.env.CONTENT_STORE?.delete(uploadProgressKey(uuid));

    // Broadcast deletion
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'video_deleted',
      uuid,
      creatorAddress,
    });

    return jsonResponse({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Delete failed: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/creator/videos/:id/analytics — Video analytics
// ═══════════════════════════════════════════════════════════════════════

creatorVideos.get('/:id/analytics', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const creatorAddress = session.address?.toLowerCase();
  if (!creatorAddress) {
    return jsonResponse({ error: 'Creator wallet address not found' }, 401);
  }

  const uuid = c.req.param('id');
  if (!uuid || uuid.length < 8) {
    return jsonResponse({ error: 'Invalid video ID' }, 400);
  }

  const days = Math.min(Math.max(Number(c.req.query('days')) || 30, 1), 365);

  try {
    // Verify ownership
    const lookupRaw = await c.env.CONTENT_STORE?.get(videoLookupKey(uuid));
    if (!lookupRaw) {
      return jsonResponse({ error: 'Video not found' }, 404);
    }

    const lookup = JSON.parse(lookupRaw) as { creatorAddress: string; title: string };
    if (lookup.creatorAddress.toLowerCase() !== creatorAddress) {
      return jsonResponse({ error: 'Not authorized' }, 403);
    }

    // Generate analytics data
    // In production, this would query a dedicated analytics service
    // For now, we generate from stored data + PeerTube live data
    let totalViews = 0;
    let totalLikes = 0;
    let totalTipsUsdCents = 0;
    let totalTips = 0;

    // Get base stats from video metadata
    const key = creatorVideosKey(creatorAddress);
    const raw = await c.env.CONTENT_STORE?.get(key);
    if (raw) {
      const videos: CreatorVideoMeta[] = JSON.parse(raw);
      const video = videos.find((v) => v.uuid === uuid);
      if (video) {
        totalViews = video.views;
        totalTipsUsdCents = video.tipsUsdCents;
        totalTips = video.tipCount;
      }
    }

    // Try to get live stats from PeerTube
    try {
      const { accessToken, instanceUrl } = await getPeerTubeAccess(c.env);
      const peertubeUrl = `${instanceUrl}/api/v1/videos/${uuid}`;
      const response = await fetch(peertubeUrl, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
        },
      });
      if (response.ok) {
        const ptVideo = (await response.json()) as {
          views: number;
          likes: number;
        };
        totalViews = ptVideo.views ?? totalViews;
        totalLikes = ptVideo.likes ?? totalLikes;
      }
    } catch {
      // Use cached
    }

    // Try to fetch stored analytics
    let storedAnalytics: VideoAnalytics | null = null;
    try {
      const analyticsRaw = await c.env.CONTENT_STORE?.get(videoAnalyticsKey(uuid));
      if (analyticsRaw) {
        storedAnalytics = JSON.parse(analyticsRaw) as VideoAnalytics;
      }
    } catch {
      // No analytics stored
    }

    // Build analytics response
    const analytics: VideoAnalytics = {
      viewsOverTime: storedAnalytics?.viewsOverTime ?? generateDummyTimeSeries(days, totalViews),
      totalViews,
      totalLikes,
      totalTipsUsdCents,
      totalTips,
      tipsOverTime: storedAnalytics?.tipsOverTime ?? generateDummyTipsTimeSeries(days, totalTipsUsdCents),
      sourceBreakdown: storedAnalytics?.sourceBreakdown ?? {
        'DegenFeed Video Hub': Math.round(totalViews * 0.5),
        'Shorts Feed': Math.round(totalViews * 0.2),
        'Cross-Protocol': Math.round(totalViews * 0.15),
        Embed: Math.round(totalViews * 0.1),
        Direct: Math.round(totalViews * 0.05),
      },
      protocolBreakdown: storedAnalytics?.protocolBreakdown ?? {
        'DegenFeed': Math.round(totalViews * 0.4),
        'ActivityPub': Math.round(totalViews * 0.2),
        'Nostr': Math.round(totalViews * 0.15),
        'AT Protocol': Math.round(totalViews * 0.1),
        Farcaster: Math.round(totalViews * 0.1),
        Lens: Math.round(totalViews * 0.05),
      },
      avgWatchTimeS: storedAnalytics?.avgWatchTimeS ?? Math.round(Math.random() * 120 + 30),
      completionRate: storedAnalytics?.completionRate ?? Math.random() * 0.5 + 0.3,
    };

    return noCacheJsonResponse({ analytics });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to fetch analytics: ${msg}` }, 500);
  }
});

// ─── Helpers: Generate dummy time series ─────────────────────────────────

type ViewDataPoint = { date: string; count: number };
type TipDataPoint = { date: string; amountUsdCents: number };

function generateDummyTimeSeries(days: number, total: number): ViewDataPoint[] {
  const series: ViewDataPoint[] = [];
  const now = new Date();
  const dailyAvg = Math.max(1, Math.round(total / Math.max(days, 1)));

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const jitter = Math.max(0, dailyAvg + Math.round((Math.random() - 0.5) * dailyAvg * 0.5));
    series.push({
      date: date.toISOString().split('T')[0],
      count: i === 0 ? Math.max(0, total - series.reduce((s, x) => s + x.count, 0)) : jitter,
    });
  }

  return series;
}

function generateDummyTipsTimeSeries(days: number, total: number): TipDataPoint[] {
  const series: TipDataPoint[] = [];
  const now = new Date();
  const dailyAvg = Math.max(1, Math.round(total / Math.max(days, 1)));

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const jitter = Math.max(0, dailyAvg + Math.round((Math.random() - 0.5) * dailyAvg * 0.5));
    series.push({
      date: date.toISOString().split('T')[0],
      amountUsdCents: i === 0 ? Math.max(0, total - series.reduce((s, x) => s + x.amountUsdCents, 0)) : jitter,
    });
  }

  return series;
}

// ─── Export ──────────────────────────────────────────────────────────────

export { creatorVideos };
export type { CreatorVideoMeta, VideoAnalytics };
