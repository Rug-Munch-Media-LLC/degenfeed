/**
 * @degenfeed/feed-core — Content Scoring V3
 * @deprecated Use scoreQualityV3 only for dashboard reporting.
 * Do NOT use for ranking — use scorePost() from @degenfeed/ranking instead.
 *
 * Enhanced quality scoring beyond V2 with:
 * 1. Engagement velocity: how fast engagement is growing
 * 2. Creator quality: historical post quality from this creator
 * 3. Source diversity penalty: penalty for too many posts from same source
 * 4. Freshness boost: stronger boost for breaking news
 * 5. Evergreen detection: identify posts that stay relevant
 * 6. Language quality: detect low-quality/spam content
 * 7. Protocol multiplier: each protocol gets a quality weight
 *
 * Output: composite quality score 0-100 + per-signal breakdown.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { CategorySlug } from './categorization-v3';

// ─── Types ──────────────────────────────────────────────────────────────

export interface QualityV3Context {
  /** Current timestamp for age calculations */
  now: number;
  /** Per-creator historical quality (0-100 averages) */
  creatorHistory?: Map<string, number>;
  /** Per-creator post count in current feed window */
  creatorPostCounts?: Map<string, number>;
  /** Per-niche/category post count in current window */
  categoryCounts?: Map<string, number>;
  /** Per-protocol post count in current window */
  protocolCounts?: Map<string, number>;
  /** Previous engagement snapshot for velocity */
  previousEngagement?: Map<string, { likes: number; reposts: number; replies: number; at: number }>;
  /** Engagement velocity per post (pre-computed 1-3) */
  engagementVelocity?: Map<string, number>;
  /** Pre-computed category assignments */
  categories?: Map<string, CategorySlug[]>;
  /** Protocol quality weight overrides */
  protocolWeights?: Partial<Record<Protocol, number>>;
}

export interface QualityV3Signals {
  /** 0-100: Composite quality score */
  composite: number;
  /** 0-100: Engagement velocity sub-score */
  engagementVelocity: number;
  /** 0-100: Creator quality sub-score */
  creatorQuality: number;
  /** 0-100: Source diversity sub-score */
  sourceDiversity: number;
  /** 0-100: Freshness sub-score */
  freshness: number;
  /** 0-1: Is this post evergreen? */
  evergreenScore: number;
  /** 0-100: Language quality sub-score */
  languageQuality: number;
  /** 0-100: Protocol multiplier */
  protocolMultiplier: number;
  /** Human-readable reasons */
  reasons: string[];
}

// ─── Protocol Quality Multipliers ───────────────────────────────────────

/**
 * Quality weight per protocol.
 * Higher weight = protocol known for higher quality content on average.
 * Based on observed content quality, moderation, and community standards.
 */
export const PROTOCOL_QUALITY_WEIGHTS: Record<string, number> = {
  nostr: 1.0,
  farcaster: 1.1,
  lens: 0.9,
  bluesky: 1.0,
  mastodon: 1.0,
  lemmy: 0.95,
  pixelfed: 1.0,
  threads: 0.85,
  reddit: 0.8,
  rss: 0.85,
  mirror: 1.15,
  paragraph: 1.1,
  peertube: 0.9,
  youtube: 0.85,
  zora: 0.8,
  telegram: 0.6,
  discord: 0.6,
  matrix: 0.7,
  github: 0.7,
  hive: 0.75,
  dtube: 0.65,
  lbry: 0.7,
  gab: 0.4,
  minds: 0.6,
  aether: 0.5,
  scuttlebutt: 0.7,
  diaspora: 0.7,
  friendica: 0.7,
  pleroma: 0.8,
  misskey: 0.8,
  writefreely: 0.85,
  funkwhale: 0.8,
  castopod: 0.8,
  bookwyrm: 0.85,
  mobilizon: 0.7,
  bonfire: 0.7,
  mitra: 0.7,
  takahe: 0.7,
  forgejo: 0.6,
  owncast: 0.7,
  faircamp: 0.6,
  orbis: 0.7,
  xmtp: 0.4,
  push: 0.4,
  huddle01: 0.4,
  ceramic: 0.5,
  tableland: 0.4,
  subsocial: 0.7,
  steem: 0.6,
  session: 0.6,
  microblog: 0.7,
  cyberconnect: 0.6,
  arena: 0.7,
  ethereum: 0.5,
  solana: 0.5,
  ponder: 0.6,
};

// ─── Evergreen Detection ───────────────────────────────────────────────

/**
 * Patterns that suggest evergreen content (stays relevant over time).
 */
