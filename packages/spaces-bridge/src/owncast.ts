/**
 * @degenfeed/spaces-bridge — Owncast Spaces Bridge
 *
 * Owncast is a self-hosted live streaming server that supports:
 *   - HLS playback (audio-only or video)
 *   - WebRTC via WHIP (WebRTC-HTTP ingestion protocol)
 *   - Built-in chat (WebSocket-based, no auth needed for read)
 *   - REST API for stream status and viewer count
 *
 * Our owncast instance is at http://100.64.0.4:8099 (internal)
 * or https://owncast.degenfeed.xyz (external via reverse proxy).
 *
 * Audio-only streams: Configure OBS with audio-only output → Owncast
 * → HLS playback. We embed the HLS player in the Spaces UI.
 *
 * Owncast API endpoints used:
 *   GET  /api/status          — Stream status, viewer count, uptime
 *   GET  /api/chat             — Chat messages (WebSocket upgrade)
 *   GET  /api/config           — Instance config (name, logo, etc.)
 *   POST /api/admin/yp         — Register with directory (optional)
 */

import type { CreateSpaceOptions, PlatformBridge, SpaceItem, SpacePlatformData } from './types';

// ─── Constants ───────────────────────────────────────────────────────────

const OWCAST_INTERNAL = 'http://100.64.0.4:8099';
const OWCAST_EXTERNAL = 'https://owncast.degenfeed.xyz';

/** Default Owncast endpoint (internal for production, configurable) */
function resolveBaseUrl(): string {
  return process.env.OWCAST_INTERNAL_URL ?? process.env.OWCAST_URL ?? OWCAST_INTERNAL;
}

function resolveExternalUrl(): string {
  return process.env.OWCAST_EXTERNAL_URL ?? OWCAST_EXTERNAL;
}

// ─── Types ───────────────────────────────────────────────────────────────

interface OwncastStatus {
  online: boolean;
  viewerCount: number;
  overallPeakViewerCount: number;
  sessionPeakViewerCount: number;
  streamTitle?: string;
  lastConnectTime?: string; // ISO
  lastDisconnectTime?: string; // ISO
}

interface OwncastConfig {
  name: string;
  summary: string;
  logo: string;
  tags: string[];
  chatDisabled: boolean;
}

// ─── HTTP Helper ────────────────────────────────────────────────────────

async function owncastFetch(path: string, options?: RequestInit): Promise<Response> {
  const base = resolveBaseUrl();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'DegenFeed-Spaces/1.0' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`Owncast API error: ${res.status} ${res.statusText} — ${url}`);
  }
  return res;
}

// ─── Bridge Implementation ──────────────────────────────────────────────

export const owncastBridge: PlatformBridge = {
  platform: 'owncast',

  async create(options: CreateSpaceOptions): Promise<SpacePlatformData> {
    const base = resolveBaseUrl();
    const external = resolveExternalUrl();

    // Owncast doesn't have a create-stream API (it's always-on).
    // We set the stream title via the admin API if credentials are configured.
    const adminKey = process.env.OWCAST_ADMIN_KEY;
    if (adminKey && options.title) {
      try {
        await fetch(`${base}/api/admin/config`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${adminKey}`,
          },
          body: JSON.stringify({
            value: {
              name: process.env.OWCAST_INSTANCE_NAME ?? 'DegenFeed Spaces',
              summary: options.description ?? options.title,
            },
            key: 'instanceDetails',
          }),
        });
      } catch (e) {
        console.warn('[owncast-bridge] Failed to update stream title:', e);
      }
    }

    const streamKey = options.owncastStreamKey ?? process.env.OWCAST_STREAM_KEY ?? '';

    // WHIP endpoint for WebRTC ingestion
    const whipUrl = `${base}/api/whip`;
    // HLS playback URL
    const hlsUrl = `${external}/hls/stream.m3u8`;

    return {
      platform: 'owncast',
      nativeId: `owncast-${Date.now()}`,
      url: `${external}/`,
      streamUrl: hlsUrl,
      chatUrl: `${external}/api/chat`,
      metadata: {
        whipUrl,
        streamKey,
        internalUrl: base,
        externalUrl: external,
      },
    };
  },

  async getLiveSpaces(): Promise<SpaceItem[]> {
    try {
      const [statusRes, configRes] = await Promise.all([
        owncastFetch('/api/status'),
        owncastFetch('/api/config').catch(() => null),
      ]);

      const status = (await statusRes.json()) as OwncastStatus;
      const config = configRes ? ((await configRes.json()) as OwncastConfig) : null;

      if (!status.online) return [];

      const external = resolveExternalUrl();
      const id = `owncast-live`;
      const startedAt = status.lastConnectTime
        ? new Date(status.lastConnectTime).getTime()
        : Date.now();

      return [
        {
          id,
          title: status.streamTitle ?? config?.name ?? 'Owncast Space',
          description: config?.summary ?? 'Live via Owncast',
          hostId: 'owncast',
          hostName: config?.name ?? 'Owncast Host',
          hostAvatarUrl: config?.logo ? `${resolveBaseUrl()}${config.logo}` : undefined,
          coHosts: [],
          platforms: [
            {
              platform: 'owncast',
              nativeId: id,
              url: `${external}/`,
              streamUrl: `${external}/hls/stream.m3u8`,
              chatUrl: `${external}/api/chat`,
              metadata: {
                viewerCount: status.viewerCount,
                peakViewers: status.overallPeakViewerCount,
              },
            },
          ],
          status: 'live',
          createdAt: startedAt,
          listeners: status.viewerCount,
          speakers: [
            {
              id: 'owncast-host',
              displayName: config?.name ?? 'Host',
              avatarUrl: config?.logo ? `${resolveBaseUrl()}${config.logo}` : undefined,
              isHost: true,
              isCoHost: false,
              speaking: true,
            },
          ],
          reactions: [],
          tippingEnabled: false,
          tags: config?.tags ?? [],
        },
      ];
    } catch (e) {
      console.warn('[owncast-bridge] Failed to fetch live spaces:', e);
      return [];
    }
  },

  async getSpace(_nativeId: string): Promise<SpaceItem | null> {
    const spaces = await this.getLiveSpaces();
    return spaces[0] ?? null;
  },

  async endSpace(_space: SpaceItem): Promise<void> {
    // Owncast doesn't have an end-stream API with basic auth.
    // The stream naturally ends when the broadcaster disconnects.
    // If admin key is available, we could force-stop:
    const adminKey = process.env.OWCAST_ADMIN_KEY;
    if (adminKey) {
      try {
        await fetch(`${resolveBaseUrl()}/api/admin/disconnect`, {
          method: 'POST',
          headers: { authorization: `Bearer ${adminKey}` },
        });
      } catch (e) {
        console.warn('[owncast-bridge] Failed to disconnect stream:', e);
      }
    }
  },

  async updateSpace(_space: SpaceItem): Promise<void> {
    // Status is fetched live, no write-back needed
  },
};
