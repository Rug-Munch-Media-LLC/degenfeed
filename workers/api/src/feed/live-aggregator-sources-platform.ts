/**
 * @degenfeed/api-worker — Live Stream Source Fetchers (Non-YouTube)
 *
 * Fetches live streams from Owncast, PeerTube, Twitch, Spaces, Farcaster, Nostr.
 */

import type { Env } from '../types';
import { trackSourceHealth } from './live-aggregator-health';
import type { UnifiedLiveStream } from './live-aggregator-types';

// ═══════════════════════════════════════════════════════════
// 1. Owncast
// ═══════════════════════════════════════════════════════════

interface OwncastStream {
  streamTitle?: string;
  streamCategory?: string;
  viewerCount: number;
  startedAt: string;
  name?: string;
  online: boolean;
  thumbnail: string;
}

interface OwncastStatusResponse {
  name?: string;
  description?: string;
  online: boolean;
  streamTitle?: string;
  viewerCount: number;
  lastConnectTime?: string;
  streamCategory?: string;
}

export async function fetchOwncastStreams(env: Env): Promise<UnifiedLiveStream[]> {
  const instanceUrl = env.OWNCAST_INSTANCE_URL ?? 'https://owncast.degenfeed.xyz';
  const streams: UnifiedLiveStream[] = [];
  const startTime = Date.now();

  try {
    const [statusResp, streamsResp] = await Promise.allSettled([
      fetch(`${instanceUrl}/api/status`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`${instanceUrl}/api/streams`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    if (statusResp.status === 'fulfilled' && statusResp.value.ok) {
      const status = (await statusResp.value.json()) as OwncastStatusResponse;

      if (status.online) {
        streams.push({
          id: `owncast:main`,
          source: 'owncast',
          title: status.streamTitle || 'Untitled Stream',
          streamer: {
            id: 'owncast:system',
            handle: 'owncast',
            displayName: status.name || 'DegenFeed Live',
          },
          thumbnailUrl: `${instanceUrl}/api/stream/thumbnail`,
          viewerCount: status.viewerCount || 0,
          startedAt: status.lastConnectTime
            ? new Date(status.lastConnectTime).getTime()
            : Date.now(),
          category: status.streamCategory || 'General',
          tags: ['live', 'owncast', (status.streamCategory || 'general').toLowerCase()],
          isLive: true,
          embedUrl: `${instanceUrl}/embed/video`,
          chatEnabled: true,
        });
      }
    }

    if (streamsResp.status === 'fulfilled' && streamsResp.value.ok) {
      const streamList = (await streamsResp.value.json()) as OwncastStream[];
      for (const s of streamList) {
        if (s.online && !streams.find((st) => st.id === `owncast:${s.name || 'main'}`)) {
          streams.push({
            id: `owncast:${s.name || 'main'}`,
            source: 'owncast',
            title: s.streamTitle || 'Untitled Stream',
            streamer: {
              id: 'owncast:system',
              handle: s.name || 'owncast',
              displayName: s.name || 'DegenFeed Live',
            },
            thumbnailUrl: s.thumbnail || `${instanceUrl}/api/stream/thumbnail`,
            viewerCount: s.viewerCount || 0,
            startedAt: s.startedAt ? new Date(s.startedAt).getTime() : Date.now(),
            category: s.streamCategory || 'General',
            tags: ['live', 'owncast', (s.streamCategory || 'general').toLowerCase()],
            isLive: true,
            embedUrl: `${instanceUrl}/embed/video`,
            chatEnabled: true,
          });
        }
      }
    }

    await trackSourceHealth(env, 'owncast', streams.length, Date.now() - startTime);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[live-aggregator] Owncast fetch failed:', error);
    await trackSourceHealth(env, 'owncast', 0, Date.now() - startTime, error);
  }

  return streams;
}

// ═══════════════════════════════════════════════════════════
// 2. PeerTube
// ═══════════════════════════════════════════════════════════

interface PeerTubeLiveVideo {
  id: number;
  uuid: string;
  name: string;
  isLive: boolean;
  views: number;
  viewers?: number;
  publishedAt: string;
  thumbnailPath?: string;
  embedPath: string;
  channel: { id: number; name: string; displayName: string; avatar?: { path: string } };
  category?: { id: number; label: string };
  tags?: string[];
  description?: string;
}

interface PeerTubeLiveResponse {
  total: number;
  data: PeerTubeLiveVideo[];
}

export async function fetchPeerTubeStreams(env: Env): Promise<UnifiedLiveStream[]> {
  const instanceUrl = env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';
  const streams: UnifiedLiveStream[] = [];
  const startTime = Date.now();

  try {
    const params = new URLSearchParams({ isLive: 'true', sort: '-publishedAt', count: '50' });
    const response = await fetch(`${instanceUrl}/api/v1/videos?${params.toString()}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`PeerTube API returned ${response.status}`);

    const result = (await response.json()) as PeerTubeLiveResponse;
    for (const video of result.data) {
      if (!video.isLive) continue;
      streams.push({
        id: `peertube:${video.uuid}`,
        source: 'peertube',
        title: video.name,
        streamer: {
          id: `peertube:channel:${video.channel.id}`,
          handle: video.channel.name,
          displayName: video.channel.displayName,
          avatarUrl: video.channel.avatar?.path
            ? `${instanceUrl}${video.channel.avatar.path}`
            : undefined,
        },
        thumbnailUrl: video.thumbnailPath ? `${instanceUrl}${video.thumbnailPath}` : '',
        viewerCount: video.viewers ?? video.views ?? 0,
        startedAt: new Date(video.publishedAt).getTime(),
        category: video.category?.label || 'General',
        tags: video.tags || ['peertube', 'live'],
        isLive: true,
        embedUrl: `${instanceUrl}${video.embedPath}`,
        chatEnabled: true,
        platformMeta: { peertubeId: video.id, uuid: video.uuid, categoryId: video.category?.id },
      });
    }

    await trackSourceHealth(env, 'peertube', streams.length, Date.now() - startTime);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[live-aggregator] PeerTube fetch failed:', error);
    await trackSourceHealth(env, 'peertube', 0, Date.now() - startTime, error);
  }

  return streams;
}

// ═══════════════════════════════════════════════════════════
// 3. Twitch
// ═══════════════════════════════════════════════════════════

export async function fetchTwitchStreams(env: Env): Promise<UnifiedLiveStream[]> {
  const streams: UnifiedLiveStream[] = [];
  const startTime = Date.now();
  const rssBridgeUrl = env.RSS_BRIDGE_URL || 'http://127.0.0.1:8282';

  try {
    const response = await fetch(
      `${rssBridgeUrl}/?action=display&bridge=Twitch&context=Stream&format=Json`,
      { signal: AbortSignal.timeout(8000) },
    );

    if (response.ok) {
      const data = (await response.json()) as Array<{
        title: string;
        uri: string;
        timestamp: number;
        author?: string;
        thumbnail?: string;
        content?: string;
        uid?: string;
      }>;

      for (const item of data.slice(0, 30)) {
        const channelName = item.author || item.uri?.match(/twitch\.tv\/(\w+)/)?.[1];
        if (!channelName) continue;
        let viewerCount = 0;
        if (item.content) {
          const match = item.content.match(/(\d+)\s*viewers/i);
          if (match) viewerCount = Number.parseInt(match[1] ?? '0', 10) || 0;
        }
        streams.push({
          id: `twitch:${channelName}`,
          source: 'twitch',
          title: item.title || `${channelName}'s Stream`,
          streamer: {
            id: `twitch:channel:${channelName}`,
            handle: channelName,
            displayName: channelName,
          },
          thumbnailUrl: item.thumbnail || '',
          viewerCount,
          startedAt: item.timestamp || Date.now(),
          category: 'Gaming',
          tags: ['twitch', 'live', 'gaming'],
          isLive: true,
          embedUrl: `https://player.twitch.tv/?channel=${channelName}&parent=degenfeed.xyz`,
          chatEnabled: true,
        });
      }
    } else {
      try {
        const fallbackResp = await fetch('https://api.twitch.tv/helix/streams?first=20', {
          headers: { accept: 'application/json', 'client-id': 'kimne78kx3ncx6brgo4mv6wki5h1ko' },
          signal: AbortSignal.timeout(5000),
        });
        if (fallbackResp.ok) {
          const twitchData = (await fallbackResp.json()) as {
            data: Array<{
              id: string;
              user_login: string;
              user_name: string;
              title: string;
              viewer_count: number;
              started_at: string;
              thumbnail_url: string;
              game_name: string;
              tags: string[];
            }>;
          };
          for (const s of twitchData.data || []) {
            streams.push({
              id: `twitch:${s.user_login}`,
              source: 'twitch',
              title: s.title,
              streamer: {
                id: `twitch:channel:${s.user_login}`,
                handle: s.user_login,
                displayName: s.user_name,
              },
              thumbnailUrl: s.thumbnail_url.replace('{width}', '320').replace('{height}', '180'),
              viewerCount: s.viewer_count || 0,
              startedAt: new Date(s.started_at).getTime(),
              category: s.game_name || 'Gaming',
              tags: s.tags || ['twitch', 'live'],
              isLive: true,
              embedUrl: `https://player.twitch.tv/?channel=${s.user_login}&parent=degenfeed.xyz`,
              chatEnabled: true,
            });
          }
        }
      } catch {
        /* fallback failed */
      }
    }

    await trackSourceHealth(env, 'twitch', streams.length, Date.now() - startTime);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[live-aggregator] Twitch fetch failed:', error);
    await trackSourceHealth(env, 'twitch', 0, Date.now() - startTime, error);
  }

  return streams;
}

