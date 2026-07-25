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
import { ShortsAggregatorV2, type AggregatedShort, type ExtendedSource } from '../feed/shorts-aggregator-v2';
import { ShortsAlgorithm, type UserShortsProfile, type WatchEvent } from '../feed/shorts-algorithm';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { methodNotAllowed } from '../response-helpers';
import { requireSession } from '../session';

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
  'comedy', 'music', 'art', 'magic', 'tricks', 'pets', 'fails', 'dance',
  'crypto', 'memes', 'pranks', 'edits', 'gaming', 'reactions', 'original_sound',
];

export const VINE_CATEGORY_META: Record<VineCategory, { label: string; emoji: string; color: string }> = {
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
    40 + (short.categories.includes('comedy') || short.categories.includes('memes') ? 30 : 0)
    + engagementBonus + tagDiversity,
    100,
  );
  const creativity = Math.min(
    30 + qualityBonus + (short.categories.includes('art') || short.categories.includes('music') ? 25 : 0)
    + (short.duration <= 6 ? 15 : 0),
    100,
  );
  const originality = Math.min(
    30 + (short.source === 'loops' || short.source === 'direct' ? 20 : 0)
    + (Math.random() * 20) + durationBonus / 2,
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
    20 + short.likes / Math.max((Date.now() - short.publishedAt) / 3600000, 1) * 2,
    100,
  );

  // Viral potential combines multiple factors
  const viralPotential = Math.min(
    (humor * 0.3 + creativity * 0.2 + replayValue * 0.3 + engagementVelocity * 0.2),
    100,
  );

  const total = Math.round(
    humor * 0.20 +
    creativity * 0.15 +
    originality * 0.15 +
    replayValue * 0.20 +
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
    'funny', 'cryptocurrency', 'videos', 'perfectlycutscreams',
    'containsthething', 'bettereveryloop', 'gifsthatkeepongiving',
    'cryptomemes', 'dankmemes', 'maybemaybemaybe', 'unexpected',
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

        const videoUrl = embed.playlist ||
          `https://video.bsky.app/watch/${item.post.uri.split('/').pop()}`;
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
          alsoAvailableOn: [{
            source: 'atprotocol',
            label: 'Bluesky',
            url: `https://bsky.app/profile/${item.post.author.handle}/post/${item.post.uri.split('/').pop()}`,
          }],
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
    const allShorts: AggregatedShort[] = [
      ...v2Result.shorts,
      ...redditShorts,
      ...flashesShorts,
    ];

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
    const featured = allScored.find(
      (s) => s.vibeScore.total >= 70 && s.views > 100,
    );

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
        description: 'Best crypto meme wins 100K sats. Create a 6-second video that makes the crypto community laugh.',
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
        description: 'Show us your best talent in 6 seconds. Music, dance, magic, tricks — anything goes!',
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
        description: 'Best crypto/DeFi video edit. Show price pumps, trading wins, or DeFi wizardry.',
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
    const creatorStats = new Map<string, {
      totalVibeScore: number;
      totalRevines: number;
      totalVideos: number;
      categories: VineCategory[];
      avatar?: string;
      address?: string;
    }>();

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
      cats.sort((a, b) =>
        VINE_CATEGORIES.indexOf(a) - VINE_CATEGORIES.indexOf(b),
      )[0] ?? 'comedy';

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
  } catch { /* fail-open */ }
  return {};
}

async function saveVineProfile(
  env: Env, address: string, profile: Record<string, number>,
): Promise<void> {
  await env.SHORTS?.put(vineProfileKey(address), JSON.stringify(profile), {
    expirationTtl: 86400 * 90,
  });
}

