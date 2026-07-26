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

import { log } from '../logger';
import type { Env } from '../types';
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

export interface DeviceInfo {

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

/**
 * Update delivery status after a protocol delivery attempt.
 */
export async function updateDeliveryStatus(
  env: Env,
  messageId: string,
  protocol: TransportProtocol,
  result: TransportResult,
  options?: {
): Promise<DeliveryRecord | null> {

/**
 * Mark a message as read.
 */
export async function markMessageRead(
  env: Env,
  messageId: string,
  userId: string,
): Promise<DeliveryRecord | null> {

/**
 * Get delivery status for a specific message.
 */
export async function getDeliveryRecord(
  env: Env,
  messageId: string,
): Promise<DeliveryRecord | null> {

/**
 * Get delivery statuses for multiple messages in a conversation.
 */
export async function getConversationDeliveryStatus(
  env: Env,
  _conversationId: string,
  messageIds: string[],
): Promise<Record<string, DeliveryStatus>> {

async function saveDeliveryRecord(env: Env, record: DeliveryRecord): Promise<void> {

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

/**
 * Get all offline messages for a user who just came online.
 * Clears the offline queue on read.
 */
export async function getOfflineMessages(
  env: Env,
  userId: string,
): Promise<Array<{ message: TransportMessage; conversationId: string }>> {

/**
 * Retry failed deliveries from the delivery queue.
 * Called by cron every minute.
 */
export async function retryFailedDeliveries(env: Env): Promise<number> {

// ─── Multi-Device Sync ────────────────────────────────────────────────────

/**
 * Register a device for a user.
 */
export async function registerDevice(
  env: Env,
  userId: string,
  device: Omit<DeviceInfo, 'registeredAt' | 'userId'>,
): Promise<DeviceInfo> {

/**
 * Get all devices for a user.
 */
export async function getUserDevices(env: Env, userId: string): Promise<DeviceInfo[]> {

/**
 * Remove a device.
 */
export async function removeDevice(env: Env, deviceId: string): Promise<void> {

/**
 * Sync a message to all of a user's devices.
 * Returns number of devices the message was synced to.
 */
export async function syncToDevices(
  env: Env,
  userId: string,
  message: TransportMessage,
): Promise<number> {

/**
 * Update device online status.
 */
export async function updateDeviceStatus(
  env: Env,
  deviceId: string,
  online: boolean,
  wsConnectionId?: string,
): Promise<void> {

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

/**
 * Resolve conflicts between duplicate messages.
 * Keeps the first delivered message, discards duplicates.
 */
export async function resolveConflict(
  env: Env,
  existingMessageId: string,
  incomingMessage: TransportMessage,
): Promise<'keep_existing' | 'replace_with_incoming' | 'both_different'> {

// ─── Delivery Webhooks ────────────────────────────────────────────────────

/**
 * Send a delivery receipt webhook via the n8n webhook system.
 * Called when a message status changes.
 */
export async function notifyDeliveryWebhook(env: Env, record: DeliveryRecord): Promise<void> {

// ─── Utility ──────────────────────────────────────────────────────────────

/**
 * Compute a content hash for deduplication.
 */
async function computeContentHash(encryptedBlob: string): Promise<string> {