const EVERGREEN_PATTERNS = [
  // Educational content
  /\b(guide|tutorial|how.to|learn|explain|understand|introduction|beginner|crash course|walkthrough|cheat sheet)\b/i,
  // Reference content
  /\b(reference|documentation|specification|whitepaper|wiki|faq|glossary|handbook|blueprint)\b/i,
  // Analysis/opinion pieces that age well
  /\b(why|should you|is it worth|review|comparison|vs\.|versus|better than|alternatives)\b/i,
  // Timeless topics
  /\b(history|philosophy|architecture|design pattern|best practice|coding standard|principle|fundamental)\b/i,
  // Tool/technology introductions
  /\b(git|docker|linux|api|sdk|framework|library|protocol|standard)\b.*\b(guide|intro|tutorial|how|what|why)\b/i,
];

/**
 * Patterns that suggest NON-evergreen content (time-sensitive).
 */
const TIME_SENSITIVE_PATTERNS = [
  /\b(breaking|just.in|live|today|this week|this morning|hours ago|minutes ago|announced|launches)\b/i,
  /\b(price|pump|dump|moon|chart|ATH|new high|new low|crash|surge|plunge)\b/i,
  /\b(update|release notes|changelog|v\d+\.\d+|version)\b/i,
  /\b(happening now|watch|streaming|live now|current|ongoing)\b/i,
];

/**
 * Detect if a post is evergreen (stays relevant over time).
 * Returns 0-1 where 1 = definitely evergreen.
 */
export function detectEvergreen(post: UnifiedPost): number {
  const text = post.text ?? '';
  const textLen = text.length;

  // Very short posts are rarely evergreen
  if (textLen < 50) return 0.1;

  // Check evergreen patterns
  let evergreenScore = 0.2; // baseline
  for (const pattern of EVERGREEN_PATTERNS) {
    if (pattern.test(text)) {
      evergreenScore += 0.2;
    }
  }

  // Check time-sensitive patterns (penalty)
  for (const pattern of TIME_SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      evergreenScore -= 0.15;
    }
  }

  // Longer content is more likely to be evergreen
  if (textLen > 1000) evergreenScore += 0.15;
  else if (textLen > 500) evergreenScore += 0.1;

  // Content with code blocks is often reference material
  if (text.includes('```') || text.includes('    code') || /`[^`]+`/.test(text)) {
    evergreenScore += 0.15;
  }

  // Posts with images/video can be evergreen if they're educational
  const hasRichMedia = post.embeds.some((e) => e.kind === 'image' || e.kind === 'video');
  if (hasRichMedia && evergreenScore > 0.3) evergreenScore += 0.1;

  return Math.max(0, Math.min(1, evergreenScore));
}

// ─── Language Quality Detection ────────────────────────────────────────

/**
 * Detect low-quality/spam content based on text patterns.
 * Returns 0-100 where 100 = high quality language.
 */
export function computeLanguageQuality(post: UnifiedPost): number {
  const text = (post.text ?? '').trim();
  if (!text || text.length < 5) return 20; // Very short/empty = low quality

  let score = 70; // baseline

  // ── Negative signals ──────────────────────────────────────────────

  // Excessive capitalization
  const upperRatio = (text.match(/[A-Z]/g) ?? []).length / Math.max(text.length, 1);
  if (upperRatio > 0.4) score -= 15;

  // Excessive punctuation !!! ???
  const excessivePunct = (text.match(/[!?]{3,}/g) ?? []).length;
  score -= excessivePunct * 5;

  // Emoji density (too many = low effort)
  const emojiCount = (text.match(/[\p{Emoji}]/gu) ?? []).length;
  if (emojiCount > 10) score -= 10;
  else if (emojiCount > 5) score -= 5;

  // Link-only or mostly links
  const linkText = text.replace(/https?:\/\/\S+/g, '').trim();
  const linkCount = (text.match(/https?:\/\/\S+/g) ?? []).length;
  if (linkCount > 0 && linkText.length < 30) score -= 20;

  // Repeated characters (nooooo, stonnnks)
  const repeatedChars = (text.match(/([a-zA-Z])\1{3,}/g) ?? []).length;
  score -= repeatedChars * 5;

  // All-lowercase = low effort
  const lowerRatio = (text.match(/[a-z]/g) ?? []).length / Math.max(text.length, 1);
  if (lowerRatio > 0.95 && text.length > 30) score -= 8;

  // Excessive hashtags
  const hashtagCount = (text.match(/#\w+/g) ?? []).length;
  if (hashtagCount > 5) score -= 8;

  // Promotional language
  const promoPatterns = [
    /\b(free|win|click|subscribe|follow|like|share|retweet|repost|check out|link in bio)\b/i,
    /\b(buy|sell|trade|offer|limited|exclusive|hurry|act now|don't miss)\b/i,
  ];
  for (const pattern of promoPatterns) {
    if (pattern.test(text)) score -= 5;
  }

  // Ticker spam (lots of $TICKER mentions with little text)
  const tickers = (text.match(/\$[A-Z]{2,10}/g) ?? []).length;
  if (tickers > 5 && linkText.length < 100) score -= 10;

  // ── Positive signals ──────────────────────────────────────────────

  // Proper sentence structure
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  const properlyCapped = sentences.filter((s) => /^[A-Z]/.test(s.trim())).length;
  if (properlyCapped > 1) score += 5;

  // Varied vocabulary (unique word ratio)
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const uniqueWords = new Set(words).size;
  const vocabRatio = words.length > 0 ? uniqueWords / words.length : 0.5;
  if (vocabRatio > 0.7) score += 10;
  else if (vocabRatio > 0.5) score += 5;

  // Natural language markers
  const naturalWords = /\b(the|and|that|have|was|with|but|not|for|are)\b/i;
  if (naturalWords.test(text)) score += 5;

  // Code blocks = technical content
  if (text.includes('```') || /`[^`]+`/.test(text)) score += 5;

  // Markdown formatting
  if (/^#{1,6}\s/m.test(text) || /^\s*[-*+]\s/m.test(text)) score += 5;

  return Math.max(0, Math.min(100, score));
}

