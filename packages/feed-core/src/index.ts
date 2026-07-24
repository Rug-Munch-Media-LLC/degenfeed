import type {
  Embed,
  EngagementMetrics,
  Protocol,
  UnifiedIdentity,
  UnifiedPost,
} from '@degenfeed/types';

// ─── User-Controlled Feed Algorithm ────────────────────────────────
export type {
  AlgorithmAuditEntry,
  AlgorithmContext,
  AlgorithmMode,
  AlgorithmScoreBreakdown,
  AlgorithmTransparency,
  AlgorithmWeights,
  NicheSelection,
  ProtocolWeights,
  ReasonEntry,
  ScoredPost,
  ScorerFn,
  UserAlgorithmPreferences,
} from './algorithm';
export {
  ALL_NICHES,
  AlgorithmAuditLog,
  buildAlgorithmTransparency,
  DEFAULT_WEIGHTS,
  FeedAlgorithm,
  globalAuditLog,
  MODE_LABELS,
  MODE_PRESETS,
  NICHE_LABELS,
  scoreNiche,
  scorePopularity,
  scoreProtocol,
  scoreQuality,
  scoreRecency,
  scoreRelevance,
} from './algorithm';
export type { CircuitState } from './circuit-breaker';
export { CircuitBreaker, CircuitBreakerError } from './circuit-breaker';
export type { ModerationCheckResult, ModerationThresholds } from './moderation';
// ─── Auto-moderation configuration ────────────────────────────────
export {
  checkText,
  DEFAULT_THRESHOLDS,
  isUserBanned,
  SCAM_KEYWORDS,
  SPAM_PATTERN_REGEXES,
} from './moderation';
export type { CommunityQualityInput, CommunityQualityScore } from './niches';
// ─── Community niche mapping and quality scoring ──────────────────
export {
  COMMUNITY_DESCRIPTIONS,
  LEMMY_COMMUNITY_NICHES,
  RESERVED_COMMUNITY_NAMES,
  scoreCommunityQuality,
  subscriberTier,
} from './niches';
export type { TopicPreference, UserBehaviorProfile } from './preferences';
// ─── AI-powered preference learning + personalization ─────────────
export {
  adjustTopicWeight,
  clearTopic,
  emptyBehaviorProfile,
  getLearnedTopics,
  INTERACTION_WEIGHTS,
  isOnboardingMode,
  learnFromInteraction,
  personalizeScore,
} from './preferences';
export type { ProtocolQualityContext, ProtocolQualityResult } from './protocol-quality';
// ─── Per-protocol quality scoring (protocol pages) ────────────────
export {
  computeProtocolQuality,
  KNOWN_MASTODON_INSTANCES,
  QUALITY_BADGE_THRESHOLD,
} from './protocol-quality';
export type {
  AuthorProfile,
  QualityContext,
} from './quality';
// ─── Content quality scoring v2 ──────────────────────────────────
export {
  buildQualityAuthorProfile,
  computeAuthorQuality,
  computeEngagementDensity,
  computeQualityScore,
  computeUniqueness,
  estimateViews,
  hasMedia,
} from './quality';
export type {
  PresetName,
  PresetProfile,
  ProtocolQualityPreset,
  QualityFilterResult,
  ResolvedPreset,
} from './quality-presets';
// ─── Protocol quality presets ─────────────────────────────────────
export {
  applyQualityFilters,
  PRESET_DESCRIPTIONS,
  PRESET_LABELS,
  PRESET_NAMES,
  PRESET_PROFILES,
  PROTOCOL_PRESETS,
  presetKvKey,
  resolvePreset,
} from './quality-presets';
export type { SpamContext, SpamResult, SpamTier } from './spam';
// ─── Advanced spam detection (continuous scoring) ──────────────────
export {
  contentQualityScore,
  isSpamPost,
  spamScore,
  spamTier,
} from './spam';