// ═══════════════════════════════════════════════════════════
// 4. DegenFeed Spaces
// ═══════════════════════════════════════════════════════════

export async function fetchDegenFeedSpaces(env: Env): Promise<UnifiedLiveStream[]> {
  const streams: UnifiedLiveStream[] = [];
  const startTime = Date.now();

  try {
    const raw = await env.SPACES?.get('spaces:live');
    const liveIds: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (liveIds.length === 0) return streams;

    const spaceResults = await Promise.all(liveIds.map((id) => env.SPACES?.get(`spaces:${id}`)));
    for (const raw of spaceResults) {
      if (!raw) continue;
      try {
        const space = JSON.parse(raw) as {
          id: string;
          title: string;
          hostName: string;
          hostId: string;
          hostAvatarUrl?: string;
          listeners: number;
          startedAt?: number;
          createdAt: number;
          tags: string[];
          status: string;
          speakers: Array<{ displayName: string; avatarUrl?: string }>;
        };
        if (space.status !== 'live') continue;
        streams.push({
          id: `spaces:${space.id}`,
          source: 'spaces',
          title: space.title,
          streamer: {
            id: `spaces:host:${space.hostId}`,
            handle: space.hostName,
            displayName: space.hostName,
            avatarUrl: space.hostAvatarUrl,
            walletAddress: space.hostId,
          },
          thumbnailUrl: space.hostAvatarUrl || '',
          viewerCount: space.listeners || 0,
          startedAt: space.startedAt ?? space.createdAt,
          category: 'Talk Shows & Podcasts',
          tags: space.tags || ['spaces', 'audio', 'talk'],
          isLive: true,
          chatEnabled: true,
          platformMeta: {
            speakerCount: space.speakers?.length || 0,
            speakers: space.speakers?.map((s) => ({ name: s.displayName, avatarUrl: s.avatarUrl })),
          },
        });
      } catch {
        /* skip corrupted */
      }
    }
    await trackSourceHealth(env, 'spaces', streams.length, Date.now() - startTime);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[live-aggregator] Spaces fetch failed:', error);
    await trackSourceHealth(env, 'spaces', 0, Date.now() - startTime, error);
  }
  return streams;
}

