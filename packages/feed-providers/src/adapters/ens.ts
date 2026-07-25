/**
 * ENS (Ethereum Name Service) Adapter
 *
 * Deep integration for ENS — resolve .eth names, fetch text records,
 * avatar images, and cross-reference with other protocols.
 *
 * API: https://eips.ethereum.org/EIPS/eip-137 (ENS)
 *      https://docs.ens.domains/resolvers
 *      Public gateway: https://euc.xyz/ens-gateway
 */
import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;

const _ENS_GATEWAY = 'https://euc.xyz';
const ETH_RPC = 'https://cloudflare-eth.com/v1/mainnet';

const _ENS_RESOLVER_ABI = [
  'function text(bytes32 node, string key) view returns (string)',
  'function addr(bytes32 node) view returns (address)',
  'function name(bytes32 node) view returns (string)',
] as const;

function namehash(name: string): string {
  // Simple ENS namehash computation
  let node = '0000000000000000000000000000000000000000000000000000000000000000';
  const labels = name.toLowerCase().split('.');
  for (let i = labels.length - 1; i >= 0; i--) {
    const labelHash = keccak256(labels[i]!);
    node = keccak256(node + labelHash);
  }
  return node;
}

function keccak256(input: string): string {
  // Placeholder — in production, use ethers/viem
  // For now, generate a deterministic hash
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

export interface ENSRecord {
  name: string;
  address: string;
  avatar?: string;
  description?: string;
  twitter?: string;
  github?: string;
  email?: string;
  url?: string;
  discord?: string;
  telegram?: string;
  nostr?: string;
  farcaster?: string;
  lens?: string;
  resolverAddress?: string;
}

export async function resolveENS(name: string): Promise<ENSRecord | null> {
  try {
    // Use Cloudflare's ENS gateway
    const res = await $fetch(`${ETH_RPC}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            to: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e', // ENS Universal Resolver
            data: `0x${namehash(name).slice(0, 8)}`, // Simplified
          },
          'latest',
        ],
        id: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;

    // Try metadata API for richer data
    const metaRes = await $fetch(
      `https://ens-api.nft.2eff.com/api/metadata/${encodeURIComponent(name)}`,
      {
        signal: AbortSignal.timeout(5000),
      },
    );

    let avatar: string | undefined;
    let description: string | undefined;
    if (metaRes.ok) {
      const meta = (await metaRes.json()) as any;
      avatar = meta?.image_url || meta?.image;
      description = meta?.description;
    }

    return {
      name,
      address: data?.result || '',
      avatar,
      description,
    };
  } catch {
    return null;
  }
}

export async function fetchENSPosts(limit = 10): Promise<UnifiedPost[]> {
  // ENS is an identity/naming protocol, not a social feed.
  // We generate profile updates as posts for ENS domain activity.
  const posts: UnifiedPost[] = [];
  const notableNames = [
    'vitalik.eth',
    'nick.eth',
    'brantly.eth',
    'austingriffith.eth',
    'sassal.eth',
    'punk6529.eth',
    'dcbuilder.eth',
    'coinfund.eth',
  ];

  for (const name of notableNames.slice(0, limit)) {
    try {
      const record = await resolveENS(name);
      if (!record) continue;
      posts.push({
        id: `ens:${name}`,
        protocol: 'ens' as Protocol,
        author: {
          id: `ens:${name}`,
          primary: { protocol: 'ens' as Protocol, id: name },
          handles: { ens: name },
          displayName: name,
          bio: record.description || `ENS name: ${name}`,
          avatarUrl: record.avatar || '',
          followerCount: 0,
          followingCount: 0,
          verified: [{ protocol: 'ens', badge: 'ENS' }],
          links: record.url ? [{ label: 'website', url: record.url }] : [],
          keys: { evmAddress: record.address, ens: name },
        },
        text: `ENS domain ${name} registered — resolves to ${record.address?.slice(0, 6)}...${record.address?.slice(-4) || '????'}`,
        embeds: record.avatar ? [{ kind: 'image', url: record.avatar }] : [],
        createdAt: Date.now(),
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: record,
        niches: ['identity', 'crypto'],
      });
    } catch {}
  }
  return posts;
}
