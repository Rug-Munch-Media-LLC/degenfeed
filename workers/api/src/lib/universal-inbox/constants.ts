/**
 * @degenfeed/api-worker — Universal Inbox Constants
 *
 * KV key helpers, protocol config, and constants.
 */

import type { Protocol } from '@degenfeed/types';

// ─── KV Key Helpers ──────────────────────────────────────────────────────

export const INBOX_KV_PREFIX = 'inbox:';
export const INBOX_UNIFIED_KEY = (userId: string) => `${INBOX_KV_PREFIX}unified:${userId}`;
export const INBOX_DMS_KEY = (userId: string) => `${INBOX_KV_PREFIX}dms:${userId}`;
export const INBOX_COMMENTS_KEY = (userId: string) => `${INBOX_KV_PREFIX}comments:${userId}`;
export const _INBOX_ACTIVITY_KEY = (userId: string) => `${INBOX_KV_PREFIX}activity:${userId}`;
export const INBOX_STATUS_KEY = (userId: string) => `${INBOX_KV_PREFIX}status:${userId}`;
export const _INBOX_SEEN_KEY = (userId: string) => `${INBOX_KV_PREFIX}seen:${userId}`;

// ─── Constraints ──────────────────────────────────────────────────────────

export const MAX_INBOX_ITEMS = 500;
export const MAX_INBOX_AGE_MS = 86400_000 * 90; // 90 days
export const DEFAULT_PAGE_SIZE = 50;

// ─── Protocol Character Limits ────────────────────────────────────────────

export const PROTOCOL_MAX_LENGTH: Record<string, number> = {

// ─── Protocol Labels ──────────────────────────────────────────────────────

export const PROTOCOL_LABELS: Record<string, string> = {

// ─── Protocol Capabilities ───────────────────────────────────────────────

import type { NetworkCapability } from './types';

export const PROTOCOL_CAPABILITIES: Record<string, NetworkCapability[]> = {

// ─── Supported Protocol Sets ─────────────────────────────────────────────

export const DM_PROTOCOLS = new Set<Protocol>([
  'nostr', 'matrix', 'bluesky', 'mastodon', 'discord',
  'telegram', 'farcaster', 'lens', 'xmtp',
]);

export const COMMENT_PROTOCOLS = new Set<Protocol>([
  'peertube', 'lemmy', 'pixelfed', 'mastodon', 'nostr',
  'farcaster', 'bluesky',
]);

