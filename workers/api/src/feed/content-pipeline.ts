/**
 * content-pipeline — Universal content pipeline that fills DegenFeed
 * timelines with quality content from EVERY connected network.
 *
 * New users get a full, engaging feed from day one — no empty timelines.
 * As users engage, the "For You" feed personalises, but "Trending" and
 * "Category" feeds are great from the start.
 *
 * Architecture:
 *   ContentPipeline.buildFeed()
 *     ├── resolveSources() — map requested sources → fetchers
 *     ├── parallel fetch from ALL selected sources
 *     ├── deduplicateCrossProtocol() — same content on multiple networks
 *     ├── scoreContent() — quality, engagement, freshness, relevance, diversity
 *     ├── diversifyFeed() — ensure no single source dominates
 *     └── assemble UnifiedFeed with sourceBreakdown
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { Env } from '../index';
import { deduplicateCrossProtocol } from './content-dedup';
import {
  type CuratedFeedOptions,
  curateFeed,
  loadBehaviorProfile,
  loadScrollProfile,
  loadSeenPosts,
  predictEngagement,
} from './feed-curator';
import {
  collectProviderResults,
  DEFAULT_PROTOCOLS,
  type ExecutionContext,
  fetchFromProviders,
} from './feed-fetcher';
import { applyQualityPipeline } from './feed-quality-gates';
import type { UnifiedFeedPost } from './unified-feed';
import { fetchLemmyPosts, fetchPeerTubeVideos, fetchYouTubeVideos } from './unified-fetchers';

// ─── Types ──────────────────────────────────────────────────────────────

export type FeedSourceKey =
  | 'activitypub'
  | 'atproto'
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'lemmy'
  | 'mirror'
  | 'paragraph'
  | 'ghost'
  | 'youtube'
  | 'peertube'
  | 'odysee'
  | 'rumble'
  | 'twitch'
  | 'funkwhale'
  | 'castopod'
  | 'mobilizon'
  | 'degenfeed'
  | 'zora'
  | 'pump'
  | 'mastodon'
  | 'bluesky'
  | 'rss'
  | 'reddit';

export type NetworkCategory =
  | 'decentralized-social'
  | 'discussion'
  | 'publishing'
  | 'video'
  | 'music-audio'
  | 'events'
  | 'native'
  | 'creator-coins';

export interface FeedSourceDef {
  id: FeedSourceKey;
  label: string;
  emoji: string;
  color: string;
  weight: number;
  network: NetworkCategory;
  fetcher?: (env: Env, limit: number) => Promise<UnifiedPost[]>;
  /** If true, this source is fetched via the existing provider registry */
  usesProviderRegistry?: boolean;
  protocol?: Protocol;
}

export interface ContentScore {
  quality: number; // 0-100: content quality (spam, polish, depth)
  engagement: number; // 0-100: likes, shares, comments, views
  freshness: number; // 0-100: how recent
  relevance: number; // 0-100: match to user interests / niches
  diversity: number; // 0-100: source diversity bonus
  composite: number; // weighted average
}

export interface UnifiedFeed {
  posts: UnifiedFeedPost[];
  sourceBreakdown: Record<string, number>;
  nextCursor?: string;
  generatedAt: number;
}

export interface TrendingOptions {
  windowHours?: number;
  minEngagement?: number;
  limit?: number;
  cursor?: string;
  protocols?: Protocol[];
}

export interface CuratedOptions {
  wallet?: string;
  limit?: number;
  cursor?: string;
  followed?: Set<string>;
  preferredNiches?: Set<string>;
  preferredContentTypes?: Set<string>;
  engagedCreators?: Set<string>;
}

export interface BuildFeedOptions {
  wallet?: string;
  protocols?: Protocol[];
  categories?: string[];
  sources?: FeedSourceKey[];
  sort: 'trending' | 'newest' | 'curated' | 'for-you';
  limit: number;
  cursor?: string;
  execCtx?: ExecutionContext;

