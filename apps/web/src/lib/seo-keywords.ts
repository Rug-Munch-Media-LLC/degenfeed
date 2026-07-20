/**
 * SEO Keyword Map — DegenFeed
 *
 * Target keywords organized by page/feature for consistent SEO strategy.
 * Use these in meta descriptions, H1s, alt text, and content headers.
 *
 * @see /docs/SEO-CHECKLIST.md for the full audit checklist.
 */

// === Primary Keywords (Homepage & Brand) ===============================
export const PRIMARY_KEYWORDS = [
  'web3 social media',
  'decentralized social network',
  'crypto social platform',
  'blockchain social media',
  'web3 social app',
  'decentralized twitter',
  'open source social media',
  'multi protocol social network',
  'fediverse aggregator',
  'cross protocol social app',
] as const;

// === Secondary Keywords (Feature Pages) ================================
export const FEATURE_KEYWORDS = {
  feed: [
    'crypto news feed',
    'web3 content aggregator',
    'multi-protocol feed',
    'nostr feed',
    'farcaster feed',
    'lens feed',
    'bluesky feed',
    'mastodon feed',
    'unified social feed',
    'cross protocol timeline',
  ] as const,

  tipping: [
    'crypto tipping',
    'bitcoin tips',
    'ethereum tips',
    'solana tips',
    'lightning tips',
    'web3 tipping',
    'support creators crypto',
    'send crypto tips',
    'zap nostr',
    'cross chain tipping',
  ] as const,

  communities: [
    'web3 communities',
    'lemmy communities',
    'decentralized communities',
    'crypto reddit alternative',
    'federated communities',
    'nostr communities',
    'farcaster channels',
    'cross protocol communities',
    'token gated communities',
    'dao communities',
  ] as const,

  crosspost: [
    'cross-post crypto',
    'post to multiple social networks',
    'multi-protocol posting',
    'post nostr farcaster lens once',
    'cross platform social media',
    'cross post web3',
    'publish everywhere crypto',
    'multi network post',
  ] as const,

  nft: [
    'nft social network',
    'nft community',
    'nft feed',
    'token gated content',
    'nft social media',
    'web3 nft feed',
    'nft collector social',
  ] as const,

  dao: [
    'dao governance',
    'onchain voting',
    'decentralized governance',
    'crypto dao tooling',
    'dao social',
    'community voting',
    'web3 governance',
  ] as const,

  videos: [
    'web3 video platform',
    'peertube crypto',
    'crypto youtube alternative',
    'decentralized video',
    'crypto video feed',
    'web3 video aggregator',
    'federated video',
  ] as const,

  newsletters: [
    'crypto newsletter',
    'web3 newsletter',
    'blockchain newsletter',
    'defi newsletter',
    'crypto daily digest',
    'web3 news roundup',
  ] as const,

  analytics: [
    'crypto analytics',
    'web3 analytics',
    'social media analytics crypto',
    'cross protocol analytics',
    'creator analytics web3',
    'crypto content analytics',
  ] as const,

  digest: [
    'crypto daily digest',
    'web3 news summary',
    'blockchain daily roundup',
    'crypto curation',
    'web3 daily brief',
    'cross protocol digest',
  ] as const,
} as const;

// === Long-Tail Keywords ================================================
export const LONG_TAIL_KEYWORDS = [
  'best web3 social media platform',
  'twitter alternative for crypto',
  'post to nostr farcaster and lens at once',
  'cross protocol social media app',
  'multi chain social network',
  'decentralized social media aggregator',
  'crypto content discovery platform',
  'web3 news aggregator with ai',
  'tip creators with crypto',
  'own your social media community lemmy',
  'web3 social media with wallet auth',
  'censorship resistant social network',
  'open source twitter alternative crypto',
  'blockchain social media with tipping',
  'aggregate nostr farcaster lens bluesky feed',
  'web3 social feed aggregator',
  'crypto native social platform',
  'decentralized twitter alternative open source',
  'farcaster web client',
  'nostr web client',
  'lens protocol web app',
  'bluesky web aggregator',
  'mastodon web client',
  'fediverse browser',
  'cross protocol replies',
  'unified web3 inbox',
  'crypto creator monetization',
  'web3 social graph aggregator',
  'onchain social media',
  'self hostable social media',
] as const;

// === Protocol-Specific Keywords ========================================
export const PROTOCOL_KEYWORDS: Record<string, readonly string[]> = {
  nostr: [
    'nostr feed',
    'nostr web client',
    'nostr notes',
    'nostr relays',
    'nostr kind 1',
    'nostr zap',
    'nostr nip 05',
  ] as const,
  farcaster: [
    'farcaster feed',
    'farcaster web client',
    'farcaster casts',
    'farcaster channels',
    'farcaster frames',
    'farcaster hub',
  ] as const,
  lens: [
    'lens protocol feed',
    'lens web app',
    'lens publications',
    'lens protocol social',
    'lens polygon social',
  ] as const,
  bluesky: [
    'bluesky feed',
    'bluesky web client',
    'bluesky skeets',
    'at protocol feed',
    'bluesky custom feeds',
  ] as const,
  mastodon: [
    'mastodon feed',
    'mastodon web client',
    'fediverse social',
    'mastodon toots',
    'activitypub feed',
  ] as const,
} as const;

// === Geo/Regional Keywords =============================================
export const GEO_KEYWORDS = [
  'web3 social media global',
  'decentralized social network worldwide',
  'crypto social platform international',
] as const;

// === Branded Keywords ==================================================
export const BRANDED_KEYWORDS = [
  'DegenFeed',
  'degen feed',
  'degenfeed.xyz',
  'DegenFeed web3 social',
  'DegenFeed aggregator',
  'Rug Munch Media',
  'DegenFeed app',
] as const;

// === Helper: Build a keyword-optimized meta description ================
export function buildMetaDescription(
  main: string,
  keywords: readonly string[],
  maxLength = 160,
): string {
  const keywordStr = keywords.slice(0, 5).join(', ');
  const desc = `${main} ${keywordStr}`;
  return desc.length > maxLength ? `${desc.slice(0, maxLength - 1)}…` : desc;
}

// === Helper: Generate SEO title with brand suffix ======================
export function seoTitle(page: string): string {
  return `${page} — DegenFeed`;
}

// === Export all keyword groups for easy import =========================
export const ALL_KEYWORDS = {
  primary: PRIMARY_KEYWORDS,
  features: FEATURE_KEYWORDS,
  longTail: LONG_TAIL_KEYWORDS,
  protocols: PROTOCOL_KEYWORDS,
  branded: BRANDED_KEYWORDS,
} as const;
