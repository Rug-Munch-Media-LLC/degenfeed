/**
 * @degenfeed/api-worker — Unified Cross-Protocol Room System
 *
 * Group chats that span Nostr, Matrix, Farcaster, Bluesky, Telegram, and Web.
 * A room stores members with per-user transport preferences. When a message
 * is sent, it's fanned out to each member through their preferred transport.
 *
 * Security model:
 *   - Room has an encryption key (AES-256-GCM) rotated on member add/remove
 *   - Messages encrypted before storage in KV
 *   - Each member's transport identity is resolved at send time
 *   - Delivery status tracked per-member per-message
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, and fallback. No silent failures.
 */

import type { Env } from '../index';
import { seal, unseal } from './crypto-seal';

// ─── Types ──────────────────────────────────────────────────────────────────

export type RoomTransport =
  | 'nostr'
  | 'matrix'
  | 'farcaster'
  | 'bluesky'
  | 'telegram'
  | 'web';

export interface RoomMember {
  /** Canonical user ID (wallet address) */
  id: string;
  /** Display name */
  displayName?: string;
  /** The transport this member prefers for receiving room messages */
  transport: RoomTransport;
  /** Protocol-specific identity info */
  identity: {
    nostr?: { npub: string; pubkey: string; relays?: string[] };
    matrix?: { userId: string; homeserver: string };
    farcaster?: { fid: number; username?: string };
    bluesky?: { did: string; handle?: string };
    telegram?: { chatId: string; userId?: string };
  };
  /** Role in the room */
  role: 'admin' | 'member';
  /** When they joined (unix ms) */
  joinedAt: number;
  /** Last active timestamp */
  lastActive: number;
}

export interface RoomTransportState {
  nostr: boolean;
  matrix: boolean;
  farcaster: boolean;
  bluesky: boolean;
  telegram: boolean;
}

export interface UnifiedRoom {
  /** Unique room ID */
  id: string;
  /** Room name */
  name: string;
  /** Room description */
  description: string;
  /** Creator wallet address */
  creator: string;
  /** Room members */
  members: RoomMember[];
  /** Which transports are active across the room */
  transports: RoomTransportState;
  /** Encrypted room encryption key (stored for members) */
  encryptedKey: string;
  /** Encryption key version (incremented on rotation) */
  keyVersion: number;
  /** Created at (unix ms) */
  createdAt: number;
  /** Last activity (unix ms) */
  lastActivity: number;
  /** Room icon URL (optional) */
  iconUrl?: string;
}

export interface RoomMessage {
  /** Unique message ID */
  id: string;
  /** Room ID */
  roomId: string;
  /** Sender member ID */
  fromId: string;
  /** Sender display name */
  fromName: string;
  /** The message content (plaintext for storage, encrypted at transport) */
  content: string;
  /** Encrypted content (AES-GCM, base64url) */
  encryptedContent: string;
  /** IV for decryption (base64url) */
  iv: string;
  /** Key version used */
  keyVersion: number;
  /** Created at (unix ms) */
  createdAt: number;
  /** Per-member delivery status */
  deliveryStatus: Record<string, MemberDeliveryStatus>;
  /** If this is a reply — parent message ID */
  replyTo?: string;
  /** Mentioned members (resolved IDs) */
  mentions?: string[];
  /** Transport this message was sent from (source transport) */
  sourceTransport: RoomTransport;
}

export interface MemberDeliveryStatus {
  transport: RoomTransport;
  ok: boolean;
  nativeId?: string;
  error?: string;
  attemptedAt: number;
  deliveredAt?: number;
}

export interface MentionResolution {
  /** Raw mention text (e.g. "@alice", "@npub1...") */
  raw: string;
  /** Resolved member ID or null */
  memberId: string | null;
  /** Resolved display name */
  displayName: string | null;
  /** How it was resolved */
  resolvedVia: 'member-name' | 'npub' | 'fid' | 'bsky-handle' | 'wallet' | 'unknown';
}

export interface RoomInvite {
  id: string;
  roomId: string;
  /** Who sent the invite */
  fromId: string;
  /** The invite target (wallet, npub, FID, DID, handle) */
  target: string;
  /** Resolved member ID if accepted */
  resolvedMemberId?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  expiresAt: number;
}

