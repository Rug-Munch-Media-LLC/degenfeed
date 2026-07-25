/**
 * @degenfeed/feed-core — Content Categorization V3
 *
 * Multi-label categorization with confidence scores, protocol-aware signals,
 * user-correctable feedback loop, and trending categories.
 *
 * Each post gets up to 3 categories with confidence 0-1:
 *   - Primary: highest confidence
 *   - Secondary: next highest
 *   - Tertiary: third highest (if confidence > 0.15)
 *
 * Categories are protocol-aware: certain protocols have stronger signals
 * for particular categories (e.g., Mirror → publishing/long-form,
 * PeerTube/YouTube → video content).
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';

// ─── Category Taxomy ───────────────────────────────────────────────────

export const ALL_CATEGORIES = [
  'defi', 'nft', 'trading', 'ai', 'memecoin', 'security', 'news', 'memes',
  'bitcoin', 'ethereum', 'solana', 'layer2', 'stablecoin', 'regulation',
  'gaming', 'tech', 'science', 'startups', 'macro', 'onchain', 'culture', 'general',
] as const;

export type CategorySlug = (typeof ALL_CATEGORIES)[number];

export interface CategoryDef {
  slug: CategorySlug;
  label: string;
  emoji: string;
  niches: string[];
  keywords: string[];
}

export const CATEGORIES: Record<CategorySlug, CategoryDef> = {
  defi: {
    slug: 'defi', label: 'DeFi', emoji: '🏦',
    niches: ['defi', 'layer2', 'stablecoin', 'etf', 'onchain'],
    keywords: ['defi', 'decentralized finance', 'lending', 'yield', 'staking', 'swap', 'dex', 'amm', 'liquidity', 'vault', 'restaking', 'layer 2', 'l2', 'rollup', 'stablecoin', 'usdt', 'usdc', 'etf', 'onchain', 'arbitrum', 'optimism', 'base', 'zk-', 'zero knowledge'],
  },
  nft: {
    slug: 'nft', label: 'NFTs', emoji: '🖼️',
    niches: ['nft', 'gaming', 'art', 'music'],
    keywords: ['nft', 'collectible', 'mint', 'opensea', 'blur', 'digital art', 'metaverse', 'punk', 'azuki'],
  },
  trading: {
    slug: 'trading', label: 'Trading', emoji: '📊',
    niches: ['trading', 'macro', 'etf'],
    keywords: ['trading', 'technical analysis', 'chart', 'price action', 'support resistance', 'market structure', 'breakout', 'volume', 'fomc', 'fed', 'inflation', 'interest rate', 'recession', 'nasdaq', 'spx', 'cpi', 'dollar'],
  },
  ai: {
    slug: 'ai', label: 'AI', emoji: '🤖',
    niches: ['ai', 'tech', 'startups'],
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt', 'openai', 'deepseek', 'claude', 'gemini', 'neural', 'deep learning', 'transformer', 'agent', 'copilot', 'diffusion'],
  },
  memecoin: {
    slug: 'memecoin', label: 'Meme Coins', emoji: '🎭',
    niches: ['memecoin'],
    keywords: ['memecoin', 'meme coin', 'dogecoin', 'shiba', 'pepe', 'bonk', 'wif', 'moon', 'pump', 'dump'],
  },
  security: {
    slug: 'security', label: 'Security', emoji: '🔒',
    niches: ['security', 'privacy'],
    keywords: ['hack', 'exploit', 'vulnerability', 'audit', 'phishing', 'rug pull', 'rekt', 'breach', 'privacy', 'anonymous', 'immunefi', 'smart contract', 'solidity'],
  },
  news: {
    slug: 'news', label: 'News', emoji: '📰',
    niches: ['crypto', 'regulation', 'macro', 'etf', 'startups'],
    keywords: ['news', 'breaking', 'announces', 'launch', 'regulation', 'sec', 'cftc', 'congress', 'senate', 'policy', 'compliance', 'lawsuit', 'mica', 'bitcoin', 'ethereum', 'solana'],
  },
  memes: {
    slug: 'memes', label: 'Memes', emoji: '😂',
    niches: ['memecoin', 'gaming'],
    keywords: ['meme', 'memes', 'funny', 'lol', 'humor', 'degen'],
  },
  bitcoin: {
    slug: 'bitcoin', label: 'Bitcoin', emoji: '₿',
    niches: ['bitcoin', 'btc', 'macro', 'mining'],
    keywords: ['bitcoin', 'btc', 'satoshi', 'halving', 'blockchain', 'mining', 'hashrate', 'lightning network', 'ordinal', 'brc-20', 'rune', 'taproot', 'schnorr', 'btc etf'],
  },
  ethereum: {
    slug: 'ethereum', label: 'Ethereum', emoji: '⟠',
    niches: ['ethereum', 'evm', 'defi', 'layer2'],
    keywords: ['ethereum', 'eth', 'vitalik', 'eip', 'erc-20', 'erc-721', 'ethereum etf', 'ethereum upgrade', 'danksharding', 'blob', 'cancun', 'dencun', 'prague'],
  },
  solana: {
    slug: 'solana', label: 'Solana', emoji: '◎',
    niches: ['solana', 'defi', 'memecoin', 'nft'],
    keywords: ['solana', 'sol', 'phantom', 'jupiter', 'orca', 'raydium', 'pyth', 'solana pay', 'spl', 'token-2022', 'blink', 'action'],
  },
  layer2: {
    slug: 'layer2', label: 'Layer 2', emoji: '⚙️',
    niches: ['layer2', 'ethereum', 'defi', 'tech'],
    keywords: ['layer 2', 'l2', 'rollup', 'optimistic', 'zk rollup', 'arbitrum', 'optimism', 'base', 'zksync', 'starknet', 'polygon', 'scroll', 'linea', 'taiko', 'blob'],
  },
  stablecoin: {
    slug: 'stablecoin', label: 'Stablecoins', emoji: '💲',
    niches: ['stablecoin', 'defi', 'regulation', 'macro'],
    keywords: ['stablecoin', 'usdt', 'usdc', 'dai', 'frax', 'lusd', 'stablecoin regulation', 'rwa', 'real world asset', 'yield bearing', 'synthetic dollar'],
  },
  regulation: {
    slug: 'regulation', label: 'Regulation', emoji: '⚖️',
    niches: ['regulation', 'news', 'macro', 'legal'],
    keywords: ['regulation', 'regulatory', 'sec', 'cftc', 'lawsuit', 'compliance', 'mica', 'kyc', 'aml', 'congress', 'senate', 'hearing', 'subpoena', 'doj', 'fincen'],
  },
  gaming: {
    slug: 'gaming', label: 'Gaming', emoji: '🎮',
    niches: ['gaming', 'metaverse', 'nft'],
    keywords: ['gaming', 'game', 'web3 gaming', 'play to earn', 'p2e', 'immutable', 'gala', 'axie', 'metaverse', 'onchain game', 'fren pet', 'telegram game', 'tap to earn'],
  },
  tech: {
    slug: 'tech', label: 'Tech', emoji: '💻',
    niches: ['tech', 'startups', 'ai'],
    keywords: ['tech', 'technology', 'startup', 'software', 'programming', 'developer', 'coding', 'github', 'open source', 'saas', 'cloud', 'api', 'linux', 'docker', 'kubernetes'],
  },
  science: {
    slug: 'science', label: 'Science', emoji: '🔬',
    niches: ['science'],
    keywords: ['science', 'research', 'discovery', 'nasa', 'space', 'physics', 'biology', 'quantum', 'genetics', 'dna', 'climate', 'energy', 'breakthrough'],
  },
  startups: {
    slug: 'startups', label: 'Startups', emoji: '🚀',
    niches: ['startups'],
    keywords: ['startup', 'venture capital', 'vc', 'funding', 'seed', 'series a', 'ipo', 'unicorn', 'y combinator', 'accelerator', 'pitch deck', 'founder'],
  },
  macro: {
    slug: 'macro', label: 'Macro', emoji: '📈',
    niches: ['macro'],
    keywords: ['macro', 'fed', 'fomc', 'inflation', 'interest rate', 'dollar', 'recession', 'nasdaq', 'spx', 'cpi', 'gdp', 'economy'],
  },
  onchain: {
    slug: 'onchain', label: 'Onchain', emoji: '⛓️',
    niches: ['onchain'],
    keywords: ['onchain', 'on-chain', 'blockchain data', 'whale', 'wallet', 'gas fee', 'tvl', 'total value locked', 'bridge', 'transaction'],
  },
  culture: {
    slug: 'culture', label: 'Culture', emoji: '🎭',
    niches: ['culture'],
    keywords: ['culture', 'community', 'society', 'trend', 'viral', 'social'],
  },
  general: {
    slug: 'general', label: 'General', emoji: '🌐',
    niches: ['crypto', 'blockchain', 'web3'],
    keywords: ['crypto', 'blockchain', 'web3', 'cryptocurrency', 'token', 'decentralized'],
  },
};

// ─── Protocol-Aware Category Signals ──────────────────────────────────

const PROTOCOL_CATEGORY_BOOSTS: Partial<Record<Protocol, Partial<Record<CategorySlug, number>>>> = {
  mirror: { ai: 0.15, tech: 0.2, startups: 0.15 },
  paragraph: { ai: 0.15, tech: 0.15 },
  youtube: { tech: 0.15, gaming: 0.2, ai: 0.1 },
  peertube: { tech: 0.1, gaming: 0.15 },
  lemmy: { news: 0.2, tech: 0.1, gaming: 0.1 },
  reddit: { memes: 0.15, memecoin: 0.15, news: 0.1 },
  rss: { news: 0.3, tech: 0.15, regulation: 0.1, macro: 0.1 },
  pixelfed: { nft: 0.1 },
  telegram: { memecoin: 0.2, news: 0.1 },
  mastodon: { news: 0.1, tech: 0.1 },
};

const PROTOCOL_CATEGORY_DAMPEN: Partial<Record<Protocol, Partial<Record<CategorySlug, number>>>> = {
  gab: { news: -0.2 },
};

// ─── Cross-Category Penalty ────────────────────────────────────────────

const CATEGORY_CONFLICTS: [CategorySlug, CategorySlug][] = [
  ['memecoin', 'regulation'], ['memes', 'security'], ['memes', 'regulation'], ['memes', 'macro'],
];

const CATEGORY_OVERLAP_SIMILARITY: [CategorySlug, CategorySlug, number][] = [
  ['bitcoin', 'ethereum', 0.15], ['ethereum', 'layer2', 0.2], ['defi', 'layer2', 0.15],
  ['defi', 'stablecoin', 0.2], ['solana', 'defi', 0.1], ['news', 'regulation', 0.1],
  ['ai', 'tech', 0.15], ['trading', 'bitcoin', 0.1], ['trading', 'ethereum', 0.1],
  ['nft', 'gaming', 0.15],
];

// ─── Content-Type Category Signals ────────────────────────────────────

const CONTENT_TYPE_CATEGORY_MAP: Record<string, Partial<Record<CategorySlug, number>>> = {
  video: { gaming: 0.2, tech: 0.1, ai: 0.1 },
  article: { tech: 0.15, ai: 0.15, news: 0.15, regulation: 0.1 },
  image: { nft: 0.15, memes: 0.2 },
  link: { news: 0.15, tech: 0.1 },
};

// ─── Author Bio Category Signals ──────────────────────────────────────

const BIO_CATEGORY_KEYWORDS: Partial<Record<CategorySlug, string[]>> = {
  defi: ['defi', 'lending', 'yield', 'liquidity'],
  nft: ['nft', 'artist', 'collector', 'opensea'],
  trading: ['trader', 'analyst', 'chart', 'market', 'technical analysis'],
  ai: ['ai', 'ml', 'llm', 'machine learning', 'deep learning'],
  memecoin: ['memecoin', 'degen'],
  security: ['security', 'auditor', 'infosec', 'hacker'],
  news: ['journalist', 'reporter', 'news', 'writer'],
  bitcoin: ['bitcoin', 'bitcoiner', 'maxi'],
  ethereum: ['ethereum', 'eth', 'solidity'],
  solana: ['solana', 'sol'],
  tech: ['developer', 'engineer', 'programmer', 'software', 'founder', 'cto'],
  science: ['scientist', 'researcher', 'phd'],
  startups: ['founder', 'vc', 'venture', 'startup'],
  regulation: ['lawyer', 'attorney', 'regulatory', 'compliance'],
  gaming: ['gamer', 'gaming', 'streamer'],
  layer2: ['layer 2', 'rollup', 'zk'],
  stablecoin: ['stablecoin', 'usdc'],
  macro: ['economics', 'economist', 'macro'],
  memes: ['memes', 'shitposter'],
};

// ─── Main Classification Types ─────────────────────────────────────────

export interface CategoryAssignment {
  slug: CategorySlug;
  confidence: number;
  signals: string[];
}

export interface CategorizationV3Result {
  categories: CategoryAssignment[];
  primary: CategorySlug | null;
  secondary: CategorySlug | null;
  tertiary: CategorySlug | null;
  primaryCategory: CategorySlug;
}

export interface CategorizationFeedback {
  postId: string;
  userId: string;
  categories: CategorySlug[];
  timestamp: number;
}

export interface CategorizationV3Options {
  protocolAware?: boolean;
  contentTypeSignals?: boolean;
  engagementSignals?: boolean;
  authorBioSignals?: boolean;
  minSecondaryConfidence?: number;
  maxCategories?: number;
}

const DEFAULT_OPTIONS: CategorizationV3Options = {
  protocolAware: true,
  contentTypeSignals: true,
  engagementSignals: true,
  authorBioSignals: true,
  minSecondaryConfidence: 0.15,
  maxCategories: 3,
};

/**
 * Classify a post into up to 3 categories with confidence scores.
 * Uses multi-signal fusion: niche match, keyword match, protocol boost,
 * content type, engagement patterns, and author bio signals.
 */
