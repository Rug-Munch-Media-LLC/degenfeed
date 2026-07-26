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

import type { Env } from '../types';
import { seal, unseal } from './crypto-seal';

// ─── Types ──────────────────────────────────────────────────────────────────

export type RoomTransport = 'nostr' | 'matrix' | 'farcaster' | 'bluesky' | 'telegram' | 'web';

export type RoomMember = {};
