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

// ─── Content Normalization ───────────────────────────────────────────────
export {
  normalizePost,
  normalizeText,
  extractHashtags,
  extractMentions,
  extractMedia,
  extractLinks,
  translateHashtag,
  translateHashtagsForProtocol,
} from './normalization';

// ─── Identity Linking ────────────────────────────────────────────────────
export {
  linkIdentity,
  unlinkIdentity,
  resolveByIdentity,
  resolveByWallet,
  resolveByHandle,
  resolveMentions,
  findLinkedIdentitiesInText,
  getLinkedProtocols,
  getCrossProtocolDisplay,
  hasLinkedProtocol,
} from './identity-linking';

// ─── Notifications ───────────────────────────────────────────────────────
export {
  fetchUnifiedNotifications,
  registerNotificationFetcher,
  getNotificationFetcher,
  generateBridgeNotifications,
} from './notifications';

// ─── Search ──────────────────────────────────────────────────────────────
export {
  crossProtocolSearch,
  searchProtocol,
  registerSearchProvider,
  registerSearchProviderFromPosts,
  computeRelevanceScore,
} from './search';

// ─── Transform Adapters ──────────────────────────────────────────────────
export {
  registerAdapter,
  getAdapter,
  getAllAdapters,
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
