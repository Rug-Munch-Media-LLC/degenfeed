/**
 * @degenfeed/api-worker — Main router
 *
 * Dispatches requests to route handler modules.
 * Shared utilities (Env, rateLimit, jsonResponse, GTS config) are
 * re-exported for route module use.
 */

import { isAllowedOrigin, parseOriginHeader } from './cors';
import { handleCron } from './routes/cron';

// ─── Environment variables ───────────────────────────────────────────

export interface Env {
  AUTH_SECRET?: string;
  CACHE?: KVNamespace;
  SUBSCRIPTIONS?: KVNamespace;
  BOOKMARKS?: KVNamespace;
  IDENTITIES?: KVNamespace;
  GTS_CLIENT_ID?: string;
  GTS_CLIENT_SECRET?: string;
  GTS_INSTANCE_URL?: string;
  GTS_API_BASE?: string;
  GTS_REDIRECT_URI?: string;
  RELAY_URLS?: string;
  FARCASTER_HUB_URL?: string;
  LENS_API_URL?: string;
  BSKY_PUBLIC_URL?: string;
  BSKY_SOCIAL_URL?: string;
  THREADS_PDS_URL?: string;
  THREADS_APP_ID?: string;
  THREADS_APP_SECRET?: string;
  FARCASTER_CLIENT_ID?: string;
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  TWITTER_CLIENT_ID?: string;
  TWITTER_CLIENT_SECRET?: string;
  TELEGRAM_BOT_NAME?: string;
  TELEGRAM_BOT_TOKEN?: string;
  RATE_WINDOW_MS?: string;
  RATE_MAX_REQ?: string;
  /** When "true", disables in-process rate limiting (use only for local dev). */
  RATE_LIMIT_DISABLED?: string;
  /** Comma-separated list of allowed CORS origins for state-changing requests. */
  ALLOWED_ORIGINS?: string;
  SOLANA_RPC_URL?: string;
  /** Base URL of the rmi-backend (default: http://127.0.0.1:8000) */
  /** Ethereum RPC URL for transaction simulation */
  ETH_RPC_URL?: string;
  RMI_BACKEND_URL?: string;
  /** Bridge service internal URL for protocol feed fetching */
  BRIDGE_INTERNAL_URL?: string;
  /** Self-hosted Redlib instance for Reddit feed proxying */
  REDLIB_URL?: string;
  /** Self-hosted RSS-Bridge instance for proxied RSS feed fetching */
  RSS_BRIDGE_URL?: string;
  /** Owncast instance URL for live streaming clips */
  OWCAST_INSTANCE_URL?: string;
  /** Comma-separated list of Lemmy instances to fetch from */
  LEMMY_INSTANCES?: string;
  /** Comma-separated list of Pixelfed instances to fetch from */
  PIXELFED_INSTANCES?: string;
  /** Optional bearer for rmi-backend if gated */
  RMI_API_KEY?: string;
  /** Optional Sentry DSN for error reporting */
  SENTRY_DSN?: string;
  /** Neynar API key for Farcaster follower counts */
  NEYNAR_API_KEY?: string;
  /** API key for MeiliSearch (production requires Authorization: Bearer <key>) */
  MEILI_SEARCH_KEY?: string;
  /** Optional Postmark server token for transactional email delivery */
  POSTMARK_SERVER_TOKEN?: string;
  /** XMTP private key for XMTP transport delivery */
  XMTP_KEY?: string;
  /** Matrix access token for Matrix transport */
  MATRIX_ACCESS_TOKEN?: string;
  /** Matrix instance URL */
  MATRIX_INSTANCE_URL?: string;
  /** Bluesky access token for AT Protocol chat */
  BSKY_ACCESS_TOKEN?: string;

  // ─── Castopod (Podcast Hosting) ──────────────────────────────────────
  /** Castopod instance URL (default: http://127.0.0.1:8088) */
  CASTOPOD_INSTANCE_URL?: string;
  /** Castopod API token for automated podcast/episode creation */
  CASTOPOD_API_TOKEN?: string;

  // ─── Email Engine (Newsletter) ──────────────────────────────────────
  /** Mailgun API key for primary email delivery */
  MAILGUN_API_KEY?: string;
  /** Mailgun sending domain */
  MAILGUN_DOMAIN?: string;
  /** SendGrid API key for backup email delivery */
  SENDGRID_API_KEY?: string;
  /** From address for all newsletter emails */
  EMAIL_FROM_ADDRESS?: string;
  /** From name for all newsletter emails */
  EMAIL_FROM_NAME?: string;
  /** Base URL for generating absolute links in emails */
  EMAIL_BASE_URL?: string;