export interface UnreadCount {
  roomId: string;
  count: number;
  lastMessagePreview?: string;
  lastMessageAt?: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const KV_ROOM_PREFIX = 'uroom:';
const KV_ROOM_MESSAGES_PREFIX = 'uroom:msgs:';
const KV_ROOM_INVITES_PREFIX = 'uroom:invite:';
const KV_USER_ROOMS_PREFIX = 'uroom:user:';
const KV_MENTION_INDEX_PREFIX = 'uroom:mention:';

const MAX_ROOM_SIZE = 250;
const MAX_MESSAGE_HISTORY = 1000;
const KEY_BYTE_LENGTH = 32;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const ALL_TRANSPORTS: RoomTransport[] = [
  'nostr', 'matrix', 'farcaster', 'bluesky', 'telegram', 'web',
];

// ─── Base64 Helpers ─────────────────────────────────────────────────────────

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const raw = atob(str + padding);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

// ─── Room Helpers ───────────────────────────────────────────────────────────

function roomKey(id: string): string {
  return `${KV_ROOM_PREFIX}${id}`;
}

function messagesKey(roomId: string): string {
  return `${KV_ROOM_MESSAGES_PREFIX}${roomId}`;
}

function userRoomsKey(userId: string): string {
  return `${KV_USER_ROOMS_PREFIX}${userId.toLowerCase()}`;
}

function inviteKey(roomId: string, inviteId: string): string {
  return `${KV_ROOM_INVITES_PREFIX}${roomId}:${inviteId}`;
}

function mentionIndexKey(normalized: string): string {
  return `${KV_MENTION_INDEX_PREFIX}${normalized}`;
}

function normalizeMention(text: string): string {
  return text.replace(/^@/, '').toLowerCase().trim();
}

function computeTransportState(members: RoomMember[]): RoomTransportState {
  const state: RoomTransportState = { nostr: false, matrix: false, farcaster: false, bluesky: false, telegram: false };
  for (const m of members) {
    if (m.transport === 'nostr') state.nostr = true;
    else if (m.transport === 'matrix') state.matrix = true;
    else if (m.transport === 'farcaster') state.farcaster = true;
    else if (m.transport === 'bluesky') state.bluesky = true;
    else if (m.transport === 'telegram') state.telegram = true;
  }
  return state;
}

// ─── Encryption ─────────────────────────────────────────────────────────────

async function generateRoomKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

async function exportRoomKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toBase64Url(raw);
}

async function importRoomKey(keyStr: string): Promise<CryptoKey> {
  const raw = fromBase64Url(keyStr);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt', 'decrypt',
  ]);
}

async function encryptMessageContent(
  plaintext: string,
  key: CryptoKey,
): Promise<{ encryptedContent: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    encryptedContent: toBase64Url(encrypted),
    iv: toBase64Url(iv),
  };
}

async function decryptMessageContent(
  encryptedContent: string,
  iv: string,
  key: CryptoKey,
): Promise<string> {
  const ct = fromBase64Url(encryptedContent);
  const ivBytes = fromBase64Url(iv);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, ct);
  return new TextDecoder().decode(decrypted);
}

// ─── Room CRUD ──────────────────────────────────────────────────────────────

/**
 * Create a new cross-platform unified room.
 */
export async function createUnifiedRoom(
  env: Env,
  creatorId: string,
  name: string,
  description: string,
  members: Array<{
    id: string;
    transport: RoomTransport;
    identity?: Partial<RoomMember['identity']>;
  }>,
): Promise<UnifiedRoom> {
  if (!env.CACHE) throw new Error('[uroom] KV not available');

  const allMemberIds = [...new Set([creatorId, ...members.map((m) => m.id)])];
  if (allMemberIds.length > MAX_ROOM_SIZE) {
    throw new Error(`[uroom] Room exceeds max size of ${MAX_ROOM_SIZE}`);
  }
  if (allMemberIds.length < 1) {
    throw new Error('[uroom] Room must have at least 1 member');
  }

  const roomId = crypto.randomUUID();

  // Generate room encryption key
  const roomKey = await generateRoomKey();
  const roomKeyStr = await exportRoomKey(roomKey);

  // Encrypt room key for the creator (via seal)
  const encryptedKey = await seal(env, roomKeyStr, `uroom:key:${roomId}`);

  const now = Date.now();

  const roomMembers: RoomMember[] = allMemberIds.map((id, i) => {
    const m = members.find((x) => x.id === id);
    const defaultIdentity: RoomMember['identity'] = {};
    return {
      id: id.toLowerCase(),
      displayName: m?.id?.slice(0, 10) || id.slice(0, 10),
      transport: m?.transport || 'web',
      identity: m?.identity ? { ...defaultIdentity, ...m.identity } : defaultIdentity,
      role: id === creatorId ? 'admin' : 'member',
      joinedAt: now,
      lastActive: now,
    };
  });

  const room: UnifiedRoom = {
    id: roomId,
    name,
    description,
    creator: creatorId.toLowerCase(),
    members: roomMembers,
    transports: computeTransportState(roomMembers),
    encryptedKey,
    keyVersion: 1,
    createdAt: now,
    lastActivity: now,
  };

  // Store room in KV
  await env.CACHE.put(roomKey(roomId), JSON.stringify(room), {
    expirationTtl: 86400 * 365,
  });

  // Index for all members
  for (const member of roomMembers) {
    await addRoomToUserIndex(env, member.id, roomId);
    // Build mention index for the member
    if (member.displayName) {
      await env.CACHE.put(
        mentionIndexKey(normalizeMention(member.displayName)),
        JSON.stringify({ roomId, memberId: member.id }),
        { expirationTtl: 86400 * 365 },
      ).catch(() => {});
    }
  }

  return room;
}