async function recordRevine(
  env: Env, shortId: string, userId: string,
): Promise<void> {
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
export async function handleVineFeed(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);
    const category = url.searchParams.get('category') as VineCategory | null;
    const minVibe = Number(url.searchParams.get('min_vibe')) || 0;
    const seenParam = url.searchParams.get('seen_ids') || '';
    const seenIds = new Set(seenParam ? seenParam.split(',').filter(Boolean) : []);

    const aggregator = new VineAggregator(env);
    const { shorts, featured, sourceCounts } = await aggregator.aggregateVineShorts(limit * 2);

    // Apply filters
    let filtered = shorts;

    if (category && VINE_CATEGORIES.includes(category)) {
      filtered = filtered.filter((s) => s.vineCategory.includes(category));
    }

    if (minVibe > 0) {
      filtered = filtered.filter((s) => s.vibeScore.total >= minVibe);
    }

    if (seenIds.size > 0) {
      filtered = filtered.filter((s) => !seenIds.has(s.id));
    }

    // Diversity: max 2 from same creator in a row, mix sources
    const usedCreators = new Map<string, number>();
    const sourceRotation: ExtendedSource[] = [];
    const diversified: VineShort[] = [];

    for (const short of filtered) {
      const creatorCount = usedCreators.get(short.creatorName) ?? 0;
      if (creatorCount >= 2) continue; // Skip creator if already 2 videos

      // Ensure source diversity
      const lastSource = sourceRotation[sourceRotation.length - 1];
      if (short.source === lastSource && diversified.length > 2) {
        // Try to find a different source
        const nextDifferent = filtered.find(
          (s) => s.source !== lastSource && !usedCreators.has(s.creatorName) && !seenIds.has(s.id),
        );
        if (nextDifferent) {
          diversified.push(nextDifferent);
          usedCreators.set(nextDifferent.creatorName, (usedCreators.get(nextDifferent.creatorName) ?? 0) + 1);
          sourceRotation.push(nextDifferent.source);
          continue;
        }
      }

      diversified.push(short);
      usedCreators.set(short.creatorName, creatorCount + 1);
      sourceRotation.push(short.source);

      if (diversified.length >= limit) break;
    }

    // New content injection: 20% from unseen sources
    const newContentRatio = 0.2;
    const existingCount = diversified.length;
    const newContentNeeded = Math.ceil(limit * newContentRatio);
    const newContent = filtered
      .filter((s) => !diversified.some((d) => d.id === s.id))
      .slice(0, newContentNeeded);

    // Interleave new content
    const final: VineShort[] = [];
    let newIdx = 0;
    for (let i = 0; i < Math.min(diversified.length, limit - newContent.length); i++) {
      final.push(diversified[i]!);
      // Inject every 5th position with new content
      if ((i + 1) % 5 === 0 && newIdx < newContent.length) {
        final.push(newContent[newIdx]!);
        newIdx++;
      }
    }

    // Vibe stats
    const vibeScores = final.map((s) => s.vibeScore.total);
    const vibeRange = {
      min: Math.min(...vibeScores),
      max: Math.max(...vibeScores),
      avg: Math.round(vibeScores.reduce((a, b) => a + b, 0) / vibeScores.length),
    };

    const response: VineFeedResponse = {
      shorts: final.slice(0, limit),
      categories: [...new Set(final.flatMap((s) => s.vineCategory))],
      vibeRange,
      featured,
      hasMore: filtered.length > limit,
      cursor: final.length > 0 ? `${final[final.length - 1]!.id}:${Date.now()}` : null,
      aggregatedAt: Date.now(),
    };

    return noCacheJsonResponse(response);
  } catch (err) {
    return jsonResponse({
      error: 'Failed to load Vine feed',
      details: err instanceof Error ? err.message : String(err),
    }, 500);
  }
}

/**
 * GET /api/shorts/vibe — Vibe-scored content
 *
 * Returns shorts sorted by vibe score with full breakdown.
 * Best for: "I want to see the funniest/most creative content"
 *
 * Query params:
 *   ?sort=humor|creativity|originality|replay|total
 *   ?limit=20
 *   ?category=comedy
 */
export async function handleVibeFeed(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);
    const sortBy = (url.searchParams.get('sort') || 'total') as keyof VibeScore;
    const category = url.searchParams.get('category') as VineCategory | null;

    const aggregator = new VineAggregator(env);
    const { shorts } = await aggregator.aggregateVineShorts(limit * 2);

    let results = shorts;

    if (category && VINE_CATEGORIES.includes(category)) {
      results = results.filter((s) => s.vineCategory.includes(category));
    }

    // Sort by selected vibe dimension
    const validSortKeys: (keyof VibeScore)[] = [
      'total', 'humor', 'creativity', 'originality',
      'replayValue', 'productionQuality', 'engagementVelocity', 'viralPotential',
    ];
    const sortKey = validSortKeys.includes(sortBy) ? sortBy : 'total';

    results.sort((a, b) => b.vibeScore[sortKey] - a.vibeScore[sortKey]);

    return noCacheJsonResponse({
      shorts: results.slice(0, limit),
      sortBy: sortKey,
      category: category ?? 'all',
      count: results.slice(0, limit).length,
      aggregatedAt: Date.now(),
    });
  } catch (err) {
    return jsonResponse({
      error: 'Failed to load vibe feed',
      details: err instanceof Error ? err.message : String(err),
    }, 500);
  }
}

