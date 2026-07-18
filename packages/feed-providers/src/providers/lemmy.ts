/**
 * LemmyProvider — Federated Reddit alternative (ActivityPub).
 *
 * Every Lemmy instance exposes a REST API at /api/v3/ for community
 * discovery and post listing with real engagement (upvotes, comments).
 * Communities are distributed across instances for redundancy; if an
 * instance is down, we fall through to the next available instance.
 *
 * Strategy:
 *   1. Resolve community by instance domain, fall back to alternates
 *   2. Fetch Hot posts from 50+ communities across 10+ federated instances
 *   3. Return sorted by engagement with real metrics
 *   4. discoverCommunities() for community browsing across the fediverse
 */

import { enrichPostNiches, subscriberTier } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import { buildUrl, DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT, fetchJson, withTimeout } from '../utils';

/**
 * Priority-ordered list of Lemmy instances to query.
 * Our self-hosted community.degenfeed.xyz comes first so we
 * prioritize local content, then fall through to the fediverse.
 * 12 instances total covering the broadest federated network.
 */
export const LEMMY_INSTANCES = [
  'https://community.degenfeed.xyz',
  'https://lemmy.world',
  'https://lemmy.ml',
  'https://programming.dev',
  'https://sh.itjust.works',
  'https://lemmy.dbzer0.com',
  'https://sopuli.xyz',
  'https://lemm.ee',
  'https://feddit.org',
  'https://lemmy.zip',
  'https://discuss.tchncs.de',
];

/** Map of niche -> display label for category filtering */
export const LEMMY_NICHE_LABELS: Record<string, string> = {
  crypto: 'Crypto',
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum',
  solana: 'Solana',
  defi: 'DeFi',
  nft: 'NFT',
  trading: 'Trading',
  tech: 'Tech',
  security: 'Security',
  privacy: 'Privacy',
  gaming: 'Gaming',
  art: 'Art',
  science: 'Science',
  opensource: 'Open Source',
  degen: 'Degen',
  news: 'News',
  memes: 'Memes',
  governance: 'Governance',
  regulation: 'Regulation',
  ai: 'AI',
  music: 'Music',
  philosophy: 'Philosophy',
};