  ALLOW_DEV_OAUTH?: string;
  /** KV namespace for cross-protocol community records */
  COMMUNITIES?: KVNamespace;
  /** @deprecated Use PUSH_API_KEY or NEWSLETTER_API_KEY instead. Retained for backward compatibility. */
  ADMIN_API_KEY?: string;
  /** Scoped API key for push notification sending (Bearer token). */
  PUSH_API_KEY?: string;
  /** Scoped API key for newsletter admin operations (subscriber count, etc.). */
  NEWSLETTER_API_KEY?: string;
  /** VAPID keys for Web Push (generate with: npx web-push generate-vapid-notes) */
  VAPID_SUBJECT?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  /** Comma-separated list of feature flag keys that default to enabled */
  FEATURE_FLAGS_DEFAULT?: string;
  /** KV namespace for deployment requests */
  DEPLOYMENTS?: KVNamespace;
  /** KV namespace for reports, bans, and moderation state */
  REPORTS?: KVNamespace;
  /** When "true", enables real on-chain creator coin deployments. When false/absent, returns "coming soon" */
  ENABLE_REAL_DEPLOYMENTS?: string;
  /** Factory contract address for creator coin deployments on Base (Zora or DegenFeed factory) */
  COIN_FACTORY_ADDRESS?: string;
  /** Factory contract address for creator coin deployments on Base Sepolia testnet */
  COIN_FACTORY_ADDRESS_TESTNET?: string;
  /** Comma-separated admin wallet addresses (lowercase) for moderation dashboard access */
  ADMIN_WALLETS?: string;
  /** PeerTube instance URL for livestreams (default: https://video.degenfeed.xyz) */
  PEERTUBE_INSTANCE_URL?: string;
  /** PeerTube OAuth2 client ID for API authentication */
  PEERTUBE_CLIENT_ID?: string;
  /** PeerTube OAuth2 client secret for API authentication */
  PEERTUBE_CLIENT_SECRET?: string;
  /** Nostr private key hex for publishing live event kind 30311 */
  NOSTR_PRIVATE_KEY?: string;
  /** Bluesky DID for AT Protocol posting */
  BSKY_DID?: string;
  /** YouTube Data API v3 key for channel discovery */
  YOUTUBE_API_KEY?: string;
  /** Twitch Client ID for Helix API (app access token flow) */
  TWITCH_CLIENT_ID?: string;
  /** Twitch Client Secret for Helix API */
  TWITCH_CLIENT_SECRET?: string;
  /** Comma-separated list of extra PeerTube instance URLs to fetch live from */
  PEERTUBE_EXTRA_INSTANCES?: string;

  // ─── Centralized Platform OAuth Credentials ──────────────────────
  /** Medium OAuth client ID (requires OAuth app in Medium settings) */
  MEDIUM_CLIENT_ID?: string;
  /** Medium OAuth client secret */
  MEDIUM_CLIENT_SECRET?: string;
  /** LinkedIn OAuth client ID (requires LinkedIn Developer App) */
  LINKEDIN_CLIENT_ID?: string;
  /** LinkedIn OAuth client secret */
  LINKEDIN_CLIENT_SECRET?: string;
  /** Instagram Basic Display / Graph API App ID */
  INSTAGRAM_APP_ID?: string;
  /** Instagram App Secret */
  INSTAGRAM_APP_SECRET?: string;
  /** Pinterest OAuth client ID (requires Pinterest Developer App) */
  PINTEREST_CLIENT_ID?: string;
  /** Pinterest OAuth client secret */
  PINTEREST_CLIENT_SECRET?: string;
  /** TikTok OAuth client key (requires TikTok Developer App) */
  TIKTOK_CLIENT_KEY?: string;
  /** TikTok OAuth client secret */
  TIKTOK_CLIENT_SECRET?: string;

  /** KV namespace for Audio Spaces data */
  SPACES?: KVNamespace;

  /** KV namespace for API key storage (v1 public API) */
  API_KEYS?: KVNamespace;

  /** KV namespace for token community content — comments, streams, badges, milestones */
  CONTENT_STORE?: KVNamespace;

  /** KV namespace for DAO governance data (proposals, votes) */
  GOVERNANCE?: KVNamespace;

  /** KV namespace for Feddy Communities — ActivityPub federated groups */
  FEDDY?: KVNamespace;

  /** KV namespace for reputation scores, history, and leaderboard */
  REPUTATION?: KVNamespace;

  /** KV namespace for content permanence proofs */
  PERMANENCE?: KVNamespace;

  /** KV namespace for global dedup registry */
  DEDUP?: KVNamespace;
  /** KV namespace for per-user seen content tracking */
  SEEN?: KVNamespace;

  /** KV namespace for Farcaster creator coin records */
  FARCASTER_COINS?: KVNamespace;
  /** KV namespace for Lens Protocol creator coin records */
  LENS_COINS?: KVNamespace;
  /** KV namespace for cross-chain token registrations */
  XCHAIN_REGISTRY?: KVNamespace;

  /** KV namespace for DegenFeed multi-type streaming system — solo, spaces, collab, coin-launch */
  STREAMS?: KVNamespace;
  /** Zora wrapper factory contract address (Base) */
  ZORA_WRAPPER_FACTORY?: string;
  /** Wormhole bridge address for cross-chain tips */
  WORMHOLE_BRIDGE?: string;

  /** KV namespace for custom feed storage */
  CUSTOM_FEEDS?: KVNamespace;
  /** KV namespace for creator coin treasury fee tracking */
  TREASURY?: KVNamespace;

  // ─── Postiz cross-posting ───────────────────────────────────────────
  /** Postiz API base URL (e.g. "http://postiz:3000" or "https://api.postiz.com") */
  POSTIZ_BASE_URL?: string;
  /** Postiz API key (from Settings > Developers > Public API) */
  POSTIZ_API_KEY?: string;
  /**
   * JSON-encoded map of platform → Postiz integration ID.
   * Example: '{"mastodon":"int-abc","bluesky":"int-def"}'
   */
  POSTIZ_INTEGRATIONS?: string;

