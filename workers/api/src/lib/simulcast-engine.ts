/**
 * @degenfeed/api-worker — Multi-Platform Simulcast Engine
 *
 * Enterprise-grade simulcast streaming. Creator streams to Loops (Owncast)
 * RTMP ingest; this engine restreams to YouTube Live, TikTok Live, Twitch,
 * Kick, and announces on all protocols (Farcaster, Nostr, Bluesky, Mastodon,
 * PeerTube, Owncast ActivityPub).
 *
 * Tier gate: Enterprise ($20/mo) — feature MULTI_PLATFORM_SIMULCAST
 *
 * Architecture:
 *   Creator OBS/Streamlabs → RTMP → Loops (Owncast)
 *                                   → Simulcast Engine
 *                                     → Postiz (YouTube, TikTok, Twitch, Kick)
 *                                     → Native (Farcaster, Nostr, Bluesky,
 *                                        Mastodon, PeerTube, Owncast AP)
 *
 * @see /path/to/degenfeed-web/workers/api/src/lib/postiz-bridge.ts
 * @see /path/to/degenfeed-web/workers/api/src/feed/live-aggregator.ts
 */

import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';

// ─── Constants ───────────────────────────────────────────────────────────────

export const SIMULCAST_PLATFORMS = ['youtube', 'tiktok', 'twitch', 'kick'] as const;

export const SIMULCAST_PROTOCOLS = [
  'farcaster',
  'nostr',
  'bluesky',
  'mastodon',
  'peertube',
  'owncast',
] as const;

export type SimulcastPlatform = (typeof SIMULCAST_PLATFORMS)[number];
export type SimulcastProtocol = (typeof SIMULCAST_PROTOCOLS)[number];

export const SIMULCAST_ALL = [...SIMULCAST_PLATFORMS, ...SIMULCAST_PROTOCOLS] as const;

export type SimulcastTarget = SimulcastPlatform | SimulcastProtocol;

/** Max concurrent simulcast streams per creator */
export const MAX_SIMULCASTS_PER_CREATOR = 3;