const CURATED_COMMUNITIES: Array<{ community: string; niche: string }> = [
  // ── DegenFeed local communities (self-hosted) ─────────────────
  { community: 'crypto@community.degenfeed.xyz', niche: 'crypto' },
  { community: 'defi@community.degenfeed.xyz', niche: 'defi' },
  { community: 'nft@community.degenfeed.xyz', niche: 'nft' },
  { community: 'tech@community.degenfeed.xyz', niche: 'tech' },
  { community: 'trading@community.degenfeed.xyz', niche: 'trading' },
  { community: 'memes@community.degenfeed.xyz', niche: 'memes' },
  { community: 'news@community.degenfeed.xyz', niche: 'news' },
  { community: 'governance@community.degenfeed.xyz', niche: 'governance' },
  { community: 'security@community.degenfeed.xyz', niche: 'security' },
  { community: 'privacy@community.degenfeed.xyz', niche: 'privacy' },
  { community: 'gaming@community.degenfeed.xyz', niche: 'gaming' },
  { community: 'art@community.degenfeed.xyz', niche: 'art' },
  { community: 'music@community.degenfeed.xyz', niche: 'music' },
  { community: 'science@community.degenfeed.xyz', niche: 'science' },
  { community: 'philosophy@community.degenfeed.xyz', niche: 'philosophy' },

  // ── Crypto / Web3 ─────────────────────────────────────────────
  { community: 'cryptocurrency@lemmy.world', niche: 'crypto' },
  { community: 'bitcoin@lemmy.ml', niche: 'bitcoin' },
  { community: 'bitcoin@lemmy.world', niche: 'bitcoin' },
  { community: 'ethereum@lemmy.ml', niche: 'ethereum' },
  { community: 'solana@lemmy.world', niche: 'solana' },
  { community: 'solana@programming.dev', niche: 'solana' },
  { community: 'defi@lemmy.world', niche: 'defi' },
  { community: 'defi@lemmy.ml', niche: 'defi' },
  { community: 'blockchain@lemmy.world', niche: 'crypto' },
  { community: 'web3@lemmy.world', niche: 'crypto' },
  { community: 'web3@programming.dev', niche: 'crypto' },
  { community: 'nostr@lemmy.world', niche: 'crypto' },
  { community: 'nostr@lemmy.ml', niche: 'crypto' },
  { community: 'monero@lemmy.ml', niche: 'privacy' },
  { community: 'crypto@lemmy.world', niche: 'crypto' },
  { community: 'cryptodev@lemmy.world', niche: 'crypto' },
  { community: 'ethdev@lemmy.world', niche: 'crypto' },
  { community: 'CryptoCurrency@discuss.tchncs.de', niche: 'crypto' },

  // ── DeFi / Yields ────────────────────────────────────────────
  { community: 'yields@lemmy.world', niche: 'defi' },
  { community: 'liquidity@lemmy.world', niche: 'defi' },
  { community: 'nft@lemmy.world', niche: 'nft' },

  // ── Security ──────────────────────────────────────────────────
  { community: 'security@lemmy.world', niche: 'security' },
  { community: 'security@lemmy.ml', niche: 'security' },
  { community: 'cybersecurity@programming.dev', niche: 'security' },
  { community: 'cybersecurity@lemmy.world', niche: 'security' },
  { community: 'netsec@lemmy.world', niche: 'security' },
  { community: 'hack@lemmy.world', niche: 'security' },

  // ── Privacy ───────────────────────────────────────────────────
  { community: 'privacy@lemmy.world', niche: 'privacy' },
  { community: 'privacy@lemmy.ml', niche: 'privacy' },
  { community: 'privacy@lemmy.zip', niche: 'privacy' },
  { community: 'privacy@lemm.ee', niche: 'privacy' },
  { community: 'privacyguides@lemmy.one', niche: 'privacy' },
  { community: 'tor@lemmy.ml', niche: 'privacy' },
  { community: 'degoogling@lemmy.ml', niche: 'privacy' },
  { community: 'vpn@lemmy.world', niche: 'privacy' },

  // ── Gaming ────────────────────────────────────────────────────
  { community: 'gaming@lemmy.world', niche: 'gaming' },
  { community: 'gaming@lemm.ee', niche: 'gaming' },
  { community: 'games@lemmy.ml', niche: 'gaming' },
  { community: 'patientgamers@lemmy.world', niche: 'gaming' },

  // ── Science / Tech ────────────────────────────────────────────
  { community: 'science@lemmy.ml', niche: 'science' },
  { community: 'science@lemmy.world', niche: 'science' },
  { community: 'physics@lemmy.world', niche: 'science' },
  { community: 'space@lemmy.world', niche: 'science' },
  { community: 'technology@lemmy.world', niche: 'tech' },
  { community: 'technology@programming.dev', niche: 'tech' },
  { community: 'tech@lemm.ee', niche: 'tech' },
  { community: 'hardware@lemmy.world', niche: 'tech' },
  { community: 'selfhosted@lemmy.world', niche: 'tech' },
  { community: 'selfhosted@lemmy.zip', niche: 'tech' },

  // ── Art / Creative ────────────────────────────────────────────
  { community: 'art@lemmy.world', niche: 'art' },
  { community: 'art@lemm.ee', niche: 'art' },
  { community: 'photography@lemmy.world', niche: 'art' },
  { community: 'design@lemmy.world', niche: 'art' },

  // ── General / Discussion ──────────────────────────────────────
  { community: 'memes@lemmy.ml', niche: 'degen' },
  { community: 'fediverse@lemmy.world', niche: 'crypto' },
  { community: 'fediverse@lemmy.ml', niche: 'crypto' },
  { community: 'opensource@lemmy.ml', niche: 'opensource' },
  { community: 'opensource@programming.dev', niche: 'opensource' },
  { community: 'linux@lemmy.ml', niche: 'opensource' },
  { community: 'foss@lemmy.ml', niche: 'opensource' },
  { community: 'piracy@lemmy.dbzer0.com', niche: 'degen' },
  { community: 'rust@programming.dev', niche: 'tech' },
  { community: 'python@programming.dev', niche: 'tech' },
  { community: 'programming@programming.dev', niche: 'tech' },
  { community: 'asklemmy@lemmy.ml', niche: 'crypto' },
  { community: 'asklemmy@lemmy.world', niche: 'crypto' },
  { community: 'shitpost@lemmy.world', niche: 'degen' },
  { community: 'wallstreetbets@lemmy.world', niche: 'trading' },
  { community: 'trading@lemmy.ml', niche: 'trading' },
  { community: 'economics@lemmy.ml', niche: 'regulation' },
  { community: 'startups@lemmy.world', niche: 'tech' },
  { community: 'energy@lemmy.ml', niche: 'science' },
];

