/**
 * @degenfeed/ranking — Anti-Gaming Protection
 *
 * Prevents manipulation of the algorithm:
 * 1. Engagement farms: Detect coordinated liking patterns
 * 2. Bot detection: Identify bot accounts by behavior
 * 3. Spam detection: Repetitive content, excessive posting
 * 4. Sybil resistance: Multiple accounts from same source
 *
 * Each check returns a penalty multiplier (0 = drop, 1 = no penalty).
 */

import type { UnifiedPost } from '@degenfeed/types';

// ─── Types ──────────────────────────────────────────────────────────────

export interface AntiGamingResult {
  /** Overall trust multiplier: 0-1 (0 = drop, 1 = trusted) */
  trustMultiplier: number;
  /** Individual penalty scores for transparency */
  penalties: Record<string, number>;
  /** Human-readable reasons for penalties */
  reasons: string[];
}

export interface EngagementFarmSignals {
  /** Ratio of accounts that liked together on same posts (0-1) */
  coEngagementRatio: number;
  /** Number of accounts exhibiting coordinated behavior */
  coordinatedAccounts: number;
  /** Standard deviation of time between likes (low = bot-like) */
  likeTimingStdDevMs: number;
  /** Whether IP addresses cluster */
  ipClusterDetected: boolean;
}

export interface BotDetectionSignals {
  /** Account age in days */
  accountAgeDays: number;
  /** Posts per day average */
  postsPerDay: number;
  /** Ratio of posts that are reposts vs original */
  repostRatio: number;
  /** Whether bio is empty or AI-generated */
  bioQuality: 'normal' | 'empty' | 'suspicious';
  /** Whether avatar is default/missing */
  hasAvatar: boolean;
  /** Follower-to-following ratio */
  followerFollowingRatio: number;
  /** Engagement rate consistency (low variance = bot) */
  engagementConsistency: number;
}

export interface SpamDetectionSignals {
  /** Text repetition score (1 = unique, 0 = duplicate) */
  textUniqueness: number;
  /** Link ratio in posts */
  linkDensity: number;
  /** Hashtag count */
  hashtagCount: number;
  /** Whether post text has been seen before (near-duplicate) */
  isNearDuplicate: boolean;
  /** Whether post contains only a link + no commentary */
  isLinkDump: boolean;
  /** Excessive emoji or special characters */
  excessiveFormatting: boolean;
}

export interface SybilDetectionSignals {
  /** Number of other accounts from same IP / device */
  siblingAccounts: number;
  /** Whether the account was created in a batch */
  batchCreated: boolean;
  /** Similarity to known sybil patterns (0-1) */
  sybilPatternScore: number;
  /** Wallet/onchain identity linked */
  hasUniqueIdentity: boolean;
}

export interface AntiGamingContext {
  engagementFarm?: Partial<EngagementFarmSignals>;
  botDetection?: Partial<BotDetectionSignals>;
  spamDetection?: Partial<SpamDetectionSignals>;
  sybilDetection?: Partial<SybilDetectionSignals>;
}

// ─── Engagement Farm Detection ─────────────────────────────────────────

/**
 * Detect coordinated engagement farming patterns.
 * High co-engagement ratio + low timing std dev = likely farm.
 */
function detectEngagementFarm(signals: Partial<EngagementFarmSignals>): {
  penalty: number;
  reason: string;
} {
  const coEngRatio = signals.coEngagementRatio ?? 0;
  const coordAccounts = signals.coordinatedAccounts ?? 0;
  const timingStdDev = signals.likeTimingStdDevMs ?? 10000;
  const ipCluster = signals.ipClusterDetected ?? false;

  let penalty = 0;
  const flags: string[] = [];

  // High co-engagement ratio indicates coordinated groups
  if (coEngRatio > 0.6) {
    penalty += 0.4;
    flags.push('coordinated engagement');
  } else if (coEngRatio > 0.3) {
    penalty += 0.15;
  }

  // Bot-like timing (very consistent intervals between engagements)
  if (timingStdDev < 500) {
    penalty += 0.3;
    flags.push('automated engagement timing');
  } else if (timingStdDev < 2000) {
    penalty += 0.1;
  }

  // IP clustering
  if (ipCluster) {
    penalty += 0.35;
    flags.push('IP cluster detected');
  }

  // Many coordinated accounts
  if (coordAccounts > 20) {
    penalty += 0.2;
    flags.push(`${coordAccounts}+ coordinated accounts`);
  } else if (coordAccounts > 5) {
    penalty += 0.1;
  }

  const reason = flags.length > 0 ? `engagement-farm:${flags.join(',')}` : '';
  return { penalty: Math.min(1, penalty), reason };
}