export function classifyPost(
  post: UnifiedPost,
  options: CategorizationV3Options = {},
): CategorizationV3Result {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const text = buildClassificationText(post);
  const categoryScores = new Map<CategorySlug, { score: number; signals: string[] }>();

  for (const cat of Object.values(CATEGORIES)) {
    categoryScores.set(cat.slug, { score: 0, signals: [] });
  }

  // ── 1. Niche-based scoring ──────────────────────────────────────────
  const postNiches = new Set(post.niches.map((n) => n.toLowerCase()));
  for (const cat of Object.values(CATEGORIES)) {
    const entry = categoryScores.get(cat.slug)!;
    const nicheMatches = cat.niches.filter((n) => postNiches.has(n)).length;
    if (nicheMatches > 0) {
      entry.score += Math.min(nicheMatches * 0.35, 0.7);
      entry.signals.push(`niche:${cat.niches.filter((n) => postNiches.has(n)).join(',')}`);
    }
  }

  // ── 2. Keyword-based scoring ────────────────────────────────────────
  for (const cat of Object.values(CATEGORIES)) {
    const entry = categoryScores.get(cat.slug)!;
    let kwMatches = 0;
    for (const kw of cat.keywords) {
      if (keywordMatches(text, kw)) kwMatches++;
    }
    if (kwMatches > 0) {
      entry.score += Math.min(kwMatches * 0.06, 0.35);
      entry.signals.push(`keyword:${kwMatches}matches`);
    }
  }

  // ── 3. Protocol-aware boost ─────────────────────────────────────────
  if (opts.protocolAware && post.protocol) {
    const boosts = PROTOCOL_CATEGORY_BOOSTS[post.protocol as Protocol];
    if (boosts) {
      for (const [slug, boost] of Object.entries(boosts)) {
        const entry = categoryScores.get(slug as CategorySlug);
        if (entry) {
          entry.score += boost;
          entry.signals.push(`protocol:${post.protocol}`);
        }
      }
    }
    const dampens = PROTOCOL_CATEGORY_DAMPEN[post.protocol as Protocol];
    if (dampens) {
      for (const [slug, penalty] of Object.entries(dampens)) {
        const entry = categoryScores.get(slug as CategorySlug);
        if (entry) {
          entry.score = Math.max(0, entry.score + penalty);
          entry.signals.push(`protocol-dampen:${post.protocol}`);
        }
      }
    }
  }

  // ── 4. Content-type signals ─────────────────────────────────────────
  if (opts.contentTypeSignals) {
    const contentType = (post as unknown as Record<string, unknown>).contentType as string ?? detectSimpleContentType(post);
    const typeBoosts = CONTENT_TYPE_CATEGORY_MAP[contentType];
    if (typeBoosts) {
      for (const [slug, boost] of Object.entries(typeBoosts)) {
        const entry = categoryScores.get(slug as CategorySlug);
        if (entry) {
          entry.score += boost;
          entry.signals.push(`content-type:${contentType}`);
        }
      }
    }
  }

  // ── 5. Engagement pattern signals ───────────────────────────────────
  if (opts.engagementSignals) {
    const engBoosts = computeEngagementCategoryBoost(post);
    for (const [slug, boost] of Object.entries(engBoosts)) {
      const entry = categoryScores.get(slug as CategorySlug);
      if (entry) {
        entry.score += boost;
        entry.signals.push('engagement-pattern');
      }
    }
  }

  // ── 6. Author bio signals ───────────────────────────────────────────
  if (opts.authorBioSignals && post.author.bio) {
    const bio = post.author.bio.toLowerCase();
    for (const [slug, keywords] of Object.entries(BIO_CATEGORY_KEYWORDS)) {
      const matches = keywords.filter((kw) => bio.includes(kw)).length;
      if (matches > 0) {
        const entry = categoryScores.get(slug as CategorySlug);
        if (entry) {
          entry.score += matches * 0.05;
          entry.signals.push('author-bio');
        }
      }
    }
  }

  // ── 7. Apply conflict penalties ─────────────────────────────────────
  let scored = Array.from(categoryScores.entries())
    .map(([slug, data]) => ({ slug, confidence: Math.min(data.score, 1.0), signals: data.signals }))
    .filter((c) => c.confidence > 0.05)
    .sort((a, b) => b.confidence - a.confidence);

  for (const [catA, catB, penalty] of CATEGORY_OVERLAP_SIMILARITY) {
    const aIdx = scored.findIndex((c) => c.slug === catA);
    const bIdx = scored.findIndex((c) => c.slug === catB);
    if (aIdx >= 0 && bIdx >= 0) {
      const a = scored[aIdx]!;
      const b = scored[bIdx]!;
      const lowerIdx = a.confidence <= b.confidence ? aIdx : bIdx;
      const lower = scored[lowerIdx]!;
      scored[lowerIdx] = {
        ...lower,
        confidence: Math.max(0.05, lower.confidence - penalty),
        signals: [...lower.signals, `overlap-penalty:${catA}-${catB}`],
      };
    }
  }

  for (const [catA, catB] of CATEGORY_CONFLICTS) {
    const aIdx = scored.findIndex((c) => c.slug === catA);
    const bIdx = scored.findIndex((c) => c.slug === catB);
    if (aIdx >= 0 && bIdx >= 0) {
      const a = scored[aIdx]!;
      const b = scored[bIdx]!;
      if (a.confidence > 0.3 && b.confidence > 0.3) {
        const demoteIdx = a.confidence < b.confidence ? aIdx : bIdx;
        const toDemote = scored[demoteIdx]!;
        scored[demoteIdx] = { ...toDemote, confidence: toDemote.confidence * 0.3, signals: [...toDemote.signals, `conflict-demote:${catA}-${catB}`] };
      }
    }
  }

  scored.sort((a, b) => b.confidence - a.confidence);

  // ── 8. Select top N ────────────────────────────────────────────────
  const maxCats = opts.maxCategories ?? 3;
  const minSecondary = opts.minSecondaryConfidence ?? 0.15;
  const selected: CategoryAssignment[] = [];

  for (const c of scored) {
    if (selected.length === 0) {
      selected.push(c);
    } else if (selected.length < maxCats && c.confidence >= minSecondary) {
      selected.push(c);
    } else {
      break;
    }
  }

  if (selected.length === 0) {
    selected.push({ slug: 'general' as CategorySlug, confidence: 0.5, signals: ['fallback'] });
  }

  return {
    categories: selected,
    primary: selected[0]?.slug ?? null,
    secondary: selected[1]?.slug ?? null,
    tertiary: selected[2]?.slug ?? null,
    primaryCategory: selected[0]?.slug ?? 'general',
  };
}