// ─── Raw API types ──────────────────────────────────────────────────

interface LemmyPostRaw {
  post: {
    id: number;
    name: string;
    body?: string;
    url?: string;
    published: string;
    score: number;
    upvotes: number;
    downvotes: number;
    comments: number;
    creator?: {
      id: number;
      name: string;
      display_name?: string;
      avatar?: string;
      actor_id?: string;
    };
    community?: {
      id: number;
      name: string;
      title: string;
      actor_id?: string;
      icon?: string;
    };
  };
  counts?: {
    upvotes: number;
    downvotes: number;
    comments: number;
    score: number;
  };
  creator?: {
    id: number;
    name: string;
    display_name?: string;
    avatar?: string;
    actor_id?: string;
  };
  community?: {
    id: number;
    name: string;
    title: string;
    actor_id?: string;
    icon?: string;
  };
}

interface LemmyPostListResponse {
  posts: LemmyPostRaw[];
}

export interface LemmyProviderOptions {
  instances?: string[];
  communities?: Array<{ community: string; niche: string }>;
}

// ─── Community Discovery Types ──────────────────────────────────────

export interface FederatedCommunity {
  id: string;
  name: string;
  instance: string;
  title: string;
  description: string;
  subscribers: number;
  usersActiveMonth: number;
  posts: number;
  niche: string;
  qualityTier: 'low' | 'medium' | 'high' | 'vibrant';
  lastActive: number;
  /** True if this community is on our self-hosted instance */
  isLocal: boolean;
}

export interface DiscoverCommunitiesOptions {
  category?: string;
  instance?: string;
  minSubs?: number;
  search?: string;
  sort?: 'subscribers' | 'active' | 'posts' | 'new';
  limit?: number;
}

// ─── Adapter ────────────────────────────────────────────────────────

/**
 * Converts a raw Lemmy API post into a UnifiedPost with proper
 * community context, dfUri, and all engagement metrics.
 */