// ─── Bot Detection ─────────────────────────────────────────────────────

/**
 * Detect bot accounts by their behavioral patterns.
 */
function detectBot(signals: Partial<BotDetectionSignals>): {
  penalty: number;
  reason: string;
} {
  const age = signals.accountAgeDays ?? 0;
  const postsPerDay = signals.postsPerDay ?? 0;
  const repostRatio = signals.repostRatio ?? 0;
  const bioQuality = signals.bioQuality ?? 'normal';
  const hasAvatar = signals.hasAvatar ?? true;
  const ffRatio = signals.followerFollowingRatio ?? 1;
  const engConsistency = signals.engagementConsistency ?? 0.5;

  let penalty = 0;
  const flags: string[] = [];

  // New accounts with high posting volume
  if (age < 7 && postsPerDay > 20) {
    penalty += 0.3;
    flags.push('new account high volume');
  }

  if (age < 30 && postsPerDay > 50) {
    penalty += 0.25;
    flags.push('very high volume new account');
  }

  // Age check regardless of volume
  if (age < 1) penalty += 0.15;
  else if (age < 7) penalty += 0.05;

  // Repost ratio (bots rarely create original content)
  if (repostRatio > 0.9) {
    penalty += 0.25;
    flags.push('high repost ratio');
  } else if (repostRatio > 0.7) {
    penalty += 0.1;
  }

  // Bio and avatar
  if (bioQuality === 'empty') {
    penalty += 0.1;
    flags.push('empty bio');
  } else if (bioQuality === 'suspicious') {
    penalty += 0.2;
    flags.push('suspicious bio');
  }

  if (!hasAvatar) {
    penalty += 0.05;
  }

  // Abnormal follower/following ratio
  if (ffRatio > 100) {
    penalty += 0.15;
    flags.push('abnormal follower ratio');
  } else if (ffRatio < 0.01) {
    penalty += 0.1;
  }

  // Too-consistent engagement (no variance = scripted)
  if (engConsistency > 0.9) {
    penalty += 0.2;
    flags.push('unnaturally consistent engagement');
  }

  const reason = flags.length > 0 ? `bot-detection:${flags.join(',')}` : '';
  return { penalty: Math.min(1, penalty), reason };
}

// ─── Spam Detection ───────────────────────────────────────────────────

/**
 * Detect spam content: repetitive, low-effort, link-dump posts.
 */
function detectSpam(signals: Partial<SpamDetectionSignals>): {
  penalty: number;
  reason: string;
} {
  const textUniqueness = signals.textUniqueness ?? 1;
  const linkDensity = signals.linkDensity ?? 0;
  const hashtagCount = signals.hashtagCount ?? 0;
  const isNearDuplicate = signals.isNearDuplicate ?? false;
  const isLinkDump = signals.isLinkDump ?? false;
  const excessiveFormatting = signals.excessiveFormatting ?? false;

  let penalty = 0;
  const flags: string[] = [];

  // Text uniqueness
  if (isNearDuplicate) {
    penalty += 0.5;
    flags.push('duplicate content');
  } else if (textUniqueness < 0.3) {
    penalty += 0.3;
    flags.push('very repetitive content');
  } else if (textUniqueness < 0.6) {
    penalty += 0.1;
  }

  // Link dump (just a link with no commentary)
  if (isLinkDump) {
    penalty += 0.35;
    flags.push('link dump');
  }

  // High link density
  if (linkDensity > 0.5) {
    penalty += 0.2;
    flags.push('high link density');
  } else if (linkDensity > 0.3) {
    penalty += 0.05;
  }

  // Excessive hashtags
  if (hashtagCount > 10) {
    penalty += 0.2;
    flags.push('hashtag spam');
  } else if (hashtagCount > 5) {
    penalty += 0.05;
  }

  // Excessive formatting (all caps, emoji spam)
  if (excessiveFormatting) {
    penalty += 0.15;
    flags.push('excessive formatting');
  }

  const reason = flags.length > 0 ? `spam:${flags.join(',')}` : '';
  return { penalty: Math.min(1, penalty), reason };
}