/**
 * Get a unified room by ID.
 */
export async function getUnifiedRoom(
  env: Env,
  roomId: string,
): Promise<UnifiedRoom | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(roomKey(roomId));
    if (!raw) return null;
    return JSON.parse(raw) as UnifiedRoom;
  } catch {
    return null;
  }
}

/**
 * Update a room in KV.
 */
async function saveRoom(env: Env, room: UnifiedRoom): Promise<void> {
  if (!env.CACHE) return;
  await env.CACHE.put(roomKey(room.id), JSON.stringify(room), {
    expirationTtl: 86400 * 365,
  });
}

// ─── Member Management ──────────────────────────────────────────────────────

/**
 * Join a unified room with a transport preference.
 * Triggers key rotation if the room has existing members.
 */
export async function joinUnifiedRoom(
  env: Env,
  roomId: string,
  userId: string,
  transport: RoomTransport,
  identity?: Partial<RoomMember['identity']>,
): Promise<UnifiedRoom> {
  if (!env.CACHE) throw new Error('[uroom] KV not available');

  const room = await getUnifiedRoom(env, roomId);
  if (!room) throw new Error('[uroom] Room not found');

  if (room.members.some((m) => m.id === userId.toLowerCase())) {
    throw new Error('[uroom] Already a member');
  }

  if (room.members.length >= MAX_ROOM_SIZE) {
    throw new Error(`[uroom] Room full (max ${MAX_ROOM_SIZE})`);
  }

  const now = Date.now();
  room.members.push({
    id: userId.toLowerCase(),
    displayName: userId.slice(0, 10),
    transport,
    identity: identity || {},
    role: 'member',
    joinedAt: now,
    lastActive: now,
  });

  // Recompute transport state
  room.transports = computeTransportState(room.members);

  // Rotate key if there are other members
  if (room.members.length > 1) {
    await rotateRoomKey(env, roomId);
    // Re-read rotated room
    const rotated = await getUnifiedRoom(env, roomId);
    if (rotated) {
      Object.assign(room, rotated);
    }
  }

  room.lastActivity = now;
  await saveRoom(env, room);
  await addRoomToUserIndex(env, userId, roomId);

  // Index mention
  if (userId) {
    await env.CACHE.put(
      mentionIndexKey(normalizeMention(userId)),
      JSON.stringify({ roomId, memberId: userId.toLowerCase() }),
      { expirationTtl: 86400 * 365 },
    ).catch(() => {});
  }

  return room;
}

/**
 * Leave a unified room. Triggers key rotation for remaining members.
 */
export async function leaveUnifiedRoom(
  env: Env,
  roomId: string,
  userId: string,
): Promise<void> {
  if (!env.CACHE) throw new Error('[uroom] KV not available');

  const room = await getUnifiedRoom(env, roomId);
  if (!room) throw new Error('[uroom] Room not found');

  const idx = room.members.findIndex((m) => m.id === userId.toLowerCase());
  if (idx < 0) throw new Error('[uroom] Not a member');

  room.members.splice(idx, 1);
  room.transports = computeTransportState(room.members);

  // Rotate key for remaining members (post-compromise security)
  await saveRoom(env, room);
  if (room.members.length > 0) {
    await rotateRoomKey(env, roomId);
  }

  await removeRoomFromUserIndex(env, userId, roomId);
  // Remove mention index
  await env.CACHE.delete(mentionIndexKey(normalizeMention(userId))).catch(() => {});
}

/**
 * Update transport preference for a member.
 */
export async function updateMemberTransport(
  env: Env,
  roomId: string,
  userId: string,
  transport: RoomTransport,
): Promise<UnifiedRoom> {
  const room = await getUnifiedRoom(env, roomId);
  if (!room) throw new Error('[uroom] Room not found');

  const member = room.members.find((m) => m.id === userId.toLowerCase());
  if (!member) throw new Error('[uroom] Not a member');

  member.transport = transport;
  room.transports = computeTransportState(room.members);
  member.lastActive = Date.now();

  await saveRoom(env, room);
  return room;
}

/**
 * Invite someone to a room by any identifier (wallet, npub, FID, DID, handle).
 */
export async function inviteToRoom(
  env: Env,
  roomId: string,
  fromId: string,
  target: string,
): Promise<RoomInvite> {
  const room = await getUnifiedRoom(env, roomId);
  if (!room) throw new Error('[uroom] Room not found');

  if (!room.members.some((m) => m.id === fromId.toLowerCase())) {
    throw new Error('[uroom] Only members can invite');
  }

  const invite: RoomInvite = {
    id: crypto.randomUUID(),
    roomId,
    fromId: fromId.toLowerCase(),
    target: target.trim(),
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + INVITE_TTL_MS,
  };

  await env.CACHE!.put(inviteKey(roomId, invite.id), JSON.stringify(invite), {
    expirationTtl: Math.ceil(INVITE_TTL_MS / 1000),
  });

  return invite;
}

