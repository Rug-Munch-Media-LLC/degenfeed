/**
 * /api/feed/farcaster — standalone Farcaster endpoint reading from KV cache.
 * Bypasses the feed pipeline entirely. KV is populated by Talos cron.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { type Env, noCacheJsonResponse } from '../index';

export async function handleFarcasterFeed(_request: Request, env: Env): Promise<Response> {
  const posts: UnifiedPost[] = [];
  if (!env.CACHE) return noCacheJsonResponse({ data: [] });

  try {
    const cached = await env.CACHE.get('farcaster:trending:v4');
    if (!cached) return noCacheJsonResponse({ data: [] });

    const parts = cached.split('|').filter(Boolean);
    for (const part of parts) {
      try {
        const hubData = JSON.parse(part);
        for (const msg of hubData.messages ?? []) {
          const text = msg.data?.castAddBody?.text || '';
          if (text.length < 3) continue;
          posts.push({
            id: 'fc:' + (msg.hash || '').slice(0, 16),
            protocol: 'farcaster',
            author: {
              id: 'fc:kv',
              primary: { protocol: 'farcaster', id: '1' },
              handles: {
                nostr: null,
                farcaster: 'farcaster',
                lens: null,
                bluesky: null,
                threads: null,
                rss: null,
                mastodon: null,
              },
              displayName: 'Farcaster User',
              bio: '',
              avatarUrl: '',
              verified: [],
              followerCount: 0,
              followingCount: 0,
              links: [],
              keys: {},
            },
            text,
            embeds: [],
            niches: ['crypto', 'farcaster'],
            createdAt: Date.now() - Math.floor(Math.random() * 3600000),
            metrics: { likes: 1, reposts: 0, replies: 0, quotes: 0 },
            engagement: {
              viewerLiked: false,
              viewerReposted: false,
              viewerBookmarked: false,
              raw: { likes: 1, reposts: 0, replies: 0, quotes: 0 },
            },
            raw: msg,
          } as unknown as UnifiedPost);
        }
      } catch {
        continue;
      }
    }
  } catch {
    /* KV read failed */
  }

  return noCacheJsonResponse({ data: posts, meta: { total: posts.length, source: 'kv-cache' } });
}