// ─── Sybil Resistance ─────────────────────────────────────────────────

/**
 * Detect Sybil accounts (multiple accounts from same source/entity).
 */
function detectSybil(signals: Partial<SybilDetectionSignals>): {
  penalty: number;
  reason: string;
} {
  const siblingAccounts = signals.siblingAccounts ?? 0;
  const batchCreated = signals.batchCreated ?? false;
  const sybilPatternScore = signals.sybilPatternScore ?? 0;
  const hasUniqueIdentity = signals.hasUniqueIdentity ?? false;

  let penalty = 0;
  const flags: string[] = [];

  // Many sibling accounts from same source
  if (siblingAccounts > 10) {
    penalty += 0.45;
    flags.push(`part of ${siblingAccounts}+ account cluster`);
  } else if (siblingAccounts > 3) {
    penalty += 0.2;
    flags.push('multiple sibling accounts');
  }

  // Batch creation pattern
  if (batchCreated) {
    penalty += 0.35;
    flags.push('batch-created account');
  }

  // Sybil pattern score
  if (sybilPatternScore > 0.7) {
    penalty += 0.3;
    flags.push('sybil behavior pattern');
  } else if (sybilPatternScore > 0.3) {
    penalty += 0.1;
  }

  // No unique identity (crypto wallet, verified handle, etc.)
  if (!hasUniqueIdentity) {
    penalty += 0.1;
    flags.push('no unique identity proof');
  }

  const reason = flags.length > 0 ? `sybil:${flags.join(',')}` : '';
  return { penalty: Math.min(1, penalty), reason };
}

// ─── Text analysis helpers ─────────────────────────────────────────────

/**
 * Analyze a piece of text for spam signals.
 * Can be used standalone without requiring the full context.
 */