export const NICHE_KEYWORDS: Record<string, string[]> = {
  crypto: ['bitcoin', 'btc', 'crypto', 'cryptocurrency', 'blockchain', 'web3', 'token', 'altcoin'],
  bitcoin: ['bitcoin', 'btc', 'satoshi', 'halving', 'ordinal', 'inscription'],
  ethereum: ['ethereum', 'eth', 'vitalik', 'eip-', 'erc-', 'gas fee', 'validator', 'solidity'],
  solana: ['solana', 'sol ', 'solana-based', '$sol'],
  defi: [
    'defi',
    'lending',
    'yield',
    'liquidity',
    'amm',
    'dex',
    'swap',
    'staking',
    'restaking',
    'vault',
  ],
  nft: ['nft', 'nfts', 'collectible', 'punk', 'azuki', 'opensea', 'blur', 'mint'],
  ai: [
    'ai ',
    'artificial intelligence',
    'machine learning',
    'llm',
    'gpt',
    'openai',
    'anthropic',
    'deepseek',
    'claude',
    'gemini',
    'neural network',
    'deep learning',
    'transformer',
    'diffusion',
    'agent',
    'copilot',
  ],
  tech: [
    'tech',
    'technology',
    'startup',
    'software',
    'programming',
    'developer',
    'coding',
    'github',
    'open source',
    'saas',
    'cloud',
    'api',
  ],
  science: [
    'science',
    'research',
    'discovery',
    'nasa',
    'space',
    'physics',
    'biology',
    'quantum',
    'genetics',
    'dna',
    'climate',
    'energy',
  ],
  startups: [
    'startup',
    'venture capital',
    'vc',
    'funding',
    'seed',
    'series a',
    'series b',
    'ipo',
    'unicorn',
    'y combinator',
    'accelerator',
    'pitch deck',
    'founder',
  ],
  regulation: [
    'sec',
    'regulation',
    'mica',
    'cftc',
    'congress',
    'senate',
    'policy',
    'compliance',
    'lawsuit',
  ],
  security: [
    'hack',
    'exploit',
    'vulnerability',
    'audit',
    'phishing',
    'rug pull',
    'rekt',
    'immunefi',
    'breach',
  ],
  macro: [
    'fed',
    'fomc',
    'inflation',
    'interest rate',
    'dollar',
    'recession',
    'nasdaq',
    'spx',
    'cpi',
  ],
  memecoin: [
    'memecoin',
    'meme coin',
    'dogecoin',
    'shiba',
    'pepe',
    'bonk',
    'wif',
    'moon',
    'pump',
    'dump',
  ],
  layer2: ['layer 2', 'l2', 'rollup', 'arbitrum', 'optimism', 'base', 'zk-', 'zero knowledge'],
  stablecoin: ['stablecoin', 'usdt', 'usdc', 'tether', 'circle', 'dai'],
  etf: ['etf', 'blackrock', 'grayscale', 'ibit', 'spot bitcoin'],
  onchain: ['onchain', 'on-chain', 'blockchain data', 'whale', 'wallet'],
};

export const BOOST_TERMS = [
  'bitcoin',
  'ethereum',
  'solana',
  'defi',
  'nft',
  'ai',
  'regulation',
  'security',
  'macro',
  'stablecoin',
  'etf',
  'layer2',
  'memecoin',
  'onchain',
  'tech',
  'science',
  'startup',
  'space',
  'quantum',
];

export const PLATFORM_TIER_WEIGHTS: Record<string, number> = {
  nostr: 1.0,
  farcaster: 1.0,
  lens: 1.0,
  bluesky: 1.0,
  mastodon: 1.0,
  lemmy: 1.0,
  threads: 0.7,
  reddit: 0.8,
  rss: 0.6,
};

export interface SignalScores {
  recency: number;
  platform: number;
  engagement: number;
  relevance: number;
  quality: number;
  diversity: number;
  total: number;
}

export function keywordRelevance(text: string): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const term of BOOST_TERMS) {
    if (lower.includes(term)) hits++;
  }
  return Math.min(1 + hits * 0.15, 2.0);
}

