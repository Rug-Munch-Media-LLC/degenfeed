/**
 * news-aggregator — Smart news aggregation engine.
 *
 * Pulls news from ALL available sources: RSS, Nostr, Farcaster, Bluesky,
 * Lemmy, Reddit, Substack / Ghost / Mirror newsletters. Each source is
 * fetched concurrently and results are merged into a deduplicated,
 * scored, clustered news pipeline.
 *
 * Layer in the feed stack: fetch → enrich → dedup → cluster → score → rank
 */

import {
  deduplicatePosts,
  detectNiches,
  isEnglishPost,
  isRelevantPost,
} from '@degenfeed/feed-core';
import { RssProvider } from '@degenfeed/feed-providers';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import { type Env, log } from '../index';

// ─── News Source Registry ────────────────────────────────────────────────

export interface NewsSourceMeta {
  id: string;
  name: string;
  /** Category this source belongs to (bitcoin, ethereum, defi, etc.) */
  category: string;
  /** Tier: 1 (institutional) → 4 (long tail) */
  tier: 1 | 2 | 3 | 4;
  /** Base credibility score 0–1 */
  credibility: number;
  /** Base weight for ranking */
  weight: number;
  /** RSS feed URL or API endpoint */
  url: string;
  /** Source type */
  type: 'rss' | 'reddit' | 'hackernews' | 'nostr' | 'farcaster' | 'bluesky' | 'lemmy';
}

export const NEWS_SOURCES: NewsSourceMeta[] = [
  // ── Tier 1: Institutional crypto media ──
  {
    id: 'coindesk',
    name: 'CoinDesk',
    category: 'crypto',
    tier: 1,
    credibility: 0.92,
    weight: 1.5,
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    type: 'rss',
  },
  {
    id: 'cointelegraph',
    name: 'CoinTelegraph',
    category: 'crypto',
    tier: 1,
    credibility: 0.9,
    weight: 1.5,
    url: 'https://cointelegraph.com/rss',
    type: 'rss',
  },
  {
    id: 'theblock',
    name: 'The Block',
    category: 'crypto',
    tier: 1,
    credibility: 0.91,
    weight: 1.5,
    url: 'https://www.theblockcrypto.com/rss.xml',
    type: 'rss',
  },
  {
    id: 'decrypt',
    name: 'Decrypt',
    category: 'crypto',
    tier: 1,
    credibility: 0.88,
    weight: 1.4,
    url: 'https://decrypt.co/feed',
    type: 'rss',
  },
  {
    id: 'blockworks',
    name: 'Blockworks',
    category: 'crypto',
    tier: 1,
    credibility: 0.89,
    weight: 1.4,
    url: 'https://blockworks.co/feed',
    type: 'rss',
  },
  {
    id: 'bitcoinmag',
    name: 'Bitcoin Magazine',
    category: 'bitcoin',
    tier: 1,
    credibility: 0.87,
    weight: 1.3,
    url: 'https://bitcoinmagazine.com/feed',
    type: 'rss',
  },
  {
    id: 'cryptoslate',
    name: 'CryptoSlate',
    category: 'crypto',
    tier: 1,
    credibility: 0.85,
    weight: 1.1,
    url: 'https://cryptoslate.com/feed/',
    type: 'rss',
  },

  // ── Tier 2: Analytical / newsletter sources ──
  {
    id: 'bankless',
    name: 'Bankless',
    category: 'defi',
    tier: 2,
    credibility: 0.86,
    weight: 1.3,
    url: 'https://bankless.substack.com/feed',
    type: 'rss',
  },
  {
    id: 'thedefiant',
    name: 'The Defiant',
    category: 'defi',
    tier: 2,
    credibility: 0.84,
    weight: 1.3,
    url: 'https://thedefiant.io/feed',
    type: 'rss',
  },
  {
    id: 'weekinethereum',
    name: 'Week in Ethereum',
    category: 'ethereum',
    tier: 2,
    credibility: 0.88,
    weight: 1.2,
    url: 'https://weekinethereumnews.com/feed',
    type: 'rss',
  },
  {
    id: 'ethdaily',
    name: 'ETH Daily',
    category: 'ethereum',
    tier: 2,
    credibility: 0.8,
    weight: 1.1,
    url: 'https://ethdaily.substack.com/feed',
    type: 'rss',
  },
  {
    id: 'messari',
    name: 'Messari',
    category: 'crypto',
    tier: 2,
    credibility: 0.85,
    weight: 1.1,
    url: 'https://messari.substack.com/feed',
    type: 'rss',
  },
  {
    id: 'unchained',
    name: 'Unchained',
    category: 'crypto',
    tier: 2,
    credibility: 0.83,
    weight: 1.1,
    url: 'https://unchainedcrypto.com/feed/',
    type: 'rss',
  },
  {
    id: 'milkroad',
    name: 'Milk Road',
    category: 'crypto',
    tier: 2,
    credibility: 0.78,
    weight: 1.0,
    url: 'https://milkroad.substack.com/feed',
    type: 'rss',
  },
  {
    id: 'defiedge',
    name: 'The DeFi Edge',
    category: 'defi',
    tier: 2,
    credibility: 0.79,
    weight: 1.0,
    url: 'https://thedefiedge.substack.com/feed',
    type: 'rss',
  },

  // ── Tier 3: On-chain data / security / research ──
  {
    id: 'dune',
    name: 'Dune Analytics',
    category: 'onchain',
    tier: 3,
    credibility: 0.86,
    weight: 1.0,
    url: 'https://dune.com/feed',
    type: 'rss',
  },
  {
    id: 'glassnode',
    name: 'Glassnode',
    category: 'onchain',
    tier: 3,
    credibility: 0.87,
    weight: 1.0,
    url: 'https://glassnode.com/blog/feed',
    type: 'rss',
  },
  {
    id: 'nansen',
    name: 'Nansen',
    category: 'onchain',
    tier: 3,
    credibility: 0.83,
    weight: 1.0,
    url: 'https://nansen.substack.com/feed',
    type: 'rss',
  },
  {
    id: 'tokenterminal',
    name: 'Token Terminal',
    category: 'crypto',
    tier: 3,
    credibility: 0.84,
    weight: 1.0,
    url: 'https://tokenterminal.com/feed',
    type: 'rss',
  },
  {
    id: 'defillama',
    name: 'DeFiLlama',
    category: 'defi',
    tier: 3,
    credibility: 0.85,
    weight: 1.0,
    url: 'https://defillama.com/feed',
    type: 'rss',
  },
  {
    id: 'l2beat',
    name: 'L2Beat',
    category: 'layer2',
    tier: 3,
    credibility: 0.86,
    weight: 1.0,
    url: 'https://l2beat.com/feed.xml',
    type: 'rss',
  },
  {
    id: 'rekt',
    name: 'Rekt News',
    category: 'security',
    tier: 3,
    credibility: 0.82,
    weight: 1.2,
    url: 'https://rekt.news/feed.xml',
    type: 'rss',
  },
  {
    id: 'immunefi',
    name: 'Immunefi',
    category: 'security',
    tier: 3,
    credibility: 0.84,
    weight: 1.0,
    url: 'https://medium.com/feed/immunefi',
    type: 'rss',
  },

  // ── Tier 4: Tech / general ──
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    category: 'tech',
    tier: 4,
    credibility: 0.8,
    weight: 0.9,
    url: 'https://techcrunch.com/feed/',
    type: 'rss',
  },
  {
    id: 'theverge',
    name: 'The Verge',
    category: 'tech',
    tier: 4,
    credibility: 0.78,
    weight: 0.9,
    url: 'https://www.theverge.com/rss/index.xml',
    type: 'rss',
  },

  // ── Reddit via RSS ──
  {
    id: 'reddit-cc',
    name: 'r/CryptoCurrency',
    category: 'crypto',
    tier: 3,
    credibility: 0.55,
    weight: 0.8,
    url: 'https://old.reddit.com/r/CryptoCurrency/hot.rss?limit=25',
    type: 'reddit',
  },
  {
    id: 'reddit-eth',
    name: 'r/ethfinance',
    category: 'ethereum',
    tier: 3,
    credibility: 0.6,
    weight: 0.8,
    url: 'https://old.reddit.com/r/ethfinance/hot.rss?limit=25',
    type: 'reddit',
  },
  {
    id: 'reddit-sol',
    name: 'r/solana',
    category: 'solana',
    tier: 3,
    credibility: 0.55,
    weight: 0.8,
    url: 'https://old.reddit.com/r/solana/hot.rss?limit=25',
    type: 'reddit',
  },
  {
    id: 'reddit-defi',
    name: 'r/defi',
    category: 'defi',
    tier: 3,
    credibility: 0.58,
    weight: 0.8,
    url: 'https://old.reddit.com/r/defi/hot.rss?limit=25',
    type: 'reddit',
  },
];