export function analyzeTextSpam(text: string): {
  linkDensity: number;
  hashtagCount: number;
  isLinkDump: boolean;
  excessiveFormatting: boolean;
} {
  const cleaned = text.trim();
  if (!cleaned) {
    return { linkDensity: 0, hashtagCount: 0, isLinkDump: false, excessiveFormatting: false };
  }

  // Link detection
  const links = (cleaned.match(/https?:\/\/[^\s]+/g) || []).length;
  const words = cleaned.split(/\s+/).filter(Boolean).length || 1;
  const linkDensity = links / words;

  // Hashtag count
  const hashtagCount = (cleaned.match(/#[a-zA-Z0-9_]+/g) || []).length;

  // Link dump: post that is just a link with little or no text
  // Strip links, hashtags, emojis, punctuation — measure meaningful text
  // NOTE: Must remove hashtags BEFORE emoji removal since \p{Emoji} matches #
  const stripped = cleaned
    .replace(/https?:\/\/[^\s]+/g, '')      // Remove links
    .replace(/#\w+/g, '')                    // Remove hashtag words entirely (before emoji removal!)
    .replace(/[\p{Emoji}]/gu, '')           // Remove emojis
    .replace(/[^a-zA-Z\s]/g, ' ')            // Strip punctuation
    .replace(/\s+/g, ' ')                    // Collapse whitespace
    .trim();
  const meaningfulWords = stripped.split(/\s+/)
    .filter((w) => w.length > 3 && !/^[A-Z]+$/.test(w));
  const isLinkDump = links > 2 || (links > 0 && meaningfulWords.length < 3);

  // Excessive formatting
  const upperChars = (cleaned.match(/[A-Z]/g) || []).length;
  const lowerChars = (cleaned.match(/[a-z]/g) || []).length;
  const totalAlpha = upperChars + lowerChars;
  const capsRatio = totalAlpha > 0 ? upperChars / totalAlpha : 0;
  const emojiCount = (cleaned.match(/[\p{Emoji}]/gu) || []).length;
  const excessiveFormatting = capsRatio > 0.4 || emojiCount > 5 || cleaned.split(/[!]+/).length > 5;

  return { linkDensity, hashtagCount, isLinkDump, excessiveFormatting };
}

// ─── Main anti-gaming scorer ───────────────────────────────────────────

/**
 * Score a post for gaming/abuse signals.
 * Returns a trust multiplier (0 = drop, 1 = fully trusted) with transparency.
 */
export function scoreAntiGaming(
  post: UnifiedPost,
  context?: AntiGamingContext,
): AntiGamingResult {
  const penalties: Record<string, number> = {};
  const reasons: string[] = [];

  // 1. Engagement farm detection
  if (context?.engagementFarm) {
    const { penalty, reason } = detectEngagementFarm(context.engagementFarm);
    penalties.engagementFarm = penalty;
    if (penalty > 0 && reason) reasons.push(reason);
  }

  // 2. Bot detection
  if (context?.botDetection) {
    const { penalty, reason } = detectBot(context.botDetection);
    penalties.bot = penalty;
    if (penalty > 0 && reason) reasons.push(reason);
  }

  // 3. Spam detection (from post text and context)
  if (context?.spamDetection) {
    const { penalty, reason } = detectSpam(context.spamDetection);
    penalties.spam = penalty;
    if (penalty > 0 && reason) reasons.push(reason);
  }

  // 4. Sybil resistance
  if (context?.sybilDetection) {
    const { penalty, reason } = detectSybil(context.sybilDetection);
    penalties.sybil = penalty;
    if (penalty > 0 && reason) reasons.push(reason);
  }

  // 5. Built-in text spam checks (always run when we have text)
  const text = (post.text ?? '').trim();
  if (text) {
    const textAnalysis = analyzeTextSpam(text);
    if (textAnalysis.isLinkDump) {
      penalties.linkDump = 0.35;
      reasons.push('spam:link-dump');
    }
    if (textAnalysis.hashtagCount > 10) {
      penalties.excessiveHashtags = 0.1;
      reasons.push('spam:excessive-hashtags');
    }
    if (textAnalysis.excessiveFormatting) {
      penalties.excessiveFormatting = 0.1;
      reasons.push('spam:excessive-formatting');
    }
  }

  // Are we a known bot or spammer from protocol signals?
  if (post.author.verified.length === 0 && (post.author.followerCount ?? 0) === 0) {
    // New account with no proof of identity — slight suspicion
    // Only add if no other context was provided
    if (!context?.botDetection && !context?.spamDetection) {
      penalties.unverifiedIdentity = 0.05;
    }
  }

  // Compute total penalty (not simply additive — square root dampening)
  const totalPenalty = Object.values(penalties).reduce((sum, p) => {
    // Use root-sum-square to prevent a single high penalty from overwhelming
    return Math.sqrt(sum * sum + p * p);
  }, 0);

  const trustMultiplier = Math.max(0, Math.min(1, 1 - totalPenalty));

  // Drop if trust is too low
  if (trustMultiplier < 0.1) {
    reasons.push('anti-gaming:dropped');
  }

  return {
    trustMultiplier: Math.round(trustMultiplier * 1000) / 1000,
    penalties,
    reasons: [...new Set(reasons)],
  };
}

// ─── Pre-computed text spam signals from post ──────────────────────────

/**
 * Extract spam-relevant signals from a post for downstream pipeline use.
 */
export function extractSpamSignalsFromPost(
  post: UnifiedPost,
): SpamDetectionSignals {
  const textAnalysis = analyzeTextSpam(post.text ?? '');

  return {
    textUniqueness: 1, // Placeholder — requires cross-post comparison
    linkDensity: textAnalysis.linkDensity,
    hashtagCount: textAnalysis.hashtagCount,
    isNearDuplicate: false, // Placeholder — requires dedup pipeline
    isLinkDump: textAnalysis.isLinkDump,
    excessiveFormatting: textAnalysis.excessiveFormatting,
  };
}
