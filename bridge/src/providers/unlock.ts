/**
 * Unlock Protocol bridge provider
 *
 * Integrates Unlock Protocol — a membership and token-gated content protocol.
 * Creators deploy locks (NFT membership contracts) and gate content behind them.
 *
 * API: Public subgraph at https://graph.mainnet.unlock-protocol.com/subgraphs/name/unlock
 * Docs: https://docs.unlock-protocol.com
 * SDK: @unlock-protocol/unlock-js
 *
 * Features:
 * - Active membership locks and their metadata
 * - Latest key purchases and membership activity
 * - Token-gated content feeds
 * - Lock statistics (total keys, active members, revenue)
 *
 * Rate Limits: Public subgraph endpoint
 * Auth: None required for reads
 */

import type { UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const UNLOCK_SUBGRAPH =
  process.env.UNLOCK_SUBGRAPH_URL ||
  'https://graph.mainnet.unlock-protocol.com/subgraphs/name/unlock';

// ─── Types ─────────────────────────────────────────────────────────────

interface UnlockLock {
  id: string;
  address: string;
  name: string;
  tokenAddress: string;
  price: string;
  expirationDuration: string;
  totalSupply: string;
  maxNumberOfKeys: string;
  numberOfKeysSold: string;
  totalKeys: string;
  createdAt: number;
  version: number;
  creator: string;
  network: number;
}

interface UnlockKey {
  id: string;
  lock: {
    id: string;
    address: string;
    name: string;
  };
  owner: string;
  tokenId: string;
  expiration: number;
  createdAt: number;
  cancelled: boolean;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface LocksResult {
  locks: UnlockLock[];
}

interface KeysResult {
  keys: UnlockKey[];
}

// ─── Helpers ────────────────────────────────────────────────────────────

function guessNiches(name: string, creator: string): string[] {
  const lower = `${name} ${creator}`.toLowerCase();
  const niches: string[] = [];

  if (/\b(membership|member|club|pass|access|gate|subscription)\b/.test(lower))
    niches.push('membership');
  if (/\b(nft|art|collectible|mint)\b/.test(lower)) niches.push('nft');
  if (/\b(content|creator|writer|blog|newsletter|media)\b/.test(lower)) niches.push('content');
  if (/\b(dao|governance|vote|treasury)\b/.test(lower)) niches.push('dao');
  if (/\b(education|course|learn|tutorial|academy)\b/.test(lower)) niches.push('education');
  if (/\b(gaming|game|guild|play)\b/.test(lower)) niches.push('gaming');
  if (/\b(crypto|web3|blockchain|token)\b/.test(lower)) niches.push('crypto');

  if (niches.length === 0) niches.push('nft');
  return niches;
}

function formatEth(value: string): string {
  const wei = BigInt(value || '0');
  const eth = Number(wei) / 1e18;
  if (eth > 10) return `${eth.toFixed(0)} ETH`;
  if (eth > 0.01) return `${eth.toFixed(4)} ETH`;
  return `${(eth * 1e6).toFixed(0)} gwei`;
}

function getNetworkName(network: number): string {
  const networks: Record<number, string> = {
    1: 'Ethereum',
    10: 'Optimism',
    100: 'Gnosis',
    137: 'Polygon',
    42161: 'Arbitrum',
    8453: 'Base',
    80001: 'Mumbai',
    11155111: 'Sepolia',
  };
  return networks[network] || `Chain ${network}`;
}

function unlockLockToPost(lock: UnlockLock): UnifiedPost | null {
  if (!lock.name) return null;

  const price = formatEth(lock.price);
  const keysSold = lock.numberOfKeysSold || '0';
  const totalKeys = lock.totalKeys || lock.maxNumberOfKeys || '∞';
  const network = getNetworkName(lock.network);

  const ownerAddr = `${lock.creator.slice(0, 6)}...${lock.creator.slice(-4)}`;

  const text = `🔐 ${lock.name}\n\nPrice: ${price} · Keys: ${keysSold}/${totalKeys === '0' ? '∞' : totalKeys} · Network: ${network}\nCreator: ${ownerAddr}`;

  return {
    id: `unlock:${lock.address}`,
    protocol: 'unlock' as string,
    author: {
      id: `unlock:creator:${lock.creator}`,
      primary: { protocol: 'unlock' as string, id: lock.creator },
      handles: { unlock: null },
      displayName: `${lock.name} Creator`,
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: [],
    contentType: 'text',
    createdAt: lock.createdAt ? lock.createdAt * 1000 : Date.now(),
    metrics: {
      likes: parseInt(keysSold, 10) || 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: parseInt(keysSold, 10) ? parseInt(keysSold, 10) * 5 : 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: parseInt(keysSold, 10) || 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: lock,
    niches: guessNiches(lock.name, lock.creator),
    community: {
      name: 'unlock-protocol',
      title: 'Unlock Protocol',
      niche: 'nft,membership',
    },
  };
}

function unlockKeyToPost(key: UnlockKey): UnifiedPost | null {
  const lockName = key.lock?.name || 'Unknown Lock';
  const ownerAddr = `${key.owner.slice(0, 6)}...${key.owner.slice(-4)}`;

  const text = `🔑 New Member: ${ownerAddr} joined ${lockName}${key.expiration > 0 ? ` (expires ${new Date(key.expiration * 1000).toLocaleDateString()})` : ''}`;

  return {
    id: `unlock:key:${key.id}`,
    protocol: 'unlock' as string,
    author: {
      id: `unlock:lock:${key.lock?.id || 'unknown'}`,
      primary: { protocol: 'unlock' as string, id: key.lock?.id || 'unknown' },
      handles: { unlock: null },
      displayName: lockName,
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: [],
    contentType: 'text',
    createdAt: key.createdAt ? key.createdAt * 1000 : Date.now(),
    metrics: {
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: key,
    niches: ['nft', 'membership'],
    community: {
      name: 'unlock-protocol',
      title: 'Unlock Protocol',
      niche: 'nft,membership',
    },
  };
}

async function graphQLQuery<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<GraphQLResponse<T>> {
  try {
    const res = await $fetch(UNLOCK_SUBGRAPH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DegenFeed-Bridge/0.1',
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return {};
    return (await res.json()) as GraphQLResponse<T>;
  } catch (err) {
    console.log(`[bridge] Unlock subgraph error: ${(err as Error).message}`);
    return {};
  }
}

// ─── Data Sources ───────────────────────────────────────────────────────

async function fetchPopularLocks(limit: number): Promise<UnifiedPost[]> {
  const query = `
    query PopularLocks($limit: Int!) {
      locks(
        first: $limit,
        orderBy: totalKeys,
        orderDirection: desc
      ) {
        id
        address
        name
        tokenAddress
        price
        expirationDuration
        totalSupply
        maxNumberOfKeys
        numberOfKeysSold
        totalKeys
        createdAt
        version
        creator
        network
      }
    }
  `;

  const res = await graphQLQuery<LocksResult>(query, { limit: Math.min(limit, 30) });
  const locks = res.data?.locks || [];
  return locks
    .filter((l) => l.name)
    .map(unlockLockToPost)
    .filter((p): p is UnifiedPost => p !== null);
}

async function fetchRecentKeys(limit: number): Promise<UnifiedPost[]> {
  const query = `
    query RecentKeys($limit: Int!) {
      keys(
        first: $limit,
        where: { cancelled: false },
        orderBy: createdAt,
        orderDirection: desc
      ) {
        id
        lock {
          id
          address
          name
        }
        owner
        tokenId
        expiration
        createdAt
        cancelled
      }
    }
  `;

  const res = await graphQLQuery<KeysResult>(query, { limit: Math.min(limit, 20) });
  const keys = res.data?.keys || [];
  return keys
    .filter((k) => !k.cancelled)
    .map(unlockKeyToPost)
    .filter((p): p is UnifiedPost => p !== null);
}

// ─── Schema Guardian ────────────────────────────────────────────────────

export const schema = {
  id: 'unlock',
  name: 'Unlock Protocol',
  description: 'Token-gated memberships & content — NFT locks, keys & creator monetization',
  endpoint: '/api/feed/unlock',
  requiresAuth: false,
  contentType: 'mixed',
};

// ─── Main Fetcher ───────────────────────────────────────────────────────

export async function fetchUnlockPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(5, Math.ceil(limit / 2));

  const [locks, keys] = await Promise.all([
    fetchPopularLocks(perSource),
    fetchRecentKeys(perSource),
  ]);

  const all = [...locks, ...keys];
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];

  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Unlock Protocol: ${deduped.length} posts`);
  return deduped;
}

/** @alias */
export const fetch = fetchUnlockPosts;