// ─── Engagement Velocity ───────────────────────────────────────────────

/**
 * Compute engagement velocity: how fast is engagement growing?
 * Returns 0-100 where 100 = explosive growth.
 */
export function computeEngagementVelocity(
  post: UnifiedPost,
  prev?: { likes: number; reposts: number; replies: number; at: number },
  now?: number,
): number {
  const currentTime = now ?? Date.now();
  const ageHours = Math.max(0.1, (currentTime - post.createdAt) / 3600000);

  if (!prev) {
    // No history — estimate from current engagement rate
    const totalEng =
      post.metrics.likes +
      post.metrics.reposts * 2 +
      post.metrics.replies * 3 +
      (post.metrics.quotes ?? 0) * 4;
    const rate = totalEng / ageHours;

    if (rate > 200) return 95;
    if (rate > 100) return 85;
    if (rate > 50) return 70;
    if (rate > 20) return 55;
    if (rate > 10) return 40;
    if (rate > 5) return 30;
    if (rate > 1) return 20;
    return 5;
  }

  // Delta-based velocity from snapshot
  const deltaHours = Math.max(0.1, (currentTime - prev.at) / 3600000);
  const dLikes = Math.max(0, post.metrics.likes - prev.likes);
  const dReposts = Math.max(0, post.metrics.reposts - prev.reposts);
  const dReplies = Math.max(0, post.metrics.replies - prev.replies);
  const dQuotes = Math.max(
    0,
    (post.metrics.quotes ?? 0) - ((prev as { quotes?: number }).quotes ?? 0),
  );

  const newEngagements = dLikes + dReposts * 2 + dReplies * 3 + dQuotes * 4;
  const velocityPerHour = newEngagements / deltaHours;

  if (velocityPerHour > 200) return 95;
  if (velocityPerHour > 100) return 85;
  if (velocityPerHour > 50) return 70;
  if (velocityPerHour > 20) return 55;
  if (velocityPerHour > 10) return 40;
  if (velocityPerHour > 5) return 30;
  if (velocityPerHour > 1) return 20;
  return 5;
}

// ─── Freshness Scoring (V3 enhanced) ───────────────────────────────────

/**
 * Compute freshness boost with breaking-news detection.
 * Breaking news gets a much stronger boost than regular fresh content.
 * Returns 0-100 where 100 = just posted breaking news.
 */
