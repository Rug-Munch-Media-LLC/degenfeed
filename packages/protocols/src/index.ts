/**
 * @degenfeed/protocols — Unified protocol SDK barrel
 *
 * Single entry point for all social protocol SDKs.
 * Each SDK is still independently available for direct imports.
 */

// ─── Bluesky ───────────────────────────────────────────────────────
export {
  BSKY_PUBLIC_URL,
  BSKY_SOCIAL_URL,
  BskyClient,
  BlobRef,
  DEFAULT_USER_AGENT as BSKY_DEFAULT_UA,
  PDS_DEGENFEED_URL,
  PdsClient,
  ProfileViewDetailed,
} from '@degenfeed/bluesky-sdk';

// ─── Farcaster ─────────────────────────────────────────────────────
export {
  buildFarcasterCastMessage,
  CURATED_FARCASTER_FIDS,
  DEFAULT_HUB_URL as FARCASTER_DEFAULT_HUB,
  engageFarcaster,
  FALLBACK_HUB_URLS as FARCASTER_FALLBACK_HUBS,
  HubClient,
} from '@degenfeed/farcaster-sdk';
export type { BuildCastMessageOpts, FarcasterEngageOpts } from '@degenfeed/farcaster-sdk';

// ─── Lens ──────────────────────────────────────────────────────────
export {
  FALLBACK_LENS_URLS,
  LensClient,
  LENS_API_URL,
} from '@degenfeed/lens-sdk';
export type { LensProfile } from '@degenfeed/lens-sdk';

// ─── Mastodon / GoToSocial ─────────────────────────────────────────
export {
  accountToIdentity,
  DEFAULT_USER_AGENT as GTS_DEFAULT_UA,
  GtSClient,
  statusToUnifiedPost,
} from '@degenfeed/mastodon-sdk';
export type {
  GtSAccount,
  GtSMediaAttachment,
  GtSStatus,
} from '@degenfeed/mastodon-sdk';

// ─── Nostr ─────────────────────────────────────────────────────────
export {
  createEvent,
  createSignedEvent,
  decryptNip44,
  encryptNip44,
  generatePrivateKey,
  generatePublicKey,
  getPublicKey,
  nip19Decode,
  nip19Encode,
  nip46Decrypt,
  nip46Encrypt,
  nip05Cache,
  npubDecode,
  npubEncode,
  nsecDecode,
  nsecEncode,
  relayConnect,
  relayPool,
  resolveNip05,
  signEvent,
  verifyEvent,
  verifySignature,
} from '@degenfeed/nostr-sdk';

// ─── RSS ───────────────────────────────────────────────────────────
export {
  DEFAULT_SUBREDDITS,
  fetchAndNormalize,
  fetchFeed,
  feedToUnifiedPosts,
  GenericRssSource,
  MediumSource,
  MirrorSource,
  ParagraphSource,
  RedditSource,
  SubstackSource,
} from '@degenfeed/rss-sdk';
export type {
  FetchOpts,
  FeedMeta,
  RssSourceType,
  RssItemShape,
  RssFeedShape,
  SourcePosts,
} from '@degenfeed/rss-sdk';

// ─── Telegram ──────────────────────────────────────────────────────
export {
  Chat,
  ChatMember,
  formatTelegramMarkdown,
  getMe,
  GetMeResult,
  sendMediaGroup,
  sendMessage,
  SendMediaGroupResult,
  SendMediaResult,
  SendMessageResult,
  TGBotClient,
  TelegramError,
  TelegramRateLimitError,
} from '@degenfeed/telegram-sdk';

// ─── Threads ───────────────────────────────────────────────────────
export {
  buildThreadsAuthorizeUrl,
  exchangeCodeForToken,
  ThreadsClient,
  THREADS_GRAPH_API,
  THREADS_OAUTH_BASE,
  THREADS_WEB_URL,
} from '@degenfeed/threads-sdk';
export type {
  ThreadsMedia,
  ThreadsUserProfile,
} from '@degenfeed/threads-sdk';