// ─── Newsletter-specific RSS feeds ────────────────────────────────────────

export const NEWSLETTER_FEEDS: NewsSourceMeta[] = [
  {
    id: 'bankless-nl',
    name: 'Bankless',
    category: 'defi',
    tier: 2,
    credibility: 0.86,
    weight: 1.3,
    url: 'https://bankless.substack.com/feed',
    type: 'rss',
  },
  {
    id: 'defiedge-nl',
    name: 'The DeFi Edge',
    category: 'defi',
    tier: 2,
    credibility: 0.79,
    weight: 1.0,
    url: 'https://thedefiedge.substack.com/feed',
    type: 'rss',
  },
  {
    id: 'milkroad-nl',
    name: 'Milk Road',
    category: 'crypto',
    tier: 2,
    credibility: 0.78,
    weight: 1.0,
    url: 'https://milkroad.substack.com/feed',
    type: 'rss',
  },
  {
    id: 'weeketh-nl',
    name: 'Week in Ethereum News',
    category: 'ethereum',
    tier: 2,
    credibility: 0.88,
    weight: 1.2,
    url: 'https://weekinethereumnews.com/feed',
    type: 'rss',
  },
  {
    id: 'ethdaily-nl',
    name: 'ETH Daily',
    category: 'ethereum',
    tier: 2,
    credibility: 0.8,
    weight: 1.1,
    url: 'https://ethdaily.substack.com/feed',
    type: 'rss',
  },
  {
    id: 'messari-nl',
    name: 'Messari',
    category: 'crypto',
    tier: 2,
    credibility: 0.85,
    weight: 1.1,
    url: 'https://messari.substack.com/feed',
    type: 'rss',
  },
  {
    id: 'unchained-nl',
    name: 'Unchained',
    category: 'crypto',
    tier: 2,
    credibility: 0.83,
    weight: 1.1,
    url: 'https://unchainedcrypto.com/feed/',
    type: 'rss',
  },
  {
    id: 'nansen-nl',
    name: 'Nansen',
    category: 'onchain',
    tier: 3,
    credibility: 0.83,
    weight: 1.0,
    url: 'https://nansen.substack.com/feed',
    type: 'rss',
  },
  {
    id: 'tokenterminal-nl',
    name: 'Token Terminal',
    category: 'crypto',
    tier: 3,
    credibility: 0.84,
    weight: 1.0,
    url: 'https://tokenterminal.com/feed',
    type: 'rss',
  },
  {
    id: 'thedefiant-nl',
    name: 'The Defiant',
    category: 'defi',
    tier: 2,
    credibility: 0.84,
    weight: 1.3,
    url: 'https://thedefiant.io/feed',
    type: 'rss',
  },
  {
    id: 'blockworks-nl',
    name: 'Blockworks',
    category: 'crypto',
    tier: 1,
    credibility: 0.89,
    weight: 1.4,
    url: 'https://blockworks.co/feed',
    type: 'rss',
  },
  {
    id: 'rekt-nl',
    name: 'Rekt News',
    category: 'security',
    tier: 3,
    credibility: 0.82,
    weight: 1.2,
    url: 'https://rekt.news/feed.xml',
    type: 'rss',
  },
];

