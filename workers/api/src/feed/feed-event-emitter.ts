/**
 * @degenfeed/api-worker — Feed Event Emitter
 *
 * Coordinates real-time feed event emission to WebSocket clients.
 * After any provider finishes fetching new content, this service:
 * 1. Checks for new posts since the last emission per feed type
 * 2. Compares against KV-stored "last seen" timestamps per feed type
 * 3. Emits `feed:new-post` events to subscribed WebSocket clients
 * 4. Batches emissions (max 1 per second) to avoid flooding
 * 5. Tracks which clients have seen which posts to avoid duplicates
 *
 * Also emits `feed:trending-update`, `feed:engagement-update`,
 * and `feed:protocol-status` events.
 */

import type { EngagementMetrics, Protocol, UnifiedPost } from '@degenfeed/types';
import { broadcastToTopic } from '../routes/realtime';
import type { FeedScope } from '../ws-channels';
import { CHANNELS } from '../ws-channels';

// ─── Types ────────────────────────────────────────────────────────────────

export interface NewPostEvent {

export interface TrendingTopic {

export interface TrendingUpdateEvent {

export interface EngagementUpdateEvent {

export type ProtocolStatus = 'up' | 'degraded' | 'down';

export interface ProtocolStatusEvent {

// ─── Batching state ──────────────────────────────────────────────────────

const BATCH_INTERVAL_MS = 1_000; // max 1 emission per second per event type

interface BatchState {

const batchState: BatchState = {

let flushTimer: ReturnType<typeof setTimeout> | null = null;

// ─── KV-backed dedup ─────────────────────────────────────────────────────

/**
 * KV key for tracking the last-seen post ID per feed scope.
 * Used to avoid emitting duplicate new-post events.
 */
function lastSeenKey(scope: FeedScope): string {

/**
 * Get the last-emitted post ID for a given feed scope from KV.
 */
export async function getLastSeenPostId(
  env: { CACHE?: KVNamespace },
  scope: FeedScope,
): Promise<string | null> {

/**
 * Store the latest post ID for a feed scope in KV.
 * Used to suppress duplicate emissions on the next cycle.
 */
export async function setLastSeenPostId(
  env: { CACHE?: KVNamespace },
  scope: FeedScope,
  postId: string,
): Promise<void> {

// ─── Event emission ──────────────────────────────────────────────────────

/**
 * Queue a `feed:new-post` event for batched emission.
 * If the queue was empty, schedule a flush in BATCH_INTERVAL_MS.
 */
export function emitNewPost(event: NewPostEvent): void {

/**
 * Queue a `feed:trending-update` event.
 * Replaces any previously queued trending update (latest wins).
 */
export function emitTrendingUpdate(event: TrendingUpdateEvent): void {

/**
 * Queue a `feed:engagement-update` event for batched emission.
 */
export function emitEngagementUpdate(event: EngagementUpdateEvent): void {

/**
 * Queue a `feed:protocol-status` event.
 * Only the latest status per protocol is kept.
 */
export function emitProtocolStatus(event: ProtocolStatusEvent): void {

// ─── Flush logic ─────────────────────────────────────────────────────────

function scheduleFlush(): void {

function flushBatch(): void {

// ─── Provider fetch integration ──────────────────────────────────────────

/**
 * Called after a provider fetch completes.
 * Checks if the newest post is different from the last-seen post
 * for the given scope and emits a `feed:new-post` event if so.
 *
 * @param env - Worker env with KV bindings
 * @param scope - Which feed scope this fetch was for
 * @param posts - The posts returned from the provider fetch (sorted newest-first)
 * @param protocol - The protocol that was fetched
 */
export async function checkAndEmitNewPosts(
  env: { CACHE?: KVNamespace },
  scope: FeedScope,
  posts: UnifiedPost[],
  protocol: Protocol,
): Promise<void> {

/**
 * Emit a trending update event to all subscribers.
 */
export function emitTrendingTopics(topics: TrendingTopic[]): void {

/**
 * Emit a protocol status change event.
 */
export function emitProtocolHealth(
  protocol: Protocol,
  status: ProtocolStatus,
  latency: number,
): void {