export function computeFreshnessV3(post: UnifiedPost, now: number): number {
  const ageMinutes = Math.max(0, (now - post.createdAt) / 60000);
  const text = post.text ?? '';

  // Detect breaking news patterns
  const isBreakingNews = /\b(breaking|just in|BREAKING|developing story|exclusive|scoop)\b/i.test(
    text,
  );
  const hasUrgency = /\b(urgent|critical|emergency|alert|important announcement)\b/i.test(text);

  // Base freshness by age
  let score = 0;
  if (ageMinutes < 5) {
    score = 95;
  } else if (ageMinutes < 15) {
    score = 90;
  } else if (ageMinutes < 30) {
    score = 80;
  } else if (ageMinutes < 60) {
    score = 70;
  } else if (ageMinutes < 120) {
    score = 60;
  } else if (ageMinutes < 360) {
    score = 45;
  } else if (ageMinutes < 720) {
    score = 30;
  } else if (ageMinutes < 1440) {
    score = 20;
  } else {
    score = 10;
  }

  // Breaking news boost
  if (isBreakingNews) {
    score = Math.min(100, score + 15);
  }
  if (hasUrgency) {
    score = Math.min(100, score + 10);
  }

  // Penalize old evergreen content less
  const evergreenScore = detectEvergreen(post);
  if (evergreenScore > 0.6 && ageMinutes > 1440) {
    // Evergreen content decays slower
    score = Math.max(score, 25);
  }

  return score;
}

// ─── Creator Quality (Historical) ──────────────────────────────────────

/**
 * Compute creator quality from historical data and current signals.
 * Returns 0-100 where 100 = top creator.
 */
