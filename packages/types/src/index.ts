/**
 * Unified types for the DegenFeed open social graph client.
 * Every post, identity, and engagement action from any protocol
 * normalizes to these shapes. UI components consume only these.
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
  | 'soundcloud'
  | 'vimeo'
  | 'loops'
  | 'wordpress'
  | 'kbin'
  | 'tildes'
  | 'ghost'
  | 'discourse'
  | 'immich'
  | 'mbin'
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
  | 'writefreely'
  | 'funkwhale'
  | 'castopod'
  | 'bookwyrm'
  | 'mobilizon'
  | 'bonfire'
  | 'mitra'
  | 'takahe'
  | 'forgejo'
  | 'owncast'
  | 'faircamp'
  | 'orbis'
  | 'xmtp'
  | 'push'
  | 'huddle01'
  | 'ceramic'
  | 'tableland'
  | 'subsocial'
  | 'steem'
  | 'session'
  | 'microblog'
  | 'cyberconnect'
  | 'arena'
  | 'ens'
  | 'unstoppable'
  | 'ion'
  | 'keri'
  | 'veramo'
  | 'storj'
  | 'sia'
  | 'filecoin'
  | 'swarm-eth'
  | 'snapshot'
  | 'tally'
  | 'syndicate'
  | 'juicebox'
  | 'coinvise'
  | 'unlock'
  | 'mintgate'
  | 'bonfida'
  | 'mediagoblin'
  | 'deso'
  | 'audius'
  | 'rarible'
  | 'flarum'
  | 'arweave'
  | 'opensea'
  | 'lobsters'
  | 'snapshot'
  | 'tally'
  | 'juicebox'
  | 'unlock'
  | 'lit'
  | 'polymarket'
  | 'soundcloud'
  | 'twitch'
  | 'kick'
  | 'substack'
  | 'medium'
  | 'infra';

export interface UnifiedIdentity {
  /** Stable canonical identifier: `${protocol}:${id}` */
  id: string;
  /** Primary protocol+id (user's chosen canonical) */
  primary: { protocol: Protocol; id: string };
  /** Handles per protocol (null if not linked) */
  handles: Partial<Record<Protocol, string | null>>;
  displayName: string;
  bio: string;
  avatarUrl: string;
  bannerUrl?: string;
  verified: { protocol: Protocol; badge: string }[];
  followerCount: number;
  followingCount: number;
  links: { label: string; url: string }[];
  /** Raw protocol-specific identifiers */
  keys: {
    nostrPubkey?: string;
    fid?: number;
    lensProfileId?: string;
    did?: string;
    evmAddress?: string;
    solanaAddress?: string;
    threadsDid?: string;
    /** RSS source URL (e.g. blog feed URL) */
    rssUrl?: string;
    /** AT Protocol DID (e.g. did:plc:abc123) */
    atprotoDid?: string;
    /** Zora creator coin contract address */
    zoraCoinAddress?: string;
    /** Telegram user ID */
    telegramUserId?: string;
    /** Discord guild (server) ID */
    discordGuildId?: string;
    /** Discord channel ID */
    discordChannelId?: string;
    /** Matrix homeserver URL */
    matrixHomeserver?: string;
    /** Matrix room ID */
    matrixRoomId?: string;
    /** GitHub username */
    githubUsername?: string;
    /** GitHub repository full name (owner/repo) */
    githubRepo?: string;
    /** Webhook URL for custom integration */
    webhookUrl?: string;
    /** Substack newsletter URL */
    substackUrl?: string;
    /** Ghost blog API URL */
    ghostUrl?: string;
    /** DTube username */
    dtubeUsername?: string;
    /** LBRY claim ID */
    lbryClaimId?: string;
    /** Gab user ID */
    gabUserId?: string;
    /** Minds GUID */
    mindsGuid?: string;
    /** Minds rewards enabled flag */
    mindsRewardsEnabled?: string;
    /** Aether public key */
    aetherPubkey?: string;
    /** SSB feed ID */
    ssbFeedId?: string;
    /** Hive username */
    hiveUsername?: string;
    /** Hive reputation */
    hiveReputation?: string;
    /** Arweave transaction ID */
    arweaveTxId?: string;
    /** ENS name */
    ens?: string;
    /** OpenSea collection slug */
    openseaSlug?: string;
    /** Lobste.rs username */
    lobstersUsername?: string;
    /** Snapshot space ID */
    snapshotSpace?: string;
    /** Tally governance ID */
    tallyGovId?: string;
    /** Juicebox project ID */
    juiceboxProjectId?: string;
    /** Unlock Protocol lock address */
    unlockLockAddress?: string;
    /** Lit Protocol PKP token ID */
    litPkpTokenId?: string;
    /** Audius user handle */
    audiusHandle?: string;
    /** Twitch user ID (Helix) */
    twitchUserId?: string;
    /** Twitch broadcaster ID (Helix clips) */
    twitchBroadcasterId?: string;
    /** Kick channel slug/handle */
    kickHandle?: string;
    /** Substack publication slug (e.g. "milkroad") */
    substackSlug?: string;
    /** Paragraph.xyz publication slug (e.g. "bankless") */
    paragraphSlug?: string;
    /** Medium tag/publication/@author source id */
    mediumSource?: string;
  };
}

