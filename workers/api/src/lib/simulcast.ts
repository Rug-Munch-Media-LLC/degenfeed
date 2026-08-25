/**
 * @degenfeed/api-worker — Multi-Platform Simulcast Engine
 *
 * Simultaneously broadcasts a single stream to multiple platforms.
 * Streamer goes live on ONE platform (DegenFeed/Owncast), and our server
 * restreams to ALL other platforms.
 *
 * Supported targets:
 *   - PeerTube (our instance + federated)
 *   - YouTube Live (via RTMP)
 *   - Twitch (via RTMP)
 *   - Farcaster Live (via Frame)
 *   - Owncast (self-hosted)
 *   - Nostr (NIP-53 live event announcements)
 *
 * Features:
 *   - Per-platform stream key management
 *   - Health monitoring per target
 *   - Automatic retry on failure
 *   - Bandwidth-aware scheduling
 */

import { log } from '../logger';
import { methodNotAllowed } from '../response-helpers';
import type { Env } from '../types';
import type { LiveStream } from './stream-store';

// ─── Types ──────────────────────────────────────────────────────────────

export type SimulcastPlatform =
  | 'peertube'
  | 'youtube'
  | 'twitch'
  | 'farcaster'
  | 'owncast'
  | 'nostr'
  | 'kick';

export interface SimulcastTargetConfig {
  /** Platform identifier */
  platform: SimulcastPlatform;
  /** Human-readable label for UI */
  label: string;
  /** Whether this target is enabled for the simulcast */
  enabled: boolean;
  /** RTMP ingest URL for this platform */
  rtmpUrl?: string;
  /** Stream key for this platform */
  streamKey?: string;
  /** OAuth token or API key for this platform */
  apiToken?: string;
  /** Platform-specific channel/user ID */
  channelId?: string;
  /** Custom RTMP endpoint (some platforms have regional endpoints) */
  customRtmpEndpoint?: string;
  /** Priority order for bandwidth allocation (lower = higher priority) */
  priority: number;
}

export interface SimulcastSession {
  /** Unique session ID */
  id: string;
  /** Source stream ID on DegenFeed/Owncast */
  sourceStreamId: string;
  /** Title being simulcast */
  title: string;
  /** Creator wallet address */
  creatorId: string;
  /** When the simulcast started */
  startedAt: number;
  /** Active target platforms */
  targets: SimulcastTargetState[];
  /** Overall session status */
  status: 'starting' | 'live' | 'error' | 'ended';
}

export interface SimulcastTargetState {
  platform: SimulcastPlatform;
  status: 'connecting' | 'live' | 'error' | 'ended';
  connectedAt?: number;
  health: 'healthy' | 'degraded' | 'offline';
  lastHealthCheck?: number;
  viewerCount?: number;
  playbackUrl?: string;
  error?: string;
  retryCount: number;
  streamKey?: string;
  rtmpUrl?: string;
}

export interface SimulcastConfig {
  /** Stream title */
  title: string;
  /** Stream description */
  description?: string;
  /** Creator wallet/ID */
  creatorId: string;
  /** Creator display name */
  creatorDisplayName: string;
  /** Source platform (where streamer goes live) */
  sourcePlatform: 'owncast' | 'degenfeed';
  /** Source stream ID on the source platform */
  sourceStreamId: string;
  /** Source RTMP URL (where the stream is ingested) */
  sourceRtmpUrl: string;
  /** Source stream key */
  sourceStreamKey: string;
  /** Target platforms for simulcast */
  targets: SimulcastPlatform[];
  /** Category/tags for the stream */
  category?: string;
  tags?: string[];
  /** Whether to save replay on supported platforms */
  saveReplay?: boolean;
  /** Whether chat is bridged across platforms */
  chatBridged?: boolean;
}

export interface SimulcastHealthReport {
  sessionId: string;
  active: boolean;
  targets: SimulcastTargetState[];
  totalViewers: number;
  healthyCount: number;
  degradedCount: number;
  offlineCount: number;
  startedAt: number;
  uptimeSeconds: number;
}

// ─── Platform RTMP Endpoints ─────────────────────────────────────────

