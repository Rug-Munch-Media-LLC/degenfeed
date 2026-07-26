/**
 * @degenfeed/api-worker — Live Stream Control (Go-Live / Stop-Live)
 *
 * Start and stop live streams on Owncast and PeerTube.
 */

import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import type { GoLiveConfig, GoLiveResult } from './live-aggregator-types';
import { resolvePeerTubeCategory } from './live-aggregator-utils';

/**
 * Start a live stream on the selected platform(s).
 * Generates stream keys and configures the backend.
 */
export async function startLiveStream(env: Env, config: GoLiveConfig): Promise<GoLiveResult> {
  const streamId =
    crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const platformMessages: Record<
    string,
    { ok: boolean; id?: string; url?: string; error?: string }
  > = {};
  let streamKey = '';
  let rtmpUrl = '';
  let playbackUrl = '';
  let embedUrl = '';

  const platforms: Array<'owncast' | 'peertube'> =
    config.platform === 'both' ? ['owncast', 'peertube'] : [config.platform];

  for (const platform of platforms) {
    try {
      if (platform === 'owncast') {
        const instanceUrl = env.OWNCAST_INSTANCE_URL ?? 'https://owncast.degenfeed.xyz';
        const key =
          crypto.randomUUID()?.replace(/-/g, '').slice(0, 16) ??
          `${Date.now()}-${Math.random().toString(36).slice(2, 18)}`;
        streamKey = key;
        rtmpUrl = `rtmp://owncast.degenfeed.xyz/live`;
        playbackUrl = `${instanceUrl}/embed/video`;
        embedUrl = `${instanceUrl}/embed/video`;

        try {
          await fetch(`${instanceUrl}/api/admin/stream/title`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: config.title }),
            signal: AbortSignal.timeout(3000),
          });
        } catch {
          // Title update is best-effort
        }

        platformMessages[platform] = { ok: true, id: streamId };
      } else if (platform === 'peertube') {
        const instanceUrl = env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';
        const gtsToken = await env.CACHE?.get('gts:access_token');

        if (gtsToken) {
          const { PeerTubeLiveStream } = await import('@degenfeed/peertube-provider');
          const peertube = new PeerTubeLiveStream({ accessToken: gtsToken, instanceUrl });

          const stream = await peertube.createStream({
            channelName: config.creatorHandle,
            title: config.title,
            description: config.description,
            privacy: config.privacy === 'public' ? 1 : config.privacy === 'unlisted' ? 2 : 3,
            category: resolvePeerTubeCategory(config.category),
            tags: config.tags,
            creatorAddress: config.creatorId,
            tokenAddress: config.creatorId,
            tokenSymbol: config.creatorHandle,
            tokenGated: false,
          });

          streamKey = stream.streamKey;
          rtmpUrl = stream.rtmpUrl;
          playbackUrl = stream.playbackUrl;
          embedUrl = stream.embedUrl;

          platformMessages[platform] = { ok: true, id: stream.uuid, url: stream.url };
        } else {
          streamKey = crypto.randomUUID()?.replace(/-/g, '').slice(0, 16) ?? '';
          rtmpUrl = `rtmp://live.degenfeed.xyz/live`;
          playbackUrl = `${instanceUrl}/w/${streamKey}`;
          embedUrl = `${instanceUrl}/videos/embed/${streamKey}`;
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      platformMessages[platform] = { ok: false, error };
      console.error(`[live-aggregator] Failed to start ${platform} stream:`, error);
    }
  }

  broadcastToAll(CHANNELS.FEED_NEW, {
    type: 'stream_started',
    streamId,
    source: config.platform,
    title: config.title,
    creator: config.creatorId,
    creatorHandle: config.creatorHandle,
    playbackUrl,
    startedAt: Date.now(),
  });

  return { streamKey, rtmpUrl, playbackUrl, embedUrl, streamId, platformMessages };
}

/**
 * Stop a live stream on the selected platform(s).
 */
export async function stopLiveStream(
  env: Env,
  streamId: string,
  platform: 'owncast' | 'peertube' | 'spaces',
): Promise<void> {
  try {
    switch (platform) {
      case 'owncast':
        // Streams end when the RTMP feed disconnects
        break;
      case 'peertube': {
        const gtsToken = await env.CACHE?.get('gts:access_token');
        if (gtsToken && streamId.includes('peertube:')) {
          const uuid = streamId.replace('peertube:', '');
          const instanceUrl = env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';
          await fetch(`${instanceUrl}/api/v1/videos/${uuid}`, {
            method: 'DELETE',
            headers: { authorization: `Bearer ${gtsToken}` },
            signal: AbortSignal.timeout(5000),
          });
        }
        break;
      }
      case 'spaces':
        // Spaces are ended via the existing spaces handler
        break;
    }
  } catch (err) {
    console.error(`[live-aggregator] Failed to stop stream ${streamId}:`, err);
  }

  broadcastToAll(CHANNELS.FEED_NEW, {
    type: 'stream_ended',
    streamId,
    platform,
  });
}