// ─── Types ────────────────────────────────────────────────────────────────

export interface AggregatedStory {
  /** Unique story ID (derived from canonical URL or content hash) */
  id: string;
  /** Primary title */
  title: string;
  /** Story summary / lede */
  summary: string;
  /** Full extracted text */
  body: string;
  /** Primary story URL */
  url: string;
  /** Source name */
  source: string;
  /** Source meta */
  sourceMeta: NewsSourceMeta;
  /** Protocol tag */
  protocol: Protocol;
  /** All URLs covering this story (cross-source dedup) */
  allUrls: string[];
  /** All sources that cover this story */
  alsoCoveredBy: string[];
  /** Categories this story belongs to */
  categories: string[];
  /** Extracted entities */
  entities: StoryEntities;
  /** Sentiment analysis */
  sentiment: SentimentResult;
  /** Credibility score 0–1 */
  credibility: number;
  /** Computed news score for ranking */
  score: number;
  /** Unix ms */
  publishedAt: number;
  /** When we fetched this */
  fetchedAt: number;
  /** Image URL if available */
  imageUrl?: string;
  /** Author attribution */
  author: string;
  /** Niche tags */
  niches: string[];
  /** Cluster assignment (populated by story clustering) */
  clusterId?: string;
  /** Engagement velocity (shares/min in last hour) */
  velocity: number;
  /** Is breaking news (< 1 hour old gets 3x boost) */
  isBreaking: boolean;
  /** AI-generated tags */
  aiTags?: string[];
}

export interface StoryEntities {
  tokens: string[];
  protocols: string[];
  people: string[];
  companies: string[];
  chains: string[];
  nfts: string[];
}

export interface SentimentResult {
  label: 'bullish' | 'bearish' | 'neutral';
  score: number; // -1 to 1
  confidence: number; // 0–1
  signals: string[];
}

export interface StoryCluster {
  id: string;
  title: string;
  stories: AggregatedStory[];
  topCategories: string[];
  topEntities: StoryEntities;
  totalCoverage: number;
  firstSeen: number;
  lastSeen: number;
  aggregateSentiment: SentimentResult;
}

// ─── Sentiment Analysis (keyword-based) ─────────────────────────────────

const BULLISH_TERMS = [
  'bullish',
  'surge',
  'soar',
  'rally',
  'breakthrough',
  'upgrade',
  'launch',
  'partnership',
  'adoption',
  'institutional',
  'approval',
  'etf',
  'all-time high',
  'ath',
  'breakout',
  'moon',
  'pump',
  'green',
  'profit',
  'growth',
  'positive',
  'mainnet',
  'integration',
  'listing',
  'accumulation',
  'whale buying',
];

const BEARISH_TERMS = [
  'bearish',
  'crash',
  'dump',
  'hack',
  'exploit',
  'vulnerability',
  'rug',
  'scam',
  'fraud',
  'decline',
  'plunge',
  'drop',
  'sell-off',
  'liquidation',
  'ban',
  'crackdown',
  'regulation',
  'fud',
  'fear',
  'uncertainty',
  'red',
  'loss',
  'bankrupt',
  'attack',
  'sanctions',
  'withdrawal halt',
  'freeze',
];

