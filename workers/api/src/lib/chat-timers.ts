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

import type { Env } from '../types';
import { log } from '../logger';

// ─── KV Prefixes ──────────────────────────────────────────────────────────

export const TIMER_PREFIX = 'chat:timer:';
export const MESSAGE_META_PREFIX = 'chat:msg:meta:';
export const DELETED_PREFIX = 'chat:deleted:';
export const VIEW_ONCE_PREFIX = 'chat:viewonce:';
export const UNSEND_PREFIX = 'chat:unsend:';

// ─── Types ────────────────────────────────────────────────────────────────

export type DeleteScope = 'everyone' | 'me';

export interface MessageMetadata {
  /** Original message ID */
  id: string;
  /** Conversation this message belongs to */
  conversationId: string;
  /** Sender wallet */
  fromId: string;
  /** Whether message has been edited */
  edited: boolean;
  /** Edited at timestamp */
  editedAt: number | null;
  /** Original content (preserved for history) */
  originalContent: string;
  /** Current content (after edits) */
  currentContent: string;
  /** Edit history */
  editHistory: Array<{
    content: string;
    editedAt: number;
  }>;
  /** Expiration timestamp for auto-delete */
  expiresAt: number | null;
  /** Whether this is a disappearing message */
  disappearing: boolean;
  /** Whether message has been read (for disappearing) */
  readAt: number | null;
  /** Whether this is a "view once" message */
  viewOnce: boolean;
  /** Has the view once message been viewed */
  viewOnceViewed: boolean;
  /** Deletion status */
  deleted: boolean;
  /** Deletion scope */
  deletedScope: DeleteScope | null;
  /** Deleted at timestamp */
  deletedAt: number | null;
  /** Created at timestamp */
  createdAt: number;
}

export interface ConversationTimer {
  /** Conversation ID */
  conversationId: string;
  /** Auto-delete duration in seconds: 60, 300, 3600, 86400, 604800, 2592000 */
  durationSeconds: number;
  /** When the timer was set */
  setAt: number;
  /** Set by which user */
  setBy: string;
  /** Human-readable label */
  label: string;
}

// ─── Timer Constants ──────────────────────────────────────────────────────

export const TIMER_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '5 sec (unsend)', value: 5 },
  { label: '1 min', value: 60 },
  { label: '5 min', value: 300 },
  { label: '1 hr', value: 3600 },
  { label: '24 hr', value: 86400 },
  { label: '7 days', value: 604800 },
  { label: '30 days', value: 2592000 },
] as const;

export const DELETE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours for delete-for-everyone
export const UNSEND_WINDOW_MS = 5000; // 5 seconds for unsend

// ─── Timer Management ─────────────────────────────────────────────────────

/**
 * Set or update the auto-delete timer for a conversation.
 */
export async function setConversationTimer(
  env: Env,
  conversationId: string,
  durationSeconds: number,
  setBy: string,
): Promise<ConversationTimer> {
  const option = TIMER_OPTIONS.find((o) => o.value === durationSeconds);
  const timer: ConversationTimer = {
    conversationId,
    durationSeconds,
    setAt: Date.now(),
    setBy: setBy.toLowerCase(),
    label: option?.label ?? `${durationSeconds}s`,
  };

  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    await kv.put(`${TIMER_PREFIX}${conversationId}`, JSON.stringify(timer)).catch(() => {});
  }

  return timer;
}

/**
 * Get the auto-delete timer for a conversation.
 */
export async function getConversationTimer(
  env: Env,
  conversationId: string,
): Promise<ConversationTimer | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;
  try {
    const raw = await kv.get(`${TIMER_PREFIX}${conversationId}`);
    return raw ? (JSON.parse(raw) as ConversationTimer) : null;
  } catch {
    return null;
  }
}

/**
 * Remove auto-delete timer from a conversation.
 */
export async function removeConversationTimer(env: Env, conversationId: string): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    await kv.delete(`${TIMER_PREFIX}${conversationId}`).catch(() => {});
  }
}

// ─── Message Metadata ─────────────────────────────────────────────────────

/**
 * Create metadata for a new message.
 */
