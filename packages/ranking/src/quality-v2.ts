/**
 * @degenfeed/ranking — Content Quality Scoring V2
 *
 * Enhanced quality signals beyond the V1 scorer:
 * 1. Engagement rate (normalized to followers)
 * 2. Text quality (grammar, readability, originality)
 * 3. Media quality (image resolution, video production value)
 * 4. Source freshness (posting cadence)
 * 5. Reply quality (meaningful vs spam replies)
 * 6. Share velocity (engagement growth rate)
 * 7. Creator reputation (historical quality score)
 */

import type { UnifiedPost } from '@degenfeed/types';

// ─── Types ──────────────────────────────────────────────────────────────

export interface QualitySignalsV2 {
  /** Engagement rate: (likes+reposts) / max(1, followers), normalized 0-1 */
  engagementRate: number;
  /** Text quality: grammar+readability+originality composite 0-1 */
  textQuality: number;
  /** Media quality: resolution, production value 0-1 */
  mediaQuality: number;
  /** Source freshness: how frequently this source posts 0-1 */
  sourceFreshness: number;
  /** Reply quality: are replies substantial or spam? 0-1 */
  replyQuality: number;
  /** Share velocity: how fast is engagement growing? 0-1 */
  shareVelocity: number;
  /** Creator reputation: historical quality score 0-1 */
  creatorReputation: number;
  /** Composite quality score 0-100 */
  compositeScore: number;
}

export interface QualityScorerContext {
  /** Current timestamp for time-based computations */
  now: number;
  /** Per-author posting frequency (posts/hour) */
  authorCadence?: Map<string, number>;
  /** Per-author historical quality scores 0-1 */
  authorHistoricalQuality?: Map<string, number>;
}

// ─── Readability helpers ────────────────────────────────────────────────

/**
 * Compute Flesch reading-ease-like score from text.
 * Returns 0-1 where 1 is very readable.
 */
function readabilityScore(text: string): number {
  const cleaned = text.trim();
  if (cleaned.length < 10) return 0.3;

  const words = cleaned.split(/\s+/).filter(Boolean);
  const sentences = cleaned.split(/[.!?]+/).filter(Boolean).length || 1;
  const syllables = words.reduce((sum, w) => {
    const s = w.toLowerCase().replace(/[^a-z]/g, '');
    if (s.length <= 3) return sum + 1;
    // Count vowel groups as syllable proxy
    const vowelGroups = (s.match(/[aeiouy]+/g) || []).length;
    return sum + Math.max(1, vowelGroups);
  }, 0);

  const avgSyllables = syllables / Math.max(1, words.length);
  const avgWordsPerSentence = words.length / sentences;

  // Lower avgSyllables and moderate sentence length = more readable
  const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllables;
  return Math.max(0, Math.min(1, (score + 10) / 120)); // Normalize to 0-1
}

/**
 * Detect text originality: bonus for original content vs. quoted/reposted.
 * Returns 0-1 where 1 = highly original.
 */
function originalityScore(text: string): number {
  const cleaned = text.trim();
  if (cleaned.length < 20) return 0.3;

  // Penalize RT / quote patterns
  const isRepost = /^RT\b/i.test(cleaned) || cleaned.startsWith('@') || cleaned.startsWith('＠');
  const hasLargeQuote = cleaned.includes('"') && cleaned.length > 200;

  if (isRepost) return 0.2;
  if (hasLargeQuote) {
    // Estimate quote ratio
    const quoteMatches = cleaned.match(/"([^"]+)"/g);
    if (quoteMatches) {
      const quotedText = quoteMatches.join('');
      const quoteRatio = quotedText.length / cleaned.length;
      if (quoteRatio > 0.5) return 0.3;
    }
  }

  // Check for original formatting (lists, code, markdown headers)
  const hasMarkdown = /^#{1,6}\s/m.test(cleaned);
  const hasList = /^\s*[-*+]\s/m.test(cleaned);
  const hasCodeBlock = cleaned.includes('```');
  const hasTable = /\|.+\|/.test(cleaned);

  let score = 0.7; // baseline
  if (hasMarkdown) score += 0.15;
  if (hasList) score += 0.1;
  if (hasCodeBlock) score += 0.1;
  if (hasTable) score += 0.1;

  return Math.min(1, score);
}