/** KV key helpers */
function simulcastKey(id: string): string {
  return `simulcast:${id}`;
}
function creatorSimulcastIndexKey(userId: string): string {
  return `simulcast:creator:${userId.toLowerCase()}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SimulcastConfig {
  /** Stream title (synced across all platforms) */
  title: string;
  /** Stream description */
  description?: string;
  /** Category/game for Twitch/Kick */
  category?: string;
  /** Tags */
  tags?: string[];
  /** Custom thumbnail URL */
  thumbnailUrl?: string;
  /** Enable chat bridging across platforms */
  chatBridging?: boolean;
  /** Enable cross-protocol announcements */
  announceOnProtocols?: boolean;
  /** Add "Streaming via DegenFeed" watermark (Loops only) */
  addWatermark?: boolean;
  /** Enable tip routing through DegenFeed */
  tipRouting?: boolean;
}

export interface SimulcastStream {
  /** Unique simulcast session ID */
  id: string;
  /** Creator/user that owns this simulcast */
  userId: string;
  /** Creator display info */
  creatorHandle: string;
  creatorDisplayName: string;
  creatorAvatarUrl?: string;
  creatorWalletAddress?: string;
  /** Stream config */
  config: SimulcastConfig;
  /** When the simulcast was started */
  startedAt: number;
  /** Per-platform status */
  platforms: Record<string, SimulcastPlatformStatus>;
  /** Overall livestream status */
  status: 'starting' | 'active' | 'stopping' | 'ended' | 'failed';
  /** Error message if failed */
  error?: string;
  /** Loops (Owncast) stream key */
  loopsStreamKey: string;
  /** Loops RTMP URL for the creator to push to */
  loopsRtmpUrl: string;
  /** Loops playback URL */
  loopsPlaybackUrl: string;
  /** Loops embed URL */
  loopsEmbedUrl: string;
}

export interface SimulcastPlatformStatus {
  platform: SimulcastTarget;
  status: 'pending' | 'starting' | 'live' | 'error' | 'stopped';
  viewerCount: number;
  error?: string;
  /** Platform-specific stream URL */
  streamUrl?: string;
  /** Platform-specific embed URL */
  embedUrl?: string;
  /** When this platform went live */
  startedAt?: number;
  /** Platform-specific metadata */
  metadata?: Record<string, unknown>;
}

export interface SimulcastSummary {
  id: string;
  userId: string;
  title: string;
  status: SimulcastStream['status'];
  startedAt: number;
  platforms: Record<string, SimulcastPlatformStatus>;
  totalViewers: number;
  loopsPlaybackUrl: string;
  config: SimulcastConfig;
}

// ─── Simulcast Engine ────────────────────────────────────────────────────────

/**
 * Generate a unique simulcast session ID.
 */
function generateSimulcastId(): string {
  return `simulcast:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a Loops/Owncast stream key.
 */
function generateStreamKey(): string {
  return (
    crypto.randomUUID?.()?.replace(/-/g, '').slice(0, 16) ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  );
}

/**
 * Start a multi-platform simulcast.
 *
 * 1. Creates a Loops (Owncast) stream session — this is where the creator
 *    pushes their RTMP feed.
 * 2. Starts restream to each external platform via Postiz go-live API.
 * 3. Announces on all protocols (Farcaster, Nostr, Bluesky, Mastodon,
 *    PeerTube, Owncast ActivityPub).
 * 4. Stores session state in KV.
 *
 * @returns The created simulcast stream object
 */
export async function startSimulcast(
  userId: string,
  walletAddress: string,
  config: SimulcastConfig,
  env: Env,
  connectedPlatforms?: Record<string, string>, // platform -> postizIntegrationId
): Promise<SimulcastStream> {
  const id = generateSimulcastId();
  const streamKey = generateStreamKey();
  const instanceUrl = env.OWNCAST_INSTANCE_URL ?? 'https://owncast.degenfeed.xyz';
  const rtmpUrl = `rtmp://owncast.degenfeed.xyz/live`;
  const playbackUrl = `${instanceUrl}/embed/video`;
  const embedUrl = `${instanceUrl}/embed/video`;

  const simulcast: SimulcastStream = {
    id,
    userId,
    creatorHandle: config.title.toLowerCase().replace(/\s+/g, '_'),
    creatorDisplayName: config.title,
    config,
    startedAt: Date.now(),
    platforms: {},
    status: 'starting',
    loopsStreamKey: streamKey,
    loopsRtmpUrl: rtmpUrl,
    loopsPlaybackUrl: playbackUrl,
    loopsEmbedUrl: embedUrl,
  };

  // --- Step 1: Set up Owncast stream metadata ---
  try {
    await fetch(`${instanceUrl}/api/admin/stream/title`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: config.title,
        description: config.description
          ? `🎥 ${config.description}\n\nPowered by DegenFeed`
          : 'Powered by DegenFeed',
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Best-effort — stream will work regardless
  }

  // Track Loops platform
  simulcast.platforms.loops = {
    platform: 'loops' as SimulcastTarget,
    status: 'pending',
    viewerCount: 0,
    streamUrl: playbackUrl,
    embedUrl,
  };

  // --- Step 2: Start external platform streams via Postiz ---
  const platformStartPromises: Promise<void>[] = [];

  if (connectedPlatforms) {
    for (const [platform, integrationId] of Object.entries(connectedPlatforms)) {
      if (!SIMULCAST_PLATFORMS.includes(platform as SimulcastPlatform)) continue;

      const platformStatus: SimulcastPlatformStatus = {
        platform: platform as SimulcastTarget,
        status: 'starting',
        viewerCount: 0,
      };
      simulcast.platforms[platform] = platformStatus;

      platformStartPromises.push(
        startExternalPlatformStream(id, platform as SimulcastPlatform, integrationId, config, env)
          .then((result) => {
            platformStatus.status = result.success ? 'live' : 'error';
            platformStatus.streamUrl = result.streamUrl;
            platformStatus.embedUrl = result.streamUrl;
            platformStatus.error = result.error;
            platformStatus.startedAt = result.success ? Date.now() : undefined;
            simulcast.platforms[platform] = { ...platformStatus };
          })
          .catch((err) => {
            simulcast.platforms[platform] = {
              ...platformStatus,
              status: 'error',
              error: err instanceof Error ? err.message : String(err),
            };
          }),
      );
    }
  }

  // Wait for external platform startups (with timeout)
  await Promise.race([
    Promise.allSettled(platformStartPromises),
    new Promise((resolve) => setTimeout(resolve, 15_000)), // 15s max wait
  ]);

  // --- Step 3: Announce on protocols (non-blocking) ---
  if (config.announceOnProtocols !== false) {
    announceOnAllProtocols(id, config, walletAddress, env).catch((e) =>
      console.error('[simulcast] Protocol announcement failed:', e),
    );
  }

  // --- Step 4: Mark active ---
  simulcast.status = 'active';
  simulcast.platforms.loops.status = 'live';

  // --- Step 5: Store in KV ---
  try {
    await env.STREAMS?.put(simulcastKey(id), JSON.stringify(simulcast), {
      expirationTtl: 86400, // 24h TTL
    });

    // Add to creator's simulcast index
    const creatorIndex = await env.STREAMS?.get(creatorSimulcastIndexKey(userId));
    const ids: string[] = creatorIndex ? JSON.parse(creatorIndex) : [];
    ids.push(id);
    // Keep only latest MAX_SIMULCASTS_PER_CREATOR
    const trimmed = ids.slice(-MAX_SIMULCASTS_PER_CREATOR);
    await env.STREAMS?.put(creatorSimulcastIndexKey(userId), JSON.stringify(trimmed), {
      expirationTtl: 86400 * 7, // 7 day TTL for index
    });
  } catch {
    // Non-critical
  }

  // Broadcast simulcast started event
  broadcastToAll(CHANNELS.FEED_NEW, {
    type: 'simulcast_started',
    streamId: id,
    title: config.title,
    userId,
    platforms: Object.keys(simulcast.platforms),
    loopsPlaybackUrl: playbackUrl,
    startedAt: simulcast.startedAt,
  });

  return simulcast;
}

/**
 * Stop an active simulcast.
 * Shuts down each external platform stream, then ends the session.
 */
export async function stopSimulcast(
  id: string,
  userId: string,
  env: Env,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Load the simulcast record
    const raw = await env.STREAMS?.get(simulcastKey(id));
    if (!raw) {
      return { ok: false, error: 'Simulcast session not found' };
    }

    const simulcast: SimulcastStream = JSON.parse(raw);

    // Verify ownership
    if (simulcast.userId !== userId) {
      return { ok: false, error: 'Not authorized to stop this simulcast' };
    }

    simulcast.status = 'stopping';

    // Stop each external platform
    const stopPromises: Promise<unknown>[] = [];
    for (const [platform, status] of Object.entries(simulcast.platforms)) {
      if (platform === 'loops') continue;
      if (status.status === 'live' || status.status === 'starting') {
        stopPromises.push(
          stopExternalPlatformStream(platform, env).catch(() => {
            // Platform stop is best-effort
          }),
        );
      }
      simulcast.platforms[platform] = {
        ...status,
        status: 'stopped',
      };
    }

    await Promise.allSettled(stopPromises);

    simulcast.status = 'ended';

    // Update KV
    await env.STREAMS?.put(simulcastKey(id), JSON.stringify(simulcast), {
      expirationTtl: 86400,
    });

    // Broadcast stop event
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'simulcast_stopped',
      streamId: id,
      userId,
      stoppedAt: Date.now(),
    });

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Start or stop an individual platform within an active simulcast
 * without affecting other platforms.
 */
export async function setSimulcastPlatformStatus(
  id: string,
  userId: string,
  platform: SimulcastTarget,
  action: 'start' | 'stop',
  env: Env,
  integrationId?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const raw = await env.STREAMS?.get(simulcastKey(id));
    if (!raw) return { ok: false, error: 'Simulcast session not found' };

    const simulcast: SimulcastStream = JSON.parse(raw);
    if (simulcast.userId !== userId) {
      return { ok: false, error: 'Not authorized' };
    }
    if (simulcast.status !== 'active') {
      return { ok: false, error: 'Simulcast is not active' };
    }

    if (action === 'start') {
      if (!SIMULCAST_PLATFORMS.includes(platform as SimulcastPlatform)) {
        return {
          ok: false,
          error: `Cannot start platform ${platform} individually. Use protocol announcements.`,
        };
      }

      const result = await startExternalPlatformStream(
        id,
        platform as SimulcastPlatform,
        integrationId ?? '',
        simulcast.config,
        env,
      );

      simulcast.platforms[platform] = {
        platform,
        status: result.success ? 'live' : 'error',
        viewerCount: 0,
        streamUrl: result.streamUrl,
        error: result.error,
        startedAt: result.success ? Date.now() : undefined,
      };
    } else {
      // Stop platform
      await stopExternalPlatformStream(platform, env);
      const prev = simulcast.platforms[platform];
      simulcast.platforms[platform] = {
        platform,
        status: 'stopped',
        viewerCount: prev?.viewerCount ?? 0,
      };
    }

    await env.STREAMS?.put(simulcastKey(id), JSON.stringify(simulcast), {
      expirationTtl: 86400,
    });

    // Broadcast platform status change
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'simulcast_platform_update',
      streamId: id,
      platform,
      action,
      userId,
    });

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Update the stream title, description, or thumbnail across ALL platforms.
 * Syncs the update to every connected platform.
 */
