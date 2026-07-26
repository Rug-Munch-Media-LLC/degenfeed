/**
 * @degenfeed/api-worker — Circuit Breaker for Suspicious Activity Detection
 *
 * Implements a stateful circuit breaker pattern that monitors for suspicious
 * activity patterns and temporarily blocks offending IPs/addresses.
 *
 * Three states: CLOSED (normal) → HALF_OPEN (probing) → OPEN (blocking)
 *
 * Integrates with KV for distributed state across Worker instances.
 */

import type { Env } from '../types';
import { logSecurityEvent } from './security-log';

/* ─── Types ─────────────────────────────────────────────────────────── */

export type CircuitState = 'CLOSED' | 'HALF_OPEN' | 'OPEN';

export type CircuitBreakerConfig = {}