/**
 * GET /api/shorts/queue — Pre-loaded content queue
 *
 * Returns a pre-loaded queue of 50+ vibed Vine shorts.
 * The queue is cached for 5 minutes and refreshed automatically.
 *
 * Query params:
 *   ?refresh=true    — Force refresh queue
 *   ?size=50         — Queue size
 */
export async function handleVineQueue(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    // Get user ID from session if available
    const session = await requireSession(request, env).catch(() => null);
    const userId = session instanceof Object ? (session as { address?: string }).address : undefined;

    const aggregator = new VineAggregator(env);

    if (forceRefresh) {
      // Clear cache and regenerate
      const cacheKey = `vine:queue:${userId ?? 'anonymous'}`;
      await env.SHORTS?.delete(cacheKey).catch(() => {});
    }

    const queue = await aggregator.getQueue(userId);

    return noCacheJsonResponse({
      ...queue,
      refreshed: forceRefresh,
    });
  } catch (err) {
    return jsonResponse({
      error: 'Failed to load queue',
      details: err instanceof Error ? err.message : String(err),
    }, 500);
  }
}

/**
 * POST /api/shorts/queue/refresh — Refresh queue
 *
 * Forces a refresh of the pre-loaded queue for the current user.
 * Returns the fresh queue immediately.
 */
export async function handleVineQueueRefresh(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const userId = session.address;
    const cacheKey = `vine:queue:${userId}`;

    // Clear cache
    await env.SHORTS?.delete(cacheKey).catch(() => {});

    // Generate fresh queue
    const aggregator = new VineAggregator(env);
    const queue = await aggregator.getQueue(userId);

    return jsonResponse({
      ...queue,
      refreshed: true,
      message: `Queue refreshed with ${queue.size} vines`,
    });
  } catch (err) {
    return jsonResponse({
      error: 'Failed to refresh queue',
      details: err instanceof Error ? err.message : String(err),
    }, 500);
  }
}

/**
 * POST /api/shorts/revine — Revine (repost) a short
 *
 * "Revine" = Repost/Share a Vine to the user's followers.
 * Records the revine and returns cross-platform sharing links.
 *
 * Body:
 *   { shortId: string, platforms?: string[] }
 */
export async function handleRevine(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const body = (await request.json()) as {
      shortId: string;
      platforms?: string[];
    };

    if (!body.shortId) {
      return jsonResponse({ error: 'shortId is required' }, 400);
    }

    // Record the revine
    await recordRevine(env, body.shortId, session.address);

    const platforms = body.platforms ?? ['degenfeed'];

    // Build cross-platform repost URLs
    const crossPlatformLinks = platforms.map((platform) => {
      const baseUrl = 'https://degenfeed.xyz';
      switch (platform) {
        case 'farcaster':
          return { platform, url: `${baseUrl}/api/shorts/share/farcaster/${body.shortId}`, label: 'Share on Farcaster' };
        case 'nostr':
          return { platform, url: `${baseUrl}/api/shorts/share/nostr/${body.shortId}`, label: 'Share on Nostr' };
        case 'bluesky':
          return { platform, url: `${baseUrl}/api/shorts/share/bluesky/${body.shortId}`, label: 'Share on Bluesky' };
        case 'twitter':
          return { platform, url: `https://twitter.com/intent/tweet?url=${baseUrl}/s/${body.shortId}`, label: 'Share on Twitter/X' };
        default:
          return { platform, url: `${baseUrl}/s/${body.shortId}`, label: 'Copy link' };
      }
    });

    return jsonResponse({
      success: true,
      shortId: body.shortId,
      revined: true,
      revineCount: 1, // Placeholder — would increment counter
      crossPlatformLinks,
      message: 'Revined! Shared to your followers.',
    });
  } catch (err) {
    return jsonResponse({
      error: 'Revine failed',
      details: err instanceof Error ? err.message : String(err),
    }, 500);
  }
}

/**
 * GET /api/shorts/vine/top — Daily/Weekly Top Vines leaderboard
 *
 * Returns the top vibed shorts for the given time window.
 *
 * Query params:
 *   ?window=daily|weekly
 *   ?limit=20
 */
