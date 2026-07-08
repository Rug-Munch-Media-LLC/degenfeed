import type {
  Embed,
  EngagementMetrics,
  Protocol,
  UnifiedIdentity,
  UnifiedPost,
} from '@degenfeed/types';

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
];

export const PLATFORM_TIER_WEIGHTS: Record<string, number> = {
  nostr: 1.0,
  farcaster: 1.0,
  lens: 1.0,
  bluesky: 1.0,
  mastodon: 1.0,
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

export function tickerCount(text: string): number {
  return Array.from(text.matchAll(/\$[A-Z]{2,5}\b/g)).length;
}

export function hashtagCount(text: string): number {
  return Array.from(text.matchAll(/#[a-zA-Z0-9_]+/g)).length;
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

const SPAM_PATTERNS: RegExp[] = [
  /\b(make money|earn \$\d+|work from home|double your|guaranteed profit|100x guarantee)\b/gi,
  /\b(click here|link in bio|dm me|message me|join my vip|pump group|signals group)\b/gi,
  /\b(casino|lottery|gift card|free crypto|free bitcoin|airdrop scam|claim now)\b/gi,
  /\b(viagra|cialis|escort|onlyfans)\b/gi,
  /🚀{4,}|💰{4,}|🔥{4,}|🌙{4,}/g,
];

const REPEATED_CHAR_RE = /(.)\1{8,}/;

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
// Added so non-crypto content (AI, tech, science, policy) passes
// the relevance filter. Users can still toggle non-crypto OFF.
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

export function isSpamPost(post: UnifiedPost): boolean {
  const text = post.text.trim();
  if (text.length < 12) return true;
  if (/^[0-9a-f]{64}$/i.test(text)) return true;
  if (/^\s*(test|testing|hello world|asdf|qwerty|lorem ipsum)\s*$/i.test(text)) return true;
  if (/^[\s\p{Emoji}\p{Extended_Pictographic}]+$/u.test(text)) return true;
  const lower = text.toLowerCase();
  let spamHits = 0;
  for (const re of SPAM_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(lower)) spamHits++;
  }
  if (spamHits >= 2) return true;
  if (REPEATED_CHAR_RE.test(text)) return true;
  const urlCount = (text.match(/https?:\/\//g) ?? []).length;
  if (urlCount >= 4) return true;
  const upperRatio = (text.match(/[A-Z]/g) ?? []).length / Math.max(text.length, 1);
  if (text.length >= 20 && upperRatio > 0.7) return true;
  return false;
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
  // Compute niches inline so we don't depend on the caller having run
  // enrichPostNiches first. This makes the function safe to call on
  // a fresh post straight out of a provider.
  const computedNiches =
    post.niches.length > 0
      ? post.niches
      : detectNiches(
          `${post.text} ${post.html ?? ''} ${post.author.displayName} ${post.author.bio}`,
        );

  const text = gatherRelevanceText({ ...post, niches: computedNiches });

  if (computedNiches.length > 0) {
    // Even with niches, require at least one match to a core crypto signal
    // so the feed doesn't get polluted by miscategorized noise.
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

export function contentFingerprint(post: UnifiedPost): string {
  // Build a 12-word shingle from text — used to detect near-duplicate
  // reposts across protocols (e.g. someone cross-posting the same content
  // to Farcaster, Lens, and Nostr).
  const text = post.text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 12)
    .join(' ');
  if (text.length > 0) return text;
  // Fallback to link-based fingerprint for media-only posts
  const link = post.embeds.find(
    (e) => e.kind === 'link' || e.kind === 'image' || e.kind === 'video',
  );
  return link ? `link:${link.url}` : '';
}

export function deduplicatePosts(posts: UnifiedPost[]): UnifiedPost[] {
  const seenId = new Set<string>();
  const seenFingerprint = new Set<string>();
  const seenText = new Set<string>();
  const out: UnifiedPost[] = [];
  for (const p of posts) {
    if (seenId.has(p.id)) continue;
    const fp = contentFingerprint(p);
    if (fp && seenFingerprint.has(fp)) continue;
    const textKey = p.text.trim().slice(0, 80).toLowerCase();
    if (textKey.length > 12 && seenText.has(textKey)) continue;
    seenId.add(p.id);
    if (fp) seenFingerprint.add(fp);
    if (textKey.length > 12) seenText.add(textKey);
    out.push(p);
  }
  return out;
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

export function dedupeKey(protocol: Protocol, nativeId: string): string {
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
