/**
 * @degenfeed/types — Shared constants
 *
 * Consolidated protocol enums, category definitions, and chain constants
 * used across all packages and the API worker.
 */

// ─── Protocol Definitions ─────────────────────────────────────────

/**
 * Union type of all supported protocols.
 * Defined here and re-exported from index.ts.
 */
export type Protocol =
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'bluesky'
  | 'threads'
  | 'rss'
  | 'mastodon'
  | 'lemmy'
  | 'reddit'
  | 'ethereum'
  | 'ponder'
  | 'solana'
  | 'peertube'
  | 'youtube'
  | 'kbin'
  | 'tildes'
  | 'atproto'
  | 'zora'
  | 'telegram'
  | 'discord'
  | 'matrix'
  | 'webhook'
  | 'github'
  | 'newsletter-bridge'
  | 'mirror'
  | 'paragraph'
  | 'email'
  | 'google'
  | 'twitter'
  | 'pixelfed'
  | 'dtube'
  | 'lbry'
  | 'gab'
  | 'minds'
  | 'aether'
  | 'scuttlebutt'
  | 'hive'
  | 'diaspora'
  | 'friendica'
  | 'pleroma'
  | 'misskey'
  | 'cyberconnect'
  | 'arena'
  | 'microblog'
  | 'session'
  | 'steem'
  | 'subsocial'
  | 'funkwhale'
  | 'castopod'
  | 'mediagoblin'
  | 'audius'
  | 'rarible'
  | 'deso'
  | 'writefreely'
  | 'hubzilla'
  | 'streams'
  | 'guppe'
  | 'epicyon'
  | 'ens'
  | 'unstoppable'
  | 'ion'
  | 'keri'
  | 'veramo'
  | 'storj'
  | 'sia'
  | 'filecoin'
  | 'swarm-eth'
  | 'orbis'
  | 'snapshot'
  | 'tally'
  | 'syndicate'
  | 'juicebox'
  | 'coinvise'
  | 'unlock'
  | 'mintgate'
  | 'bonfida'
;

/** All protocol identifiers as a const array */
export const PROTOCOLS = [
  'nostr', 'farcaster', 'lens', 'bluesky', 'threads', 'rss',
  'mastodon', 'lemmy', 'reddit', 'ethereum', 'ponder', 'solana',
  'peertube', 'youtube', 'kbin', 'tildes', 'atproto', 'zora',
  'telegram', 'discord', 'matrix', 'webhook', 'github',
  'newsletter-bridge', 'mirror', 'paragraph', 'email', 'google',
  'twitter', 'pixelfed', 'dtube', 'lbry', 'gab', 'minds',
  'aether', 'scuttlebutt', 'hive', 'diaspora', 'friendica',
  'pleroma', 'misskey', 'writefreely',
  'deso',
  'rarible',
  'audius',
  'mediagoblin',
  'castopod',
  'funkwhale',
  'subsocial',
  'steem',
  'session',
  'microblog',
  'cyberconnect',
  'arena',
  'hubzilla',
  'streams',
  'guppe',
  'epicyon',
  'ens',
  'unstoppable',
  'ion',
  'keri',
  'veramo',
  'storj',
  'sia',
  'filecoin',
  'swarm-eth',
  'orbis',
  'snapshot',
  'tally',
  'syndicate',
  'juicebox',
  'coinvise',
  'unlock',
  'mintgate',
  'bonfida',
] as const satisfies Protocol[];

// ─── Chain Definitions ────────────────────────────────────────────

export type Chain = 'ethereum' | 'solana' | 'base' | 'polygon' | 'arbitrum' | 'optimism';

export const CHAINS: Record<Chain, string> = {
  ethereum: 'Ethereum',
  solana: 'Solana',
  base: 'Base',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
};

// ─── Content Categories ──────────────────────────────────────────

