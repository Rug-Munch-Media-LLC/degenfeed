/**
 * @degenfeed/api-worker — Bridge Reliability System
 *
 * THREE pillars of cross-protocol bridge reliability:
 *   1. Circuit Breaker — prevent cascading failures when a protocol is down
 *   2. Retry with Exponential Backoff — transient error recovery
 *   3. Bridge Health Monitor — observability into every protocol's status
 *
 * Every bridge operation in the codebase MUST go through `withReliability()`
 * which chains the circuit breaker → retry → execution pipeline.
 *
 * ARCHITECTURE:
 *   - Circuit breaker state is stored in-memory (per-CF-isolate) for speed
 *     AND persisted to KV for cross-isolate coordination.
 *   - KV is the source of truth; in-memory is a fast write-through cache.
 *   - Retry jitter prevents thundering herd on protocol recovery.
 */

import type { Env } from '../types';

// ─── Error Types ───────────────────────────────────────────────────────────

/**
 * Thrown when a circuit breaker is open (protocol is considered down).
 * The caller should NOT attempt the operation — fail fast.
 */
export class CircuitBreakerOpenError extends Error {