export interface Embed {
  kind: 'image' | 'video' | 'link' | 'frame' | 'quote' | 'code' | 'audio';
  url: string;
  /** Protocol-specific extra data */
  meta?: Record<string, unknown>;
}

/**
 * A single media attachment on a post (image / video / audio).
 * Populated by providers during the raw → UnifiedPost mapping so the
 * feed UI and image-proxy route can render media without re-parsing
 * protocol-specific payloads. Mirrors the `embeds` image/video entries.
 */
export interface MediaAttachment {
  /** Media kind: 'image' | 'video' | 'audio' | 'gif' */
  type: string;
  /** Direct URL to the media asset */
  url: string;
  /** Preferred display width in px (if known from the source API) */
  width?: number;
  /** Preferred display height in px (if known from the source API) */
  height?: number;
  /** Alt text / description (accessibility, some providers expose it) */
  alt?: string;
}

export type EngagementAction =
  | 'like'
  | 'unlike'
  | 'repost'
  | 'unrepost'
  | 'bookmark'
  | 'unbookmark'
  | 'reply'
  | 'react';

export interface EngagementMetrics {
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  views?: number;
}

export interface EngagementVector {
  /** Per-protocol reaction ids from the current viewer (for UI state) */
  viewerLiked: boolean;
  viewerReposted: boolean;
  viewerBookmarked: boolean;
  /** Raw engagement counts at fetch time (for ranking delta calculation) */
  raw: EngagementMetrics;
}

/** Per-post ranking score breakdown exposed to the UI. */
export interface PostScore {
  total: number;
  recency: number;
  engagement: number;
  relevance: number;
  quality: number;
  diversity: number;
  source: number;
  velocity: number;
  /** Human-readable signals ("fresh", "viral", "on-topic", etc.) */
  reasons: string[];
}

/**
 * Transparency debug data embedded in each post for the "Why this post?" UI.
 * These fields explain to the user why a particular post appeared in their feed.
 */
export interface FeedDebug {
  /** Spam detection result 0-1 (lower = cleaner). */
  spamScore: number;
  /** Content quality 0-1 (higher = better). */
  qualityScore: number;
  /** Author reputation signal 0+ (combined from verification, followers, etc.). */
  authorReputation: number;
  /** How well the post matches the viewer's topic interests (0-1). */
  topicMatch: number;
  /** Engagement velocity boost factor (1 = baseline, higher = trending). */
  velocity: number;
  /** Recency/freshness boost factor (0-2+, higher = newer). */
  freshness: number;
  /** Which protocol this post was sourced from. */
  sourceProtocol: string;
  /** Whether the viewer follows this author. */
  isFollowed: boolean;
  /** Whether the viewer has muted or blocked this author. */
  isMutedOrBlocked: boolean;
}

