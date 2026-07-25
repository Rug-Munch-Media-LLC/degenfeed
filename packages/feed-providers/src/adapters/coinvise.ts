/**
 * Coinvise Adapter
 *
 * Coinvise is a platform for creating creator tokens and community currencies.
 *
 * API: https://api.coinvise.co/v1
 */
import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;

export async function fetchCoinviseCreators(limit = 5): Promise<any[]> {
  try {
    const res = await $fetch('https://api.coinvise.co/v1/creators?limit=' + limit, {
      headers: { 'User-Agent': 'DegenFeed/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    return data?.data || data?.creators || [];
  } catch {
    return [];
  }
}

export async function fetchCoinvisePosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const creators = await fetchCoinviseCreators(Math.ceil(limit / 2));
  for (const c of creators) {
    posts.push({
      id: `coinvise:${c.id || c.address || c.username}`,
      protocol: 'coinvise' as Protocol,
      author: {
        id: `coinvise:${c.address || c.id}`,
        primary: { protocol: 'coinvise' as Protocol, id: c.address || c.id },
        handles: { coinvise: c.username || c.name || 'coiny' },
        displayName: c.name || c.username || 'Coinvise Creator',
        bio: c.description || 'Creator on Coinvise',
        avatarUrl: c.avatar || c.image || '',
        followerCount: Number(c.followers || 0),
        followingCount: 0,
        verified: [],
        links: [],
        keys: { evmAddress: c.address || '' },
      },
      text: `🪙 Creator Token: ${c.tokenName || c.name || 'Unknown'} (${c.ticker || c.symbol || '?'})`,
      embeds: [],
      createdAt: Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: c,
      niches: ['crypto', 'creator'],
    });
  }
  return posts;
}