export type ContentCategory =
  | 'crypto' | 'defi' | 'nft' | 'ai' | 'oss' | 'security'
  | 'gaming' | 'music' | 'art' | 'social' | 'news' | 'memes'
  | 'trading' | 'governance' | 'dao' | 'infra' | 'privacy' | 'identity';

export const CONTENT_CATEGORIES: ContentCategory[] = [
  'crypto', 'defi', 'nft', 'ai', 'oss', 'security',
  'gaming', 'music', 'art', 'social', 'news', 'memes',
  'trading', 'governance', 'dao', 'infra', 'privacy', 'identity',
];

// ─── Engagement Types ────────────────────────────────────────────

export type EngagementAction =
  | 'like' | 'unlike' | 'repost' | 'unrepost'
  | 'bookmark' | 'unbookmark' | 'reply' | 'react';

// ─── Space Status ────────────────────────────────────────────────

export type SpaceStatus = 'live' | 'scheduled' | 'ended';

// ─── Visual Source ──────────────────────────────────────────────

export type VisualSource =
  | 'pixelfed' | 'zora' | 'bluesky' | 'nostr' | 'farcaster'
  | 'gotosocial' | 'mastodon' | 'all';

// ─── Scoring Weights (defaults) ──────────────────────────────────

export const DEFAULT_SCORING_WEIGHTS = {
  recency: 2.4,
  engagement: 3.5,
  relevance: 1.8,
  quality: 1.4,
  reputation: 1.0,
  diversity: 1.0,
  source: 0.8,
  velocity: 1.2,
} as const;

// ─── HTTP Status Codes ──────────────────────────────────────────

export const HTTP = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ─── Tier Weights (for ranking) ──────────────────────────────────

export const PLATFORM_TIER_WEIGHTS: Record<string, number> = {
  aether: 0.5,
  arena: 0.7,
  atproto: 0.8,
  audius: 0.7,
  bluesky: 1.0,
  bonfida: 0.6,
  castopod: 0.6,
  coinvise: 0.6,
  cyberconnect: 0.6,
  deso: 0.6,
  diaspora: 0.6,
  discord: 0.6,
  dtube: 0.7,
  email: 0.5,
  ens: 0.7,
  epicyon: 0.5,
  ethereum: 0.6,
  farcaster: 1.0,
  filecoin: 0.6,
  friendica: 0.6,
  funkwhale: 0.6,
  gab: 0.5,
  github: 0.6,
  google: 0.5,
  guppe: 0.6,
  hive: 0.7,
  hubzilla: 0.6,
  ion: 0.5,
  juicebox: 0.6,
  kbin: 0.7,
  keri: 0.4,
  lbry: 0.7,
  lemmy: 1.0,
  lens: 1.0,
  mastodon: 1.0,
  matrix: 0.6,
  mediagoblin: 0.6,
  microblog: 0.7,
  minds: 0.6,
  mintgate: 0.6,
  mirror: 0.8,
  misskey: 0.7,
  'newsletter-bridge': 0.5,
  nostr: 1.0,
  orbis: 0.7,
  paragraph: 0.8,
  peertube: 0.9,
  pixelfed: 1.0,
  pleroma: 0.7,
  ponder: 0.8,
  rarible: 0.7,
  reddit: 0.8,
  rss: 0.8,
  scuttlebutt: 0.6,
  session: 0.6,
  sia: 0.5,
  snapshot: 0.7,
  solana: 0.6,
  steem: 0.7,
  storj: 0.5,
  streams: 0.6,
  subsocial: 0.7,
  'swarm-eth': 0.5,
  syndicate: 0.6,
  tally: 0.6,
  telegram: 0.6,
  threads: 0.7,
  tildes: 0.7,
  twitter: 0.5,
  unlock: 0.7,
  unstoppable: 0.6,
  veramo: 0.5,
  webhook: 0.5,
  writefreely: 0.7,
  youtube: 0.9,
  zora: 0.8,
};