export function createMessageMetadata(
  messageId: string,
  conversationId: string,
  fromId: string,
  content: string,
  options?: {
    expiresAt?: number | null;
    disappearing?: boolean;
    viewOnce?: boolean;
  },
): MessageMetadata {
  return {
    id: messageId,
    conversationId,
    fromId: fromId.toLowerCase(),
    edited: false,
    editedAt: null,
    originalContent: content,
    currentContent: content,
    editHistory: [],
    expiresAt: options?.expiresAt ?? null,
    disappearing: options?.disappearing ?? false,
    readAt: null,
    viewOnce: options?.viewOnce ?? false,
    viewOnceViewed: false,
    deleted: false,
    deletedScope: null,
    deletedAt: null,
    createdAt: Date.now(),
  };
}

/**
 * Store message metadata in KV.
 */
export async function storeMessageMetadata(env: Env, metadata: MessageMetadata): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  const ttl = metadata.expiresAt
    ? Math.ceil((metadata.expiresAt - Date.now()) / 1000) + 3600 // 1hr grace
    : 86400 * 90; // 90 days default

  await kv
    .put(`${MESSAGE_META_PREFIX}${metadata.id}`, JSON.stringify(metadata), {
      expirationTtl: Math.max(3600, ttl),
    })
    .catch((err: unknown) => log('warn', `[chat-timers] store meta failed: ${metadata.id}`, err));
}

/**
 * Get message metadata.
 */
export async function getMessageMetadata(
  env: Env,
  messageId: string,
): Promise<MessageMetadata | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;
  try {
    const raw = await kv.get(`${MESSAGE_META_PREFIX}${messageId}`);
    return raw ? (JSON.parse(raw) as MessageMetadata) : null;
  } catch {
    return null;
  }
}

// ─── Delete for Everyone ──────────────────────────────────────────────────

/**
 * Delete a message for everyone.
 * Only allowed within 24 hours of sending.
 */
export async function deleteForEveryone(
  env: Env,
  messageId: string,
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const meta = await getMessageMetadata(env, messageId);
  if (!meta) return false;

  // Verify ownership
  if (meta.fromId.toLowerCase() !== userId.toLowerCase()) {
    return false;
  }

  // Check 24-hour window
  const age = Date.now() - meta.createdAt;
  if (age > DELETE_WINDOW_MS) {
    throw new Error('Delete window expired (24 hours)');
  }

  // Mark as deleted
  meta.deleted = true;
  meta.deletedScope = 'everyone';
  meta.deletedAt = Date.now();

  await storeMessageMetadata(env, meta);

  // Record deletion in deleted index for recipient sync
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    const deletionKey = `${DELETED_PREFIX}${conversationId}:${messageId}`;
    await kv
      .put(
        deletionKey,
        JSON.stringify({
          messageId,
          deletedAt: meta.deletedAt,
          scope: 'everyone',
        }),
        { expirationTtl: 86400 * 7 },
      )
      .catch(() => {});
  }

  return true;
}

/**
 * Delete a message for me only.
 * No time limit — user can always hide from their view.
 */
export async function deleteForMe(
  env: Env,
  messageId: string,
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const meta = await getMessageMetadata(env, messageId);
  if (!meta) {
    // If no metadata yet, create a deletion record directly
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      const key = `${DELETED_PREFIX}${conversationId}:${userId}:${messageId}`;
      await kv
        .put(key, JSON.stringify({ messageId, deletedAt: Date.now(), scope: 'me', userId }), {
          expirationTtl: 86400 * 90,
        })
        .catch(() => {});
    }
    return true;
  }

  // Mark as deleted-for-me in a per-user record
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    const key = `${DELETED_PREFIX}${conversationId}:${userId}:${messageId}`;
    await kv
      .put(
        key,
        JSON.stringify({
          messageId,
          deletedAt: Date.now(),
          scope: 'me',
          userId: userId.toLowerCase(),
        }),
        { expirationTtl: 86400 * 90 },
      )
      .catch(() => {});
  }

  return true;
}

/**
 * Check if a message has been deleted for a specific user.
 */
export async function isMessageDeletedForUser(
  env: Env,
  messageId: string,
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return false;

  // Check delete-for-everyone
  const everyoneKey = `${DELETED_PREFIX}${conversationId}:${messageId}`;
  try {
    const everyone = await kv.get(everyoneKey);
    if (everyone) return true;
  } catch {
    // Ignore
  }

  // Check delete-for-me
  const meKey = `${DELETED_PREFIX}${conversationId}:${userId}:${messageId}`;
  try {
    const me = await kv.get(meKey);
    if (me) return true;
  } catch {
    // Ignore
  }

  return false;
}

