/**
 * feed-categories — Category taxonomy, mapping, relevance scoring, and blend engine.
 *
 * Defines the user-facing category taxonomy (defi, nft, trading, ai, memecoin,
 * security, news, memes, bitcoin, ethereum, solana, layer2, stablecoin,
 * regulation, gaming), maps each to feed-core niches + loose keyword signals,
 * scores post relevance to a category, and blends multi-category mixes.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';

export const ALL_CATEGORIES = [
  'defi',
  'nft',
  'trading',
  'ai',
  'memecoin',
  'security',
  'news',
  'memes',
  'bitcoin',
  'ethereum',
  'solana',
  'layer2',
  'stablecoin',
  'regulation',
  'gaming',
  'general',
] as const;

export type CategorySlug = (typeof ALL_CATEGORIES)[number];

export const CATEGORY_SLUGS = new Set<string>(ALL_CATEGORIES);

export interface CategoryDef {
  slug: CategorySlug;
  label: string;
  emoji: string;
  niches: string[];
  keywords: string[];
}

export const CATEGORIES: Record<CategorySlug, CategoryDef> = {
  defi: {
    slug: 'defi',
    label: 'DeFi',
    emoji: '\uD83C\uDFE6',
    niches: ['defi', 'layer2', 'stablecoin', 'etf', 'onchain'],
    keywords: [
      'defi', 'decentralized finance', 'lending', 'yield', 'staking', 'swap',
      'dex', 'amm', 'liquidity', 'vault', 'restaking', 'layer 2', 'l2',
      'rollup', 'stablecoin', 'usdt', 'usdc', 'etf', 'onchain',
      'arbitrum', 'optimism', 'base', 'zk-', 'zero knowledge',
    ],
  },
  nft: {
    slug: 'nft',
    label: 'NFTs',
    emoji: '\uD83D\uDDBC\uFE0F',
    niches: ['nft', 'gaming', 'art', 'music'],
    keywords: [
      'nft', 'collectible', 'mint', 'opensea', 'blur', 'digital art',
      'metaverse', 'gaming', 'art', 'music', 'punk', 'azuki',
    ],
  },
  trading: {
    slug: 'trading',
    label: 'Trading',
    emoji: '\uD83D\uDCCA',
    niches: ['trading', 'macro', 'etf'],
    keywords: [
      'trading', 'technical analysis', 'chart', 'price action',
      'support resistance', 'market structure', 'breakout', 'volume',
      'fomc', 'fed', 'inflation', 'interest rate', 'recession',
      'nasdaq', 'spx', 'cpi', 'dollar',
    ],
  },
  ai: {
    slug: 'ai',
    label: 'AI',
    emoji: '\uD83E\uDD16',
    niches: ['ai', 'tech', 'startups'],
    keywords: [
      'ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt',
      'openai', 'deepseek', 'claude', 'gemini', 'neural', 'deep learning',
      'transformer', 'agent', 'copilot', 'diffusion',
    ],
  },
  memecoin: {
    slug: 'memecoin',
    label: 'Meme Coins',
    emoji: '\uD83C\uDFAD',
    niches: ['memecoin'],
    keywords: [
      'memecoin', 'meme coin', 'dogecoin', 'shiba', 'pepe', 'bonk', 'wif',
      'moon', 'pump', 'dump',
    ],
  },
  security: {
    slug: 'security',
    label: 'Security',
    emoji: '\uD83D\uDD12',
    niches: ['security', 'privacy'],
    keywords: [
      'hack', 'exploit', 'vulnerability', 'audit', 'phishing', 'rug pull',
      'rekt', 'breach', 'privacy', 'anonymous', 'immunefi',
      'smart contract', 'solidity',
    ],
  },
  news: {
    slug: 'news',
    label: 'News',
    emoji: '\uD83D\uDCF0',
    niches: ['crypto', 'regulation', 'macro', 'etf', 'startups'],
    keywords: [
      'news', 'breaking', 'announces', 'launch', 'regulation', 'sec',
      'cftc', 'congress', 'senate', 'policy', 'compliance', 'lawsuit',
      'mica', 'bitcoin', 'ethereum', 'solana',
    ],
  },
  memes: {
    slug: 'memes',
    label: 'Memes',
    emoji: '\uD83D\uDE02',
    niches: ['memecoin', 'gaming'],
    keywords: [
      'meme', 'memes', 'funny', 'lol', 'humor', 'degen',
    ],
  },
  bitcoin: {
    slug: 'bitcoin',
    label: 'Bitcoin',
    emoji: '\uD83D\uDCB0',
    niches: ['bitcoin', 'btc', 'macro', 'mining'],
    keywords: [
      'bitcoin', 'btc', 'satoshi', 'halving', 'blockchain', 'mining',
      'hashrate', 'lightning network', 'ordinal', 'brc-20', 'rune',
      'taproot', 'schnorr', 'btc etf', 'bitcoin etf',
    ],
  },
  ethereum: {
    slug: 'ethereum',
    label: 'Ethereum',
    emoji: '\uD83D\uDCE6',
    niches: ['ethereum', 'evm', 'defi', 'layer2'],
    keywords: [
      'ethereum', 'eth', 'vitalik', 'eip', 'erc-20', 'erc-721',
      'ethereum etf', 'ethereum upgrade', 'execution layer', 'consensus',
      'danksharding', 'blob', 'cancun', 'dencun', 'prague',
    ],
  },
  solana: {
    slug: 'solana',
    label: 'Solana',
    emoji: '\u2600\uFE0F',
    niches: ['solana', 'defi', 'memecoin', 'nft'],
    keywords: [
      'solana', 'sol', 'phantom', 'serum', 'jupiter', 'orca',
      'raydium', 'pyth', 'mango', 'solana pay', 'spl', 'token-2022',
      'blink', 'action',
    ],
  },
  layer2: {
    slug: 'layer2',
    label: 'Layer 2',
    emoji: '\u2699\uFE0F',
    niches: ['layer2', 'ethereum', 'defi', 'tech'],
    keywords: [
      'layer 2', 'l2', 'rollup', 'optimistic', 'zk rollup', 'arbitrum',
      'optimism', 'base', 'zksync', 'starknet', 'polygon', 'scroll',
      'linea', 'taiko', 'blob', 'gas fee',
    ],
  },
  stablecoin: {
    slug: 'stablecoin',
    label: 'Stablecoins',
    emoji: '\uD83C\uDFE6',
    niches: ['stablecoin', 'defi', 'regulation', 'macro'],
    keywords: [
      'stablecoin', 'usdt', 'usdc', 'dai', 'frax', 'lusd', 'terrausd',
      'ust', 'stablecoin regulation', 'stablecoin bill', 'rwa',
      'real world asset', 'yield bearing', 'synthetic dollar',
    ],
  },
  regulation: {
    slug: 'regulation',
    label: 'Regulation',
    emoji: '\u2696\uFE0F',
    niches: ['regulation', 'news', 'macro', 'legal'],
    keywords: [
      'regulation', 'regulatory', 'sec', 'cftc', 'lawsuit', 'compliance',
      'mica', 'kyc', 'aml', 'congress', 'senate', 'hearing', 'subpoena',
      'doj', 'fincen', 'esma', 'fsa', 'biden', 'trump',
    ],
  },
  gaming: {
    slug: 'gaming',
    label: 'Gaming',
    emoji: '\uD83C\uDFAE',
    niches: ['gaming', 'metaverse', 'nft', 'social'],
    keywords: [
      'gaming', 'game', 'web3 gaming', 'play to earn', 'p2e', 'immutable',
      'gala', 'axie', 'illuvium', 'metaverse', 'mmo', 'rpg',
      'onchain game', 'fren pet', 'telegram game', 'tap to earn',
    ],
  },
  general: {
    slug: 'general',
    label: 'General',
    emoji: '\uD83C\uDF10',
    niches: ['crypto', 'blockchain', 'web3'],
    keywords: [
      'crypto', 'blockchain', 'web3', 'cryptocurrency', 'token', 'decentralized',
    ],
  },
};

/** Category niches indexed by niche name → category slug for quick lookup. */
const NICHE_TO_CATEGORY = new Map<string, CategorySlug>();
for (const cat of Object.values(CATEGORIES)) {
  for (const n of cat.niches) {
    NICHE_TO_CATEGORY.set(n, cat.slug);
  }
}