  // ─── Custom feed recipe filters ───────────────────────────────
  /** Only include posts matching these niches/topics (fuzzy match). */
  niches?: string[];
  /** Only include these content types (text, image, video, link, thread). */
  contentTypes?: string[];
  /** Minimum total engagement (likes + reposts). */
  minEngagement?: number;
  /** Protocols to exclude entirely. */
  excludeProtocols?: Protocol[];
  /** Topics/niches to exclude entirely. */
  excludeTopics?: string[];
  /** Words/phrases to exclude posts containing them. */
  excludeWords?: string[];
  /** Optional language filter (ISO code). */
  language?: string;
  /** Only from these author IDs. */
  creatorFilter?: string[];
}

// ─── Feed Sources registry ──────────────────────────────────────────────

export const FEED_SOURCES: Record<FeedSourceKey, FeedSourceDef> = {
  // Decentralized Social
  activitypub: {
    id: 'activitypub',
    label: 'ActivityPub',
    emoji: '🐘',
    color: '#6364ff',
    weight: 1.0,
    network: 'decentralized-social',
    usesProviderRegistry: true,
    protocol: 'mastodon',
  },
  atproto: {
    id: 'atproto',
    label: 'AT Protocol',
    emoji: '🦋',
    color: '#1185fe',
    weight: 1.0,
    network: 'decentralized-social',
    usesProviderRegistry: true,
    protocol: 'bluesky',
  },
  nostr: {
    id: 'nostr',
    label: 'Nostr',
    emoji: '⚡',
    color: '#8e30eb',
    weight: 1.0,
    network: 'decentralized-social',
    usesProviderRegistry: true,
    protocol: 'nostr',
  },
  farcaster: {
    id: 'farcaster',
    label: 'Farcaster',
    emoji: '🟣',
    color: '#8a63d2',
    weight: 1.0,
    network: 'decentralized-social',
    usesProviderRegistry: true,
    protocol: 'farcaster',
  },
  lens: {
    id: 'lens',
    label: 'Lens',
    emoji: '🌿',
    color: '#abfe2c',
    weight: 0.8,
    network: 'decentralized-social',
    usesProviderRegistry: true,
    protocol: 'lens',
  },

  // Discussion
  lemmy: {
    id: 'lemmy',
    label: 'Lemmy',
    emoji: '🍋',
    color: '#00b868',
    weight: 0.7,
    network: 'discussion',
    usesProviderRegistry: true,
    protocol: 'lemmy',
  },

  // Publishing
  mirror: {
    id: 'mirror',
    label: 'Mirror',
    emoji: '📝',
    color: '#0b6bcb',
    weight: 0.6,
    network: 'publishing',
    usesProviderRegistry: true,
    protocol: 'mirror',
  },
  paragraph: {
    id: 'paragraph',
    label: 'Paragraph',
    emoji: '📄',
    color: '#4f46e5',
    weight: 0.6,
    network: 'publishing',
    usesProviderRegistry: true,
    protocol: 'paragraph',
  },
  ghost: {
    id: 'ghost',
    label: 'Ghost',
    emoji: '👻',
    color: '#15171a',
    weight: 0.5,
    network: 'publishing',
    protocol: undefined,
  },

  // Video
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    emoji: '▶️',
    color: '#ff0000',
    weight: 0.8,
    network: 'video',
    usesProviderRegistry: true,
    protocol: 'youtube',
  },
  peertube: {
    id: 'peertube',
    label: 'PeerTube',
    emoji: '📹',
    color: '#f1680d',
    weight: 0.6,
    network: 'video',
    usesProviderRegistry: true,
    protocol: 'peertube',
  },
  odysee: {
    id: 'odysee',
    label: 'Odysee',
    emoji: '🎬',
    color: '#ef9030',
    weight: 0.5,
    network: 'video',
    protocol: undefined,
  },
  rumble: {
    id: 'rumble',
    label: 'Rumble',
    emoji: '📺',
    color: '#85c742',
    weight: 0.5,
    network: 'video',
    protocol: undefined,
  },
  twitch: {
    id: 'twitch',
    label: 'Twitch',
    emoji: '🔴',
    color: '#9146ff',
    weight: 0.7,
    network: 'video',
    protocol: undefined,
  },

  // Music/Audio
  funkwhale: {
    id: 'funkwhale',
    label: 'Funkwhale',
    emoji: '🎵',
    color: '#6b3fa0',
    weight: 0.4,
    network: 'music-audio',
    protocol: undefined,
  },
  castopod: {
    id: 'castopod',
    label: 'Castopod',
    emoji: '🎙️',
    color: '#ff8c00',
    weight: 0.4,
    network: 'music-audio',
    protocol: undefined,
  },

  // Events
  mobilizon: {
    id: 'mobilizon',
    label: 'Mobilizon',
    emoji: '📅',
    color: '#0f3b5e',
    weight: 0.3,
    network: 'events',
    protocol: undefined,
  },

  // DegenFeed Native
  degenfeed: {
    id: 'degenfeed',
    label: 'DegenFeed',
    emoji: '🔥',
    color: '#ff6b35',
    weight: 1.2,
    network: 'native',
    protocol: undefined,
  },

  // Creator Coins
  zora: {
    id: 'zora',
    label: 'Zora',
    emoji: '🖼️',
    color: '#000000',
    weight: 0.7,
    network: 'creator-coins',
    usesProviderRegistry: true,
    protocol: 'zora',
  },
  pump: {
    id: 'pump',
    label: 'Pump.fun',
    emoji: '🚀',
    color: '#f97316',
    weight: 0.4,
    network: 'creator-coins',
    protocol: undefined,
  },

  // Also expose these for backward compat
  mastodon: {
    id: 'mastodon',
    label: 'Mastodon',
    emoji: '🐘',
    color: '#6364ff',
    weight: 0.9,
    network: 'decentralized-social',
    usesProviderRegistry: true,
    protocol: 'mastodon',
  },
  bluesky: {
    id: 'bluesky',
    label: 'Bluesky',
    emoji: '🦋',
    color: '#1185fe',
    weight: 0.9,
    network: 'decentralized-social',
    usesProviderRegistry: true,
    protocol: 'bluesky',
  },
  rss: {
    id: 'rss',
    label: 'RSS',
    emoji: '📡',
    color: '#ffa500',
    weight: 0.8,
    network: 'publishing',
    usesProviderRegistry: true,
    protocol: 'rss',
  },
  reddit: {
    id: 'reddit',
    label: 'Reddit',
    emoji: '🔴',
    color: '#ff4500',
    weight: 0.7,
    network: 'discussion',
    usesProviderRegistry: true,
    protocol: 'reddit',
  },
};

