/**
 * Community feed view — returns trending communities across
 * Reddit, Lemmy, and Farcaster channels.
 *
 * GET /api/feed/communities
 */

import { DEFAULT_SUBREDDITS, LemmyProvider } from '@degenfeed/feed-providers';
import { type Env, jsonResponse } from '../index';

export async function handleCommunities(_request: Request, env: Env): Promise<Response> {
  const cacheKey = 'communities:v1:default';
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* ignore */
  }

  const communities: Array<{
    id: string;
    name: string;
    protocol: string;
    description: string;
    memberCount: number;
    url: string;
  }> = [];

  // Reddit communities
  for (const sub of DEFAULT_SUBREDDITS.slice(0, 15)) {
    communities.push({
      id: `reddit:r/${sub}`,
      name: `r/${sub}`,
      protocol: 'reddit',
      description: `Reddit community for ${sub}`,
      memberCount: 0,
      url: `https://www.reddit.com/r/${sub}/`,
    });
  }

  // Lemmy communities
  try {
    const lemmy = new LemmyProvider();
    const result = await lemmy.fetchFeed({ timeoutMs: 5000 });
    const seen = new Set<string>();
    for (const post of result.posts) {
      const community = post.text.match(/\[(.+?)\]/)?.[1];
      if (community && !seen.has(community)) {
        seen.add(community);
        communities.push({
          id: `lemmy:${community.toLowerCase().replace(/\s+/g, '')}`,
          name: community,
          protocol: 'lemmy',
          description: `Lemmy community: ${community}`,
          memberCount: 0,
          url: `https://lemmy.world/c/${community.toLowerCase().replace(/\s+/g, '')}`,
        });
      }
    }
  } catch {
    /* ignore */
  }

  const response = {
    data: communities.slice(0, 30),
    meta: { total: communities.length, fetchedAt: Date.now() },
  };
  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 });
  } catch {
    /* ignore */
  }
  return jsonResponse(response);
}