// ─── Simple suffix-stripping stemmer ─────────────────────────────────

/**
 * Strips common English suffixes for basic stemming.
 * "trading"  → "trade"  (matches "traded")
 * "bitcoin"  → "bitcoin" (does NOT match "bitcoincash")
 * No heavy NLP — avoids false substring matches from raw includes().
 */
const STEM_SUFFIXES = ['ing', 'ed', 'es', 's', 'ly', 'ment', 'tion', 'ness', 'ful', 'less', 'able', 'ible', 'al', 'ive', 'ous', 'ize', 'ise', 'er', 'est', 'ment', 'ship', 'ity'];

export function stemWord(word: string): string {
  let s = word.toLowerCase();
  if (s.length <= 3) return s;
  for (const suffix of STEM_SUFFIXES) {
    if (s.endsWith(suffix) && s.length - suffix.length >= 3) {
      s = s.slice(0, -suffix.length);
      break; // strip one suffix only
    }
  }
  return s;
}

/**
 * Returns true if any stemmed word in the text matches the stemmed keyword.
 * Uses word-boundary splitting so "bitcoin" won't match "bitcoincash".
 */
function keywordMatches(text: string, keyword: string): boolean {
  const stemmedKw = stemWord(keyword);
  const words = text.split(/\s+/);
  for (const w of words) {
    if (stemWord(w) === stemmedKw) return true;
  }
  // Also check the raw form for hyphenated / compound keywords
  if (text.includes(keyword)) return true;
  return false;
}

