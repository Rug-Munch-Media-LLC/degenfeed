/**
 * @routes/vine-shorts — Vine-like Shorts: Fun, Curated, Always Fresh
 *
 * "Bring Vine back" — 6-second looping videos with Web3-native features.
 *
 * Vine-style experience:
 *   - 6-second default format (up to 60s supported)
 *   - Looping video playback
 *   - "Vibe" score: humor, creativity, originality, replay value
 *   - Categories: Comedy, Music, Art, Magic, Tricks, Pets, Fails, Dance, Crypto, Memes
 *   - Original sound creator attribution
 *   - "Revine" (repost) button
 *   - Vine Star badges for top creators
 *   - Daily/Weekly Top Vines leaderboards
 *   - Featured Vine (daily editorial pick)
 *   - Vine challenges: "#DegenVine challenge — best crypto meme wins 100K sats"
 *
 * Content Aggregation (Always Fresh):
 *   - Loops (self-hosted) — primary
 *   - Reddit — r/funny, r/cryptocurrency, r/videos, r/perfectlycutscreams
 *   - YouTube Shorts — trending in crypto/tech/comedy
 *   - Instagram Reels — via RSS-Bridge
 *   - TikTok — via RSS-Bridge
 *   - Twitter/X — video posts
 *   - Farcaster — video casts
 *   - Nostr — NIP-71 video events
 *   - Bluesky — video posts
 *   - Pixelfed — video posts
 *   - PeerTube — short videos
 *   - Zora — video NFTs
 *   - Flashes (AT Protocol shorts) — via Firehose
 *
 * Endpoints:
 *   GET    /api/shorts/vine          — Vine-style curated feed
 *   GET    /api/shorts/vibe          — Vibe-scored content
 *   GET    /api/shorts/queue         — Pre-loaded content queue
 *   POST   /api/shorts/queue/refresh — Refresh queue
 *   POST   /api/shorts/revine        — Revine (repost) a short
 *   GET    /api/shorts/vine/top      — Daily/Weekly Top Vines leaderboard
 *   POST   /api/shorts/vine/feature  — Submit for featured consideration
 *   GET    /api/shorts/vine/challenges — Active Vine challenges
 *   POST   /api/shorts/vine/challenges/join — Join a challenge
 *   GET    /api/shorts/vine/stars    — Vine Star leaderboard
 *   GET    /api/shorts/vine/categories — Vine categories
 *   POST   /api/shorts/vine/sound/:id/attribute — Attribute original sound creator
 */
import { detectNiches } from '@degenfeed/feed-core';
import {
  type AggregatedShort,
  type ExtendedSource,
  ShortsAggregatorV2,
} from '../feed/shorts-aggregator-v2';
import { ShortsAlgorithm, type UserShortsProfile, type WatchEvent } from '../feed/shorts-algorithm';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type VineCategory =
  | 'comedy'
  | 'music'
  | 'art'
  | 'magic'
  | 'tricks'
  | 'pets'
  | 'fails'
  | 'dance'
  | 'crypto'
  | 'memes'
  | 'pranks'
  | 'edits'
  | 'gaming'
  | 'reactions'
  | 'original_sound';

export const VINE_CATEGORIES: VineCategory[] = [
  'comedy',
  'music',
  'art',
  'magic',
  'tricks',
  'pets',
  'fails',
  'dance',
  'crypto',
  'memes',
  'pranks',
  'edits',
  'gaming',
  'reactions',
  'original_sound',
];

export const VINE_CATEGORY_META: Record<
  VineCategory,
  { label: string; emoji: string; color: string }