/**
 * Detect grammar quality via patterns.
 * Returns 0-1 where 1 = good grammar.
 */
function grammarQuality(text: string): number {
  const cleaned = text.trim();
  if (cleaned.length < 5) return 0.5;

  let issues = 0;
  let signals = 0;

  // Check for excessive caps (SHOUTING) — strong penalty for >40% caps
  const upperChars = (cleaned.match(/[A-Z]/g) || []).length;
  const lowerChars = (cleaned.match(/[a-z]/g) || []).length;
  const totalAlpha = upperChars + lowerChars;
  const capsRatio = totalAlpha > 0 ? upperChars / totalAlpha : 0;
  if (capsRatio > 0.5) issues += 3;
  else if (capsRatio > 0.3) issues += 1;

  // Check for excessive punctuation (!!!, ???)
  const excessivePunct = cleaned.match(/([!?]){3,}/g);
  if (excessivePunct) issues += excessivePunct.length * 1.5;

  // Check for repeated characters (noooo, stonnnks)
  const repeatedChar = cleaned.match(/([a-zA-Z])\1{3,}/g);
  if (repeatedChar) issues += repeatedChar.length;

  // Check for emoji density
  const emojiCount = (cleaned.match(/[\p{Emoji}]/gu) || []).length;
  if (emojiCount > 5) issues += Math.min(4, emojiCount * 0.3);

  // Check for excessive links (link spam)
  const linkCount = (cleaned.match(/https?:\/\/[^\s]+/g) || []).length;
  if (linkCount > 2) issues += 2;
  else if (linkCount > 0 && cleaned.replace(/https?:\/\/[^\s]+/g, '').trim().length < 50) issues += 3;

  // Positive signals: proper capitalization, sentence structure
  const sentences = cleaned.split(/[.!?]+/).filter(Boolean);
  const properlyCapped = sentences.filter((s) => /^[A-Z]/.test(s.trim())).length;
  if (properlyCapped > 0) signals += properlyCapped;

  // Variety of punctuation
  const hasComma = cleaned.includes(',');
  const hasPeriod = cleaned.includes('.');
  const hasColon = cleaned.includes(':');
  if (hasComma) signals++;
  if (hasPeriod) signals++;
  if (hasColon) signals++;

  // Normal sentence length (not too short, not too long)
  const words = cleaned.split(/\s+/).filter(Boolean).length;
  const avgSentenceLength = Math.max(1, words / Math.max(1, sentences.length));
  if (avgSentenceLength >= 5 && avgSentenceLength <= 30) signals += 1;

  // Presence of common words (natural language signal)
  const commonWords = ['the', 'and', 'is', 'are', 'was', 'were', 'for', 'that', 'this', 'with'];
  const hasCommonWords = commonWords.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(cleaned));
  if (hasCommonWords) signals += 1;

  const base = Math.min(1, 0.5 + signals * 0.1 - issues * 0.15);
  return Math.max(0, base);
}

// ─── Media quality ──────────────────────────────────────────────────────

/**
 * Compute media quality score.
 * Uses embed metadata to determine resolution and production value.
 */
