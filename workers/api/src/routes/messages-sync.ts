/**
 * /api/messages/sync — Cross-Device Message Sync
 *
 * POST /api/messages/sync — Fetch missed messages since last sync
 * POST /api/messages/sync/read — Update last read position
 * GET /api/messages/sync/status — Get sync status for current user
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';

// ─── KV Prefixes ──────────────────────────────────────────────────────────

const SYNC_STATE_PREFIX = 'chat:sync:';
const LAST_READ_PREFIX = 'chat:lastread:';
const DEVICE_REGISTRY_PREFIX = 'chat:devices:';
const MESSAGE_INDEX_PREFIX = 'chat:msg:index:';

// ─── Types ────────────────────────────────────────────────────────────────

interface SyncRequest {
  /** Timestamp of last sync (ms) */
  since: number;
  /** Device identifier */
  deviceId: string;
  /** Per-conversation last read positions */
  lastRead: Record<string, number>;
}

interface SyncResponse {
  messages: Array<{
    id: string;
    fromId: string;
    content: string;
    createdAt: number;
    conversationId: string;
    protocol: string;
  }>;
  total: number;
  serverTime: number;
}

// ─── POST /api/messages/sync ────────────────────────────────────────────

/**
 * Fetch messages that arrived since the given timestamp.
 * Handles device registration and dedup hints.
 */
export async function handleSync(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  let body: SyncRequest;
  try {
    body = (await request.json()) as SyncRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.since) {
    return jsonResponse({ error: 'Missing since timestamp' }, 400);
  }

  try {
    // Register/update device
    await registerDevice(env, userId, body.deviceId);

    // Fetch messages since last sync
    const messages = await fetchMessagesSince(env, userId, body.since);

    // Update last read positions
    if (body.lastRead && Object.keys(body.lastRead).length > 0) {
      await updateLastReadPositions(env, userId, body.lastRead, body.deviceId);
    }

    // Resolve conflicts: detect messages from multiple devices
    const resolved = resolveDuplicates(messages);

    // Update sync state
    const syncKey = `${SYNC_STATE_PREFIX}${userId}`;
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      await kv.put(
        syncKey,
        JSON.stringify({
          lastSyncAt: Date.now(),
          lastDeviceId: body.deviceId,
        }),
        { expirationTtl: 86400 * 90 },
      );
    }

    return noCacheJsonResponse({
      messages: resolved,
      total: resolved.length,
      serverTime: Date.now(),
    } satisfies SyncResponse);
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Sync failed',
      },
      500,
    );
  }
}

// ─── POST /api/messages/sync/read — Update last read ───────────────────

export async function handleUpdateReadPosition(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  let body: { conversationId: string; timestamp: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.conversationId || !body.timestamp) {
    return jsonResponse({ error: 'Missing conversationId or timestamp' }, 400);
  }

  try {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      const readKey = `${LAST_READ_PREFIX}${userId}:${body.conversationId}`;
      const existing = await kv.get(readKey);
      const existingTs = existing ? JSON.parse(existing).timestamp : 0;

      // Only update forward
      if (body.timestamp > existingTs) {
        await kv.put(
          readKey,
          JSON.stringify({
            timestamp: body.timestamp,
            updatedAt: Date.now(),
            deviceId: body.deviceId || 'unknown',
          }),
          { expirationTtl: 86400 * 90 },
        );
      }
    }

    return noCacheJsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'Failed to update read position' }, 500);
  }
}

// ─── GET /api/messages/sync/status ─────────────────────────────────────

