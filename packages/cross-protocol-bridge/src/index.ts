/**
 * @degenfeed/cross-protocol-bridge
 *
 * Unified cross-protocol bridge for the DegenFeed social graph.
 *
 * ## Quick Start
 *
 * ```ts
 * import { Bridge, linkIdentity, getDefaultBridge } from '@degenfeed/cross-protocol-bridge';
 *
 * // Link identities for automatic cross-posting
 * linkIdentity('df:user1', '0x...', 'mastodon', '123', 'user@social.degenfeed.xyz');
 * linkIdentity('df:user1', '0x...', 'nostr', 'npub1...', 'user');
 *
 * // Start the bridge
 * const bridge = new Bridge();
 * bridge.start();
 *
 * // Bridge a post
 * const result = await bridge.bridgePost(post, 'nostr');
 *
 * // Auto-bridge for linked identity
 * const batchResult = await bridge.autoBridgeForLinkedIdentity(post);
 * ```
 */

// ─── Cross-Post Adapters ──────────────────────────────────────────────
export {
  adaptForProtocols,
  getAdapter as getPlatformAdapter,
  getAllAdapters as getAllPlatformAdapters,
  getAvailableProtocols,
  previewForProtocols,
  registerAdapter as registerPlatformAdapter,
  registerAllAdapters,
} from './adapters/index';
export type {
  LinkCard,
  MasterPost,
  MediaAttachment,
  PlatformAdapter,
  PlatformDefinition,
  ProtocolPublishParams,
} from './adapters/types';
export { ALL_PLATFORMS } from './adapters/types';
// ─── Core Bridge ─────────────────────────────────────────────────────────
export {
  Bridge,
  getDefaultBridge,
  resetDefaultBridge,
} from './bridge';
// ─── Circuit Breaker ─────────────────────────────────────────────────────
export { CircuitBreaker, circuitBreaker } from './circuit-breaker';
// ─── Health Monitor ──────────────────────────────────────────────────────
export { HealthMonitor, healthMonitor } from './health-monitor';
// ─── Identity Linking ────────────────────────────────────────────────────
export {
  findLinkedIdentitiesInText,
  getCrossProtocolDisplay,
  getLinkedProtocols,
  hasLinkedProtocol,
  linkIdentity,
  resolveByHandle,
  resolveByIdentity,
  resolveByWallet,
  resolveMentions,
  unlinkIdentity,
} from './identity-linking';
// ─── Content Normalization ───────────────────────────────────────────────
export {
  extractHashtags,
  extractLinks,
  extractMedia,
  extractMentions,
  normalizePost,
  normalizeText,
  translateHashtag,
  translateHashtagsForProtocol,
} from './normalization';
// ─── Notifications ───────────────────────────────────────────────────────
export {
  fetchUnifiedNotifications,
  generateBridgeNotifications,
  getNotificationFetcher,
  registerNotificationFetcher,
} from './notifications';
// ─── Search ──────────────────────────────────────────────────────────────
export {
  computeRelevanceScore,
  crossProtocolSearch,
  registerSearchProvider,
  registerSearchProviderFromPosts,
  searchProtocol,
} from './search';
// ─── Transform Adapters ──────────────────────────────────────────────────
export {
  getAdapter,
  getAllAdapters,
  registerAdapter,
  registerBuiltinAdapters,
} from './transforms/index';

// ─── Types ───────────────────────────────────────────────────────────────
export type {
  BridgeAdapter,
  BridgeBatchResult,
  BridgeConfig,
  BridgeHealth,
  BridgePath,
  BridgeResult,
  CircuitBreakerConfig,
  CircuitBreakerState,
  CrossPostCopy,
  CrossPostRecord,
  CrossProtocolSearchResponse,
  CrossProtocolSearchResult,
  LinkedIdentity,
  LinkedProtocolIdentity,
  NormalizedContent,
  NormalizedMedia,
  NormalizedMention,
  UnifiedNotification,
  UnifiedNotificationFeed,
} from './types';

export { BRIDGE_PATHS, DEFAULT_BRIDGE_CONFIG, DEFAULT_CIRCUIT_CONFIG } from './types';