// ─── Trending Categories ───────────────────────────────────────────────

export interface TrendingCategory {
  slug: CategorySlug;
  label: string;
  emoji: string;
  postCount: number;
  avgConfidence: number;
  growthRate: number;
}

/**
 * Compute trending categories from a set of classified posts.
 */
export function computeTrendingCategories(
  classified: Array<{ categories: CategoryAssignment[] }>,
  previousWindow?: Array<{ slug: CategorySlug }>,
): TrendingCategory[] {
  const counts = new Map<CategorySlug, { count: number; totalConfidence: number }>();

  for (const { categories } of classified) {
    for (const cat of categories) {
      const existing = counts.get(cat.slug) ?? { count: 0, totalConfidence: 0 };
      existing.count++;
      existing.totalConfidence += cat.confidence;
      counts.set(cat.slug, existing);
    }
  }

  const prevCounts = new Map<CategorySlug, number>();
  if (previousWindow) {
    for (const { slug } of previousWindow) {
      prevCounts.set(slug, (prevCounts.get(slug) ?? 0) + 1);
    }
  }

  const trends: TrendingCategory[] = [];
  for (const [slug, data] of counts) {
    const catDef = CATEGORIES[slug];
    const prevCount = prevCounts.get(slug) ?? 0;
    const growthRate = prevCount > 0 ? ((data.count - prevCount) / prevCount) * 100 : data.count > 0 ? 50 : 0;

    trends.push({
      slug,
      label: catDef?.label ?? slug,
      emoji: catDef?.emoji ?? '📌',
      postCount: data.count,
      avgConfidence: data.count > 0 ? data.totalConfidence / data.count : 0,
      growthRate,
    });
  }

  trends.sort((a, b) => {
    const aScore = a.postCount * (1 + a.avgConfidence) * (1 + Math.max(0, a.growthRate) / 100);
    const bScore = b.postCount * (1 + b.avgConfidence) * (1 + Math.max(0, b.growthRate) / 100);
    return bScore - aScore;
  });

  return trends;
}

