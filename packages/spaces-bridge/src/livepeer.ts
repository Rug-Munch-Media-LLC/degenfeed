/**
 * @degenfeed/spaces-bridge — LivePeer Spaces Bridge
 *
 * LivePeer is a decentralized video streaming network.
 * Can be used for audio-only livestreams → HLS playback.
 *
 * API: https://docs.livepeer.studio/reference
 *   POST /api/stream        — Create stream → returns RTMP ingest + HLS URL
 *   GET  /api/stream/{id}   — Get stream status
 *   GET  /api/stream/{id}/sessions — Get recording/asset info
 */

import type { CreateSpaceOptions, PlatformBridge, SpaceItem, SpacePlatformData } from './types';

// ─── Constants ───────────────────────────────────────────────────────────

const LIVEPEER_API = 'https://livepeer.studio/api';
const LIVEPEER_GATEWAY = 'https://livepeer.live';

function getApiKey(): string {
  return process.env.LIVEPEER_API_KEY ?? '';
}

// ─── Types ───────────────────────────────────────────────────────────────

interface LivePeerStream {
  id: string;
  streamKey: string;
  playbackId: string;
  name: string;
  kind: string;
  isActive: boolean;
  createdAt: number;
  lastSeen?: number;
  viewers?: number;
  recordingSpec?: { output: Array<{ type: string }> };
}

// ─── Bridge Implementation ──────────────────────────────────────────────

export const livepeerBridge: PlatformBridge = {
  platform: 'livepeer',

  async create(options: CreateSpaceOptions): Promise<SpacePlatformData> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('LIVEPEER_API_KEY not configured');

    const res = await fetch(`${LIVEPEER_API}/stream`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: options.title,
        record: true,
        playbackPolicy: {
          type: options.gating?.type === 'token' ? 'jwt' : 'public',
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`LivePeer API error: ${res.status}`);
    }

    const stream = (await res.json()) as LivePeerStream;

    return {
      platform: 'livepeer',
      nativeId: stream.id,
      streamUrl: `${LIVEPEER_GATEWAY}/${stream.playbackId}/index.m3u8`,
      metadata: {
        streamKey: stream.streamKey,
        playbackId: stream.playbackId,
        ingestUrl: 'rtmp://rtmp.livepeer.live/live',
        apiKeyHint: `${apiKey.slice(0, 8)}...`,
      },
    };
  },

  async getLiveSpaces(): Promise<SpaceItem[]> {
    const apiKey = getApiKey();
    if (!apiKey) return [];

    try {
      const res = await fetch(`${LIVEPEER_API}/stream?filters=[{"id":"isActive","value":true}]`, {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return [];

      const streams = (await res.json()) as LivePeerStream[];
      return streams.map((s) => ({
        id: `livepeer:${s.id}`,
        title: s.name,
        hostId: 'livepeer',
        hostName: 'LivePeer Streamer',
        coHosts: [],
        platforms: [
          {
            platform: 'livepeer',
            nativeId: s.id,
            streamUrl: `${LIVEPEER_GATEWAY}/${s.playbackId}/index.m3u8`,
            metadata: {
              playbackId: s.playbackId,
              viewers: s.viewers,
            },
          },
        ],
        status: 'live' as const,
        createdAt: s.createdAt * 1000,
        listeners: s.viewers ?? 0,
        speakers: [],
        reactions: [],
        tippingEnabled: false,
      }));
    } catch (e) {
      console.warn('[livepeer-bridge] Failed to fetch streams:', e);
      return [];
    }
  },

  async getSpace(nativeId: string): Promise<SpaceItem | null> {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    try {
      const res = await fetch(`${LIVEPEER_API}/stream/${nativeId}`, {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return null;
      const s = (await res.json()) as LivePeerStream;
      if (!s.isActive) return null;

      return {
        id: `livepeer:${s.id}`,
        title: s.name,
        hostId: 'livepeer',
        hostName: 'LivePeer Streamer',
        coHosts: [],
        platforms: [
          {
            platform: 'livepeer',
            nativeId: s.id,
            streamUrl: `${LIVEPEER_GATEWAY}/${s.playbackId}/index.m3u8`,
            metadata: { playbackId: s.playbackId },
          },
        ],
        status: 'live',
        createdAt: s.createdAt * 1000,
        listeners: s.viewers ?? 0,
        speakers: [],
        reactions: [],
        tippingEnabled: false,
      };
    } catch {
      return null;
    }
  },

  async endSpace(space: SpaceItem): Promise<void> {
    const apiKey = getApiKey();
    if (!apiKey) return;

    const lp = space.platforms.find((p) => p.platform === 'livepeer');
    if (!lp?.nativeId) return;

    await fetch(`${LIVEPEER_API}/stream/${lp.nativeId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${apiKey}` },
    }).catch(() => {});
  },

  async updateSpace(): Promise<void> {
    // LivePeer handles stream metadata separately
  },
};
