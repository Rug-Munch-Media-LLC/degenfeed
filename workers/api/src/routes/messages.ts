/**
 * /api/messages — Cross-protocol Direct Messages.
 *
 * Unified DM layer across Nostr (NIP-04), Matrix, Bluesky (AT Protocol chat),
 * Mastodon (Direct visibility), Discord, and Telegram.
 *
 * Uses the MessageBridge to route messages to all protocols the recipient
 * is linked to, enabling cross-protocol DMs (e.g. Nostr → Matrix).
 *
 * GET  /api/messages/conversations   — List conversations with last message preview
 * GET  /api/messages/{id}            — Get messages in a conversation
 * POST /api/messages/send            — Send a DM (cross-protocol route)
 * POST /api/messages/read            — Mark messages as read
 * GET  /api/messages/inbox           — Get received messages grouped by sender
 * GET  /api/messages/thread/:peerId  — Get conversation with specific peer
 * DELETE /api/messages/{id}          — Delete a message (per-protocol)
 * GET  /api/messages/unread          — Get total unread count
 */

import type { Protocol } from '@degenfeed/types';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';
import { broadcastToUser } from '../ws-broadcast';

const DM_KEY_PREFIX = 'dm:';
const DM_LIST_PREFIX = 'dm:list:';
const DM_INBOX_PREFIX = 'dm:inbox:';
const _DM_THREAD_PREFIX = 'dm:thread:';
const _DM_READ_PREFIX = 'dm:read:';

export type DmProtocol =
  | 'nostr'
  | 'matrix'
  | 'bluesky'
  | 'mastodon'
  | 'discord'
  | 'telegram'
  | 'farcaster'
  | 'lens';

type DirectMessage = {};