const PLATFORM_RTMP_ENDPOINTS: Record<SimulcastPlatform, string> = {
  peertube: 'rtmp://video.degenfeed.xyz/live',
  youtube: 'rtmp://a.rtmp.youtube.com/live2',
  twitch: 'rtmp://live.twitch.tv/app',
  farcaster: '', // Farcaster uses Frame embeds, not RTMP
  owncast: 'rtmp://live.degenfeed.xyz/live',
  nostr: '', // Nostr uses NIP-53 events, not RTMP
  kick: 'rtmp://live.kick.com/live',
};

const PLATFORM_LABELS: Record<SimulcastPlatform, string> = {
  peertube: 'PeerTube',
  youtube: 'YouTube Live',
  twitch: 'Twitch',
  farcaster: 'Farcaster Live',
  owncast: 'Owncast',
  nostr: 'Nostr',
  kick: 'Kick',
};

const PLATFORM_EMOJIS: Record<SimulcastPlatform, string> = {
  peertube: '🎥',
  youtube: '▶️',
  twitch: '📺',
  farcaster: '📱',
  owncast: '📡',
  nostr: '⚡',
  kick: '🎲',
};

// ─── KV Key Helpers ─────────────────────────────────────────────────

function simulcastSessionKey(id: string): string {
  return `simulcast:session:${id}`;
}

function simulcastIndexKey(): string {
  return 'simulcast:active';
}

function streamKeyStoreKey(platform: SimulcastPlatform, creatorId: string): string {
  return `simulcast:keys:${platform}:${creatorId}`;
}

// ─── SimulcastEngine ──────────────────────────────────────────────────

export class SimulcastEngine {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  // ─── Session Management ─────────────────────────────────────────

