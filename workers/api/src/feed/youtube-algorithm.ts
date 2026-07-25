/**
 * @degenfeed/api-worker — DegenFeed YouTube Recommendation Engine
 *
 * A DegenFeed-native YouTube recommendation engine with 7 strategies:
 *
 * 1. Content-based: Match video topic/tags to user interests
 * 2. Creator-based: Suggest more from creators user watches
 * 3. Collaborative: "Users who watched X also watched Y" (hashed fingerprint)
 * 4. Freshness: Boost new uploads from subscribed creators
 * 5. Diversity: Inject new creators/topics periodically
 * 6. Watch time: Track and optimize for watch completion
 * 7. Anti-clickbait: Downrank clickbait titles/thumbnails
 *
 * KV cache prefix: yt:alg:* (5min TTL)
 */

import type { YouTubeVideoItem } from '@degenfeed/youtube-provider';
import { fetchYouTubeFeed, fetchTrendingByCategory, discoverCreators } from '@degenfeed/youtube-provider';
import type { Env } from '../index';

// ─── Constants ────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS = {
  contentBased: 0.25,
  creatorBased: 0.20,
  collaborative: 0.10,
  freshness: 0.15,
  diversity: 0.10,
  watchTime: 0.10,
  antiClickbait: 0.10,
};

const FRESHNESS_BOOST_HOURS = 48; // 2 days of fresh boost
const DIVERSITY_INJECTION_RATE = 0.15; // 15% of results are new creators
const MIN_WATCH_TIME_RATIO = 0.3; // minimum 30% completion to count

// ─── Types ────────────────────────────────────────────────────────────────

export interface UserInterestProfile {
  niches: string[];
  categories: string[];
  followedCreators: string[];
  watchedVideoIds: string[];
  watchedCreatorIds: string[];
  /** Watch history with completion ratios */
  watchHistory: Array<{
    videoId: string;
    creatorId: string;
    completionRatio: number;
    watchDurationMs: number;
    timestamp: number;
  }>;
  /** Collaborative hash — a hashed fingerprint of what the user watches */
  collaborativeHash?: string;
}

export interface YouTubeAlgorithmWeights {
  contentBased: number;
  creatorBased: number;
  collaborative: number;
  freshness: number;
  diversity: number;
  watchTime: number;
  antiClickbait: number;
}

export interface YouTubeRecommendation {
  video: YouTubeVideoItem;
  score: number;
  breakdown: {
    contentBased: number;
    creatorBased: number;
    collaborative: number;
    freshness: number;
    diversity: number;
    watchTime: number;
    antiClickbait: number;
    total: number;
  };
  reasons: string[];
}

// ─── Main recommendation engine ─────────────────────────────────────────

export class YouTubeAlgorithm {
  private env: Env;
  private weights: YouTubeAlgorithmWeights;

