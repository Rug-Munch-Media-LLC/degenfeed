/**
 * @degenfeed/api-worker — Persistent Offline Queue
 *
 * KV-backed FIFO queue for deferred operation processing.
 * Handles transient failures by storing operations for retry.
 *
 * Architecture:
 *   - Operations are stored in KV with a TTL (default 24h)
 *   - Each operation has: id, name, payload, status, retryCount, maxRetries
 *   - Processed via processQueue() which drains the queue in FIFO order
 *   - Dead letters (max retries exceeded) are preserved for admin review
 *
 * Integration:
 *   - Used by error-recovery.ts for offline queue strategy
 *   - Used by transaction-monitor.ts for postponed checks
 *   - Can be consumed by any route handler needing deferred execution
 *
 * Key schema:
 *   queue:op:{queueKey}         → OperationRecord (staged)
 *   queue:pending               → Array<queueKey> (FIFO ordering)
 *   queue:dead-letter:{queueKey} → OperationRecord (exhausted)
 *   queue:cache:{cacheKey}      → CachedData (typed value)
 */

import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────

export type OperationRecord<T = unknown> = {}