  // ─── Cross-platform registration ─────────────────────────────────────
  /** KV namespace for storing platform account records */
  PLATFORM_ACCOUNTS?: KVNamespace;
  /** KV namespace for Bluesky invite code pool */
  BLUESKY_INVITE_POOL?: KVNamespace;
  /** Base chain (Farcaster) RPC URL */
  BASE_RPC_URL?: string;
  /** Base Sepolia testnet RPC URL (default: https://sepolia.base.org) */
  BASE_SEPOLIA_RPC_URL?: string;
  /** Solana devnet RPC URL (default: https://api.devnet.solana.com) */
  SOLANA_DEVNET_RPC_URL?: string;
  /** Polygon chain (Lens) RPC URL */
  POLYGON_RPC_URL?: string;
  /** Private key of the premium wallet for paying on-chain registration fees */
  PREMIUM_WALLET_KEY?: string;
  /** Application base URL — e.g. https://app.degenfeed.xyz */
  APP_BASE_URL?: string;
  /** GoToSocial instance URL (ActivityPub-compatible Mastodon API) for account creation */
  GOTOSOCIAL_INSTANCE_URL?: string;
  /** Lemmy instance URL for account creation */
  LEMMY_INSTANCE_URL?: string;
  /** Pixelfed instance URL for account creation */
  PIXELFED_INSTANCE_URL?: string;
  /** Nostr relay URLs (comma-separated) */
  NOSTR_RELAYS?: string;

  // ─── Self-hosted infrastructure URLs ────────────────────────────────────
  /** AT Protocol PDS instance URL — pds.degenfeed.xyz */
  PDS_INSTANCE_URL?: string;
  /** Nostr relay instance URL — relay.degenfeed.xyz */
  RELAY_INSTANCE_URL?: string;
  /** Matrix homeserver URL — matrix.degenfeed.xyz */
  MATRIX_INSTANCE_URL?: string;
  /** Ghost CMS instance URL — articles.degenfeed.xyz */
  GHOST_INSTANCE_URL?: string;
  /** WriteFreely instance URL — blog.degenfeed.xyz */
  WRITEFREELY_INSTANCE_URL?: string;
  /** Owncast instance URL — live.degenfeed.xyz */
  OWNCAST_INSTANCE_URL?: string;
  /** Mobilizon instance URL — events.degenfeed.xyz */
  MOBILIZON_INSTANCE_URL?: string;

  // ─── Content permanence (Pinata IPFS) ────────────────────────────────
  /** web3.storage API key for IPFS uploads (free tier: 1TB, works without key) */
  WEB3_STORAGE_API_KEY?: string;
  /** Pinata API key for IPFS pinning (Content Permanence API) */
  PINATA_API_KEY?: string;
  /** Pinata secret key for IPFS pinning (Content Permanence API) */
  PINATA_SECRET_KEY?: string;

  // ─── Live Shorts / Protocol Streaming ──────────────────────────────
  /** Farcaster signer private key hex for live short frame posting */
  FARCASTER_SIGNER_KEY?: string;
  /** Farcaster FID for the bot account used for live short announcements */
  FARCASTER_FID?: string;
  /** Bluesky access JWT for AT Protocol live short announcements */
  BSKY_ACCESS_TOKEN?: string;
  /** Lens API access token for Lens live short publishing */
  LENS_ACCESS_TOKEN?: string;
  /** Livepeer Studio API key for Livepeer-backed streaming (Zora, generic) */
  LIVEPEER_API_KEY?: string;
  /** Cloudflare Stream API token for enterprise CDN streaming */
  CLOUDFLARE_STREAM_TOKEN?: string;
  /** Cloudflare Stream account ID */
  CLOUDFLARE_STREAM_ACCOUNT_ID?: string;
  /** WebRTC STUN/TURN server URLs (comma-separated) */
  WEBRTC_STUN_SERVERS?: string;
  /** WebRTC TURN server credentials (JSON: {url, username, credential}) */
  WEBRTC_TURN_CREDENTIALS?: string;

  // ─── Ghost CMS headless ──────────────────────────────────────────────
  /** Ghost CMS site URL (e.g. https://blog.degenfeed.xyz) */
  GHOST_URL?: string;
  /** Ghost Admin API key (id:secret format) */
  GHOST_ADMIN_KEY?: string;
  /** Ghost Content API key (optional, falls back to Admin key) */
  GHOST_CONTENT_KEY?: string;
  /** KV namespace for Ghost subscriber data */
  GHOST_SUBSCRIBERS?: KVNamespace;
  /** KV namespace for Ghost tip records */
  GHOST_TIPS?: KVNamespace;

  // ─── Content Library ────────────────────────────────────────────────
  /** KV namespace for the unified content library — all creator content stored here */
  CONTENT_LIBRARY?: KVNamespace;
  /** SendGrid or Mailgun API key for email delivery */
  EMAIL_API_KEY?: string;
  /** Email provider: 'sendgrid' | 'mailgun' */
  EMAIL_PROVIDER?: string;
  /** From address for newsletter emails */
  EMAIL_FROM?: string;

