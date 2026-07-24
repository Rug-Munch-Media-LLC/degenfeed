/**
 * Live Stream Provider — Unified live stream detection
 *
 * Aggregates live streams from multiple sources:
 *   - Owncast (self-hosted, port 8092)
 *   - PeerTube Live (self-hosted, port 9011)
 *   - YouTube Live API (optional, needs API key)
 *   - Twitch API (optional, needs client ID)
 *
 * This provider powers the /live page, LIVE badges on profiles,
 * and go-live notifications.
 */

import type { SchemaGuard } from '../server/types';
const $fetch = globalThis.fetch;

const OWNCAST_BASE = 'http://127.0.0.1:8092';
const PEERTUBE_BASE = 'http://127.0.0.1:9011';

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface LiveStreamEntry {
  id: string;
  source: 'owncast' | 'peertube' | 'youtube' | 'twitch';
  title: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatar?: string;
  viewerCount: number;
  startedAt: number;
  thumbnailUrl?: string;
  streamUrl: string;
  embedUrl?: string;
  chatUrl?: string;
  isLive: boolean;
  description?: string;
  tags?: string[];
  /** Extra source-specific metadata */
  metadata?: Record<string, unknown>;
}

interface OwncastStatus {
  online: boolean;
  viewerCount: number;
  streamTitle?: string;
  serverTime?: string;
  lastConnectTime?: string | null;
  lastDisconnectTime?: string | null;
  versionNumber?: string;
}

interface OwncastChatClients {
  clientCount: number;
}

interface PeerTubeVideo {
  id: number;
  uuid: string;
  name: string;
  isLive: boolean;
  description?: string;
  url: string;
  thumbnailPath?: string;
  previewPath?: string;
  embedPath?: string;
  createdAt: string;
  publishedAt?: string;
  account?: {
    id: number;
    name: string;
    displayName: string;
    url: string;
    avatar?: { path: string };
  };
  channel?: {
    id: number;
    name: string;
    displayName: string;
    url: string;
    avatar?: { path: string };
  };
  streamUrl?: string;
  viewers?: number;
}

interface PeerTubeResponse {
  total: number;
  data: PeerTubeVideo[];
}

/* ─── Fetch Owncast Streams ─────────────────────────────────────────── */

async function fetchOwncastStreams(): Promise<LiveStreamEntry[]> {
  try {
    const statusRes = await $fetch(`${OWNCAST_BASE}/api/status`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!statusRes.ok) {
      console.log('[live] Owncast: status unavailable');
      return [];
    }

    const status = (await statusRes.json()) as OwncastStatus;

    if (!status.online) {
      return [];
    }

    // Get viewer count from chat endpoint
    let viewerCount = status.viewerCount || 0;
    try {
      const chatRes = await $fetch(`${OWNCAST_BASE}/api/chat/clients`, {
        signal: AbortSignal.timeout(2000),
      });
      if (chatRes.ok) {
        const chatData = (await chatRes.json()) as OwncastChatClients;
        viewerCount = chatData.clientCount || viewerCount;
      }
    } catch {
      // Fall back to status viewer count
    }

    // Duration since stream started
    const startedAt = status.lastConnectTime
      ? new Date(status.lastConnectTime).getTime()
      : Date.now() - 300000; // Default 5 min ago

    const entry: LiveStreamEntry = {
      id: `owncast:live`,
      source: 'owncast',
      title: status.streamTitle || 'DegenFeed Live Stream',
      creatorName: 'DegenFeed',
      creatorHandle: 'degenfeed',
      viewerCount,
      startedAt,
      thumbnailUrl: `${OWNCAST_BASE}/api/thumbnail`,
      streamUrl: `${OWNCAST_BASE}/api/stream`,
      embedUrl: `${OWNCAST_BASE}/embed`,
      chatUrl: `${OWNCAST_BASE}/api/chat`,
      isLive: true,
      description: 'Self-hosted live stream via Owncast',
      tags: ['decentralized', 'self-hosted', 'owncast', 'live'],
      metadata: {
        platform: 'Owncast',
        rtmpEndpoint: 'rtmp://127.0.0.1:1935/live',
        version: status.versionNumber,
      },
    };

    return [entry];
  } catch (err) {
    console.log(`[live] Owncast: error - ${(err as Error).message}`);
    return [];
  }
}

