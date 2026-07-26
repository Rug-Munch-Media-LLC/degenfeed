/**
 * @degenfeed/api-worker — Durable Sync Queue
 *
 * KV-backed queue for cross-protocol sync actions.
 * Ensures every action is processed at least once, even during
 * worker downtime or protocol API failures. Uses exponential backoff
 * with up to 5 retries before permanent dead-letter status.
 *
 * Queue lifecycle:
 *   enqueue → pending → processing → completed | failed → retry (up to 5×)
 *
 * Processed by the cron trigger every 30 seconds and inline after
 * webhook delivery for sub-second forwarding.
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export type SyncActionType =
  | 'post_created'
  | 'post_updated'
  | 'post_deleted'
  | 'like_added'
  | 'like_removed'
  | 'repost_added'
  | 'repost_removed'
  | 'reply_added'
  | 'tip_received'
  | 'stream_started'
  | 'stream_ended'
  | 'stream_status'
  | 'identity_linked'
  | 'identity_unlinked';

export type SyncStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';

export type SyncAction = {};