// ─── Default Categories (for new users with no preferences) ──────────────

export interface DefaultCategory {
  id: string;
  label: string;
  source?: string;
  sort?: string;
  tags?: string[];
}

export const DEFAULT_FEED_CATEGORIES: DefaultCategory[] = [
  { id: 'trending', label: 'Trending', source: 'all', sort: 'trending' },
  { id: 'crypto', label: 'Crypto & Web3', tags: ['crypto', 'web3', 'defi', 'nft'] },
  { id: 'tech', label: 'Tech & Dev', tags: ['tech', 'development', 'ai', 'coding'] },
  { id: 'art', label: 'Art & Creative', tags: ['art', 'nft', 'creative', 'design'] },
  { id: 'gaming', label: 'Gaming', tags: ['gaming', 'esports', 'streaming'] },
  { id: 'music', label: 'Music & Audio', tags: ['music', 'audio', 'podcast'] },
  { id: 'news', label: 'News', tags: ['news', 'politics', 'world'] },
];

// ─── ContentPipeline ────────────────────────────────────────────────────

export class ContentPipeline {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  // ── Feed Construction ─────────────────────────────────────────

  /**
   * Build a personalized feed for any user (new or existing).
   * For brand-new users with no wallet, falls back to trending content
   * from all sources — never an empty timeline.
   */
  async buildFeed(opts: BuildFeedOptions): Promise<UnifiedFeed> {
    const _startTime = Date.now();
    const limit = Math.min(opts.limit, 200);

    // 1. Collect preferences if wallet is provided
    const followed = new Set<string>();
    const preferredNiches = new Set<string>();
    const preferredContentTypes = new Set<string>();
    const engagedCreators = new Set<string>();
    let seenPosts = new Set<string>();

    if (opts.wallet) {
      const wallet = opts.wallet.toLowerCase();
      const behaviorProfile = await loadBehaviorProfile(this.env, wallet);
      const _scrollProfile = await loadScrollProfile(this.env, wallet);
      seenPosts = await loadSeenPosts(this.env, wallet);

      // Build preference sets from behavior profile
      for (const niche of Object.keys(behaviorProfile.preferredNichesInferred)) {
        preferredNiches.add(niche);
      }
      for (const ct of Object.keys(behaviorProfile.preferredContentTypesInferred)) {
        preferredContentTypes.add(ct);
      }
      for (const creatorId of behaviorProfile.tippedCreators) {
        engagedCreators.add(creatorId);
      }
    }

    // 2. Fetch posts from requested sources
    const allPosts = await this.fetchFromSources(opts.sources, opts.protocols, limit);

    // 3. Deduplicate across protocols
    const dedupResult = deduplicateCrossProtocol(allPosts);
    let posts = dedupResult.posts;

    // 4. Apply custom feed recipe filters (if any)
    posts = this.applyRecipeFilters(posts, opts);

    // 5. Sort by the requested mode
    switch (opts.sort) {
      case 'trending':
        posts = this.sortTrending(posts);
        break;
      case 'newest':
        posts.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'curated':
      case 'for-you': {
        const curatedOpts: CuratedFeedOptions = {
          wallet: opts.wallet,
          limit,
          followed,
          preferredNiches,
          preferredContentTypes,
          engagedCreators,
        };
        const curated = curateFeed(posts, seenPosts, curatedOpts);
        posts = curated.posts;
        break;
      }
    }

    // 6. Score every post
    const scored = await Promise.all(
      posts.slice(0, limit).map(async (p) => ({
        post: p,
        score: await this.scoreContent(p, preferredNiches),
      })),
    );

    // 7. Diversify
    const diversified = await this.diversifyFeed(scored.map((s) => s.post));

    // 8. Compute source breakdown
    const sourceBreakdown: Record<string, number> = {};
    for (const p of diversified) {
      const src = p.protocol || 'unknown';
      sourceBreakdown[src] = (sourceBreakdown[src] ?? 0) + 1;
    }

    // 9. Attach badges
    const enriched = diversified.map((p) => {
      const badge = this.badgeFor(p.protocol);
      return {
        ...p,
        sourceBadge: badge.emoji,
        sourceColor: badge.color,
        sourceLabel: badge.label,
      } as UnifiedFeedPost;
    });

    return {
      posts: enriched,
      sourceBreakdown,
      nextCursor:
        enriched.length > 0 ? String(enriched[enriched.length - 1]?.createdAt) : undefined,
      generatedAt: Date.now(),
    };
  }

