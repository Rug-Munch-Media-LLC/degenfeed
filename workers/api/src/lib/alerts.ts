/**
 * @degenfeed/api-worker — Bridge Alerting System
 *
 * Real-time alerting for bridge failures with:
 *   1. KV-backed failure tracking with counters and rate-limiting
 *   2. Structured logging for Sentry/GlitchTip ingestion
 *   3. Auto-pause bridge routes when circuit breaker opens
 *   4. Configurable notification channels (log, KV, webhook)
 *
 * Every bridge failure should call `alertBridgeFailure()` so the ops
 * team gets visibility within seconds, not days.
 */

import type { Env } from '../types';
import { getCircuitBreaker } from './bridge-reliability';

// ─── Constants ─────────────────────────────────────────────────────────────

/** KV key prefix for bridge failure records */
const FAILURE_PREFIX = 'bridge-failure:';

/** KV key prefix for bridge alert counters */
const ALERT_COUNTER_PREFIX = 'bridge-alert-counter:';

/** KV key for the bridge auto-pause record */
const PAUSE_PREFIX = 'bridge-pause:';

/** Minimum interval between duplicate alerts for the same protocol (5 min) */
const ALERT_THROTTLE_MS = 5 * 60 * 1000;

/** Alert if failure rate exceeds this threshold (80%) */
const FAILURE_RATE_THRESHOLD = 0.8;

/** Minimum number of operations before failure rate check kicks in */
const MIN_OPS_FOR_RATE_CHECK = 10;

/** Maximum alert counter value before we stop alerting (prevents alert fatigue) */
const MAX_ALERT_COUNT = 50;

// ─── Types ─────────────────────────────────────────────────────────────────

export type BridgeAlert = {}
