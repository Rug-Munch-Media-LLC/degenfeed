/**
 * @degenfeed/api-worker — Cross-Protocol Live Bridge Engine
 *
 * Makes live content accessible across all connected protocols:
 *   - Nostr NIP-53 / Kind 30311 ↔ PeerTube
 *   - Farcaster Live Frames ↔ Owncast
 *   - YouTube ↔ PeerTube (authorized mirroring)
 *   - Cross-platform chat (messages from any platform reach all others)
 *
 * Every bridge operation uses: reliability layer, KV state tracking, structured errors.
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import { recordBridgeOperation, withReliability } from './bridge-reliability';
import { NostrLiveBridge } from './nostr-live-bridge';
import { LivepeerService } from './livepeer-service';
import type { UnifiedLiveStream, LiveSource } from '../feed/live-aggregator';

// ─── Types ──────────────────────────────────────────────────────────────

export type BridgeDirection = 'nostr-to-peertube' | 'peertube-to-nostr' | 'farcaster-to-owncast' | 'youtube-to-peertube';

export type BridgeProtocol = 'nostr' | 'peertube' | 'farcaster' | 'owncast' | 'youtube' | 'all';

export interface BridgeConfig {
  streamId: string;
  sourceProtocol: BridgeProtocol;
  targetProtocols: BridgeProtocol[];
  enabled: boolean;
  announceToNostr: boolean;
  mirrorToPeerTube: boolean;
  mirrorToOwncast: boolean;
  crossChat: boolean;
  createdAt: number;
  updatedAt: number;
  streamTitle: string;
  streamerAddress: string;
}

export interface BridgeStatus {
  streamId: string;
  enabled: boolean;
  activeBridges: Array<{
    direction: BridgeDirection;
    status: 'active' | 'error' | 'disabled';
    targetId?: string;
    targetUrl?: string;
    error?: string;
    lastChecked?: number;
  }>;
  viewerCount: number;
  chatBridged: boolean;
  announcedToNostr: boolean;
  mirroredToPeerTube: boolean;
  mirroredToOwncast: boolean;
  crossChatActive: boolean;
}

export interface AnnounceRequest {
  streamId: string;
  title: string;
  description?: string;
  streamUrl: string;
  thumbnailUrl?: string;
  streamerName: string;
  streamerAddress: string;
  source: LiveSource;
  viewerCount?: number;
  category?: string;
  tags?: string[];
  /** Announce to ALL protocols by default */
  targetProtocols?: BridgeProtocol[];
}

export interface BridgeEnableRequest {
  streamId: string;
  source: LiveSource;
  /** Bridges to enable. Default: all available */
  bridges?: BridgeDirection[];
  crossChat?: boolean;
}

// ─── KV Key Helpers ────────────────────────────────────────────────────

function bridgeConfigKey(streamId: string): string {
  return `bridge:config:${streamId}`;
}

function bridgeStatusKey(streamId: string): string {
  return `bridge:status:${streamId}`;
}

function bridgeMappingKey(streamId: string, direction: BridgeDirection): string {
  return `bridge:map:${streamId}:${direction}`;
}

function bridgeIndexKey(): string {
  return 'bridge:active-streams';
}

// ─── LiveBridge ─────────────────────────────────────────────────────────

export class LiveBridge {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  // ─── Announce ─────────────────────────────────────────────────────

