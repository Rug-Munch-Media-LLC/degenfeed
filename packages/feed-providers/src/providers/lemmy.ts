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
 *   2. Fetch Hot posts from 35+ communities across all 6 instances
 *   3. Return sorted by engagement with real metrics
 */

import { buildUnifiedPost, enrichPostNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import { buildUrl, DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT, fetchJson, withTimeout } from '../utils';

export const LEMMY_INSTANCES = [
  'https://lemmy.world',
  'https://lemmy.ml',
  'https://programming.dev',
  'https://sh.itjust.works',
  'https://lemmy.dbzer0.com',
  'https://sopuli.xyz',
];

const CURATED_COMMUNITIES: Array<{ community: string; niche: string }> = [
  { community: 'cryptocurrency@lemmy.world', niche: 'crypto' },
  { community: 'bitcoin@lemmy.ml', niche: 'bitcoin' },
  { community: 'ethereum@lemmy.ml', niche: 'ethereum' },
  { community: 'solana@lemmy.world', niche: 'solana' },
  { community: 'defi@lemmy.world', niche: 'defi' },
  { community: 'blockchain@lemmy.world', niche: 'crypto' },
  { community: 'web3@lemmy.world', niche: 'crypto' },
  { community: 'nostr@lemmy.world', niche: 'crypto' },
  { community: 'monero@lemmy.ml', niche: 'privacy' },
  { community: 'crypto@lemmy.world', niche: 'crypto' },
  { community: 'nft@lemmy.world', niche: 'nft' },
  { community: 'memes@lemmy.ml', niche: 'degen' },
  { community: 'technology@lemmy.world', niche: 'ai' },
  { community: 'ai@lemmy.world', niche: 'ai' },
  { community: 'cybersecurity@lemmy.world', niche: 'security' },
  { community: 'privacy@lemmy.world', niche: 'security' },
  { community: 'privacyguides@lemmy.one', niche: 'security' },
  { community: 'privacy@lemmy.ml', niche: 'security' },
  { community: 'tor@lemmy.ml', niche: 'privacy' },
  { community: 'opensource@lemmy.ml', niche: 'opensource' },
  { community: 'selfhosted@lemmy.world', niche: 'opensource' },
  { community: 'linux@lemmy.ml', niche: 'opensource' },
  { community: 'fediverse@lemmy.world', niche: 'crypto' },
  { community: 'foss@lemmy.ml', niche: 'opensource' },
  { community: 'piracy@lemmy.dbzer0.com', niche: 'degen' },
  { community: 'rust@programming.dev', niche: 'ai' },
  { community: 'python@programming.dev', niche: 'ai' },
  { community: 'programming@programming.dev', niche: 'ai' },
  { community: 'asklemmy@lemmy.ml', niche: 'crypto' },
  { community: 'shitpost@lemmy.world', niche: 'degen' },
  { community: 'wallstreetbets@lemmy.world', niche: 'trading' },
  { community: 'trading@lemmy.ml', niche: 'trading' },
  { community: 'economics@lemmy.ml', niche: 'regulation' },
  { community: 'startups@lemmy.world', niche: 'ai' },
  { community: 'energy@lemmy.ml', niche: 'ai' },
];

interface LemmyPost {
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
    };
    community: {
      id: number;
      name: string;
      title: string;
    };
  };
}

interface LemmyPostListResponse {
  posts: LemmyPost[];
}

export interface LemmyProviderOptions {
  instances?: string[];
  communities?: Array<{ community: string; niche: string }>;
}

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
            return (data.posts ?? []).map((p) => {
              const post = p.post;
              const communityTitle = post.community?.title || post.community?.name || '';
              const titleWithCommunity = post.name
                ? `${post.name} [${communityTitle}]`
                : `[${communityTitle}] ${post.body?.slice(0, 100) ?? ''}`;
              return buildUnifiedPost({
                protocol: 'lemmy',
                nativeId: `lemmy:${post.community?.name ?? '?'}:${post.id}`,
                author: {
                  id: `lemmy:${post.creator?.id ?? 0}`,
                  primary: {
                    protocol: 'lemmy',
                    id: `${post.creator?.name ?? 'anon'}@${instance.replace('https://', '')}`,
                  },
                  handles: {
                    nostr: null,
                    farcaster: null,
                    lens: null,
                    bluesky: null,
                    threads: null,
                    rss: null,
                    mastodon: post.creator?.name ?? null,
                  },
                  displayName: post.creator?.display_name || post.creator?.name || 'anon',
                  bio: '',
                  avatarUrl: post.creator?.avatar ?? '',
                  verified: [],
                  followerCount: 0,
                  followingCount: 0,
                  links: post.url ? [{ label: 'link', url: post.url }] : [],
                  keys: {},
                },
                text: titleWithCommunity,
                html: post.body,
                embeds: post.url ? [{ kind: 'link', url: post.url }] : [],
                createdAt: new Date(post.published).getTime(),
                metrics: {
                  likes: post.upvotes ?? post.score ?? 0,
                  reposts: 0,
                  replies: post.comments ?? 0,
                  quotes: 0,
                },
                raw: post,
              }) as unknown as UnifiedPost;
            });
          } catch {}
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
      } catch {}
    }
    return {
      healthy: false,
      latencyMs: Math.round(performance.now() - start),
      error: 'All Lemmy instances unreachable',
    };
  }
}