export function extractEmbeds(text: string, native: unknown[] = []): Embed[] {
  const urlRe = /https?:\/\/[^\s<>"']+/gi;
  const urls = text.match(urlRe) ?? [];
  const linkEmbeds: Embed[] = urls.map((u) => ({ kind: 'link', url: u }));
  const passed = native as Embed[];
  return [...linkEmbeds, ...passed];
}

export function detectNiches(text: string): string[] {
  const t = text.toLowerCase();
  const found = new Set<string>();
  for (const [niche, words] of Object.entries(NICHE_KEYWORDS)) {
    if (words.some((w) => t.includes(w))) found.add(niche);
  }
  return Array.from(found);
}

const CRYPTO_RELEVANCE_TERMS = new Set([
  ...BOOST_TERMS,
  'web3',
  'blockchain',
  'token',
  'altcoin',
  'satoshi',
  'halving',
  'ordinal',
  'inscription',
  'eip-',
  'erc-',
  'validator',
  'solidity',
  'gas fee',
  'gas',
  'restaking',
  'rollup',
  'whale',
  'wallet',
  'dex',
  'amm',
  'yield',
  'vault',
  'opensea',
  'blur',
  'mint',
  'rekt',
  'immunefi',
  'breach',
  'phishing',
  'exploit',
  'hack',
  'mainnet',
  'testnet',
  'sharding',
  'merge',
  'the merge',
  'pos',
  'pow',
  'mining',
  'miner',
  'hashrate',
  'difficulty',
  'stake',
  'staking',
  'unstake',
  'bridge',
  'bridging',
  'wrap',
  'unwrap',
  'weth',
  'wbtc',
  'tvl',
  'total value locked',
  'aave',
  'compound',
  'maker',
  'makerdao',
  'curve',
  'convex',
  'gmx',
  'gmxv2',
  'dydx',
  'perpetual',
  'perp',
  'futures',
  'spot',
  'orderbook',
  'amm',
  'l2beat',
  'celestia',
  'eigenlayer',
  'symbiotic',
  'karak',
  'manta',
  'blast',
  'mode',
  'zora',
  'linea',
  'scroll',
  'zksync',
  'starknet',
  'monad',
  'berachain',
  'monad testnet',
  'aptos',
  'sui',
  'sei',
  'injective',
  'near',
  'cosmos',
  'osmosis',
  'celestia',
  'pendle',
  'ethena',
  'ena',
  'usde',
  'pyusd',
]);

// ─── Tech / AI / general-interest terms ──────────────────────
const TECH_AI_TERMS = new Set([
  'ai',
  'artificial intelligence',
  'machine learning',
  'llm',
  'gpt',
  'openai',
  'anthropic',
  'deepseek',
  'claude',
  'gemini',
  'hugging face',
  'stability',
  'midjourney',
  'runway',
  'tech',
  'technology',
  'startup',
  'software',
  'programming',
  'developer',
  'coding',
  'github',
  'open source',
  'linux',
  'rust',
  'golang',
  'python',
  'typescript',
  'privacy',
  'security',
  'cybersecurity',
  'data science',
  'infosec',
  'science',
  'research',
  'paper',
  'arxiv',
  'breakthrough',
  'innovation',
  'space',
  'spacex',
  'nasa',
  'physics',
  'biology',
  'climate',
  'energy',
  'nuclear',
  'policy',
  'regulation',
  'law',
  'congress',
  'government',
  'economics',
  'market',
  'stock',
  'finance',
  'investing',
  'venture capital',
]);
for (const t of TECH_AI_TERMS) CRYPTO_RELEVANCE_TERMS.add(t);

// Common English function words for language detection.
const ENGLISH_STOPWORDS = new Set([
  'the',
  'is',
  'and',
  'for',
  'that',
  'with',
  'this',
  'are',
  'was',
  'not',
  'have',
  'from',
  'but',
  'can',
  'has',
  'all',
  'will',
  'its',
  'about',
  'been',
  'more',
  'when',
  'what',
  'like',
  'just',
  'into',
  'over',
  'some',
  'would',
  'make',
  'them',
  'than',
  'then',
  'also',
  'very',
  'your',
  'which',
  'their',
  'other',
  'only',
  'even',
  'most',
  'being',
  'after',
  'could',
  'still',
  'first',
  'those',
  'every',
]);

export function isEnglishPost(text: string): boolean {
  if (!text || text.length < 10) return true;
  const words = text.toLowerCase().split(/\s+/);
  let hits = 0;
  for (const w of words) {
    if (ENGLISH_STOPWORDS.has(w)) hits++;
    if (hits >= 3) return true;
  }
  return hits >= 3;
}

function gatherRelevanceText(post: UnifiedPost): string {
  const parts: string[] = [post.text, post.html ?? '', post.author.displayName, post.author.bio];
  for (const n of post.niches) parts.push(n);
  for (const e of post.embeds) {
    parts.push(e.url);
    const meta = e.meta;
    if (meta) {
      if (typeof meta.title === 'string') parts.push(meta.title);
      if (typeof meta.description === 'string') parts.push(meta.description);
    }
  }
  return parts.join(' ').toLowerCase();
}

export function isRelevantPost(post: UnifiedPost): boolean {
  const computedNiches =
    post.niches.length > 0
      ? post.niches
      : detectNiches(
          `${post.text} ${post.html ?? ''} ${post.author.displayName} ${post.author.bio}`,
        );

  const text = gatherRelevanceText({ ...post, niches: computedNiches });

  if (computedNiches.length > 0) {
    const hasCoreSignal =
      /\b(crypto|bitcoin|btc|ethereum|eth|solana|sol|defi|nft|web3|blockchain|altcoin|stablecoin|l2|rollup|etf|macro|regulation|security|memecoin|ai|onchain|token)\b/.test(
        text,
      );
    if (hasCoreSignal) return true;
  }

  if (/\$[A-Z]{2,5}\b/.test(text)) return true;
  if (
    /#[a-zA-Z0-9_]+/.test(text) &&
    /\b(crypto|bitcoin|ethereum|solana|defi|nft|web3|blockchain)\b/.test(text)
  ) {
    return true;
  }
  for (const term of CRYPTO_RELEVANCE_TERMS) {
    if (text.includes(term)) return true;
  }
  return false;
}

const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const TICKER_RE = /\$[A-Z]{2,10}\b/g;
const NON_ALPHA_RE = /[^a-z0-9\s]/g;

function normalizeStripped(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(NON_ALPHA_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(text: string): Set<string> {
  return new Set(
    normalizeStripped(text)
      .split(' ')
      .filter((w) => w.length > 2),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  const smaller = a.size < b.size ? a : b;
  const larger = a.size < b.size ? b : a;
  for (const w of smaller) {
    if (larger.has(w)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

/**
 * Compute Levenshtein distance between two strings.
 * Used for short-text near-duplicate detection where Jaccard
 * similarity on word sets misses subtle near-matches.
 * O(n*m) time, O(min(n,m)) memory using two-row optimization.
 */
function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  if (an < bn) return levenshteinDistance(b, a);

  const prev: number[] = new Array(bn + 1);
  const curr: number[] = new Array(bn + 1);

  for (let j = 0; j <= bn; j++) { prev[j] = j; curr[j] = 0; }

  for (let i = 1; i <= an; i++) {
    curr[0] = i;
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const pj = prev[j] as number;
      const cj1 = curr[j - 1] as number;
      const pj1 = prev[j - 1] as number;
      curr[j] = Math.min(pj + 1, cj1 + 1, pj1 + cost);
    }
    for (let j = 0; j <= bn; j++) prev[j] = curr[j] as number;
  }
  return prev[bn] as number;
}

/**
 * Normalized Levenshtein similarity (0-1).
 * 1.0 = identical, 0.0 = completely different.
 * Only computed for strings where it's useful (short texts < 200 chars).
 */
function normalizedLevenshtein(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(
    a
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200),
    b
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200),
  );
  return 1.0 - dist / Math.max(maxLen, 1);
}

/**
 * Perceptual-style image fingerprint using URL structure + metadata.
 * Real pHash requires image decoding; we use URL path structure,
 * image dimensions (if available), and file name patterns to
 * create a stable fingerprint that survives CDN URL differences.
 */
function imagePerceptualFingerprint(post: UnifiedPost): string | null {
  const images = post.embeds.filter((e) => e.kind === 'image');
  if (images.length === 0) return null;

  const fingerprints: string[] = [];
  for (const img of images) {
    try {
      const u = new URL(img.url);
      // Strip query params, protocol, and common CDN variations
      const path = u.pathname.replace(/\/+$/, '');
      const ext = path.split('.').pop()?.toLowerCase() || '';
      // Only process image-like extensions
      if (!['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp'].includes(ext)) continue;

      // Use path name (filename without extension) as base fingerprint
      const name =
        path
          .split('/')
          .pop()
          ?.replace(/\.[^.]+$/, '') || '';
      // Check for resized variants (common CDN pattern: /resize/ or _small, _thumb)
      const strippedName = name
        .replace(/[-_]?(small|thumb|tiny|medium|large|original|full|resize|crop)[-_]?/gi, '')
        .replace(/[_-]?\d+x\d+[_-]?/gi, ''); // Strip dimension suffixes like "300x200"

      if (strippedName && strippedName.length > 3) {
        // Use the image dimensions from metadata if available
        const meta = img.meta as unknown as Record<string, unknown> | undefined;
        const dims = meta?.width && meta?.height ? `${meta.width}x${meta.height}` : '';
        fingerprints.push(`phash:${strippedName.toLowerCase()}|${dims}`);
      } else {
        // Fallback: use full path minus query
        fingerprints.push(`phash:${u.hostname}${path.toLowerCase()}`);
      }
    } catch {
      fingerprints.push(`phash:${img.url}`);
    }
  }

  return fingerprints.length > 0 ? fingerprints.sort().join('||') : null;
}

/**
 * Cross-poster detection: identify when the same user posts identical
 * or near-identical content across multiple protocols (our own users
 * using the DegenFeed cross-poster, or manual cross-posting).
 */
const CROSS_POST_PATTERNS = [
  /^cross.?post(?:ed)?:?/i,
  /^also (?:posted|shared|published) (?:on|to):?/i,
  /^re.?post(?:ed)? (?:from|via):?/i,
  /^syndicated (?:from|to):?/i,
  /^mirror(?:ed)? (?:from|to):?/i,
  /^\[cross.?post\]/i,
  /^📢/i,
];

function isCrossPost(text: string): boolean {
  const trimmed = text.trim();
  return CROSS_POST_PATTERNS.some((p) => p.test(trimmed));
}

/**
 * Detect if a post originates from a known aggregator or
 * republishing source (not the original content).
 */
const AGGREGATOR_DOMAINS = [
  'reddit.com',
  'redlib.', // Redlib instances
  'lemmy', // Lemmy instances
  'news.google.com',
  'news.ycombinator.com',
  'medium.com',
  'substack.com',
  'ghost.org',
];

function isFromAggregator(post: UnifiedPost): boolean {
  // Check if the post content references an aggregator
  const urls = post.text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  for (const url of urls) {
    try {
      const u = new URL(url);
      if (AGGREGATOR_DOMAINS.some((d) => u.hostname.includes(d))) return true;
    } catch {
      // ignore bad URLs
    }
  }
  // Check embeds for aggregator signals
  for (const embed of post.embeds) {
    try {
      const u = new URL(embed.url);
      if (AGGREGATOR_DOMAINS.some((d) => u.hostname.includes(d))) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * Extract the canonical article URL from a post.
 * Handles Medium, Substack, Reddit, and other platforms
 * that may have trackable or redirect URLs.
 */
function extractCanonicalUrl(post: UnifiedPost): string | null {
  // First check embeds for explicit URLs
  const linkEmbeds = post.embeds.filter((e) => e.kind === 'link');
  for (const embed of linkEmbeds) {
    if (embed.url && embed.url.length > 5) {
      return normalizeUrlForDedup(embed.url);
    }
  }

  // Then extract first substantial URL from text
  const urls = post.text.match(/https?:\/\/[^\s<>"']+/gi);
  if (urls && urls.length > 0) {
    // Filter out social media URLs (those are the post itself, not a shared article)
    const socialDomains = ['twitter.com', 'x.com', 'bsky.app', 'warpcast.com', 'nostr.', 'naddr'];
    const articleUrl = urls.find((u) => !socialDomains.some((d) => u.includes(d)));
    if (articleUrl) return normalizeUrlForDedup(articleUrl);
  }

  return null;
}

function primaryUrl(post: UnifiedPost): string | null {
  const urls = post.text.match(URL_RE);
  if (urls && urls.length > 0) return normalizeUrlForDedup(urls[0]);
  const embed = post.embeds.find(
    (e) => e.kind === 'link' || e.kind === 'image' || e.kind === 'video',
  );
  return embed ? normalizeUrlForDedup(embed.url) : null;
}

function normalizeUrlForDedup(url: string): string {
  try {
    const u = new URL(url.toLowerCase());
    if (u.pathname.startsWith('/@') || u.pathname.includes('/users/')) {
      const parts = u.pathname.split('/');
      const lastTwo = parts.filter(Boolean).slice(-2).join('/');
      const statusId = u.searchParams.get('status') || parts[parts.length - 1];
      return `ap:${lastTwo}:${statusId || ''}`;
    }
    return url.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function tickerSnapshot(text: string): string {
  const tickers = new Set(text.match(TICKER_RE) ?? []);
  const sorted = [...tickers].sort().join(',');
  const firstSentence = text
    .replace(URL_RE, '')
    .replace(/[.!?].*/, '')
    .replace(NON_ALPHA_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return sorted ? `${sorted}|${firstSentence}` : firstSentence;
}

function embedFingerprint(post: UnifiedPost): string | null {
  if (post.text.trim().length > 20) return null;
  const media = post.embeds.filter((e) => e.kind === 'image' || e.kind === 'video');
  if (media.length === 0) return null;
  return `embed:${media
    .map((e) => e.url)
    .sort()
    .join('|')}`;
}

function imageFingerprint(post: UnifiedPost): string | null {
  const images = post.embeds.filter((e) => e.kind === 'image');
  if (images.length === 0) return null;
  const normalized = images
    .map((e) => {
      try {
        const u = new URL(e.url.replace(/\/$/, ''));
        u.search = '';
        return `${u.hostname}${u.pathname}`;
      } catch {
        return e.url;
      }
    })
    .sort()
    .join('|');
  return `img:${normalized}`;
}

function authorKey(post: UnifiedPost): string {
  const displayName = post.author.displayName.toLowerCase().trim();
  const id = post.author.id.toLowerCase();
  return `${id}|${displayName}`;
}

function extractQuotedId(post: UnifiedPost): string | null {
  if (post.html && /<\s*blockquote/i.test(post.html)) {
    const urls = post.html.match(URL_RE);
    return urls ? `quoted:${urls.join(',')}` : null;
  }
  if (/\bRT\s+@/i.test(post.text) || /\bvia\s+@/i.test(post.text) || /^RT\b/i.test(post.text)) {
    const urls = post.text.match(URL_RE);
    if (urls && urls.length > 0) return `quoted:${urls.join(',')}`;
    const stripped = normalizeStripped(post.text).slice(0, 80);
    return stripped ? `quote:text:${stripped}` : null;
  }
  return null;
}

function contentFingerprint(post: UnifiedPost): string {
  const words = normalizeStripped(post.text)
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 12);
  if (words.length > 0) return words.join(' ');
  const link = post.embeds.find(
    (e) => e.kind === 'link' || e.kind === 'image' || e.kind === 'video',
  );
  return link ? `link:${link.url}` : '';
}

const JACCARD_THRESHOLD = 0.7;
const MIN_TEXT_LENGTH = 20;

export function deduplicatePosts(posts: UnifiedPost[]): UnifiedPost[] {
  const seen = {
    id: new Set<string>(),
    fingerprint: new Set<string>(),
    normalized: new Set<string>(),
    url: new Set<string>(),
    canonicalUrl: new Set<string>(),
    prefix: new Set<string>(),
    shortExact: new Set<string>(),
    authorWindow: new Set<string>(),
    quoted: new Set<string>(),
    ticker: new Set<string>(),
    embed: new Set<string>(),
    imageFp: new Set<string>(),
    perceptualHash: new Set<string>(),
    rssOrigin: new Set<string>(),
  };
  const candidates: { words: Set<string>; index: number }[] = [];
  const shortTextCandidates: { text: string; index: number }[] = [];
  const out: UnifiedPost[] = [];

  for (const p of posts) {
    if (seen.id.has(p.id)) continue;

    // Content fingerprint
    const fp = contentFingerprint(p);
    if (fp && seen.fingerprint.has(fp)) continue;

    // Normalized text
    const norm = normalizeStripped(p.text);
    if (norm.length > 15 && seen.normalized.has(norm)) continue;

    // Primary URL dedup
    const purl = primaryUrl(p);
    if (purl && seen.url.has(purl)) continue;

    // CANONICAL URL dedup: same article shared via different protocols
    const curl = extractCanonicalUrl(p);
    if (curl && seen.canonicalUrl.has(curl)) {
      const matched = out.find((o) => extractCanonicalUrl(o) === curl);
      if (matched) {
        const cross = ((matched as unknown as Record<string, unknown>).crossPostedTo as string[]) ?? [];
        if (!cross.includes(p.protocol)) cross.push(p.protocol);
        (matched as unknown as Record<string, unknown>).crossPostedTo = cross;
      }
      continue;
    }

    // Prefix dedup
    const prefix = p.text.trim().slice(0, 120).toLowerCase();
    if (prefix.length > 12 && seen.prefix.has(prefix)) continue;

    // Short exact match
    if (p.text.trim().length <= 80) {
      const exact = p.text.trim().toLowerCase();
      if (exact.length > 0 && seen.shortExact.has(exact)) continue;
      if (exact.length > 0) seen.shortExact.add(exact);
    }

    // Author + content window
    const windowKey = `${authorKey(p)}|${fp}`;
    if (fp && seen.authorWindow.has(windowKey)) continue;

    // Quoted / repost detection
    const qid = extractQuotedId(p);
    if (qid && seen.quoted.has(qid)) continue;

    // Ticker snapshot
    const ts = tickerSnapshot(p.text);
    if (ts.length > 3 && seen.ticker.has(ts)) continue;

    // Embed fingerprint
    const eid = embedFingerprint(p);
    if (eid && seen.embed.has(eid)) continue;

    // Image URL fingerprint
    const imgFp = imageFingerprint(p);
    if (imgFp && seen.imageFp.has(imgFp)) continue;

    // PERCEPTUAL IMAGE HASH: same image even with different CDN URLs
    const phash = imagePerceptualFingerprint(p);
    if (phash && seen.perceptualHash.has(phash)) continue;

    // RSS ORIGIN DEDUP: same article from multiple RSS feeds
    if (p.protocol === 'rss') {
      const articleTitle = postTitle(p);
      const domain = extractDomain(p);
      if (articleTitle && domain) {
        const rssKey = `rss:${domain}:${articleTitle.toLowerCase().slice(0, 80)}`;
        if (seen.rssOrigin.has(rssKey)) {
          const existing = out.find((o) => {
            const et = postTitle(o);
            const ed = extractDomain(o);
            if (!et || !ed) return false;
            return `rss:${ed}:${et.toLowerCase().slice(0, 80)}` === rssKey;
          });
          if (existing) {
            const cross = ((existing as unknown as Record<string, unknown>).crossPostedTo as string[]) ?? [];
            if (!cross.includes(p.protocol)) cross.push(p.protocol);
            (existing as unknown as Record<string, unknown>).crossPostedTo = cross;
            // Keep the version with more content (likely the original)
            if ((p.text?.length ?? 0) > (existing.text?.length ?? 0)) {
              const idx = out.indexOf(existing);
              if (idx !== -1) out[idx] = p;
            }
          }
          continue;
        }
        seen.rssOrigin.add(rssKey);
      }
    }

    // AGGREGATOR DEDUP: prefer original source over Redlib/Lemmy aggregator
    let matchedAggregator = false;
    if (isFromAggregator(p)) {
      const curl2 = extractCanonicalUrl(p);
      if (curl2) {
        const normalCurl = normalizeUrlForDedup(curl2);
        for (const existing of out) {
          const existingUrl = extractCanonicalUrl(existing);
          if (existingUrl && normalizeUrlForDedup(existingUrl) === normalCurl) {
            matchedAggregator = true;
            const cross = ((existing as unknown as Record<string, unknown>).crossPostedTo as string[]) ?? [];
            if (!cross.includes(p.protocol)) cross.push(p.protocol);
            (existing as unknown as Record<string, unknown>).crossPostedTo = cross;
            break;
          }
        }
      }
    }
    if (matchedAggregator) continue;

    // JACCARD similarity for near-duplicates
    const ws = wordSet(p.text);
    let matchedProtocol: string | undefined;
    if (!qid && ws.size >= 3 && p.text.length > MIN_TEXT_LENGTH) {
      for (const cand of candidates) {
        const sim = jaccardSimilarity(ws, cand.words);
        if (sim >= JACCARD_THRESHOLD) {
          const existing = out[cand.index];
          if (!existing) continue;
          matchedProtocol = existing.protocol;
          const cross = ((existing as unknown as Record<string, unknown>).crossPostedTo as string[]) ?? [];
          if (!cross.includes(p.protocol)) cross.push(p.protocol);
          (existing as unknown as Record<string, unknown>).crossPostedTo = cross;
          break;
        }
      }
    }

    // LEVENSHTEIN near-duplicate detection for short/medium text
    if (!matchedProtocol && p.text.length > 15 && p.text.length < 300) {
      const cleanText = p.text
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleanText.length > 10) {
        for (const cand of shortTextCandidates) {
          const levSim = normalizedLevenshtein(cleanText, cand.text);
          if (levSim >= 0.85) {
            const existing = out[cand.index];
            if (!existing) continue;
            matchedProtocol = existing.protocol;
            const cross = ((existing as unknown as Record<string, unknown>).crossPostedTo as string[]) ?? [];
            if (!cross.includes(p.protocol)) cross.push(p.protocol);
            (existing as unknown as Record<string, unknown>).crossPostedTo = cross;
            break;
          }
        }
      }
    }

    if (matchedProtocol) continue;

    // Record in seen sets and add to output
    seen.id.add(p.id);
    if (fp) seen.fingerprint.add(fp);
    if (norm.length > 15) seen.normalized.add(norm);
    if (purl) seen.url.add(purl);
    if (curl) seen.canonicalUrl.add(curl);
    if (prefix.length > 12) seen.prefix.add(prefix);
    if (fp) seen.authorWindow.add(windowKey);
    if (qid) seen.quoted.add(qid);
    if (ts.length > 3) seen.ticker.add(ts);
    if (eid) seen.embed.add(eid);
    if (imgFp) seen.imageFp.add(imgFp);
    if (phash) seen.perceptualHash.add(phash);
    candidates.push({ words: ws, index: out.length });
    const cleanText = p.text
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanText.length > 10 && cleanText.length < 300) {
      shortTextCandidates.push({ text: cleanText, index: out.length });
    }
    out.push(p);
  }

  return out;
}

/**
 * Extract the title/headline from a post (for RSS/article dedup).
 */
function postTitle(post: UnifiedPost): string | null {
  for (const embed of post.embeds) {
    const meta = embed.meta as unknown as Record<string, unknown> | undefined;
    if (meta?.title && typeof meta.title === 'string' && meta.title.length > 5) {
      return meta.title;
    }
  }
  if (post.protocol === 'rss') {
    const firstLine = post.text.trim().split('\n')[0]?.trim();
    if (firstLine && firstLine.length > 5 && firstLine.length < 200) return firstLine;
    const firstSentence = post.text.trim().split(/[.!?]/)[0]?.trim();
    if (firstSentence && firstSentence.length > 5 && firstSentence.length < 200)
      return firstSentence;
  }
  return null;
}

/**
 * Extract the domain from a post's primary URL.
 */
function extractDomain(post: UnifiedPost): string | null {
  const url = primaryUrl(post);
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function enrichPostNiches(post: UnifiedPost): UnifiedPost {
  const textParts = [post.text, post.html ?? '', post.author.displayName, post.author.bio];
  for (const e of post.embeds) {
    if (e.url) textParts.push(e.url);
    if (e.meta?.title) textParts.push(String(e.meta.title));
    if (e.meta?.description) textParts.push(String(e.meta.description));
  }
  const allText = textParts.join(' ');
  post.niches = [...new Set([...post.niches, ...detectNiches(allText)])];
  return post;
}

export function detectContentType(
  post: UnifiedPost,
): 'article' | 'video' | 'image' | 'thread' | 'link' | 'text' {
  const hasVideo = post.embeds.some((e) => e.kind === 'video');
  if (hasVideo) return 'video';
  const hasImage = post.embeds.some((e) => e.kind === 'image');
  if (hasImage) return 'image';
  const textLen = post.text.trim().length;
  if (textLen > 500 && post.embeds.length === 0) return 'article';
  if (post.embeds.some((e) => e.kind === 'link') && textLen < 100) return 'link';
  if (post.parentId && post.rootId) return 'thread';
  if (textLen > 200 && post.embeds.some((e) => e.kind === 'link')) return 'article';
  return 'text';
}

function dedupeKey(protocol: Protocol, nativeId: string): string {
  return `${protocol}:${nativeId}`;
}

export function emptyIdentity(): UnifiedIdentity {
  return {
    id: '',
    primary: { protocol: 'nostr', id: '' },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: null,
    },
    displayName: '',
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: {},
  };
}

export function emptyMetrics(): EngagementMetrics {
  return { likes: 0, reposts: 0, replies: 0, quotes: 0 };
}

export function buildUnifiedPost(args: {
  protocol: Protocol;
  nativeId: string;
  author: UnifiedIdentity;
  text: string;
  html?: string;
  embeds?: Embed[];
  parentNativeId?: string;
  rootNativeId?: string;
  createdAt: number;
  metrics?: Partial<EngagementMetrics>;
  viewer?: { liked?: boolean; reposted?: boolean; bookmarked?: boolean };
  raw: unknown;
}): UnifiedPost {
  const metrics = { ...emptyMetrics(), ...args.metrics };
  return {
    id: dedupeKey(args.protocol, args.nativeId),
    protocol: args.protocol,
    author: args.author,
    text: args.text,
    html: args.html,
    embeds: args.embeds ?? extractEmbeds(args.text),
    parentId: args.parentNativeId ? dedupeKey(args.protocol, args.parentNativeId) : undefined,
    rootId: args.rootNativeId ? dedupeKey(args.protocol, args.rootNativeId) : undefined,
    createdAt: args.createdAt,
    metrics,
    engagement: {
      viewerLiked: args.viewer?.liked ?? false,
      viewerReposted: args.viewer?.reposted ?? false,
      viewerBookmarked: args.viewer?.bookmarked ?? false,
      raw: metrics,
    },
    raw: args.raw,
    niches: detectNiches(args.text),
  };
}

// ─── Ranking (folded from @degenfeed/ranking) ─────────────────────
export type {
  AuthorReputation,
  DiversityConstraints,
  QualitySignals,
  RankingContext,
  ScoreBreakdown,
  ScorerContext,
  TrendingTopic,
  UserAlgorithmPreferences as RankingUserPrefs,
} from '@degenfeed/ranking';
export {
  checkDiversity,
  computeAuthorReputation,
  computeQualitySignals,
  computeTrendingTopics,
  DEFAULT_DIVERSITY,
  engagementVelocity,
  extractHashtags,
  extractTickers,
  freshnessBoost,
  interleaveByProtocol,
  nicheRelevance,
  normalizeEngagement,
  PLATFORM_TIER,
  platformRelevance,
  qualityBoost,
  rank,
  rankDiverse,
  rankV2,
  recencyDecay,
  score,
  scoreBreakdownV2,
  scoreV2,
  sourceWeight,
  VELOCITY_WINDOW_HOURS,
  WEIGHTS,
  WEIGHTS_V2,
} from '@degenfeed/ranking';

// ─── Cross-Protocol Threading ───────────────────────────────────────────
export type {
  CrossProtocolLink,
  CrossProtocolReply,
  CrossProtocolThread,
} from './cross-protocol';
export {
  assembleCrossProtocolReplies,
  buildAlsoPostedIndicator,
  clearThreadStore,
  getAlsoPostedOn,
  getCrossPostLinks,
  getThread,
  getThreadMeta,
  pruneThreads,
  registerCrossPostLink,
  registerReply,
} from './cross-protocol';

// ─── Unified Identity Resolver ──────────────────────────────────────────
export type {
  IdentityResolutionStrategy,
  ProtocolHandle,
  UnifiedProfile,
} from './identity-resolver';
export {
  formatCrossProtocolFollowers,
  globalIdentityResolver,
  IdentityResolver,
  linkIdentities,
  resolveIdentity,
} from './identity-resolver';

// ─── Enhanced Dedup & Quality Functions ─────────────────────────────────
export {
  extractCanonicalUrl,
  extractDomain,
  imagePerceptualFingerprint,
  isCrossPost,
  isFromAggregator,
  levenshteinDistance,
  normalizedLevenshtein,
  postTitle,
};