  // ─── Lemmy Bridge ───────────────────────────────────────────────────────
  /** JWT for the DegenFeed Lemmy bot account (for cross-posting & commenting) */
  LEMMY_BOT_JWT?: string;
  /** GoToSocial/Mastodon bot token for sharing Lemmy posts */
  GTS_BOT_TOKEN?: string;
  /** Nostr bot nsec for sharing Lemmy posts as kind 1 notes */
  NOSTR_BOT_NSEC?: string;
  /** Bluesky/ATProtocol bot identifier (handle or email) */
  BSKY_BOT_IDENTIFIER?: string;
  /** Bluesky/ATProtocol bot password */
  BSKY_BOT_PASSWORD?: string;
  /** Farcaster bot mnemonic for publishing casts */
  FARCASTER_BOT_MNEMONIC?: string;

  // ─── Mirror.xyz Bridge ───────────────────────────────────────────────
  /** Mirror.xyz GraphQL API URL (default: https://mirror.xyz/graphql) */
  MIRROR_GRAPHQL_URL?: string;
  /** Arweave gateway URL (default: https://arweave.net) */
  MIRROR_ARWEAVE_GATEWAY?: string;
  /** Optimism RPC URL for Writing NFT minting (default: https://mainnet.optimism.io) */
  MIRROR_OPTIMISM_RPC?: string;

  // ─── Paragraph.xyz Bridge ────────────────────────────────────────────
  /** Paragraph.xyz API URL (default: https://paragraph.xyz/api) */
  PARAGRAPH_API_URL?: string;
  /** Paragraph API key */
  PARAGRAPH_API_KEY?: string;

  // ─── Unified Shorts ──────────────────────────────────────────────────
  /** KV namespace for unified shorts (cross-protocol short-form video) */
  SHORTS?: KVNamespace;
  /** Zora video NFT contract address */
  ZORA_VIDEO_CONTRACT?: string;
  /** CDN base URL for short video content */
  DEGENFEED_CDN_URL?: string;

  // ─── Video Platform Wrappers ────────────────────────────────────────
  /** Zora API relayer for on-chain operations */
  ZORA_RELAYER_URL?: string;
  /** x402 relayer for payment-gated content */
  X402_RELAYER_URL?: string;
  /** Farcaster watchlist for live activity monitoring */
  FARCASTER_WATCHLIST?: string;

  // ─── Decentralized Media Storage (Images, Audio, Documents) ────────────
  /** R2 bucket binding for media storage fallback */
  MEDIA_STORAGE_BINDING?: R2Bucket;
  /** R2 bucket binding for video storage (used by video-storage.ts) */
  VIDEO_STORAGE_BINDING?: R2Bucket;
  /** KV namespace for media metadata (image dimensions, creator links, storage stats) */
  MEDIA_METADATA?: KVNamespace;
  /** Irys node URL for Arweave uploads (default: https://node1.irys.xyz) */
  IRYS_NODE_URL?: string;
  /** Irys/Arweave wallet private key (for platform-paid permanent storage) */
  ARWEAVE_WALLET_KEY?: string;
  /** Currency for Arweave/Irys payments (default: matic) */
  ARWEAVE_CURRENCY?: string;
  /** Custom IPFS gateway base URL for dedicated CDN (optional) */
  IPFS_GATEWAY_URL?: string;
  /** Media transformation service URL (e.g. Cloudflare Image Resizing) */
  IMAGE_TRANSFORM_URL?: string;

  // ─── SSO (Single Sign-On) Infrastructure ──────────────────────────────
  /** KV namespace for SSO session data and wallet state (aliases to IDENTITIES) */
  SSO_STATE?: KVNamespace;

  // ─── Self-hosted image galleries (Immich/Lychee) ─────────────────────
  /** Immich server URL (e.g. https://photos.example.com) */
  IMMICH_URL?: string;
  /** Immich API key */
  IMMICH_API_KEY?: string;
}

// ─── Shared constants ────────────────────────────────────────────────

export function log(level: 'info' | 'warn' | 'error', msg: string, data?: unknown): void {
  console.log(
    JSON.stringify({
      l: level,
      m: msg,
      t: Date.now(),
      ...(data ? { d: data } : {}),
    }),
  );
}

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
];
export const FARCASTER_HUBS = [
  'https://hub.farcaster.standardcrypto.vc:2281',
  'https://hub-grpc.pinata.cloud',
];
export const LENS_APIS = ['https://api.lens.xyz/graphql', 'https://api-v2.lens.dev/graphql'];
export const BSKY_PUBLIC = 'https://public.api.bsky.app';
export const BSKY_SOCIAL = 'https://bsky.social';
export const THREADS_PUBLIC = 'https://public.threads.net';

// ─── Rate limiting ───────────────────────────────────────────────────

const DEFAULT_RATE_WINDOW = 5000;
const DEFAULT_RATE_MAX = 20;

interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

/**
 * KV-backed fixed-window rate limiter.
 *
 * Cloudflare Workers can spin up many isolates per zone, so any in-memory
 * counter is unreliable. We use the CACHE KV namespace with a per-bucket
 * TTL equal to the window. Each bucket key = `${ip}:${path}:${windowMs/1000}`,
 * storing a JSON `{ count, resetAt }`. The bucket auto-expires after one
 * window so the counter resets.
 *
 * If `CACHE` is not bound (local dev), the function falls back to a
 * permissive "always allow" result and logs once — never blocks real users.
 */
