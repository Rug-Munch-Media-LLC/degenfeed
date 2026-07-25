/**
 * topic-modeler — Intelligent topic categorization and classification engine.
 *
 * Assigns hierarchical categories to news stories using keyword matching,
 * source-based categorization, content-based TF-IDF-like scoring, and
 * cross-reference boosting.
 *
 * Category hierarchy:
 *   Crypto → Bitcoin / Ethereum (DeFi / NFTs / Layer 2) / Solana / Regulation / Mining
 *   Tech   → AI / Web3 / Privacy / Infrastructure
 *   Finance → Markets / Macro / Venture Capital / Trading
 *   Culture → NFTs & Art / Gaming / Music / Memes
 */

import { NICHE_KEYWORDS } from '@degenfeed/feed-core';
import type { AggregatedStory, StoryCluster } from './news-aggregator';

// ─── Category Hierarchy ──────────────────────────────────────────────────

export interface CategoryNode {
  id: string;
  label: string;
  emoji: string;
  children: CategoryNode[];
  keywords: string[];
  /** Source patterns: if a story comes from these sources, boost this category */
  sourcePatterns: string[];
  /** Parent category id */
  parentId: string | null;
}

export const CATEGORY_TREE: CategoryNode[] = [
  {
    id: 'crypto',
    label: 'Crypto',
    emoji: '₿',
    parentId: null,
    keywords: [
      'crypto',
      'cryptocurrency',
      'blockchain',
      'web3',
      'token',
      'altcoin',
      'digital asset',
    ],
    sourcePatterns: [
      'coindesk',
      'cointelegraph',
      'theblock',
      'decrypt',
      'blockworks',
      'cryptoslate',
    ],
    children: [
      {
        id: 'bitcoin',
        label: 'Bitcoin',
        emoji: '₿',
        parentId: 'crypto',
        keywords: ['bitcoin', 'btc', 'satoshi', 'halving', 'ordinal', 'lightning', 'bitcoin etf'],
        sourcePatterns: ['bitcoinmag', 'bitcoin magazine'],
        children: [],
      },
      {
        id: 'ethereum',
        label: 'Ethereum',
        emoji: '⟠',
        parentId: 'crypto',
        keywords: ['ethereum', 'eth', 'vitalik', 'eip-', 'ethereum foundation', 'ether'],
        sourcePatterns: ['weekinethereum', 'ethdaily'],
        children: [
          {
            id: 'defi',
            label: 'DeFi',
            emoji: '🏦',
            parentId: 'ethereum',
            keywords: [
              'defi',
              'lending',
              'yield',
              'liquidity',
              'amm',
              'dex',
              'swap',
              'staking',
              'restaking',
              'liquid staking',
              'lido',
              'aave',
              'compound',
              'uniswap',
              'curve',
            ],
            sourcePatterns: ['bankless', 'thedefiant', 'defiedge', 'defillama'],
            children: [],
          },
          {
            id: 'nft',
            label: 'NFTs',
            emoji: '🖼️',
            parentId: 'ethereum',
            keywords: [
              'nft',
              'nfts',
              'collectible',
              'opensea',
              'blur',
              'ens',
              'soulbound',
              'erc-721',
              'erc-1155',
              'pixel',
              'avatar',
            ],
            sourcePatterns: [],
            children: [],
          },
          {
            id: 'layer2',
            label: 'Layer 2',
            emoji: '⚡',
            parentId: 'ethereum',
            keywords: [
              'layer 2',
              'l2',
              'rollup',
              'arbitrum',
              'optimism',
              'base',
              'zk-',
              'zero knowledge',
              'validium',
              'optimistic',
              'zksync',
              'scroll',
              'linea',
            ],
            sourcePatterns: ['l2beat'],
            children: [],
          },
        ],
      },
      {
        id: 'solana',
        label: 'Solana',
        emoji: '◎',
        parentId: 'crypto',
        keywords: [
          'solana',
          'sol',
          'solana-based',
          'solana ecosystem',
          'jupiter',
          'raydium',
          'solana nft',
          'solana defi',
        ],
        sourcePatterns: [],
        children: [],
      },
      {
        id: 'regulation',
        label: 'Regulation',
        emoji: '⚖️',
        parentId: 'crypto',
        keywords: [
          'sec',
          'regulation',
          'mica',
          'cftc',
          'congress',
          'senate',
          'policy',
          'compliance',
          'kyl',
          'aml',
          'sanctions',
          'crypto law',
          'bitcoin etf approval',
        ],
        sourcePatterns: [],
        children: [],
      },
      {
        id: 'mining',
        label: 'Mining',
        emoji: '⛏️',
        parentId: 'crypto',
        keywords: [
          'mining',
          'miner',
          'hashrate',
          'proof of work',
          'pow',
          'asic',
          'pool',
          'bitcoin mining',
          'energy',
          'renewable mining',
        ],
        sourcePatterns: [],
        children: [],
      },
    ],
  },
  {
    id: 'tech',
    label: 'Tech',
    emoji: '💻',
    parentId: null,
    keywords: ['tech', 'technology', 'software', 'startup', 'engineering'],
    sourcePatterns: ['techcrunch', 'theverge'],
    children: [
      {
        id: 'ai',
        label: 'AI',
        emoji: '🤖',
        parentId: 'tech',
        keywords: [
          'ai',
          'artificial intelligence',
          'machine learning',
          'llm',
          'gpt',
          'openai',
          'anthropic',
          'deepseek',
          'gemini',
          'claude',
          'neural',
          'transformer',
        ],
        sourcePatterns: [],
        children: [],
      },
      {
        id: 'web3',
        label: 'Web3',
        emoji: '🌐',
        parentId: 'tech',
        keywords: ['web3', 'dapp', 'decentralized', 'protocol', 'governance', 'dao', 'tokenomics'],
        sourcePatterns: [],
        children: [],
      },
      {
        id: 'privacy',
        label: 'Privacy',
        emoji: '👁️',
        parentId: 'tech',
        keywords: [
          'privacy',
          'zero knowledge',
          'zk',
          'encryption',
          'anonymous',
          'tor',
          'mixer',
          'confidential',
          'secure enclave',
        ],
        sourcePatterns: [],
        children: [],
      },
      {
        id: 'infrastructure',
        label: 'Infrastructure',
        emoji: '🔧',
        parentId: 'tech',
        keywords: [
          'infrastructure',
          'validator',
          'node',
          'rpc',
          'network upgrade',
          'consensus',
          'scalability',
          'throughput',
          'gas',
          'fees',
        ],
        sourcePatterns: [],
        children: [],
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    emoji: '📊',
    parentId: null,
    keywords: ['finance', 'financial', 'market', 'economy', 'trading', 'investment'],
    sourcePatterns: [],
    children: [
      {
        id: 'markets',
        label: 'Markets',
        emoji: '📈',
        parentId: 'finance',
        keywords: [
          'market',
          'price',
          'trading',
          'btc price',
          'eth price',
          'market cap',
          'bull run',
          'bear market',
          'correction',
          'volatility',
        ],
        sourcePatterns: [],
        children: [],
      },
      {
        id: 'macro',
        label: 'Macro',
        emoji: '🏛️',
        parentId: 'finance',
        keywords: [
          'fed',
          'fomc',
          'inflation',
          'interest rate',
          'dollar',
          'recession',
          'nasdaq',
          'spx',
          'treasury',
          'yields',
          'gdp',
          'monetary policy',
        ],
        sourcePatterns: [],
        children: [],
      },
      {
        id: 'vc',
        label: 'Venture Capital',
        emoji: '💰',
        parentId: 'finance',
        keywords: [
          'venture capital',
          'vc',
          'fundraising',
          'seed round',
          'series a',
          'funding',
          'investor',
          'portfolio',
          'a16z',
          'paradigm',
          'multicoin',
        ],
        sourcePatterns: [],
        children: [],
      },
      {
        id: 'trading',
        label: 'Trading',
        emoji: '📊',
        parentId: 'finance',
        keywords: [
          'trading',
          'trader',
          'leverage',
          'futures',
          'options',
          'perpetuals',
          'liquidations',
          'long',
          'short',
          'margin',
          'order book',
          'candle',
        ],
        sourcePatterns: [],
        children: [],
      },
    ],
  },
  {
    id: 'culture',
    label: 'Culture',
    emoji: '🎭',
    parentId: null,
    keywords: ['culture', 'community', 'social', 'trend', 'viral'],
    sourcePatterns: [],
    children: [
      {
        id: 'nft-art',
        label: 'NFTs & Art',
        emoji: '🎨',
        parentId: 'culture',
        keywords: [
          'nft art',
          'generative art',
          'digital art',
          'artist',
          'collection',
          'art block',
          'creative',
          'gallery',
        ],
        sourcePatterns: [],
        children: [],
      },
      {
        id: 'gaming',
        label: 'Gaming',
        emoji: '🎮',
        parentId: 'culture',
        keywords: [
          'gaming',
          'gamefi',
          'play-to-earn',
          'web3 game',
          'metaverse',
          'guild',
          'game',
          'blockchain game',
        ],
        sourcePatterns: [],
        children: [],
      },
      {
        id: 'memes',
        label: 'Memes',
        emoji: '🐸',
        parentId: 'culture',
        keywords: [
          'meme',
          'memecoin',
          'pepe',
          'doge',
          'shiba',
          'bonk',
          'wif',
          'viral',
          'troll',
          'shitpost',
        ],
        sourcePatterns: [],
        children: [],
      },
    ],
  },
];

// ─── Flattened category lookup ─────────────────────────────────────────

function flattenCategories(nodes: CategoryNode[]): Map<string, CategoryNode> {
  const map = new Map<string, CategoryNode>();
  function walk(nodes: CategoryNode[]) {
    for (const node of nodes) {
      map.set(node.id, node);
      walk(node.children);
    }
  }
  walk(nodes);
  return map;
}

const CATEGORY_MAP = flattenCategories(CATEGORY_TREE);

// ─── Category Score Result ─────────────────────────────────────────────

export interface CategoryScore {
  categoryId: string;
  categoryLabel: string;
  emoji: string;
  score: number;
  confidence: number;
  signals: string[];
  parentId: string | null;
}

export interface ClassificationResult {
  primary: CategoryScore;
  all: CategoryScore[];
  breadcrumbs: Array<{ id: string; label: string; emoji: string }>;
}

// ─── TF-IDF-like Term Frequency Scoring ───────────────────────────────

const TERM_FREQUENCY_CACHE = new Map<string, Map<string, number>>();

function buildTermFrequency(text: string): Map<string, number> {
  const lower = text.toLowerCase();
  const words = lower.split(/\W+/).filter((w) => w.length > 2);
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }
  return freq;
}

function computeTfIdfScore(text: string, keywords: string[]): number {
  const freq = buildTermFrequency(text);
  let score = 0;
  const totalWords = Array.from(freq.values()).reduce((a, b) => a + b, 0);
  if (totalWords === 0) return 0;

  for (const keyword of keywords) {
    const termFreq = freq.get(keyword) ?? 0;
    if (termFreq > 0) {
      // Term frequency normalized by total words
      score += termFreq / totalWords;
    }
  }

  return score;
}

// ─── Main Classification Engine ────────────────────────────────────────

export interface ClassificationOptions {
  /** Enable cross-reference boost (when 3+ similar stories match same category) */
  enableCrossReference?: boolean;
  /** Cross-reference map: categoryId → count of similar stories */
  crossReferenceCounts?: Map<string, number>;
  /** Minimum confidence to assign a category */
  minConfidence?: number;
}

/**
 * Classify a news story into categories. Returns a primary category and
 * all scored categories.
 */
export function classifyStory(
  story: AggregatedStory,
  opts: ClassificationOptions = {},
): ClassificationResult {
  const text =
    `${story.title} ${story.summary} ${story.body} ${story.source} ${story.categories.join(' ')}`.toLowerCase();
  const scores: CategoryScore[] = [];
  const minConfidence = opts.minConfidence ?? 0.1;

  // Walk the entire category tree
  function walkTree(nodes: CategoryNode[], parentId: string | null) {
    for (const node of nodes) {
      let score = 0;
      const signals: string[] = [];

      // 1. Keyword matching (base layer)
      const keywordScore = computeTfIdfScore(text, node.keywords);
      if (keywordScore > 0) {
        score += keywordScore * 10;
        signals.push(`keyword:${keywordScore.toFixed(2)}`);
      }

      // 2. Source-based categorization
      for (const pattern of node.sourcePatterns) {
        if (story.source.toLowerCase().includes(pattern)) {
          score += 5;
          signals.push(`source:${pattern}`);
          break;
        }
      }

      // 3. Content-based: niche tags from existing feed-core
      const nicheKeywords = NICHE_KEYWORDS[node.id as keyof typeof NICHE_KEYWORDS];
      if (nicheKeywords) {
        const nicheScore = computeTfIdfScore(text, nicheKeywords);
        if (nicheScore > 0) {
          score += nicheScore * 8;
          signals.push(`niche:${nicheScore.toFixed(2)}`);
        }
      }

      // 4. Entity matching: tokens often indicate category
      if (node.id === 'bitcoin' && story.entities.tokens.includes('BTC')) {
        score += 3;
        signals.push('entity:BTC');
      }
      if (node.id === 'ethereum' && story.entities.tokens.includes('ETH')) {
        score += 3;
        signals.push('entity:ETH');
      }
      if (node.id === 'solana' && story.entities.tokens.includes('SOL')) {
        score += 3;
        signals.push('entity:SOL');
      }
      if (node.id === 'defi' && story.entities.protocols.length > 0) {
        score += 2;
        signals.push('entity:protocols');
      }

      // 5. Cross-reference boost: if many similar stories match the same category
      if (opts.enableCrossReference && opts.crossReferenceCounts) {
        const xrefCount = opts.crossReferenceCounts.get(node.id) ?? 0;
        if (xrefCount >= 3) {
          score += xrefCount * 0.5;
          signals.push(`cross-ref:${xrefCount}`);
        }
      }

      if (score > 0) {
        const maxPossibleScore = 20;
        const confidence = Math.min(1, score / maxPossibleScore);

        scores.push({
          categoryId: node.id,
          categoryLabel: node.label,
          emoji: node.emoji,
          score,
          confidence,
          signals,
          parentId,
        });
      }

      // Walk children
      walkTree(node.children, node.id);
    }
  }

  walkTree(CATEGORY_TREE, null);

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Apply minimum confidence filter
  const filtered = scores.filter((s) => s.confidence >= minConfidence);

  // Determine primary category
  const primaryCat = filtered.length > 0 ? filtered[0] : null;
  const primary: CategoryScore = primaryCat ?? {
    categoryId: 'crypto',
    categoryLabel: 'Crypto',
    emoji: '₿',
    score: 0.5,
    confidence: 0.3,
    signals: ['default'],
    parentId: null,
  };

  // Build breadcrumb trail
  const breadcrumbs: Array<{ id: string; label: string; emoji: string }> = [];
  if (primary.parentId) {
    const parent = CATEGORY_MAP.get(primary.parentId);
    if (parent) {
      breadcrumbs.push({ id: parent.id, label: parent.label, emoji: parent.emoji });
    }
  }
  breadcrumbs.push({ id: primary.categoryId, label: primary.categoryLabel, emoji: primary.emoji });

  return {
    primary,
    all: filtered,
    breadcrumbs,
  };
}

/**
 * Classify all stories in an aggregation result. Also builds cross-reference
 * counts for accuracy boosting.
 */
export function classifyStories(stories: AggregatedStory[]): Map<string, ClassificationResult> {
  // First pass: classify without cross-reference
  const allResults = new Map<string, ClassificationResult>();
  const crossRefCounts = new Map<string, number>();

  for (const story of stories) {
    const result = classifyStory(story, { enableCrossReference: false });
    allResults.set(story.id, result);

    // Count primary category occurrences
    const catId = result.primary.categoryId;
    crossRefCounts.set(catId, (crossRefCounts.get(catId) ?? 0) + 1);
  }

  // Second pass: re-classify with cross-reference boost
  for (const story of stories) {
    const result = classifyStory(story, {
      enableCrossReference: true,
      crossReferenceCounts: crossRefCounts,
    });
    allResults.set(story.id, result);
  }

  return allResults;
}

/**
 * Get the top N categories for a set of stories, by aggregate confidence.
 */
export function getTopCategories(
  classifications: Map<string, ClassificationResult>,
  topN = 10,
): Array<{
  categoryId: string;
  label: string;
  emoji: string;
  count: number;
  avgConfidence: number;
}> {
  const agg = new Map<
    string,
    { count: number; totalConfidence: number; label: string; emoji: string }
  >();

  for (const result of classifications.values()) {
    const catId = result.primary.categoryId;
    const entry = agg.get(catId) ?? {
      count: 0,
      totalConfidence: 0,
      label: result.primary.categoryLabel,
      emoji: result.primary.emoji,
    };
    entry.count++;
    entry.totalConfidence += result.primary.confidence;
    agg.set(catId, entry);
  }

  return Array.from(agg.entries())
    .map(([categoryId, v]) => ({
      categoryId,
      label: v.label,
      emoji: v.emoji,
      count: v.count,
      avgConfidence: v.count > 0 ? v.totalConfidence / v.count : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

/**
 * Get all available categories with optional parent filter.
 */
export function getCategories(parentId?: string): CategoryNode[] {
  if (parentId) {
    const parent = CATEGORY_MAP.get(parentId);
    return parent?.children ?? [];
  }
  return CATEGORY_TREE;
}

export { CATEGORY_MAP };