export function computeCreatorQuality(
  post: UnifiedPost,
  history?: number,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 30; // baseline

  // Follower count (log scale)
  const followers = post.author.followerCount ?? 0;
  if (followers >= 1000000) {
    score += 25;
    reasons.push('1M+ followers');
  } else if (followers >= 100000) {
    score += 20;
    reasons.push('100K+ followers');
  } else if (followers >= 10000) {
    score += 15;
    reasons.push('10K+ followers');
  } else if (followers >= 1000) {
    score += 10;
    reasons.push('1K+ followers');
  } else if (followers >= 100) {
    score += 5;
    reasons.push('100+ followers');
  }

  // Verification
  if (post.author.verified.length > 0) {
    score += 10;
    reasons.push('verified');
  }

  // Historical quality blending (if available)
  if (history !== undefined && history > 0) {
    // Blend: 60% current signals, 40% historical
    score = Math.round(score * 0.6 + history * 0.4);
    if (history > 70) reasons.push('consistent-high-quality');
    else if (history < 30) reasons.push('inconsistent-quality');
  }

  // Follower/following ratio as quality signal
  const following = post.author.followingCount ?? 0;
  if (followers > 0 && following > 0) {
    const ratio = followers / following;
    if (ratio > 100) {
      score += 5;
      reasons.push('high-follower-ratio');
    } else if (ratio < 0.1 && followers > 1000) {
      // Many following but few followers = content farm
      score -= 5;
      reasons.push('low-follower-ratio');
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

// ─── Source Diversity Penalty ─────────────────────────────────────────

/**
 * Compute source diversity penalty based on how many times a creator,
 * category, or protocol appears in the current feed window.
 * Returns 0-100 where 100 = perfectly diverse, 0 = completely saturated.
 */
export function computeSourceDiversity(
  creatorCount: number,
  categoryCount: number,
  protocolCount: number,
  totalPosts: number,
): number {
  const safeTotal = Math.max(totalPosts, 1);

  // Each dimension contributes to diversity score
  const creatorDiversity = 1 - Math.min(1, creatorCount / Math.max(1, Math.ceil(safeTotal * 0.15)));
  const categoryDiversity =
    1 - Math.min(1, categoryCount / Math.max(1, Math.ceil(safeTotal * 0.25)));
  const protocolDiversity =
    1 - Math.min(1, protocolCount / Math.max(1, Math.ceil(safeTotal * 0.3)));

  // Weight: creator saturation matters most (avoid same person dominating)
  const diversityScore =
    (creatorDiversity * 0.5 + categoryDiversity * 0.25 + protocolDiversity * 0.25) * 100;

  return Math.max(0, Math.round(diversityScore));
}

// ─── Main V3 Composite Scorer ──────────────────────────────────────────

export interface QualityV3Options {
  /** Current timestamp */
  now?: number;
  /** Creator historical quality overrides */
  creatorHistory?: Map<string, number>;
  /** Creator post counts in current window */
  creatorPostCounts?: Map<string, number>;
  /** Category post counts in current window */
  categoryCounts?: Map<string, number>;
  /** Protocol post counts in current window */
  protocolCounts?: Map<string, number>;
  /** Previous engagement for velocity */
  previousEngagement?: Map<string, { likes: number; reposts: number; replies: number; at: number }>;
  /** Protocol weight overrides */
  protocolWeights?: Partial<Record<Protocol, number>>;
}

/**
 * Score a post using the V3 quality system.
 * Returns 0-100 composite with per-signal breakdown.
 */
export function scoreQualityV3(
  post: UnifiedPost,
  context: QualityV3Options = {},
): QualityV3Signals {
  const now = context.now ?? Date.now();

  // ── 1. Engagement Velocity ────────────────────────────────────────
  const prev = context.previousEngagement?.get(post.id);
  const engVelocity = computeEngagementVelocity(post, prev, now);

  // ── 2. Creator Quality ────────────────────────────────────────────
  const creatorHistory = context.creatorHistory?.get(post.author.id);
  const creatorResult = computeCreatorQuality(post, creatorHistory);

  // ── 3. Source Diversity ───────────────────────────────────────────
  const creatorCount = context.creatorPostCounts?.get(post.author.id) ?? 0;
  // Estimate category count from first niche
  const firstNiche = post.niches[0] ?? 'unknown';
  const categoryCount = context.categoryCounts?.get(firstNiche) ?? 0;
  const protocolCount = context.protocolCounts?.get(post.protocol) ?? 1;

  const totalPostsInWindow = Math.max(
    context.creatorPostCounts?.size ?? 1,
    context.protocolCounts?.size ?? 1,
    1,
  );
  const sourceDiversity = computeSourceDiversity(
    creatorCount,
    categoryCount,
    protocolCount,
    totalPostsInWindow,
  );

  // ── 4. Freshness ───────────────────────────────────────────────────
  const freshness = computeFreshnessV3(post, now);

  // ── 5. Evergreen ───────────────────────────────────────────────────
  const evergreenScore = detectEvergreen(post);

  // ── 6. Language Quality ────────────────────────────────────────────
  const languageQuality = computeLanguageQuality(post);

  // ── 7. Protocol Multiplier ─────────────────────────────────────────
  const baseWeight = PROTOCOL_QUALITY_WEIGHTS[post.protocol] ?? 0.7;
  const overrideWeight = context.protocolWeights?.[post.protocol as Protocol];
  const protocolMultiplier = (overrideWeight ?? baseWeight) * 100;

  // ── Composite (weighted combination) ──────────────────────────────
  const weights = {
    engagementVelocity: 0.15,
    creatorQuality: 0.2,
    sourceDiversity: 0.1,
    freshness: 0.2,
    languageQuality: 0.15,
    protocolMultiplier: 0.1,
    evergreenBonus: 0.1,
  };

  const composite =
    engVelocity * weights.engagementVelocity +
    creatorResult.score * weights.creatorQuality +
    sourceDiversity * weights.sourceDiversity +
    freshness * weights.freshness +
    languageQuality * weights.languageQuality +
    protocolMultiplier * weights.protocolMultiplier +
    evergreenScore * 100 * weights.evergreenBonus;

  // Collect reasons
  const reasons: string[] = [
    ...creatorResult.reasons,
    ...(engVelocity > 70 ? ['high-velocity'] : []),
    ...(engVelocity > 90 ? ['viral'] : []),
    ...(freshness > 80 ? ['very-fresh'] : []),
    ...(freshness > 60 && freshness <= 80 ? ['fresh'] : []),
    ...(evergreenScore > 0.6 ? ['evergreen'] : []),
    ...(languageQuality > 80 ? ['high-language-quality'] : []),
    ...(languageQuality < 30 ? ['low-language-quality'] : []),
    ...(sourceDiversity > 80 ? ['diverse-source'] : []),
    ...(protocolMultiplier > 90 ? ['premium-protocol'] : []),
    ...(protocolMultiplier < 50 ? ['low-quality-protocol'] : []),
    ...(post.author.verified.length > 0 ? ['verified'] : []),
  ];

  return {
    composite: Math.round(Math.max(0, Math.min(100, composite))),
    engagementVelocity: Math.round(engVelocity),
    creatorQuality: Math.round(creatorResult.score),
    sourceDiversity: Math.round(sourceDiversity),
    freshness: Math.round(freshness),
    evergreenScore: Math.round(evergreenScore * 100) / 100,
    languageQuality: Math.round(languageQuality),
    protocolMultiplier: Math.round(protocolMultiplier),
    reasons: [...new Set(reasons)],
  };
}

/**
 * Attach V3 quality signals to a post for frontend transparency.
 */
export function enrichWithQualityV3(post: UnifiedPost, signals: QualityV3Signals): UnifiedPost {
  const feedDebug =
    ((post as unknown as Record<string, unknown>).feedDebug as Record<string, unknown>) ?? {};
  return {
    ...post,
    feedDebug: {
      ...feedDebug,
      qualityScore: signals.composite / 100,
      qualityV3: signals,
    },
  } as unknown as UnifiedPost;
}