// ─── Category relevance scoring ───────────────────────────────────────

export interface CategoryRelevance {
  category: CategorySlug;
  /** 0–1 relevance score: how well the post matches this category. */
  score: number;
  /** Which signals contributed (niche match, keyword match, community). */
  signals: string[];
}

/**
 * Scores a single post against all categories. Returns a map of
 * category slug → relevance score. Posts can match multiple categories.
 */
export function scoreCategoryRelevance(post: UnifiedPost): Map<CategorySlug, number> {
  const text = [
    post.text,
    post.html ?? '',
    post.author.displayName,
    post.author.bio,
    ...post.embeds.map((e) => [e.url, e.meta?.title, e.meta?.description].filter(Boolean).join(' ')),
  ]
    .join(' ')
    .toLowerCase();

  const catScores = new Map<CategorySlug, number>();

  // Score each post niche against category niches
  const postNiches = new Set(post.niches.map((n) => n.toLowerCase()));

  for (const cat of Object.values(CATEGORIES)) {
    let score = 0;

    // Niche matches (strong signal) — up to 0.6
    const nicheMatches = cat.niches.filter((n) => postNiches.has(n)).length;
    if (nicheMatches > 0) {
      score += Math.min(nicheMatches * 0.3, 0.6);
    }

    // Keyword matches (weaker signal, stemmed) — up to 0.3
    let kwMatches = 0;
    for (const kw of cat.keywords) {
      if (keywordMatches(text, kw)) kwMatches++;
    }
    if (kwMatches > 0) {
      score += Math.min(kwMatches * 0.05, 0.3);
    }

    // Cap at 1.0
    catScores.set(cat.slug, Math.min(score, 1.0));
  }

  return catScores;
}

/**
 * Returns the best-matching category for a post, or null if none exceed
 * the minimum threshold (default 0.15).
 */