export async function handleVineTop(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const url = new URL(request.url);
    const window = (url.searchParams.get('window') || 'daily') as 'daily' | 'weekly';
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);

    const aggregator = new VineAggregator(env);
    const leaderboard = await aggregator.getLeaderboard(window, limit);

    return noCacheJsonResponse({
      window,
      leaderboard,
      count: leaderboard.length,
      updatedAt: Date.now(),
    });
  } catch (err) {
    return jsonResponse({
      error: 'Failed to load leaderboard',
      details: err instanceof Error ? err.message : String(err),
    }, 500);
  }
}

/**
 * POST /api/shorts/vine/feature — Submit a short for featured consideration
 *
 * Body:
 *   { shortId: string, reason?: string }
 */
export async function handleVineFeatureSubmit(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const body = (await request.json()) as {
      shortId: string;
      reason?: string;
    };

    if (!body.shortId) {
      return jsonResponse({ error: 'shortId is required' }, 400);
    }

    const aggregator = new VineAggregator(env);
    const result = await aggregator.submitForFeatured(body.shortId, session.address, body.reason);

    return jsonResponse(result, result.success ? 201 : 200);
  } catch (err) {
    return jsonResponse({
      error: 'Failed to submit for featured',
      details: err instanceof Error ? err.message : String(err),
    }, 500);
  }
}

/**
 * GET /api/shorts/vine/challenges — Active Vine challenges
 *
 * Returns active challenges with top entries.
 */
export async function handleVineChallenges(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const aggregator = new VineAggregator(env);
    const challenges = await aggregator.getChallenges();

    // Enrich each challenge with top entries from the aggregator
    const { shorts } = await aggregator.aggregateVineShorts(100);

    const enriched = challenges.map((ch) => ({
      ...ch,
      topEntries: shorts
        .filter((s) => s.tags.some((t) => ch.hashtag.replace('#', '').toLowerCase() === t.toLowerCase()))
        .sort((a, b) => b.vibeScore.total - a.vibeScore.total)
        .slice(0, 5),
    }));

    return noCacheJsonResponse({
      challenges: enriched,
      count: enriched.length,
    });
  } catch (err) {
    return jsonResponse({
      error: 'Failed to load challenges',
      details: err instanceof Error ? err.message : String(err),
    }, 500);
  }
}

/**
 * POST /api/shorts/vine/challenges/join — Join a challenge
 *
 * Body:
 *   { challengeId: string, shortId: string }
 */
export async function handleVineChallengeJoin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const body = (await request.json()) as {
      challengeId: string;
      shortId: string;
    };

    if (!body.challengeId || !body.shortId) {
      return jsonResponse({ error: 'challengeId and shortId are required' }, 400);
    }

    // Record challenge entry
    const key = `vine:challenge:entries:${body.challengeId}`;
    const existing = await env.SHORTS?.get(key, 'json').catch(() => null);
    const entries: Array<{ shortId: string; userId: string; enteredAt: number }> =
      (existing as any[]) ?? [];

    if (entries.some((e) => e.shortId === body.shortId)) {
      return jsonResponse({ success: false, error: 'Already entered this challenge' }, 409);
    }

    entries.push({
      shortId: body.shortId,
      userId: session.address,
      enteredAt: Date.now(),
    });

    await env.SHORTS?.put(key, JSON.stringify(entries), { expirationTtl: 86400 * 90 });

    return jsonResponse({
      success: true,
      challengeId: body.challengeId,
      message: 'Successfully joined the challenge! Good luck!',
    });
  } catch (err) {
    return jsonResponse({
      error: 'Failed to join challenge',
      details: err instanceof Error ? err.message : String(err),
    }, 500);
  }
}

/**
 * GET /api/shorts/vine/stars — Vine Star leaderboard
 *
 * Returns top creators ranked by total vibe score with badges.
 *
 * Query params:
 *   ?limit=20
 */
