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
  economics: ['economics', 'macro', 'finance', 'markets'],
  programming: ['programming', 'coding', 'software', 'development', 'engineering'],
  linux: ['linux', 'unix', 'foss', 'opensource', 'selfhosted'],
  foss: ['foss', 'opensource', 'free-software', 'linux'],
  hardware: ['hardware', 'electronics', 'maker', 'diy', 'gadgets'],
  space: ['space', 'astronomy', 'astrophysics', 'nasa', 'spacex'],
  energy: ['energy', 'renewable', 'solar', 'nuclear', 'climate'],
  health: ['health', 'fitness', 'medicine', 'wellness', 'longevity'],
  sports: ['sports', 'nfl', 'nba', 'soccer', 'baseball'],
  history: ['history', 'historical', 'ancient', 'medieval'],
  books: ['books', 'reading', 'literature', 'writing', 'publishing'],
  movies: ['movies', 'film', 'cinema', 'hollywood', 'documentary'],
  food: ['food', 'cooking', 'recipes', 'cuisine', 'nutrition'],
  travel: ['travel', 'adventure', 'exploration', 'wanderlust', 'backpacking'],
  photography: ['photography', 'photos', 'camera', 'imaging'],
  diy: ['diy', 'maker', 'craft', 'woodworking', 'repair'],
  meta: ['meta', 'fediverse', 'lemmy', 'kbin', 'degenfeed', 'community'],
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
  economics: {
    title: 'Economics',
    description: 'Economic theory, macroeconomics, market analysis, and financial systems',
    emoji: '📈',
  },
  programming: {
    title: 'Programming',
    description: 'Software development, coding languages, algorithms, and engineering best practices',
    emoji: '💻',
  },
  linux: {
    title: 'Linux & FOSS',
    description: 'Linux, open source software, self-hosting, and free software advocacy',
    emoji: '🐧',
  },
  foss: {
    title: 'Free & Open Source',
    description: 'FOSS projects, open source philosophy, licensing, and community initiatives',
    emoji: '📖',
  },
  hardware: {
    title: 'Hardware',
    description: 'Computer hardware, electronics, gadgets, and DIY tech projects',
    emoji: '🔧',
  },
  space: {
    title: 'Space',
    description: 'Space exploration, astronomy, astrophysics, and space technology',
    emoji: '🚀',
  },
  energy: {
    title: 'Energy',
    description: 'Energy markets, renewable energy, nuclear, and climate technology',
    emoji: '⚡',
  },
  health: {
    title: 'Health',
    description: 'Health, fitness, medicine, wellness, and longevity research',
    emoji: '🏥',
  },
  sports: {
    title: 'Sports',
    description: 'Professional sports, athletics, teams, and sporting events',
    emoji: '🏀',
  },
  history: {
    title: 'History',
    description: 'Historical events, civilizations, and lessons from the past',
    emoji: '📜',
  },
  books: {
    title: 'Books',
    description: 'Literature, reading, book recommendations, and author discussions',
    emoji: '📚',
  },
  movies: {
    title: 'Movies',
    description: 'Film, cinema, reviews, recommendations, and industry news',
    emoji: '🎬',
  },
  food: {
    title: 'Food',
    description: 'Cooking, recipes, cuisine, nutrition, and food culture',
    emoji: '🍳',
  },
  travel: {
    title: 'Travel',
    description: 'Travel destinations, adventure, backpacking, and cultural exploration',
    emoji: '✈️',
  },
  photography: {
    title: 'Photography',
    description: 'Photography techniques, gear, composition, and visual storytelling',
    emoji: '📷',
  },
  diy: {
    title: 'DIY',
    description: 'Do-it-yourself projects, crafting, woodworking, repairs, and making',
    emoji: '🛠',
  },
  meta: {
    title: 'Meta',
    description: 'Community meta discussions, platform news, and community governance',
    emoji: '🔄',
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
  'economics',
  'programming',
  'linux',
  'foss',
  'hardware',
  'space',
  'energy',
  'health',
  'sports',
  'history',
  'books',
  'movies',
  'food',
  'travel',
  'photography',
  'diy',
  'meta',
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