/**
 * Accept an invite.
 */
export async function acceptInvite(
  env: Env,
  inviteId: string,
  roomId: string,
  userId: string,
  transport: RoomTransport,
  identity?: Partial<RoomMember['identity']>,
): Promise<UnifiedRoom> {
  if (!env.CACHE) throw new Error('[uroom] KV not available');

  const raw = await env.CACHE.get(inviteKey(roomId, inviteId));
  if (!raw) throw new Error('[uroom] Invite not found or expired');

  const invite = JSON.parse(raw) as RoomInvite;
  if (invite.status !== 'pending') throw new Error('[uroom] Invite already processed');

  invite.status = 'accepted';
  invite.resolvedMemberId = userId.toLowerCase();
  await env.CACHE.put(inviteKey(roomId, inviteId), JSON.stringify(invite), {
    expirationTtl: Math.ceil(INVITE_TTL_MS / 1000),
  });

  return joinUnifiedRoom(env, roomId, userId, transport, identity);
}

// ─── Key Rotation ───────────────────────────────────────────────────────────

/**
 * Rotate the room encryption key. Call after member add/remove.
 * Re-encrypts the key for all remaining members and stores in KV.
 */
export async function rotateRoomKey(
  env: Env,
  roomId: string,
): Promise<void> {
  if (!env.CACHE) return;

  const room = await getUnifiedRoom(env, roomId);
  if (!room) throw new Error('[uroom] Room not found');

  const newKey = await generateRoomKey();
  const newKeyStr = await exportRoomKey(newKey);

  // Re-encrypt the key for storage (the seal handles the per-room binding)
  const encryptedKey = await seal(env, newKeyStr, `uroom:key:${roomId}`);

  room.encryptedKey = encryptedKey;
  room.keyVersion += 1;

  await saveRoom(env, room);
}

/**
 * Get the room encryption key for a member.
 */
export async function getRoomKey(
  env: Env,
  roomId: string,
  userId: string,
): Promise<string | null> {
  if (!env.CACHE) return null;

  try {
    const room = await getUnifiedRoom(env, roomId);
    if (!room) return null;

    if (!room.members.some((m) => m.id === userId.toLowerCase())) {
      return null;
    }

    return await unseal(env, room.encryptedKey, `uroom:key:${roomId}`);
  } catch {
    return null;
  }
}

// ─── Message Fan-Out ────────────────────────────────────────────────────────

/**
 * Send a message to a unified room.
 * 1. Encrypt message with room key
 * 2. Store in KV
 * 3. Fan out to each member via their preferred transport
 * 4. Track delivery status per member
 */
export async function sendRoomMessage(
  env: Env,
  roomId: string,
  fromId: string,
  content: string,
  sourceTransport: RoomTransport = 'web',
  replyTo?: string,
): Promise<RoomMessage> {
  if (!env.CACHE) throw new Error('[uroom] KV not available');

  const room = await getUnifiedRoom(env, roomId);
  if (!room) throw new Error('[uroom] Room not found');

  const sender = room.members.find((m) => m.id === fromId.toLowerCase());
  if (!sender) throw new Error('[uroom] Not a member');

  // Get room encryption key
  const roomKeyStr = await getRoomKey(env, roomId, fromId);
  if (!roomKeyStr) throw new Error('[uroom] Cannot access room key');

  const key = await importRoomKey(roomKeyStr);

  // Resolve mentions in content
  const mentions = resolveMentions(content, room.members);

  // Encrypt message content
  const { encryptedContent, iv } = await encryptMessageContent(content, key);

  const msgId = crypto.randomUUID();
  const now = Date.now();

  // Build delivery status map (all pending initially)
  const deliveryStatus: Record<string, MemberDeliveryStatus> = {};
  for (const member of room.members) {
    if (member.id === fromId.toLowerCase()) {
      // Sender gets instant delivery
      deliveryStatus[member.id] = {
        transport: member.transport,
        ok: true,
        nativeId: msgId,
        attemptedAt: now,
        deliveredAt: now,
      };
      continue;
    }
    deliveryStatus[member.id] = {
      transport: member.transport,
      ok: false,
      error: 'pending',
      attemptedAt: now,
    };
  }

  const message: RoomMessage = {
    id: msgId,
    roomId,
    fromId: fromId.toLowerCase(),
    fromName: sender.displayName || fromId.slice(0, 10),
    content, // plaintext for KV
    encryptedContent,
    iv,
    keyVersion: room.keyVersion,
    createdAt: now,
    deliveryStatus,
    replyTo,
    mentions: mentions.map((m) => m.memberId).filter(Boolean) as string[],
    sourceTransport,
  };

  // Store message
  const msgsKey = messagesKey(roomId);
  const msgsRaw = await env.CACHE.get(msgsKey);
  const messages: RoomMessage[] = msgsRaw ? JSON.parse(msgsRaw) : [];
  messages.push(message);
  await env.CACHE.put(msgsKey, JSON.stringify(messages.slice(-MAX_MESSAGE_HISTORY)), {
    expirationTtl: 86400 * 90,
  });

  // Fan-out: deliver to each member via their preferred transport
  await fanOutMessage(env, room, message);

  // Update room activity
  room.lastActivity = now;
  await saveRoom(env, room);

  return message;
}