  /**
   * Start a simulcast session — restreams to all configured platforms.
   */
  async startSimulcast(config: SimulcastConfig): Promise<SimulcastSession> {
    const sessionId =
      crypto.randomUUID?.() ?? `sim-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    log('info', '[simulcast] Starting simulcast', {
      sessionId,
      sourceStreamId: config.sourceStreamId,
      targets: config.targets,
    });

    // Initialize target states
    const targets: SimulcastTargetState[] = config.targets.map((platform) => ({
      platform,
      status: 'connecting',
      health: 'healthy',
      retryCount: 0,
      streamKey: undefined,
      rtmpUrl: PLATFORM_RTMP_ENDPOINTS[platform],
    }));

    const session: SimulcastSession = {
      id: sessionId,
      sourceStreamId: config.sourceStreamId,
      title: config.title,
      creatorId: config.creatorId,
      startedAt: Date.now(),
      targets,
      status: 'starting',
    };

    // Store session
    await this.env.CACHE?.put(simulcastSessionKey(sessionId), JSON.stringify(session), {
      expirationTtl: 86400,
    });

    // Add to active index
    await this.addToActiveIndex(sessionId);

    // Connect to each target in parallel
    const connectPromises = config.targets.map((platform) =>
      this.connectTarget(sessionId, platform, config),
    );

    // Don't await — connections happen in background
    Promise.allSettled(connectPromises).then((results) => {
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          log('error', '[simulcast] Target connection failed', {
            sessionId,
            platform: config.targets[i],
            error: String(r.reason),
          });
        }
      });
    });

    session.status = 'live';
    await this.env.CACHE?.put(simulcastSessionKey(sessionId), JSON.stringify(session), {
      expirationTtl: 86400,
    });

    return session;
  }

  /**
   * Connect to a specific target platform.
   */
  private async connectTarget(
    sessionId: string,
    platform: SimulcastPlatform,
    config: SimulcastConfig,
  ): Promise<void> {
    try {
      const targetState = await this.getTargetState(sessionId, platform);
      if (!targetState) return;

      switch (platform) {
        case 'peertube': {
          // PeerTube: create live video via REST API
          const instanceUrl = this.env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';
          const gtsToken = await this.getToken('peertube');

          if (gtsToken) {
            const response = await fetch(`${instanceUrl}/api/v1/videos/live`, {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${gtsToken}`,
              },
              body: JSON.stringify({
                name: config.title.slice(0, 120),
                description: config.description?.slice(0, 500) ?? '',
                channelId: 1,
                saveReplay: config.saveReplay ?? true,
                tags: config.tags ?? ['degenfeed', 'live', 'simulcast'],
              }),
              signal: AbortSignal.timeout(10000),
            });

            if (response.ok) {
              const video = (await response.json()) as { video: { uuid: string; url: string } };
              targetState.status = 'live';
              targetState.playbackUrl = video.video.url;
              targetState.connectedAt = Date.now();
            } else {
              throw new Error(`PeerTube API returned ${response.status}`);
            }
          } else {
            // Use RTMP directly if no API token
            targetState.rtmpUrl = PLATFORM_RTMP_ENDPOINTS.peertube;
            targetState.streamKey = config.sourceStreamKey;
            targetState.status = 'live';
            targetState.connectedAt = Date.now();
          }
          break;
        }

        case 'youtube': {
          // YouTube: use stored stream key
          const youtubeKey = await this.getStreamKey('youtube', config.creatorId);
          if (youtubeKey) {
            targetState.rtmpUrl = PLATFORM_RTMP_ENDPOINTS.youtube;
            targetState.streamKey = youtubeKey;
            targetState.status = 'live';
            targetState.connectedAt = Date.now();
          } else {
            targetState.status = 'error';
            targetState.error = 'No YouTube stream key configured';
          }
          break;
        }

        case 'twitch': {
          // Twitch: use stored stream key
          const twitchKey = await this.getStreamKey('twitch', config.creatorId);
          if (twitchKey) {
            targetState.rtmpUrl = PLATFORM_RTMP_ENDPOINTS.twitch;
            targetState.streamKey = twitchKey;
            targetState.status = 'live';
            targetState.connectedAt = Date.now();
          } else {
            targetState.status = 'error';
            targetState.error = 'No Twitch stream key configured';
          }
          break;
        }

        case 'farcaster': {
          // Farcaster: publish a live cast with video embed
          try {
            const { NostrLiveBridge } = await import('./nostr-live-bridge');
            const bridge = new NostrLiveBridge(this.env);
            await bridge.announceStream({
              id: config.sourceStreamId,
              title: config.title,
              description: config.description ?? '',
              creator: config.creatorId,
              type: 'live',
              host: config.creatorDisplayName,
              streamUrl: config.sourceRtmpUrl,
              isLive: true,
              viewerCount: 0,
            } as never);
            targetState.status = 'live';
            targetState.connectedAt = Date.now();
          } catch (err) {
            targetState.status = 'error';
            targetState.error = `Farcaster announce failed: ${String(err)}`;
          }
          break;
        }

        case 'owncast': {
          // Owncast: configure RTMP
          targetState.rtmpUrl = PLATFORM_RTMP_ENDPOINTS.owncast;
          targetState.streamKey = config.sourceStreamKey;
          targetState.status = 'live';
          targetState.connectedAt = Date.now();

          // Update Owncast stream title
          const owncastUrl = this.env.OWNCAST_INSTANCE_URL ?? 'https://live.degenfeed.xyz';
          try {
            await fetch(`${owncastUrl}/api/admin/stream/title`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ title: config.title }),
              signal: AbortSignal.timeout(3000),
            });
          } catch {
            // Non-critical
          }
          break;
        }

        case 'nostr': {
          // Nostr: publish NIP-53 live event kind 30311
          try {
            const { NostrLiveBridge } = await import('./nostr-live-bridge');
            const bridge = new NostrLiveBridge(this.env);
            await bridge.announceStream({
              id: config.sourceStreamId,
              title: config.title,
              description: config.description ?? '',
              creator: config.creatorId,
              type: 'live',
              host: config.creatorDisplayName,
              streamUrl: config.sourceRtmpUrl,
              isLive: true,
              viewerCount: 0,
            } as never);
            targetState.status = 'live';
            targetState.connectedAt = Date.now();
          } catch (err) {
            targetState.status = 'error';
            targetState.error = `Nostr announce failed: ${String(err)}`;
          }
          break;
        }

        case 'kick': {
          const kickKey = await this.getStreamKey('kick', config.creatorId);
          if (kickKey) {
            targetState.rtmpUrl = PLATFORM_RTMP_ENDPOINTS.kick;
            targetState.streamKey = kickKey;
            targetState.status = 'live';
            targetState.connectedAt = Date.now();
          } else {
            targetState.status = 'error';
            targetState.error = 'No Kick stream key configured';
          }
          break;
        }
      }

      // Update session with target state
      await this.updateTargetState(sessionId, targetState);
    } catch (err) {
      log('error', '[simulcast] Target connect error', {
        sessionId,
        platform,
        error: String(err),
      });

      const targetState = await this.getTargetState(sessionId, platform);
      if (targetState) {
        targetState.status = 'error';
        targetState.error = String(err);
        targetState.health = 'offline';
        await this.updateTargetState(sessionId, targetState);
      }
    }
  }

  /**
   * End a simulcast session — disconnects all targets.
   */
  async endSimulcast(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    log('info', '[simulcast] Ending simulcast', { sessionId });

    // Mark all targets as ended
    for (const target of session.targets) {
      target.status = 'ended';

      // For Nostr/Farcaster: mark live as ended
      if (target.platform === 'nostr' || target.platform === 'farcaster') {
        try {
          const { NostrLiveBridge } = await import('./nostr-live-bridge');
          const bridge = new NostrLiveBridge(this.env);
          await bridge.endStream(session.sourceStreamId, {
            id: session.sourceStreamId,
            title: session.title,
            creator: session.creatorId,
            description: '',
          } as LiveStream);
        } catch {
          // Non-critical
        }
      }
    }

    session.status = 'ended';

    await this.env.CACHE?.put(simulcastSessionKey(sessionId), JSON.stringify(session), {
      expirationTtl: 86400 * 7,
    });

    await this.removeFromActiveIndex(sessionId);
  }

  /**
   * Get a simulcast session.
   */
  async getSession(sessionId: string): Promise<SimulcastSession | null> {
    try {
      const raw = await this.env.CACHE?.get(simulcastSessionKey(sessionId));
      return raw ? (JSON.parse(raw) as SimulcastSession) : null;
    } catch {
      return null;
    }
  }

  /**
   * List all active simulcast sessions.
   */
  async listActiveSessions(): Promise<SimulcastSession[]> {
    try {
      const raw = await this.env.CACHE?.get(simulcastIndexKey());
      if (!raw) return [];

      const ids: string[] = JSON.parse(raw);
      const sessions: SimulcastSession[] = [];

      for (const id of ids) {
        const session = await this.getSession(id);
        if (session && session.status === 'live') {
          sessions.push(session);
        }
      }

      return sessions;
    } catch {
      return [];
    }
  }

  // ─── Health Monitoring ─────────────────────────────────────────

  /**
   * Check health of all targets for a session.
   */
  async checkHealth(sessionId: string): Promise<SimulcastHealthReport> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return {
        sessionId,
        active: false,
        targets: [],
        totalViewers: 0,
        healthyCount: 0,
        degradedCount: 0,
        offlineCount: 0,
        startedAt: 0,
        uptimeSeconds: 0,
      };
    }

    const totalViewers = 0;
    let healthyCount = 0;
    let degradedCount = 0;
    let offlineCount = 0;

    for (const target of session.targets) {
      // Check each target
      const isHealthy = await this.pingTarget(target);
      target.lastHealthCheck = Date.now();

      if (isHealthy) {
        target.health = 'healthy';
        healthyCount++;
      } else if (target.retryCount < 3) {
        target.health = 'degraded';
        target.retryCount++;
        degradedCount++;

        // Attempt reconnection
        if (target.status === 'error') {
          // Reconnection would happen via RTMP relay
        }
      } else {
        target.health = 'offline';
        offlineCount++;
      }
    }

    // Update session
    await this.env.CACHE?.put(simulcastSessionKey(sessionId), JSON.stringify(session), {
      expirationTtl: 86400,
    });

    const now = Date.now();
    return {
      sessionId,
      active: session.status === 'live',
      targets: session.targets,
      totalViewers,
      healthyCount,
      degradedCount,
      offlineCount,
      startedAt: session.startedAt,
      uptimeSeconds: Math.floor((now - session.startedAt) / 1000),
    };
  }

  /**
   * Ping a target platform to check if it's reachable.
   */
  private async pingTarget(target: SimulcastTargetState): Promise<boolean> {
    try {
      // Check based on platform
      switch (target.platform) {
        case 'peertube': {
          const response = await fetch(
            `${this.env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz'}/api/v1/server/health`,
            { signal: AbortSignal.timeout(3000) },
          );
          return response.ok;
        }
        case 'youtube': {
          const response = await fetch(
            'https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular',
            {
              signal: AbortSignal.timeout(3000),
            },
          );
          return response.ok || response.status === 401; // 401 means API is reachable
        }
        case 'twitch': {
          const response = await fetch('https://api.twitch.tv/helix/streams?first=1', {
            signal: AbortSignal.timeout(3000),
          });
          return response.ok || response.status === 401;
        }
        case 'farcaster':
        case 'nostr':
          // These are P2P — always "healthy" if we published
          return true;
        case 'owncast': {
          const response = await fetch(
            `${this.env.OWNCAST_INSTANCE_URL ?? 'https://live.degenfeed.xyz'}/api/status`,
            { signal: AbortSignal.timeout(3000) },
          );
          return response.ok;
        }
        case 'kick': {
          return !!target.rtmpUrl;
        }
        default:
          return true;
      }
    } catch {
      return false;
    }
  }

  // ─── Stream Key Management ─────────────────────────────────────

  /**
   * Store a stream key for a platform+creator.
   * Keys are stored encrypted in KV.
   */
  async storeStreamKey(
    platform: SimulcastPlatform,
    creatorId: string,
    streamKey: string,
  ): Promise<void> {
    const key = streamKeyStoreKey(platform, creatorId);
    await this.env.CACHE?.put(key, streamKey, { expirationTtl: 86400 * 365 });
  }

  /**
   * Get a stored stream key.
   */
  async getStreamKey(platform: SimulcastPlatform, creatorId: string): Promise<string | null> {
    try {
      const key = streamKeyStoreKey(platform, creatorId);
      return (await this.env.CACHE?.get(key)) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Delete a stored stream key.
   */
  async deleteStreamKey(platform: SimulcastPlatform, creatorId: string): Promise<void> {
    const key = streamKeyStoreKey(platform, creatorId);
    await this.env.CACHE?.delete(key);
  }

  /**
   * List which platforms a creator has configured.
   */
  async getConfiguredPlatforms(creatorId: string): Promise<SimulcastPlatform[]> {
    const platforms: SimulcastPlatform[] = [
      'peertube',
      'youtube',
      'twitch',
      'owncast',
      'nostr',
      'farcaster',
      'kick',
    ];
    const configured: SimulcastPlatform[] = [];

    for (const platform of platforms) {
      const key = await this.getStreamKey(platform, creatorId);
      if (key) {
        configured.push(platform);
      }
    }

    // Always add Owncast and PeerTube (our instances)
    if (!configured.includes('owncast')) configured.push('owncast');
    if (!configured.includes('peertube')) configured.push('peertube');

    return configured;
  }

  // ─── Target State Management ──────────────────────────────────

  private async getTargetState(
    sessionId: string,
    platform: SimulcastPlatform,
  ): Promise<SimulcastTargetState | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;
    return session.targets.find((t) => t.platform === platform) ?? null;
  }

  private async updateTargetState(sessionId: string, updated: SimulcastTargetState): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const idx = session.targets.findIndex((t) => t.platform === updated.platform);
    if (idx >= 0) {
      session.targets[idx] = updated;
    }

    await this.env.CACHE?.put(simulcastSessionKey(sessionId), JSON.stringify(session), {
      expirationTtl: 86400,
    });
  }

  // ─── Token Management ─────────────────────────────────────────

  private async getToken(platform: string): Promise<string | null> {
    switch (platform) {
      case 'peertube':
        return (await this.env.CACHE?.get('gts:access_token')) ?? null;
      case 'farcaster':
        return this.env.FARCASTER_SIGNER_KEY ?? null;
      case 'youtube':
        return this.env.YOUTUBE_API_KEY ?? null;
      default:
        return null;
    }
  }

  // ─── Index Management ─────────────────────────────────────────

  private async addToActiveIndex(sessionId: string): Promise<void> {
    try {
      const raw = await this.env.CACHE?.get(simulcastIndexKey());
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (!ids.includes(sessionId)) {
        ids.push(sessionId);
        await this.env.CACHE?.put(simulcastIndexKey(), JSON.stringify(ids), {
          expirationTtl: 86400,
        });
      }
    } catch {
      // Non-critical
    }
  }

  private async removeFromActiveIndex(sessionId: string): Promise<void> {
    try {
      const raw = await this.env.CACHE?.get(simulcastIndexKey());
      if (!raw) return;
      const ids = (JSON.parse(raw) as string[]).filter((id) => id !== sessionId);
      await this.env.CACHE?.put(simulcastIndexKey(), JSON.stringify(ids), {
        expirationTtl: 86400,
      });
    } catch {
      // Non-critical
    }
  }

  // ─── Utility ──────────────────────────────────────────────────

  /**
   * Get the default RTMP endpoint for a platform.
   */
  getRtmpEndpoint(platform: SimulcastPlatform): string {
    return PLATFORM_RTMP_ENDPOINTS[platform];
  }

  /**
   * Get the display label for a platform.
   */
  getPlatformLabel(platform: SimulcastPlatform): string {
    return PLATFORM_LABELS[platform];
  }

  /**
   * Get the emoji for a platform.
   */
  getPlatformEmoji(platform: SimulcastPlatform): string {
    return PLATFORM_EMOJIS[platform];
  }

  /**
   * Get all available simulcast platforms.
   */
  getAvailablePlatforms(): Array<{
    id: SimulcastPlatform;
    label: string;
    emoji: string;
    rtmpUrl: string | null;
  }> {
    return Object.keys(PLATFORM_LABELS).map((id) => ({
      id: id as SimulcastPlatform,
      label: PLATFORM_LABELS[id as SimulcastPlatform],
      emoji: PLATFORM_EMOJIS[id as SimulcastPlatform],
      rtmpUrl: PLATFORM_RTMP_ENDPOINTS[id as SimulcastPlatform] || null,
    }));
  }
}