export async function rateLimit(
  env: Env,
  ip: string,
  path: string,
  maxReq: number = DEFAULT_RATE_MAX,
  windowMs: number = DEFAULT_RATE_WINDOW,
): Promise<RateLimitResult> {
  if (env.RATE_LIMIT_DISABLED === 'true') {
    return { allowed: true, retryAfter: 0 };
  }
  if (!env.CACHE) {
    // No KV bound (local dev). Skip throttling so the dev experience works.
    return { allowed: true, retryAfter: 0 };
  }
  const bucketSec = Math.max(1, Math.ceil(windowMs / 1000));
  const key = `rl:${ip}:${path}:${bucketSec}`;
  const now = Date.now();
  const resetAt = now + windowMs;

  let count = 1;
  try {
    const raw = await env.CACHE.get(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { count: number; resetAt: number };
      if (parsed.resetAt > now) {
        count = parsed.count + 1;
      }
    }
    // TTL covers the window so the key expires automatically.
    await env.CACHE.put(key, JSON.stringify({ count, resetAt }), {
      expirationTtl: bucketSec,
    });
  } catch {
    // KV hiccup — fail open so a single KV outage doesn't break the API.
    return { allowed: true, retryAfter: 0 };
  }

  if (count > maxReq) {
    return { allowed: false, retryAfter: Math.max(0, resetAt - now) };
  }
  return { allowed: true, retryAfter: 0 };
}

// ─── Tiered rate limiters ────────────────────────────────────────────
// These build on the KV-backed rateLimit() to provide context-aware
// rate limiting for specific attack vectors:
//
//   Brute force:  wallet verify → 5/min → after 3 failures, 1/min for 30min
//   Enumeration:  email/username checks → 3/min with exponential backoff
//   Scraping:     feed endpoints → 30/min anonymous, 120/min authenticated
//   DDoS:         global 1000 req/min across all IPs
//   Admin:        10/min with wallet-specific tracking
//
// Failure counters use a separate KV prefix so they don't interfere with
// the main rate limit counters.

const BRUTE_FORCE_MAX = 5;
const BRUTE_FORCE_WINDOW_MS = 60_000;
const BRUTE_FORCE_BLOCK_MAX = 3;
const BRUTE_FORCE_BLOCK_WINDOW_MS = 1_800_000; // 30 minutes
const BRUTE_FORCE_BLOCK_RATE = 1; // 1 req/min when blocked
const BRUTE_FORCE_BLOCK_RATE_WINDOW_MS = 60_000;

const ENUMERATION_MAX = 3;
const ENUMERATION_WINDOW_MS = 60_000;
const ENUMERATION_BACKOFF_BASE_MS = 10_000; // Start at 10s
const ENUMERATION_BACKOFF_MAX_MS = 300_000; // Cap at 5min

const ANON_SCRAPE_MAX = 30;
const AUTH_SCRAPE_MAX = 120;
const SCRAPE_WINDOW_MS = 60_000;

const GLOBAL_DDOS_MAX = 1000;
const GLOBAL_DDOS_WINDOW_MS = 60_000;

const ADMIN_MAX = 10;
const ADMIN_WINDOW_MS = 60_000;

/**
 * Check if a path is a feed/scrape endpoint.
 */
function isScrapePath(path: string): boolean {
  return (
    path.startsWith('/api/feed/') ||
    path.startsWith('/api/discover/') ||
    path.startsWith('/api/search/') ||
    path.startsWith('/api/shorts/feed') ||
    path.startsWith('/api/shorts/trending') ||
    path.startsWith('/api/shorts/for-you')
  );
}

/**
 * Check if a path is an enumeration-susceptible endpoint.
 */
function isEnumerationPath(path: string): boolean {
  return (
    path === '/api/auth/email/register' ||
    path === '/api/auth/email/signin' ||
    path === '/api/auth/email/status' ||
    path === '/api/auth/email/password-reset' ||
    path === '/api/auth/email/password-reset/confirm'
  );
}

/**
 * Check if a path is an admin endpoint.
 */
function isAdminPath(path: string): boolean {
  return path.startsWith('/api/admin/');
}

/**
 * Check if a path is a brute-force target (wallet verify).
 */
function isBruteForcePath(path: string): boolean {
  return path === '/api/auth/wallet/verify';
}

/**
 * Tiered rate limit dispatch.
 *
 * Returns the appropriate rate limit for the request context.
 * More specific checks (brute force, enumeration) take priority over
 * general scraping/DDoS limits.
 */
