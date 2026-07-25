/**
 * Unlock Protocol Adapter
 *
 * Unlock Protocol is a membership/subscription protocol.
 * Creators deploy locks and members purchase keys (NFTs).
 *
 * API: https://unlock-protocol.com/developers/
 *      Subgraph: https://subgraph.unlock-protocol.com
 */
import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;

export async function fetchUnlockLocks(network = 1, limit = 5): Promise<any[]> {
  try {
    const subgraph =
      network === 137
        ? 'https://api.studio.thegraph.com/query/1869/unlock-polygon/v2'
        : 'https://api.studio.thegraph.com/query/1869/unlock/v2';
    const res = await $fetch(subgraph, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query Locks($limit: Int!) {
          locks(first: $limit, orderBy: createdAt, orderDirection: desc) {
            id address name tokenAddress
            price totalSupply maxNumberOfKeys
            version
          }
        }`,
        variables: { limit },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    return data?.data?.locks || [];
  } catch {
    return [];
  }
}

export async function fetchUnlockPosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const locks = await fetchUnlockLocks(1, Math.ceil(limit / 2));
  for (const lock of locks) {
    posts.push({
      id: `unlock:${lock.id}`,
      protocol: 'unlock' as Protocol,
      author: {
        id: `unlock:${lock.address}`,
        primary: { protocol: 'unlock' as Protocol, id: lock.address || lock.id },
        handles: { unlock: lock.name || 'Unlock Lock' },
        displayName: lock.name || 'Unlock Membership',
        bio: `Unlock Protocol lock — ${lock.totalSupply || 0} members`,
        avatarUrl: '',
        followerCount: Number(lock.totalSupply || 0),
        followingCount: 0,
        verified: [],
        links: [],
        keys: {},
      },
      text: `🔓 Unlock: "${lock.name || 'Membership'}" — ${lock.price ? `${(Number(lock.price) / 1e18).toFixed(4)} ETH` : 'Free'} — ${lock.totalSupply || 0}/${lock.maxNumberOfKeys || '∞'} claimed`,
      embeds: [],
      createdAt: Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: lock,
      niches: ['identity', 'creator'],
    });
  }
  return posts;
}