// ─── User Correction Feedback ─────────────────────────────────────────

export class CategorizationFeedbackStore {
  private feedback: Map<string, CategorizationFeedback> = new Map();
  private correctionCounts: Map<CategorySlug, number> = new Map();
  private userCorrections: Map<string, Map<CategorySlug, number>> = new Map();

  recordFeedback(feedback: CategorizationFeedback): void {
    this.feedback.set(feedback.postId, feedback);
    this.correctionCounts.clear();
    this.userCorrections.clear();

    for (const cat of feedback.categories) {
      this.correctionCounts.set(cat, (this.correctionCounts.get(cat) ?? 0) + 1);
    }

    const userKey = feedback.userId;
    const userCats = this.userCorrections.get(userKey) ?? new Map();
    for (const cat of feedback.categories) {
      userCats.set(cat, (userCats.get(cat) ?? 0) + 1);
    }
    this.userCorrections.set(userKey, userCats);
  }

  getCorrection(postId: string): CategorizationFeedback | undefined {
    return this.feedback.get(postId);
  }

  getCategoryAdjustment(slug: CategorySlug): number {
    const correctionCount = this.correctionCounts.get(slug) ?? 0;
    if (correctionCount > 100) return 1.15;
    if (correctionCount > 50) return 1.1;
    if (correctionCount > 10) return 1.05;
    return 1.0;
  }

