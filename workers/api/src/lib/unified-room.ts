/**
 * @degenfeed/api-worker — Unified Cross-Protocol Room System
 *
 * Thin barrel — re-exports from domain-specific modules.
 */

export {
  ALL_TRANSPORTS,
  KV_ROOM_MESSAGES_PREFIX,
  KV_ROOM_PREFIX,
  KV_USER_ROOMS_PREFIX,
} from './unified-room-constants';
export { sendRoomMessage } from './unified-room-delivery';
export { acceptInvite, inviteToRoom } from './unified-room-invites';
export { getRoomKey, rotateRoomKey } from './unified-room-keys';
export {
  createUnifiedRoom,
  getUnifiedRoom,
  joinUnifiedRoom,
  leaveUnifiedRoom,
  updateMemberTransport,
} from './unified-room-management';
export { resolveMentions } from './unified-room-mentions';
export { getRoomMessages, getUnreadCounts, getUserRooms, isRoomMember } from './unified-room-query';
export type {
  MemberDeliveryStatus,
  MentionResolution,
  RoomInvite,
  RoomMember,
  RoomMessage,
  RoomTransport,
  RoomTransportState,
  UnifiedRoom,
  UnreadCount,
} from './unified-room-types';