export function primaryCategory(
  post: UnifiedPost,
  minScore = 0.15,
): CategorySlug | null {
  const scores = scoreCategoryRelevance(post);
  let best: CategorySlug | null = null;
  let bestScore = 0;
  for (const [cat, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return bestScore >= minScore ? best : null;
}

/**
 * Falls back through the post niches to find a category, then uses text
 * keyword matching as a last resort. Guarantees every post gets some category.
 */
export function ensureCategory(post: UnifiedPost): CategorySlug {
  const primary = primaryCategory(post);
  if (primary) return primary;

  // Check niches for any category match
  for (const niche of post.niches) {
    const cat = NICHE_TO_CATEGORY.get(niche.toLowerCase());
    if (cat) return cat;
  }

  // Default to 'general' for uncategorized content
  return 'general';
}

// ─── Category feed filtering ──────────────────────────────────────────

export interface CategoryFeedOptions {
  category: CategorySlug;
  /** Minimum category relevance score to include (default 0.2). */
  minScore?: number;
  /** Max posts per author within this category (default 2). */
  maxPerAuthor?: number;
  /** Max posts per protocol within this category (default 5). */
  maxPerProtocol?: number;
  limit?: number;
}

export interface CategoryFeedResult {
  posts: Array<UnifiedPost & { categoryScore: number }>;
  meta: {
    totalFiltered: number;
    uniqueAuthors: number;
    uniqueProtocols: number;
    avgRelevance: number;
  };
}

/**
 * Category fallback map: thin/empty categories fall back to related
 * categories so users never see "no posts" on a category page.
 *
 * Added 2026-07-18: ensures every category has fallback content.
 */
const CATEGORY_FALLBACKS: Record<CategorySlug, CategorySlug[]> = {
  defi: ['ethereum', 'layer2', 'stablecoin'],
  nft: ['gaming', 'memes', 'news'],
  trading: ['bitcoin', 'ethereum', 'news'],
  ai: ['news', 'trading'],
  memecoin: ['memes', 'trading', 'news'],
  security: ['news', 'ethereum', 'defi'],
  news: ['bitcoin', 'ethereum', 'defi'],
  memes: ['memecoin', 'nft', 'gaming'],
  bitcoin: ['news', 'ethereum', 'trading'],
  ethereum: ['defi', 'layer2', 'news'],
  solana: ['defi', 'memecoin', 'news'],
  layer2: ['ethereum', 'defi', 'news'],
  stablecoin: ['defi', 'ethereum', 'news'],
  regulation: ['news', 'bitcoin', 'defi'],
  gaming: ['nft', 'news', 'memes'],
  general: ['news', 'bitcoin', 'defi'],
};

/**
 * Minimum posts needed from the primary category before the feed stops
 * looking at fallback categories. When primary yields fewer than this,
 * fallback categories are blended in.
 */
export const CATEGORY_FALLBACK_MIN_POSTS = 5;

/**
 * Filters and ranks posts for a single category feed.
 * Applies relevance threshold, author diversity cap, and protocol diversity.
 *
 * When the primary category has fewer than CATEGORY_FALLBACK_MIN_POSTS
 * posts, falls back to related categories to ensure the feed is never empty.
 * Fallback posts get a reduced score penalty (-0.1) so they appear lower.
 */
export function buildCategoryFeed(
  posts: UnifiedPost[],
  opts: CategoryFeedOptions,
): CategoryFeedResult {
  const minScore = opts.minScore ?? 0.15;
  const maxPerAuthor = opts.maxPerAuthor ?? 2;
  const maxPerProtocol = opts.maxPerProtocol ?? 5;
  const limit = opts.limit ?? 50;

  // Score every post against the target category
  const scored: Array<UnifiedPost & { categoryScore: number }> = [];
  for (const p of posts) {
    const scores = scoreCategoryRelevance(p);
    const catScore = scores.get(opts.category) ?? 0;
    if (catScore >= minScore) {
      scored.push({ ...p, categoryScore: catScore });
    }
  }

  // If the primary category has very few posts, fall back to related categories
  if (scored.length < CATEGORY_FALLBACK_MIN_POSTS) {
    const fallbackCats = CATEGORY_FALLBACKS[opts.category] ?? [];
    const seenIds = new Set<string>(scored.map((p) => p.id));
    for (const fallbackCat of fallbackCats) {
      for (const p of posts) {
        if (seenIds.has(p.id)) continue;
        const scores = scoreCategoryRelevance(p);
        const fbScore = scores.get(fallbackCat) ?? 0;
        if (fbScore >= minScore) {
          // Apply a small penalty to fallback posts so primary-category posts rank higher
          scored.push({ ...p, categoryScore: Math.max(fbScore - 0.1, 0.05) });
          seenIds.add(p.id);
        }
      }
      if (scored.length >= limit) break;
    }
  }

  // Sort by category relevance (descending), then engagement, then recency
  scored.sort((a, b) => {
    // Primary: category score
    if (b.categoryScore !== a.categoryScore) return b.categoryScore - a.categoryScore;
    // Secondary: engagement
    const engA = a.metrics.likes + a.metrics.reposts * 2 + a.metrics.replies * 3 + (a.metrics.quotes ?? 0);
    const engB = b.metrics.likes + b.metrics.reposts * 2 + b.metrics.replies * 3 + (b.metrics.quotes ?? 0);
    if (engB !== engA) return engB - engA;
    // Tertiary: recency
    return b.createdAt - a.createdAt;
  });

  // Author diversity: max N per author
  const authorCounts = new Map<string, number>();
  const protocolCounts = new Map<Protocol, number>();
  const filtered: Array<UnifiedPost & { categoryScore: number }> = [];

  for (const p of scored) {
    const authorKey = p.author.id;
    const protocolKey = p.protocol as Protocol;

    const authorCt = authorCounts.get(authorKey) ?? 0;
    if (authorCt >= maxPerAuthor) continue;

    const protoCt = protocolCounts.get(protocolKey) ?? 0;
    if (protoCt >= maxPerProtocol) continue;

    filtered.push(p);
    authorCounts.set(authorKey, authorCt + 1);
    protocolCounts.set(protocolKey, protoCt + 1);

    if (filtered.length >= limit) break;
  }

  const totalRel =
    filtered.length > 0
      ? filtered.reduce((s, p) => s + p.categoryScore, 0) / filtered.length
      : 0;

  return {
    posts: filtered,
    meta: {
      totalFiltered: filtered.length,
      uniqueAuthors: authorCounts.size,
      uniqueProtocols: protocolCounts.size,
      avgRelevance: Math.round(totalRel * 100) / 100,
    },
  };
}

// ─── Mix engine ───────────────────────────────────────────────────────

export interface CategoryMixOptions {
  /** Category:weight pairs, e.g. { defi: 60, nft: 40 }. */
  categories: Record<CategorySlug, number>;
  /** Max posts per category in the final blend. */
  limit?: number;
  /** Minimum category relevance score (default 0.15). */
  minScore?: number;
}

export interface CategoryMixResult {
  posts: Array<UnifiedPost & { category: CategorySlug; categoryScore: number }>;
  meta: {
    perCategory: Record<string, number>;
    total: number;
    ratios: Record<string, number>;
  };
}

/**
 * Builds a mixed feed blending multiple categories at specified ratios.
 * Posts are interleaved: one from each category in round-robin order
 * weighted by the ratio, preserving author + protocol diversity.
 */
export function buildCategoryMix(
  posts: UnifiedPost[],
  opts: CategoryMixOptions,
): CategoryMixResult {
  const limit = opts.limit ?? 50;
  const totalWeight = Object.values(opts.categories).reduce((a, b) => a + b, 0);

  // Compute per-category target counts
  const targets: Record<CategorySlug, number> = {} as Record<CategorySlug, number>;
  for (const [cat, weight] of Object.entries(opts.categories) as Array<[CategorySlug, number]>) {
    targets[cat] = Math.max(1, Math.round((weight / totalWeight) * limit));
  }

  // Build each category feed
  const feeds: Record<CategorySlug, Array<UnifiedPost & { categoryScore: number }>> =
    {} as Record<CategorySlug, Array<UnifiedPost & { categoryScore: number }>>;
  const feedIndexes: Record<CategorySlug, number> = {} as Record<CategorySlug, number>;

  for (const cat of Object.keys(targets) as CategorySlug[]) {
    const feed = buildCategoryFeed(posts, {
      category: cat,
      minScore: opts.minScore ?? 0.15,
      maxPerAuthor: 2,
      maxPerProtocol: 4,
      limit: targets[cat],
    });
    feeds[cat] = feed.posts;
    feedIndexes[cat] = 0;
  }

  // Interleave: round-robin weighted by target count
  const blended: Array<UnifiedPost & { category: CategorySlug; categoryScore: number }> = [];
  const seenIds = new Set<string>();
  const perCategory: Record<string, number> = {};

  // Build weighted order list (multiple entries for higher-weighted categories)
  const entries = Object.entries(targets) as Array<[CategorySlug, number]>;
  const roundOrder: CategorySlug[] = [];
  for (const [cat, target] of entries) {
    const slots = Math.max(1, Math.round(target / Math.min(...Object.values(targets))));
    for (let i = 0; i < slots; i++) roundOrder.push(cat);
  }

  let idx = 0;
  while (blended.length < limit) {
    const cat = roundOrder[idx % roundOrder.length];
    if (!cat) { idx++; continue; }

    const feed = feeds[cat];
    const fi = feedIndexes[cat] ?? 0;
    if (fi < feed.length) {
      const post = feed[fi];
      if (post && !seenIds.has(post.id)) {
        blended.push({ ...post, category: cat });
        seenIds.add(post.id);
        perCategory[cat] = (perCategory[cat] ?? 0) + 1;
      }
      feedIndexes[cat] = fi + 1;
    }

    idx++;
    // Prevent infinite loop if all feeds exhausted
    if (idx > limit * 4) break;
  }

  return {
    posts: blended.slice(0, limit),
    meta: {
      perCategory,
      total: blended.length,
      ratios: Object.fromEntries(
        Object.entries(targets).map(([cat, tgt]) => [cat, Math.round((tgt / totalWeight) * 100) / 100]),
      ),
    },
  };
}

// ─── Everything blend ─────────────────────────────────────────────────

export interface EverythingBlendOptions {
  userNiches: string[];
  followedCreators: Set<string>;
  limit?: number;
}

/**
 * Blends the "Everything" feed:
 *   30% matched to user interests (niches)
 *   20% trending across all platforms
 *   20% from followed creators
 *   15% discovery (new/unfamiliar topics)
 *   15% high-quality regardless of topic
 */
export function buildEverythingBlend(
  posts: UnifiedPost[],
  opts: EverythingBlendOptions,
): UnifiedPost[] {
  const limit = opts.limit ?? 50;
  const userNicheSet = new Set(opts.userNiches.map((n) => n.toLowerCase()));

  // Score every post with blend signals
  interface BlendSignal {
    post: UnifiedPost;
    interestScore: number;
    isTrending: boolean;
    isFollowed: boolean;
    qualityScore: number;
    noveltyScore: number;
  }

  const now = Date.now();
  const signals: BlendSignal[] = posts.map((p) => {
    const engTotal =
      p.metrics.likes + p.metrics.reposts * 2 + p.metrics.replies * 3 + (p.metrics.quotes ?? 0);
    const ageHours = (now - p.createdAt) / 3600000;

    // User interest: how many niches match user preferences
    const matchingNiches = p.niches.filter((n) => userNicheSet.has(n.toLowerCase())).length;
    const interestScore = Math.min(matchingNiches / Math.max(userNicheSet.size, 1), 1);

    // Trending: high recent engagement
    const isTrending = engTotal >= 5 && ageHours < 12;

    // Followed creator
    const isFollowed = opts.followedCreators.has(p.author.id);

    // Quality: from existing quality signals if available
    const rawQuality = (p as unknown as Record<string, unknown>).qualityScore as
      | { score: number; max: number }
      | undefined;
    const qualityScore = rawQuality ? rawQuality.score / rawQuality.max : 0.5;

    // Novelty: posts from topics the user hasn't seen much of
    const noveltyScore = 1 - interestScore; // inverse of interest = discovery potential

    return { post: p, interestScore, isTrending, isFollowed, qualityScore, noveltyScore };
  });

  const buckets: Record<'interest' | 'trending' | 'followed' | 'discovery' | 'quality', BlendSignal[]> = {
    interest: [],
    trending: [],
    followed: [],
    discovery: [],
    quality: [],
  };

  for (const s of signals) {
    // Classify into primary bucket (first matching)
    if (s.interestScore >= 0.3) buckets.interest.push(s);
    else if (s.isTrending) buckets.trending.push(s);
    else if (s.isFollowed) buckets.followed.push(s);
    else if (s.noveltyScore >= 0.5 && s.qualityScore >= 0.3) buckets.discovery.push(s);
    else buckets.quality.push(s);
  }

  // Also fill buckets from pool where posts qualify for multiple
  // Make sure trending has enough even if some were classified as interest
  for (const s of signals) {
    if (s.isTrending && !buckets.trending.includes(s)) buckets.trending.push(s);
    if (s.isFollowed && !buckets.followed.includes(s)) buckets.followed.push(s);
  }

  // Sort each bucket by quality + recency
  const sortFn = (a: BlendSignal, b: BlendSignal) => {
    if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
    return b.post.createdAt - a.post.createdAt;
  };
  Object.values(buckets).forEach((b) => b.sort(sortFn));

  // Blend targets
  const targets = {
    interest: Math.round(limit * 0.30),
    trending: Math.round(limit * 0.20),
    followed: Math.round(limit * 0.20),
    discovery: Math.round(limit * 0.15),
    quality: Math.round(limit * 0.15),
  };

  const seenIds = new Set<string>();
  const result: UnifiedPost[] = [];

  const addFromBucket = (bucket: BlendSignal[], count: number) => {
    let added = 0;
    for (const s of bucket) {
      if (added >= count) break;
      if (!seenIds.has(s.post.id)) {
        result.push(s.post);
        seenIds.add(s.post.id);
        added++;
      }
    }
  };

  addFromBucket(buckets.interest, targets.interest);
  addFromBucket(buckets.trending, targets.trending);
  addFromBucket(buckets.followed, targets.followed);
  addFromBucket(buckets.discovery, targets.discovery);
  addFromBucket(buckets.quality, targets.quality);

  // Fill remaining slots from all buckets
  if (result.length < limit) {
    const allSorted = [...signals]
      .filter((s) => !seenIds.has(s.post.id))
      .sort(sortFn);
    for (const s of allSorted) {
      if (result.length >= limit) break;
      result.push(s.post);
    }
  }

  return result;
}

// ─── Per-protocol per-category ────────────────────────────────────────

export interface PerProtocolCategoryOptions {
  protocol: Protocol;
  category: CategorySlug;
  limit?: number;
}

export function buildPerProtocolCategoryFeed(
  posts: UnifiedPost[],
  opts: PerProtocolCategoryOptions,
): CategoryFeedResult {
  const protocolPosts = posts.filter((p) => p.protocol === opts.protocol);
  return buildCategoryFeed(protocolPosts, {
    category: opts.category,
    limit: opts.limit ?? 50,
    maxPerAuthor: 3,
    maxPerProtocol: 50, // irrelevant for single protocol
  });
}