export interface UnifiedPost {
  /** Canonical id: `${protocol}:${nativeId}` */
  id: string;
  protocol: Protocol;
  /** Stable author reference */
  author: UnifiedIdentity;
  /** Plain text content */
  text: string;
  /** Protocol-specific rich HTML if present */
  html?: string;
  embeds: Embed[];
  /** Parent post id for replies */
  parentId?: string;
  /** Root post id for thread tracking */
  rootId?: string;
  /** Unix ms */
  createdAt: number;
  metrics: EngagementMetrics;
  engagement: EngagementVector;
  /** Protocol-native raw object for round-trips (signing, fetching replies) */
  raw: unknown;
  /** Niche tags derived from content (crypto, ai, oss, security, art, music) */
  niches: string[];
  /** Optional ranking breakdown for transparency / hover signals. */
  score?: PostScore;
  /**
   * Feed transparency debug data — explains why this post was shown.
   * Populated server-side from ranking signals and embedded in the post
   * for the "Why this post?" UI.
   */
  feedDebug?: FeedDebug;
  /** Protocols this post was also found on (cross-post dedup). */
  crossPostedTo?: Protocol[];
  /** Optional paywall requirement for paid content */
  paywall?: { amount: string; recipient: string };
  /** Token gate for restricted content — only holders can view */
  tokenGate?: {
    type: 'erc20' | 'erc721' | 'erc1155';
    chain: 'ethereum' | 'base' | 'polygon' | 'solana' | 'arbitrum' | 'optimism';
    contractAddress: string;
    tokenId?: string;
    minBalance?: number;
    minBalanceDecimals?: number;
    /** Resolved symbol (set server-side when creating the post) */
    displaySymbol?: string;
    /** Resolved NFT name (set server-side when creating) */
    displayName?: string;
    /** Optional user biography */
    bio?: string;
  };
  /** Number of tips received on this post */
  tipCount?: number;
  /** Content type: article, video, image, thread, link, podcast */
  contentType?: 'article' | 'video' | 'image' | 'thread' | 'link' | 'text' | 'podcast';
  /** Convenience image URL (provider/og:image enrichment) — mirrors embeds. */
  image?: string;
  /**
   * Media attachments (images/videos/audio) extracted from the source
   * protocol during mapping. Mirrors the image/video entries in `embeds`
   * but carries stable per-attachment metadata (type, width, height, alt)
   * for rendering grids and the image-proxy route.
   */
  media?: MediaAttachment[];
  /** Freshness flags set server-side */
  isNew?: boolean;
  isHot?: boolean;
  isTrending?: boolean;
  /** Per-protocol quality score (server-computed, additive rules per protocol) */
  qualityScore?: { score: number; max: number; ratio: number; reasons: string[] };
  /** Quality badge derived from protocol quality rules */
  qualityBadge?: 'verified' | null;
  /** Community context (lemmy, reddit, etc.) */
  community?: {
    name: string;
    title?: string;
    actorId?: string;
    icon?: string;
    instance?: string;
    /** Number of subscribers/followers (from Lemmy counts) */
    subscriberCount?: number;
    /** Active users in the past month */
    usersActiveMonth?: number;
    /** DegenFeed niche category (crypto, defi, nft, etc.) */
    niche?: string;
    /** Community quality tier */
    qualityTier?: 'low' | 'medium' | 'high' | 'vibrant';
  };
  /** Universal df:// URI for cross-protocol addressing, sharing, and bookmarking */
  dfUri?: string;
  /** Protocol-specific source label (e.g. Mastodon instance display name) */
  source?: string;
  /** Protocol-specific metadata (content warnings, instance info, etc.) */
  meta?: {
    contentWarning?: string;
    instanceHost?: string;
    instanceLabel?: string;
    spoiler_text?: string;
  };
  /** On-chain content permanence proof (Arweave/IPFS) */
  contentProof?: ContentProof;
}

