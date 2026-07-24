/**
 * @degenfeed/spaces-bridge — PeerTube Spaces Bridge
 *
 * Maps PeerTube live streams to the unified Spaces format.
 * PeerTube supports audio-only livestreams via RTMP/SRT ingestion.
 *
 * API Reference: packages/peertube-provider/src/livestream.ts
 *
 * Key mappings:
 *   PeerTube livestream     → Space
 *   Stream title            → Space title
 *   Channel owner           → Host
 *   HLS playback URL        → streamUrl
 *   Built-in XMPP chat      → chatUrl
 *   PeerTube viewer count   → listener count
 *   Video UUID              → nativeId
 */

import { PeerTubeLiveStream } from '@degenfeed/peertube-provider';
import type { CreateSpaceOptions, PlatformBridge, SpaceItem, SpacePlatformData } from './types';

// ─── Constants ───────────────────────────────────────────────────────────

const PEERTUBE_INSTANCE = process.env.PEERTUBE_INSTANCE ?? 'https://video.degenfeed.xyz';

// ─── Helper: Get auth token ─────────────────────────────────────────────

function getAccessToken(): string {
  const token = process.env.PEERTUBE_ACCESS_TOKEN;
  if (!token) {
    console.warn('[peertube-bridge] No PEERTUBE_ACCESS_TOKEN configured — read-only mode');
  }
  return token ?? '';
}

// ─── Map PeerTube stream → SpaceItem ───────────────────────────────────

async function mapPeerTubeStreamToSpace(
  videoId: string,
  client: PeerTubeLiveStream,
): Promise<SpaceItem | null> {
  try {
    const status = await client.getStreamStatus(videoId);
    if (!status.isLive) return null;

    // Fetch video details for title/channel info
    const instance = PEERTUBE_INSTANCE;
    const res = await fetch(`${instance}/api/v1/videos/${videoId}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const video = (await res.json()) as {
      name: string;
      description?: string;
      uuid: string;
      url: string;
      embedPath: string;
      channel?: { displayName: string; name: string; url: string; avatar?: { path: string } };
      tags?: string[];
      publishedAt?: string;
    };

    const isAudioOnly = video.tags?.includes('audio-only') ?? false;

    return {
      id: `peertube:${video.uuid}`,
      title: video.name,
      description: video.description ?? '',
      hostId: `peertube:${video.channel?.name ?? 'unknown'}`,
      hostName: video.channel?.displayName ?? 'PeerTube Creator',
      hostAvatarUrl: video.channel?.avatar?.path
        ? `${instance}${video.channel.avatar.path}`
        : undefined,
      coHosts: [],
      platforms: [
        {
          platform: 'peertube',
          nativeId: video.uuid,
          url: video.url,
          streamUrl: `${instance}/w/${video.uuid.split('-').pop() ?? video.uuid}`,
          chatUrl: `${instance}/videos/watch/${video.uuid}/live-chat`,
          metadata: {
            embedPath: video.embedPath,
            isAudioOnly,
            channelName: video.channel?.name,
          },
        },
      ],
      status: 'live',
      createdAt: video.publishedAt ? new Date(video.publishedAt).getTime() : Date.now(),
      listeners: status.viewers,
      speakers: [
        {
          id: `peertube:${video.channel?.name ?? 'creator'}`,
          displayName: video.channel?.displayName ?? 'Creator',
          avatarUrl: video.channel?.avatar?.path
            ? `${instance}${video.channel.avatar.path}`
            : undefined,
          isHost: true,
          isCoHost: false,
          speaking: true,
        },
      ],
      reactions: [],
      tippingEnabled: true,
      tags: video.tags ?? [],
    };
  } catch (e) {
    console.warn(`[peertube-bridge] Failed to map stream ${videoId}:`, e);
    return null;
  }
}

// ─── Bridge Implementation ──────────────────────────────────────────────

export const peertubeBridge: PlatformBridge = {
  platform: 'peertube',

  async create(options: CreateSpaceOptions): Promise<SpacePlatformData> {
    const accessToken = getAccessToken();
    const client = new PeerTubeLiveStream({ accessToken, instanceUrl: PEERTUBE_INSTANCE });

    // Use token info if provided, otherwise create a generic channel
    const channelName =
      options.peertubeTokenSymbol?.toLowerCase() ??
      options.hostName.toLowerCase().replace(/[^a-z0-9]/g, '_') ??
      'degenfeed-space';

    const result = await client.createStream({
      title: options.title,
      description: options.description ?? `Audio space hosted by ${options.hostName}`,
      channelName,
      tags: [...(options.tags ?? []), 'audio-only', 'degenfeed', 'space'],
      tokenAddress: options.peertubeTokenAddress ?? '',
      tokenSymbol: options.peertubeTokenSymbol ?? '',
      creatorAddress: options.peertubeCreatorAddress ?? '',
      tokenGated: options.gating?.type === 'token',
      category: 13, // Tech
      privacy: 1, // Public
    });

    return {
      platform: 'peertube',
      nativeId: result.uuid,
      url: result.url,
      streamUrl: result.playbackUrl,
      chatUrl: result.chatUrl,
      metadata: {
        rtmpUrl: result.rtmpUrl,
        streamKey: result.streamKey,
        embedUrl: result.embedUrl,
        videoId: result.id,
      },
    };
  },

  async getLiveSpaces(): Promise<SpaceItem[]> {
    const accessToken = getAccessToken();
    if (!accessToken) return [];

    const client = new PeerTubeLiveStream({ accessToken, instanceUrl: PEERTUBE_INSTANCE });

    try {
      // Fetch live videos from our instance
      const params = new URLSearchParams({
        isLive: 'true',
        sort: '-publishedAt',
        count: '50',
      });
      const res = await fetch(`${PEERTUBE_INSTANCE}/api/v1/videos?${params.toString()}`, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        total: number;
        data: Array<{ uuid: string; name: string }>;
      };

      const spaces: SpaceItem[] = [];
      for (const video of data.data) {
        const space = await mapPeerTubeStreamToSpace(video.uuid, client);
        if (space) spaces.push(space);
      }
      return spaces;
    } catch (e) {
      console.warn('[peertube-bridge] Failed to fetch live spaces:', e);
      return [];
    }
  },

  async getSpace(nativeId: string): Promise<SpaceItem | null> {
    const accessToken = getAccessToken();
    if (!accessToken) return null;

    const client = new PeerTubeLiveStream({ accessToken, instanceUrl: PEERTUBE_INSTANCE });
    return mapPeerTubeStreamToSpace(nativeId, client);
  },

  async endSpace(space: SpaceItem): Promise<void> {
    const accessToken = getAccessToken();
    if (!accessToken) return;

    const ptPlatform = space.platforms.find((p) => p.platform === 'peertube');
    if (!ptPlatform?.nativeId) return;

    const client = new PeerTubeLiveStream({ accessToken, instanceUrl: PEERTUBE_INSTANCE });
    await client.endStream(ptPlatform.nativeId);
  },

  async updateSpace(space: SpaceItem): Promise<void> {
    const accessToken = getAccessToken();
    if (!accessToken) return;

    const ptPlatform = space.platforms.find((p) => p.platform === 'peertube');
    if (!ptPlatform?.nativeId) return;

    const client = new PeerTubeLiveStream({ accessToken, instanceUrl: PEERTUBE_INSTANCE });
    await client.updateStream(ptPlatform.nativeId, {
      title: space.title,
      description: space.description,
      tags: space.tags,
    });
  },
};
