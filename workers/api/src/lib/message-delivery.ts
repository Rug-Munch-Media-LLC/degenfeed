/**
 * @degenfeed/api-worker — Message Delivery & Reliability
 *
 * Ensures every message is reliably delivered with:
 *   - Delivery confirmation: per-message, per-protocol delivery status
 *   - Offline queue: messages sent when recipient is offline → delivered when online
 *   - Multi-device sync: messages delivered to all of a user's devices
 *   - Conflict resolution: same message from multiple devices → dedup
 *
 * Architecture:
 *   - Delivery receipts tracked via message delivery records in KV
 *   - Offline queue stores messages in per-user KV queues
 *   - Multi-device registry tracks active devices per user
 *   - Dedup uses message content hash + sender + timestamp
 *
 * Integration with existing:
 *   - message-transport.ts (for protocol routing)
 *   - ws-broadcast.ts (for real-time delivery)
 *   - e2e-messaging.ts (encrypted payloads)
 */

import type { Env } from '../index';
import { log } from '../index';
import type { TransportMessage, TransportProtocol, TransportResult } from './message-transport';

// ─── Types ────────────────────────────────────────────────────────────────

export type DeliveryStatus =
  | 'pending' // Message queued, not yet delivered
  | 'sent' // Successfully sent to at least one protocol
  | 'delivered' // Delivered to recipient's device(s)
  | 'read' // Recipient opened/read the message
  | 'failed' // All delivery attempts failed
  | 'expired'; // Message expired before delivery

export interface DeliveryRecord {
  /** Message ID */
  messageId: string;
  /** Conversation ID */
  conversationId: string;
  /** Sender wallet */
  fromId: string;
  /** Recipient wallet */
  toId: string;
  /** Current delivery status */
  status: DeliveryStatus;
  /** Status by protocol */
  protocolStatus: Record<
    TransportProtocol,
    {
      status: DeliveryStatus;
      nativeId?: string;
      error?: string;
      attemptedAt: number;
      deliveredAt?: number;
    }
  >;
  /** Timestamps */
  createdAt: number;
  sentAt: number | null;
  deliveredAt: number | null;
  readAt: number | null;
  /** Number of delivery attempts */
  attemptCount: number;
  /** Next retry timestamp (for exponential backoff) */
  nextRetryAt: number | null;
  /** Per-device delivery: { deviceId => deliveredAt } */
  deviceDeliveries: Record<string, number>;
  /** Content hash for dedup */
  contentHash: string;
  /** Protocol-independent message for retry */
  transportMessage: TransportMessage;
}

export interface DeviceInfo {
  /** Device ID (UUID) */
  deviceId: string;
  /** User wallet */
  userId: string;
  /** Device name */
  name: string;
  /** Device type */
  type: 'web' | 'mobile' | 'desktop' | 'api';
  /** Last seen timestamp */
  lastSeenAt: number;
  /** Whether device is currently online */
  online: boolean;
  /** WebSocket connection ID (for real-time delivery) */
  wsConnectionId?: string;
  /** Push notification token */
  pushToken?: string;
  /** Eden/device-specific public key for E2E */
  devicePublicKey?: string;
  /** Registered timestamp */
  registeredAt: number;
}

// ─── KV Prefixes ──────────────────────────────────────────────────────────

const DELIVERY_PREFIX = 'delivery:';
const OFFLINE_QUEUE_PREFIX = 'offline:queue:';
const DEVICE_REGISTRY_PREFIX = 'device:';
const MESSAGE_DEDUP_PREFIX = 'dedup:';
const MULTI_DEVICE_SYNC_PREFIX = 'mdsync:';

// ─── Delivery Tracking ────────────────────────────────────────────────────

/**
 * Create a delivery record for a new outgoing message.
 */
export async function createDeliveryRecord(
  env: Env,
  message: TransportMessage,
  conversationId: string,
): Promise<DeliveryRecord> {
  const contentHash = await computeContentHash(message.encryptedBlob);

  const record: DeliveryRecord = {
    messageId: message.id,
    conversationId,
    fromId: message.fromId,
    toId: message.toId,
    status: 'pending',
    protocolStatus: {},
    createdAt: Date.now(),
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    attemptCount: 0,
    nextRetryAt: Date.now(),
    deviceDeliveries: {},
    contentHash,
    transportMessage: message,
  };

  await saveDeliveryRecord(env, record);
  return record;
}

/**
 * Update delivery status after a protocol delivery attempt.
 */
