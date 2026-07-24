import { buildUnifiedPost, detectNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import { DEFAULT_TIMEOUT_MS, fetchJson, withTimeout } from '../utils';

interface PonderTransfer {
  id: string;
  fromAddress: string;
  toAddress: string;
  value: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  chainId: number;
  tokenAddress: string;
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  56: 'BSC',
  137: 'Polygon',
  42161: 'Arbitrum',
  8453: 'Base',
};

const CHAIN_EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io/tx',
  56: 'https://bscscan.com/tx',
  137: 'https://polygonscan.com/tx',
  42161: 'https://arbiscan.io/tx',
  8453: 'https://basescan.org/tx',
};

const PONDER_ENDPOINTS: { port: number; chainId: number }[] = [
  { port: 42069, chainId: 1 },
  { port: 42070, chainId: 56 },
  { port: 42071, chainId: 137 },
  { port: 42072, chainId: 42161 },
];

function transferToUnifiedPost(t: PonderTransfer): UnifiedPost {
  const chainName = CHAIN_NAMES[t.chainId] ?? `Chain ${t.chainId}`;
  const explorer = CHAIN_EXPLORERS[t.chainId];
  const valueNum = Number(t.value) / 1e18;
  const shortValue =
    valueNum > 1000000
      ? `$${(valueNum / 1e6).toFixed(2)}M`
      : valueNum > 1000
        ? `$${(valueNum / 1e3).toFixed(1)}K`
        : `$${valueNum.toFixed(2)}`;

  const fromShort = `${t.fromAddress.slice(0, 6)}...${t.fromAddress.slice(-4)}`;
  const toShort = `${t.toAddress.slice(0, 6)}...${t.toAddress.slice(-4)}`;
  const text = `${shortValue} USDC transferred on ${chainName}\nFrom: ${fromShort}\nTo: ${toShort}`;
  const txUrl = explorer ? `${explorer}/${t.txHash}` : undefined;

  const identity: UnifiedIdentity = {
    id: `ponder:${t.chainId}`,
    primary: { protocol: 'ponder' as Protocol, id: String(t.chainId) },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: null,
    },
    displayName: `${chainName} On-Chain`,
    bio: `Token transfers on ${chainName}`,
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: {},
  };

  const embeds = txUrl ? [{ kind: 'link' as const, url: txUrl }] : [];

  return buildUnifiedPost({
    protocol: 'ponder' as Protocol,
    nativeId: t.id,
    author: identity,
    text,
    embeds,
    createdAt: t.timestamp * 1000,
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    raw: t,
  });
}

export class PonderProvider implements FeedProvider {
  readonly protocol: Protocol = 'ponder' as Protocol;

  readonly schema: SchemaGuard = (): boolean => true;
  private readonly baseUrl: string;

  constructor(baseUrl = 'http://127.0.0.1') {
    this.baseUrl = baseUrl;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const posts: UnifiedPost[] = [];

    for (const ep of PONDER_ENDPOINTS) {
      try {
        const url = `${this.baseUrl}:${ep.port}/graphql`;
        const query = {
          query: `{ tokenTransfers(limit: 25, orderBy: "timestamp", orderDirection: "desc") { items { id fromAddress toAddress value txHash blockNumber timestamp chainId tokenAddress } } }`,
        };
        const data = await withTimeout(
          fetchJson<{ data?: { tokenTransfers?: { items?: PonderTransfer[] } } }>(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(query),
          }),
          timeoutMs,
          `ponder:${ep.chainId}`,
        );
        const items = data?.data?.tokenTransfers?.items ?? [];
        for (const t of items) {
          posts.push(transferToUnifiedPost(t));
        }
      } catch {
        // Ponder instance not ready yet — skip
      }
    }

    for (const p of posts) {
      p.niches = detectNiches(p.text);
    }

    return { posts };
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const timeoutMs = opts.timeoutMs ?? 5000;
    const start = Date.now();
    try {
      const url = `${this.baseUrl}:42070/graphql`;
      await withTimeout(
        fetchJson(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query: '{ _meta { status { bsc { block ready } } } }' }),
        }),
        timeoutMs,
        'ponder-health',
      );
      return { healthy: true, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }
}