function analyzeSentiment(text: string): SentimentResult {
  const lower = text.toLowerCase();
  let bullishScore = 0;
  let bearishScore = 0;
  const signals: string[] = [];

  for (const term of BULLISH_TERMS) {
    const idx = lower.indexOf(term);
    if (idx !== -1) {
      bullishScore += 1;
      signals.push(`+${term}`);
    }
  }

  for (const term of BEARISH_TERMS) {
    const idx = lower.indexOf(term);
    if (idx !== -1) {
      bearishScore += 1;
      signals.push(`-${term}`);
    }
  }

  const total = bullishScore + bearishScore;
  if (total === 0) {
    return { label: 'neutral', score: 0, confidence: 0, signals: [] };
  }

  const netScore = (bullishScore - bearishScore) / (total + 1);
  const confidence = Math.min(1, total / 5);
  const label = netScore > 0.2 ? 'bullish' : netScore < -0.2 ? 'bearish' : 'neutral';

  return { label, score: netScore, confidence, signals };
}

// ─── Entity Extraction ──────────────────────────────────────────────────

const TOKEN_PATTERNS = /\$([A-Z]{2,8})\b/g;
const KNOWN_TOKENS = new Set([
  'BTC',
  'ETH',
  'SOL',
  'USDT',
  'USDC',
  'BNB',
  'XRP',
  'ADA',
  'AVAX',
  'DOT',
  'LINK',
  'MATIC',
  'POL',
  'UNI',
  'AAVE',
  'COMP',
  'MKR',
  'CRV',
  'PEPE',
  'DOGE',
  'SHIB',
  'BONK',
  'WIF',
  'JUP',
  'RAY',
  'ORCA',
  'RUNE',
  'ATOM',
  'OSMO',
  'ARB',
  'OP',
  'STRK',
  'ZK',
  'BLAST',
  'BASE',
  'APT',
  'SUI',
  'SEI',
  'INJ',
  'STX',
  'FET',
  'AGIX',
  'OCEAN',
  'RNDR',
  'NEAR',
  'FIL',
  'ICP',
  'SAND',
  'MANA',
  'APE',
  'BLUR',
  'LOOKS',
  'GMX',
  'GNS',
  'ALICE',
  'YGG',
]);

const KNOWN_PROTOCOLS = [
  'uniswap',
  'aave',
  'compound',
  'makerdao',
  'lido',
  'rocketpool',
  'curve',
  'balancer',
  'pancakeswap',
  'jupiter',
  'raydium',
  'orca',
  'meteora',
  'opensea',
  'blur',
  'magiceden',
  'tensor',
  'sudoswap',
  'arbitrum',
  'optimism',
  'base',
  'polygon',
  'avalanche',
  'solana',
  'ethereum',
  'bitcoin',
  'cosmos',
  'near',
  'celestia',
  'chainlink',
  'thegraph',
  'arweave',
  'ipfs',
  'filecoin',
  'zksync',
  'scroll',
  'linea',
  'blast',
  'mantle',
  'mode',
];

const KNOWN_PEOPLE = [
  'vitalik buterin',
  'vitalik',
  'cz binance',
  'changpeng zhao',
  'brian armstrong',
  'sam bankman-fried',
  'sbf',
  'michael saylor',
  'barry silbert',
  'anatoly yakovenko',
  'raj gokal',
  'ryan selkis',
  'chris dixon',
  'gavin wood',
  'charles hoskinson',
  'justin sun',
  'andrew kang',
  'hayden adams',
  'stani kulechov',
  'sanderc botberg',
  'tim draper',
  'naval ravikant',
  'balaji srinivasan',
  'jack dorsey',
];

const KNOWN_COMPANIES = [
  'coinbase',
  'binance',
  'kraken',
  'gemini',
  'bitfinex',
  'okx',
  'bybit',
  'kucoin',
  'crypto.com',
  'robinhood',
  'paypal',
  'stripe',
  'visa',
  'mastercard',
  'blackrock',
  'fidelity',
  'grayscale',
  'microstrategy',
  'tesla',
  'a16z',
  'paradigm',
  'multicoin',
  'dragonfly',
  'pantera',
  'polychain',
  'sequoia',
  'union square',
  'electric capital',
  'variant',
  'circle',
  'tether',
  'ripple',
  'consensys',
  'opensea',
  'alchemy',
  'infura',
  'quicknode',
  'etherscan',
  'solscan',
  'dune analytics',
  'nansen',
  'glassnode',
  'chainalysis',
  'elliptic',
  'trmlabs',
];

const KNOWN_CHAINS = [
  'ethereum',
  'bitcoin',
  'solana',
  'avalanche',
  'polygon',
  'arbitrum',
  'optimism',
  'base',
  'bnb chain',
  'cosmos',
  'near',
  'aptos',
  'sui',
  'ton',
  'tron',
  'ripple',
  'cardano',
  'polkadot',
  'zksync',
  'scroll',
  'linea',
  'blast',
  'mantle',
  'celestia',
  'injective',
  'sei',
];

const KNOWN_NFT_COLLECTIONS = [
  'bored ape',
  'cryptopunk',
  'pudgy penguin',
  'milady',
  'azuki',
  'deGods',
  'mad lad',
  'nouns',
  'art blocks',
  'chromie squiggle',
  'doodles',
  'clone x',
  'otherdeed',
  'proof collective',
  'bitcoin ordinals',
  'inscriptions',
  'runes',
];

