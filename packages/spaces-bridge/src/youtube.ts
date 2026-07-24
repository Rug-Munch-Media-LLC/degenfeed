/**
 * @degenfeed/spaces-bridge — YouTube Live Bridge
 *
 * YouTube Live API integration for broadcasting spaces as live streams.
 *
 * API: https://developers.google.com/youtube/v3/live/docs/liveBroadcasts
 * Requires: YOUTUBE_API_KEY + OAuth 2.0 credentials
 *
 * Environment variables:
 *   YOUTUBE_API_KEY        — API key for searching (read-only)
 *   YOUTUBE_CLIENT_ID      — OAuth client ID
 *   YOUTUBE_CLIENT_SECRET  — OAuth client secret
 *   YOUTUBE_REFRESH_TOKEN  — OAuth refresh token for posting
 */

import type { CreateSpaceOptions, PlatformBridge, SpaceItem, SpacePlatformData } from './types';

// ─── Constants ───────────────────────────────────────────────────────────

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

// ─── OAuth token management ─────────────────────────────────────────────

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token;
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('YouTube OAuth credentials not configured');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    throw new Error(`YouTube OAuth refresh failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 60000,
  };
  return data.access_token;
}

// ─── Bridge Implementation ──────────────────────────────────────────────

export const youTubeBridge: PlatformBridge = {
  platform: 'youtube',

  async create(options: CreateSpaceOptions): Promise<SpacePlatformData> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error('YOUTUBE_API_KEY not configured');

    const token = await getAccessToken();

    // Step 1: Create the live broadcast
    const broadcastRes = await fetch(
      `${YOUTUBE_API}/liveBroadcasts?part=snippet,status,contentDetails`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            title: options.title,
            description: options.description ?? `Audio/Video space hosted by ${options.hostName}`,
            scheduledStartTime: options.scheduledAt ?? new Date().toISOString(),
          },
          status: {
            privacyStatus: options.youTubePrivacy ?? 'public',
            selfDeclaredMadeForKids: false,
          },
          contentDetails: {
            enableAutoStart: true,
            enableAutoStop: true,
            monitorStream: { enableMonitorStream: false },
          },
        }),
      },
    );

    if (!broadcastRes.ok) {
      const err = (await broadcastRes.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new Error(
        `YouTube broadcast creation failed: ${err?.error?.message ?? broadcastRes.status}`,
      );
    }

    const broadcast = (await broadcastRes.json()) as {
      id?: string;
      snippet?: { thumbnails?: { default?: { url?: string } } };
    };

    // Step 2: Create the live stream
    const streamRes = await fetch(`${YOUTUBE_API}/liveStreams?part=snippet,cdn,status`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        snippet: { title: options.title },
        cdn: {
          frameRate: '60fps',
          ingestionType: 'rtmp',
          resolution: '1080p',
        },
      }),
    });

    if (!streamRes.ok) {
      throw new Error(`YouTube stream creation failed: ${streamRes.status}`);
    }

    const liveStream = (await streamRes.json()) as {
      id?: string;
      cdn?: { ingestionInfo?: { ingestionAddress?: string; streamName?: string } };
    };

    // Step 3: Bind broadcast to stream
    if (broadcast.id && liveStream.id) {
      await fetch(
        `${YOUTUBE_API}/liveBroadcasts?part=id&id=${broadcast.id}&streamId=${liveStream.id}`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
        },
      ).catch(() => {
        // Non-critical — binding can be done manually
      });
    }

    const ingestUrl = liveStream.cdn?.ingestionInfo?.ingestionAddress;
    const streamKey = liveStream.cdn?.ingestionInfo?.streamName;

    return {
      platform: 'youtube',
      nativeId: broadcast.id ?? `yt:${Date.now()}`,
      url: `https://www.youtube.com/watch?v=${broadcast.id}`,
      streamUrl: ingestUrl ? `${ingestUrl}/${streamKey}` : undefined,
      metadata: {
        broadcastId: broadcast.id,
        streamId: liveStream.id,
        ingestUrl,
        streamKey,
        thumbnailUrl: broadcast.snippet?.thumbnails?.default?.url,
      },
    };
  },

  async getLiveSpaces(): Promise<SpaceItem[]> {
    // YouTube API v3 doesn't have a simple "list my live streams" endpoint
    // without OAuth. We return empty and rely on the aggregator for search.
    return [];
  },

  async getSpace(nativeId: string): Promise<SpaceItem | null> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return null;

    try {
      const res = await fetch(
        `${YOUTUBE_API}/videos?part=snippet,liveStreamingDetails&id=${nativeId}&key=${apiKey}`,
      );
      if (!res.ok) return null;

      const data = (await res.json()) as {
        items?: Array<{
          id?: string;
          snippet?: {
            title?: string;
            description?: string;
            channelTitle?: string;
            thumbnails?: { default?: { url?: string } };
            publishedAt?: string;
          };
          liveStreamingDetails?: {
            actualStartTime?: string;
            concurrentViewers?: string;
          };
        }>;
      };

      const video = data.items?.[0];
      if (!video?.liveStreamingDetails) return null;

      return {
        id: `youtube:${video.id}`,
        title: video.snippet?.title ?? 'YouTube Live',
        description: video.snippet?.description,
        hostId: 'youtube',
        hostName: video.snippet?.channelTitle ?? 'YouTube Creator',
        hostAvatarUrl: video.snippet?.thumbnails?.default?.url,
        coHosts: [],
        platforms: [
          {
            platform: 'youtube',
            nativeId: video.id ?? nativeId,
            url: `https://www.youtube.com/watch?v=${video.id}`,
            streamUrl: `https://www.youtube.com/embed/${video.id}`,
          },
        ],
        status: video.liveStreamingDetails.actualStartTime ? 'live' : 'scheduled',
        createdAt: video.snippet?.publishedAt
          ? new Date(video.snippet.publishedAt).getTime()
          : Date.now(),
        listeners: Number(video.liveStreamingDetails.concurrentViewers ?? 0),
        speakers: [],
        reactions: [],
        tippingEnabled: false,
        thumbnailUrl: video.snippet?.thumbnails?.default?.url,
      };
    } catch {
      return null;
    }
  },

  async endSpace(space: SpaceItem): Promise<void> {
    const token = await getAccessToken().catch(() => null);
    if (!token) return;

    const ytPlatform = space.platforms.find((p) => p.platform === 'youtube');
    if (!ytPlatform?.nativeId) return;

    // Transition broadcast to complete
    await fetch(`${YOUTUBE_API}/liveBroadcasts?part=status&id=${ytPlatform.nativeId}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: ytPlatform.nativeId,
        status: { lifeCycleStatus: 'complete' },
      }),
    }).catch(() => {});
  },

  async updateSpace(_space: SpaceItem): Promise<void> {
    // YouTube handles updates separately
  },
};