  // ── Content Discovery ─────────────────────────────────────────

  /**
   * Get trending content across ALL protocols.
   * Filters to recent high-engagement posts and ranks by velocity.
   */
  async getTrendingContent(opts: TrendingOptions = {}): Promise<UnifiedPost[]> {
    const windowHours = opts.windowHours ?? 24;
    const minEngagement = opts.minEngagement ?? 1;
    const limit = opts.limit ?? 50;
    const windowMs = windowHours * 3600000;
    const now = Date.now();

    const posts = await this.fetchAllAvailable(opts.protocols, limit * 3);

    const trending = posts.filter((p) => {
      const age = now - p.createdAt;
      const totalEng =
        p.metrics.likes + p.metrics.reposts + p.metrics.replies + (p.metrics.quotes ?? 0);
      return age <= windowMs && totalEng >= minEngagement;
    });

    return this.sortTrending(trending).slice(0, limit);
  }

  /**
   * Get curated content (editorial picks + algorithmic).
   * For authenticated users, incorporates behavior profile.
   */
  async getCuratedContent(opts: CuratedOptions = {}): Promise<UnifiedPost[]> {
    const limit = opts.limit ?? 50;

    const preferredNiches = opts.preferredNiches ?? new Set();
    const preferredContentTypes = opts.preferredContentTypes ?? new Set();
    const engagedCreators = opts.engagedCreators ?? new Set();
    const _followed = opts.followed ?? new Set();

    // Load behavior profile if wallet is provided
    if (opts.wallet) {
      const profile = await loadBehaviorProfile(this.env, opts.wallet);
      for (const niche of Object.keys(profile.preferredNichesInferred)) {
        preferredNiches.add(niche);
      }
      for (const ct of Object.keys(profile.preferredContentTypesInferred)) {
        preferredContentTypes.add(ct);
      }
      for (const creatorId of profile.tippedCreators) {
        engagedCreators.add(creatorId);
      }
    }

    const posts = await this.fetchAllAvailable(undefined, limit * 2);

    // Score by engagement prediction
    const predicted = predictEngagement(
      posts,
      preferredNiches,
      preferredContentTypes,
      engagedCreators,
      Date.now(),
    );

    predicted.sort((a, b) => b.predictedScore - a.predictedScore);
    return predicted.slice(0, limit).map((p) => p.post);
  }