function computeMediaQuality(post: UnifiedPost): number {
  const embeds = post.embeds ?? [];

  if (embeds.length === 0) {
    // No media — neutral baseline for text posts
    return 0.5;
  }

  let totalScore = 0;
  let mediaCount = 0;

  for (const embed of embeds) {
    if (embed.kind === 'image') {
      const meta = embed.meta ?? {};
      const width = (meta.width as number) ?? 0;
      const height = (meta.height as number) ?? 0;

      if (width >= 1920 && height >= 1080) totalScore += 0.9; // HD
      else if (width >= 1280 && height >= 720) totalScore += 0.75;
      else if (width >= 640) totalScore += 0.5;
      else if (width > 0) totalScore += 0.3;
      else totalScore += 0.4; // Unknown resolution — modest score

      mediaCount++;
    } else if (embed.kind === 'video') {
      const meta = embed.meta ?? {};
      const resolution = (meta.resolution as number) ?? 0;
      const duration = (meta.duration as number) ?? 0;
      const hasCaptions = (meta.hasCaptions as boolean) ?? false;

      if (resolution >= 2160) totalScore += 0.95; // 4K
      else if (resolution >= 1440) totalScore += 0.85;
      else if (resolution >= 1080) totalScore += 0.75;
      else if (resolution >= 720) totalScore += 0.6;
      else if (resolution >= 480) totalScore += 0.4;
      else totalScore += 0.3;

      // Duration sweet spot: 3-20 min for produced content
      if (duration > 0) {
        if (duration >= 180 && duration <= 1200) totalScore += 0.15;
        else if (duration < 30) totalScore -= 0.1; // Very short clip
      }

      if (hasCaptions) totalScore += 0.1;
      mediaCount++;
    } else if (embed.kind === 'link') {
      // Link preview card
      const meta = embed.meta ?? {};
      const hasImage = (meta.image as string) !== undefined;
      const hasDescription = (meta.description as string) !== undefined;
      if (hasImage) totalScore += 0.3;
      if (hasDescription) totalScore += 0.1;
      mediaCount++;
    }
  }

  if (mediaCount === 0) return 0.5;
  return Math.min(1, totalScore / mediaCount);
}

// ─── Source freshness ──────────────────────────────────────────────────

/**
 * Compute how frequently an author posts.
 * Higher cadence = higher score (fresh source), but excessive = spam signal.
 */
function computeSourceFreshness(
  post: UnifiedPost,
  authorCadence?: Map<string, number>,
): number {
  if (!authorCadence?.size) return 0.5; // Neutral baseline

  const cadence = authorCadence.get(post.author.id);
  if (cadence === undefined) return 0.5;

  // cadence = posts per hour
  // Sweet spot: 0.01-0.5 posts/hour (1 post/day to 1 post/2 hours)
  if (cadence > 0 && cadence <= 0.01) return 0.3; // Very infrequent
  if (cadence <= 0.05) return 0.6; // 1-5 posts/day
  if (cadence <= 0.2) return 0.8; // 5-20 posts/day ideal
  if (cadence <= 0.5) return 0.9; // Active
  if (cadence <= 1.0) return 0.7; // Frequent
  if (cadence <= 3.0) return 0.4; // Very frequent (approaching spam)
  return 0.15; // Excessive posting — spam risk
}

// ─── Reply quality ─────────────────────────────────────────────────────

interface ReplyQualityMetrics {
  /** Average reply length in characters */
  avgReplyLength: number;
  /** Ratio of replies that contain meaningful content */
  meaningfulReplyRatio: number;
  /** Whether the post has more than 3 replies (base for measurement) */
  hasEnoughReplies: boolean;
}

/**
 * Analyze reply quality given reply data.
 * In production, this would be fed from a reply analysis pipeline.
 */
