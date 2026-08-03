/**
 * @degenfeed/degenchat — DegenChat
 *
 * "Chat across every protocol."
 *
 * A standalone cross-protocol chat application integrated into DegenFeed.
 * Messages flow between Nostr, Farcaster, Mastodon, Bluesky, Lens, Matrix and
 * XMPP through a Redis pub/sub hub with per-protocol adapters.
 *
 * Modules:
 *   channels            — Redis channel names + event envelopes
 *   redis-hub           — Redis pub/sub hub for cross-protocol message relay
 *   protocol-adapters   — 7 native protocol adapters (Nostr NIP-04/NIP-29, …)
 *   relay               — relay service wiring hub → adapters
 *   identity            — useIdentityResolution hook (npub ↔ fid ↔ did ↔ acct ↔ wallet)
 *   offline-queue       — persisted offline message queue with replay
 *   useDegenChatConnection — per-adapter connection status + auto-reconnect
 */

export { DEGENCHAT_TAGLINE } from './brand';
export {
  DEGENCHAT_CHANNEL_LIST,
  DEGENCHAT_CHANNELS,
  type DegenChatBridgeStatusPayload,
  type DegenChatChannel,
  type DegenChatDmPayload,
  type DegenChatEnvelope,
  type DegenChatGroupPayload,
  type DegenChatIdentityPayload,
  type DegenChatPresencePayload,
  type DegenChatReadReceiptPayload,
  type DegenChatTypingPayload,
} from './channels';
export {
  type DegenIdentity,
  type DegenIdentityLink,
  getDeliveryProtocolsForIdentity,
  type ResolveDegenIdentityOptions,
  resolveDegenIdentity,
  type UseIdentityResolutionResult,
  useIdentityResolution,
} from './identity';
export {
  createOfflineQueue,
  getOfflineQueue,
  OFFLINE_QUEUE_KEY,
  OFFLINE_QUEUE_MAX,
  OFFLINE_QUEUE_MAX_ATTEMPTS,
  type DegenChatQueuedDraft,
  type DegenChatQueuedMessage,
  type OfflineQueue,
  type StorageLike,
  resetOfflineQueue,
} from './offline-queue';
export {
  type AdapterConnectionState,
  type DegenChatConnectionOptions,
  type DegenChatConnectionResult,
  useDegenChatConnection,
} from './useDegenChatConnection';
export {
  checkAdapterHealth,
  DEGENCHAT_ADAPTERS,
  DEGENCHAT_PROTOCOL_IDS,
  type DegenChatAdapter,
  type DegenChatAdapterCapabilities,
  type DegenChatAdapterConfig,
  type DegenChatAdapterMessage,
  type DegenChatAdapterResult,
  type DegenChatProtocolId,
  getAdapter,
  getSupportedProtocols,
  sendViaAdapter,
} from './protocol-adapters';
export {
  getRedisHub,
  type RedisClientLike,
  RedisHub,
  type RedisHubOptions,
  type RedisHubStatus,
  resetRedisHub,
} from './redis-hub';
export {
  DegenChatRelay,
  type DegenChatRelayOptions,
  getDegenChatRelay,
  type RelayDeliveryResult,
  resetDegenChatRelay,
} from './relay';
