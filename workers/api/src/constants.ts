/**
 * @degenfeed/api-worker — Centralized constants & magic values
 *
 * All default values, limits, thresholds, time constants, and enums
 * that were previously scattered across route handlers are consolidated
 * here. Route files MUST import from here instead of defining inline.
 *
 * When adding a new constant:
 *   1. Add it to the appropriate section below
 *   2. Import in the route handler
 *   3. NEVER hard-code values in route files
 */

// ─── Time Constants ─────────────────────────────────────────────────

export const MS_PER_SECOND = 1_000;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;
export const MS_PER_WEEK = 604_800_000;

export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3_600;
export const SECONDS_PER_DAY = 86_400;
export const SECONDS_PER_WEEK = 604_800;

// ─── Rate Limiting Defaults ─────────────────────────────────────────
// Sensible tiers: auth 5/60s, tip 10/60s, publish 20/60s, admin 20/60s,
// writes 30/60s, reads 100/60s.

export const RATE_LIMIT = {
  DEFAULT_WINDOW_MS: 5_000,
  DEFAULT_MAX_REQ: 20,

  // Auth (wallet verify)
  AUTH_MAX: 5,
  AUTH_WINDOW_MS: 60_000,
  AUTH_BLOCK_MAX: 3,
  AUTH_BLOCK_WINDOW_MS: 1_800_000, // 30 min
  AUTH_BLOCK_RATE: 1,
  AUTH_BLOCK_RATE_WINDOW_MS: 60_000,

  // Tip
  TIP_MAX: 10,
  TIP_WINDOW_MS: 60_000,

  // Publish
  PUBLISH_MAX: 20,
  PUBLISH_WINDOW_MS: 60_000,

  // Enumeration (email auth)
  ENUMERATION_MAX: 3,
  ENUMERATION_WINDOW_MS: 60_000,
  ENUMERATION_BACKOFF_BASE_MS: 10_000,
  ENUMERATION_BACKOFF_MAX_MS: 300_000,

  // Reads (feed endpoints)
  READS_MAX: 100,
  READS_WINDOW_MS: 60_000,

  // Writes (state-changing)
  WRITES_MAX: 30,
  WRITES_WINDOW_MS: 60_000,

  // Global DDoS
  GLOBAL_DDOS_MAX: 1_000,
  GLOBAL_DDOS_WINDOW_MS: 60_000,

  // Admin
  ADMIN_MAX: 20,
  ADMIN_WINDOW_MS: 60_000,
} as const;

// ─── Feed & Content Limits ─────────────────────────────────────────

export const FEED = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 200,
  CACHE_TTL_SECONDS: 300, // 5 min default
  TRENDING_CACHE_TTL_SECONDS: 15,
  FEED_GENERATION_TIMEOUT_MS: 15_000,
  MAX_POST_BODY_BYTES: 1_048_576, // 1MB
  DEFAULT_HIDE_LOW_QUALITY_THRESHOLD: 1.0,
  DEFAULT_MIN_ENGAGEMENT: 0,
  DEFAULT_MAX_PER_NICHE: 5,
  DEFAULT_MAX_CONSECUTIVE_PROTOCOLS: 2,
  DEFAULT_MAX_CONSECUTIVE_CONTENT_TYPE: 3,
  DEFAULT_MIN_CATEGORIES: 3,
  STALE_CONTENT_DAYS: 7,
} as const;

// ─── Session & Auth ────────────────────────────────────────────────

export const AUTH = {
  SESSION_TTL_MS: 7 * MS_PER_DAY,
  CSRF_TTL_SECONDS: 3_600,
  COOKIE_NAME: '__Host-dfid',
  MAX_BODY_BYTES: 1_048_576,
} as const;

// ─── KV Cache TTLs (seconds) ──────────────────────────────────────

export const CACHE_TTL = {
  POST: 300,
  FEED: 120,
  PREFS: 600,
  FOLLOWING: 300,
  FOLLOWERS: 300,
  SPACE: 300,
  LIVE_SPACES_INDEX: 60,
  UPCOMING_SPACES_INDEX: 300,
  TRENDING: 300,
  DISCOVER: 300,
  PROTOCOL_HEALTH: 30,
  NEWSLETTER_SUBSCRIBERS: 600,
  OAUTH_STATE: 600,
  RECOMMENDATIONS: 600,
  LEADERBOARD: 600,
  FEATURE_FLAGS: 300,
  REPUTATION: 3_600,
  DAO_ACTIVITY: 3_600,
  DAO_REALTIME: 300,
  QUADRATIC_VOTING: 600,
  SUBSCRIPTION_TIERS: 300,
  USER_SUBSCRIPTION: 300,
  CUSTOM_FEED: 600,
  DRAFT: SECONDS_PER_WEEK,
  CROSS_REPLY: 3_600,
  BLINK_TIP: 3_600,
  BRIDGE_SYNC: 300,
  MUTED_USERS: 600,
  BLOCKED_USERS: 600,
  WEBAUTHN_CHALLENGE: 300,
  HW_2FA_CHALLENGE: 300,
  TOTP_TEMP: 600,
  GRANT_ANALYTICS: 3_600,
  PORTFOLIO: 300,
  YIELD_OPPORTUNITIES: 600,
  DEPLOYMENT: SECONDS_PER_DAY,
  MODERATION_STATS: 300,
  NOTIFICATIONS: 300,
  STREAM_ANALYTICS: 3_600,
} as const;