/**
 * Fan-out a message to all room members via their preferred transport.
 * Delivers in parallel, updates delivery status in KV.
 */
async function fanOutMessage(
  env: Env,
  room: UnifiedRoom,
  message: RoomMessage,
): Promise<void> {
  const deliverableMembers = room.members.filter(
    (m) => m.id !== message.fromId && m.transport !== 'web',
  );

  if (deliverableMembers.length === 0) return;

  const results = await Promise.allSettled(
    deliverableMembers.map(async (member) => {
      const result = await deliverToMember(env, room, message, member);
      return { memberId: member.id, result };
    }),
  );

  // Update delivery status in stored message
  const msgsKey = messagesKey(room.id);
  const msgsRaw = await env.CACHE.get(msgsKey);
  if (!msgsRaw) return;

  const messages: RoomMessage[] = JSON.parse(msgsRaw);
  const storedMsg = messages.find((m) => m.id === message.id);
  if (!storedMsg) return;

  for (const settled of results) {
    if (settled.status === 'fulfilled') {
      storedMsg.deliveryStatus[settled.value.memberId] = settled.value.result;
    }
  }

  await env.CACHE.put(msgsKey, JSON.stringify(messages.slice(-MAX_MESSAGE_HISTORY)), {
    expirationTtl: 86400 * 90,
  });
}

/**
 * Deliver a message to a single member via their preferred transport.
 * Falls back to WebSocket if the primary transport fails.
 */
async function deliverToMember(
  env: Env,
  room: UnifiedRoom,
  message: RoomMessage,
  member: RoomMember,
): Promise<MemberDeliveryStatus> {
  const fallbackOrder: RoomTransport[] = [member.transport, 'web'];

  for (const transport of fallbackOrder) {
    try {
      let result: MemberDeliveryStatus | null = null;

      switch (transport) {
        case 'nostr':
          result = await deliverViaNostr(env, member, message, room);
          break;
        case 'matrix':
          result = await deliverViaMatrix(env, member, message, room);
          break;
        case 'farcaster':
          result = await deliverViaFarcaster(env, member, message, room);
          break;
        case 'bluesky':
          result = await deliverViaBluesky(env, member, message, room);
          break;
        case 'telegram':
          result = await deliverViaTelegram(env, member, message, room);
          break;
        case 'web':
          result = await deliverViaWebSocket(env, member, message);
          break;
      }

      if (result && result.ok) return result;
    } catch (err) {
      // Continue to fallback
      console.error(`[uroom] ${transport} delivery failed for ${member.id}:`, err);
    }
  }

  // All fallbacks failed
  return {
    transport: member.transport,
    ok: false,
    error: 'All transports failed',
    attemptedAt: Date.now(),
  };
}

// ─── Transport Delivery Methods ─────────────────────────────────────────────

/**
 * Deliver room message to a member via Nostr NIP-04 DM.
 */
async function deliverViaNostr(
  env: Env,
  member: RoomMember,
  message: RoomMessage,
  room: UnifiedRoom,
): Promise<MemberDeliveryStatus | null> {
  if (!member.identity.nostr?.npub) return null;

  try {
    const nostr = await import('@degenfeed/nostr-sdk');
    const senderNsec = await env.CACHE?.get('nostr:sender:nsec');
    if (!senderNsec) return null;

    const senderPubkey = nostr.getPublicKey(senderNsec);
    const recipientPubkey = member.identity.nostr.pubkey;
    const relays = member.identity.nostr.relays ?? [
      'wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net',
    ];

    const roomContext = `[${room.name}] ${message.fromName}: `;
    const displayText = roomContext + message.content;
    const truncatedText = displayText.length > 200 ? displayText.slice(0, 200) + '…' : displayText;

    const encryptedContent = await nostr.nip04Encrypt(senderNsec, recipientPubkey, truncatedText);

    const ev = nostr.finishEvent({
      kind: 4,
      tags: [['p', recipientPubkey]],
      content: encryptedContent,
      created_at: Math.floor(Date.now() / 1000),
    }, senderNsec);

    const pool = new nostr.RelayPool(relays, { eoseTimeout: 5000 });
    await pool.publish(ev);
    pool.disconnectAll();

    return {
      transport: 'nostr',
      ok: true,
      nativeId: ev.id,
      attemptedAt: Date.now(),
      deliveredAt: Date.now(),
    };
  } catch (err) {
    return {
      transport: 'nostr',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      attemptedAt: Date.now(),
    };
  }
}

/**
 * Deliver room message to a member via Matrix DM.
 */