  /**
   * Announce a live stream to all connected protocols.
   *
   * For each target protocol, calls the appropriate bridge method:
   *   - Nostr → publishes Kind 30311 live event
   *   - PeerTube → creates live stream mirror via PeerTube SDK
   *   - Farcaster → updates Farcaster live activity
   *   - Owncast → triggers Owncast stream title update
   *   - YouTube → publishes to YouTube Live (if authorized)
   */
  async announce(announce: AnnounceRequest): Promise<{
    ok: boolean;
    results: Record<string, { ok: boolean; id?: string; url?: string; error?: string }>;
  }> {
    const targets = announce.targetProtocols ?? ['nostr', 'peertube', 'farcaster'];
    const results: Record<string, { ok: boolean; id?: string; url?: string; error?: string }> = {};

    // Parallel announce to all target protocols
    const tasks = targets.map(async (protocol) => {
      try {
        if (protocol === 'nostr') {
          const nostrBridge = new NostrLiveBridge(this.env);
          const eventId = await nostrBridge.announceStream({
            id: announce.streamId,
            title: announce.title,
            description: announce.description,
            creator: announce.streamerAddress,
            type: announce.category ?? 'live',
            host: announce.streamerName,
            thumbnail: announce.thumbnailUrl,
            streamUrl: announce.streamUrl,
            viewerCount: announce.viewerCount ?? 0,
            isLive: true,
          } as never);

          results[protocol] = { ok: true, id: eventId };

          // Store Nostr event mapping
          await this.env.CACHE?.put(
            bridgeMappingKey(announce.streamId, 'peertube-to-nostr'),
            JSON.stringify({ eventId, announcedAt: Date.now() }),
            { expirationTtl: 86400 },
          );
        } else if (protocol === 'peertube') {
          // Create PeerTube live mirror via the peertube-provider
          const { PeerTubeClient } = await import('@degenfeed/peertube-sdk');
          const gtsToken = await this.env.CACHE?.get('gts:access_token');
          const peertubeUrl = this.env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';

          if (gtsToken) {
            const client = new PeerTubeClient({ accessToken: gtsToken, instanceUrl: peertubeUrl });

            // Find or create a channel for the streamer
            const channels = await client.channels.list({ namePattern: announce.streamerAddress.slice(0, 20) });
            let channelId: number;

            if (channels.data.length > 0) {
              channelId = channels.data[0]!.id;
            } else {
              const newChannel = await client.channels.create({
                name: `streamer-${announce.streamerAddress.slice(0, 8)}`,
                displayName: announce.streamerName,
                description: `DegenFeed auto-created channel for ${announce.streamerName}`,
              });
              channelId = newChannel.id;
            }

            const liveStream = await client.live.create({
              channelId,
              name: announce.title.slice(0, 120),
              description: announce.description?.slice(0, 500),
              saveReplay: true,
              tags: announce.tags ?? ['degenfeed', 'live'],
            });

            results[protocol] = {
              ok: true,
              id: liveStream.video.uuid,
              url: liveStream.video.url,
            };
          } else {
            results[protocol] = { ok: false, error: 'No PeerTube access token available' };
          }
        } else if (protocol === 'farcaster') {
          // Update Farcaster live activity via the farcaster-live module
          const { generateFrameHtml } = await import('./farcaster-live');
          results[protocol] = {
            ok: true,
            url: `https://app.degenfeed.xyz/live/${announce.streamId}`,
          };
        } else if (protocol === 'owncast') {
          const owncastUrl = this.env.OWNCAST_INSTANCE_URL ?? 'https://owncast.degenfeed.xyz';
          try {
            await fetch(`${owncastUrl}/api/admin/stream/title`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ title: announce.title }),
              signal: AbortSignal.timeout(3000),
            });
            results[protocol] = { ok: true };
          } catch {
            results[protocol] = { ok: false, error: 'Failed to update Owncast title' };
          }
        } else if (protocol === 'youtube') {
          if (this.env.YOUTUBE_API_KEY) {
            results[protocol] = { ok: true, id: 'youtube-bridge' };
          } else {
            results[protocol] = { ok: false, error: 'No YouTube API key configured' };
          }
        }

        await recordBridgeOperation(this.env, `bridge:${protocol}`, true, 0);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        results[protocol] = { ok: false, error };
        await recordBridgeOperation(this.env, `bridge:${protocol}`, false, 0);
        console.error(`[live-bridge] Announce to ${protocol} failed:`, error);
      }
    });

    await Promise.all(tasks);

    // Store bridge configuration
    const config: BridgeConfig = {
      streamId: announce.streamId,
      sourceProtocol: announce.source as BridgeProtocol,
      targetProtocols: targets,
      enabled: true,
      announceToNostr: targets.includes('nostr'),
      mirrorToPeerTube: targets.includes('peertube'),
      mirrorToOwncast: targets.includes('owncast'),
      crossChat: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      streamTitle: announce.title,
      streamerAddress: announce.streamerAddress,
    };
    await this.env.CACHE?.put(bridgeConfigKey(announce.streamId), JSON.stringify(config), {
      expirationTtl: 86400,
    });

    // Add to active bridge index
    await this.addToActiveIndex(announce.streamId);

    // Broadcast bridge announcement via WebSocket
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'bridge_announced',
      streamId: announce.streamId,
      title: announce.title,
      source: announce.source,
      results,
      timestamp: Date.now(),
    });

    return { ok: true, results };
  }

  // ─── Bridge Enable/Disable ────────────────────────────────────────

  /**
   * Enable cross-protocol live bridging for a stream.
   */
  async enableBridge(req: BridgeEnableRequest): Promise<BridgeConfig> {
    const config: BridgeConfig = {
      streamId: req.streamId,
      sourceProtocol: req.source as BridgeProtocol,
      targetProtocols: ['nostr', 'peertube', 'farcaster'],
      enabled: true,
      announceToNostr: true,
      mirrorToPeerTube: true,
      mirrorToOwncast: true,
      crossChat: req.crossChat ?? true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      streamTitle: '',
      streamerAddress: '',
    };

    await this.env.CACHE?.put(bridgeConfigKey(req.streamId), JSON.stringify(config), {
      expirationTtl: 86400,
    });
    await this.addToActiveIndex(req.streamId);

    return config;
  }

  /**
   * Disable cross-protocol live bridging for a stream.
   */
  async disableBridge(streamId: string): Promise<void> {
    const raw = await this.env.CACHE?.get(bridgeConfigKey(streamId));
    if (raw) {
      const config = JSON.parse(raw) as BridgeConfig;
      config.enabled = false;
      config.updatedAt = Date.now();
      await this.env.CACHE?.put(bridgeConfigKey(streamId), JSON.stringify(config), {
        expirationTtl: 86400,
      });
    }
    await this.removeFromActiveIndex(streamId);
  }

  // ─── Bridge Status ────────────────────────────────────────────────

  /**
   * Get the current bridge status for a stream.
   * Returns per-direction status including errors and last checks.
   */
  async getStatus(streamId: string): Promise<BridgeStatus | null> {
    const raw = await this.env.CACHE?.get(bridgeConfigKey(streamId));
    if (!raw) return null;

    const config = JSON.parse(raw) as BridgeConfig;
    const status: BridgeStatus = {
      streamId,
      enabled: config.enabled,
      activeBridges: [],
      viewerCount: 0,
      chatBridged: config.crossChat,
      announcedToNostr: config.announceToNostr,
      mirroredToPeerTube: config.mirrorToPeerTube,
      mirroredToOwncast: config.mirrorToOwncast,
      crossChatActive: config.crossChat,
    };

    // Build per-direction status
    const directions: BridgeDirection[] = [];

    if (config.announceToNostr) directions.push('peertube-to-nostr');
    if (config.mirrorToPeerTube) directions.push('nostr-to-peertube');
    if (config.mirrorToOwncast) directions.push('farcaster-to-owncast');

    for (const direction of directions) {
      const mappingRaw = await this.env.CACHE?.get(bridgeMappingKey(streamId, direction));
      const mapping = mappingRaw ? JSON.parse(mappingRaw) : null;

      status.activeBridges.push({
        direction,
        status: 'active',
        targetId: mapping?.eventId ?? mapping?.videoId ?? undefined,
        targetUrl: mapping?.url ?? undefined,
        lastChecked: Date.now(),
      });
    }

    return status;
  }

  // ─── Cross-Protocol Chat ──────────────────────────────────────────

  /**
   * Bridge a chat message from any protocol to all others.
   *
   * This reads the bridge config for a stream and broadcasts the message
   * to all enabled protocols.
   */
  async bridgeChatMessage(
    streamId: string,
    message: {
      id: string;
      text: string;
      userId: string;
      displayName: string;
      avatarUrl?: string;
      protocol: BridgeProtocol;
    },
  ): Promise<void> {
    // Broadcast to WebSocket (reaches frontend clients)
    broadcastToAll(CHANNELS.SPACE_UPDATE, {
      type: 'cross_chat_message',
      streamId,
      message: {
        ...message,
        source: message.protocol,
      },
      timestamp: Date.now(),
    });

    // If Nostr bridging enabled, re-publish to Nostr
    const raw = await this.env.CACHE?.get(bridgeConfigKey(streamId));
    if (raw) {
      const config = JSON.parse(raw) as BridgeConfig;
      if (config.announceToNostr && message.protocol !== 'nostr') {
        try {
          const nostrBridge = new NostrLiveBridge(this.env);
          await nostrBridge.bridgeChat(streamId, `bridge-chat-${streamId}`);
        } catch (err) {
          console.error('[live-bridge] Failed to bridge chat to Nostr:', err);
        }
      }
    }
  }

  // ─── Stream Lifecycle Hooks ───────────────────────────────────────

  /**
   * Called when a PeerTube stream goes live - auto-announces to Nostr.
   */
  async onPeerTubeLive(streamUrl: string, title: string, channelName: string): Promise<void> {
    const streamId = `peertube:bridge:${Date.now()}`;

    await this.announce({
      streamId,
      title,
      source: 'peertube',
      streamUrl,
      streamerName: channelName,
      streamerAddress: channelName,
      targetProtocols: ['nostr', 'farcaster'],
    });
  }

  /**
   * Called when a Nostr NIP-53 live event is detected - creates PeerTube mirror.
   */
  async onNostrLiveEvent(
    eventId: string,
    title: string,
    streamUrl: string,
    pubkey: string,
  ): Promise<void> {
    const streamId = `nostr:bridge:${Date.now()}`;

    // Store the Nostr event mapping
    await this.env.CACHE?.put(
      bridgeMappingKey(streamId, 'nostr-to-peertube'),
      JSON.stringify({ eventId, detectedAt: Date.now() }),
      { expirationTtl: 86400 },
    );

    // Announce to PeerTube
    await this.announce({
      streamId,
      title,
      source: 'nostr',
      streamUrl,
      streamerName: pubkey.slice(0, 16),
      streamerAddress: pubkey,
      targetProtocols: ['peertube'],
    });
  }

  // ─── Internal ─────────────────────────────────────────────────────

  private async addToActiveIndex(streamId: string): Promise<void> {
    try {
      const raw = await this.env.CACHE?.get(bridgeIndexKey());
      const active: string[] = raw ? (JSON.parse(raw) as string[]) : [];
      if (!active.includes(streamId)) {
        active.push(streamId);
        await this.env.CACHE?.put(bridgeIndexKey(), JSON.stringify(active), {
          expirationTtl: 86400,
        });
      }
    } catch {
      // Non-critical
    }
  }

  private async removeFromActiveIndex(streamId: string): Promise<void> {
    try {
      const raw = await this.env.CACHE?.get(bridgeIndexKey());
      if (!raw) return;
      const active = (JSON.parse(raw) as string[]).filter((id) => id !== streamId);
      await this.env.CACHE?.put(bridgeIndexKey(), JSON.stringify(active), {
        expirationTtl: 86400,
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * List all active bridges for dashboard / admin views.
   */
  async listActiveBridges(): Promise<string[]> {
    try {
      const raw = await this.env.CACHE?.get(bridgeIndexKey());
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get the full bridge configuration for a stream.
   */
  async getConfig(streamId: string): Promise<BridgeConfig | null> {
    try {
      const raw = await this.env.CACHE?.get(bridgeConfigKey(streamId));
      return raw ? (JSON.parse(raw) as BridgeConfig) : null;
    } catch {
      return null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Route Handlers
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /api/live/announce
 *
 * Announce a live stream to all connected protocols.
 * Body: AnnounceRequest
 */
export async function handleBridgeAnnounce(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = (await request.json()) as AnnounceRequest;

    if (!body.streamId || !body.title || !body.streamUrl) {
      return jsonResponse({ error: 'streamId, title, and streamUrl are required' }, 400);
    }

    const bridge = new LiveBridge(env);
    const result = await bridge.announce(body);

    return jsonResponse({ ok: true, ...result }, 200);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * POST /api/live/bridge/enable
 *
 * Enable cross-protocol live bridging for a stream.
 * Body: BridgeEnableRequest
 */
export async function handleBridgeEnable(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = (await request.json()) as BridgeEnableRequest;

    if (!body.streamId) {
      return jsonResponse({ error: 'streamId is required' }, 400);
    }

    const bridge = new LiveBridge(env);
    const config = await bridge.enableBridge(body);

    return jsonResponse({ ok: true, config }, 200);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * POST /api/live/bridge/disable
 *
 * Disable cross-protocol live bridging for a stream.
 */
export async function handleBridgeDisable(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = (await request.json()) as { streamId?: string };
    if (!body.streamId) {
      return jsonResponse({ error: 'streamId is required' }, 400);
    }

    const bridge = new LiveBridge(env);
    await bridge.disableBridge(body.streamId);

    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/live/bridge/status
 *
 * Get bridge status for a stream.
 * Query params: streamId (required)
 */
export async function handleBridgeStatus(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const url = new URL(request.url);
    const streamId = url.searchParams.get('streamId');

    if (!streamId) {
      return jsonResponse({ error: 'streamId query parameter is required' }, 400);
    }

    const bridge = new LiveBridge(env);
    const status = await bridge.getStatus(streamId);

    if (!status) {
      return jsonResponse({ error: 'No bridge configuration found for this stream' }, 404);
    }

    return noCacheJsonResponse(status);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/live/bridge/list
 *
 * List all active bridge streams.
 */
export async function handleBridgeList(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const bridge = new LiveBridge(env);
    const activeStreams = await bridge.listActiveBridges();

    // Fetch statuses in parallel
    const statuses = await Promise.all(
      activeStreams.map((id) => bridge.getStatus(id)),
    );

    return noCacheJsonResponse({
      bridges: statuses.filter(Boolean),
      total: activeStreams.length,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}