> = {
  comedy: { label: 'Comedy', emoji: '😂', color: '#FF6B35' },
  music: { label: 'Music', emoji: '🎵', color: '#E91E63' },
  art: { label: 'Art', emoji: '🎨', color: '#9C27B0' },
  magic: { label: 'Magic', emoji: '🪄', color: '#673AB7' },
  tricks: { label: 'Tricks', emoji: '🛹', color: '#FF5722' },
  pets: { label: 'Pets', emoji: '🐱', color: '#FF9800' },
  fails: { label: 'Fails', emoji: '💀', color: '#F44336' },
  dance: { label: 'Dance', emoji: '💃', color: '#E91E63' },
  crypto: { label: 'Crypto', emoji: '₿', color: '#00FF41' },
  memes: { label: 'Memes', emoji: '🔥', color: '#FFD600' },
  pranks: { label: 'Pranks', emoji: '👻', color: '#FF4081' },
  edits: { label: 'Edits', emoji: '✂️', color: '#00BCD4' },
  gaming: { label: 'Gaming', emoji: '🎮', color: '#4CAF50' },
  reactions: { label: 'Reactions', emoji: '😱', color: '#FF5252' },
  original_sound: { label: 'Original Sound', emoji: '🔊', color: '#7C4DFF' },
};

export interface VibeScore {
  /** Overall vibe score 0-100 */
  total: number;
  /** Humor score 0-100 */
  humor: number;
  /** Creativity score 0-100 */
  creativity: number;
  /** Originality score 0-100 */
  originality: number;
  /** Replay value score 0-100 (how likely to watch again) */
  replayValue: number;
  /** Production quality score 0-100 */
  productionQuality: number;
  /** Engagement velocity (likes + revines per hour) */
  engagementVelocity: number;
  /** Viral potential 0-100 */
  viralPotential: number;
}

export interface VineShort extends AggregatedShort {
  /** Vine-specific enhancements */
  vineFormat: boolean;
  /** Optimal for 6s loop */
  loopDuration: number;
  /** Vibe scores */
  vibeScore: VibeScore;
  /** Vine category */
  vineCategory: VineCategory[];
  /** Number of revines (reposts) */
  revineCount: number;
  /** Whether current user has revined */
  hasRevined?: boolean;
  /** Original sound creator attribution */
  originalSound?: {
    name: string;
    handle: string;
    avatar?: string;
  };
  /** Vine Star badge earned */
  vineStarBadge?: boolean;
  /** Featured Vine */
  isFeatured?: boolean;
  /** Active challenge this video is part of */
  challenge?: {
    id: string;
    name: string;
    prize: string;
  };
  /** Cross-platform repost links */
  crossPlatformLinks?: Array<{
    platform: string;
    url: string;
    label: string;
  }>;
}

export interface VineFeedResponse {
  shorts: VineShort[];
  categories: VineCategory[];
  vibeRange: { min: number; max: number; avg: number };
  featured?: VineShort;
  hasMore: boolean;
  cursor: string | null;
  aggregatedAt: number;
}

export interface VineQueue {
  shorts: VineShort[];
  queuedAt: number;
  expiresAt: number;
  size: number;
  userId?: string;
}

export interface VineLeaderboardEntry {
  rank: number;
  short: VineShort;
  vibeScore: number;
  revineCount: number;
  viewCount: number;
}

export interface VineChallenge {
  id: string;
  name: string;
  description: string;
  prize: string;
  category: VineCategory;
  startsAt: number;
  endsAt: number;
  entryCount: number;
  topEntries: VineShort[];
  sponsor?: string;
  hashtag: string;
}

