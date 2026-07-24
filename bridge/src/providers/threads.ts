/**
 * Threads Provider — Meta Threads Graph API
 *
 * Uses @degenfeed/threads-sdk to fetch from Threads.
 * Note: Meta's Threads API is primarily a publishing API — it can read
 * YOUR OWN threads but not arbitrary public profiles. This provider
 * uses a configured Threads auth account for live content.
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const THREADS_API = 'https://graph.threads.net/v1.0';

export const schema: SchemaGuard = {
  id: 'threads',
  name: 'Threads (Meta)',
  description: 'Meta Threads via Graph API + curated handles',
  endpoint: '/api/feed/threads',
  requiresAuth: true,
  authEnvVar: 'THREADS_ACCESS_TOKEN',
  contentType: 'text',
};

const CURATED_HANDLES = [
  'zuck',
  'mosseri',
  'cdixon',
  'balajis',
  'saylor',
  'apompliano',
  'iamdcryptowife',
];

async function fetchThreadsHandle(
  handle: string,
  token: string,
  limit: number,
): Promise<UnifiedPost[]> {
  try {
    // First get user ID from handle (Threads doesn't have handle -> ID lookup)
    // Try public web scrape as fallback
    const res = await fetch(`https://www.threads.net/@${handle}`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const html = await res.text();
    // Extract user ID from the page
    const userIdMatch = html.match(/"user_id":"(\d+)"/);
    const userId = userIdMatch?.[1];
    if (!userId) return [];

    // Try to get threads via Graph API (requires token with that user)
    if (token) {
      const graphRes = await fetch(
        `${THREADS_API}/${userId}/threads?fields=id,timestamp,permalink,text,media_type,media_product_type,like_count,reply_count,repost_count&limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (graphRes.ok) {
        const data = (await graphRes.json()) as {
          data?: Array<{
            id: string;
            timestamp: string;
            permalink?: string;
            text?: string;
            like_count?: number;
            reply_count?: number;
            repost_count?: number;
          }>;
        };
        if (data.data) {
          return data.data.map((post) => ({
            id: `threads:${post.id}`,
            protocol: 'threads' as const,
            author: {
              id: `threads:${userId}`,
              primary: { protocol: 'threads' as const, id: userId },
              handles: { threads: handle },
              displayName: handle,
              bio: '',
              avatarUrl: '',
              followerCount: 0,
              followingCount: 0,
              links: [],
              keys: {},
            },
            text: post.text || '',
            embeds: [],
            contentType: 'text' as const,
            createdAt: new Date(post.timestamp).getTime(),
            metrics: {
              likes: post.like_count || 0,
              reposts: post.repost_count || 0,
              replies: post.reply_count || 0,
              quotes: 0,
            },
            engagement: {
              viewerLiked: false,
              viewerReposted: false,
              viewerBookmarked: false,
              raw: {
                likes: post.like_count || 0,
                reposts: post.repost_count || 0,
                replies: post.reply_count || 0,
                quotes: 0,
              },
            },
            raw: post,
            niches: ['crypto'],
          }));
        }
      }
    }

    // Fallback: extract from HTML (very basic)
    return [];
  } catch {
    return [];
  }
}

export async function fetchThreadsPosts(limit = 20): Promise<UnifiedPost[]> {
  const token = process.env.THREADS_ACCESS_TOKEN || '';
  const all: UnifiedPost[] = [];
  const perHandle = Math.max(1, Math.ceil(limit / CURATED_HANDLES.length));

  for (const handle of CURATED_HANDLES) {
    if (all.length >= limit) break;
    const posts = await fetchThreadsHandle(handle, token, perHandle);
    all.push(...posts);
  }

  console.log(`[bridge] Threads: ${all.length} posts`);
  return all.slice(0, limit);
}

export { fetchThreadsPosts as fetch };