// ─── Custom Feeds ─────────────────────────────────────────────

export interface FeedRecipe {
  /** Protocol sources to include */
  sources: Protocol[];
  /** Topic boost weights (0-100), e.g. { defi: 80, nft: 30 } */
  topics: Record<string, number>;
  /** Content type filters */
  contentTypes: string[];
  /** Minimum total engagement (likes + reposts) */
  minEngagement: number;
  /** Topics to exclude entirely */
  excludeTopics: string[];
  /** Words/phrases to hide posts containing them */
  excludeWords: string[];
  /** Optional language filter (ISO code) */
  language?: string;
  /** Optional — only from these author IDs */
  creatorFilter?: string[];
}

export interface CustomFeed {
  id: string;
  name: string;
  description: string;
  creator: string;
  isPublic: boolean;
  config: FeedRecipe;
  createdAt: number;
  updatedAt: number;
  subscribers: number;
  /** Human-readable title for UI display (aliased from name) */
  title?: string;
  /** Source protocol identifiers (e.g. 'nostr', 'farcaster') */
  sources?: string[];
  /** Whether this feed is pinned by the user */
  isPinned?: boolean;
  /** Creator's wallet/profile ID */
  authorId?: string;
}

// ─── Visual Feed types ─────────────────────────────────────────

export type VisualSource =
  | 'pixelfed'
  | 'peertube'
  | 'owncast'
  | 'zora'
  | 'bluesky'
  | 'nostr'
  | 'farcaster'
  | 'gotosocial'
  | 'mastodon'
  | 'dtube'
  | 'lbry'
  | 'hive'
  | 'aether'
  | 'all';

export interface VisualPost {
  /** Canonical id: `${source}:${nativeId}` */
  id: string;
  /** Source platform */
  source: VisualSource;
  /** Original protocol this came from (for cross-protocol tracking) */
  protocol: string;
  /** Author with cross-platform identity */
  author: UnifiedIdentity;
  /** Title or caption text */
  text: string;
  /** Primary visual asset URL (image thumbnail or video poster) */
  imageUrl: string;
  /** Full-resolution or original asset URL */
  fullImageUrl?: string;
  /** Video URL if applicable */
  videoUrl?: string;
  /** Video duration in seconds */
  duration?: number;
  /** Embed data for rich media */
  embeds: Embed[];
  /** Blur hash for loading placeholder (base64) */
  blurHash?: string;
  /** Aspect ratio width/height for layout stability */
  aspectRatio: number;
  /** Media width in pixels */
  width?: number;
  /** Media height in pixels */
  height?: number;
  /** Whether this is an NFT (mintable) */
  isNFT: boolean;
  /** Zora-specific: token contract address */
  nftContract?: string;
  /** Zora-specific: token ID */
  nftTokenId?: string;
  /** Zora-specific: collection name */
  collectionName?: string;
  /** Zora-specific: creator address for minting */
  creatorAddress?: string;
  /** Content type for rendering */
  mediaType: 'image' | 'video' | 'gif' | 'nft_image' | 'nft_video';
  /** Unix ms */
  createdAt: number;
  /** Engagement metrics */
  metrics: EngagementMetrics;
  /** Viewer engagement state */
  engagement: EngagementVector;
  /** Source protocol badge info */
  sourceBadge: string;
  sourceColor: string;
  sourceLabel: string;
  /** Raw native object for round-trip */
  raw: unknown;
  /** Cross-platform tip URL */
  tipUrl?: string;
  /** Mint URL (Zora) */
  mintUrl?: string;
  /** Creator coin collect URL */
  collectUrl?: string;
  /** Original post URL (platform-native link) */
  url?: string;
  /** Protocol-specific extra data */
  meta?: Record<string, unknown>;
}