export interface VineStarProfile {
  creatorName: string;
  creatorHandle: string;
  creatorAvatar?: string;
  creatorAddress?: string;
  badge: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  totalVibeScore: number;
  totalRevines: number;
  totalVideos: number;
  topCategory: VineCategory;
  joinedAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// VIBE SCORING ENGINE
// ═══════════════════════════════════════════════════════════════════════════

function computeVibeScore(short: AggregatedShort): VibeScore {
  const durationBonus = short.duration <= 10 ? 20 : short.duration <= 30 ? 10 : 0;
  const engagementBonus = Math.min(short.engagementRate * 50, 20);
  const qualityBonus = short.qualityScore * 30;
  const viewBonus = Math.min(Math.log10(short.views + 1) * 5, 15);
  const tagDiversity = Math.min(short.tags.length * 5, 15);

  // Compute sub-scores
  const humor = Math.min(
    40 +
      (short.categories.includes('comedy') || short.categories.includes('memes') ? 30 : 0) +
      engagementBonus +
      tagDiversity,
    100,
  );
  const creativity = Math.min(
    30 +
      qualityBonus +
      (short.categories.includes('art') || short.categories.includes('music') ? 25 : 0) +
      (short.duration <= 6 ? 15 : 0),
    100,
  );
  const originality = Math.min(
    30 +
      (short.source === 'loops' || short.source === 'direct' ? 20 : 0) +
      Math.random() * 20 +
      durationBonus / 2,
    100,
  );
  const replayValue = Math.min(
    20 + durationBonus * 1.5 + engagementBonus + (short.duration <= 6 ? 25 : 0),
    100,
  );
  const productionQuality = Math.min(
    short.qualityScore * 70 + (short.vertical ? 15 : 0) + (short.thumbnailUrl ? 15 : 0),
    100,
  );
  const engagementVelocity = Math.min(
    20 + (short.likes / Math.max((Date.now() - short.publishedAt) / 3600000, 1)) * 2,
    100,
  );

  // Viral potential combines multiple factors
  const viralPotential = Math.min(
    humor * 0.3 + creativity * 0.2 + replayValue * 0.3 + engagementVelocity * 0.2,
    100,
  );

  const total = Math.round(
    humor * 0.2 +
      creativity * 0.15 +
      originality * 0.15 +
      replayValue * 0.2 +
      productionQuality * 0.15 +
      engagementVelocity * 0.15,
  );

  return {
    total: Math.min(total, 100),
    humor: Math.round(humor),
    creativity: Math.round(creativity),
    originality: Math.round(originality),
    replayValue: Math.round(replayValue),
    productionQuality: Math.round(productionQuality),
    engagementVelocity: Math.round(engagementVelocity),
    viralPotential: Math.round(viralPotential),
  };
}

function categoriseVine(short: AggregatedShort): VineCategory[] {
  const textContent = `${short.title} ${short.description} ${short.tags.join(' ')}`.toLowerCase();
  const categories: VineCategory[] = [];

  // Pattern matching against Vine categories
  const patterns: Record<VineCategory, RegExp[]> = {
    comedy: [/funny|hilarious|lol|lmao|comedy|joke|humor|😂|🤣/i],
    music: [/music|song|beat|remix|sing|rap|drum|guitar|piano|🎵|🎶|♬/i],
    art: [/art|drawing|painting|sketch|digital art|illustration|🎨/i],
    magic: [/magic|trick|illusion|disappear|spell|🪄/i],
    tricks: [/trick|flip|skate|trick shot|parkour|🛹/i],
    pets: [/dog|cat|pet|puppy|kitten|🐱|🐶|🐕/i],
    fails: [/fail|wrong|accident|oops|💀|facepalm/i],
    dance: [/dance|dancing|choreo|moves|groove|💃|🕺/i],
    crypto: [/crypto|bitcoin|eth|solana|nft|defi|web3|₿/i],
    memes: [/meme|dank|template|repost|🔥/i],
    pranks: [/prank|gotcha|scare|surprise|👻/i],
    edits: [/edit|transition|effect|capcut|✂️/i],
    gaming: [/gaming|game|gamer|minecraft|fortnite|fps|🎮/i],
    reactions: [/reaction|react|wow|omg|😱/i],
    original_sound: [/original sound|oc|original audio|my sound/i],
  };

  for (const [cat, regexps] of Object.entries(patterns)) {
    if (regexps.some((r) => r.test(textContent))) {
      categories.push(cat as VineCategory);
    }
  }

  // If no categories matched, assign based on source/platform
  if (categories.length === 0) {
    const sourceDefaults: Partial<Record<ExtendedSource, VineCategory>> = {
      tiktok_rss: 'comedy',
      instagram: 'dance',
      youtube: 'comedy',
      farcaster: 'crypto',
      nostr: 'crypto',
      bluesky: 'memes',
    };
    const defaultCat = sourceDefaults[short.source] ?? 'comedy';
    categories.push(defaultCat);
  }

  return categories;
}

function isVineFormat(short: AggregatedShort): boolean {
  // Vine classic is 6s, but we support up to 60s
  return short.duration <= 60;
}

function enhanceToVineShort(short: AggregatedShort, hasRevined = false): VineShort {
  const categories = categoriseVine(short);
  return {
    ...short,
    vineFormat: isVineFormat(short),
    loopDuration: Math.min(short.duration, 6), // Ideal loop is 6s
    vibeScore: computeVibeScore(short),
    vineCategory: categories,
    revineCount: Math.floor(Math.random() * short.views * 0.02), // Simulated revine count
    hasRevined,
    isFeatured: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// REDDIT CONTENT AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════

interface RedditPost {
  id: string;
  title: string;
  permalink: string;
  url: string;
  thumbnail: string;
  author: string;
  score: number;
  numComments: number;
  created: number;
  subreddit: string;
  isVideo: boolean;
  videoUrl?: string;
  duration?: number;
  over18: boolean;
}

async function fetchRedditVideos(env: Env, limit: number): Promise<AggregatedShort[]> {
  const shorts: AggregatedShort[] = [];
  const redditClientId = env.REDDIT_CLIENT_ID;
  const redditSecret = env.REDDIT_CLIENT_SECRET;

  const subreddits = [
    'funny',
    'cryptocurrency',
    'videos',
    'perfectlycutscreams',
    'containsthething',
    'bettereveryloop',
    'gifsthatkeepongiving',
    'cryptomemes',
    'dankmemes',
    'maybemaybemaybe',
    'unexpected',
  ];

  for (const sub of subreddits.slice(0, 5)) {
    if (shorts.length >= limit) break;
    try {
      const headers: Record<string, string> = {
        'user-agent': 'degenfeed:vine:v1.0 (by /u/degenfeed-bot)',
      };

      // If we have Reddit OAuth, use it
      if (redditClientId && redditSecret) {
        const auth = btoa(`${redditClientId}:${redditSecret}`);
        headers.authorization = `Basic ${auth}`;
      }

      const res = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?limit=${Math.min(limit, 25)}&raw_json=1`,
        { headers, signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) continue;

      const data = (await res.json()) as {
        data?: { children?: Array<{ data: RedditPost }> };
      };

      for (const child of data?.data?.children ?? []) {
        const post = child.data;
        if (!post || post.over18) continue;

        // Find video URL from Reddit's post
        let videoUrl = post.url;
        let isShortVideo = false;

        if (post.isVideo && post.videoUrl) {
          videoUrl = post.videoUrl;
          isShortVideo = true;
        } else if (post.url.match(/\.(mp4|webm|mov|gifv)$/i)) {
          isShortVideo = true;
        } else if (post.url.includes('v.redd.it')) {
          // Try to get Reddit video
          const videoRes = await fetch(`${post.url}/DASH_2_4_M`, {
            signal: AbortSignal.timeout(3000),
          }).catch(() => null);
          if (videoRes?.ok) {
            videoUrl = `${post.url}/DASH_2_4_M`;
            isShortVideo = true;
          }
        }

        if (!isShortVideo) continue;

        const textContent = `${post.title} r/${post.subreddit}`;
        const topics = detectNiches(textContent);

        shorts.push({
          id: `reddit:${post.id}`,
          source: 'rss_bridge',
          sourceLabel: `r/${post.subreddit}`,
          sourceColor: '#FF4500',
          sourceUrl: `https://reddit.com${post.permalink}`,
          title: post.title,
          description: `Posted in r/${post.subreddit} by u/${post.author}`,
          thumbnailUrl: post.thumbnail?.startsWith('http') ? post.thumbnail : '',
          videoUrl,
          duration: post.duration ?? 15,
          creatorName: `u/${post.author}`,
          creatorHandle: post.author,
          views: post.score,
          likes: post.score,
          tags: [...topics, post.subreddit],
          categories: ['videos', post.subreddit, ...topics],
          publishedAt: post.created * 1000,
          qualityScore: Math.min(post.score / 1000, 1) * 0.7 + 0.3,
          engagementRate: post.numComments > 0 ? post.score / (post.score + post.numComments) : 0.5,
          canTip: false,
          contentHash: `reddit:${post.id}`,
          vertical: false,
        });
      }
    } catch {
      // Fail-open per subreddit
    }
  }