// ═══════════════════════════════════════════════════════════
// 5. Farcaster
// ═══════════════════════════════════════════════════════════

export async function fetchFarcasterLiveStreams(env: Env): Promise<UnifiedLiveStream[]> {
  const streams: UnifiedLiveStream[] = [];
  const startTime = Date.now();

  try {
    const { getActiveFarcasterLives, detectFarcasterLives, farcasterToUnifiedStream } =
      await import('../lib/farcaster-live-wrapper');

    const activeSessions = await getActiveFarcasterLives(env);
    for (const session of activeSessions) {
      if (session.isRestreaming) {
        streams.push(await farcasterToUnifiedStream(session));
      }
    }

    const detected = await detectFarcasterLives(env);
    for (const live of detected) {
      if (!streams.find((s) => s.platformMeta?.fid === live.fid)) {
        streams.push({
          id: `farcaster:live:${live.fid}`,
          source: 'farcaster',
          title: live.title || `${live.displayName}'s Stream`,
          streamer: {
            id: `farcaster:fid:${live.fid}`,
            handle: live.username,
            displayName: live.displayName,
            avatarUrl: live.thumbnailUrl,
          },
          thumbnailUrl: live.thumbnailUrl || '',
          viewerCount: 0,
          startedAt: Date.now(),
          category: 'Live',
          tags: ['farcaster', 'live', 'frame'],
          isLive: true,
          embedUrl: live.activityUrl,
          chatEnabled: true,
          platformMeta: { fid: live.fid, castHash: live.castHash, hlsUrl: live.hlsUrl },
        });
      }
    }
    await trackSourceHealth(env, 'farcaster', streams.length, Date.now() - startTime);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[live-aggregator] Farcaster fetch failed:', error);
    await trackSourceHealth(env, 'farcaster', 0, Date.now() - startTime, error);
  }
  return streams;
}

// ═══════════════════════════════════════════════════════════
// 6. Nostr
// ═══════════════════════════════════════════════════════════

export async function fetchNostrLiveStreams(env: Env): Promise<UnifiedLiveStream[]> {
  const streams: UnifiedLiveStream[] = [];
  const startTime = Date.now();

  try {
    const { nostrPlatformWrapper } = await import('../lib/video-platform-wrapper');
    const nostrStreams = await nostrPlatformWrapper.detectLiveStreams(env);
    streams.push(...nostrStreams);
    await trackSourceHealth(env, 'nostr', streams.length, Date.now() - startTime);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[live-aggregator] Nostr fetch failed:', error);
    await trackSourceHealth(env, 'nostr', 0, Date.now() - startTime, error);
  }
  return streams;
}