export async function updateDeliveryStatus(
  env: Env,
  messageId: string,
  protocol: TransportProtocol,
  result: TransportResult,
  options?: {
    deliveredToDevice?: string;
  },
): Promise<DeliveryRecord | null> {
  const record = await getDeliveryRecord(env, messageId);
  if (!record) return null;

  record.attemptCount++;

  // Update per-protocol status
  record.protocolStatus[protocol] = {
    status: result.ok ? 'sent' : 'failed',
    nativeId: result.nativeId,
    error: result.error,
    attemptedAt: result.attemptedAt,
    deliveredAt: result.ok ? Date.now() : undefined,
  };

  // Update overall status
  const anySent = Object.values(record.protocolStatus).some((s) => s.status === 'sent');
  const allFailed = Object.values(record.protocolStatus).every((s) => s.status === 'failed');
  const anyDeliveredToDevice = options?.deliveredToDevice;

  if (anyDeliveredToDevice) {
    record.status = 'delivered';
    record.deliveredAt = Date.now();
    if (options.deliveredToDevice) {
      record.deviceDeliveries[options.deliveredToDevice] = Date.now();
    }
  } else if (anySent) {
    record.status = 'sent';
    record.sentAt = record.sentAt ?? Date.now();
  } else if (allFailed) {
    record.status = 'failed';
  }

  // Schedule retry with exponential backoff
  if (record.status === 'failed' || record.status === 'pending') {
    const backoffMs = Math.min(1000 * 2 ** record.attemptCount, 3600000); // max 1 hour
    record.nextRetryAt = Date.now() + backoffMs;
  }

  await saveDeliveryRecord(env, record);
  return record;
}

/**
 * Mark a message as read.
 */
export async function markMessageRead(
  env: Env,
  messageId: string,
  userId: string,
): Promise<DeliveryRecord | null> {
  const record = await getDeliveryRecord(env, messageId);
  if (!record) return null;

  record.status = 'read';
  record.readAt = Date.now();

  // Track by device
  // (device ID would come from the WS connection context)
  record.deviceDeliveries[`read:${userId}`] = Date.now();

  await saveDeliveryRecord(env, record);
  return record;
}

/**
 * Get delivery status for a specific message.
 */
export async function getDeliveryRecord(
  env: Env,
  messageId: string,
): Promise<DeliveryRecord | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;

  try {
    const raw = await kv.get(`${DELIVERY_PREFIX}${messageId}`);
    return raw ? (JSON.parse(raw) as DeliveryRecord) : null;
  } catch {
    return null;
  }
}

/**
 * Get delivery statuses for multiple messages in a conversation.
 */
export async function getConversationDeliveryStatus(
  env: Env,
  _conversationId: string,
  messageIds: string[],
): Promise<Record<string, DeliveryStatus>> {
  const statuses: Record<string, DeliveryStatus> = {};

  for (const id of messageIds) {
    const record = await getDeliveryRecord(env, id);
    statuses[id] = record?.status ?? 'pending';
  }

  return statuses;
}

async function saveDeliveryRecord(env: Env, record: DeliveryRecord): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  await kv
    .put(`${DELIVERY_PREFIX}${record.messageId}`, JSON.stringify(record), {
      expirationTtl: 86400 * 30, // 30 days
    })
    .catch(() => {});
}

// ─── Offline Queue ────────────────────────────────────────────────────────

/**
 * Queue a message for offline delivery.
 * When the recipient comes online, they fetch all queued messages.
 */
export async function queueForOffline(
  env: Env,
  userId: string,
  message: TransportMessage,
  conversationId: string,
): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  try {
    const queueKey = `${OFFLINE_QUEUE_PREFIX}${userId.toLowerCase()}`;
    const raw = await kv.get(queueKey);
    const queue: Array<{ message: TransportMessage; conversationId: string; queuedAt: number }> =
      raw ? JSON.parse(raw) : [];

    queue.push({
      message,
      conversationId,
      queuedAt: Date.now(),
    });

    // Keep max 200 messages per user (prevent DoS via queue fill)
    const trimmed = queue.slice(-200);
    await kv.put(queueKey, JSON.stringify(trimmed), {
      expirationTtl: 86400 * 7, // 7 days for offline messages
    });
  } catch (err) {
    log('error', `[delivery] offline queue failed for ${userId}`, err);
  }
}

/**
 * Get all offline messages for a user who just came online.
 * Clears the offline queue on read.
 */
export async function getOfflineMessages(
  env: Env,
  userId: string,
): Promise<Array<{ message: TransportMessage; conversationId: string }>> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return [];

  try {
    const queueKey = `${OFFLINE_QUEUE_PREFIX}${userId.toLowerCase()}`;
    const raw = await kv.get(queueKey);
    if (!raw) return [];

    // Clear queue
    await kv.delete(queueKey);

    const queue: Array<{ message: TransportMessage; conversationId: string }> = JSON.parse(raw);
    return queue;
  } catch {
    return [];
  }
}