function computeReplyQuality(
  post: UnifiedPost,
  replyMetrics?: ReplyQualityMetrics,
): number {
  if (!replyMetrics || !replyMetrics.hasEnoughReplies) {
    // Without reply data, use text engagement ratio as proxy
    const replies = post.metrics.replies;
    if (replies === 0) return 0.4; // Neutral — no replies yet
    if (replies > 0 && replies < 3) return 0.45; // Too few to judge

    // Estimate from reply-to-engagement ratio
    const totalEng = post.metrics.likes + post.metrics.reposts + post.metrics.replies;
    if (totalEng === 0) return 0.4;

    // High reply ratio can indicate controversy or meaningful discussion
    const replyRatio = replies / totalEng;
    if (replyRatio > 0.5) return 0.6; // Lots of replies — active discussion
    if (replyRatio > 0.2) return 0.5;
    return 0.45;
  }

  // When reply quality metrics are available
  let score = 0.5;

  // Average reply length
  if (replyMetrics.avgReplyLength > 100) score += 0.2; // Substantial replies
  else if (replyMetrics.avgReplyLength > 30) score += 0.1;
  else if (replyMetrics.avgReplyLength < 10) score -= 0.1; // Short/spammy

  // Meaningful content ratio
  if (replyMetrics.meaningfulReplyRatio > 0.7) score += 0.2;
  else if (replyMetrics.meaningfulReplyRatio > 0.4) score += 0.05;
  else if (replyMetrics.meaningfulReplyRatio < 0.2) score -= 0.15;

  return Math.max(0, Math.min(1, score));
}

// ─── Share velocity ────────────────────────────────────────────────────

/**
 * Compute share velocity — how fast engagement is growing.
 * Uses the same delta-tracking pattern as the unified scorer but adds
 * a normalized growth rate scaled to 0-1.
 */
function computeShareVelocity(
  post: UnifiedPost,
  previousSnapshot?: { likes: number; reposts: number; replies: number; at: number },
  now?: number,
): number {
  const currentTime = now ?? Date.now();

  if (!previousSnapshot) {
    // No history — estimate from post age and total engagement
    const ageHours = Math.max(0.1, (currentTime - post.createdAt) / 3600000);
    const totalEng = post.metrics.likes + post.metrics.reposts * 2 + post.metrics.replies * 3;
    const rate = totalEng / ageHours;

    // Scale: 0-5 engagements/hour = low, 5-50 = medium, 50+ = high
    if (rate > 100) return 0.95;
    if (rate > 50) return 0.85;
    if (rate > 20) return 0.7;
    if (rate > 10) return 0.55;
    if (rate > 5) return 0.45;
    if (rate > 1) return 0.35;
    return 0.2;
  }

  // Delta-based velocity from snapshot
  const ageHrs = Math.max(0.1, (currentTime - previousSnapshot.at) / 3600000);
  const dLikes = Math.max(0, post.metrics.likes - previousSnapshot.likes);
  const dReposts = Math.max(0, post.metrics.reposts - previousSnapshot.reposts);
  const dReplies = Math.max(0, post.metrics.replies - previousSnapshot.replies);

  const newEngagements = dLikes + dReposts * 2 + dReplies * 3;
  const velocityPerHour = newEngagements / ageHrs;

  // Normalize: 0-100 engagements/hour scale
  if (velocityPerHour > 200) return 0.95;
  if (velocityPerHour > 100) return 0.85;
  if (velocityPerHour > 50) return 0.7;
  if (velocityPerHour > 20) return 0.55;
  if (velocityPerHour > 10) return 0.45;
  if (velocityPerHour > 5) return 0.35;
  if (velocityPerHour > 1) return 0.25;
  return 0.15;
}

// ─── Creator reputation ────────────────────────────────────────────────

/**
 * Compute creator reputation from historical quality and current signals.
 */
function computeCreatorReputation(
  post: UnifiedPost,
  historicalQuality?: number,
): number {
  // Current post signals as a baseline
  const followerCount = post.author.followerCount ?? 0;
  const isVerified = post.author.verified.length > 0;

  let score = 0.3; // Baseline

  // Follower-based reputation (log scale)
  if (followerCount >= 1_000_000) score += 0.4;
  else if (followerCount >= 100_000) score += 0.3;
  else if (followerCount >= 10_000) score += 0.2;
  else if (followerCount >= 1_000) score += 0.15;
  else if (followerCount >= 100) score += 0.05;

  // Verification badge
  if (isVerified) score += 0.2;

  // Historical quality (if available)
  if (historicalQuality !== undefined) {
    score = score * 0.4 + historicalQuality * 0.6; // Blend
  }

  return Math.max(0, Math.min(1, score));
}