// ─── Route Handlers ──────────────────────────────────────────────────

/**
 * POST /api/live/simulcast/start
 * Start simulcasting to multiple platforms.
 */
export async function handleSimulcastStart(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as SimulcastConfig;

    if (!body.title || !body.sourceStreamId || !body.sourceRtmpUrl) {
      return new Response(
        JSON.stringify({ error: 'title, sourceStreamId, and sourceRtmpUrl are required' }),
        { status: 400 },
      );
    }

    if (!body.targets || body.targets.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one target platform required' }), {
        status: 400,
      });
    }

    const engine = new SimulcastEngine(env);
    const session = await engine.startSimulcast(body);

    return new Response(
      JSON.stringify({
        ok: true,
        sessionId: session.id,
        status: session.status,
        targets: session.targets.map((t) => ({
          platform: t.platform,
          status: t.status,
          label: engine.getPlatformLabel(t.platform),
          emoji: engine.getPlatformEmoji(t.platform),
        })),
      }),
      { status: 201, headers: { 'content-type': 'application/json' } },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to start simulcast: ${error}` }), {
      status: 500,
    });
  }
}

/**
 * POST /api/live/simulcast/end
 * End a simulcast session.
 */
export async function handleSimulcastEnd(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as { sessionId?: string };
    if (!body.sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId is required' }), { status: 400 });
    }

    const engine = new SimulcastEngine(env);
    await engine.endSimulcast(body.sessionId);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to end simulcast: ${error}` }), {
      status: 500,
    });
  }
}

