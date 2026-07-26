/**
 * @degenfeed/api-worker — Unified Room Constants & Helpers
 *
 * KV key helpers, base64 utilities, transport helpers.
 */

import type { RoomTransport, RoomTransportState } from './unified-room-types';

// ─── KV Prefixes ────────────────────────────────────────

export const KV_ROOM_PREFIX = 'uroom:';
export const KV_ROOM_MESSAGES_PREFIX = 'uroom:msgs:';
export const KV_ROOM_INVITES_PREFIX = 'uroom:invite:';
export const KV_USER_ROOMS_PREFIX = 'uroom:user:';
export const KV_MENTION_INDEX_PREFIX = 'uroom:mention:';

// ─── Limits ─────────────────────────────────────────────

export const MAX_ROOM_SIZE = 250;
export const MAX_MESSAGE_HISTORY = 1000;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Transport Constants ───────────────────────────────

export const ALL_TRANSPORTS: RoomTransport[] = [
  'nostr',
  'matrix',
  'farcaster',
  'bluesky',
  'telegram',
  'web',
];

// ─── Base64 Helpers ────────────────────────────────────

export function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const raw = atob(str + padding);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

// ─── KV Key Helpers ────────────────────────────────────

export function roomKey(id: string): string {
  return `${KV_ROOM_PREFIX}${id}`;
}

export function messagesKey(roomId: string): string {
  return `${KV_ROOM_MESSAGES_PREFIX}${roomId}`;
}

export function userRoomsKey(userId: string): string {
  return `${KV_USER_ROOMS_PREFIX}${userId.toLowerCase()}`;
}

export function inviteKey(roomId: string, inviteId: string): string {
  return `${KV_ROOM_INVITES_PREFIX}${roomId}:${inviteId}`;
}

export function mentionIndexKey(normalized: string): string {
  return `${KV_MENTION_INDEX_PREFIX}${normalized}`;
}

// ─── Normalization ──────────────────────────────────────

export function normalizeMention(text: string): string {
  return text.replace(/^@/, '').toLowerCase().trim();
}

// ─── Transport State ────────────────────────────────────

export function computeTransportState(members: { transport: RoomTransport }[]): RoomTransportState {
  const state: RoomTransportState = {
    nostr: false,
    matrix: false,
    farcaster: false,
    bluesky: false,
    telegram: false,
  };
  for (const m of members) {
    if (m.transport === 'nostr') state.nostr = true;
    else if (m.transport === 'matrix') state.matrix = true;
    else if (m.transport === 'farcaster') state.farcaster = true;
    else if (m.transport === 'bluesky') state.bluesky = true;
    else if (m.transport === 'telegram') state.telegram = true;
  }
  return state;
}