function extractEntities(text: string): StoryEntities {
  const lower = text.toLowerCase();
  const tokens: string[] = [];
  const protocols: string[] = [];
  const people: string[] = [];
  const companies: string[] = [];
  const chains: string[] = [];
  const nfts: string[] = [];

  // Extract token tickers ($BTC, $ETH, etc.)
  const tokenMatches = text.matchAll(TOKEN_PATTERNS);
  for (const m of tokenMatches) {
    const ticker = m[1];
    if (ticker && KNOWN_TOKENS.has(ticker.toUpperCase())) tokens.push(ticker.toUpperCase());
  }

  // Extract known entities from text
  for (const proto of KNOWN_PROTOCOLS) {
    if (lower.includes(proto) && !protocols.includes(proto)) protocols.push(proto);
  }
  for (const person of KNOWN_PEOPLE) {
    if (lower.includes(person) && !people.includes(person)) people.push(person);
  }
  for (const company of KNOWN_COMPANIES) {
    if (lower.includes(company) && !companies.includes(company)) companies.push(company);
  }
  for (const chain of KNOWN_CHAINS) {
    if (lower.includes(chain) && !chains.includes(chain)) chains.push(chain);
  }
  for (const nft of KNOWN_NFT_COLLECTIONS) {
    if (lower.includes(nft) && !nfts.includes(nft)) nfts.push(nft);
  }

  return {
    tokens: [...new Set(tokens)],
    protocols: [...new Set(protocols)],
    people: [...new Set(people)],
    companies: [...new Set(companies)],
    chains: [...new Set(chains)],
    nfts: [...new Set(nfts)],
  };
}

// ─── Credibility Scoring ────────────────────────────────────────────────

function computeCredibility(source: NewsSourceMeta, story: AggregatedStory): number {
  let score = source.credibility;

  // Boost: multiple sources cover the same story
  if (story.alsoCoveredBy.length >= 3) score += 0.05;
  if (story.alsoCoveredBy.length >= 5) score += 0.05;

  // Boost: has entity coverage (substantive story)
  if (story.entities.tokens.length + story.entities.protocols.length > 0) score += 0.02;

  // Sentiment confidence boost
  score += story.sentiment.confidence * 0.03;

  return Math.min(1, Math.max(0.1, score));
}

// ─── Freshness / Breaking News ─────────────────────────────────────────

function computeFreshness(
  publishedAt: number,
  now: number,
): { freshScore: number; isBreaking: boolean } {
  const ageMs = now - publishedAt;
  const ageMin = ageMs / 60000;
  const ageHrs = ageMin / 60;

  // Breaking: < 1 hour
  const isBreaking = ageMin < 60;

  // Exponential decay freshness
  let freshScore: number;
  if (ageMin < 60) {
    freshScore = 3.0; // 3x breaking news boost
  } else if (ageHrs < 6) {
    freshScore = 2.0;
  } else if (ageHrs < 24) {
    freshScore = 1.0;
  } else if (ageHrs < 48) {
    freshScore = 0.5;
  } else {
    freshScore = 0.2;
  }

  return { freshScore, isBreaking };
}

// ─── RSS Feed Parser ────────────────────────────────────────────────────

function decodeXmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .trim();
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractText(tag: string, xml: string): string {
  const re = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(re);
  return match ? decodeXmlEntities(match[1] || '') : '';
}

function extractAll(tag: string, xml: string): string[] {
  const re = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null = re.exec(xml);
  while (m !== null) {
    out.push(decodeXmlEntities(m[1] || ''));
    m = re.exec(xml);
  }
  return out;
}

interface ParsedRssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  creator?: string;
  content?: string;
  image?: string;
  categories: string[];
}

function parseFeedXml(xml: string, maxItems = 20): ParsedRssItem[] {
  const items: ParsedRssItem[] = [];

  // Try Atom first
  if (xml.trim().includes('<feed')) {
    return parseAtom(xml, maxItems);
  }

  // RSS 2.0
  const itemRe = /<item([^>]*)>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null = itemRe.exec(xml);

  while (m !== null && items.length < maxItems) {
    const itemXml = m[2] || '';
    const title = extractText('title', itemXml);
    const link = extractText('link', itemXml) || extractText('guid', itemXml);
    const description = extractText('description', itemXml);
    const content = extractText('content:encoded', itemXml) || extractText('content', itemXml);
    const pubDate = extractText('pubDate', itemXml) || extractText('dc:date', itemXml);
    const creator = extractText('dc:creator', itemXml) || extractText('author', itemXml);
    const categories = extractAll('category', itemXml);

    let image = '';
    const media = itemXml.match(/<media:content[^>]+url\s*=\s*["']([^"']+)["']/i);
    if (media?.[1]) image = media[1];
    const enclosure = itemXml.match(/<enclosure[^>]+url\s*=\s*["']([^"']+)["']/i);
    if (!image && enclosure?.[1]) image = enclosure[1];
    const imgTag = itemXml.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
    if (!image && imgTag?.[1]) image = imgTag[1];

    if (title && link) {
      items.push({ title, link, description, pubDate, creator, content, image, categories });
    }
    m = itemRe.exec(xml);
  }

  return items;
}

