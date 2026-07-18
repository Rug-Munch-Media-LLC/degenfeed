/**
 * Community niche mapping and quality scoring for DegenFeed.
 *
 * Maps community categories to feed-core niches for content routing,
 * and computes community quality scores based on engagement metrics.
 */

// ─── Community-to-niche mapping ────────────────────────────────────

/**
 * Maps each curated community category to an array of DegenFeed feed-core
 * niche keywords used for content routing and relevance scoring.
 */
export const LEMMY_COMMUNITY_NICHES: Record<string, string[]> = {
  crypto: ['crypto', 'bitcoin', 'ethereum', 'solana', 'onchain'],
  defi: ['defi', 'layer2', 'stablecoin', 'onchain'],
  nft: ['nft', 'onchain'],
  tech: ['tech', 'programming', 'software', 'startups', 'saas'],
  trading: ['trading', 'macro', 'etf'],
  memes: ['memecoin'],
  news: ['crypto', 'regulation', 'macroeconomics', 'etf'],
  governance: ['dao', 'regulation'],
  security: ['security', 'cybersecurity', 'infosec'],
  privacy: ['privacy', 'private', 'anonymous'],
  gaming: ['gaming', 'nft', 'metaverse'],
  art: ['nft', 'art', 'creative'],
  music: ['nft', 'music', 'audio'],
  science: ['science', 'research', 'physics', 'biology', 'space', 'quantum', 'nature'],
  philosophy: ['philosophy', 'ethics', 'governance'],
  ai: ['ai', 'machine-learning', 'llm', 'deep-learning', 'research'],
  startups: ['startups', 'venture-capital', 'funding', 'founder', 'saas'],
};

// ─── Community descriptions ───────────────────────────────────────

/**
 * Descriptions for each reserved community category, used in UI
 * cards and community detail pages.
 */
export const COMMUNITY_DESCRIPTIONS: Record<
  string,
  { title: string; description: string; emoji: string }
> = {
  crypto: {
    title: 'Crypto Discussion',
    description: 'General cryptocurrency discussion — Bitcoin, Ethereum, altcoins, and market talk',
    emoji: '₿',
  },
  defi: {
    title: 'DeFi',
    description: 'Decentralized finance protocols, yield strategies, lending, and liquidity pools',
    emoji: '🏦',
  },
  nft: {
    title: 'NFTs',
    description: 'NFT projects, collections, minting, and digital collectibles trading',
    emoji: '🖼',
  },
  tech: {
    title: 'Blockchain Tech',
    description: 'Blockchain technology, development, Layer 2s, and protocol engineering',
    emoji: '⚙',
  },
  trading: {
    title: 'Trading',
    description: 'Trading strategies, technical analysis, market structure, and risk management',
    emoji: '📊',
  },
  memes: {
    title: 'Memes',
    description: 'Crypto memes, humor, and degenerate content',
    emoji: '🎭',
  },
  news: {
    title: 'Crypto News',
    description: 'Breaking crypto news, current events, and regulatory updates',
    emoji: '📰',
  },
  governance: {
    title: 'Governance',
    description: 'DAO governance, community proposals, voting, and on-chain democracy',
    emoji: '🗳',
  },
  security: {
    title: 'Security',
    description: 'Cybersecurity, infosec, threat analysis, and secure development practices',
    emoji: '🔒',
  },
  privacy: {
    title: 'Privacy',
    description: 'Privacy tools, techniques, and digital rights advocacy',
    emoji: '👁',
  },
  gaming: {
    title: 'Gaming',
    description: 'Blockchain gaming, GameFi, and play-to-earn discussions',
    emoji: '🎮',
  },
  art: {
    title: 'Digital Art',
    description: 'NFT art, generative art, and digital creative expression',
    emoji: '🎨',
  },
  music: {
    title: 'Music',
    description: 'Web3 music, NFT audio drops, and decentralized streaming',
    emoji: '🎵',
  },
  science: {
    title: 'Science',
    description: 'Scientific research, discoveries, and technology breakthroughs',
    emoji: '🔬',
  },
  philosophy: {
    title: 'Philosophy',
    description: 'Deep questions, ethics of technology, and decentralized philosophy',
    emoji: '🤔',
  },
  ai: {
    title: 'AI',
    description: 'Artificial intelligence, machine learning, LLMs, and AI research',
    emoji: '🤖',
  },
  startups: {
    title: 'Startups',
    description: 'Startup culture, venture capital, product launches, and founder stories',
    emoji: '🚀',
  },
};