export function adaptLemmyPost(raw: LemmyPostRaw, instanceDomain: string): UnifiedPost {
  const p = raw.post;
  const community = raw.community ?? p.community;
  const creator = raw.creator ?? p.creator;
  const counts = raw.counts ?? p;

  const communityName = community?.name ?? 'unknown';
  const communityActorId = community?.actor_id ?? '';
  const instance = instanceDomain.replace(/^https?:\/\//, '');
  const nativeId = `lemmy:${communityName}:${p.id}`;

  // Map community to niche categories
  const curatedEntry = CURATED_COMMUNITIES.find(
    (c) =>
      c.community.split('@')[0] === communityName || c.community === `${communityName}@${instance}`,
  );
  const curatedNiche = curatedEntry?.niche ?? 'crypto';

  // Determine quality tier from raw counts (passed through from Lemmy API)
  const rawCounts = (raw as unknown as Record<string, unknown>).counts as
    | { subscribers?: number; users_active_month?: number }
    | undefined;
  const subs = rawCounts?.subscribers ?? 0;
  const usersActiveMonth = rawCounts?.users_active_month ?? 0;
  const qualityTier = subscriberTier(subs);

  // Determine content type
  const contentType = p.url ? 'link' : p.body ? 'article' : 'text';

  // Build embeds
  const embeds: Array<{ kind: 'image' | 'video' | 'link'; url: string }> = [];
  if (p.url) {
    // Check if URL is an image
    const isImage = /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(p.url);
    embeds.push({ kind: isImage ? 'image' : 'link', url: p.url });
  }

  return {
    id: `lemmy:${nativeId}`,
    protocol: 'lemmy',
    type: contentType,
    text: p.body || p.name || '',
    html: p.body || '',
    authorId: creator?.actor_id ?? `lemmy:${creator?.id ?? 0}`,
    authorName: creator?.display_name || creator?.name || 'anon',
    authorAvatar: creator?.avatar ?? '',
    createdAt: new Date(p.published).getTime(),
    community: {
      name: communityName,
      title: community?.title ?? communityName,
      actorId: communityActorId,
      icon: community?.icon,
      instance,
      subscriberCount: subs,
      usersActiveMonth,
      niche: curatedNiche,
      qualityTier,
    },
    metrics: {
      likes: counts?.upvotes ?? p.upvotes ?? 0,
      reposts: 0,
      replies: counts?.comments ?? p.comments ?? 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: counts?.upvotes ?? p.upvotes ?? 0,
        reposts: 0,
        replies: counts?.comments ?? p.comments ?? 0,
        quotes: 0,
      },
    },
    embeds,
    url: p.url
      ? `https://community.degenfeed.xyz/post/${p.id}`
      : `https://community.degenfeed.xyz/c/${communityName}`,
    dfUri: `df://lemmy/${instance}/c/${communityName}/${p.id}`,
    contentType,
    niches: [],
    crossPostedTo: [],
    // Carry full raw data for LemmyThreadView
    raw,
  } as unknown as UnifiedPost;
}

// ─── Provider ───────────────────────────────────────────────────────

export class LemmyProvider implements FeedProvider {
  readonly protocol: Protocol = 'lemmy';
  private readonly instances: string[];
  private readonly communities: Array<{ community: string; niche: string }>;