/* ─── Fetch PeerTube Live Streams ───────────────────────────────────── */

async function fetchPeerTubeLive(): Promise<LiveStreamEntry[]> {
  try {
    const res = await $fetch(
      `${PEERTUBE_BASE}/api/v1/videos?isLive=true&count=20&sort=-publishedAt`,
      {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!res.ok) {
      console.log(`[live] PeerTube live: HTTP ${res.status}`);
      return [];
    }

    const data = (await res.json()) as PeerTubeResponse;
    if (!data.data || data.data.length === 0) {
      console.log('[live] PeerTube live: no live streams');
      return [];
    }

    return data.data.map((video) => {
      const account = video.account || video.channel;
      const creatorName = account?.displayName || account?.name || 'PeerTube Creator';
      const avatarPath = account?.avatar?.path || '';
      const videoUrl = video.url || `${PEERTUBE_BASE}/videos/watch/${video.uuid}`;

      return {
        id: `peertube:live:${video.uuid}`,
        source: 'peertube' as const,
        title: video.name,
        creatorName,
        creatorHandle: account?.name || 'peertube',
        creatorAvatar: avatarPath ? `${PEERTUBE_BASE}${avatarPath}` : undefined,
        viewerCount: video.viewers || 0,
        startedAt: video.publishedAt
          ? new Date(video.publishedAt).getTime()
          : new Date(video.createdAt).getTime(),
        thumbnailUrl: video.previewPath
          ? `${PEERTUBE_BASE}${video.previewPath}`
          : video.thumbnailPath
            ? `${PEERTUBE_BASE}${video.thumbnailPath}`
            : undefined,
        streamUrl: videoUrl,
        embedUrl: video.embedPath ? `${PEERTUBE_BASE}${video.embedPath}` : undefined,
        isLive: true,
        description: video.description || '',
        tags: ['peertube', 'live', 'federated'],
        metadata: {
          platform: 'PeerTube',
          videoId: video.id,
          videoUUID: video.uuid,
        },
      };
    });
  } catch (err) {
    console.log(`[live] PeerTube live: error - ${(err as Error).message}`);
    return [];
  }
}

/* ─── Fetch YouTube Live Streams (optional) ──────────────────────────── */

async function fetchYouTubeLive(): Promise<LiveStreamEntry[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    // No API key configured — skip
    return [];
  }

  const channelIds = (process.env.YOUTUBE_LIVE_CHANNEL_IDS || '').split(',').filter(Boolean);
  if (channelIds.length === 0) return [];

  // YouTube Live Streaming API: GET /youtube/v3/search?eventType=live&type=video&channelId=...
  try {
    const results = await Promise.allSettled(
      channelIds.map(async (channelId) => {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`;
        const res = await $fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return [];

        const data = (await res.json()) as {
          items?: Array<{
            id: { videoId: string };
            snippet: {
              title: string;
              description: string;
              thumbnails: { high?: { url: string }; default?: { url: string } };
              channelTitle: string;
              channelId: string;
              publishedAt: string;
              liveBroadcastContent: string;
            };
          }>;
        };

        return (data.items || [])
          .filter((item) => item.snippet.liveBroadcastContent === 'live')
          .map((item) => ({
            id: `youtube:live:${item.id.videoId}`,
            source: 'youtube' as const,
            title: item.snippet.title,
            creatorName: item.snippet.channelTitle,
            creatorHandle: item.snippet.channelId,
            viewerCount: 0, // Requires separate stats API call
            startedAt: new Date(item.snippet.publishedAt).getTime(),
            thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
            streamUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`,
            isLive: true,
            description: item.snippet.description,
            tags: ['youtube', 'live'],
            metadata: { platform: 'YouTube' },
          }));
      }),
    );

    const streams: LiveStreamEntry[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') streams.push(...r.value);
    }
    return streams;
  } catch (err) {
    console.log(`[live] YouTube: error - ${(err as Error).message}`);
    return [];
  }
}

