/**
 * ranking-weights — Explicit weight configuration for feed ranking.
 *
 * Target formula: recency (40%) + engagement (30%) + relevance (20%) + diversity (10%)
 *
 * These weights are applied in the personalization scoring layer (for-you.ts)
 * and in the curation pipeline (feed-curation-rules.ts).
 */

/**
 * Core ranking weights used across all feed types.
 */
export const RANKING_WEIGHTS = {
  /** How fresh the post is (0-1): 40% — posts <1hr get max score */
  recency: 0.4,
  /** How engaged the community is (0-1): 30% — likes, reposts, replies, quotes */
  engagement: 0.3,
  /** How relevant to the user's interests (0-1): 20% — niche match, topic affinity */
  relevance: 0.2,
  /** How much it contributes to feed diversity (0-1): 10% — category, protocol, creator variety */
  diversity: 0.1,
} as const;

export type WeightComponent = keyof typeof RANKING_WEIGHTS;

/**
 * Fresh content boost: posts <1hr old get a small score multiplier.
 * Reduced from 1.2 to 1.08 (2026-07-28) to prevent recency dominance.
 * The unified scorer's freshnessBoost (1.3x <15min, 1.15x <1hr) already
 * provides enough recency bias — this extra boost was causing double-dipping.
 * See FEED-ALGORITHM-TUNING.md for the analysis.
 */
export const FRESH_CONTENT_BOOST = 1.08;
export const FRESH_CONTENT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
export const MODERATELY_FRESH_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours
export const MODERATELY_FRESH_BOOST = 1.05;

/**
 * Boredom breaker config: every N posts, inject a high-quality post
 * from a category the user doesn't usually see.
 */
export const BOREDOM_BREAKER_INTERVAL = 15;
export const BOREDOM_BREAKER_QUALITY_FLOOR = 0.5; // minimum quality score

/**
 * Niche detection thresholds:
 * A post is "crypto/degen" if it matches at least this many crypto niches.
 */
export const CRYPTO_NICHE_THRESHOLD = 1;
export const CRYPTO_NICHES = new Set([
  'crypto',
  'defi',
  'nft',
  'memecoin',
  'bitcoin',
  'ethereum',
  'solana',
  'layer2',
  'stablecoin',
  'trading',
  'regulation',
  'onchain',
  'mining',
  'privacy',
  'security',
]);

/**
 * NSFW detection — keywords that trigger content filtering.
 */
export const NSFW_KEYWORDS = [
  'nsfw',
  'porn',
  'sex',
  'nude',
  'naked',
  'xxx',
  'adult content',
  'onlyfans',
  '18+',
  'nsfl',
] as const;

/**
 * Spam signal keywords — common spam patterns.
 */
export const SPAM_SIGNALS = [
  'click here',
  'free money',
  'earn btc',
  'double your',
  'investment opportunity',
  'guaranteed returns',
  'sign up bonus',
  'referral link',
  'claim your',
  'airdrop claim',
  'verify wallet',
];

/**
 * Compute recency score 0-1 based on post age.
 * Posts < 1hr = 1.0, < 6hr = 0.8, < 24hr = 0.5, < 72hr = 0.2, older = 0.0
 */
export function computeRecencyScore(createdAt: number, now: number): number {
  const ageMs = now - createdAt;
  const ageHours = ageMs / 3_600_000;

  if (ageHours < 1) return 1.0;
  if (ageHours < 6) return 0.8;
  if (ageHours < 24) return 0.5;
  if (ageHours < 72) return 0.2;
  return 0.0;
}

/**
 * Compute engagement score 0-1 from post metrics.
 * Logarithmic scaling to prevent viral outliers from dominating.
 */
export function computeEngagementScore(
  likes: number,
  reposts: number,
  replies: number,
  quotes: number = 0,
): number {
  const weighted = likes * 1 + reposts * 3 + replies * 5 + quotes * 3;
  // Log scale: 0→0, 10→0.5, 100→0.8, 1000→0.95, 10000→1.0
  return Math.min(1.0, Math.log10(1 + weighted) / 4);
}

/**
 * Compute relevance score 0-1 based on niche overlap with user interests.
 */
export function computeRelevanceScore(
  postNiches: string[],
  userNiches: Set<string>,
  userCreators: Set<string>,
  authorId: string,
): number {
  if (userNiches.size === 0 && userCreators.size === 0) return 0.3; // neutral ground

  let score = 0;

  // Niche overlap
  if (userNiches.size > 0) {
    const matches = postNiches.filter((n) => userNiches.has(n.toLowerCase())).length;
    score += (matches / Math.max(postNiches.length, 1)) * 0.7; // niche match = up to 0.7
  }

  // Creator following (strong signal)
  if (userCreators.has(authorId)) {
    score += 0.3;
  }

  return Math.min(1.0, score);
}

/**
 * Compute diversity score 0-1.
 * Rewards posts from underrepresented categories/protocols/creators.
 */
export function computeDiversityScore(
  categoryFrequency: Map<string, number>,
  protocolFrequency: Map<string, number>,
  creatorFrequency: Map<string, number>,
  postCategory: string,
  postProtocol: string,
  postCreatorId: string,
  totalPosts: number,
): number {
  if (totalPosts === 0) return 0.5;

  let score = 0;

  // Category diversity
  const catCount = categoryFrequency.get(postCategory) ?? 0;
  const catRatio = catCount / totalPosts;
  score += (1 - catRatio) * 0.4; // underrepresented categories = higher score

  // Protocol diversity
  const protoCount = protocolFrequency.get(postProtocol) ?? 0;
  const protoRatio = protoCount / totalPosts;
  score += (1 - protoRatio) * 0.3;

  // Creator diversity
  const creatorCount = creatorFrequency.get(postCreatorId) ?? 0;
  const creatorRatio = creatorCount / totalPosts;
  score += (1 - creatorRatio) * 0.3;

  return Math.min(1.0, score);
}

/**
 * Check if a post is crypto/defi/degen content.
 */
export function isCryptoContent(niches: string[], text: string): boolean {
  const lowerText = text.toLowerCase();
  const nicheMatches = niches.filter((n) => CRYPTO_NICHES.has(n.toLowerCase())).length;

  if (nicheMatches >= CRYPTO_NICHE_THRESHOLD) return true;

  // Also check text for crypto keywords
  const cryptoKeywords = ['btc', 'eth', 'sol', 'crypto', 'token', 'coin', 'blockchain', 'web3'];
  const textMatches = cryptoKeywords.filter((kw) => lowerText.includes(kw)).length;
  return textMatches >= 2;
}

/**
 * Check if post text contains NSFW content.
 */
export function hasNsfwContent(text: string): boolean {
  const lower = text.toLowerCase();
  return NSFW_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Check if post text contains spam signals.
 */
export function hasSpamSignals(text: string): boolean {
  const lower = text.toLowerCase();
  return SPAM_SIGNALS.some((kw) => lower.includes(kw));
}