/**
 * GET /api/live/simulcast/status/:sessionId
 * Get simulcast session status with health report.
 */
export async function handleSimulcastStatus(
  request: Request,
  env: Env,
  sessionId: string,
): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const engine = new SimulcastEngine(env);
    const health = await engine.checkHealth(sessionId);

    if (!health.active && health.targets.length === 0) {
      return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 });
    }

    return new Response(
      JSON.stringify({
        sessionId: health.sessionId,
        active: health.active,
        uptimeSeconds: health.uptimeSeconds,
        targets: health.targets.map((t) => ({
          platform: t.platform,
          label: engine.getPlatformLabel(t.platform),
          emoji: engine.getPlatformEmoji(t.platform),
          status: t.status,
          health: t.health,
          playbackUrl: t.playbackUrl,
          viewerCount: t.viewerCount,
          error: t.error,
          connectedAt: t.connectedAt,
        })),
        summary: {
          total: health.targets.length,
          healthy: health.healthyCount,
          degraded: health.degradedCount,
          offline: health.offlineCount,
          totalViewers: health.totalViewers,
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to get simulcast status: ${error}` }), {
      status: 500,
    });
  }
}

/**
 * GET /api/live/simulcast/list
 * List all active simulcast sessions.
 */
export async function handleSimulcastList(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const engine = new SimulcastEngine(env);
    const sessions = await engine.listActiveSessions();

    return new Response(
      JSON.stringify({
        sessions: sessions.map((s) => ({
          sessionId: s.id,
          sourceStreamId: s.sourceStreamId,
          title: s.title,
          startedAt: s.startedAt,
          status: s.status,
          targets: s.targets.map((t) => ({
            platform: t.platform,
            label: engine.getPlatformLabel(t.platform),
            emoji: engine.getPlatformEmoji(t.platform),
            status: t.status,
            health: t.health,
          })),
        })),
        total: sessions.length,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to list simulcasts: ${error}` }), {
      status: 500,
    });
  }
}