export async function tieredRateLimit(
  env: Env,
  ip: string,
  path: string,
  isAuthenticated: boolean,
): Promise<RateLimitResult> {
  if (env.RATE_LIMIT_DISABLED === 'true') {
    return { allowed: true, retryAfter: 0 };
  }
  if (!env.CACHE) {
    return { allowed: true, retryAfter: 0 };
  }

  // ── Brute force protection (wallet verify) ─────────────────────
  if (isBruteForcePath(path)) {
    const failureKey = `bf:fail:${ip}`;
    const now = Date.now();

    // Check failure count in the current window
    let failureCount = 0;
    try {
      const raw = await env.CACHE.get(failureKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { count: number; resetAt: number };
        if (parsed.resetAt > now) {
          failureCount = parsed.count;
        }
      }
    } catch {
      // KV hiccup — fail open
    }

    // If in blocked state (>3 failures), use stricter rate
    if (failureCount >= BRUTE_FORCE_BLOCK_MAX) {
      return rateLimit(env, ip, path, BRUTE_FORCE_BLOCK_RATE, BRUTE_FORCE_BLOCK_RATE_WINDOW_MS);
    }

    // Normal: 5/min
    return rateLimit(env, ip, path, BRUTE_FORCE_MAX, BRUTE_FORCE_WINDOW_MS);
  }

  // ── Enumeration protection ─────────────────────────────────────
  if (isEnumerationPath(path)) {
    // Count attempts for this IP
    const enumKey = `enum:${ip}:${path}`;
    const now = Date.now();

    let attempts = 0;
    try {
      const raw = await env.CACHE.get(enumKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { count: number; resetAt: number };
        if (parsed.resetAt > now) {
          attempts = parsed.count;
        }
      }
    } catch {
      // KV hiccup — fail open
    }

    // Exponential backoff: each attempt beyond the first increases the window
    // Window = base * 2^(attempts - ENUMERATION_MAX), capped at max
    let windowMs = ENUMERATION_WINDOW_MS;
    if (attempts >= ENUMERATION_MAX) {
      const extraAttempts = attempts - ENUMERATION_MAX + 1;
      windowMs = Math.min(
        ENUMERATION_BACKOFF_BASE_MS * 2 ** extraAttempts,
        ENUMERATION_BACKOFF_MAX_MS,
      );
      return rateLimit(env, ip, path, 1, windowMs);
    }

    // Track attempt count
    const bucketSec = Math.max(1, Math.ceil(ENUMERATION_WINDOW_MS / 1000));
    const resetAt = now + ENUMERATION_WINDOW_MS;
    try {
      await env.CACHE.put(enumKey, JSON.stringify({ count: attempts + 1, resetAt }), {
        expirationTtl: bucketSec,
      });
    } catch {
      // Non-critical
    }

    return rateLimit(env, ip, path, ENUMERATION_MAX, ENUMERATION_WINDOW_MS);
  }

  // ── Scraping protection (feed/search endpoints) ────────────────
  if (isScrapePath(path)) {
    const maxReq = isAuthenticated ? AUTH_SCRAPE_MAX : ANON_SCRAPE_MAX;
    return rateLimit(env, ip, path, maxReq, SCRAPE_WINDOW_MS);
  }

  // ── Admin endpoints ────────────────────────────────────────────
  if (isAdminPath(path)) {
    return rateLimit(env, ip, path, ADMIN_MAX, ADMIN_WINDOW_MS);
  }

  // ── Global DDoS protection ─────────────────────────────────────
  // Count requests across ALL paths for this IP
  const globalKey = `rl:global:${ip}`;
  const globalBucketSec = Math.max(1, Math.ceil(GLOBAL_DDOS_WINDOW_MS / 1000));
  const now = Date.now();
  const globalResetAt = now + GLOBAL_DDOS_WINDOW_MS;

  let globalCount = 1;
  try {
    const raw = await env.CACHE.get(globalKey);
    if (raw) {
      const parsed = JSON.parse(raw) as { count: number; resetAt: number };
      if (parsed.resetAt > now) {
        globalCount = parsed.count + 1;
      }
    }
    await env.CACHE.put(globalKey, JSON.stringify({ count: globalCount, resetAt: globalResetAt }), {
      expirationTtl: globalBucketSec,
    });
  } catch {
    // KV hiccup — fail open
  }

  if (globalCount > GLOBAL_DDOS_MAX) {
    return { allowed: false, retryAfter: Math.max(0, globalResetAt - now) };
  }

  // ── Default: use the existing per-path rate limit ──────────────
  const maxReq = Number(env.RATE_MAX_REQ) || DEFAULT_RATE_MAX;
  const windowMs = Number(env.RATE_WINDOW_MS) || DEFAULT_RATE_WINDOW;
  return rateLimit(env, ip, path, maxReq, windowMs);
}

/**
 * Record a failed brute force attempt.
 * Called by the wallet verify handler when signature verification fails.
 */
export async function recordBruteForceFailure(env: Env, ip: string): Promise<void> {
  if (!env.CACHE) return;
  const failureKey = `bf:fail:${ip}`;
  const now = Date.now();
  const windowMs = BRUTE_FORCE_BLOCK_WINDOW_MS;
  const bucketSec = Math.max(1, Math.ceil(windowMs / 1000));

  let count = 1;
  try {
    const raw = await env.CACHE.get(failureKey);
    if (raw) {
      const parsed = JSON.parse(raw) as { count: number; resetAt: number };
      if (parsed.resetAt > now) {
        count = parsed.count + 1;
      }
    }
    const resetAt = now + windowMs;
    await env.CACHE.put(failureKey, JSON.stringify({ count, resetAt }), {
      expirationTtl: bucketSec,
    });
  } catch {
    // Non-critical
  }
}

// Rate limit cleanup inline in rateLimit() — avoids global setInterval (CF Workers restriction)

// ─── GotoSocial config ───────────────────────────────────────────────