/**
 * Retry failed deliveries from the delivery queue.
 * Called by cron every minute.
 */
export async function retryFailedDeliveries(env: Env): Promise<number> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return 0;

  let retried = 0;
  const now = Date.now();

  try {
    const list = await kv.list({ prefix: DELIVERY_PREFIX, limit: 1000 });

    for (const key of list.keys) {
      try {
        const raw = await kv.get(key.name);
        if (!raw) continue;

        const record = JSON.parse(raw) as DeliveryRecord;

        // Skip if already delivered, read, or no retry needed
        if (record.status === 'delivered' || record.status === 'read') continue;
        if (!record.nextRetryAt || now < record.nextRetryAt) continue;

        // Re-route the message
        const { MessageTransport } = await import('./message-transport');
        const transport = new MessageTransport();
        const results = await transport.route(record.transportMessage, env);

        // Update status for each result
        for (const result of results) {
          await updateDeliveryStatus(env, record.messageId, result.protocol, result);
        }

        retried++;
      } catch {}
    }
  } catch (err) {
    log('error', '[delivery] retry failed', err);
  }

  return retried;
}

// ─── Multi-Device Sync ────────────────────────────────────────────────────

/**
 * Register a device for a user.
 */
export async function registerDevice(
  env: Env,
  userId: string,
  device: Omit<DeviceInfo, 'registeredAt' | 'userId'>,
): Promise<DeviceInfo> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) throw new Error('[delivery] KV not available');

  const deviceInfo: DeviceInfo = {
    ...device,
    userId: userId.toLowerCase(),
    registeredAt: Date.now(),
  };

  await kv.put(`${DEVICE_REGISTRY_PREFIX}${device.deviceId}`, JSON.stringify(deviceInfo), {
    expirationTtl: 86400 * 365,
  });

  // Index devices by user
  const userDeviceKey = `${MULTI_DEVICE_SYNC_PREFIX}${userId.toLowerCase()}`;
  const raw = await kv.get(userDeviceKey);
  const deviceIds: string[] = raw ? JSON.parse(raw) : [];
  if (!deviceIds.includes(device.deviceId)) {
    deviceIds.push(device.deviceId);
    await kv.put(userDeviceKey, JSON.stringify(deviceIds), {
      expirationTtl: 86400 * 365,
    });
  }

  return deviceInfo;
}

/**
 * Get all devices for a user.
 */
export async function getUserDevices(env: Env, userId: string): Promise<DeviceInfo[]> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return [];

  try {
    const userDeviceKey = `${MULTI_DEVICE_SYNC_PREFIX}${userId.toLowerCase()}`;
    const raw = await kv.get(userDeviceKey);
    if (!raw) return [];

    const deviceIds: string[] = JSON.parse(raw);
    const devices: DeviceInfo[] = [];

    for (const deviceId of deviceIds) {
      const deviceRaw = await kv.get(`${DEVICE_REGISTRY_PREFIX}${deviceId}`);
      if (deviceRaw) {
        devices.push(JSON.parse(deviceRaw) as DeviceInfo);
      }
    }

    return devices;
  } catch {
    return [];
  }
}

/**
 * Remove a device.
 */
export async function removeDevice(env: Env, deviceId: string): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  try {
    const deviceRaw = await kv.get(`${DEVICE_REGISTRY_PREFIX}${deviceId}`);
    if (!deviceRaw) return;

    const device = JSON.parse(deviceRaw) as DeviceInfo;
    await kv.delete(`${DEVICE_REGISTRY_PREFIX}${deviceId}`);

    // Remove from user index
    const userDeviceKey = `${MULTI_DEVICE_SYNC_PREFIX}${device.userId}`;
    const raw = await kv.get(userDeviceKey);
    if (raw) {
      const deviceIds: string[] = JSON.parse(raw);
      const filtered = deviceIds.filter((id) => id !== deviceId);
      await kv.put(userDeviceKey, JSON.stringify(filtered), {
        expirationTtl: 86400 * 365,
      });
    }
  } catch {
    // Non-critical
  }
}

/**
 * Sync a message to all of a user's devices.
 * Returns number of devices the message was synced to.
 */
