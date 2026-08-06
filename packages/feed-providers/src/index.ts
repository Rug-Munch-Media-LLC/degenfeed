// ─── Source Discovery (folded from @degenfeed/source-discovery) ───
export type {
  DiscoveredSource,
  DiscoveryConfig,
  DiscoveryRun,
  DiscoveryStats,
  DiscoveryStatus,
  Platform,
  SourceHealth,
  SourceLifecycle,
  TrendingSource,
} from '@degenfeed/source-discovery';
export {
  aggregateStats,
  buildTrendingSource,
  CRYPTO_KEYWORDS,
  computeQualityScore,
  computeSourceHealthScore,
  computeTrendingScore,
  DEFAULT_DISCOVERY_CONFIG,
  detectStaleSources,
  discoverLemmyCommunities,
  discoverNewSources,
  discoverNewsletters,
  discoverPeerTubeChannels,
  discoverRedditSubreddits,
  discoverRSSFeeds,
  discoverYouTubeChannels,
  estimateRelevance,
  getNewThisWeek,
  isBlocklisted,
  SEARCH_KEYWORDS,
} from '@degenfeed/source-discovery';
export {
  fetchDiasporaPosts,
  fetchFriendicaPosts,
  fetchMisskeyPosts,
  fetchPleromaPosts,
  fetchWriteFreelyPosts,
} from './adapters';
export {
  AUDIUS_API_URL,
  AudiusProvider,
  type AudiusProviderOptions,
  type AudiusTrack,
  isAudiusTrack,
} from './providers/audius';
export { BlueskyProvider, CURATED_BSKY_ACTORS } from './providers/bluesky';
export { CURATED_FARCASTER_FIDS, DEFAULT_HUB_URL, FarcasterProvider } from './providers/farcaster';
export {
  KBIN_INSTANCES,
  KbinProvider,
} from './providers/kbin';
export {
  isKickChannel,
  isKickFeaturedVideo,
  KICK_API_URL,
  KICK_TOP_CHANNELS,
  KickProvider,
  type KickProviderOptions,
} from './providers/kick';
export {
  type DiscoverCommunitiesOptions,
  discoverCommunities,
  type FederatedCommunity,
  LEMMY_INSTANCES,
  LEMMY_NICHE_LABELS,
  LemmyProvider,
} from './providers/lemmy';
export { CURATED_LENS_HANDLES, LENS_API_URL, LensProvider } from './providers/lens';
export {
  DEFAULT_GTS_INSTANCE,
  type FediverseInstance,
  type FediverseSoftware,
  getFediverseStats,
  MastodonProvider,
  PUBLIC_MASTODON_INSTANCES,
  TRENDING_INSTANCES,
} from './providers/mastodon';
export {
  CURATED_MEDIUM_PUBLICATIONS,
  CURATED_MEDIUM_TAGS,
  isChallengePage,
  MediumProvider,
  parseMediumRss,
} from './providers/medium';
export {
  CURATED_MIRROR_WRITERS,
  extractMarkdownImages,
  MIRROR_BRIDGE_URL,
  MirrorProvider,
  mirrorArticleToPost,
} from './providers/mirror';
export { DEFAULT_RELAYS, NostrProvider } from './providers/nostr';
export {
  isOpenSeaCollection,
  isOpenSeaSaleEvent,
  OpenSeaProvider,
  type OpenSeaProviderOptions,
} from './providers/opensea';
export {
  CURATED_PARAGRAPH_PUBLICATIONS,
  PARAGRAPH_BRIDGE_URL,
  ParagraphProvider,
  parseParagraphRss,
} from './providers/paragraph';
export { PixelfedProvider, type PixelfedProviderOptions } from './providers/pixelfed';
export {
  isPolymarketEvent,
  isPolymarketMarket,
  PolymarketProvider,
  type PolymarketProviderOptions,
  parseOutcomePrices,
} from './providers/polymarket';
export { PonderProvider } from './providers/ponder';
export {
  CRYPTO_SUBREDDIT_CONFIGS,
  DEFAULT_SUBREDDITS,
  type RedditCategory,
  RedditProvider,
  type SubredditConfig,
} from './providers/reddit';
export { RedditAlternativesProvider } from './providers/reddit-alternatives';
export type {
  RmiArticle,
  RmiDataBusProviderOptions,
  RmiFeedResponse,
} from './providers/rmi-databus';
export {
  DEFAULT_RMI_BACKEND_URL,
  RmiDataBusProvider,
} from './providers/rmi-databus';
export type { QualityScore, RssCategory, RssFeedConfig } from './providers/rss';
export {
  DEFAULT_CRYPTO_FEEDS,
  getFeedCategories,
  getFeedsByCategory,
  getNewsletterFeeds,
  normalizeFeedInput,
  RssProvider,
} from './providers/rss';
export { RssBridgeProvider } from './providers/rss-bridge';
export {
  isSnapshotProposal,
  SNAPSHOT_GRAPHQL_URL,
  SNAPSHOT_SPACES,
  SnapshotProvider,
  type SnapshotProviderOptions,
} from './providers/snapshot';
export {
  CURATED_SUBSTACKS,
  parseSubstackRss,
  SubstackProvider,
  substackItemToPost,
} from './providers/substack';
export {
  isTallyProposal,
  TallyProvider,
  type TallyProviderOptions,
} from './providers/tally';
export {
  CURATED_THREADS_HANDLES,
  GTS_INSTANCE,
  isAvailable,
  isBridgyConfigured,
  ThreadsProvider,
} from './providers/threads';
export {
  TILDES_GROUPS,
  TildesProvider,
} from './providers/tildes';
export {
  isTwitchClip,
  isTwitchGame,
  isTwitchStream,
  TWITCH_API_URL,
  TwitchProvider,
  type TwitchProviderOptions,
  twitchThumbnailUrl,
} from './providers/twitch';
export type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from './types';
export {
  buildUrl,
  DEFAULT_CONCURRENCY,
  DEFAULT_RETRIES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  FetchError,
  fetchJson,
  fetchRss,
  fetchText,
  fetchWithFallbacks,
  withConcurrencyLimit,
  withRetry,
  withTimeout,
} from './utils';