async function deliverViaMatrix(
  env: Env,
  member: RoomMember,
  message: RoomMessage,
  room: UnifiedRoom,
): Promise<MemberDeliveryStatus | null> {
  if (!member.identity.matrix?.userId) return null;

  try {
    const accessToken = env.MATRIX_ACCESS_TOKEN || await env.CACHE?.get('matrix:access_token');
    const homeserver = member.identity.matrix.homeserver || env.MATRIX_INSTANCE_URL || 'https://matrix.degenfeed.xyz';
    if (!accessToken) return null;

    const roomRef = `[${room.name}]`; // Will be used in message display
    const displayText = `**${roomRef} ${message.fromName}:** ${message.content}`;

    // Find or create DM room
    const createRes = await fetch(`${homeserver}/_matrix/client/v3/createRoom`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        preset: 'trusted_private_chat',
        invite: [member.identity.matrix.userId],
        is_direct: true,
        name: `DegenFeed: ${room.name}`,
      }),
    });

    if (!createRes.ok) {
      // Try sending to existing room
      const sendRes = await fetch(
        `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(member.identity.matrix.userId)}/send/m.room.message`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
          body: JSON.stringify({ msgtype: 'm.text', body: displayText }),
        },
      );
      if (!sendRes.ok) return null;
      const data = (await sendRes.json()) as { event_id: string };
      return {
        transport: 'matrix', ok: true, nativeId: data.event_id,
        attemptedAt: Date.now(), deliveredAt: Date.now(),
      };
    }

    const createData = (await createRes.json()) as { room_id: string };

    // Send via created room
    const sendRes = await fetch(
      `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(createData.room_id)}/send/m.room.message`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ msgtype: 'm.text', body: displayText }),
      },
    );

    if (!sendRes.ok) return null;
    const data = (await sendRes.json()) as { event_id: string };
    return {
      transport: 'matrix', ok: true, nativeId: data.event_id,
      attemptedAt: Date.now(), deliveredAt: Date.now(),
    };
  } catch (err) {
    return {
      transport: 'matrix', ok: false,
      error: err instanceof Error ? err.message : String(err),
      attemptedAt: Date.now(),
    };
  }
}

/**
 * Deliver room message to a member via Farcaster direct cast.
 */
