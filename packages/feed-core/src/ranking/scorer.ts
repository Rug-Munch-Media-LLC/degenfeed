/**
 * scorer — Enhanced content quality scoring, author reputation, and
 * diversity signals for the ranking engine.
 *
 * New quality signals:
 *   - Original content bonus (+3 for non-link / non-repost posts)
 *   - Engagement velocity (+1-3 for rapid recent engagement)
 *   - Author reputation (+1 verified, +0.5 for established accounts)
 *   - Content length penalty (-2 for very short non-reply posts)
 *   - Media bonus (+1 for images / video)
 */

import { detectContentType } from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';

// ─── Signal types ────────────────────────────────────────────────────

export interface QualitySignals {
  originalContentBonus: number;
  engagementVelocity: number;
  authorReputation: number;
  contentLengthPenalty: number;
  mediaBonus: number;
  total: number;
}

export interface AuthorReputation {
  isVerified: boolean;
  isEstablished: boolean;
  followerTier: 'none' | 'low' | 'medium' | 'high';
  score: number;
}

export interface ScorerContext {
  /** Author IDs the viewer follows. */
  followed: Set<string>;
  /** Current time for age calculations. */
  now: number;
}

// ─── Quality signal computation ──────────────────────────────────────

/**
 * Compute author reputation signal.
 * - Verified authors (green check): +1
 * - Established accounts (>100 followers): +0.5
 * - Followed by viewer: +0.5
 */
export function computeAuthorReputation(post: UnifiedPost, ctx: ScorerContext): AuthorReputation {
  const isVerified = post.author.verified.length > 0;
  const followerCount = post.author.followerCount ?? 0;
  const isEstablished = followerCount >= 100;
  const isFollowed = ctx.followed.has(post.author.id);

  let score = 0;
  if (isVerified) score += 1;
  if (isEstablished) score += 0.5;
  if (isFollowed) score += 0.5;

  let followerTier: AuthorReputation['followerTier'] = 'none';
  if (followerCount >= 10_000) followerTier = 'high';
  else if (followerCount >= 1_000) followerTier = 'medium';
  else if (followerCount >= 100) followerTier = 'low';

  return { isVerified, isEstablished, followerTier, score };
}

/**
 * Compute a rich set of quality signals for a post.
 * These feed into the overall ranking score as additive bonuses / penalties.
 */
export function computeQualitySignals(post: UnifiedPost, ctx: ScorerContext): QualitySignals {
  // 1. Original content bonus (+3 for original, non-link, non-repost)
  const isRepost =
    /^RT\b/i.test(post.text) ||
    /^[@＠]\w+/i.test(post.text.trim()) ||
    (post.html?.includes('blockquote') ?? false);
  const contentType = detectContentType(post);
  const isLinkOnly = contentType === 'link';
  const originalContentBonus = isRepost || isLinkOnly ? 0 : 3;

  // 2. Engagement velocity (+1-3 based on recent engagement rate)
  // Uses current metrics as a proxy when velocity snapshots are unavailable.
  const totalEngagement =
    post.metrics.likes +
    post.metrics.reposts * 2 +
    post.metrics.replies * 3 +
    (post.metrics.quotes ?? 0) * 4;
  const ageHours = Math.max(0.1, (ctx.now - post.createdAt) / (1000 * 60 * 60));
  const engagementRate = totalEngagement / Math.max(ageHours, 0.1);

  let engagementVelocity = 0;
  if (engagementRate > 50) engagementVelocity = 3;
  else if (engagementRate > 20) engagementVelocity = 2;
  else if (engagementRate > 5) engagementVelocity = 1;

  // 3. Author reputation
  const authorRep = computeAuthorReputation(post, ctx);
  const authorReputation = authorRep.score;

  // 4. Content length penalty (-2 for very short non-reply posts)
  const isReply = !!post.parentId;
  const contentLength = post.text.trim().length;
  const contentLengthPenalty = !isReply && contentLength < 20 ? -2 : 0;

  // 5. Media bonus (+1 for images/video)
  const hasImage = post.embeds.some((e) => e.kind === 'image');
  const hasVideo = post.embeds.some((e) => e.kind === 'video');
  const mediaBonus = hasImage || hasVideo ? 1 : 0;

  return {
    originalContentBonus,
    engagementVelocity,
    authorReputation,
    contentLengthPenalty,
    mediaBonus,
    total:
      originalContentBonus +
      engagementVelocity +
      authorReputation +
      contentLengthPenalty +
      mediaBonus,
  };
}

// ─── Diversity helpers ───────────────────────────────────────────────

export interface DiversityConstraints {
  /** Max posts per author per page (default 3). */
  maxPerAuthor: number;
  /** Max posts per niche / topic per page (default 5). */
  maxPerNiche: number;
  /** Whether to interleave protocols (default true). */
  interleaveProtocols: boolean;
}

export const DEFAULT_DIVERSITY: DiversityConstraints = {
  maxPerAuthor: 3,
  maxPerNiche: 5,
  interleaveProtocols: true,
};

/**
 * Check whether a post can be added without violating the diversity
 * constraints.  Updates the per-author and per-niche counters when
 * `consume` is true (call with consume=true for accepted posts).
 */
export function checkDiversity(
  post: UnifiedPost,
  authorCounts: Map<string, number>,
  nicheCounts: Map<string, number>,
  constraints: DiversityConstraints = DEFAULT_DIVERSITY,
  consume = false,
): { allowed: boolean; reason?: string } {
  // Per-author cap
  const authorKey = post.author.id;
  const authorCount = authorCounts.get(authorKey) ?? 0;
  if (authorCount >= constraints.maxPerAuthor) {
    return { allowed: false, reason: 'max-author' };
  }

  // Per-niche cap
  for (const niche of post.niches) {
    const nicheCount = nicheCounts.get(niche) ?? 0;
    if (nicheCount >= constraints.maxPerNiche) {
      return { allowed: false, reason: `max-niche:${niche}` };
    }
  }

  if (consume) {
    authorCounts.set(authorKey, authorCount + 1);
    for (const niche of post.niches) {
      nicheCounts.set(niche, (nicheCounts.get(niche) ?? 0) + 1);
    }
  }

  return { allowed: true };
}

/**
 * Interleave posts by protocol so the feed doesn't show 10 Nostr posts
 * in a row.  Takes a scored list and redistributes it so each protocol
 * gets a turn in round-robin fashion.
 */
export function interleaveByProtocol<T extends { protocol: string }>(posts: T[]): T[] {
  if (posts.length <= 2) return posts;

  // Group by protocol, preserving original score order within each group
  const groups = new Map<string, T[]>();
  for (const p of posts) {
    const g = groups.get(p.protocol) ?? [];
    g.push(p);
    groups.set(p.protocol, g);
  }

  const result: T[] = [];
  const keys = [...groups.keys()];
  const maxLen = Math.max(...keys.map((k) => groups.get(k)?.length ?? 0));

  for (let i = 0; i < maxLen; i++) {
    for (const key of keys) {
      const group = groups.get(key);
      if (group && i < group.length) {
        const item = group[i]!;
        result.push(item);
      }
    }
  }

  return result;
}
