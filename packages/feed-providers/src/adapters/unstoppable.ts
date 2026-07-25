/**
 * Unstoppable Domains Adapter
 *
 * Decentralized domain names on Polygon, Ethereum, and Solana.
 * Resolve .crypto, .x, .polygon, .dao, .nft, .blockchain, .bitcoin, .wallet, .888, .zil
 *
 * API: https://resolve.unstoppabledomains.com/resolve/{domain}
 */
import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;
const RESOLVE_API = 'https://resolve.unstoppabledomains.com/resolve';

export async function resolveUnstoppable(domain: string): Promise<Record<string, string> | null> {
  try {
    const res = await $fetch(`${RESOLVE_API}/${encodeURIComponent(domain)}`, {
      headers: { 'User-Agent': 'DegenFeed/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return data?.records || data?.meta || null;
  } catch {
    return null;
  }
}

export async function fetchUnstoppablePosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const domains = ['crypto.ethereum', 'nft.ethereum', 'dao.ethereum', 'polygon.ethereum'];
  for (const domain of domains.slice(0, limit)) {
    const records = await resolveUnstoppable(domain);
    if (!records) continue;
    posts.push({
      id: `unstoppable:${domain}`,
      protocol: 'unstoppable' as Protocol,
      author: {
        id: `unstoppable:${domain}`,
        primary: { protocol: 'unstoppable' as Protocol, id: domain },
        handles: { unstoppable: domain },
        displayName: domain,
        bio: `Unstoppable Domain: ${domain}. Records available`,
        avatarUrl: records['crypto.ETH.avatar'] || '',
        followerCount: 0,
        followingCount: 0,
        verified: [],
        links: [],
        keys: { evmAddress: records['crypto.ETH.address'] || '' },
      },
      text: `Unstoppable Domain ${domain} — resolved address: ${(records['crypto.ETH.address'] || '').slice(0, 8)}...`,
      embeds: [],
      createdAt: Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: records,
      niches: ['identity', 'crypto'],
    });
  }
  return posts;
}