/**
 * Get all deleted message IDs in a conversation for a user.
 */
export async function getDeletedMessageIds(
  env: Env,
  conversationId: string,
  userId: string,
): Promise<Set<string>> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return new Set();

  const deleted = new Set<string>();

  // Get delete-for-everyone keys
  try {
    const everyoneList = await kv.list({ prefix: `${DELETED_PREFIX}${conversationId}:` });
    for (const key of everyoneList.keys) {
      const raw = await kv.get(key.name);
      if (raw) {
        const record = JSON.parse(raw) as { messageId: string; scope?: string; userId?: string };
        if (record.scope === 'everyone' || record.userId === userId) {
          deleted.add(record.messageId);
        }
      }
    }
  } catch {
    // Ignore
  }

  return deleted;
}

// ─── Edit Message ─────────────────────────────────────────────────────────

/**
 * Edit a message (update content, mark as edited).
 * Only allowed within 24 hours.
 */
export async function editMessage(
  env: Env,
  messageId: string,
  userId: string,
  newContent: string,
): Promise<MessageMetadata | null> {
  const meta = await getMessageMetadata(env, messageId);
  if (!meta) return null;

  // Verify ownership
  if (meta.fromId.toLowerCase() !== userId.toLowerCase()) {
    return null;
  }

  // Check edit window (24 hours for edits too)
  const age = Date.now() - meta.createdAt;
  if (age > DELETE_WINDOW_MS) {
    throw new Error('Edit window expired (24 hours)');
  }

  // Don't save duplicates
  if (meta.currentContent === newContent) return meta;

  // Save edit history
  meta.editHistory.push({
    content: meta.currentContent,
    editedAt: Date.now(),
  });

  // Keep only last 10 edits
  if (meta.editHistory.length > 10) {
    meta.editHistory = meta.editHistory.slice(-10);
  }

  meta.currentContent = newContent;
  meta.edited = true;
  meta.editedAt = Date.now();

  await storeMessageMetadata(env, meta);

  return meta;
}

// ─── Unsend ───────────────────────────────────────────────────────────────

/**
 * Unsend a message within 5 seconds of sending.
 * This is a full recall — message is deleted for everyone as if never sent.
 */
export async function unsendMessage(
  env: Env,
  messageId: string,
  userId: string,
  conversationId: string,
  createdAt: number,
): Promise<boolean> {
  const age = Date.now() - createdAt;
  if (age > UNSEND_WINDOW_MS) {
    throw new Error('Unsend window expired (5 seconds)');
  }

  // Verify ownership
  const meta = await getMessageMetadata(env, messageId);
  if (meta && meta.fromId.toLowerCase() !== userId.toLowerCase()) {
    return false;
  }

  // Hard delete: mark as unsent
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    const unsendKey = `${UNSEND_PREFIX}${conversationId}:${messageId}`;
    await kv
      .put(
        unsendKey,
        JSON.stringify({
          messageId,
          unsentAt: Date.now(),
          unsentBy: userId.toLowerCase(),
        }),
        { expirationTtl: 86400 },
      )
      .catch(() => {});

    // Also delete from the main conversation store if accessible
    // (requires access to messages.ts internals — handled by caller)
  }

  return true;
}

/**
 * Check if a message has been unsent.
 */
export async function isMessageUnsent(
  env: Env,
  messageId: string,
  conversationId: string,
): Promise<boolean> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return false;
  try {
    const unsent = await kv.get(`${UNSEND_PREFIX}${conversationId}:${messageId}`);
    return unsent !== null;
  } catch {
    return false;
  }
}

// ─── View Once ────────────────────────────────────────────────────────────

/**
 * Mark a message as "view once" - only viewable one time.
 */
export async function markViewOnce(
  env: Env,
  messageId: string,
  _conversationId: string,
): Promise<boolean> {
  const meta = await getMessageMetadata(env, messageId);
  if (!meta) return false;

  meta.viewOnce = true;
  await storeMessageMetadata(env, meta);

  return true;
}

/**
 * View a "view once" message.
 * Returns the content if not yet viewed, otherwise null.
 */
