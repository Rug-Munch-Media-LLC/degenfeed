/**
 * @degenfeed/api-worker — Matrix Chat Library
 *
 * THE UNIVERSAL CHAT FABRIC.
 * Every DM, group chat, and cross-protocol conversation lives in a Matrix room.
 * Conduit on port 8448 is the homeserver. All bridges connect through Conduit.
 *
 * No custom KV-backed rooms. No protocol-specific storage.
 * Matrix is the single source of truth.
 *
 * Architecture:
 *   User sends message → POST to Matrix room → Conduit bridges to ALL protocols
 *   Protocol messages → AppService bridge → Matrix room → sync to user's client
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API changes.
 */

import type { Env } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const CONDUIT_URL = process.env.CONDUIT_URL || 'http://localhost:8448';
const MATRIX_DOMAIN = process.env.MATRIX_DOMAIN || 'matrix.degenfeed.xyz';

const KV_PREFIX = 'matrix:chat:';
const DM_INDEX_PREFIX = `${KV_PREFIX}dm:index:`;
const GROUP_INDEX_PREFIX = `${KV_PREFIX}group:index:`;
const PREF_PREFIX = `${KV_PREFIX}pref:`;
const ACCOUNT_PREFIX = `${KV_PREFIX}account:`;
const ROOM_META_PREFIX = `${KV_PREFIX}room:meta:`;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ChatProtocol =
  | 'nostr'
  | 'farcaster'
  | 'bluesky'
  | 'mastodon'
  | 'activitypub'
  | 'telegram'
  | 'discord'
  | 'irc'
  | 'xmpp'
  | 'signal'
  | 'whatsapp'
  | 'lens'
  | 'matrix';

export type ProtocolPreferences = {};
