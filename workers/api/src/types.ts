/**
 * @degenfeed/api-worker — Shared types
 *
 * Central type definitions used across the API worker.
 * Extracted from index.ts to break circular dependency chains.
 */

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
  /** Self-hosted Lens indexer URL (default: http://127.0.0.1:8099) */
  LENS_INDEXER_URL?: string;
  BSKY_PUBLIC_URL?: string;
  BSKY_SOCIAL_URL?: string;
  THREADS_PDS_URL?: string;
  THREADS_APP_ID?: string;
  THREADS_APP_SECRET?: string;
  FARCASTER_BOT_FID?: string;
  FARCASTER_BOT_SIGNER_KEY?: string;
  FARCASTER_BOT_HUB_URL?: string;
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
  /** Ethereum RPC URL for transaction simulation */
  ETH_RPC_URL?: string;
  RMI_BACKEND_URL?: string;
  /** Bridge service internal URL for protocol feed fetching */
  BRIDGE_INTERNAL_URL?: string;
  /** Bridge API key for authenticated requests to the bridge service */
  BRIDGE_API_KEY?: string;
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
  /** API key for MeiliSearch (production requires Authorization: Bearer <key>) */
  MEILI_SEARCH_KEY?: string;
  /** MeiliSearch server URL (default: http://127.0.0.1:7700) */
  MEILI_URL?: string;
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

  // ─── Matrix / Conduit Chat Hub ────────────────────────────────────────
  /** Conduit admin token for bridge bot registration */
  MATRIX_ADMIN_TOKEN?: string;
  /** Matrix sender key for E2EE */
  MATRIX_SENDER_KEY?: string;
  /** Matrix room ID for bridge fabric */
  MATRIX_ROOM_ID?: string;

  // ─── Protocol Bridge Credentials ──────────────────────────────────────
  /** Nostr nsec for NIP-17 encrypted DMs */
  NOSTR_NSEC?: string;
  /** Lens access token */
  LENS_ACCESS_TOKEN?: string;
  /** Neynar API key for Farcaster */
  NEYNAR_API_KEY?: string;
  /** Farcaster signer UUID */
  FARCASTER_SIGNER_UUID?: string;
  /** Mastodon/ActivityPub access token */
  MASTODON_ACCESS_TOKEN?: string;
  /** ActivityPub instance URL */
  AP_INSTANCE_URL?: string;
  /** Discord bot token */
  DISCORD_BOT_TOKEN?: string;
  /** IRC bridge URL */
  IRC_BRIDGE_URL?: string;
  /** XMPP bridge URL */
  XMPP_BRIDGE_URL?: string;
  /** Signal API URL */
  SIGNAL_API_URL?: string;
  /** Signal phone number */
  SIGNAL_NUMBER?: string;

  // ─── LiveKit / WebRTC Calling ────────────────────────────────────────
  /** LiveKit API key */
  LIVEKIT_API_KEY?: string;
  /** LiveKit API secret */
  LIVEKIT_API_SECRET?: string;
  /** LiveKit server host */
  LIVEKIT_HOST?: string;

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
  /** Loops instance URL for self-hosted shorts (default: https://loops.video) */
  LOOPS_INSTANCE_URL?: string;
  /** Telegram chat ID for live broadcast notifications */
  TELEGRAM_CHAT_ID?: string;
  /** GoToSocial/ActivityPub access token for Mastodon broadcasts */
  GTS_ACCESS_TOKEN?: string;
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
  /**
   * Receiver address that must match the `to` field of a registration
   * payment txHash (EVM). When set, register-all only proceeds with a paid
   * plan if the verified payment actually arrived at this address.
   */
  REGISTRATION_PAYMENT_ADDRESS?: string;
  /** Application base URL — e.g. https://app.degenfeed.xyz */
  APP_BASE_URL?: string;
  /** GoToSocial instance URL (ActivityPub-compatible Mastodon API) for account creation */
  GOTOSOCIAL_INSTANCE_URL?: string;
  /** Lemmy instance URL for account creation */
  LEMMY_INSTANCE_URL?: string;
  /** Pixelfed instance URL for account creation */
  PIXELFED_INSTANCE_URL?: string;
  /** Pixelfed access token (Bearer) for the local instance public timeline */
  PIXELFED_ACCESS_TOKEN?: string;
  /** Public origin for local Pixelfed media (default: https://photos.degenfeed.xyz) */
  PIXELFED_PUBLIC_URL?: string;
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
  /** BookWyrm instance URL — books.degenfeed.xyz */
  BOOKWYRM_INSTANCE_URL?: string;
  /** Funkwhale instance URL — music.degenfeed.xyz */
  FUNKWHALE_INSTANCE_URL?: string;
  /** Owncast admin API key for user creation */
  OWNCAST_ADMIN_KEY?: string;

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

  // ─── Multi-Protocol Coin Announcement ───────────────────────────────
  /** Bluesky app password for bot posting (not the main password) */
  BSKY_APP_PASSWORD?: string;
  /** Mastodon/GTS access token for bot tooting */
  MASTODON_ACCESS_TOKEN?: string;
  /** Telegram chat ID for coin launch announcements */
  TELEGRAM_ANNOUNCEMENT_CHAT_ID?: string;
  /** Telegram coin announcement chat ID (overrides TELEGRAM_ANNOUNCEMENT_CHAT_ID) */
  TELEGRAM_COIN_ANNOUNCEMENT_CHAT_ID?: string;
  /** Discord webhook URL for coin launch announcements */
  DISCORD_WEBHOOK_URL?: string;
  /** Discord coin announcement webhook URL (overrides DISCORD_WEBHOOK_URL) */
  DISCORD_COIN_WEBHOOK_URL?: string;
  /** Coingecko API key (free tier) for price feeds */
  COINGECKO_API_KEY?: string;
}

// ─── Common type aliases used across routes ───────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}