export async function syncToDevices(
  env: Env,
  userId: string,
  message: TransportMessage,
): Promise<number> {
  const devices = await getUserDevices(env, userId);
  let syncedCount = 0;

  for (const device of devices) {
    if (!device.online) {
      // Queue for offline delivery to this device
      await queueForOffline(env, device.deviceId, message, 'multi-device-sync');
      continue;
    }

    // Try real-time delivery via WebSocket
    if (device.wsConnectionId) {
      try {
        const { broadcastToConnection } = await import('../ws-broadcast');
        broadcastToConnection(device.wsConnectionId, 'sync:message', {
          ...message,
          deviceId: device.deviceId,
        });
        syncedCount++;
      } catch {
        // Fallback to offline queue
        await queueForOffline(env, device.deviceId, message, 'multi-device-sync');
      }
    } else {
      await queueForOffline(env, device.deviceId, message, 'multi-device-sync');
    }
  }

  return syncedCount;
}

/**
 * Update device online status.
 */
export async function updateDeviceStatus(
  env: Env,
  deviceId: string,
  online: boolean,
  wsConnectionId?: string,
): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  try {
    const raw = await kv.get(`${DEVICE_REGISTRY_PREFIX}${deviceId}`);
    if (!raw) return;

    const device = JSON.parse(raw) as DeviceInfo;
    device.online = online;
    device.lastSeenAt = Date.now();
    if (wsConnectionId) {
      device.wsConnectionId = wsConnectionId;
    }

    await kv.put(`${DEVICE_REGISTRY_PREFIX}${deviceId}`, JSON.stringify(device), {
      expirationTtl: 86400 * 365,
    });
  } catch {
    // Non-critical
  }
}

// ─── Conflict Resolution (Dedup) ──────────────────────────────────────────

/**
 * Check if a message is a duplicate (same content, sender, approximate time).
 * Uses content hash + sender Id + time window.
 */
export async function isDuplicate(
  env: Env,
  transportMessage: TransportMessage,
  timeWindowMs = 5000, // 5 second window
): Promise<boolean> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return false;

  const contentHash = await computeContentHash(transportMessage.encryptedBlob);
  const dedupKey = `${MESSAGE_DEDUP_PREFIX}${transportMessage.fromId}:${contentHash}`;

  try {
    const existing = await kv.get(dedupKey);
    if (existing) {
      const prevTimestamp = parseInt(existing, 10);
      // Within time window?
      if (Date.now() - prevTimestamp < timeWindowMs) {
        return true;
      }
    }

    // Store this message's hash with timestamp
    await kv.put(dedupKey, String(Date.now()), { expirationTtl: 60 }); // 60 second TTL
    return false;
  } catch {
    return false;
  }
}

/**
 * Resolve conflicts between duplicate messages.
 * Keeps the first delivered message, discards duplicates.
 */
export async function resolveConflict(
  env: Env,
  existingMessageId: string,
  incomingMessage: TransportMessage,
): Promise<'keep_existing' | 'replace_with_incoming' | 'both_different'> {
  const existing = await getDeliveryRecord(env, existingMessageId);
  if (!existing) return 'replace_with_incoming';

  // Same content hash? Definitely a dup — keep existing
  const incomingHash = await computeContentHash(incomingMessage.encryptedBlob);
  if (existing.contentHash === incomingHash) {
    return 'keep_existing';
  }

  // Different content — keep the one with earlier timestamp
  // (first message wins in a conflict)
  if (incomingMessage.metadata?.timestamp && existing.transportMessage.metadata?.timestamp) {
    const incomingTs = incomingMessage.metadata.timestamp as number;
    const existingTs = existing.transportMessage.metadata.timestamp as number;

    if (incomingTs < existingTs - 5000) {
      return 'replace_with_incoming';
    }
  }

  return 'both_different'; // Different messages, keep both
}

// ─── Delivery Webhooks ────────────────────────────────────────────────────

/**
 * Send a delivery receipt webhook via the n8n webhook system.
 * Called when a message status changes.
 */
export async function notifyDeliveryWebhook(env: Env, record: DeliveryRecord): Promise<void> {
  const webhookUrl = env.WEBHOOK_BASE_URL || 'https://hooks.degenfeed.xyz/chat/delivery';

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event: `message.${record.status}`,
        messageId: record.messageId,
        conversationId: record.conversationId,
        fromId: record.fromId,
        toId: record.toId,
        status: record.status,
        protocolStatus: record.protocolStatus,
        deliveredAt: record.deliveredAt,
        readAt: record.readAt,
        timestamp: Date.now(),
      }),
    });
  } catch {
    // Webhook delivery is best-effort
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────

/**
 * Compute a content hash for deduplication.
 */
async function computeContentHash(encryptedBlob: string): Promise<string> {
  const bytes = new TextEncoder().encode(encryptedBlob.slice(0, 512)); // First 512 bytes
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}