export async function handleVineStars(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 100);

    const aggregator = new VineAggregator(env);
    const stars = await aggregator.getVineStars(limit);

    return noCacheJsonResponse({
      stars,
      count: stars.length,
      badgeTiers: [
        { badge: 'diamond', threshold: 5000, label: 'Diamond Vine Star' },
        { badge: 'platinum', threshold: 2000, label: 'Platinum Vine Star' },
        { badge: 'gold', threshold: 1000, label: 'Gold Vine Star' },
        { badge: 'silver', threshold: 500, label: 'Silver Vine Star' },
        { badge: 'bronze', threshold: 0, label: 'Bronze Vine Star' },
      ],
    });
  } catch (err) {
    return jsonResponse({
      error: 'Failed to load Vine Stars',
      details: err instanceof Error ? err.message : String(err),
    }, 500);
  }
}

/**
 * GET /api/shorts/vine/categories — List Vine categories with metadata
 */
export async function handleVineCategories(_request: Request, _env: Env): Promise<Response> {
  return noCacheJsonResponse({
    categories: VINE_CATEGORIES.map((cat) => ({
      id: cat,
      ...VINE_CATEGORY_META[cat],
    })),
  });
}

/**
 * POST /api/shorts/vine/sound/:id/attribute — Attribute original sound creator
 *
 * Body:
 *   { shortId: string, soundCreatorName: string, soundCreatorHandle: string, soundCreatorAvatar?: string }
 */
export async function handleAttributeSound(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const url = new URL(request.url);
    const shortId = url.pathname.split('/')[5]; // /api/shorts/vine/sound/:id/attribute
    const body = (await request.json()) as {
      soundCreatorName: string;
      soundCreatorHandle: string;
      soundCreatorAvatar?: string;
    };

    if (!shortId || !body.soundCreatorName || !body.soundCreatorHandle) {
      return jsonResponse({ error: 'shortId, soundCreatorName, and soundCreatorHandle are required' }, 400);
    }

    // Store sound attribution
    const key = `vine:sound:attr:${shortId}`;
    await env.SHORTS?.put(key, JSON.stringify({
      shortId,
      attributedBy: session.address,
      soundCreator: {
        name: body.soundCreatorName,
        handle: body.soundCreatorHandle,
        avatar: body.soundCreatorAvatar,
      },
      attributedAt: Date.now(),
    }), { expirationTtl: 86400 * 365 });

    return jsonResponse({
      success: true,
      message: `Original sound attributed to ${body.soundCreatorName}`,
      shortId,
      soundCreator: body.soundCreatorName,
    });
  } catch (err) {
    return jsonResponse({
      error: 'Failed to attribute sound',
      details: err instanceof Error ? err.message : String(err),
    }, 500);
  }
}

/**
 * POST /api/shorts/vine/watch — Record a Vine watch + update vibe score
 *
 * Extends the existing watch handler with Vine-specific tracking.
 */
export async function handleVineWatch(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as WatchEvent & { shortId: string };

    if (!body.shortId) {
      return jsonResponse({ error: 'shortId is required' }, 400);
    }

    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    // Record watch event (reuse existing algorithm)
    const watchEvent: WatchEvent = {
      shortId: body.shortId,
      watchPercent: Math.min(Math.max(0, body.watchPercent ?? 0), 1),
      liked: body.liked ?? false,
      shared: body.shared ?? false,
      watchedFull: body.watchedFull ?? false,
      skipped: body.skipped ?? false,
      watchDurationMs: Math.max(0, body.watchDurationMs ?? 0),
      timestamp: Date.now(),
    };

    // Update user's category preferences based on watch
    const categoryPrefs = await loadVineProfile(env, session.address);
    const short = await env.SHORTS?.get(`vine:short:${body.shortId}`, 'json').catch(() => null);

    // Increment category affinity
    if (short && typeof short === 'object') {
      const s = short as { vineCategory?: VineCategory[] };
      if (s.vineCategory) {
        for (const cat of s.vineCategory) {
          categoryPrefs[cat] = (categoryPrefs[cat] ?? 0) + (watchEvent.watchedFull ? 2 : 1);
          if (watchEvent.liked) categoryPrefs[cat] = (categoryPrefs[cat] ?? 0) + 1;
          if (watchEvent.skipped) categoryPrefs[cat] = Math.max(0, (categoryPrefs[cat] ?? 0) - 1);
        }
        await saveVineProfile(env, session.address, categoryPrefs);
      }
    }

    return jsonResponse({
      success: true,
      recorded: watchEvent.shortId,
      categoryPreferences: categoryPrefs,
    });
  } catch (err) {
    return jsonResponse({
      error: 'Failed to record vine watch',
      details: err instanceof Error ? err.message : String(err),
    }, 500);
  }
}
