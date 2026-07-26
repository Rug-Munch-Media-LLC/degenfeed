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
  farcaster: 320,
  mastodon: 500,
  bluesky: 300,
  threads: 500,
  nostr: 10000,
  lens: 10000,
  lemmy: 10000,
  reddit: 40000,
  peertube: 5000,
  pixelfed: 5000,
};

// ─── Protocol Labels ──────────────────────────────────────────────────────

export const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  threads: 'Threads',
  mastodon: 'Mastodon',
  lemmy: 'Lemmy',
  peertube: 'PeerTube',
  pixelfed: 'Pixelfed',
  matrix: 'Matrix',
  discord: 'Discord',
  telegram: 'Telegram',
  xmtp: 'XMTP',
  reddit: 'Reddit',
  rss: 'RSS',
  youtube: 'YouTube',
  github: 'GitHub',
};

// ─── Protocol Capabilities ───────────────────────────────────────────────

import type { NetworkCapability } from './types';

export const PROTOCOL_CAPABILITIES: Record<string, NetworkCapability[]> = {
  nostr: ['post', 'dm', 'reply', 'like', 'repost', 'follow', 'tip'],
  farcaster: ['post', 'reply', 'like', 'repost'],
  mastodon: ['post', 'dm', 'reply', 'comment', 'like', 'repost', 'follow', 'upload-media'],
  bluesky: ['post', 'dm', 'reply', 'like', 'repost', 'follow', 'upload-media'],
  lens: ['post', 'reply', 'like', 'comment', 'follow'],
  matrix: ['dm'],
  telegram: ['dm'],
  discord: ['dm'],
  lemmy: ['post', 'comment', 'reply', 'like', 'follow'],
  peertube: ['post', 'comment', 'reply', 'like', 'upload-media', 'live-stream'],
  pixelfed: ['post', 'comment', 'like', 'follow', 'upload-media'],
  threads: ['post', 'reply', 'like'],
  reddit: ['post', 'comment', 'like'],
  xmtp: ['dm'],
};

// ─── Supported Protocol Sets ─────────────────────────────────────────────

export const DM_PROTOCOLS = new Set<Protocol>([
  'nostr', 'matrix', 'bluesky', 'mastodon', 'discord',
  'telegram', 'farcaster', 'lens', 'xmtp',
]);

export const COMMENT_PROTOCOLS = new Set<Protocol>([
  'peertube', 'lemmy', 'pixelfed', 'mastodon', 'nostr',
  'farcaster', 'bluesky',
]);
