/**
 * @degenfeed/realtime — Barrel exports
 *
 * Cross-protocol Direct Message Bridge, identity resolver,
 * protocol transports, NIP-17 Nostr DMs, realtime context,
 * unified inbox, cross-protocol router, spaces bridge,
 * multi-device sync, IRC bridge, cross-protocol group chat,
 * and chat discovery.
 */

export type { ChannelName } from './channels';
export { CHANNEL_LIST, CHANNELS } from './channels';

// ─── Cross-Protocol Router ──────────────────────────────────────────────────
export type {
  IncomingMessage,
  MessageContentType,
  MessageReaction,
  OutboundMessage,
  ReadReceipt,
  RoutedMessageResult,
  TypingIndicator,
} from './cross-protocol-router';
export {
  buildConversationId,
  CrossProtocolRouter,
  getRouter,
} from './cross-protocol-router';

// ─── Identity Resolver ──────────────────────────────────────────────────────
export type {
  IdentifierFormat,
  IdentityResolverOptions,
  ProtocolIdentity,
  ResolvableProtocol,
  ResolvedIdentity,
} from './identity-resolver';
export {
  detectIdentifier,
  getDeliveryProtocols,
  resolveIdentity,
  sourceProtocolFromFormat,
} from './identity-resolver';

// ─── Message Bridge (legacy) ────────────────────────────────────────────────
export type {
  BridgeResult,
  CrossProtocolIdentities,
  DeliveryStatus,
  DmProtocol,
  UnifiedMessage,
} from './message-bridge';
export {
  generateMessageId,
  MessageBridge,
} from './message-bridge';

// ─── Protocol Transports ────────────────────────────────────────────────────
export type {
  ProtocolHealth,
  TransportMessage,
  TransportProtocol,
  TransportResult,
} from './protocol-transports';
export {
  getProtocolHealth,
  ProtocolTransports,
} from './protocol-transports';

// ─── NIP-17 Nostr Transport ────────────────────────────────────────────────
export type {
  Nip17Message,
  Nip17ReceiveResult,
  Nip17SendResult,
} from './nip17-transport';
export {
  createNip17GiftWrap,
  npubToHex,
  receiveNip17Messages,
} from './nip17-transport';

// ─── Unified Inbox ──────────────────────────────────────────────────────────
export type {
  DeliveryStatusMap,
  InboxMessage,
  InboxReaction,
  InboxSummary,
  InboxThread,
  ProtocolBadge,
} from './unified-inbox';
export {
  getInbox,
  getProtocolBadge,
  PROTOCOL_BADGES,
  UnifiedInbox,
} from './unified-inbox';

// ─── Spaces Bridge ──────────────────────────────────────────────────────────
export type {
  SpaceBroadcastResult,
  SpaceEvent,
  SpaceEventType,
} from './spaces-bridge';
export {
  getSpacesBridge,
  SpacesBridge,
} from './spaces-bridge';

// ─── Multi-Device Sync ──────────────────────────────────────────────────────
export type {
  DeviceInfo,
  DeviceSyncPayload,
  OutboxEntry,
  OutboxQueue,
  SyncState,
} from './multi-device-sync';
export {
  getSync,
  MultiDeviceSync,
} from './multi-device-sync';

// ─── IRC Bridge Client ──────────────────────────────────────────────────────
export type {
  IrcBridgeConfig,
  IrcBridgeHealth,
  IrcChannelInfo,
} from './irc-bridge-client';
export {
  IrcBridgeClient,
} from './irc-bridge-client';

// ─── Cross-Protocol Group Chat ──────────────────────────────────────────────
export type {
  CrossProtocolRoom,
  CrossProtocolRoomCreateParams,
  GroupChatMessage,
  GroupMember,
  GroupMemberRole,
} from './cross-protocol-group-chat';
export {
  CrossProtocolGroupChat,
  getGroupChat,
} from './cross-protocol-group-chat';

// ─── Chat Discovery ─────────────────────────────────────────────────────────
export type {
  DiscoveredCommunity,
  DiscoveryResult,
  DiscoverySearchParams,
} from './chat-discovery';
export {
  ChatDiscovery,
  getDiscovery,
} from './chat-discovery';

// ─── Realtime Hooks ─────────────────────────────────────────────────────────
export { useRealtime } from './useRealtime';
export { RealtimeStatusDot, useRealtimeContext, WebSocketProvider } from './websocket-context';