// ─── Main scorer ────────────────────────────────────────────────────────

/**
 * Score a post using V2 quality signals.
 * Every signal is normalized 0-1 for consistent weighting.
 */
export function scoreQualityV2(
  post: UnifiedPost,
  options?: {
    context?: QualityScorerContext;
    previousSnapshot?: { likes: number; reposts: number; replies: number; at: number };
    replyMetrics?: ReplyQualityMetrics;
  },
): QualitySignalsV2 {
  const ctx = options?.context ?? { now: Date.now() };

  // 1. Engagement rate (normalized to followers)
  const followers = Math.max(1, post.author.followerCount ?? 1);
  const totalSignal = post.metrics.likes + post.metrics.reposts;
  const rawEngagementRate = totalSignal / followers;
  const engagementRate = Math.min(1, Math.log(1 + rawEngagementRate * 100) / 5);

  // 2. Text quality (grammar + readability + originality composite)
  const text = post.text ?? '';
  const grammar = grammarQuality(text);
  const readability = readabilityScore(text);
  const originality = originalityScore(text);
  const textQuality = grammar * 0.25 + readability * 0.25 + originality * 0.5;

  // 3. Media quality
  const mediaQuality = computeMediaQuality(post);

  // 4. Source freshness (posting cadence)
  const sourceFreshness = computeSourceFreshness(post, ctx.authorCadence);

  // 5. Reply quality
  const replyQuality = computeReplyQuality(post, options?.replyMetrics);

  // 6. Share velocity
  const shareVelocity = computeShareVelocity(post, options?.previousSnapshot, ctx.now);

  // 7. Creator reputation
  const historicalQuality = ctx.authorHistoricalQuality?.get(post.author.id);
  const creatorReputation = computeCreatorReputation(post, historicalQuality);

  // Composite score (weighted average)
  const compositeScore =
    engagementRate * 0.15 +
    textQuality * 0.20 +
    mediaQuality * 0.10 +
    sourceFreshness * 0.10 +
    replyQuality * 0.10 +
    shareVelocity * 0.15 +
    creatorReputation * 0.20;

  return {
    engagementRate,
    textQuality,
    mediaQuality,
    sourceFreshness,
    replyQuality,
    shareVelocity,
    creatorReputation,
    compositeScore: Math.round(compositeScore * 100),
  };
}

// ─── V2 enrich post with quality debug data ─────────────────────────────

/**
 * Attach V2 quality signals to a post's feedDebug for transparency.
 */
export function enrichWithQualityV2(
  post: UnifiedPost,
  signals: QualitySignalsV2,
): UnifiedPost {
  return {
    ...post,
    feedDebug: {
      ...post.feedDebug,
      qualityScore: signals.compositeScore / 100,
    },
    qualityScore: {
      score: signals.compositeScore,
      max: 100,
      ratio: signals.compositeScore / 100,
      reasons: [
        ...(signals.engagementRate > 0.6 ? ['high-engagement-rate'] : []),
        ...(signals.textQuality > 0.6 ? ['good-text-quality'] : []),
        ...(signals.textQuality < 0.3 ? ['poor-text-quality'] : []),
        ...(signals.mediaQuality > 0.7 ? ['high-media-quality'] : []),
        ...(signals.shareVelocity > 0.6 ? ['trending-fast'] : []),
        ...(signals.creatorReputation > 0.6 ? ['trusted-creator'] : []),
        ...(signals.sourceFreshness > 0.7 ? ['active-source'] : []),
        ...(signals.replyQuality > 0.6 ? ['quality-discussion'] : []),
        ...(signals.replyQuality < 0.3 ? ['low-quality-replies'] : []),
      ],
    },
  };
}