export const GTS_AUTH_CONFIG = {
  clientId: '', // Must be set via GTS_CLIENT_ID env var
  clientSecret: '', // Must be set via GTS_CLIENT_SECRET env var
  instanceUrl: 'https://social.degenfeed.xyz',
  apiBase: 'https://social.degenfeed.xyz',
  redirectUri: 'https://degenfeed.xyz/auth/callback',
  scopes: 'read write follow push',
};

export function getGtsConfig(env: Env) {
  return {
    clientId: env.GTS_CLIENT_ID ?? GTS_AUTH_CONFIG.clientId,
    clientSecret: env.GTS_CLIENT_SECRET ?? GTS_AUTH_CONFIG.clientSecret,
    instanceUrl: env.GOTOSOCIAL_INSTANCE_URL ?? GTS_AUTH_CONFIG.instanceUrl,
    apiBase: env.GOTOSOCIAL_INSTANCE_URL ?? GTS_AUTH_CONFIG.apiBase,
    redirectUri: env.GTS_REDIRECT_URI ?? GTS_AUTH_CONFIG.redirectUri,
    scopes: GTS_AUTH_CONFIG.scopes,
  };
}

// ─── Response helper ─────────────────────────────────────────────────

/**
 * @deprecated Use response-helpers.ts (ok/created/badRequest/unauthorized/notFound/serverError) instead.
 * response-helpers.ts wraps responses in a consistent { data } envelope.
 * Routes using jsonResponse() should be migrated to response-helpers for consistency.
 * Migrated routes: health.ts
 */
export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'cache-control': 'public, max-age=30',
    ...extraHeaders,
  };
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

export function noCacheJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, must-revalidate',
    },
  });
}

// ─── CORS / CSRF helpers ─────────────────────────────────────────────

const CSRF_EXEMPT_PATHS = [
  // /api/auth/gotosocial/callback is now protected by a signed state nonce
  // (see routes/auth.ts) AND a normal origin check, so it's no longer exempt.
  '/api/tip/frame/',
  // '/api/bridge/rss-to-nostr' is NO LONGER exempt — requires CSRF check
  '/api/blink/tip',
  '/api/x402/verify',
];

function _isStateChanging(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'DELETE';
}

function isCsrfExempt(path: string): boolean {
  return CSRF_EXEMPT_PATHS.some((prefix) => path.startsWith(prefix));
}

function _validateOrigin(request: Request, path: string, env: Env): boolean {
  if (isCsrfExempt(path)) return true;
  const origin = request.headers.get('origin');
  if (origin) return isAllowedOrigin(origin, env.ALLOWED_ORIGINS);
  const referer = request.headers.get('referer');
  if (referer) {
    const refererOrigin = parseOriginHeader(referer);
    return refererOrigin ? isAllowedOrigin(refererOrigin, env.ALLOWED_ORIGINS) : false;
  }
  return false;
}

// ─── Cron handler ───────────────────────────────────────────────

/**
 * Called by the CF Workers cron trigger.
 *
 * Schedules:
 *   every-1-min  — scheduled post executor
 *   every-30-min — trending content scraper
 *   daily-14:00  — daily digest + trending refresh
 *   sun-12:00    — weekly source discovery + health maintenance
 *
 * The controller.cron field tells us which cron matched.
 * Re-exported from app.ts for the wrangler entry point.
 */