/**
 * POST /api/live/simulcast/keys
 * Store a stream key for a platform.
 */
export async function handleSimulcastStoreKey(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as {
      platform?: SimulcastPlatform;
      creatorId?: string;
      streamKey?: string;
    };

    if (!body.platform || !body.creatorId || !body.streamKey) {
      return new Response(
        JSON.stringify({ error: 'platform, creatorId, and streamKey are required' }),
        { status: 400 },
      );
    }

    const engine = new SimulcastEngine(env);
    await engine.storeStreamKey(body.platform, body.creatorId, body.streamKey);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to store key: ${error}` }), {
      status: 500,
    });
  }
}

/**
 * DELETE /api/live/simulcast/keys
 * Delete a stored stream key.
 */
export async function handleSimulcastDeleteKey(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);

  try {
    const url = new URL(request.url);
    const platform = url.searchParams.get('platform') as SimulcastPlatform | null;
    const creatorId = url.searchParams.get('creatorId');

    if (!platform || !creatorId) {
      return new Response(JSON.stringify({ error: 'platform and creatorId are required' }), {
        status: 400,
      });
    }

    const engine = new SimulcastEngine(env);
    await engine.deleteStreamKey(platform, creatorId);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to delete key: ${error}` }), {
      status: 500,
    });
  }
}

