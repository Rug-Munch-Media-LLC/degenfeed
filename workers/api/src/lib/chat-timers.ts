/**
 * @degenfeed/api-worker — Message Deletion, Auto-Delete Timer, Disappearing Messages
 *
 * Telegram/WhatsApp-style message lifecycle management:
 *   - Delete for everyone (24hr window)
 *   - Delete for me (remove from own view)
 *   - Auto-delete timer per conversation
 *   - Disappearing messages (self-destruct after read)
 *   - Edit message (with "edited" indicator)
 *   - Unsend (undo send within 5 seconds)
 *   - View once (photo/video that can only be viewed once)
 *
 * All timers stored in KV with cron-driven expiration.
 */

import { log } from '../logger';
import type { Env } from '../types';

// ─── KV Prefixes ──────────────────────────────────────────────────────────

export const TIMER_PREFIX = 'chat:timer:';
export const MESSAGE_META_PREFIX = 'chat:msg:meta:';
export const DELETED_PREFIX = 'chat:deleted:';
export const VIEW_ONCE_PREFIX = 'chat:viewonce:';
export const UNSEND_PREFIX = 'chat:unsend:';

// ─── Types ────────────────────────────────────────────────────────────────

export type DeleteScope = 'everyone' | 'me';

export type MessageMetadata = {};
