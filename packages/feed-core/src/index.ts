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

export function isSpamPost(post: UnifiedPost): boolean {
  const text = post.text.trim();
  if (text.length < 10) return true;
  if (/^[0-9a-f]{64}$/i.test(text)) return true;
  if (/^\s*(test|testing|hello world|asdf|qwerty|lorem ipsum)\s*$/i.test(text)) return true;
  if (/^[\s\p{Emoji}\p{Extended_Pictographic}]+$/u.test(text)) return true;
  return false;
}

export function deduplicatePosts(posts: UnifiedPost[]): UnifiedPost[] {
  const seenText = new Set<string>();
  const seenId = new Set<string>();
  return posts.filter((p) => {
    if (seenId.has(p.id)) return false;
    seenId.add(p.id);
    const key = p.text.trim().slice(0, 80).toLowerCase();
    if (key.length > 0 && seenText.has(key)) return false;
    if (key.length > 0) seenText.add(key);
    return true;
  });
}

export function scorePost(post: UnifiedPost, now = Date.now()): number {
  const m = post.metrics;
  const engagement = m.likes + m.reposts * 2 + m.replies * 3 + m.quotes * 4;
  const ageHrs = Math.max(0, (now - post.createdAt) / 3600000);
  const recency = Math.exp(-ageHrs / 24);
  const nicheBoost = post.niches.length > 0 ? 1 + post.niches.length * 0.05 : 1;
  return engagement * recency * nicheBoost;
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

export function rankPosts(posts: UnifiedPost[], now = Date.now()): UnifiedPost[] {
  return [...posts]
    .map((p) => ({ post: enrichPostNiches(p), score: scorePost(p, now) }))
    .sort((a, b) => b.score - a.score)
    .map((p) => p.post);
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
