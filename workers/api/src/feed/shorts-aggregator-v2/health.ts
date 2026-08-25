/**
 * @degenfeed/api-worker — Shorts Source Health Checking
 *
 * Quick health check for all short-form video sources.
 */

import type { Env } from '../../types';
import type { ExtendedSource, SourceHealth } from './types';
import { ALL_SOURCES } from './types';

/**
 * Quick health check for all sources.
 */
export async function checkSourcesHealth(env: Env): Promise<SourceHealth[]> {
  const checks = ALL_SOURCES.map(async (source) => {
    try {
      switch (source) {
        case 'peertube': {
          const res = await fetch(
            'https://sepiasearch.org/api/v1/search/videos?search=test&start=0&count=1',
          );
          return makeHealthy(source, res.ok);
        }
        case 'youtube':
          return makeHealthy(source, true);
        case 'tiktok_rss':
          return makeHealthy(source, true);
        case 'instagram':
          return makeHealthy(source, true);
        case 'loops': {
          const loopsUrl = env.LOOPS_INSTANCE_URL || 'https://loops.video';
          const res = await fetch(`${loopsUrl}/api/v1/status`, {
            signal: AbortSignal.timeout(3000),
          });
          return makeHealthy(source, res.ok);
        }
        case 'owncast': {
          const owncastUrl = env.OWNCAST_INSTANCE_URL || 'https://owncast.degenfeed.xyz';
          const res = await fetch(`${owncastUrl}/api/status`, {
            signal: AbortSignal.timeout(3000),
          });
          return makeHealthy(source, res.ok);
        }
        case 'rss_bridge': {
          if (!env.RSS_BRIDGE_URL) {
            return makeHealthy(source, false, 'RSS_BRIDGE_URL not configured');
          }
          const res = await fetch(env.RSS_BRIDGE_URL, { signal: AbortSignal.timeout(3000) });
          return makeHealthy(source, res.ok);
        }
        case 'lemmy': {
          const lemmyUrl =
            (env.LEMMY_INSTANCES || 'https://lemmy.world').split(',')[0]?.trim() ||
            'https://lemmy.world';
          const res = await fetch(`${lemmyUrl}/api/v3/site`, {
            signal: AbortSignal.timeout(3000),
          });
          return makeHealthy(source, res.ok);
        }
        case 'pixelfed': {
          const pixelfedUrl =
            (env.PIXELFED_INSTANCES || 'https://pixelfed.social').split(',')[0]?.trim() ||
            'https://pixelfed.social';
          const res = await fetch(`${pixelfedUrl}/api/v1/instance`, {
            signal: AbortSignal.timeout(3000),
          });
          return makeHealthy(source, res.ok);
        }
        case 'atprotocol': {
          const bskyUrl = env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';
          const res = await fetch(`${bskyUrl}/xrpc/app.bsky.feed.getTimeline?limit=1`, {
            signal: AbortSignal.timeout(3000),
          });
          return makeHealthy(source, res.ok);
        }
        case 'zora': {
          const res = await fetch('https://api.zora.co/graphql', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              query: 'query { tokens(pagination: {limit: 1}) { nodes { token { tokenId } } } }',
            }),
            signal: AbortSignal.timeout(3000),
          });
          return makeHealthy(source, res.ok);
        }
        case 'farcaster': {
          const hubUrl = env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';
          const res = await fetch(`${hubUrl}/v1/info`, { signal: AbortSignal.timeout(3000) });
          return makeHealthy(source, res.ok);
        }
        case 'nostr': {
          const res = await fetch('https://relay.damus.io/api/v1/events?kinds=31388&limit=1', {
            signal: AbortSignal.timeout(5000),
          }).catch(() => new Response(null, { status: 503 }));
          return makeHealthy(source, res.ok);
        }
        case 'lens': {
          const lensApiUrl = env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';
          const res = await fetch(lensApiUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ query: 'query { ping }' }),
            signal: AbortSignal.timeout(5000),
          });
          return makeHealthy(source, res.ok);
        }
        case 'bluesky': {
          const bskyUrl = env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';
          const res = await fetch(`${bskyUrl}/xrpc/app.bsky.feed.getTimeline?limit=1`, {
            signal: AbortSignal.timeout(5000),
          });
          return makeHealthy(source, res.ok);
        }
        default:
          return makeHealthy(source, false, 'Unknown source');
      }
    } catch (err) {
      return makeHealthy(source, false, err instanceof Error ? err.message : String(err));
    }
  });

  return Promise.all(checks);
}

function makeHealthy(source: ExtendedSource, healthy: boolean, error?: string): SourceHealth {
  return {
    source,
    healthy,
    lastFetch: Date.now(),
    error,
    videosCount: 0,
  } as SourceHealth;
}