// ─── Error Logger ─────────────────────────────────────────────────

export const ERROR_LOGGER = {
  MAX_STORED_ERRORS: 50,
  TTL_SECONDS: 86_400, // 24h
} as const;

// ─── Protocol Names ───────────────────────────────────────────────

export const PROTOCOLS = {
  NOSTR: 'nostr',
  FARCASTER: 'farcaster',
  LENS: 'lens',
  BLUESKY: 'bluesky',
  MASTODON: 'mastodon',
  THREADS: 'threads',
  RSS: 'rss',
  REDDIT: 'reddit',
  LEMMY: 'lemmy',
  PIXELFED: 'pixelfed',
  TELEGRAM: 'telegram',
  DISCORD: 'discord',
  MATRIX: 'matrix',
  ZORA: 'zora',
  YOUTUBE: 'youtube',
  PEERTUBE: 'peertube',
  GITHUB: 'github',
  MIRROR: 'mirror',
  PARAGRAPH: 'paragraph',
  EMAIL: 'email',
  PONDER: 'ponder',
  KBIN: 'kbin',
  TILDES: 'tildes',
  WEBHOOK: 'webhook',
  ATPROTO: 'atproto',
  GHOST: 'ghost',
  NEWSROOM: 'newsletter-bridge',
} as const;

// ─── Chains ───────────────────────────────────────────────────────

export const CHAINS = {
  ETHEREUM: 'ethereum',
  SOLANA: 'solana',
  BASE: 'base',
  POLYGON: 'polygon',
  ARBITRUM: 'arbitrum',
  OPTIMISM: 'optimism',
} as const;

// ─── Content Categories ───────────────────────────────────────────

export const CATEGORIES = [
  'crypto',
  'defi',
  'nft',
  'ai',
  'oss',
  'security',
  'gaming',
  'music',
  'art',
  'social',
  'news',
  'memes',
  'trading',
  'governance',
  'dao',
  'infra',
  'privacy',
  'identity',
] as const;

// ─── CSRF Exempt Paths (prefixes) ─────────────────────────────────

export const CSRF_EXEMPT_PATHS = ['/api/tip/frame/', '/api/blink/tip', '/api/x402/verify'] as const;

// ─── CSRF Skip Prefixes (auth routes use their own nonce-based protection) ─

export const CSRF_SKIP_PREFIXES = ['/api/auth/'] as const;

// ─── Static Redirects ─────────────────────────────────────────────

export const STATIC_REDIRECTS: Record<string, string> = {
  '/docs': 'https://app.degenfeed.xyz/docs',
  '/about': 'https://app.degenfeed.xyz/about',
  '/faq': 'https://app.degenfeed.xyz/faq',
  '/legal': 'https://app.degenfeed.xyz/legal',
  '/privacy': 'https://app.degenfeed.xyz/privacy',
  '/terms': 'https://app.degenfeed.xyz/terms',
  '/premium': 'https://app.degenfeed.xyz/premium',
  '/status': 'https://app.degenfeed.xyz/status',
  '/home': 'https://app.degenfeed.xyz/home',
} as const;

// ─── Default Relay URLs ──────────────────────────────────────────

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
] as const;

// ─── RMI Backend API ────────────────────────────────────────────
// Self-hosted persistent backend (Talos). Used for cross-isolate rate
// limit enforcement and as the persistent store replacing Cloudflare KV.

export const RMI_API_URL = 'https://api.rugmunch.io';

// ─── Default Protocol API URLs ───────────────────────────────────

export const DEFAULT_API_URLS = {
  FARCASTER_HUB: 'https://hub.farcaster.standardcrypto.vc:2281',
  FARCASTER_HUB_ALT: 'https://hub-grpc.pinata.cloud',
  LENS_API: 'https://api.lens.xyz/graphql',
  LENS_API_ALT: 'https://api-v2.lens.dev/graphql',
  BSKY_PUBLIC: 'https://public.api.bsky.app',
  BSKY_SOCIAL: 'https://bsky.social',
  THREADS_PUBLIC: 'https://public.threads.net',
  GTS_DEFAULT: 'https://social.degenfeed.xyz',
  GTS_API_BASE: 'https://social.degenfeed.xyz',
  MIRROR_GRAPHQL: 'https://mirror.xyz/graphql',
  MIRROR_ARWEAVE: 'https://arweave.net',
  MIRROR_OPTIMISM_RPC: 'https://mainnet.optimism.io',
  PARAGRAPH_API: 'https://paragraph.xyz/api',
  COINTELEGRAPH_RSS: 'https://cointelegraph.com/rss',
  DECRYPT_RSS: 'https://decrypt.co/feed',
} as const;

// ─── Scoring Weights ─────────────────────────────────────────────

export const SCORING = {
  RECENCY_HALF_LIFE_HOURS: 12,
  VELOCITY_WINDOW_HOURS: 4,
  QUALITY_ORIGINAL_CONTENT_BONUS: 3,
  QUALITY_MEDIA_BONUS: 1,
  QUALITY_LENGTH_PENALTY: -2,
  SPAM_THRESHOLD: 0.7,
  SPAM_DROP_THRESHOLD: 0.9,
} as const;
