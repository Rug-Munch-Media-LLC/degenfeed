/**
 * news-helpers — Helper functions and constants for the news pipeline.
 *
 * Extracted from news-aggregator.ts during de-godding.
 * Contains: sentiment analysis, entity extraction, credibility/freshness
 * scoring, text similarity algorithms, and story merging.
 */

import type { Protocol } from '@degenfeed/types';
import { detectNiches } from '@degenfeed/feed-core';
import type { NewsSourceMeta } from './news-types';
import type { AggregatedStory, SentimentResult, StoryEntities } from './news-types';

// ─── Sentiment Analysis (keyword-based) ─────────────────────────────────

const BULLISH_TERMS = [
  'bullish', 'surge', 'soar', 'rally', 'breakthrough', 'upgrade', 'launch',
  'partnership', 'adoption', 'institutional', 'approval', 'etf',
  'all-time high', 'ath', 'breakout', 'moon', 'pump', 'green', 'profit',
  'growth', 'positive', 'mainnet', 'integration', 'listing', 'accumulation',
  'whale buying',
];

const BEARISH_TERMS = [
  'bearish', 'crash', 'dump', 'hack', 'exploit', 'vulnerability', 'rug',
  'scam', 'fraud', 'decline', 'plunge', 'drop', 'sell-off', 'liquidation',
  'ban', 'crackdown', 'regulation', 'fud', 'fear', 'uncertainty', 'red',
  'loss', 'bankrupt', 'attack', 'sanctions', 'withdrawal halt', 'freeze',
];

export function analyzeSentiment(text: string): SentimentResult {
  const lower = text.toLowerCase();
  let bullishScore = 0;
  let bearishScore = 0;
  const signals: string[] = [];

  for (const term of BULLISH_TERMS) {
    if (lower.indexOf(term) !== -1) {
      bullishScore += 1;
      signals.push(`+${term}`);
    }
  }

  for (const term of BEARISH_TERMS) {
    if (lower.indexOf(term) !== -1) {
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
  'BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT',
  'LINK', 'MATIC', 'POL', 'UNI', 'AAVE', 'COMP', 'MKR', 'CRV', 'PEPE',
  'DOGE', 'SHIB', 'BONK', 'WIF', 'JUP', 'RAY', 'ORCA', 'RUNE', 'ATOM',
  'OSMO', 'ARB', 'OP', 'STRK', 'ZK', 'BLAST', 'BASE', 'APT', 'SUI', 'SEI',
  'INJ', 'STX', 'FET', 'AGIX', 'OCEAN', 'RNDR', 'NEAR', 'FIL', 'ICP',
  'SAND', 'MANA', 'APE', 'BLUR', 'LOOKS', 'GMX', 'GNS', 'ALICE', 'YGG',
]);

const KNOWN_PROTOCOLS = [
  'uniswap', 'aave', 'compound', 'makerdao', 'lido', 'rocketpool', 'curve',
  'balancer', 'pancakeswap', 'jupiter', 'raydium', 'orca', 'meteora',
  'opensea', 'blur', 'magiceden', 'tensor', 'sudoswap', 'arbitrum',
  'optimism', 'base', 'polygon', 'avalanche', 'solana', 'ethereum', 'bitcoin',
  'cosmos', 'near', 'celestia', 'chainlink', 'thegraph', 'arweave', 'ipfs',
  'filecoin', 'zksync', 'scroll', 'linea', 'blast', 'mantle', 'mode',
];

const KNOWN_PEOPLE = [
  'vitalik buterin', 'vitalik', 'cz binance', 'changpeng zhao',
  'brian armstrong', 'sam bankman-fried', 'sbf', 'michael saylor',
  'barry silbert', 'anatoly yakovenko', 'raj gokal', 'ryan selkis',
  'chris dixon', 'gavin wood', 'charles hoskinson', 'justin sun',
  'andrew kang', 'hayden adams', 'stani kulechov', 'sanderc botberg',
  'tim draper', 'naval ravikant', 'balaji srinivasan', 'jack dorsey',
];

const KNOWN_COMPANIES = [
  'coinbase', 'binance', 'kraken', 'gemini', 'bitfinex', 'okx', 'bybit',
  'kucoin', 'crypto.com', 'robinhood', 'paypal', 'stripe', 'visa',
  'mastercard', 'blackrock', 'fidelity', 'grayscale', 'microstrategy',
  'tesla', 'a16z', 'paradigm', 'multicoin', 'dragonfly', 'pantera',
  'polychain', 'sequoia', 'union square', 'electric capital', 'variant',
  'circle', 'tether', 'ripple', 'consensys', 'opensea', 'alchemy',
  'infura', 'quicknode', 'etherscan', 'solscan', 'dune analytics',
  'nansen', 'glassnode', 'chainalysis', 'elliptic', 'trmlabs',
];

const KNOWN_CHAINS = [
  'ethereum', 'bitcoin', 'solana', 'avalanche', 'polygon', 'arbitrum',
  'optimism', 'base', 'bnb chain', 'cosmos', 'near', 'aptos', 'sui', 'ton',
  'tron', 'ripple', 'cardano', 'polkadot', 'zksync', 'scroll', 'linea',
  'blast', 'mantle', 'celestia', 'injective', 'sei',
];

const KNOWN_NFT_COLLECTIONS = [
  'bored ape', 'cryptopunk', 'pudgy penguin', 'milady', 'azuki', 'deGods',
  'mad lad', 'nouns', 'art blocks', 'chromie squiggle', 'doodles', 'clone x',
  'otherdeed', 'proof collective', 'bitcoin ordinals', 'inscriptions', 'runes',
];

export function extractEntities(text: string): StoryEntities {
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

export function computeCredibility(source: NewsSourceMeta, story: AggregatedStory): number {
  let score = source.credibility;
  if (story.alsoCoveredBy.length >= 3) score += 0.05;
  if (story.alsoCoveredBy.length >= 5) score += 0.05;
  if (story.entities.tokens.length + story.entities.protocols.length > 0) score += 0.02;
  score += story.sentiment.confidence * 0.03;
  return Math.min(1, Math.max(0.1, score));
}

// ─── Freshness / Breaking News ─────────────────────────────────────────

export function computeFreshness(
  publishedAt: number,
  now: number,
): { freshScore: number; isBreaking: boolean } {
  const ageMs = now - publishedAt;
  const ageMin = ageMs / 60000;
  const ageHrs = ageMin / 60;

  const isBreaking = ageMin < 60;

  let freshScore: number;
  if (ageMin < 60) {
    freshScore = 3.0;
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

// ─── Text Similarity (Jaccard + Levenshtein) ────────────────────────────

export function jaccardSimilarity(a: string, b: string): number {
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

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const p of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref', 'source']) {
      u.searchParams.delete(p);
    }
    let result = u.toString();
    if (result.endsWith('/')) result = result.slice(0, -1);
    return result.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  let prevRow = new Array(bLen + 1);
  let currRow = new Array(bLen + 1);
  for (let j = 0; j <= bLen; j++) prevRow[j] = j;

  for (let i = 1; i <= aLen; i++) {
    currRow[0] = i;
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,
        currRow[j - 1] + 1,
        prevRow[j - 1] + cost,
      );
    }
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }
  return prevRow[bLen];
}

export function titleSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  if (aLower === bLower) return 1;
  if (aLower.length < 5 || bLower.length < 5) return 0;
  const maxLen = Math.max(aLower.length, bLower.length);
  const dist = levenshteinDistance(aLower, bLower);
  return 1 - dist / maxLen;
}

