/**
 * Bonfida SNS (Solana Naming Service) Adapter
 *
 * Bonfida provides .sol domain names on the Solana blockchain.
 * Resolves domain names to Solana addresses and reverse resolution.
 *
 * API: https://sns.bonfida.com/resolve/{domain}
 *      https://sns.bonfida.com/reverse/{address}
 */
import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;
const SNS_API = 'https://sns.bonfida.com';

export async function resolveSNS(domain: string): Promise<string | null> {
  try {
    const res = await $fetch(`${SNS_API}/resolve/${encodeURIComponent(domain)}`, {
      headers: { 'User-Agent': 'DegenFeed/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return data?.result || data?.address || null;
  } catch {
    return null;
  }
}

export async function reverseSNS(address: string): Promise<string | null> {
  try {
    const res = await $fetch(`${SNS_API}/reverse/${encodeURIComponent(address)}`, {
      headers: { 'User-Agent': 'DegenFeed/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return data?.result || data?.domain || null;
  } catch {
    return null;
  }
}

export async function fetchBonfidaPosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const domains = ['bonfida.sol', 'serum.sol', 'raydium.sol', 'solana.sol', 'jupiter.sol'];
  for (const domain of domains.slice(0, limit)) {
    const address = await resolveSNS(domain);
    if (!address) continue;
    posts.push({
      id: `bonfida:${domain}`,
      protocol: 'bonfida' as Protocol,
      author: {
        id: `bonfida:${domain}`,
        primary: { protocol: 'bonfida' as Protocol, id: domain },
        handles: { bonfida: domain },
        displayName: domain,
        bio: `SNS Domain: ${domain}`,
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        verified: [{ protocol: 'bonfida', badge: 'SNS' }],
        links: [],
        keys: { solanaAddress: address },
      },
      text: `🌿 SNS Domain ${domain} → ${address.slice(0, 8)}...${address.slice(-4)}`,
      embeds: [],
      createdAt: Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: { domain, address },
      niches: ['identity', 'crypto'],
    });
  }
  return posts;
}
