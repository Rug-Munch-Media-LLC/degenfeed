/**
 * @degenfeed/feed-core — Content Quality Scoring v2
 *
 * A sophisticated quality scoring system that goes beyond simple spamScore.
 * Detects truly high-quality content vs low-effort posts using engagement
 * density, author quality, content uniqueness, depth, and media signals.
 *
 * Output: composite quality score 0-100 (higher = better).
 */

import type { UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

// ─── Types ─────────────────────────────────────────────────────────────

export interface AuthorProfile {
  /** Account age in days */
  accountAge: number;
  /** Number of followers */
  followers: number;
  /** Number of accounts this author follows */
  following: number;
  /** Whether the author has any verified badge */
  verified: boolean;
  /** Number of tips the author has sent to others */
  tipsSent: number;
  /** Community reputation tier */
  reputationLevel: 'elder' | 'builder' | 'contributor' | 'newcomer';
}

export interface QualityContext {
  /** Author profile for quality assessment */
  author: AuthorProfile;
  /** Recent posts for uniqueness comparison (optional) */
  recentPosts?: UnifiedPost[];
  /** Pre-computed uniqueness score (0-10), overrides recentPosts comparison */
  uniqueness?: number;
}

// ─── Engagement density (0-10) ────────────────────────────────────────

/**
 * Estimate the number of views / impressions a post received.
 * Uses explicit view counts when available, otherwise estimates
 * based on the author's follower count and protocol reach factor.
 */
export function estimateViews(post: UnifiedPost): number {
  if (post.metrics.views && post.metrics.views > 0) {
    return post.metrics.views;
  }

  // Protocol-specific reach multipliers
  // (how many non-followers typically see content on each network)
  const reachFactors: Record<string, number> = {
    nostr: 1.5,
    farcaster: 2.0,
    lens: 1.2,
    bluesky: 3.0,
    mastodon: 2.0,
    threads: 4.0,
    reddit: 5.0,
    lemmy: 1.0,
    rss: 0.5,
    peertube: 1.5,
    youtube: 3.0,
    ethereum: 0.3,
    solana: 0.3,
    ponder: 0.5,
  };

  const factor = reachFactors[post.protocol] ?? 1.0;
  return Math.max(1, Math.round(post.author.followerCount * factor));
}

/**
 * Compute engagement density: engagements per 1000 impressions.
 * Higher density means the content resonates strongly with its audience.
 * Returns a score from 0 (low density) to 10 (viral).
 */
export function computeEngagementDensity(post: UnifiedPost): number {
  const engagement =
    (post.metrics?.likes ?? 0) + (post.metrics?.reposts ?? 0) + (post.metrics?.replies ?? 0);

  const estimatedViews = estimateViews(post);
  if (estimatedViews === 0) return 0;

  const density = (engagement / estimatedViews) * 1000;

  // Score: 0-10 based on engagement per 1000 views
  if (density > 50) return 10; // Viral
  if (density > 20) return 8; // Highly resonant
  if (density > 10) return 6; // Strong engagement
  if (density > 5) return 4; // Above average
  if (density > 1) return 2; // Moderate
  return 1; // Low density
}

// ─── Author quality (0-12) ─────────────────────────────────────────────

/**
 * Compute an author quality score based on account age, follower ratio,
 * verification status, tipping history, and community reputation level.
 *
 * Returns a score from 0 (new/low-quality author) to ~12 (established, trusted).
 */
export function computeAuthorQuality(author: AuthorProfile): number {
  let score = 0;

  // Account age (older = more established, less likely to be a disposable account)
  if (author.accountAge > 365)
    score += 3; // >1 year
  else if (author.accountAge > 90)
    score += 2; // >3 months
  else if (author.accountAge > 30) score += 1; // >1 month

  // Follower ratio (followers / following)
  // High ratio suggests the author produces content others value
  // Low ratio suggests the author follows many but isn't widely followed
  const ratio = author.followers / Math.max(author.following, 1);
  if (ratio > 10)
    score += 3; // Influencer tier
  else if (ratio > 3)
    score += 2; // Growing authority
  else if (ratio > 1) score += 1; // Balanced

  // Verified status (platform verification reduces impersonation risk)
  if (author.verified) score += 2;

  // Tip history (tipped others = good community contributor)
  // Shows the author isn't just consuming, but supporting the ecosystem
  if (author.tipsSent > 10) score += 1;

  // Reputation level (community-granted status)
  if (author.reputationLevel === 'elder') score += 3;
  else if (author.reputationLevel === 'builder') score += 2;
  else if (author.reputationLevel === 'contributor') score += 1;

  return score; // Max: ~12
}

// ─── Content uniqueness (0-10) ─────────────────────────────────────────

/**
 * Compute content uniqueness by comparing word-level Jaccard similarity
 * against a window of recent posts.
 *
 * Returns 0 (near-duplicate) to 10 (completely unique).
 */
export function computeUniqueness(post: UnifiedPost, recentPosts: UnifiedPost[]): number {
  const content = (post.text ?? '').toLowerCase();
  if (!content || content.length < 20) return 5; // Too short to judge, give benefit of doubt

  let uniqueness = 10;

  for (const recent of recentPosts.slice(0, 20)) {
    const otherContent = (recent.text ?? '').toLowerCase();
    if (!otherContent) continue;
    if (recent.id === post.id) continue;

    // Jaccard similarity on word level
    const words1 = new Set(content.split(/\s+/));
    const words2 = new Set(otherContent.split(/\s+/));

    if (words1.size === 0 || words2.size === 0) continue;

    // Compute intersection count
    let intersection = 0;
    const smaller = words1.size < words2.size ? words1 : words2;
    const larger = words1.size < words2.size ? words2 : words1;
    for (const w of smaller) {
      if (larger.has(w)) intersection++;
    }

    const union = words1.size + words2.size - intersection;
    const similarity = union > 0 ? intersection / union : 0;

    if (similarity > 0.7)
      uniqueness -= 3; // Near duplicate
    else if (similarity > 0.5) uniqueness -= 1; // Similar
  }

  return Math.max(0, uniqueness);
}

// ─── Content length scoring (0-10) ─────────────────────────────────────

/**
 * Score content based on length/depth.
 * Longer, more substantial content tends to be higher quality.
 */
function computeContentLengthScore(post: UnifiedPost): number {
  const length = (post.text ?? '').length;

  if (length > 1000) return 10; // Deep analysis / long-form
  if (length > 500) return 8; // Substantial post
  if (length > 200) return 6; // Good length
  if (length > 100) return 4; // Average
  if (length > 50) return 3; // Short
  if (length > 20) return 2; // Very short
  return 1; // One-liner
}

// ─── Media detection ──────────────────────────────────────────────────

/**
 * Check if a post contains rich media (images or video).
 */
export function hasMedia(post: UnifiedPost): boolean {
  return post.embeds.some((e) => e.kind === 'image' || e.kind === 'video');
}

// ─── Composite quality score (0-100) ──────────────────────────────────

/**
 * Compute the composite quality score for a post.
 *
 * Weighted breakdown:
 *   - Spam penalty (30%) — inverse of spamScore
 *   - Engagement density (20%) — how much the content resonates
 *   - Author quality (20%) — how established / trustworthy the author is
 *   - Content uniqueness (15%) — originality vs recent posts
 *   - Content depth (10%) — length / substance of the post
 *   - Media bonus (5%) — images / video enrich the post
 *
 * Returns 0-100 where 100 = highest quality.
 */
export function computeQualityScore(post: UnifiedPost, context: QualityContext): number {
  const spam = ((post as unknown as Record<string, unknown>).spamScore as number) ?? 0;
  const density = computeEngagementDensity(post);
  const author = computeAuthorQuality(context.author);
  const uniqueness =
    context.uniqueness ?? (context.recentPosts ? computeUniqueness(post, context.recentPosts) : 10);
  const length = computeContentLengthScore(post);
  const media = hasMedia(post) ? 2 : 0;

  // Additional quality signals (added v4.0)
  const text = (post.text ?? '').trim();

  // Penalty for all-caps titles (clickbait indicator)
  const firstWords = text.slice(0, 80);
  const capsRatio = (firstWords.match(/[A-Z]/g) ?? []).length / Math.max(firstWords.length, 1);
  const clickbaitPenalty = capsRatio > 0.6 && text.length > 30 ? 0.15 : 0;

  // Penalty for excessive punctuation (!!!, ???, etc.)
  const excessivePunct = (text.match(/[!?]{3,}/g) ?? []).length;
  const punctPenalty = Math.min(excessivePunct * 0.05, 0.15);

  // Bonus for substantive text with diverse vocabulary
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const uniqueWords = new Set(words.map((w) => w.toLowerCase())).size;
  const vocabDiversity = words.length > 10 ? uniqueWords / words.length : 0.5;
  const vocabBonus = vocabDiversity > 0.7 ? 0.1 : 0;

  // Penalty for posts that are just links with no commentary
  const urlFree = text.replace(/https?:\/\/\S+/g, '').trim();
  const linkOnly = urlFree.length < 20 && (text.match(/https?:\/\//g) ?? []).length > 0;
  const linkOnlyPenalty = linkOnly ? 0.1 : 0;

  // Bonus for original content (cross-post detection)
  const crossPostPattern = /^\s*(cross.?post|also (on|via|from)|re.?posted|syndicated)/i;
  const originalContent = !crossPostPattern.test(text) ? 0.05 : 0;

  // Spam penalty with enhanced sensitivity
  const spamComponent = (1 - spam) * 30;

  // Engagement quality with cross-protocol consideration
  const engagementComponent = (density / 10) * 20;

  // Author quality
  const authorComponent = (author / 12) * 20;

  // Uniqueness
  const uniquenessComponent = (uniqueness / 10) * 15;

  // Content depth with penalty
  const depthComponent = (length / 10) * 10;

  // Media bonus
  const mediaComponent = (media / 2) * 5;

  // New quality components
  const bonusComponent =
    (vocabBonus + originalContent - clickbaitPenalty - punctPenalty - linkOnlyPenalty) * 100;

  const score =
    spamComponent +
    engagementComponent +
    authorComponent +
    uniquenessComponent +
    depthComponent +
    mediaComponent +
    bonusComponent;

  return Math.round(Math.max(0, Math.min(100, score)));
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Build an AuthorProfile from a UnifiedIdentity with best-effort defaults.
 *
 * Some fields (accountAge, tipsSent, reputationLevel) may not be available
 * from the identity alone and will default to neutral values. Callers with
 * richer data should construct AuthorProfile directly.
 */
export function buildQualityAuthorProfile(author: UnifiedIdentity): AuthorProfile {
  return {
    accountAge: 0, // Not available from identity — set externally if known
    followers: author.followerCount,
    following: author.followingCount,
    verified: author.verified.length > 0,
    tipsSent: 0, // Not available from identity — set externally if known
    reputationLevel: 'newcomer', // Default — set externally if known
  };
}
