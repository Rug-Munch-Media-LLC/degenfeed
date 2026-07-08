/**
 * LemmyProvider — Federated Reddit alternative (ActivityPub).
 *
 * Every Lemmy instance exposes a REST API at /api/v3/ for community
 * discovery and post listing with real engagement (upvotes, comments).
 * Communities map directly to DegenFeed niches.
 *
 * Strategy:
 *   1. Community list: discover trending crypto/tech communities
 *   2. Post list: fetch Hot posts from top communities with real metrics
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

const CURATED_COMMUNITIES = [
  { community: 'cryptocurrency@lemmy.world', niche: 'crypto' },
  { community: 'bitcoin@lemmy.ml', niche: 'bitcoin' },
  { community: 'technology@lemmy.world', niche: 'ai' },
  { community: 'cybersecurity@lemmy.world', niche: 'security' },
  { community: 'privacy@lemmy.world', niche: 'security' },
  { community: 'opensource@lemmy.ml', niche: 'ai' },
  { community: 'ai@lemmy.world', niche: 'ai' },
  { community: 'blockchain@lemmy.world', niche: 'crypto' },
  { community: 'defi@lemmy.world', niche: 'defi' },
  { community: 'web3@lemmy.world', niche: 'crypto' },
  { community: 'ethereum@lemmy.ml', niche: 'ethereum' },
  { community: 'solana@lemmy.world', niche: 'solana' },
  { community: 'nostr@lemmy.world', niche: 'crypto' },
  { community: 'rust@programming.dev', niche: 'ai' },
  { community: 'python@programming.dev', niche: 'ai' },
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

    const communityBatches = this.communities.slice(0, 10);
    const results = await Promise.allSettled(
      communityBatches.map(async ({ community, niche: _niche }) => {
        const instance = this.instances[0];
        if (!instance) return [];
        try {
          const data = await withTimeout(
            fetchJson<LemmyPostListResponse>(
              buildUrl(instance, '/api/v3/post/list', {
                community_name: community.split('@')[0] ?? community,
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
            const communityName = post.community?.title || post.community?.name || '';
            const titleWithCommunity = post.name
              ? `${post.name} [${communityName}]`
              : `[${communityName}] ${post.body?.slice(0, 100) ?? ''}`;
            return buildUnifiedPost({
              protocol: 'lemmy',
              nativeId: `lemmy:${post.community?.name ?? '?'}:${post.id}`,
              author: {
                id: `lemmy:${post.creator?.id ?? 0}`,
                primary: { protocol: 'mastodon', id: String(post.creator?.id ?? 0) },
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
        } catch {
          return [];
        }
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
    const primary = this.instances[0];
    if (!primary) return { healthy: false, latencyMs: 0, error: 'No instances configured' };
    try {
      await withTimeout(
        fetchJson(buildUrl(primary, '/api/v3/site')),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'lemmy:health',
      );
      return { healthy: true, latencyMs: Math.round(performance.now() - start) };
    } catch (e) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: (e as Error).message,
      };
    }
  }
}
