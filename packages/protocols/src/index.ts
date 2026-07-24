/**
 * @degenfeed/protocols — Unified protocol SDK barrel
 *
 * Single entry point for all social protocol SDKs.
 * Each SDK is still independently available for direct imports.
 */

// ─── Bluesky ───────────────────────────────────────────────────────
export {
  BlobRef,
  BSKY_PUBLIC_URL,
  BSKY_SOCIAL_URL,
  BskyClient,
  DEFAULT_USER_AGENT as BSKY_DEFAULT_UA,
  PDS_DEGENFEED_URL,
  PdsClient,
  ProfileViewDetailed,
} from '@degenfeed/bluesky-sdk';
export type { BuildCastMessageOpts, FarcasterEngageOpts } from '@degenfeed/farcaster-sdk';
// ─── Farcaster ─────────────────────────────────────────────────────
export {
  buildFarcasterCastMessage,
  CURATED_FARCASTER_FIDS,
  DEFAULT_HUB_URL as FARCASTER_DEFAULT_HUB,
  engageFarcaster,
  FALLBACK_HUB_URLS as FARCASTER_FALLBACK_HUBS,
  HubClient,
} from '@degenfeed/farcaster-sdk';
export type { LensProfile } from '@degenfeed/lens-sdk';
// ─── Lens ──────────────────────────────────────────────────────────
export {
  FALLBACK_LENS_URLS,
  LENS_API_URL,
  LensClient,
} from '@degenfeed/lens-sdk';
export type {
  GtSAccount,
  GtSMediaAttachment,
  GtSStatus,
} from '@degenfeed/mastodon-sdk';
// ─── Mastodon / GoToSocial ─────────────────────────────────────────
export {
  accountToIdentity,
  DEFAULT_USER_AGENT as GTS_DEFAULT_UA,
  GtSClient,
  statusToUnifiedPost,
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
  nip05Cache,
  nip19Decode,
  nip19Encode,
  nip46Decrypt,
  nip46Encrypt,
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
export type {
  FeedMeta,
  FetchOpts,
  RssFeedShape,
  RssItemShape,
  RssSourceType,
  SourcePosts,
} from '@degenfeed/rss-sdk';
// ─── RSS ───────────────────────────────────────────────────────────
export {
  DEFAULT_SUBREDDITS,
  feedToUnifiedPosts,
  fetchAndNormalize,
  fetchFeed,
  GenericRssSource,
  MediumSource,
  MirrorSource,
  ParagraphSource,
  RedditSource,
  SubstackSource,
} from '@degenfeed/rss-sdk';

// ─── Telegram ──────────────────────────────────────────────────────
export {
  Chat,
  ChatMember,
  formatTelegramMarkdown,
  GetMeResult,
  getMe,
  SendMediaGroupResult,
  SendMediaResult,
  SendMessageResult,
  sendMediaGroup,
  sendMessage,
  TelegramError,
  TelegramRateLimitError,
  TGBotClient,
} from '@degenfeed/telegram-sdk';
export type {
  ThreadsMedia,
  ThreadsUserProfile,
} from '@degenfeed/threads-sdk';
// ─── Threads ───────────────────────────────────────────────────────
export {
  buildThreadsAuthorizeUrl,
  exchangeCodeForToken,
  THREADS_GRAPH_API,
  THREADS_OAUTH_BASE,
  THREADS_WEB_URL,
  ThreadsClient,
} from '@degenfeed/threads-sdk';
