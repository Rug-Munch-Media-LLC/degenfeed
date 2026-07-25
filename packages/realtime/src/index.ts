/**
 * @degenfeed/realtime — Barrel exports
 *
 * Cross-protocol Direct Message Bridge, identity resolver,
 * protocol transports, NIP-17 Nostr DMs, and realtime context.
 */

export type { ChannelName } from './channels';
export { CHANNEL_LIST, CHANNELS } from './channels';
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

export { useRealtime } from './useRealtime';
export { RealtimeStatusDot, useRealtimeContext, WebSocketProvider } from './websocket-context';