  return shorts.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════
// FLASHES (AT Protocol Shorts) INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

async function fetchFlashesShorts(env: Env, limit: number): Promise<AggregatedShort[]> {
  const shorts: AggregatedShort[] = [];
  const bskyUrl = env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';

  try {
    // Flashes uses AT Protocol — fetch video posts from the firehose
    const res = await fetch(
      `${bskyUrl}/xrpc/app.bsky.feed.getTimeline?limit=${Math.min(limit, 30)}`,
      { signal: AbortSignal.timeout(8000) },
    );

    if (res.ok) {
      const data = (await res.json()) as {
        feed?: Array<{
          post: {
            uri: string;
            cid: string;
            author: { handle: string; displayName?: string; avatar?: string };
            record: {
              text: string;
              createdAt: string;
              embed?: {
                $type: string;
                video?: { ref?: { $link?: string }; mimeType?: string };
                playlist?: string;
                alt?: string;
              };
            };
            likeCount?: number;
            repostCount?: number;
          };
        }>;
      };

      for (const item of data?.feed ?? []) {
        const embed = item.post.record.embed;
        if (!embed || embed.$type !== 'app.bsky.embed.video') continue;

        const videoUrl =
          embed.playlist || `https://video.bsky.app/watch/${item.post.uri.split('/').pop()}`;
        if (!videoUrl) continue;

        const text = item.post.record.text || '';
        const hashtags = text.match(/#\w+/g)?.map((t) => t.slice(1)) ?? [];
        const topics = detectNiches(text);

        shorts.push({
          id: `flashes:${item.post.cid}`,
          source: 'atprotocol',
          sourceLabel: 'Flashes',
          sourceColor: '#0085FF',
          sourceUrl: `https://flashes.bsky.app/profile/${item.post.author.handle}/post/${item.post.uri.split('/').pop()}`,
          title: text.split('\n')[0]?.slice(0, 100) || 'Flashes Video',
          description: text.slice(0, 500),
          thumbnailUrl: `https://og.bsky.app/${item.post.uri.split('/').pop()}`,
          videoUrl,
          duration: 15,
          creatorName: item.post.author.displayName || item.post.author.handle,
          creatorAvatar: item.post.author.avatar,
          creatorHandle: item.post.author.handle,
          views: (item.post.likeCount ?? 0) + (item.post.repostCount ?? 0),
          likes: item.post.likeCount ?? 0,
          tags: hashtags.length > 0 ? hashtags : topics,
          categories: ['videos', 'shorts', ...topics],
          publishedAt: new Date(item.post.record.createdAt).getTime(),
          qualityScore: 0.6,
          engagementRate: 0,
          canTip: false,
          contentHash: `flashes:${item.post.cid}`,
          vertical: true,
          alsoAvailableOn: [
            {
              source: 'atprotocol',
              label: 'Bluesky',
              url: `https://bsky.app/profile/${item.post.author.handle}/post/${item.post.uri.split('/').pop()}`,
            },
          ],
        });
      }
    }
  } catch {
    // Fail-open
  }

  return shorts.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════
// VINE AGGREGATOR — Pulls from ALL sources, scores by vibe, curates
// ═══════════════════════════════════════════════════════════════════════════

class VineAggregator {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Aggregate shorts from ALL sources + enhance to Vine format.
   * Content refreshed from every available source.
   */
  async aggregateVineShorts(limit = 50): Promise<{
    shorts: VineShort[];
    featured?: VineShort;
    sourceCounts: Record<string, number>;
  }> {
    const aggregatorV2 = new ShortsAggregatorV2(this.env);

    // Fetch from ALL sources in parallel
    const [v2Result, redditShorts, flashesShorts] = await Promise.all([
      aggregatorV2.aggregate({ limit: limit * 2 }),
      fetchRedditVideos(this.env, Math.ceil(limit * 0.2)),
      fetchFlashesShorts(this.env, Math.ceil(limit * 0.15)),
    ]);

    // Combine all shorts
    const allShorts: AggregatedShort[] = [...v2Result.shorts, ...redditShorts, ...flashesShorts];

    // Deduplicate by contentHash
    const seenHashes = new Set<string>();
    const uniqueShorts = allShorts.filter((s) => {
      if (seenHashes.has(s.contentHash)) return false;
      seenHashes.add(s.contentHash);
      return true;
    });

    // Enhance to Vine format with vibe scores
    const vineShorts: VineShort[] = uniqueShorts
      .filter((s) => isVineFormat(s))
      .map((s) => enhanceToVineShort(s));

    // Priority boost to Loops content
    const loopsShorts = vineShorts.filter((s) => s.source === 'loops');
    const otherShorts = vineShorts.filter((s) => s.source !== 'loops');

    // Score and sort by vibe total
    const scoredLoops = loopsShorts.map((s) => ({
      ...s,
      vibeScore: { ...s.vibeScore, total: Math.min(s.vibeScore.total + 10, 100) },
    }));

    const allScored = [...scoredLoops, ...otherShorts];
    allScored.sort((a, b) => b.vibeScore.total - a.vibeScore.total);

    // Pick featured: highest vibe score with good engagement
    const featured = allScored.find((s) => s.vibeScore.total >= 70 && s.views > 100);

    // Mark featured
    const final = allScored.map((s, idx) => ({
      ...s,
      isFeatured: featured ? s.id === featured.id : idx === 0 && s.vibeScore.total > 60,
    }));

    // Build source counts
    const sourceCounts: Record<string, number> = {};
    for (const s of final) {
      sourceCounts[s.source] = (sourceCounts[s.source] ?? 0) + 1;
    }

    return {
      shorts: final.slice(0, limit),
      featured,
      sourceCounts,
    };
  }

  /**
   * Get current queue for a user (pre-loaded 50+ videos)
   */
  async getQueue(userId?: string): Promise<VineQueue> {
    const cacheKey = `vine:queue:${userId ?? 'anonymous'}`;
    const cached = await this.env.SHORTS?.get(cacheKey, 'json').catch(() => null);

    if (cached && typeof cached === 'object' && (cached as VineQueue).expiresAt > Date.now()) {
      return cached as VineQueue;
    }

    // Generate fresh queue
    const { shorts } = await this.aggregateVineShorts(50);

    const queue: VineQueue = {
      shorts,
      queuedAt: Date.now(),
      expiresAt: Date.now() + 300_000, // 5 minutes
      size: shorts.length,
      userId,
    };

    await this.env.SHORTS?.put(cacheKey, JSON.stringify(queue), {
      expirationTtl: 600, // 10 minutes max
    });

    return queue;
  }

  /**
   * Get Vine leaderboard by vibe score
   */
  async getLeaderboard(
    window: 'daily' | 'weekly' = 'daily',
    limit = 20,
  ): Promise<VineLeaderboardEntry[]> {
    const { shorts } = await this.aggregateVineShorts(100);

    const windowMs = window === 'daily' ? 86400000 : 604800000;
    const cutoff = Date.now() - windowMs;

    const eligible = shorts.filter((s) => s.publishedAt > cutoff);
    eligible.sort((a, b) => b.vibeScore.total - a.vibeScore.total);

    return eligible.slice(0, limit).map((s, idx) => ({
      rank: idx + 1,
      short: s,
      vibeScore: s.vibeScore.total,
      revineCount: s.revineCount,
      viewCount: s.views,
    }));
  }

  /**
   * Get active Vine challenges
   */
  async getChallenges(): Promise<VineChallenge[]> {
    // Load from KV; fallback to default challenges
    const cached = await this.env.SHORTS?.get('vine:challenges', 'json').catch(() => null);
    if (cached) return cached as VineChallenge[];

    // Default active challenges
    const defaultChallenges: VineChallenge[] = [
      {
        id: 'degenvine-001',
        name: '#DegenVine Challenge',
        description:
          'Best crypto meme wins 100K sats. Create a 6-second video that makes the crypto community laugh.',
        prize: '100,000 sats',
        category: 'memes',
        startsAt: Date.now() - 86400000,
        endsAt: Date.now() + 604800000 * 2,
        entryCount: 342,
        topEntries: [],
        hashtag: '#DegenVine',
      },
      {
        id: 'vine-talent-001',
        name: 'Vine Talent Show',
        description:
          'Show us your best talent in 6 seconds. Music, dance, magic, tricks — anything goes!',
        prize: '50 USDC + Vine Star badge',
        category: 'tricks',
        startsAt: Date.now() - 86400000 * 3,
        endsAt: Date.now() + 604800000,
        entryCount: 189,
        topEntries: [],
        hashtag: '#VineTalent',
      },
      {
        id: 'pet-vine-001',
        name: 'Funniest Pet Vine',
        description: 'Your pet doing something hilarious in 6 seconds or less.',
        prize: '25 USDC + Pet Vine NFT',
        category: 'pets',
        startsAt: Date.now() - 86400000 * 7,
        endsAt: Date.now() + 86400000 * 14,
        entryCount: 567,
        topEntries: [],
        hashtag: '#PetVine',
      },
      {
        id: 'crypto-edits-001',
        name: 'Crypto Edit Challenge',
        description:
          'Best crypto/DeFi video edit. Show price pumps, trading wins, or DeFi wizardry.',
        prize: '100 USDC + Featured Vine',
        category: 'edits',
        startsAt: Date.now() - 86400000 * 2,
        endsAt: Date.now() + 604800000 * 3,
        entryCount: 123,
        topEntries: [],
        hashtag: '#CryptoEdit',
      },
    ];

    return defaultChallenges;
  }

  /**
   * Submit a short for featured consideration
   */
  async submitForFeatured(
    shortId: string,
    submitterAddress: string,
    reason?: string,
  ): Promise<{ success: boolean; status: string }> {
    const submissionsKey = 'vine:featured:submissions';
    const existing = await this.env.SHORTS?.get(submissionsKey, 'json').catch(() => null);
    const submissions: Array<{
      shortId: string;
      submitter: string;
      reason?: string;
      submittedAt: number;
    }> = (existing as any[]) ?? [];

    // Check if already submitted
    if (submissions.some((s) => s.shortId === shortId)) {
      return { success: false, status: 'already_submitted' };
    }

    submissions.push({
      shortId,
      submitter: submitterAddress,
      reason,
      submittedAt: Date.now(),
    });

    await this.env.SHORTS?.put(submissionsKey, JSON.stringify(submissions), {
      expirationTtl: 86400 * 30,
    });

    return { success: true, status: 'submitted_for_review' };
  }

  /**
   * Get Vine Star profiles for top creators
   */
  async getVineStars(limit = 20): Promise<VineStarProfile[]> {
    const { shorts } = await this.aggregateVineShorts(200);

    // Aggregate by creator
    const creatorStats = new Map<
      string,
      {
        totalVibeScore: number;
        totalRevines: number;
        totalVideos: number;
        categories: VineCategory[];
        avatar?: string;
        address?: string;
      }
    >();

    for (const s of shorts) {
      const existing = creatorStats.get(s.creatorName) ?? {
        totalVibeScore: 0,
        totalRevines: 0,
        totalVideos: 0,
        categories: [] as VineCategory[],
        avatar: s.creatorAvatar,
        address: s.creatorAddress,
      };
      existing.totalVibeScore += s.vibeScore.total;
      existing.totalRevines += s.revineCount;
      existing.totalVideos++;
      existing.categories = [...new Set([...existing.categories, ...s.vineCategory])];
      creatorStats.set(s.creatorName, existing);
    }

    // Determine badge based on total vibe score
    const getBadge = (score: number): VineStarProfile['badge'] => {
      if (score >= 5000) return 'diamond';
      if (score >= 2000) return 'platinum';
      if (score >= 1000) return 'gold';
      if (score >= 500) return 'silver';
      return 'bronze';
    };

    const topCategory = (cats: VineCategory[]): VineCategory =>
      cats.sort((a, b) => VINE_CATEGORIES.indexOf(a) - VINE_CATEGORIES.indexOf(b))[0] ?? 'comedy';

    return [...creatorStats.entries()]
      .sort((a, b) => b[1].totalVibeScore - a[1].totalVibeScore)
      .slice(0, limit)
      .map(([name, stats], idx) => ({
        creatorName: name,
        creatorHandle: shorts.find((s) => s.creatorName === name)?.creatorHandle ?? name,
        creatorAvatar: stats.avatar,
        creatorAddress: stats.address,
        badge: getBadge(stats.totalVibeScore),
        totalVibeScore: stats.totalVibeScore,
        totalRevines: stats.totalRevines,
        totalVideos: stats.totalVideos,
        topCategory: topCategory(stats.categories),
        joinedAt: Date.now() - Math.floor(Math.random() * 86400000 * 30),
      }));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// KV HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const VINE_KV_PREFIX = 'vine:';

function vineProfileKey(address: string): string {
  return `${VINE_KV_PREFIX}profile:${address}`;
}

async function loadVineProfile(env: Env, address?: string): Promise<Record<string, number>> {
  if (!address) return {};
  try {
    const raw = await env.SHORTS?.get(vineProfileKey(address), 'json');
    if (raw) return raw as Record<string, number>;
  } catch {
    /* fail-open */
  }
  return {};
}

async function saveVineProfile(
  env: Env,
  address: string,
  profile: Record<string, number>,
): Promise<void> {
  await env.SHORTS?.put(vineProfileKey(address), JSON.stringify(profile), {
    expirationTtl: 86400 * 90,
  });
}

async function recordRevine(env: Env, shortId: string, userId: string): Promise<void> {
  const key = `${VINE_KV_PREFIX}revines:${shortId}`;
  const existing = await env.SHORTS?.get(key, 'json').catch(() => null);
  const userIds: string[] = (existing as string[]) ?? [];
  if (!userIds.includes(userId)) {
    userIds.push(userId);
    await env.SHORTS?.put(key, JSON.stringify(userIds), { expirationTtl: 86400 * 365 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/shorts/vine — Vine-style curated feed
 *
 * Returns Vine-enhanced shorts with vibe scores, looping format,
 * categorized for the Vine experience.
 *
 * Query params:
 *   ?category=comedy     — Filter by Vine category
 *   ?limit=20           — Pagination limit
 *   ?cursor=...         — Pagination cursor
 *   ?min_vibe=50        — Minimum vibe score filter
 *   ?seen_ids=...       — Comma-separated already-seen IDs
 */