export interface VisualFeedOptions {
  /** Sources to include */
  sources: VisualSource[];
  /** Filter: all, photos, nfts, video, bluesky */
  filter?: 'all' | 'photos' | 'nfts' | 'video' | 'bluesky';
  /** Sort: newest, trending, top */
  sort?: 'newest' | 'trending' | 'top';
  /** Pagination cursor */
  cursor?: string;
  /** Results per page */
  limit: number;
  /** Personalization: followed creators only */
  followingOnly?: boolean;
  /** Creator filter (wallet addresses or DIDs) */
  creatorFilter?: string[];
}

export interface VisualFeedResponse {
  data: VisualPost[];
  nextCursor?: string;
  meta: {
    total: number;
    perSource: Record<string, number>;
    errors?: string[];
    fetchedAt: number;
  };
}

export interface ContentProof {
  /** Arweave transaction ID (from Bundlr/Irys upload) */
  arweaveTxId?: string;
  /** IPFS content hash (CID) */
  ipfsCid?: string;
  /** SHA-256 hash of the content */
  contentHash: string;
  /** Unix timestamp of when the content was stored */
  timestamp: number;
  /** Whether the content is stored permanently */
  permanent: boolean;
  /** EVM transaction hash if anchored on-chain via contract */
  onChainTxHash?: string;
  /** Chain ID where the anchor tx was submitted (e.g. 8453 for Base) */
  onChainChainId?: number;
}

export interface NewPost {
  text: string;
  embeds?: Embed[];
  parentProtocol?: Protocol;
  parentNativeId?: string;
  /** Slash-command hints from compose */
  commands?: ('poll' | 'thread' | 'image' | 'link' | 'code')[];
}

export interface PublishResult {
  protocol: Protocol;
  ok: boolean;
  nativeId?: string;
  error?: string;
}

export interface FeedRequest {
  viewer?: UnifiedIdentity | null;
  cursor?: string;
  limit?: number;
  filter?: 'all' | 'following' | 'foryou' | 'trending';
  niches?: string[];
}

export interface FeedResponse {
  posts: UnifiedPost[];
  nextCursor?: string;
}

export interface IdentityLink {
  from: { protocol: Protocol; id: string };
  to: { protocol: Protocol; id: string };
  /** Source of the link (NIP-05, profile bio, manual, etc.) */
  source: string;
  /** Confidence score 0-1 */
  confidence: number;
}

// ─── Audio Spaces ────────────────────────────────────────────────

export type SpaceStatus = 'live' | 'scheduled' | 'ended';

export interface SpaceSpeaker {
  id: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
  isHost: boolean;
  isCoHost: boolean;
  /** Whether the speaker's mic is currently live */
  speaking: boolean;
}

export interface SpaceReaction {
  userId: string;
  emoji: string;
  createdAt: number;
}

export interface Space {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  coHosts: string[];
  /** Protocol badge IDs: 'nostr', 'farcaster', 'lens', 'mastodon' */
  protocols: string[];
  status: SpaceStatus;
  /** Unix timestamp (ms) */
  createdAt: number;
  /** For scheduled spaces — ISO string */
  scheduledAt?: string;
  listeners: number;
  speakers: SpaceSpeaker[];
  reactions: SpaceReaction[];
  /** Token address for tipping (optional) */
  tipTokenAddress?: string;
  /** Whether the space supports tipping */
  tippingEnabled: boolean;
}

// ─── Storage-adjacent types (shared across auth/storage) ──────────

/**
 * Persisted identity record. Originally from @degenfeed/storage but moved
 * here so @degenfeed/auth can use the type without a hard dep on storage.
 */
export interface StoredIdentity {
  /** Canonical id: `${protocol}:${publicId}` */
  id: string;
  protocol: Protocol;
  publicId: string;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  /** Timestamp of when this identity was first linked */
  linkedAt: number;
  /** Whether the identity has been verified (NIP-05, Farcaster verified) */
  verified: boolean;
  /** Encrypted secret key (AES-GCM ciphertext, base64) */
  encryptedSecret: string | null;
  /** Argon2id salt for key derivation (base64) */
  salt: string;
  /** AES-GCM initialization vector (base64) */
  iv: string;
  /** Whether this is the user's primary identity */
  isPrimary: boolean;
  /** Protocol-specific key material (encrypted) */
  keys?: Record<string, string | null>;
  /** Social links */
  links?: Array<{ label: string; url: string }>;
  /** Creation timestamp */
  createdAt?: number;
}