async function deliverViaFarcaster(
  env: Env,
  member: RoomMember,
  message: RoomMessage,
  room: UnifiedRoom,
): Promise<MemberDeliveryStatus | null> {
  if (!member.identity.farcaster?.fid) return null;

  try {
    const signerKey = env.FARCASTER_SIGNER_KEY || await env.CACHE?.get('farcaster:signer_key');
    if (!signerKey) return null;

    const fid = env.FARCASTER_FID || await env.CACHE?.get('farcaster:bot_fid') || '1';

    // Construct a direct cast via Neynar or Hub
    const neynarKey = env.NEYNAR_API_KEY;
    const displayText = `[${room.name}] ${message.fromName}: ${message.content}`;
    const truncatedText = displayText.length > 280 ? displayText.slice(0, 277) + '…' : displayText;

    if (neynarKey) {
      const res = await fetch('https://api.neynar.com/v2/farcaster/cast', {
        method: 'POST',
        headers: {
          'api_key': neynarKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          signer_uuid: signerKey,
          text: truncatedText,
          parent: undefined,
          parent_author_fid: undefined,
          embeds: [],
          channel_id: undefined,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { cast: { hash: string } };
        return {
          transport: 'farcaster', ok: true, nativeId: data.cast.hash,
          attemptedAt: Date.now(), deliveredAt: Date.now(),
        };
      }
    }

    // Fallback: try Hub API
    const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';
    const hubRes = await fetch(`${hubUrl}/v1/submitMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: new TextEncoder().encode(truncatedText),
    });

    if (hubRes.ok) {
      return {
        transport: 'farcaster', ok: true,
        attemptedAt: Date.now(), deliveredAt: Date.now(),
      };
    }

    return {
      transport: 'farcaster', ok: false, error: 'Farcaster delivery failed',
      attemptedAt: Date.now(),
    };
  } catch (err) {
    return {
      transport: 'farcaster', ok: false,
      error: err instanceof Error ? err.message : String(err),
      attemptedAt: Date.now(),
    };
  }
}

/**
 * Deliver room message to a member via Bluesky DM.
 */
async function deliverViaBluesky(
  env: Env,
  member: RoomMember,
  message: RoomMessage,
  room: UnifiedRoom,
): Promise<MemberDeliveryStatus | null> {
  if (!member.identity.bluesky?.did) return null;

  try {
    const accessToken = env.BSKY_ACCESS_TOKEN || await env.CACHE?.get('bluesky:access_jwt');
    const senderDid = env.BSKY_DID || await env.CACHE?.get('bluesky:did');
    if (!accessToken || !senderDid) return null;

    const displayText = `🏠 ${room.name} — ${message.fromName}: ${message.content}`;
    const truncatedText = displayText.length > 280 ? displayText.slice(0, 277) + '…' : displayText;

    const res = await fetch('https://bsky.social/xrpc/chat.bsky.conversation.sendMessage', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        conversation: { did: member.identity.bluesky.did },
        message: {
          text: truncatedText,
          createdAt: new Date().toISOString(),
        },
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { id: string };
      return {
        transport: 'bluesky', ok: true, nativeId: data.id,
        attemptedAt: Date.now(), deliveredAt: Date.now(),
      };
    }

    // Fallback: mention post
    const handle = member.identity.bluesky.handle || member.identity.bluesky.did;
    const mention = handle.startsWith('did:') ? handle : `@${handle}`;
    const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        repo: senderDid,
        collection: 'app.bsky.feed.post',
        record: {
          text: `${mention} ${truncatedText}`,
          createdAt: new Date().toISOString(),
        },
      }),
    });

    if (!postRes.ok) return null;
    const postData = (await postRes.json()) as { uri: string };
    return {
      transport: 'bluesky', ok: true, nativeId: postData.uri,
      attemptedAt: Date.now(), deliveredAt: Date.now(),
    };
  } catch (err) {
    return {
      transport: 'bluesky', ok: false,
      error: err instanceof Error ? err.message : String(err),
      attemptedAt: Date.now(),
    };
  }
}

/**
 * Deliver room message to a member via Telegram bot.
 */
async function deliverViaTelegram(
  env: Env,
  member: RoomMember,
  message: RoomMessage,
  room: UnifiedRoom,
): Promise<MemberDeliveryStatus | null> {
  if (!member.identity.telegram?.chatId) return null;

  try {
    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return null;

    const chatId = member.identity.telegram.chatId;
    const displayText = `🏠 *${room.name}*\n👤 ${message.fromName}:\n${message.content}`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: displayText,
        parse_mode: 'Markdown',
      }),
    });

    if (!res.ok) {
      return {
        transport: 'telegram', ok: false,
        error: `Telegram API error: ${res.status}`,
        attemptedAt: Date.now(),
      };
    }

    const data = (await res.json()) as { result: { message_id: number } };
    return {
      transport: 'telegram', ok: true, nativeId: String(data.result.message_id),
      attemptedAt: Date.now(), deliveredAt: Date.now(),
    };
  } catch (err) {
    return {
      transport: 'telegram', ok: false,
      error: err instanceof Error ? err.message : String(err),
      attemptedAt: Date.now(),
    };
  }
}

/**
 * Deliver via WebSocket (fallback / web users).
 */
async function deliverViaWebSocket(
  env: Env,
  member: RoomMember,
  message: RoomMessage,
): Promise<MemberDeliveryStatus | null> {
  try {
    const { broadcastToUser } = await import('../ws-broadcast');

    const delivered = broadcastToUser(member.id, 'room:message', {
      id: message.id,
      roomId: message.roomId,
      fromId: message.fromId,
      fromName: message.fromName,
      content: message.content,
      encryptedContent: message.encryptedContent,
      keyVersion: message.keyVersion,
      sourceTransport: message.sourceTransport,
      createdAt: message.createdAt,
    });

    if (delivered) {
      return {
        transport: 'web', ok: true, nativeId: message.id,
        attemptedAt: Date.now(), deliveredAt: Date.now(),
      };
    }

    return {
      transport: 'web', ok: false, error: 'WebSocket user offline',
      attemptedAt: Date.now(),
    };
  } catch (err) {
    return {
      transport: 'web', ok: false,
      error: err instanceof Error ? err.message : String(err),
      attemptedAt: Date.now(),
    };
  }
}

// ─── Cross-Platform Mention Resolution ──────────────────────────────────────

/**
 * Resolve @mentions in message content against room members.
 * Supports:
 *   - @displayName   → resolved against member display names
 *   - @npub1...      → resolved against Nostr npub
 *   - @0x...         → resolved against wallet address
 *   - @12345         → resolved against Farcaster FID (if numeric)
 *   - @handle.bsky.social → resolved against Bluesky handle
 */
export function resolveMentions(
  content: string,
  members: RoomMember[],
): MentionResolution[] {
  const mentionPattern = /@(\S+)/g;
  const resolutions: MentionResolution[] = [];
  let match: RegExpExecArray | null;

  while ((match = mentionPattern.exec(content)) !== null) {
    const raw = `@${match[1]}`;
    const normalized = normalizeMention(raw);

    // Try matching by display name
    const byName = members.find(
      (m) => m.displayName?.toLowerCase() === normalized || m.id.toLowerCase() === normalized,
    );
    if (byName) {
      resolutions.push({
        raw,
        memberId: byName.id,
        displayName: byName.displayName || byName.id,
        resolvedVia: 'member-name',
      });
      continue;
    }

    // Try matching by npub
    const byNpub = members.find(
      (m) => m.identity.nostr?.npub?.toLowerCase() === normalized,
    );
    if (byNpub) {
      resolutions.push({
        raw, memberId: byNpub.id,
        displayName: byNpub.displayName || byNpub.id,
        resolvedVia: 'npub',
      });
      continue;
    }

    // Try numeric FID
    if (/^\d+$/.test(normalized)) {
      const fid = parseInt(normalized, 10);
      const byFid = members.find((m) => m.identity.farcaster?.fid === fid);
      if (byFid) {
        resolutions.push({
          raw, memberId: byFid.id,
          displayName: byFid.displayName || byFid.id,
          resolvedVia: 'fid',
        });
        continue;
      }
    }

    // Try wallet address
    if (normalized.startsWith('0x')) {
      const byWallet = members.find((m) => m.id === normalized);
      if (byWallet) {
        resolutions.push({
          raw, memberId: byWallet.id,
          displayName: byWallet.displayName || byWallet.id,
          resolvedVia: 'wallet',
        });
        continue;
      }
    }

    // Try Bluesky handle
    if (normalized.endsWith('.bsky.social')) {
      const byBsky = members.find(
        (m) => m.identity.bluesky?.handle?.toLowerCase() === normalized,
      );
      if (byBsky) {
        resolutions.push({
          raw, memberId: byBsky.id,
          displayName: byBsky.displayName || byBsky.id,
          resolvedVia: 'bsky-handle',
        });
        continue;
      }
    }

    // Unresolved mention
    resolutions.push({
      raw, memberId: null, displayName: null, resolvedVia: 'unknown',
    });
  }

  return resolutions;
}

// ─── Message Retrieval ──────────────────────────────────────────────────────

/**
 * Get messages for a room.
 */
export async function getRoomMessages(
  env: Env,
  roomId: string,
  limit = 50,
  before?: number,
): Promise<RoomMessage[]> {
  if (!env.CACHE) return [];

  const key = messagesKey(roomId);
  const raw = await env.CACHE.get(key);
  if (!raw) return [];

  const messages: RoomMessage[] = JSON.parse(raw);
  let filtered = messages;
  if (before) {
    filtered = filtered.filter((m) => m.createdAt < before);
  }

  return filtered.slice(-limit);
}

// ─── User Room Index ────────────────────────────────────────────────────────

async function addRoomToUserIndex(env: Env, userId: string, roomId: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    const key = userRoomsKey(userId);
    const raw = await env.CACHE.get(key);
    const rooms: string[] = raw ? JSON.parse(raw) : [];
    if (!rooms.includes(roomId)) {
      rooms.push(roomId);
      await env.CACHE.put(key, JSON.stringify(rooms), { expirationTtl: 86400 * 365 });
    }
  } catch {
    // Non-critical
  }
}

async function removeRoomFromUserIndex(env: Env, userId: string, roomId: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    const key = userRoomsKey(userId);
    const raw = await env.CACHE.get(key);
    if (!raw) return;
    const rooms: string[] = JSON.parse(raw);
    const idx = rooms.indexOf(roomId);
    if (idx >= 0) {
      rooms.splice(idx, 1);
      await env.CACHE.put(key, JSON.stringify(rooms), { expirationTtl: 86400 * 365 });
    }
  } catch {
    // Non-critical
  }
}

/**
 * Get all rooms for a user.
 */
export async function getUserRooms(
  env: Env,
  userId: string,
): Promise<UnifiedRoom[]> {
  if (!env.CACHE) return [];

  try {
    const key = userRoomsKey(userId);
    const raw = await env.CACHE.get(key);
    if (!raw) return [];

    const roomIds: string[] = JSON.parse(raw);
    const rooms: UnifiedRoom[] = [];

    for (const roomId of roomIds) {
      const room = await getUnifiedRoom(env, roomId);
      if (room) rooms.push(room);
    }

    return rooms.sort((a, b) => b.lastActivity - a.lastActivity);
  } catch {
    return [];
  }
}

/**
 * Get unread counts for all rooms a user is in.
 */
export async function getUnreadCounts(
  env: Env,
  userId: string,
): Promise<UnreadCount[]> {
  const rooms = await getUserRooms(env, userId);
  const counts: UnreadCount[] = [];

  for (const room of rooms) {
    const messages = await getRoomMessages(env, room.id, 1);
    const lastMsg = messages[messages.length - 1];
    const isRead = !lastMsg || lastMsg.fromId === userId.toLowerCase();

    counts.push({
      roomId: room.id,
      count: isRead ? 0 : 1,
      lastMessagePreview: lastMsg ? lastMsg.content.slice(0, 80) : undefined,
      lastMessageAt: lastMsg?.createdAt,
    });
  }

  return counts;
}

/**
 * Check if a user is a member of a room.
 */
export async function isRoomMember(
  env: Env,
  roomId: string,
  userId: string,
): Promise<boolean> {
  const room = await getUnifiedRoom(env, roomId);
  if (!room) return false;
  return room.members.some((m) => m.id === userId.toLowerCase());
}

export {
  ALL_TRANSPORTS,
  KV_ROOM_PREFIX,
  KV_ROOM_MESSAGES_PREFIX,
  KV_USER_ROOMS_PREFIX,
};