  /**
   * Get content from a specific network category (e.g. "video", "decentralized-social").
   */
  async getNetworkContent(network: NetworkCategory): Promise<UnifiedPost[]> {
    const sourceKeys = Object.entries(FEED_SOURCES)
      .filter(([, def]) => def.network === network)
      .map(([key]) => key as FeedSourceKey);

    const posts = await this.fetchFromSources(sourceKeys, undefined, 100);
    const dedupResult = deduplicateCrossProtocol(posts);
    return dedupResult.posts.slice(0, 100);
  }

  // ── Source Weighting ──────────────────────────────────────────

  /**
   * Score content on quality, engagement, freshness, relevance, and diversity.
   * Returns 0-100 scores with a weighted composite.
   */
  async scoreContent(post: UnifiedPost, preferredNiches?: Set<string>): Promise<ContentScore> {
    const now = Date.now();
    const ageHours = (now - post.createdAt) / 3600000;

    // Quality (0-100): use existing quality score or heuristic
    const qualityScore = post.feedDebug?.qualityScore ?? 0.5;
    const quality = Math.round(qualityScore * 100);

    // Engagement (0-100): normalize likes+reposts+replies
    const totalEng =
      post.metrics.likes +
      post.metrics.reposts * 2 +
      post.metrics.replies * 3 +
      (post.metrics.quotes ?? 0);
    const engagement = Math.round(Math.min(totalEng / 10, 1) * 100);

    // Freshness (0-100): decay over 72h
    const freshness = Math.round(Math.max(0, 1 - ageHours / 72) * 100);

    // Relevance (0-100): match to user interests
    let relevance = 0;
    if (preferredNiches && preferredNiches.size > 0) {
      const matchCount = post.niches.filter((n) => preferredNiches.has(n.toLowerCase())).length;
      relevance = Math.round(Math.min(matchCount / Math.max(preferredNiches.size, 1), 1) * 100);
    } else {
      // No preferences = moderate relevance for everything
      relevance = 50;
    }

    // Diversity (0-100): base score; caller adjusts via diversifyFeed
    const diversity = 50;

    // Composite: weighted average
    const composite = Math.round(
      quality * 0.25 + engagement * 0.2 + freshness * 0.2 + relevance * 0.25 + diversity * 0.1,
    );

    return { quality, engagement, freshness, relevance, diversity, composite };
  }

  // ── Content Diversity ─────────────────────────────────────────