// ─── Unified Image Feed types ─────────────────────────────────────────

export type ImageSource =
  | 'pixelfed'
  | 'zora'
  | 'mastodon'
  | 'nostr'
  | 'bluesky'
  | 'lens'
  | 'ipfs'
  | 'arweave'
  | 'reddit'
  | 'immich'
  | 'lychee';

export type ImageCategory = 'art' | 'photography' | 'memes' | 'nft' | 'general' | 'ai';

export interface UnifiedImage {
  id: string;
  source: ImageSource;
  protocol: string;
  imageUrl: string;
  fullImageUrl?: string;
  thumbnailUrl?: string;
  title: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    handle?: string;
    walletAddress?: string;
  };
  sourceBadge: string;
  sourceColor: string;
  sourceLabel: string;
  category: ImageCategory;
  createdAt: number;
  width?: number;
  height?: number;
  aspectRatio: number;
  likes: number;
  shares: number;
  comments: number;
  isNFT: boolean;
  nftContract?: string;
  nftTokenId?: string;
  collectionName?: string;
  creatorAddress?: string;
  mintUrl?: string;
  collectUrl?: string;
  url?: string;
  blurHash?: string;
  tags: string[];
  meta?: Record<string, unknown>;
}

/** In-memory active session holding a decrypted identity. */
export interface ActiveSession {
  identity: StoredIdentity;
  /** Decrypted key material. NEVER written to disk. */
  decryptedSecret: string | null;
  unlockedAt: number;
}

/**
 * Structural subset of Cloudflare `KVNamespace`.
 *
 * Shared packages must stay dependency-free of `@cloudflare/workers-types`,
 * so we declare the operations the monorepo actually uses. The real
 * Cloudflare `KVNamespace` is assignable to this interface.
 */
export interface KVNamespaceLike {
  get(
    key: string,
    options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream'; cacheTtl?: number },
  ): Promise<string | null>;
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream | null,
    options?: { expiration?: number; expirationTtl?: number; metadata?: unknown },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Generic environment bindings interface.
 * Used by packages that operate in Cloudflare Workers or similar environments.
 *
 * Declares the Cloudflare KV namespaces and common secrets consumed across
 * the monorepo so `env.<binding>` is typed instead of `unknown`.
 * Remaining dynamic bindings fall through to the index signature.
 */
export interface Env {
  // ─── Cloudflare KV namespaces ──────────────────────────────────────────────
  CACHE?: KVNamespaceLike;
  CONTENT_LIBRARY?: KVNamespaceLike;
  CONTENT_STORE?: KVNamespaceLike;
  IDENTITIES?: KVNamespaceLike;
  SUBSCRIPTIONS?: KVNamespaceLike;
  GOVERNANCE?: KVNamespaceLike;
  PLATFORM_ACCOUNTS?: KVNamespaceLike;
  SHORTS?: KVNamespaceLike;
  CUSTOM_FEEDS?: KVNamespaceLike;
  REPUTATION?: KVNamespaceLike;
  SPACES?: KVNamespaceLike;
  DEDUP?: KVNamespaceLike;
  REPORTS?: KVNamespaceLike;
  STREAMS?: KVNamespaceLike;
  SEEN?: KVNamespaceLike;
  BOOKMARKS?: KVNamespaceLike;
  VIDEO_STORAGE_BINDING?: KVNamespaceLike;
  // ─── Common string secrets / config ────────────────────────────────────────
  AUTH_SECRET?: string;
  NOSTR_PRIVATE_KEY?: string;
  BSKY_ACCESS_TOKEN?: string;
  BSKY_DID?: string;
  TELEGRAM_BOT_TOKEN?: string;
  GOTOSOCIAL_INSTANCE_URL?: string;
  [key: string]: unknown;
}