function parseAtom(xml: string, maxItems = 20): ParsedRssItem[] {
  const items: ParsedRssItem[] = [];
  const entryRe = /<entry([^>]*)>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null = entryRe.exec(xml);

  while (m !== null && items.length < maxItems) {
    const entryXml = m[2] || '';
    const title = extractText('title', entryXml);
    const linkMatch = entryXml.match(/<link[^>]+href\s*=\s*["']([^"']+)["']/i);
    const link = linkMatch?.[1] || extractText('id', entryXml);
    const description = extractText('summary', entryXml);
    const content = extractText('content', entryXml);
    const pubDate = extractText('updated', entryXml) || extractText('published', entryXml);
    const creator = extractText('name', entryXml);
    const categories = extractAll('category', entryXml);

    let image = '';
    const imgTag = entryXml.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
    if (imgTag?.[1]) image = imgTag[1];

    if (title && link) {
      items.push({ title, link, description, pubDate, creator, content, image, categories });
    }
    m = entryRe.exec(xml);
  }

  return items;
}

async function fetchRssFeed(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'user-agent': 'DegenFeed/0.1 (news aggregator; +https://degenfeed.xyz)',
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      return null;
    }
    return await res.text();
  } catch {
    return null;
  }
}

// ─── Text Similarity (Jaccard) for Dedup ────────────────────────────────

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const p of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref', 'source']) {
      u.searchParams.delete(p);
    }
    // Remove trailing slash
    let result = u.toString();
    if (result.endsWith('/')) result = result.slice(0, -1);
    return result.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// ─── Main Aggregation Pipeline ─────────────────────────────────────────

export interface AggregationOptions {
  /** Max stories to return */
  limit?: number;
  /** Filter by category */
  category?: string;
  /** Search query */
  query?: string;
  /** Minimum tier */
  minTier?: number;
  /** Include newsletters */
  includeNewsletters?: boolean;
  /** Custom source filter */
  sourceIds?: string[];
  /** Sort order */
  sort?: 'score' | 'newest' | 'trending';
}

export interface AggregationResult {
  stories: AggregatedStory[];
  clusters: StoryCluster[];
  meta: {
    total: number;
    sourceCount: number;
    fetchedAt: number;
    errors: string[];
    sentiment: { bullish: number; bearish: number; neutral: number };
    trending: Array<{ topic: string; count: number; score: number }>;
  };
}

/**
 * Main entry point: fetch news from all available sources, deduplicate,
 * enrich with entities/sentiment/credibility, cluster stories, and return
 * ranked results.
 */