/* ─── Fetch Twitch Live Streams (optional) ──────────────────────────── */

async function fetchTwitchLive(): Promise<LiveStreamEntry[]> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const twitchUsers = (process.env.TWITCH_LIVE_USERS || '').split(',').filter(Boolean);

  if (!clientId || !clientSecret || twitchUsers.length === 0) return [];

  try {
    // Get app access token
    const tokenRes = await $fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: 'POST', signal: AbortSignal.timeout(5000) },
    );
    if (!tokenRes.ok) return [];
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) return [];

    // Check which users are live
    const userParam = twitchUsers.join('&user_login=');
    const res = await $fetch(`https://api.twitch.tv/helix/streams?user_login=${userParam}`, {
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      data?: Array<{
        id: string;
        user_login: string;
        user_name: string;
        title: string;
        viewer_count: number;
        started_at: string;
        thumbnail_url: string;
        game_name?: string;
        tags?: string[];
      }>;
    };

    return (data.data || []).map((stream) => ({
      id: `twitch:live:${stream.id}`,
      source: 'twitch' as const,
      title: stream.title,
      creatorName: stream.user_name,
      creatorHandle: stream.user_login,
      viewerCount: stream.viewer_count,
      startedAt: new Date(stream.started_at).getTime(),
      thumbnailUrl: stream.thumbnail_url.replace('{width}', '640').replace('{height}', '360'),
      streamUrl: `https://www.twitch.tv/${stream.user_login}`,
      embedUrl: `https://player.twitch.tv/?channel=${stream.user_login}&parent=degenfeed.xyz`,
      isLive: true,
      tags: ['twitch', 'live', stream.game_name || 'streaming'].filter(Boolean) as string[],
      metadata: { platform: 'Twitch', game: stream.game_name },
    }));
  } catch (err) {
    console.log(`[live] Twitch: error - ${(err as Error).message}`);
    return [];
  }
}

/* ─── Main Aggregator ────────────────────────────────────────────────── */

export const schema: SchemaGuard = {
  id: 'live',
  name: 'Live Streams',
  description: 'Aggregated live streams from Owncast, PeerTube, YouTube, and Twitch',
  endpoint: '/api/live',
  requiresAuth: false,
  contentType: 'video',
};

export interface LiveStreamsResult {
  streams: LiveStreamEntry[];
  featured: LiveStreamEntry[];
  total: number;
  sources: Record<string, boolean>;
}

export async function fetchLiveStreams(): Promise<LiveStreamsResult> {
  const sources = {
    owncast: true,
    peertube: true,
    youtube: !!process.env.YOUTUBE_API_KEY,
    twitch: !!(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET),
  };

  const results = await Promise.allSettled([
    fetchOwncastStreams(),
    fetchPeerTubeLive(),
    fetchYouTubeLive(),
    fetchTwitchLive(),
  ]);

  const allStreams: LiveStreamEntry[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allStreams.push(...r.value);
  }

  // Deduplicate by stream URL
  const seen = new Set<string>();
  const unique: LiveStreamEntry[] = [];
  for (const s of allStreams) {
    const key = s.streamUrl;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
  }

  // Sort: most viewers first
  unique.sort((a, b) => b.viewerCount - a.viewerCount);

  // Featured: top 3 streams
  const featured = unique.slice(0, 3);

  return {
    streams: unique,
    featured,
    total: unique.length,
    sources,
  };
}

export const fetch = fetchLiveStreams;