// ─── Reserved community names ─────────────────────────────────────

/**
 * Names reserved for the 8 curated community categories.
 * These are created on the local Lemmy instance and used
 * as the canonical set for the Featured Communities section.
 */
export const RESERVED_COMMUNITY_NAMES = [
  'crypto',
  'defi',
  'nft',
  'tech',
  'trading',
  'memes',
  'news',
  'governance',
  'security',
  'privacy',
  'gaming',
  'art',
  'music',
  'science',
  'philosophy',
  'ai',
  'startups',
] as const;

// ─── Quality scoring ──────────────────────────────────────────────

export interface CommunityQualityInput {
  /** Number of subscribers */
  subscribers: number;
  /** Average posts per day */
  postsPerDay: number;
  /** Average comments per post */
  commentsPerPost: number;
  /** Community age in days */
  ageDays: number;
}

export interface CommunityQualityScore {
  /** Overall score 0-100 */
  score: number;
  /** Quality tier label */
  tier: 'low' | 'medium' | 'high' | 'vibrant';
  /** Per-factor breakdown */
  details: {
    subscribersScore: number;
    postsPerDayScore: number;
    commentsPerPostScore: number;
    ageScore: number;
  };
}

function computeTier(score: number): CommunityQualityScore['tier'] {
  if (score >= 75) return 'vibrant';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

/**
 * Compute a weighted community quality score (0-100).
 *
 * Weights:
 *   - subscribers (log-scaled):   30%
 *   - postsPerDay (capped 100):   30%
 *   - commentsPerPost (capped 50): 25%
 *   - ageDays (capped 365):        15%
 */
export function scoreCommunityQuality(input: CommunityQualityInput): CommunityQualityScore {
  const logSubs = Math.log(Math.max(input.subscribers, 1) + 1);
  const maxLogSubs = Math.log(1_000_000 + 1); // reference: 1M subs
  const subscribersScore = Math.min(logSubs / maxLogSubs, 1) * 30;

  const postsPerDayScore = (Math.min(Math.max(input.postsPerDay, 0), 100) / 100) * 30;

  const commentsPerPostScore = (Math.min(Math.max(input.commentsPerPost, 0), 50) / 50) * 25;

  const ageScore = (Math.min(Math.max(input.ageDays, 0), 365) / 365) * 15;

  const score =
    Math.round((subscribersScore + postsPerDayScore + commentsPerPostScore + ageScore) * 100) / 100;

  return {
    score: Math.min(score, 100),
    tier: computeTier(score),
    details: {
      subscribersScore: Math.round(subscribersScore * 100) / 100,
      postsPerDayScore: Math.round(postsPerDayScore * 100) / 100,
      commentsPerPostScore: Math.round(commentsPerPostScore * 100) / 100,
      ageScore: Math.round(ageScore * 100) / 100,
    },
  };
}

/**
 * Quick quality tier based on subscriber count alone (for cases where
 * we don't have full metrics). Used in the Lemmy feed adapter.
 */
export function subscriberTier(subscribers: number): 'low' | 'medium' | 'high' | 'vibrant' {
  if (subscribers >= 10_000) return 'vibrant';
  if (subscribers >= 100) return 'high';
  if (subscribers >= 1) return 'medium';
  return 'low';
}