export async function scheduled(
  controller: { cron: string; scheduledTime: number; noRetry: () => void },
  env: Env,
): Promise<void> {
  const cron = controller.cron;

  // ── Every minute: scheduled post executor + sync queue processing ──
  if (cron === '* * * * *') {
    // Execute scheduled posts
    const { executeScheduledPosts } = await import('./routes/scheduled-executor');
    await executeScheduledPosts(env).catch((err) =>
      log('warn', '[scheduled] scheduled post executor failed', err),
    );

    // Execute content syndication queue
    try {
      const { executeDueSyndicationRules } = await import('./routes/content-syndication-routes');
      const synced = await executeDueSyndicationRules(env);
      if (synced > 0) {
        log('info', `[scheduled] executed ${synced} syndication rules`);
      }
    } catch (err) {
      log('warn', '[scheduled] syndication executor failed', err);
    }

    // Execute scheduled cross-posts
    const { executeDueScheduledCrossPosts } = await import('./routes/publish');
    const executed = await executeDueScheduledCrossPosts(env).catch((err) => {
      log('warn', '[scheduled] cross-post executor failed', err);
      return 0;
    });
    if (executed > 0) {
      log('info', `[scheduled] executed ${executed} scheduled cross-posts`);
    }

    // Execute premium scheduled posts (Buffer-style scheduling)
    const { executeDuePremiumPosts } = await import('./routes/premium-publish');
    const premiumExecuted = await executeDuePremiumPosts(env).catch((err) => {
      log('warn', '[scheduled] premium executor failed', err);
      return 0;
    });
    if (premiumExecuted > 0) {
      log('info', `[scheduled] executed ${premiumExecuted} premium scheduled posts`);
    }

    // Process realtime sync queue (every 30s effectively, since cron fires every min)
    try {
      const { processQueue } = await import('./lib/sync-queue');
      const { processSyncAction } = await import('./lib/realtime-sync');
      const result = await processQueue(env, processSyncAction, 25);
      if (result.processed > 0) {
        log(
          'info',
          `[scheduled] sync queue processed: ${result.succeeded} succeeded, ${result.failed} failed`,
        );
      }

      // Retry dead letters
      const retried = await retrySyncDeadLetters(env);
      if (retried > 0) {
        log('info', `[scheduled] retried ${retried} dead letter sync entries`);
      }
    } catch (err) {
      log('error', '[scheduled] sync queue processing failed', err);
    }

    // Clean up expired chat messages and files (auto-delete timers)
    try {
      const { handleCleanupCron } = await import('./routes/chat-features');
      const { cleanedMessages, cleanedFiles } = await handleCleanupCron(env);
      if (cleanedMessages > 0 || cleanedFiles > 0) {
        log('info', `[scheduled] chat cleanup: ${cleanedMessages} messages, ${cleanedFiles} files`);
      }
    } catch (err) {
      log('warn', '[scheduled] chat cleanup failed', err);
    }

    return; // No other work on the every-minute tick
  }

  // ── Trending scraper — 30-min and daily ticks ──────────────────────
  const { scrapeTrendingContent } = await import('./routes/trending-scraper');
  await scrapeTrendingContent(env).catch((err) =>
    log('warn', '[scheduled] trending scrape failed', err),
  );

  // ── Daily digest — 14:00 UTC ──────────────────────────────────────
  if (cron === '0 14 * * *') {
    await handleCron(env);

    // Process expired GDPR account deletion requests (24h grace period)
    try {
      const { processPendingDeletions } = await import('./routes/account-delete');
      const result = await processPendingDeletions(env);
      if (result.processed > 0 || result.errors > 0) {
        log('info', '[scheduled] GDPR deletion processing complete', result);
      }
    } catch (err) {
      log('error', '[scheduled] GDPR deletion processing failed', err);
    }

    // ── Curated podcast episode aggregation ──────────────────────
    try {
      const { handlePodcastAggregation } = await import('./routes/podcast-cron');
      const result = await handlePodcastAggregation(env);
      log('info', '[scheduled] curated podcast aggregation complete', {
        totalFetched: result.totalFetched,
        totalPodcasts: result.totalPodcasts,
        durationMs: result.durationMs,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (err) {
      log('error', '[scheduled] podcast aggregation failed', err);
    }
  }

  // ── Weekly source discovery + health maintenance — Sunday 12:00 UTC ──
  if (cron === '0 12 * * 0') {
    // Run discovery
    try {
      const { handleSourcesDiscover } = await import('./routes/source-discovery');
      const discoverReq = new Request('http://localhost/api/sources/discover?platform=all');
      await handleSourcesDiscover(discoverReq, env);
      log('info', '[scheduled] weekly source discovery complete');
    } catch (err) {
      log('error', '[scheduled] source discovery failed', err);
    }

    // Initialize health tracking for newly discovered sources

    // ── Weekly identity re-discovery ────────────────────────────────
    try {
      const { discoverIdentities } = await import('./lib/identity-discovery');
      const { identityKey } = await import('@degenfeed/utils');
      // Scan all wallets with linked identities and re-discover
      // This catches newly created protocol accounts that were linked after initial discovery
      let cursor: string | undefined;
      let rechecked = 0;
      do {
        const list = await env.IDENTITIES?.list({ cursor, limit: 100 });
        if (!list) break;
        cursor = list.cursor;
        for (const key of list.keys) {
          const wallet = key.name.replace('identity:', '');
          if (!wallet.startsWith('0x') && !wallet.startsWith('0x')) continue;
          try {
            await discoverIdentities(wallet, env, { forceRefresh: true });
            rechecked++;
          } catch {
            // Skip wallets that fail — likely stale entries
          }
        }
      } while (cursor);
      log('info', '[scheduled] identity re-discovery complete', { rechecked });
    } catch (err) {
      log('error', '[scheduled] identity re-discovery failed', err);
    }
    try {
      const { initSourceHealth } = await import('./routes/source-health');
      const allSourcesRaw = await env.CACHE?.get('discovered:sources:all');
      if (allSourcesRaw) {
        const allSources = JSON.parse(allSourcesRaw) as Array<{
          id: string;
          platform: string;
          weeklyActivity: number;
          relevanceScore: number;
          score: number;
        }>;
        for (const source of allSources) {
          await initSourceHealth(env, source as Parameters<typeof initSourceHealth>[1]);
        }
      }
      log('info', '[scheduled] health tracking initialized for sources');
    } catch (err) {
      log('error', '[scheduled] health init failed', err);
    }

    // Run health maintenance (stale detection + culling)
    try {
      const { runWeeklyHealthMaintenance } = await import('./routes/source-health');
      const result = await runWeeklyHealthMaintenance(env);
      log(
        'info',
        `[scheduled] health maintenance: ${result.checked} checked, ${result.stale} stale, ${result.culled} culled`,
      );
    } catch (err) {
      log('error', '[scheduled] health maintenance failed', err);
    }

    // Record KV last-run timestamp
    await env.CACHE?.put('discovered:sources:discovery:last-run', String(Date.now()));
  }
}

// ─── Helper: retry sync dead letters ─────────────────────────────────────

async function retrySyncDeadLetters(env: Env): Promise<number> {
  try {
    const { retryDeadLetters } = await import('./lib/sync-queue');
    return retryDeadLetters(env, 50);
  } catch {
    return 0;
  }
}
