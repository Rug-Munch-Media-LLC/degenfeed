/**
 * @degenfeed/chat-super-app — DegenFeed Chat Super-App
 *
 * THE best chat app in Web3. WhatsApp for Web3 but BETTER.
 * Matrix as the central hub, bridging ALL protocols.
 *
 * Modules:
 *   matrix-hub        — Conduit-based Matrix hub as universal chat fabric
 *   protocol-bridges  — Native protocol bridge adapters (Nostr NIP-17, etc.)
 *   self-destruct     — Disappearing messages & view-once media
 *   calling           — WebRTC P2P + LiveKit SFU audio/video calling
 *   chat-features     — WhatsApp-style features (read receipts, reactions, etc.)
 *   key-verification  — Cross-protocol key verification (QR, safety numbers)
 */

export { MatrixHub, getMatrixHub, BRIDGEABLE_PROTOCOLS } from './matrix-hub';
export type {
  BridgeConfig,
  BridgeRoom,
  BridgeMessage,
  BridgeStatus,
  BridgeProtocol,
} from './matrix-hub';

export { ProtocolBridges, getProtocolBridges, PROTOCOL_CONFIGS } from './protocol-bridges';
export type {
  BridgeProtocolId,
  ProtocolMessage,
  ProtocolConfig,
} from './protocol-bridges';

export {
  SelfDestructManager,
  getSelfDestructManager,
  SELF_DESTRUCT_OPTIONS,
  createScreenshotDetector,
} from './self-destruct';
export type {
  SelfDestructDuration,
  ConversationTimer,
  DisappearingMessage,
  ViewOnceMedia,
} from './self-destruct';

export {
  CallManager,
  getCallManager,
  createPeerConnection,
  getUserMedia,
  getDisplayMedia,
} from './calling';
export type {
  CallType,
  CallState,
  CallSession,
  CallParticipant,
  CallHistoryEntry,
  Voicemail,
  CallSignallingMessage,
  CallEndReason,
} from './calling';

export {
  ChatFeaturesManager,
  getChatFeaturesManager,
} from './chat-features';
export type {
  ReadReceipt,
  TypingState,
  PresenceState,
  MessageReaction,
  PinnedMessage,
  StarredMessage,
  ChatWallpaper,
  ChatNotificationSettings,
  ChatBackup,
} from './chat-features';

export {
  KeyVerificationManager,
  getKeyVerificationManager,
} from './key-verification';
export type {
  KeyFingerprint,
  KeyVerificationRequest,
  KeyVerificationResult,
} from './key-verification';