  /**
   * Ensure feed has diverse sources (not all from one protocol).
   * Uses the existing source diversity logic from quality gates.
   */
  async diversifyFeed(posts: UnifiedPost[]): Promise<UnifiedPost[]> {
    if (posts.length === 0) return posts;

    // Use the quality pipeline's source diversity
    const result = applyQualityPipeline(posts, {
      minQualityScore: 0, // don't filter on quality, just enforce diversity
      enforceEngagementFloor: false,
      preferEnglish: false,
      filterNsfwSpam: false,
      crossProtocolDedup: false,
      freshnessConfig: null,
      maxPctPerSource: 35,
    });

    return result.posts;
  }

  // ─── Default Feed for New Users ──────────────────────────────────

  /**
   * Build a default feed for brand-new users with no connections.
   * Pulls trending content from ALL protocols, mixes in creator coins,
   * featured creators, and ensures source diversity.
   */
  async buildDefaultFeed(): Promise<UnifiedFeed> {
    const sources = await Promise.all([
      this.fetchTrendingActivityPub(5),
      this.fetchTrendingATProtocol(5),
      this.fetchTrendingNostr(5),
      this.fetchTrendingFarcaster(5),
      this.fetchTrendingLemmy(3),
      this.fetchDegenFeedFeatured(3),
      this.fetchTrendingVideos(3),
    ]);

    const allPosts = sources.flat();
    const dedupResult = deduplicateCrossProtocol(allPosts);
    const posts = dedupResult.posts;

    // Score and rank by engagement + freshness
    const now = Date.now();
    const scored = posts.map((p) => {
      const ageHours = (now - p.createdAt) / 3600000;
      const totalEng = p.metrics.likes + p.metrics.reposts * 2 + p.metrics.replies * 3;
      const freshScore = Math.max(0, 1 - ageHours / 48);
      return { post: p, score: totalEng * 0.6 + freshScore * 40 };
    });

    scored.sort((a, b) => b.score - a.score);
    const topPosts = scored.slice(0, 50).map((s) => s.post);

    // Diversify
    const diversified = await this.diversifyFeed(topPosts);

    // Attach badges
    const enriched = diversified.map((p) => {
      const badge = this.badgeFor(p.protocol);
      return {
        ...p,
        sourceBadge: badge.emoji,
        sourceColor: badge.color,
        sourceLabel: badge.label,
      } as UnifiedFeedPost;
    });

    // Source breakdown
    const sourceBreakdown: Record<string, number> = {};
    for (const p of enriched) {
      const src = p.protocol || 'unknown';
      sourceBreakdown[src] = (sourceBreakdown[src] ?? 0) + 1;
    }

    return {
      posts: enriched,
      sourceBreakdown,
      generatedAt: Date.now(),
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  private badgeFor(protocol: string): { emoji: string; color: string; label: string } {
    const def = Object.values(FEED_SOURCES).find(
      (s) => s.protocol === protocol || s.id === protocol,
    );
    if (def) {
      return { emoji: def.emoji, color: def.color, label: def.label };
    }
    return { emoji: '●', color: '#666', label: protocol };
  }

  private sortTrending(posts: UnifiedPost[]): UnifiedPost[] {
    const now = Date.now();
    return [...posts].sort((a, b) => {
      const aAge = Math.max(1, (now - a.createdAt) / 3600000);
      const bAge = Math.max(1, (now - b.createdAt) / 3600000);
      const aEng = a.metrics.likes + a.metrics.reposts * 2 + a.metrics.replies * 3;
      const bEng = b.metrics.likes + b.metrics.reposts * 2 + b.metrics.replies * 3;
      const aScore = aEng / aAge;
      const bScore = bEng / bAge;
      return bScore - aScore;
    });
  }

  async fetchAllAvailable(protocols?: Protocol[], limit = 100): Promise<UnifiedPost[]> {
    const protos = protocols ?? DEFAULT_PROTOCOLS;
    const results = await fetchFromProviders(this.env, protos, limit, []);
    const { posts } = collectProviderResults(results);

    // Also fetch content-platform posts
    const extraFetches: Promise<UnifiedPost[]>[] = [];
    if (!protocols || protocols.includes('lemmy')) {
      extraFetches.push(fetchLemmyPosts('hot', undefined, 20).then((r) => r.posts));
    }
    if (!protocols || protocols.includes('peertube')) {
      extraFetches.push(fetchPeerTubeVideos(20));
    }
    if (!protocols || protocols.includes('youtube')) {
      extraFetches.push(fetchYouTubeVideos(20).then((r) => r.posts));
    }

    const extraResults = await Promise.allSettled(extraFetches);
    for (const r of extraResults) {
      if (r.status === 'fulfilled') {
        posts.push(...r.value);
      }
    }

    return posts;
  }

  private async fetchFromSources(
    sources?: FeedSourceKey[],
    protocols?: Protocol[],
    limit = 100,
  ): Promise<UnifiedPost[]> {
    if (protocols && protocols.length > 0) {
      return this.fetchAllAvailable(protocols, limit);
    }

    // Map source keys to provider protocols
    const providerProtocols = new Set<Protocol>();
    const useDirect = new Set<FeedSourceKey>();

    for (const key of sources ?? []) {
      const def = FEED_SOURCES[key];
      if (!def) continue;
      if (def.usesProviderRegistry && def.protocol) {
        providerProtocols.add(def.protocol);
      } else {
        useDirect.add(key);
      }
    }

    const posts: UnifiedPost[] = [];

    // Fetch from provider registry
    if (providerProtocols.size > 0) {
      const results = await fetchFromProviders(this.env, Array.from(providerProtocols), limit, []);
      const { posts: providerPosts } = collectProviderResults(results);
      posts.push(...providerPosts);
    }

    // Direct fetches for sources without a provider
    if (
      useDirect.has('ghost') ||
      useDirect.has('degenfeed') ||
      useDirect.has('odysee') ||
      useDirect.has('rumble') ||
      useDirect.has('twitch') ||
      useDirect.has('funkwhale') ||
      useDirect.has('castopod') ||
      useDirect.has('mobilizon') ||
      useDirect.has('pump')
    ) {
      // These are placeholders for future direct API integrations.
      // Currently they contribute 0 posts; in future they will have
      // dedicated fetchers registered here.
    }

    return posts;
  }

  // ─── Recipe filter application ─────────────────────────────────

  /**
   * Apply recipe-level filters to a post list.
   * Filters by niches, content types, min engagement, excluded topics/words,
   * language, and creator filter.
   */
  private applyRecipeFilters(posts: UnifiedPost[], opts: BuildFeedOptions): UnifiedPost[] {
    let filtered = posts;

    // Filter by preferred niches (topic relevance)
    if (opts.niches && opts.niches.length > 0) {
      const _targetNiches = new Set(opts.niches.map((n) => n.toLowerCase()));
      filtered = filtered.filter((p) => {
        const postText = `${p.text} ${p.niches.join(' ')}`.toLowerCase();
        return opts.niches?.some((n) => postText.includes(n.toLowerCase()));
      });
    }

    // Filter by content type
    if (opts.contentTypes && opts.contentTypes.length > 0) {
      const validTypes = new Set(opts.contentTypes.map((t) => t.toLowerCase()));
      filtered = filtered.filter((p) => {
        const ct = (p.contentType ?? 'text').toLowerCase();
        return validTypes.has(ct);
      });
    }

    // Filter by minimum engagement
    if (opts.minEngagement !== undefined && opts.minEngagement > 0) {
      filtered = filtered.filter((p) => {
        const total = p.metrics.likes + p.metrics.reposts;
        return total >= opts.minEngagement!;
      });
    }

    // Exclude topics
    if (opts.excludeTopics && opts.excludeTopics.length > 0) {
      const excluded = new Set(opts.excludeTopics.map((t) => t.toLowerCase()));
      filtered = filtered.filter((p) => {
        const postNiches = new Set(p.niches.map((n) => n.toLowerCase()));
        return ![...excluded].some((e) => postNiches.has(e));
      });
    }

    // Exclude words (check text body)
    if (opts.excludeWords && opts.excludeWords.length > 0) {
      filtered = filtered.filter((p) => {
        const text = p.text.toLowerCase();
        return !opts.excludeWords?.some((word) => text.includes(word.toLowerCase()));
      });
    }

    // Filter by language
    if (opts.language) {
      const _lang = opts.language.toLowerCase();
      filtered = filtered.filter((p) => {
        // Use the language from the post's niche detection or a heuristic
        // For now, check if the language field matches
        return p.text !== undefined; // No native language field — pass through
      });
    }

    // Filter by author/creator
    if (opts.creatorFilter && opts.creatorFilter.length > 0) {
      const creators = new Set(opts.creatorFilter.map((c) => c.toLowerCase()));
      filtered = filtered.filter((p) => {
        return (
          creators.has(p.author.id.toLowerCase()) ||
          creators.has(p.author.displayName.toLowerCase())
        );
      });
    }

    // Exclude protocols
    if (opts.excludeProtocols && opts.excludeProtocols.length > 0) {
      const excluded = new Set(opts.excludeProtocols);
      filtered = filtered.filter((p) => !excluded.has(p.protocol));
    }

    return filtered;
  }

  // ─── Default feed source fetchers ────────────────────────────────

  private async fetchTrendingActivityPub(limit: number): Promise<UnifiedPost[]> {
    const results = await fetchFromProviders(this.env, ['mastodon'], limit, []);
    const { posts } = collectProviderResults(results);
    return posts.slice(0, limit);
  }

  private async fetchTrendingATProtocol(limit: number): Promise<UnifiedPost[]> {
    const results = await fetchFromProviders(this.env, ['bluesky'], limit, []);
    const { posts } = collectProviderResults(results);
    return posts.slice(0, limit);
  }

  private async fetchTrendingNostr(limit: number): Promise<UnifiedPost[]> {
    const results = await fetchFromProviders(this.env, ['nostr'], limit, []);
    const { posts } = collectProviderResults(results);
    return posts.slice(0, limit);
  }

  private async fetchTrendingFarcaster(limit: number): Promise<UnifiedPost[]> {
    const results = await fetchFromProviders(this.env, ['farcaster'], limit, []);
    const { posts } = collectProviderResults(results);
    return posts.slice(0, limit);
  }

  private async fetchTrendingLemmy(limit: number): Promise<UnifiedPost[]> {
    const { posts } = await fetchLemmyPosts('hot', undefined, limit);
    return posts;
  }

  private async fetchDegenFeedFeatured(limit: number): Promise<UnifiedPost[]> {
    // Pulls featured content from our native DegenFeed sources
    const results = await fetchFromProviders(this.env, ['rss'], limit, []);
    const { posts } = collectProviderResults(results);
    // Tag with boosted weight
    return posts.slice(0, limit).map(
      (p) =>
        ({
          ...p,
          niches: [...p.niches, 'featured'],
        }) as UnifiedPost,
    );
  }

  private async fetchTrendingVideos(limit: number): Promise<UnifiedPost[]> {
    const [peertubePosts, youtubeResult] = await Promise.all([
      fetchPeerTubeVideos(Math.ceil(limit / 2)),
      fetchYouTubeVideos(Math.ceil(limit / 2)),
    ]);
    return [...peertubePosts, ...youtubeResult.posts].slice(0, limit);
  }
}

// ─── Standalone default feed builder (convenience) ──────────────────────

/**
 * Build a default feed for brand new users. Simple entry point that
 * creates a ContentPipeline internally and calls buildDefaultFeed().
 */
export async function buildDefaultFeed(env: Env): Promise<UnifiedFeed> {
  const pipeline = new ContentPipeline(env);
  return pipeline.buildDefaultFeed();
}