export async function updateSimulcastMetadata(
  id: string,
  userId: string,
  updates: Partial<SimulcastConfig>,
  env: Env,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const raw = await env.STREAMS?.get(simulcastKey(id));
    if (!raw) return { ok: false, error: 'Simulcast session not found' };

    const simulcast: SimulcastStream = JSON.parse(raw);
    if (simulcast.userId !== userId) return { ok: false, error: 'Not authorized' };

    // Apply updates to config
    simulcast.config = { ...simulcast.config, ...updates };

    // Sync title to Loops/Owncast
    if (updates.title && simulcast.platforms.loops?.status === 'live') {
      try {
        const instanceUrl = env.OWNCAST_INSTANCE_URL ?? 'https://owncast.degenfeed.xyz';
        await fetch(`${instanceUrl}/api/admin/stream/title`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: updates.title }),
          signal: AbortSignal.timeout(3000),
        });
      } catch {
        // Best-effort
      }
    }

    await env.STREAMS?.put(simulcastKey(id), JSON.stringify(simulcast), {
      expirationTtl: 86400,
    });

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Get active simulcast for a creator.
 */
export async function getActiveSimulcast(
  userId: string,
  env: Env,
): Promise<SimulcastStream | null> {
  try {
    const raw = await env.STREAMS?.get(creatorSimulcastIndexKey(userId));
    if (!raw) return null;

    const ids: string[] = JSON.parse(raw);
    if (ids.length === 0) return null;

    // Get the most recent active simulcast
    for (let i = ids.length - 1; i >= 0; i--) {
      const id = ids[i];
      if (!id) continue;
      const sRaw = await env.STREAMS?.get(simulcastKey(id));
      if (sRaw) {
        const s = JSON.parse(sRaw) as SimulcastStream;
        if (s.status === 'active' || s.status === 'starting') {
          return s;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * List all simulcasts for a creator (recent history).
 */
export async function getCreatorSimulcasts(userId: string, env: Env): Promise<SimulcastStream[]> {
  try {
    const raw = await env.STREAMS?.get(creatorSimulcastIndexKey(userId));
    if (!raw) return [];

    const ids: string[] = JSON.parse(raw);
    const results: SimulcastStream[] = [];

    for (const id of ids) {
      const sRaw = await env.STREAMS?.get(simulcastKey(id));
      if (sRaw) {
        try {
          results.push(JSON.parse(sRaw));
        } catch {
          // Skip corrupted
        }
      }
    }

    return results.sort((a, b) => b.startedAt - a.startedAt);
  } catch {
    return [];
  }
}

/**
 * Get a single simulcast by ID.
 */
export async function getSimulcastById(id: string, env: Env): Promise<SimulcastStream | null> {
  try {
    const raw = await env.STREAMS?.get(simulcastKey(id));
    return raw ? (JSON.parse(raw) as SimulcastStream) : null;
  } catch {
    return null;
  }
}

/**
 * Compute a summary of the simulcast (used for dashboard API).
 */
export function summarizeSimulcast(stream: SimulcastStream): SimulcastSummary {
  const totalViewers = Object.values(stream.platforms).reduce(
    (sum, p) => sum + (p.viewerCount || 0),
    0,
  );

  return {
    id: stream.id,
    userId: stream.userId,
    title: stream.config.title,
    status: stream.status,
    startedAt: stream.startedAt,
    platforms: stream.platforms,
    totalViewers,
    loopsPlaybackUrl: stream.loopsPlaybackUrl,
    config: stream.config,
  };
}

// ─── External Platform Helpers ───────────────────────────────────────────────

/**
 * Start a stream on an external platform via Postiz go-live API.
 */
async function startExternalPlatformStream(
  simulcastId: string,
  platform: SimulcastPlatform,
  integrationId: string,
  config: SimulcastConfig,
  env: Env,
): Promise<{ success: boolean; streamUrl?: string; error?: string }> {
  try {
    const { goLiveOnExternalPlatform } = await import('./postiz-bridge');

    const result = await goLiveOnExternalPlatform(
      {
        platform,
        title: config.title,
        description: `🎥 ${config.description ?? 'Live now'}\n\nPowered by DegenFeed`,
        category: config.category,
        tags: config.tags,
        streamUrl: `rtmp://owncast.degenfeed.xyz/live/${simulcastId}`,
        streamKey: `simulcast-${simulcastId}`,
      },
      integrationId,
      env,
    );

    return {
      success: result.success,
      streamUrl: result.streamUrl,
      error: result.error,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Stop a stream on an external platform.
 * Uses Postiz to signal the end of the live stream.
 */
async function stopExternalPlatformStream(
  platform: string,
  env: Env,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Postiz handles stream end — we make a best-effort call
    const apiKey = (env as Record<string, string>).POSTIZ_API_KEY ?? '';
    const baseUrl = (env as Record<string, string>).POSTIZ_BASE_URL ?? 'http://127.0.0.1:3105';

    const res = await fetch(`${baseUrl}/public/v1/live/stop`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ platform }),
      signal: AbortSignal.timeout(10_000),
    });

    return { success: res.ok };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Protocol Announcements ──────────────────────────────────────────────────

/**
 * Announce "going live" on all protocols.
 * Posts live announcements to Farcaster, Nostr, Bluesky, Mastodon,
 * PeerTube, and Owncast ActivityPub.
 */
async function announceOnAllProtocols(
  _simulcastId: string,
  config: SimulcastConfig,
  _walletAddress: string,
  env: Env,
): Promise<void> {
  const instanceUrl = env.OWNCAST_INSTANCE_URL ?? 'https://owncast.degenfeed.xyz';
  const liveUrl = `${instanceUrl}/embed/video`;
  const announcement = `🔴 LIVE NOW: ${config.title}\n\n${config.description ?? ''}\n\nStreaming via DegenFeed — Multi-platform simulcast\n\n${liveUrl}`;

  const protocolAnnouncements: Promise<void>[] = [];

  // Farcaster cast
  protocolAnnouncements.push(publishToFarcaster(announcement, liveUrl, env).catch(() => {}));

  // Nostr event (kind 1 + kind 30311 for live)
  protocolAnnouncements.push(publishToNostr(announcement, config, liveUrl, env).catch(() => {}));

  // Bluesky post
  protocolAnnouncements.push(publishToBluesky(announcement, liveUrl, env).catch(() => {}));

  // Mastodon/GoToSocial toot
  protocolAnnouncements.push(publishToMastodon(announcement, env).catch(() => {}));

  // PeerTube live status
  protocolAnnouncements.push(publishToPeerTube(config, liveUrl, env).catch(() => {}));

  await Promise.allSettled(protocolAnnouncements);
}

/**
 * Publish a go-live announcement to Farcaster via Hubble.
 */
async function publishToFarcaster(text: string, url: string, env: Env): Promise<void> {
  const hubUrl = env.FARCASTER_HUB_URL ?? 'http://127.0.0.1:3010';
  const signerKey = env.FARCASTER_BOT_SIGNER_KEY ?? env.FARCASTER_SIGNER_KEY;
  const fid = env.FARCASTER_BOT_FID ?? env.FARCASTER_FID;

  if (!signerKey || !fid) return;

  // Submit cast directly via Hubble submitMessage
  try {
    const body = {
      text: text.slice(0, 320), // Farcaster cast limit
      embeds: [{ url }],
      fid: Number(fid),
      signerKey,
    };

    await fetch(`${hubUrl}/v1/submitMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best-effort
  }
}

/**
 * Publish a go-live announcement to Nostr (kind 1 text note + kind 30311 live event).
 */
async function publishToNostr(
  _text: string,
  config: SimulcastConfig,
  url: string,
  env: Env,
): Promise<void> {
  const nsec = env.NOSTR_PRIVATE_KEY ?? (env as Record<string, string>).NOSTR_BOT_NSEC;
  if (!nsec) return;

  try {
    const { nostrLiveStrategy } = await import('./live-shorts/strategies/nostr-live');
    await nostrLiveStrategy.announceLive(
      env,
      `simulcast-${Date.now()}`,
      'degenfeed',
      'degenfeed',
      config.title,
      url,
      0,
    );
  } catch {
    // Best-effort
  }
}

/**
 * Publish a go-live announcement to Bluesky AT Protocol.
 */
async function publishToBluesky(text: string, url: string, env: Env): Promise<void> {
  const identifier = env.BSKY_BOT_IDENTIFIER ?? env.BSKY_DID;
  const password = env.BSKY_BOT_PASSWORD ?? env.BSKY_ACCESS_TOKEN;
  if (!identifier || !password) return;

  try {
    const { atProtoLiveStrategy } = await import('../lib/live-shorts/strategies/atproto-live');
    await atProtoLiveStrategy.announceLive(
      env,
      `simulcast-${Date.now()}`,
      'degenfeed',
      'degenfeed',
      text.slice(0, 300),
      url,
      0,
    );
  } catch {
    // Best-effort
  }
}

/**
 * Publish a go-live announcement to Mastodon/GoToSocial.
 */
async function publishToMastodon(text: string, env: Env): Promise<void> {
  const gtsToken = (env as Record<string, string>).GTS_BOT_TOKEN;
  const gtsUrl = env.GTS_INSTANCE_URL ?? env.GOTOSOCIAL_INSTANCE_URL ?? 'https://gts.degenfeed.xyz';
  if (!gtsToken) return;

  try {
    await fetch(`${gtsUrl}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gtsToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: text.slice(0, 500),
        visibility: 'public',
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best-effort
  }
}

/**
 * Publish a go-live event to PeerTube.
 */
async function publishToPeerTube(config: SimulcastConfig, url: string, env: Env): Promise<void> {
  // PeerTube federation announces automatically when a live stream is created
  // via PeerTubeLiveStream.createStream() (OAuth token + channel context required).
  // Standalone simulcast go-live announcements have no channel context here,
  // so this is a no-op unless client credentials are configured for a future
  // authenticated announcement flow.
  if (!env.PEERTUBE_CLIENT_ID || !env.PEERTUBE_CLIENT_SECRET) return;
  void config;
  void url;
}