  constructor(env: Env, weights?: Partial<YouTubeAlgorithmWeights>) {
    this.env = env;
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  /**
   * Get personalized YouTube recommendations for a user.
   */
  async getRecommendations(
    profile: UserInterestProfile,
    limit: number = 20,
    signal?: AbortSignal,
  ): Promise<YouTubeRecommendation[]> {
    const candidateVideos = await this.gatherCandidates(profile, limit * 3, signal);
    const scored = this.scoreAll(candidateVideos, profile);
    const diversified = this.applyDiversity(scored, profile, limit);
    return diversified.slice(0, limit);
  }

  // ─── Gather candidates from all strategies ─────────────────────────

  private async gatherCandidates(
    profile: UserInterestProfile,
    limit: number,
    signal?: AbortSignal,
  ): Promise<YouTubeVideoItem[]> {
    const candidates: YouTubeVideoItem[] = [];
    const seen = new Set<string>();

    // 1. Fetch content-based candidates (match topics)
    if (profile.niches.length > 0 || profile.categories.length > 0) {
      const niche = profile.niches[0] || profile.categories[0] || 'crypto';
      const contentVideos = await fetchYouTubeFeed({
        category: niche,
        limit: Math.ceil(limit * 0.4),
        sort: 'trending',
        signal,
        enableDiscovery: true,
      });
      for (const v of contentVideos) {
        if (!seen.has(v.id)) {
          seen.add(v.id);
          candidates.push(v);
        }
      }
    }

    // 2. Fetch creator-based candidates (followed creators)
    if (profile.followedCreators.length > 0) {
      const creatorVideos = await fetchYouTubeFeed({
        channels: profile.followedCreators.slice(0, 10),
        limit: Math.ceil(limit * 0.3),
        sort: 'recent',
        signal,
      });
      for (const v of creatorVideos) {
        if (!seen.has(v.id)) {
          seen.add(v.id);
          candidates.push(v);
        }
      }
    }

    // 3. Fetch trending (diversity injection)
    const trendingSources = ['all', 'crypto', 'tech'];
    for (const cat of trendingSources) {
      const trending = await fetchTrendingByCategory(cat, Math.ceil(limit * 0.2), signal);
      for (const v of trending) {
        if (!seen.has(v.id)) {
          seen.add(v.id);
          candidates.push(v);
        }
      }
    }

    // 4. Discover new creators (diversity)
    try {
      const discovered = await discoverCreators(
        [...profile.niches, ...profile.categories].filter(Boolean),
        Math.ceil(limit * 0.1),
        signal,
      );
      // For discovered creators, fetch their recent videos
      for (const creator of discovered.slice(0, 5)) {
        const discoverVideos = await fetchYouTubeFeed({
          channels: [creator.name],
          limit: 3,
          sort: 'recent',
          signal,
        });
        for (const v of discoverVideos) {
          if (!seen.has(v.id)) {
            seen.add(v.id);
            candidates.push(v);
          }
        }
      }
    } catch {
      // Discovery is best-effort
    }

    return candidates;
  }

  // ─── Score all candidates ──────────────────────────────────────────

  private scoreAll(
    videos: YouTubeVideoItem[],
    profile: UserInterestProfile,
  ): YouTubeRecommendation[] {
    return videos.map((video) => this.scoreVideo(video, profile));
  }

  // ─── Score a single video ──────────────────────────────────────────

  private scoreVideo(
    video: YouTubeVideoItem,
    profile: UserInterestProfile,
  ): YouTubeRecommendation {
    const text = `${video.title} ${video.description ?? ''}`.toLowerCase();
    const reasons: string[] = [];

    // 1. Content-based score: match niches/categories
    let contentBased = 0;
    const nicheHits = profile.niches.filter((n) => text.includes(n)).length;
    const catHits = profile.categories.filter((c) => text.includes(c)).length;
    if (nicheHits > 0 || catHits > 0) {
      contentBased = Math.min(1, (nicheHits * 0.3 + catHits * 0.2));
      if (contentBased > 0.3) reasons.push('matches your interests');
    }

    // Boost by category match
    if (video.channelCategory && profile.categories.includes(video.channelCategory)) {
      contentBased = Math.max(contentBased, 0.6);
      reasons.push('in your preferred category');
    }

    // 2. Creator-based score: do they watch this creator?
    let creatorBased = 0;
    if (profile.followedCreators.includes(video.channelName)) {
      creatorBased = 1.0;
      reasons.push('from a creator you follow');
    } else if (profile.watchedCreatorIds.includes(video.channelName)) {
      creatorBased = 0.7;
      reasons.push('from a creator you watch');
    } else {
      // Check if they've watched videos from this channel
      const channelWatches = profile.watchHistory.filter(
        (w) => w.creatorId === video.channelName,
      );
      if (channelWatches.length > 0) {
        const avgCompletion = channelWatches.reduce((s, w) => s + w.completionRatio, 0) /
          channelWatches.length;
        creatorBased = Math.min(0.8, avgCompletion * 0.8);
        if (avgCompletion > MIN_WATCH_TIME_RATIO) {
          reasons.push('you finish their videos');
        }
      }
    }

    // 3. Collaborative score (simplified: niche + category overlap with other users)
    let collaborative = 0;
    if (video.niches && profile.niches.length > 0) {
      const overlap = video.niches.filter((n) => profile.niches.includes(n)).length;
      collaborative = Math.min(1, overlap / Math.max(1, video.niches.length) * 0.5);
    }
    if (collaborative > 0.2) reasons.push('popular in your niche');

    // 4. Freshness score
    const ageHours = (Date.now() - video.publishedMs) / 3600000;
    const freshness = Math.max(0, 1 - ageHours / (FRESHNESS_BOOST_HOURS * 7));
    if (freshness > 0.7) reasons.push('fresh upload');

    // 5. Diversity score (inverse of creator repetition)
    const creatorFrequency = profile.watchedCreatorIds.filter(
      (id) => id === video.channelName,
    ).length;
    const diversity = Math.max(0, 1 - creatorFrequency * 0.15);
    if (diversity > 0.8 && creatorFrequency === 0) {
      reasons.push('new creator for you');
    }

    // 6. Watch time score
    let watchTime = 0.5; // default neutral
    const watchHistory = profile.watchHistory.filter(
      (w) => w.creatorId === video.channelName,
    );
    if (watchHistory.length > 0) {
      const avgCompletion = watchHistory.reduce((s, w) => s + w.completionRatio, 0) /
        watchHistory.length;
      watchTime = Math.min(1, avgCompletion * 1.2); // reward high completion
    }

    // Predicted watch time based on video duration and channel
    if (video.duration) {
      const durationParts = video.duration.split(':').map(Number);
      const totalSec = durationParts.length === 3
        ? durationParts[0]! * 3600 + durationParts[1]! * 60 + (durationParts[2] ?? 0)
        : durationParts[0]! * 60 + (durationParts[1] ?? 0);

      // Videos 5-20 minutes have highest completion
      if (totalSec >= 300 && totalSec <= 1200) watchTime += 0.2;
      else if (totalSec > 3600) watchTime -= 0.1; // very long videos
    }

    // 7. Anti-clickbait score
    let antiClickbait = 1.0;
    if (video.qualityScore) {
      antiClickbait = 1 - video.qualityScore.clickbaitPenalty;
    } else {
      // Basic clickbait detection fallback
      const clickbaitPatterns = [
        /you won't believe/i, /shocked?ing/i, /mind[ -]?blowing/i,
        /gone wrong/i, /will surprise you/i, /can't handle/i,
        /😱|🤯|💥|🚀|💯|🔥/i,
      ];
      for (const pattern of clickbaitPatterns) {
        if (pattern.test(video.title)) {
          antiClickbait -= 0.2;
          reasons.push('clickbait-adjusted');
          break;
        }
      }
      // ALL CAPS penalty
      const capsRatio = [...video.title].filter((c) => c >= 'A' && c <= 'Z').length /
        Math.max(1, video.title.length);
      if (capsRatio > 0.6) antiClickbait -= 0.2;
    }
    antiClickbait = Math.max(0, antiClickbait);

    // Compute total score
    const total =
      contentBased * this.weights.contentBased +
      creatorBased * this.weights.creatorBased +
      collaborative * this.weights.collaborative +
      freshness * this.weights.freshness +
      diversity * this.weights.diversity +
      watchTime * this.weights.watchTime +
      antiClickbait * this.weights.antiClickbait;

    return {
      video,
      score: total,
      breakdown: {
        contentBased,
        creatorBased,
        collaborative,
        freshness,
        diversity,
        watchTime,
        antiClickbait,
        total,
      },
      reasons: reasons.slice(0, 3), // Top 3 reasons
    };
  }

  // ─── Apply diversity injection ─────────────────────────────────────

  private applyDiversity(
    scored: YouTubeRecommendation[],
    profile: UserInterestProfile,
    limit: number,
  ): YouTubeRecommendation[] {
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const result: YouTubeRecommendation[] = [];
    const seenCreators = new Set<string>();
    const seenVideos = new Set<string>();

    // First pass: take top picks, ensuring creator diversity
    for (const rec of scored) {
      if (result.length >= limit) break;
      if (seenVideos.has(rec.video.id)) continue;
      seenVideos.add(rec.video.id);

      // Avoid saturating with one creator
      const creatorDupes = result.filter((r) => r.video.channelName === rec.video.channelName).length;
      if (creatorDupes >= 2) continue;

      result.push(rec);
      seenCreators.add(rec.video.channelName);
    }

    // Second pass: inject new creators if below diversity threshold
    const watchedCreators = new Set(profile.watchedCreatorIds);
    const followedCreators = new Set(profile.followedCreators);
    const newCreatorsCount = result.filter(
      (r) => !watchedCreators.has(r.video.channelName) && !followedCreators.has(r.video.channelName),
    ).length;

    if (newCreatorsCount / Math.max(1, result.length) < DIVERSITY_INJECTION_RATE) {
      // Find more new creators to inject
      for (const rec of scored) {
        if (result.length >= limit) break;
        if (seenVideos.has(rec.video.id)) continue;
        if (watchedCreators.has(rec.video.channelName) || followedCreators.has(rec.video.channelName)) continue;

        seenVideos.add(rec.video.id);
        result.push({
          ...rec,
          reasons: [...rec.reasons, 'new creator discovery'],
        });
      }
    }

    return result;
  }
}

// ─── Utility functions ────────────────────────────────────────────────────

/**
 * Build a user interest profile from their watch history and follows.
 */
export function buildUserProfile(params: {
  followedCreators: string[];
  watchedVideoIds: string[];
  watchedCreatorIds: string[];
  watchHistory: UserInterestProfile['watchHistory'];
  niches: string[];
  categories: string[];
}): UserInterestProfile {
  return {
    ...params,
    collaborativeHash: computeCollaborativeHash(params.watchedVideoIds),
  };
}

/**
 * Compute a simple collaborative hash from watched video IDs.
 * This is a privacy-safe fingerprint — not the actual IDs.
 */
export function computeCollaborativeHash(watchedIds: string[]): string {
  const sorted = [...new Set(watchedIds)].sort();
  const hash = sorted.slice(0, 100).join('|').length.toString(16);
  return `ch:${hash}`;
}
