/**
 * @degenfeed/bridge — Unified Live Feed Aggregator
 *
 * Aggregates live video streams from all available sources for the
 * bridge server's /api/feed/live endpoint.
 *
 * Sources:
 *   1. Owncast    — /api/status (online + offline last-stream info)
 *   2. PeerTube   — /api/v1/videos?isLive=true (real-time streams)
 *   3. Spaces     — @degenfeed/spaces-bridge getLiveSpaces() (YouTube,
 *                   Twitch, Kick, Nostr, LivePeer audio/video spaces)
 *
 * Output shape (per stream):
 *   { platform, title, viewers, thumbnail, url, online, ... }
 */

import { fetchOwncastLiveStreams, type OwncastLiveStream } from './owncast';
import { fetchPeerTubeLiveStreams, type PeerTubeLiveStream } from './peertube';

export interface LiveStreamItem {
  platform: string;
  title: string;
  viewers: number;
  thumbnail: string;
  url: string;
  online: boolean;
  streamer?: string;
  startedAt?: number;
  /** Alias for frontend compatibility (RightSidebar reads viewerCount) */
  viewerCount?: number;
  /** Alias for frontend compatibility (RightSidebar reads hostName) */
  hostName?: string;
  /** Alias for frontend compatibility (RightSidebar reads host) */
  host?: string;
  description?: string;
  tags?: string[];
}

export interface LiveFeedResult {
  streams: LiveStreamItem[];
  total: number;
  online: number;
  platforms: string[];
  fetchedAt: number;
  notices?: string[];
}

/** Map a spaces-bridge SpaceItem into the unified stream shape. */
async function fetchSpaceLiveStreams(): Promise<LiveStreamItem[]> {
  try {
    const { getLiveSpaces } = await import('@degenfeed/spaces-bridge');
    const spaces = await getLiveSpaces({ timeout: 6000 });
    const items: LiveStreamItem[] = [];
    for (const s of spaces) {
      if (s.status !== 'live') continue;
      const platform = s.platforms?.[0]?.platform || 'spaces';
      const url = s.platforms?.[0]?.url || s.platforms?.[0]?.streamUrl || '';
      items.push({
        platform,
        title: s.title || 'Untitled stream',
        viewers: s.listeners || 0,
        thumbnail: s.thumbnailUrl || s.hostAvatarUrl || '',
        url,
        online: true,
        streamer: s.hostName,
        startedAt: s.createdAt,
        viewerCount: s.listeners || 0,
        hostName: s.hostName,
        host: s.hostName,
        description: s.description,
        tags: s.tags,
      });
    }
    return items;
  } catch (e) {
    console.error('[live-feed] Spaces provider failed:', e);
    return [];
  }
}

/**
 * Aggregate all live streams from Owncast, PeerTube, and spaces-bridge
 * into the unified shape consumed by /api/feed/live.
 */
export async function fetchLiveFeed(limit = 50): Promise<LiveFeedResult> {
  const [owncast, peertube, spaces] = await Promise.allSettled([
    fetchOwncastLiveStreams(10),
    fetchPeerTubeLiveStreams(20),
    fetchSpaceLiveStreams(),
  ]);

  const notices: string[] = [];
  const owncastStreams: OwncastLiveStream[] = owncast.status === 'fulfilled' ? owncast.value : [];
  const peertubeStreams: PeerTubeLiveStream[] =
    peertube.status === 'fulfilled' ? peertube.value : [];
  const spaceStreams: LiveStreamItem[] = spaces.status === 'fulfilled' ? spaces.value : [];

  if (owncast.status === 'rejected') notices.push('owncast: unavailable');
  if (peertube.status === 'rejected') notices.push('peertube: unavailable');
  if (spaces.status === 'rejected') notices.push('spaces: unavailable');

  // Normalize all sources into the unified shape
  const all: LiveStreamItem[] = [
    ...owncastStreams.map(
      (s): LiveStreamItem => ({
        platform: s.platform,
        title: s.title,
        viewers: s.viewers,
        thumbnail: s.thumbnail,
        url: s.url,
        online: s.online,
        streamer: s.streamer,
        startedAt: s.startedAt,
        viewerCount: s.viewers,
        hostName: s.streamer,
        host: s.streamer,
      }),
    ),
    ...peertubeStreams.map(
      (s): LiveStreamItem => ({
        platform: s.platform,
        title: s.title,
        viewers: s.viewers,
        thumbnail: s.thumbnail,
        url: s.url,
        online: s.online,
        streamer: s.streamer,
        startedAt: s.startedAt,
        viewerCount: s.viewers,
        hostName: s.streamer,
        host: s.streamer,
      }),
    ),
    ...spaceStreams,
  ];

  // Deduplicate by (platform, url) — keep first occurrence
  const seen = new Set<string>();
  const deduped: LiveStreamItem[] = [];
  for (const s of all) {
    const key = `${s.platform}:${s.url}`;
    if (!s.url) continue; // skip streams with no URL
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
  }

  // Sort: online first, then by viewers desc
  const sorted = [...deduped].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return (b.viewers || 0) - (a.viewers || 0);
  });

  const streams = sorted.slice(0, limit);
  return {
    streams,
    total: streams.length,
    online: streams.filter((s) => s.online).length,
    platforms: [...new Set(streams.map((s) => s.platform))],
    fetchedAt: Date.now(),
    ...(notices.length > 0 ? { notices } : {}),
  };
}