  constructor(options: LemmyProviderOptions = {}) {
    this.instances = options.instances ?? LEMMY_INSTANCES;
    this.communities = options.communities ?? CURATED_COMMUNITIES;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const allPosts: UnifiedPost[] = [];

    const communityBatches = this.communities.slice(0, 25);
    const results = await Promise.allSettled(
      communityBatches.map(async ({ community }) => {
        const parts = community.split('@');
        const communityName = parts[0] ?? community;
        const expectedInstance = parts[1] ? `https://${parts[1]}` : null;

        const tryInstances = expectedInstance
          ? [expectedInstance, ...this.instances.filter((i) => i !== expectedInstance)]
          : this.instances;

        for (const instance of tryInstances) {
          try {
            const data = await withTimeout(
              fetchJson<LemmyPostListResponse>(
                buildUrl(instance, '/api/v3/post/list', {
                  community_name: communityName,
                  sort: 'Hot',
                  limit: '10',
                }),
                { headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' } },
              ),
              Math.min(timeoutMs, 5000),
              `lemmy:${community}`,
            );
            return (data.posts ?? []).map((raw) => adaptLemmyPost(raw, instance));
          } catch {
            /* try next instance */
          }
        }
        return [];
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled') allPosts.push(...r.value);
    }

    if (allPosts.length === 0) {
      return { posts: [], notice: 'Lemmy unavailable' };
    }
    return { posts: allPosts.map(enrichPostNiches) };
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    for (const instance of this.instances) {
      try {
        await withTimeout(
          fetchJson(buildUrl(instance, '/api/v3/site')),
          opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          `lemmy:health:${instance}`,
        );
        return { healthy: true, latencyMs: Math.round(performance.now() - start) };
      } catch {
        /* try next */
      }
    }
    return {
      healthy: false,
      latencyMs: Math.round(performance.now() - start),
      error: 'All Lemmy instances unreachable',
    };
  }
}

// ─── Community Discovery ────────────────────────────────────────────

/**
 * Discover and browse communities across the Lemmy fediverse.
 *
 * Queries the curated community list enriched with live subscriber
 * counts from federated instances. Supports filtering by category,
 * instance, subscriber threshold, and text search.
 */
export async function discoverCommunities(
  options: DiscoverCommunitiesOptions = {},
): Promise<FederatedCommunity[]> {
  const category = options.category?.toLowerCase();
  const searchQuery = options.search?.toLowerCase();
  const instanceFilter = options.instance?.toLowerCase();
  const minSubs = options.minSubs ?? 0;
  const limit = options.limit ?? 50;
  const sort = options.sort ?? 'subscribers';
  const timeoutMs = 5000;

  // Filter curated list by criteria
  const results = CURATED_COMMUNITIES.filter((c) => {
    if (category) {
      // Check both exact match and across niche label mapping
      const matchesNiche =
        c.niche === category ||
        Object.entries(LEMMY_NICHE_LABELS).some(
          ([k, v]) => k === category || v.toLowerCase() === category,
        );
      if (!matchesNiche) return false;
    }
    if (searchQuery && !c.community.toLowerCase().includes(searchQuery)) return false;
    if (instanceFilter) {
      const [, inst] = c.community.split('@');
      if (!inst?.includes(instanceFilter)) return false;
    }
    return true;
  }).map((c) => {
    const parts = c.community.split('@');
    const commName = parts[0] ?? c.community;
    const inst = parts[1];
    const instanceDomain = inst ?? 'community.degenfeed.xyz';
    return {
      id: `lemmy:${commName}@${instanceDomain}`,
      name: commName,
      instance: instanceDomain,
      title: commName,
      description: `${LEMMY_NICHE_LABELS[c.niche] ?? c.niche} community on ${instanceDomain}`,
      subscribers: 0,
      usersActiveMonth: 0,
      posts: 0,
      niche: c.niche,
      qualityTier: 'medium' as 'medium' | 'low' | 'high' | 'vibrant',
      lastActive: Date.now(),
      isLocal: instanceDomain === 'community.degenfeed.xyz',
    } satisfies FederatedCommunity;
  });

  // Try to enrich with live data from instances
  const enriched = await Promise.allSettled(
    results.map(async (community) => {
      const url = `https://${community.instance}`;
      try {
        const data = await withTimeout(
          fetchJson<{
            community_view?: {
              counts?: {
                subscribers: number;
                users_active_month: number;
                posts: number;
              };
            };
          }>(
            buildUrl(url, '/api/v3/community', {
              name: community.name,
            }),
            { headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' } },
          ),
          timeoutMs,
          `lemmy:discover:${community.name}`,
        );
        const counts = data.community_view?.counts;
        if (counts) {
          community.subscribers = counts.subscribers ?? 0;
          community.usersActiveMonth = counts.users_active_month ?? 0;
          community.posts = counts.posts ?? 0;
          community.qualityTier = subscriberTier(community.subscribers);
        }
        return community;
      } catch {
        return community; // return basic info if instance unreachable
      }
    }),
  );

  const communities: FederatedCommunity[] = [];
  for (const r of enriched) {
    if (r.status === 'fulfilled') communities.push(r.value);
  }

  // Sort
  if (sort === 'active') {
    communities.sort((a, b) => b.usersActiveMonth - a.usersActiveMonth);
  } else if (sort === 'posts') {
    communities.sort((a, b) => b.posts - a.posts);
  } else if (sort === 'new') {
    communities.sort((a, b) => b.lastActive - a.lastActive);
  } else {
    communities.sort((a, b) => b.subscribers - a.subscribers);
  }

  // Filter by min subs after enrichment
  const filtered = communities.filter((c) => c.subscribers >= minSubs);

  return filtered.slice(0, limit);
}