export async function viewOnceMessage(
  env: Env,
  messageId: string,
  _conversationId: string,
  userId: string,
): Promise<{ content: string; mediaUrl?: string } | null> {
  const meta = await getMessageMetadata(env, messageId);
  if (!meta?.viewOnce) return null;

  // Only the intended recipient (not the sender) can view
  if (meta.fromId.toLowerCase() === userId.toLowerCase()) {
    // Sender can see it was viewed, but not the content
    return { content: '[View once message - sent]' };
  }

  // If already viewed, destroy
  if (meta.viewOnceViewed) {
    // Delete the content permanently
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      await kv.delete(`${MESSAGE_META_PREFIX}${messageId}`).catch(() => {});
    }
    return null;
  }

  // Mark as viewed
  meta.viewOnceViewed = true;
  meta.readAt = Date.now();
  await storeMessageMetadata(env, meta);

  return { content: meta.currentContent };
}

// ─── Disappearing Messages ────────────────────────────────────────────────

/**
 * Mark a message as disappearing (self-destructs after being read).
 */
export function markDisappearing(meta: MessageMetadata, readAt?: number): MessageMetadata {
  return {
    ...meta,
    disappearing: true,
    readAt: readAt ?? Date.now(),
    expiresAt: Date.now() + 30000, // 30 seconds after read
  };
}

/**
 * Check and handle disappearing messages that have been read.
 * Deletes the message content after the configured delay.
 */
export async function handleDisappearingMessage(
  env: Env,
  messageId: string,
  _conversationId: string,
  readAt: number,
  timerSeconds: number,
): Promise<void> {
  const meta = await getMessageMetadata(env, messageId);
  if (!meta?.disappearing) return;

  // Disappearing timer after read: use conversation timer or default 30s
  const disappearDelay = timerSeconds > 0 ? timerSeconds * 1000 : 30000;
  meta.expiresAt = readAt + disappearDelay;
  await storeMessageMetadata(env, meta);
}

// ─── Cron: Cleanup Expired Messages ─────────────────────────────────────

/**
 * Run cleanup of expired messages.
 * Called by the cron job every minute.
 * Scans for messages with expiresAt < now and removes them.
 */
export async function cleanupExpiredMessages(env: Env): Promise<number> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return 0;

  let cleaned = 0;
  const now = Date.now();

  try {
    // List all message metadata
    const list = await kv.list({ prefix: MESSAGE_META_PREFIX, limit: 1000 });
    const deleteBatch: string[] = [];

    for (const key of list.keys) {
      try {
        const raw = await kv.get(key.name);
        if (!raw) continue;

        const meta = JSON.parse(raw) as MessageMetadata;

        // Skip non-expiring messages
        if (!meta.expiresAt || meta.expiresAt === 0) continue;

        // If expired, mark for deletion
        if (now >= meta.expiresAt) {
          deleteBatch.push(key.name);

          // Also remove from deleted index
          const delKey = `${DELETED_PREFIX}${meta.conversationId}:${meta.id}`;
          await kv.delete(delKey).catch(() => {});

          cleaned++;
        }
      } catch {}
    }

    // Batch delete
    for (const key of deleteBatch) {
      await kv.delete(key).catch(() => {});
    }
  } catch (err) {
    log('error', '[chat-timers] cleanup expired failed', err);
  }

  if (cleaned > 0) {
    log('info', `[chat-timers] cleaned ${cleaned} expired messages`);
  }

  return cleaned;
}

// ─── Utility ──────────────────────────────────────────────────────────────

/**
 * Get the auto-delete timer display label for a conversation.
 * Returns string like "Messages auto-delete in 24h" or null if off.
 */
export async function getTimerDisplayLabel(
  env: Env,
  conversationId: string,
): Promise<string | null> {
  const timer = await getConversationTimer(env, conversationId);
  if (!timer || timer.durationSeconds === 0) return null;

  const label = timer.label;
  return `Messages auto-delete in ${label}`;
}

/**
 * Format timer duration for display.
 */
export function formatTimerDuration(seconds: number): string {
  if (seconds >= 2592000) return `${Math.round(seconds / 2592000)}mo`;
  if (seconds >= 604800) return `${Math.round(seconds / 604800)}w`;
  if (seconds >= 86400) return `${Math.round(seconds / 86400)}d`;
  if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}