export function contentHash(text: string, length = 500): string {
  const normalized = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, length);
  if (normalized.length < 30) return '';
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) & 0x7fffffff;
  }
  return hash.toString(36);
}

// ─── Story Merging ──────────────────────────────────────────────────────

export function mergeStory(primary: AggregatedStory, duplicate: AggregatedStory): AggregatedStory {
  const allCoveredBy = new Set([...primary.alsoCoveredBy, ...duplicate.alsoCoveredBy]);
  primary.alsoCoveredBy = [...allCoveredBy];

  const allUrls = new Set([...primary.allUrls, ...duplicate.allUrls]);
  primary.allUrls = [...allUrls];

  if (!primary.heroImage && duplicate.heroImage) {
    primary.heroImage = duplicate.heroImage;
    primary.imageUrl = duplicate.imageUrl || primary.imageUrl;
  }

  if (duplicate.summary.length > primary.summary.length) {
    primary.summary = duplicate.summary;
  }

  if (duplicate.publishedAt < primary.publishedAt) {
    primary.publishedAt = duplicate.publishedAt;
  }

  primary.entities = {
    tokens: [...new Set([...primary.entities.tokens, ...duplicate.entities.tokens])],
    protocols: [...new Set([...primary.entities.protocols, ...duplicate.entities.protocols])],
    people: [...new Set([...primary.entities.people, ...duplicate.entities.people])],
    companies: [...new Set([...primary.entities.companies, ...duplicate.entities.companies])],
    chains: [...new Set([...primary.entities.chains, ...duplicate.entities.chains])],
    nfts: [...new Set([...primary.entities.nfts, ...duplicate.entities.nfts])],
  };

  primary.categories = [...new Set([...primary.categories, ...duplicate.categories])];
  primary.niches = [...new Set([...primary.niches, ...duplicate.niches])];

  const avgScore = (primary.sentiment.score + duplicate.sentiment.score) / 2;
  primary.sentiment = {
    label: avgScore > 0.2 ? 'bullish' : avgScore < -0.2 ? 'bearish' : 'neutral',
    score: avgScore,
    confidence: Math.max(primary.sentiment.confidence, duplicate.sentiment.confidence),
    signals: [...new Set([...primary.sentiment.signals, ...duplicate.sentiment.signals])],
  };

  primary.credibility = Math.min(
    1,
    primary.credibility + 0.03 * Math.min(5, allCoveredBy.size - 1),
  );

  return primary;
}

// ─── Misc Utilities ────────────────────────────────────────────────────

export function countOverlap(a: string[], b: string[]): number {
  const setB = new Set(b.map((s) => s.toLowerCase()));
  return a.filter((item) => setB.has(item.toLowerCase())).length;
}

export function withConcurrencyLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  return new Promise((resolve) => {
    const queue = [...items];
    const runners = new Set<Promise<void>>();
    let done = false;

    function startNext() {
      while (runners.size < limit && queue.length > 0) {
        const item = queue.shift();
        if (item === undefined) break;
        const promise = fn(item).catch(() => {}).finally(() => {
          runners.delete(promise);
          if (queue.length > 0) startNext();
          else if (runners.size === 0) { done = true; resolve(); }
        });
        runners.add(promise);
      }
      if (runners.size === 0 && !done) { done = true; resolve(); }
    }

    startNext();
  });
}

export function decodeXmlEntities(str: string): string {
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

export function stripTags(html: string): string {
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

export function estimateReadingTime(text: string): number {
  const wc = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wc / 200));
}

export function extractText(tag: string, xml: string): string {
  const re = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(re);
  return match ? decodeXmlEntities(match[1] || '') : '';
}

export function extractAll(tag: string, xml: string): string[] {
  const re = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null = re.exec(xml);
  while (m !== null) {
    out.push(decodeXmlEntities(m[1] || ''));
    m = re.exec(xml);
  }
  return out;
}