export async function aggregateNews(
  env: Env,
  opts: AggregationOptions = {},
): Promise<AggregationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const limit = opts.limit ?? 50;

  // Determine which sources to fetch
  const sources = opts.sourceIds
    ? NEWS_SOURCES.filter((s) => opts.sourceIds!.includes(s.id))
    : NEWS_SOURCES;
  const newsletters = opts.includeNewsletters !== false ? NEWSLETTER_FEEDS : [];

  // 1. Fetch all RSS/Atom feeds in parallel (with concurrency limit)
  const rawItems: Array<{ item: ParsedRssItem; source: NewsSourceMeta }> = [];
  const allSources = [...sources, ...newsletters];

  await withConcurrencyLimit(allSources, 5, async (source) => {
    const xml = await fetchRssFeed(source.url);
    if (!xml) return;
    if (xml.length > 2_000_000) return;
    const parsed = parseFeedXml(xml, 15);
    for (const item of parsed) {
      rawItems.push({ item, source });
    }
  });

  // 2. Fetch from protocol-based sources (Nostr, Farcaster, Bluesky, Lemmy)
  if (!opts.sourceIds) {
    try {
      const protocolItems = await fetchProtocolSources(env);
      for (const pi of protocolItems) {
        // Map protocol items to our internal format
        rawItems.push(pi);
      }
    } catch (err) {
      errors.push(`protocol sources: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  // 3. Convert to AggregatedStory format with dedup
  const seenUrls = new Map<string, AggregatedStory>();
  const stories: AggregatedStory[] = [];

  for (const { item, source } of rawItems) {
    const canonicalUrl = normalizeUrl(item.link);
    const text = stripTags(item.content || item.description || item.title);
    const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
    const publishedAt = Number.isNaN(pubDate) ? Date.now() : pubDate;

    // Detect niches from the enhanced keyword set
    const categoriesStr = item.categories?.join(' ') ?? '';
    const niches = detectNiches(`${text} ${item.title} ${source.name} ${categoriesStr}`);

    // Detect entities
    const entities = extractEntities(`${text} ${item.title}`);

    // Sentiment
    const sentiment = analyzeSentiment(`${item.title} ${text}`);

    const story: AggregatedStory = {
      id: `news:${canonicalUrl.slice(0, 128).replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      title: item.title,
      summary: text.slice(0, 300),
      body: text,
      url: item.link,
      source: source.name,
      sourceMeta: source,
      protocol: source.type === 'reddit' ? 'reddit' : 'rss',
      allUrls: [canonicalUrl],
      alsoCoveredBy: [source.name],
      categories: [
        ...new Set([
          source.category,
          ...(item.categories ?? []).map((c) => c.toLowerCase()),
          ...niches,
        ]),
      ],
      entities,
      sentiment,
      credibility: source.credibility,
      score: 0,
      publishedAt,
      fetchedAt: startTime,
      imageUrl: item.image || undefined,
      author: item.creator || source.name,
      niches,
      velocity: 0,
      isBreaking: false,
    };

    // Dedup by URL: merge into existing story if same URL
    const existing = seenUrls.get(canonicalUrl);
    if (existing) {
      existing.alsoCoveredBy.push(source.name);
      existing.allUrls.push(canonicalUrl);
      // Update credibility for multiple sources
      existing.credibility = computeCredibility(source, existing);
    } else {
      // Check text similarity for near-duplicates (different URLs, same story)
      let merged = false;
      for (const [existingUrl, existingStory] of seenUrls) {
        if (jaccardSimilarity(item.title, existingStory.title) > 0.6) {
          existingStory.alsoCoveredBy.push(source.name);
          existingStory.allUrls.push(canonicalUrl);
          merged = true;
          break;
        }
      }
      if (!merged) {
        stories.push(story);
        seenUrls.set(canonicalUrl, story);
      }
    }
  }

  // 4. Compute freshness, velocity, and final scores
  const now = Date.now();
  for (const story of stories) {
    const { freshScore, isBreaking } = computeFreshness(story.publishedAt, now);
    story.isBreaking = isBreaking;

    // Compute credibility (takes "also covered by" into account)
    story.credibility = computeCredibility(story.sourceMeta, story);

    // Compute engagement velocity (based on multiple coverage score)
    story.velocity = story.alsoCoveredBy.length * 0.5 + (story.isBreaking ? 2 : 0);

    // Final score: weighted combination
    story.score =
      story.sourceMeta.weight * 1.5 +
      freshScore * 2.0 +
      story.credibility * 1.5 +
      story.velocity * 0.5 +
      story.sentiment.confidence * 0.5;

    // Category boost + entity richness
    if (story.entities.tokens.length > 0) story.score += 0.3;
    if (story.entities.protocols.length > 0) story.score += 0.2;
    if (story.entities.people.length > 0) story.score += 0.2;
  }

  // 5. Story clustering (group related stories)
  const clusters = clusterStories(stories);

  // 6. Filter by category if specified
  let filtered = stories;
  if (opts.category && opts.category !== 'all') {
    const cat = opts.category.toLowerCase();
    filtered = stories.filter(
      (s) => s.categories.includes(cat) || s.niches.includes(cat) || s.sourceMeta.category === cat,
    );
  }

  // 7. Search filter
  if (opts.query) {
    const q = opts.query.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.entities.tokens.some((t) => t.toLowerCase().includes(q)),
    );
  }

  // 8. Sort
  const sort = opts.sort ?? 'score';
  if (sort === 'newest') {
    filtered.sort((a, b) => b.publishedAt - a.publishedAt);
  } else if (sort === 'trending') {
    filtered.sort((a, b) => b.velocity - a.velocity);
  } else {
    filtered.sort((a, b) => b.score - a.score);
  }

  // 9. Compute aggregate sentiment
  const sentimentTotals = { bullish: 0, bearish: 0, neutral: 0 };
  for (const s of filtered) {
    if (s.sentiment.label === 'bullish') sentimentTotals.bullish++;
    else if (s.sentiment.label === 'bearish') sentimentTotals.bearish++;
    else sentimentTotals.neutral++;
  }

  // 10. Compute trending topics from niches + entities
  const trendingMap = new Map<string, { count: number; score: number }>();
  for (const s of filtered.slice(0, 100)) {
    for (const niche of s.niches) {
      const entry = trendingMap.get(niche) ?? { count: 0, score: 0 };
      entry.count++;
      entry.score += 1;
      trendingMap.set(niche, entry);
    }
    for (const token of s.entities.tokens) {
      const entry = trendingMap.get(token) ?? { count: 0, score: 0 };
      entry.count++;
      entry.score += 2;
      trendingMap.set(token, entry);
    }
  }
  const trending = Array.from(trendingMap.entries())
    .map(([topic, v]) => ({ topic, count: v.count, score: v.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  const elapsed = Date.now() - startTime;
  log(
    'info',
    `[news-aggregator] aggregated ${stories.length} stories from ${allSources.length} sources in ${elapsed}ms`,
  );

  return {
    stories: filtered.slice(0, limit),
    clusters,
    meta: {
      total: filtered.length,
      sourceCount: allSources.length,
      fetchedAt: now,
      errors,
      sentiment: sentimentTotals,
      trending,
    },
  };
}

// ─── Protocol Source Fetching ──────────────────────────────────────────

async function fetchProtocolSources(
  env: Env,
): Promise<Array<{ item: ParsedRssItem; source: NewsSourceMeta }>> {
  const results: Array<{ item: ParsedRssItem; source: NewsSourceMeta }> = [];

  // Try to fetch from Nostr news relays, Farcaster, Bluesky via existing providers
  try {
    const { getProvider } = await import('./feed-fetcher');
    const providers = ['nostr', 'farcaster', 'bluesky'] as Protocol[];

    const providerResults = await Promise.allSettled(
      providers.map(async (protocol) => {
        try {
          const provider = getProvider(protocol, env);
          const result = await provider.fetchFeed({ timeoutMs: 4000, concurrency: 2 });
          return result.posts
            .filter((p) => {
              const text = `${p.text} ${p.niches?.join(' ') ?? ''}`.toLowerCase();
              // Filter for news-like content: has link, niche tags, crypto terms
              return (
                p.embeds?.some((e) => e.kind === 'link') &&
                (p.niches?.length > 0 || text.includes('news') || text.includes('report'))
              );
            })
            .map((post): { item: ParsedRssItem; source: NewsSourceMeta } => ({
              item: {
                title:
                  post.text.slice(0, 200).split('\n')[0] || `Post from ${post.author.displayName}`,
                link:
                  post.embeds?.find((e) => e.kind === 'link')?.url ??
                  `https://degenfeed.xyz/post/${post.id}`,
                description: post.text.slice(0, 500),
                pubDate: new Date(post.createdAt).toISOString(),
                creator: post.author.displayName,
                content: post.html || post.text,
                image: post.embeds?.find((e) => e.kind === 'image')?.url ?? '',
                categories: post.niches ?? [],
              },
              source: {
                id: `${protocol}:${post.id.slice(0, 8)}`,
                name: `${protocol.charAt(0).toUpperCase() + protocol.slice(1)} News`,
                category: 'crypto',
                tier: 3,
                credibility: 0.65,
                weight: 0.9,
                url: '',
                type: protocol as 'nostr' | 'farcaster' | 'bluesky',
              },
            }));
        } catch {
          return [] as Array<{ item: ParsedRssItem; source: NewsSourceMeta }>;
        }
      }),
    );

    for (const r of providerResults) {
      if (r.status === 'fulfilled') results.push(...r.value);
    }
  } catch {
    // Protocol sources unavailable — skip
  }

  return results;
}

// ─── Story Clustering ──────────────────────────────────────────────────

function clusterStories(stories: AggregatedStory[]): StoryCluster[] {
  const clusters: StoryCluster[] = [];
  const assigned = new Set<string>();

  for (const story of stories) {
    if (assigned.has(story.id)) continue;

    const cluster: AggregatedStory[] = [story];
    assigned.add(story.id);

    // Find related stories by Jaccard similarity + entity overlap
    for (const other of stories) {
      if (assigned.has(other.id)) continue;
      if (other.id === story.id) continue;

      const titleSim = jaccardSimilarity(story.title, other.title);
      const entityOverlap =
        countOverlap(story.entities.tokens, other.entities.tokens) +
        countOverlap(story.entities.protocols, other.entities.protocols);

      if (titleSim > 0.3 || entityOverlap >= 2) {
        cluster.push(other);
        assigned.add(other.id);
      }
    }

    const sortedCluster = cluster.sort((a, b) => b.score - a.score);
    const topCategories = [...new Set(sortedCluster.flatMap((s) => s.categories))].slice(0, 5);
    const topEntities: StoryEntities = {
      tokens: [...new Set(sortedCluster.flatMap((s) => s.entities.tokens))].slice(0, 10),
      protocols: [...new Set(sortedCluster.flatMap((s) => s.entities.protocols))].slice(0, 5),
      people: [...new Set(sortedCluster.flatMap((s) => s.entities.people))].slice(0, 5),
      companies: [...new Set(sortedCluster.flatMap((s) => s.entities.companies))].slice(0, 5),
      chains: [...new Set(sortedCluster.flatMap((s) => s.entities.chains))].slice(0, 5),
      nfts: [...new Set(sortedCluster.flatMap((s) => s.entities.nfts))].slice(0, 3),
    };

    // Aggregate sentiment across cluster
    const sentimentScores = sortedCluster.map((s) => s.sentiment.score);
    const avgSentiment =
      sentimentScores.length > 0
        ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
        : 0;
    const aggregateSentiment: SentimentResult = {
      label: avgSentiment > 0.1 ? 'bullish' : avgSentiment < -0.1 ? 'bearish' : 'neutral',
      score: avgSentiment,
      confidence: Math.min(1, sentimentScores.length / 5),
      signals: [],
    };

    const firstStory = sortedCluster[0];
    if (!firstStory) continue;

    clusters.push({
      id: `cluster:${firstStory.id}`,
      title: firstStory.title,
      stories: sortedCluster,
      topCategories,
      topEntities,
      totalCoverage: sortedCluster.length,
      firstSeen: Math.min(...sortedCluster.map((s) => s.publishedAt)),
      lastSeen: Math.max(...sortedCluster.map((s) => s.publishedAt)),
      aggregateSentiment,
    });
  }

  return clusters.sort((a, b) => b.totalCoverage - a.totalCoverage);
}

function countOverlap(a: string[], b: string[]): number {
  const setB = new Set(b.map((s) => s.toLowerCase()));
  return a.filter((item) => setB.has(item.toLowerCase())).length;
}

// ─── Concurrency Limit Helper ──────────────────────────────────────────

async function withConcurrencyLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const runners = new Set<Promise<void>>();
  while (queue.length > 0 || runners.size > 0) {
    while (runners.size < limit && queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) break;
      const promise = fn(item)
        .catch(() => {})
        .finally(() => {
          runners.delete(promise);
        });
      runners.add(promise);
    }
    if (runners.size > 0) await Promise.race(runners);
  }
}
