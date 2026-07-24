/**
 * Related posts endpoint — find posts similar to the given post.
 *
 * GET /api/feed/related?id=<postId>&limit=10
 *
 * Finds posts with overlapping niches, same protocol, similar time window,
 * excluding the original post. Uses the post KV store + feed cache.
 */

import { isEnglishPost, isSpamPost } from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';
import { type Env, jsonResponse } from '../index';

export async function handleRelatedPosts(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const postId = params.get('id');
  const limit = Math.min(Number(params.get('limit')) || 10, 30);

  if (!postId) return jsonResponse({ error: 'id required' }, 400);

  try {
    // Try the post KV store first
    let original: UnifiedPost | null = null;
    const stored = await env.CACHE?.get(`post:${postId}`);
    if (stored) {
      original = JSON.parse(stored) as UnifiedPost;
    }

    // Fall back to feed cache
    if (!original) {
      const feedReq = new Request('https://degenfeed.xyz/api/feed/home?limit=100&sort=hot', {
        headers: { 'user-agent': 'DegenFeed/0.1' },
      });
      const feedRes = await fetch(feedReq);
      if (feedRes.ok) {
        const { data: posts } = (await feedRes.json()) as {
          data: UnifiedPost[];
        };
        original = posts?.find((p) => p.id === postId) ?? null;
        if (original) {
          try {
            await env.CACHE?.put(`post:${postId}`, JSON.stringify(original), {
              expirationTtl: 3600,
            });
          } catch {
            /* KV operation failed -- non-critical, continue */
          }
        }
      }
    }

    if (!original) return jsonResponse({ data: [], meta: { total: 0 } });

    // Fetch recent feed to find related posts
    const feedReq = new Request('https://degenfeed.xyz/api/feed/home?limit=200&sort=new', {
      headers: { 'user-agent': 'DegenFeed/0.1' },
    });
    const feedRes = await fetch(feedReq);
    if (!feedRes.ok) return jsonResponse({ data: [], meta: { total: 0 } });

    const { data: allPosts } = (await feedRes.json()) as {
      data: UnifiedPost[];
    };
    if (!allPosts?.length) return jsonResponse({ data: [], meta: { total: 0 } });

    const originalNiches = new Set(original.niches);

    const scored = allPosts
      .filter((p) => p.id !== postId && !isSpamPost(p) && isEnglishPost(p.text))
      .map((p) => {
        let score = 0;
        for (const n of p.niches) {
          if (originalNiches.has(n)) score += 2;
        }
        if (p.protocol === original.protocol) score += 1;
        const timeDiff = Math.abs(p.createdAt - original.createdAt);
        if (timeDiff < 3600000) score += 2;
        else if (timeDiff < 86400000) score += 1;
        return { post: p, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const related = scored.map((s) => s.post);

    return jsonResponse({
      data: related,
      meta: { total: related.length, sourcePostId: postId },
    });
  } catch {
    return jsonResponse({ error: 'Failed to find related posts' }, 502);
  }
}