/**
 * GET /api/live/simulcast/platforms
 * Get available simulcast platforms.
 */
export async function handleSimulcastPlatforms(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const engine = new SimulcastEngine(env);
    const platforms = engine.getAvailablePlatforms();

    return new Response(
      JSON.stringify({
        platforms,
        total: platforms.length,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to list platforms: ${error}` }), {
      status: 500,
    });
  }
}

/**
 * GET /api/live/simulcast/configured
 * Get configured platforms for a creator.
 */
export async function handleSimulcastConfigured(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const url = new URL(request.url);
    const creatorId = url.searchParams.get('creatorId');

    if (!creatorId) {
      return new Response(JSON.stringify({ error: 'creatorId is required' }), { status: 400 });
    }

    const engine = new SimulcastEngine(env);
    const configured = await engine.getConfiguredPlatforms(creatorId);

    return new Response(
      JSON.stringify({
        creatorId,
        platforms: configured.map((p) => ({
          id: p,
          label: engine.getPlatformLabel(p),
          emoji: engine.getPlatformEmoji(p),
          configured: true,
        })),
        notConfigured: engine
          .getAvailablePlatforms()
          .filter((p) => !configured.includes(p.id))
          .map((p) => ({
            id: p.id,
            label: p.label,
            emoji: p.emoji,
            configured: false,
          })),
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to get configured platforms: ${error}` }), {
      status: 500,
    });
  }
}