export async function handleSyncStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  try {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (!kv) return noCacheJsonResponse({ synced: false });

    // Get sync state
    const syncKey = `${SYNC_STATE_PREFIX}${userId}`;
    const syncRaw = await kv.get(syncKey);
    const syncState = syncRaw ? JSON.parse(syncRaw) : null;

    // Get registered devices
    const devicesKey = `${DEVICE_REGISTRY_PREFIX}${userId}`;
    const devicesRaw = await kv.get(devicesKey);
    const devices: string[] = devicesRaw ? JSON.parse(devicesRaw) : [];

    // Get unread synced messages count
    const lastSyncAt = syncState?.lastSyncAt ?? 0;
    const pendingCount = await countMessagesSince(env, userId, lastSyncAt);

    return noCacheJsonResponse({
      synced: !!syncState,
      lastSyncAt,
      devices,
      deviceCount: devices.length,
      pendingMessages: pendingCount,
    });
  } catch {
    return jsonResponse({ error: 'Failed to get sync status' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Register a device for a user.
 */
async function registerDevice(env: Env, userId: string, deviceId: string): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  const devicesKey = `${DEVICE_REGISTRY_PREFIX}${userId}`;
  const raw = await kv.get(devicesKey).catch(() => null);
  const devices: string[] = raw ? JSON.parse(raw) : [];

  if (!devices.includes(deviceId)) {
    devices.push(deviceId);
    await kv
      .put(devicesKey, JSON.stringify(devices.slice(-20)), {
        expirationTtl: 86400 * 90,
      })
      .catch(() => {});
  }
}

/**
 * Fetch messages from conversation indexes since a given timestamp.
 */
async function fetchMessagesSince(
  env: Env,
  userId: string,
  since: number,
): Promise<
  Array<{
    id: string;
    fromId: string;
    content: string;
    createdAt: number;
    conversationId: string;
    protocol: string;
  }>
> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return [];

  try {
    // Get user's conversation list
    const convListKey = `messages:inbox:${userId}`;
    const convListRaw = await kv.get(convListKey).catch(() => null);
    if (!convListRaw) return [];

    const conversations: Array<{ conversationId: string }> = JSON.parse(convListRaw);
    const allMessages: Array<{
      id: string;
      fromId: string;
      content: string;
      createdAt: number;
      conversationId: string;
      protocol: string;
    }> = [];

    for (const conv of conversations.slice(0, 50)) {
      // Get message index for this conversation
      const msgIndexKey = `${MESSAGE_INDEX_PREFIX}${conv.conversationId}`;
      const msgIndexRaw = await kv.get(msgIndexKey).catch(() => null);
      if (!msgIndexRaw) continue;

      const msgIds: string[] = JSON.parse(msgIndexRaw);

      // Get each message, filter by timestamp
      for (const msgId of msgIds) {
        const msgKey = `messages:${conv.conversationId}:${msgId}`;
        const msgRaw = await kv.get(msgKey).catch(() => null);
        if (!msgRaw) continue;

        const msg = JSON.parse(msgRaw);
        if (msg.createdAt > since) {
          allMessages.push({
            id: msgId,
            fromId: msg.fromId,
            content: msg.content || '[Encrypted message]',
            createdAt: msg.createdAt,
            conversationId: conv.conversationId,
            protocol: msg.protocol || 'nostr',
          });
        }
      }
    }

    // Sort by createdAt ascending
    allMessages.sort((a, b) => a.createdAt - b.createdAt);

    return allMessages;
  } catch {
    return [];
  }
}

/**
 * Count messages received since a timestamp.
 */
async function countMessagesSince(env: Env, userId: string, since: number): Promise<number> {
  // For efficiency, we use a simplified count
  const messages = await fetchMessagesSince(env, userId, since);
  return messages.length;
}

/**
 * Remove duplicate messages by content+fromId within a 5-second window.
 */
function resolveDuplicates(
  messages: Array<{ id: string; fromId: string; content: string; createdAt: number }>,
): Array<{
  id: string;
  fromId: string;
  content: string;
  createdAt: number;
  conversationId: string;
  protocol: string;
}> {
  const seen = new Map<string, { id: string; createdAt: number }>();
  const resolved: Array<(typeof messages)[0] & { conversationId: string; protocol: string }> = [];

  for (const msg of messages) {
    const key = `${msg.fromId}:${msg.content}`;
    const existing = seen.get(key);

    if (existing) {
      const timeDiff = Math.abs(msg.createdAt - existing.createdAt);
      if (timeDiff < 5000) {
        // Same content within 5s — keep the one with lexicographically smaller ID
        if (msg.id < existing.id) {
          seen.set(key, { id: msg.id, createdAt: msg.createdAt });
        }
        continue;
      }
    } else {
      seen.set(key, { id: msg.id, createdAt: msg.createdAt });
    }

    resolved.push(msg as any);
  }

  return resolved;
}

/**
 * Update multiple last read positions at once.
 */
async function updateLastReadPositions(
  env: Env,
  userId: string,
  positions: Record<string, number>,
  deviceId: string,
): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  const promises = Object.entries(positions).map(async ([convId, timestamp]) => {
    const readKey = `${LAST_READ_PREFIX}${userId}:${convId}`;
    try {
      const existing = await kv.get(readKey);
      const existingTs = existing ? JSON.parse(existing).timestamp : 0;
      if (timestamp > existingTs) {
        await kv.put(
          readKey,
          JSON.stringify({
            timestamp,
            updatedAt: Date.now(),
            deviceId,
          }),
          { expirationTtl: 86400 * 90 },
        );
      }
    } catch {
      // Skip failing entries
    }
  });

  await Promise.allSettled(promises);
}