  getUserCategoryPrefs(userId: string): Map<CategorySlug, number> {
    return this.userCorrections.get(userId) ?? new Map();
  }

  pruneOlderThan(timestamp: number): void {
    for (const [postId, feedback] of this.feedback) {
      if (feedback.timestamp < timestamp) {
        this.feedback.delete(postId);
      }
    }
    this.correctionCounts.clear();
    this.userCorrections.clear();
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

function buildClassificationText(post: UnifiedPost): string {
  const parts: string[] = [post.text, post.html ?? '', post.author.displayName, post.author.bio];
  for (const e of post.embeds) {
    parts.push(e.url);
    if (e.meta) {
      if (typeof e.meta.title === 'string') parts.push(e.meta.title);
      if (typeof e.meta.description === 'string') parts.push(e.meta.description);
    }
  }
  return parts.join(' ').toLowerCase();
}

const STEM_SUFFIXES = [
  'ing', 'ed', 'es', 's', 'ly', 'ment', 'tion', 'ness', 'ful',
  'less', 'able', 'ible', 'al', 'ive', 'ous', 'ize', 'ise', 'er', 'est', 'ity',
];

function stemWord(word: string): string {
  let s = word.toLowerCase();
  if (s.length <= 3) return s;
  for (const suffix of STEM_SUFFIXES) {
    if (s.endsWith(suffix) && s.length - suffix.length >= 3) {
      s = s.slice(0, -suffix.length);
      break;
    }
  }
  return s;
}

function keywordMatches(text: string, keyword: string): boolean {
  if (text.includes(keyword)) return true;
  const stemmedKw = stemWord(keyword);
  const words = text.split(/\s+/);
  for (const w of words) {
    if (stemWord(w) === stemmedKw) return true;
  }
  return false;
}

function detectSimpleContentType(post: UnifiedPost): string {
  const hasVideo = post.embeds.some((e) => e.kind === 'video');
  if (hasVideo) return 'video';
  const hasImage = post.embeds.some((e) => e.kind === 'image');
  if (hasImage) return 'image';
  const textLen = post.text.trim().length;
  if (textLen > 500 && post.embeds.length === 0) return 'article';
  if (post.embeds.some((e) => e.kind === 'link') && textLen < 100) return 'link';
  if (textLen > 200 && post.embeds.some((e) => e.kind === 'link')) return 'article';
  return 'text';
}

function computeEngagementCategoryBoost(post: UnifiedPost): Partial<Record<CategorySlug, number>> {
  const boosts: Partial<Record<CategorySlug, number>> = {};
  const total = post.metrics.likes + post.metrics.reposts + post.metrics.replies + (post.metrics.quotes ?? 0);
  if (total === 0) return {};

  const replyRatio = post.metrics.replies / total;
  const likeRatio = post.metrics.likes / total;
  const quoteRatio = (post.metrics.quotes ?? 0) / total;

  if (replyRatio > 0.4) { boosts['news'] = 0.15; boosts['regulation'] = 0.1; }
  if (likeRatio > 0.7) { boosts['memes'] = 0.1; boosts['nft'] = 0.1; }
  if (quoteRatio > 0.2) boosts['news'] = 0.1;

  return boosts;
}
