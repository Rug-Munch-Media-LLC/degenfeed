/**
 * news-processor — News processing: entity extraction, sentiment,
 * scoring, dedup, clustering, and enrichment.
 *
 * Separated from news-aggregator.ts during de-godding.
 */

import type {
  AggregatedStory,
  NewsSourceMeta,
  SentimentResult,
  StoryCluster,
  StoryEntities,
} from './news-sources';

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

export function computeCredibility(source: NewsSourceMeta, story: AggregatedStory): number {
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

export function computeFreshness(
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

export interface ArticleEnrichment {
  heroImage: string;
  metaDescription: string;
  authorName: string;
  readingTime: number;
}

/**
 * Estimate reading time from word count.
 */
function _estimateReadingTime(text: string): number {
  const wc = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wc / 200));
}

/**
 * Lightweight fetch to extract og:image, meta description, and author
 * from an article page. Uses a streaming HTML parser approach.
 * Returns empty strings on failure.
 */
async function _enrichArticle(url: string, timeoutMs = 3000): Promise<ArticleEnrichment> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; DegenFeed/1.0; +https://degenfeed.xyz)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      return { heroImage: '', metaDescription: '', authorName: '', readingTime: 0 };
    }

    // Read first 64KB — enough for <head> metadata
    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder();
      let chunk: ReadableStreamReadResult<Uint8Array>;
      while (!(chunk = await reader.read()).done && html.length < 65536) {
        html += decoder.decode(chunk.value, { stream: true });
      }
      reader.cancel().catch(() => {});
    } else {
      html = await res.text();
      html = html.slice(0, 65536);
    }

    const enrichment: ArticleEnrichment = {
      heroImage: '',
      metaDescription: '',
      authorName: '',
      readingTime: 0,
    };

    // og:image
    const ogImageMatch = html.match(
      /<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i,
    );
    if (ogImageMatch?.[1]) enrichment.heroImage = ogImageMatch[1];

    // twitter:image
    if (!enrichment.heroImage) {
      const twImageMatch = html.match(
        /<meta[^>]+name\s*=\s*["']twitter:image["'][^>]+content\s*=\s*["']([^"']+)["']/i,
      );
      if (twImageMatch?.[1]) enrichment.heroImage = twImageMatch[1];
    }

    // First large image in body as fallback
    if (!enrichment.heroImage) {
      const firstImg = html.match(
        /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*(?:width\s*=\s*["'](\d+)["'])?[^>]*>/i,
      );
      if (firstImg?.[1] && (!firstImg[2] || Number(firstImg[2]) > 200)) {
        const src = firstImg[1];
        if (src.startsWith('http')) enrichment.heroImage = src;
      }
    }

    // Meta description
    const descMatch = html.match(
      /<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']+)["']/i,
    );
    if (descMatch?.[1]) enrichment.metaDescription = descMatch[1].slice(0, 300);

    // og:description fallback
    if (!enrichment.metaDescription) {
      const ogDescMatch = html.match(
        /<meta[^>]+property\s*=\s*["']og:description["'][^>]+content\s*=\s*["']([^"']+)["']/i,
      );
      if (ogDescMatch?.[1]) enrichment.metaDescription = ogDescMatch[1].slice(0, 300);
    }

    // Author from meta
    const authorMatch = html.match(
      /<meta[^>]+name\s*=\s*["']author["'][^>]+content\s*=\s*["']([^"']+)["']/i,
    );
    if (authorMatch?.[1]) enrichment.authorName = authorMatch[1];

    // og:author fallback
    if (!enrichment.authorName) {
      const ogAuthorMatch = html.match(
        /<meta[^>]+property\s*=\s*["']article:author["'][^>]+content\s*=\s*["']([^"']+)["']/i,
      );
      if (ogAuthorMatch?.[1]) enrichment.authorName = ogAuthorMatch[1];
    }

    return enrichment;
  } catch {
    return { heroImage: '', metaDescription: '', authorName: '', readingTime: 0 };
  }
}

// ─── Text Similarity (Jaccard) for Dedup ────────────────────────────────

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

function _normalizeUrl(url: string): string {
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

function _clusterStories(stories: AggregatedStory[]): StoryCluster[] {
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

// ═══════════════════════════════════════════════════════════════════════════
// TASK 4: ENHANCED DEDUP — Levenshtein + Content Hash + Story Merging
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Levenshtein distance between two strings.
 * Used for title similarity comparison (>85% = duplicate).
 */
function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  // Use single-row optimization for smaller memory footprint
  let prevRow = new Array(bLen + 1);
  let currRow = new Array(bLen + 1);
  for (let j = 0; j <= bLen; j++) prevRow[j] = j;

  for (let i = 1; i <= aLen; i++) {
    currRow[0] = i;
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost, // substitution
      );
    }
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }
  return prevRow[bLen];
}

/**
 * Compute normalized Levenshtein similarity (0–1).
 * 1 = identical, 0 = completely different.
 */
function _titleSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  if (aLower === bLower) return 1;
  if (aLower.length < 5 || bLower.length < 5) return 0;
  const maxLen = Math.max(aLower.length, bLower.length);
  const dist = levenshteinDistance(aLower, bLower);
  return 1 - dist / maxLen;
}

/**
 * Generate a content hash from the first N characters of normalized text.
 * Used for detecting identical stories published across sources.
 */
function _contentHash(text: string, length = 500): string {
  const normalized = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, length);
  if (normalized.length < 30) return '';
  // Simple but fast hash
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) & 0x7fffffff;
  }
  return hash.toString(36);
}

/**
 * Merge a duplicate story into the primary story.
 * Tracks "also reported by" across all covering sources.
 */
function _mergeStory(primary: AggregatedStory, duplicate: AggregatedStory): AggregatedStory {
  // Merge source coverage
  const allCoveredBy = new Set([...primary.alsoCoveredBy, ...duplicate.alsoCoveredBy]);
  primary.alsoCoveredBy = [...allCoveredBy];

  // Merge URLs
  const allUrls = new Set([...primary.allUrls, ...duplicate.allUrls]);
  primary.allUrls = [...allUrls];

  // Pick best image
  if (!primary.heroImage && duplicate.heroImage) {
    primary.heroImage = duplicate.heroImage;
    primary.imageUrl = duplicate.imageUrl || primary.imageUrl;
  }

  // Pick best summary (prefer longer)
  if (duplicate.summary.length > primary.summary.length) {
    primary.summary = duplicate.summary;
  }

  // Pick earliest published date (original source)
  if (duplicate.publishedAt < primary.publishedAt) {
    primary.publishedAt = duplicate.publishedAt;
  }

  // Merge entities
  primary.entities = {
    tokens: [...new Set([...primary.entities.tokens, ...duplicate.entities.tokens])],
    protocols: [...new Set([...primary.entities.protocols, ...duplicate.entities.protocols])],
    people: [...new Set([...primary.entities.people, ...duplicate.entities.people])],
    companies: [...new Set([...primary.entities.companies, ...duplicate.entities.companies])],
    chains: [...new Set([...primary.entities.chains, ...duplicate.entities.chains])],
    nfts: [...new Set([...primary.entities.nfts, ...duplicate.entities.nfts])],
  };

  // Merge categories
  primary.categories = [...new Set([...primary.categories, ...duplicate.categories])];

  // Merge niches
  primary.niches = [...new Set([...primary.niches, ...duplicate.niches])];

  // Merge sentiment (average)
  const avgScore = (primary.sentiment.score + duplicate.sentiment.score) / 2;
  primary.sentiment = {
    label: avgScore > 0.2 ? 'bullish' : avgScore < -0.2 ? 'bearish' : 'neutral',
    score: avgScore,
    confidence: Math.max(primary.sentiment.confidence, duplicate.sentiment.confidence),
    signals: [...new Set([...primary.sentiment.signals, ...duplicate.sentiment.signals])],
  };

  // Boost credibility for multi-source coverage
  primary.credibility = Math.min(
    1,
    primary.credibility + 0.03 * Math.min(5, allCoveredBy.size - 1),
  );

  return primary;
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

export function analyzeSentiment(text: string): SentimentResult {
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

// ═══════════════════════════════════════════════════════════════════════════
// Note: TOKEN_PATTERNS, KNOWN_TOKENS, KNOWN_PROTOCOLS, KNOWN_PEOPLE,
// KNOWN_COMPANIES, KNOWN_CHAINS, and KNOWN_NFT_COLLECTIONS are defined
// above (lines 18-243). The duplicate definitions below have been removed.
// ═══════════════════════════════════════════════════════════════════════════
