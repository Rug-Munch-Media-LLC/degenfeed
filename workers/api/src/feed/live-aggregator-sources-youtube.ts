/**
 * @degenfeed/api-worker — YouTube Live Source Fetcher
 *
 * Fetches YouTube Live streams via YouTube Data API v3.
 * Falls back to RSS feed parsing if API key is not configured.
 */

import type { Env } from '../types';
import { trackSourceHealth } from './live-aggregator-health';
import type { UnifiedLiveStream } from './live-aggregator-types';

/** Fetch YouTube Live streams via YouTube Data API v3 */
export async function fetchYouTubeLiveStreams(env: Env): Promise<UnifiedLiveStream[]> {
  const streams: UnifiedLiveStream[] = [];
  const startTime = Date.now();
  const apiKey = env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return fetchYouTubeViaRSS(env, startTime);
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet,liveStreamingDetails',
      eventType: 'live',
      type: 'video',
      videoDuration: 'any',
      maxResults: '50',
      order: 'viewCount',
      key: apiKey,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
      { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5000) },
    );

    if (!response.ok) {
      return fetchYouTubeCuratedChannels(env, apiKey, startTime);
    }

    const data = (await response.json()) as {
      items: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          channelId: string;
          channelTitle: string;
          publishedAt: string;
          thumbnails: {
            high?: { url: string };
            medium?: { url: string };
            default?: { url: string };
          };
          liveBroadcastContent: string;
        };
      }>;
    };

    if (!data.items?.length) {
      return fetchYouTubeCuratedChannels(env, apiKey, startTime);
    }

    const videoIds = data.items.map((i) => i.id.videoId).filter(Boolean);
    const liveDetails: Record<string, { concurrentViewers?: string }> = {};

    if (videoIds.length > 0) {
      try {
        const detailParams = new URLSearchParams({
          part: 'liveStreamingDetails',
          id: videoIds.join(','),
          key: apiKey,
        });
        const detailResp = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?${detailParams.toString()}`,
          { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5000) },
        );
        if (detailResp.ok) {
          const detailData = (await detailResp.json()) as {
            items: Array<{ id: string; liveStreamingDetails?: { concurrentViewers?: string } }>;
          };
          for (const item of detailData.items || []) {
            if (item.liveStreamingDetails) {
              liveDetails[item.id] = item.liveStreamingDetails;
            }
          }
        }
      } catch {
        // Non-critical
      }
    }

    for (const item of data.items) {
      const videoId = item.id.videoId;
      const snippet = item.snippet;
      if (!videoId || snippet.liveBroadcastContent !== 'live') continue;

      const details = liveDetails[videoId];
      const viewerCount = details?.concurrentViewers
        ? Number.parseInt(details.concurrentViewers, 10) || 0
        : 0;

      streams.push({
        id: `youtube:${videoId}`,
        source: 'youtube',
        title: snippet.title,
        streamer: {
          id: `youtube:channel:${snippet.channelId}`,
          handle: snippet.channelTitle,
          displayName: snippet.channelTitle,
        },
        thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || '',
        viewerCount,
        startedAt: new Date(snippet.publishedAt).getTime(),
        category: 'Gaming',
        tags: ['youtube', 'live'],
        isLive: true,
        embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1`,
        chatEnabled: true,
      });
    }

    await trackSourceHealth(env, 'youtube', streams.length, Date.now() - startTime);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[live-aggregator] YouTube API fetch failed:', error);
    await trackSourceHealth(env, 'youtube', 0, Date.now() - startTime, error);
  }

  return streams;
}

/** Fallback: fetch YouTube via RSS for known curated channels */
async function fetchYouTubeViaRSS(env: Env, startTime: number): Promise<UnifiedLiveStream[]> {
  const streams: UnifiedLiveStream[] = [];

  try {
    const rssBridgeUrl = env.RSS_BRIDGE_URL || 'http://127.0.0.1:8282';

    const response = await fetch(
      `${rssBridgeUrl}/?action=display&bridge=YouTube&context=By+channel+id&type=video&format=Json`,
      { signal: AbortSignal.timeout(8000) },
    );

    if (response.ok) {
      const data = (await response.json()) as Array<{
        title: string;
        uri: string;
        timestamp: number;
        author?: string;
        authorUri?: string;
        thumbnail?: string;
      }>;

      for (const item of data.slice(0, 25)) {
        const videoId = item.uri?.match(/v=([a-zA-Z0-9_-]{11})/)?.[1];
        if (!videoId) continue;

        streams.push({
          id: `youtube:${videoId}`,
          source: 'youtube',
          title: item.title || 'YouTube Stream',
          streamer: {
            id: `youtube:rss:${item.authorUri || item.author || 'unknown'}`,
            handle: item.author || 'unknown',
            displayName: item.author || 'Unknown Streamer',
          },
          thumbnailUrl: item.thumbnail || '',
          viewerCount: 0,
          startedAt: item.timestamp || Date.now(),
          category: 'General',
          tags: ['youtube', 'live'],
          isLive: true,
          embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1`,
          chatEnabled: true,
        });
      }
    }

    await trackSourceHealth(env, 'youtube', streams.length, Date.now() - startTime);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[live-aggregator] YouTube RSS fallback failed:', error);
    await trackSourceHealth(env, 'youtube', 0, Date.now() - startTime, error);
  }

  return streams;
}

/** Fallback: fetch YouTube from curated channel list */
async function fetchYouTubeCuratedChannels(
  env: Env,
  apiKey: string,
  startTime: number,
): Promise<UnifiedLiveStream[]> {
  const streams: UnifiedLiveStream[] = [];
  const curatedChannels: string[] = [];

  let channels: string[] = [];
  try {
    const raw = await env.CACHE?.get('youtube:curated-channels');
    channels = raw ? (JSON.parse(raw) as string[]) : curatedChannels;
  } catch {
    channels = curatedChannels;
  }

  if (channels.length === 0) {
    await trackSourceHealth(env, 'youtube', 0, Date.now() - startTime, 'No curated channels');
    return streams;
  }

  try {
    for (const channelId of channels.slice(0, 5)) {
      const params = new URLSearchParams({
        part: 'snippet',
        channelId,
        eventType: 'live',
        type: 'video',
        maxResults: '5',
        key: apiKey,
      });

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
        { signal: AbortSignal.timeout(3000) },
      );

      if (!response.ok) continue;

      const data = (await response.json()) as {
        items: Array<{
          id: { videoId: string };
          snippet: {
            title: string;
            channelTitle: string;
            publishedAt: string;
            thumbnails: { high?: { url: string } };
          };
        }>;
      };

      for (const item of data.items || []) {
        const videoId = item.id.videoId;
        if (!videoId) continue;
        streams.push({
          id: `youtube:${videoId}`,
          source: 'youtube',
          title: item.snippet.title,
          streamer: {
            id: `youtube:channel:${channelId}`,
            handle: item.snippet.channelTitle,
            displayName: item.snippet.channelTitle,
          },
          thumbnailUrl: item.snippet.thumbnails?.high?.url || '',
          viewerCount: 0,
          startedAt: new Date(item.snippet.publishedAt).getTime(),
          category: 'General',
          tags: ['youtube', 'live', 'curated'],
          isLive: true,
          embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1`,
          chatEnabled: true,
        });
      }
    }

    await trackSourceHealth(env, 'youtube', streams.length, Date.now() - startTime);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[live-aggregator] YouTube curated channels failed:', error);
    await trackSourceHealth(env, 'youtube', 0, Date.now() - startTime, error);
  }

  return streams;
}
