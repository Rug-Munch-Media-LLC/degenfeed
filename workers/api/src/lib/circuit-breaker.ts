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

import type { Env } from '../index';
import { logSecurityEvent } from './security-log';

/* ─── Types ─────────────────────────────────────────────────────────── */

export type CircuitState = 'CLOSED' | 'HALF_OPEN' | 'OPEN';

export interface CircuitBreakerConfig {
  /** Number of failures before tripping to OPEN */
  failureThreshold: number;
  /** Milliseconds before transitioning from OPEN to HALF_OPEN */
  resetTimeout: number;
  /** Number of probe requests */
  halfOpenMaxRequests: number;
  /** KV key prefix */
  prefix: string;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureAt: number;
  halfOpenRequests: number;
  trippedAt: number;
  /** The original trigger reason */
  reason?: string;
}

export const DEFAULT_CIRCUIT_CONFIGS: Record<string, CircuitBreakerConfig> = {
  'wallet:verify': {
    failureThreshold: 10,
    resetTimeout: 300_000, // 5 minutes
    halfOpenMaxRequests: 3,
    prefix: 'cb:wallet-verify',
  },
  'wallet:nonce': {
    failureThreshold: 20,
    resetTimeout: 120_000,
    halfOpenMaxRequests: 5,
    prefix: 'cb:wallet-nonce',
  },
  'auth:email': {
    failureThreshold: 15,
    resetTimeout: 300_000,
    halfOpenMaxRequests: 3,
    prefix: 'cb:auth-email',
  },
  'session:login': {
    failureThreshold: 30,
    resetTimeout: 600_000, // 10 minutes
    halfOpenMaxRequests: 3,
    prefix: 'cb:session-login',
  },
  'api:global': {
    failureThreshold: 100,
    resetTimeout: 120_000, // 2 minutes
    halfOpenMaxRequests: 10,
    prefix: 'cb:api-global',
  },
};

/* ─── KV helpers ────────────────────────────────────────────────────── */

function stateKey(prefix: string, id: string): string {
  return `${prefix}:state:${id}`;
}

function recentFailuresKey(prefix: string, id: string): string {
  return `${prefix}:failures:${id}`;
}

/* ─── Core logic ────────────────────────────────────────────────────── */

/**
 * Check if the circuit is OPEN for a given circuit breaker + entity ID.
 * CLOSED → allow through
 * HALF_OPEN → allow a limited number of probes
 * OPEN → block unless the reset timeout has elapsed
 */
export async function checkCircuit(
  env: Env,
  circuitId: string,
  entityId: string,
): Promise<{ allowed: boolean; state: CircuitState }> {
  const config = DEFAULT_CIRCUIT_CONFIGS[circuitId];
  if (!config) return { allowed: true, state: 'CLOSED' };

  if (!env.CACHE) return { allowed: true, state: 'CLOSED' };

  try {
    const raw = await env.CACHE.get(stateKey(config.prefix, entityId));
    if (!raw) return { allowed: true, state: 'CLOSED' };

    const state = JSON.parse(raw) as CircuitBreakerState;

    if (state.state === 'OPEN') {
      const elapsed = Date.now() - state.trippedAt;
      if (elapsed >= config.resetTimeout) {
        // Transition to HALF_OPEN
        const halfOpenState: CircuitBreakerState = {
          state: 'HALF_OPEN',
          failureCount: state.failureCount,
          lastFailureAt: state.lastFailureAt,
          halfOpenRequests: 0,
          trippedAt: state.trippedAt,
          reason: state.reason,
        };
        await env.CACHE.put(stateKey(config.prefix, entityId), JSON.stringify(halfOpenState), {
          expirationTtl: Math.ceil(config.resetTimeout / 1000),
        });
        return { allowed: true, state: 'HALF_OPEN' };
      }
      return { allowed: false, state: 'OPEN' };
    }

    if (state.state === 'HALF_OPEN') {
      if (state.halfOpenRequests >= config.halfOpenMaxRequests) {
        return { allowed: false, state: 'HALF_OPEN' };
      }
      return { allowed: true, state: 'HALF_OPEN' };
    }

    return { allowed: true, state: 'CLOSED' };
  } catch {
    // KV hiccup — allow through (fail-open for availability)
    return { allowed: true, state: 'CLOSED' };
  }
}

/**
 * Record a failure for a circuit breaker entity. If the failure threshold
 * is exceeded, the circuit trips OPEN.
 */
export async function recordCircuitFailure(
  env: Env,
  circuitId: string,
  entityId: string,
  reason?: string,
): Promise<CircuitState> {
  const config = DEFAULT_CIRCUIT_CONFIGS[circuitId];
  if (!config) return 'CLOSED';

  if (!env.CACHE) return 'CLOSED';

  try {
    const key = stateKey(config.prefix, entityId);
    const raw = await env.CACHE.get(key);
    const now = Date.now();
    let state: CircuitBreakerState;

    if (raw) {
      state = JSON.parse(raw) as CircuitBreakerState;
      state.failureCount++;
      state.lastFailureAt = now;

      if (state.state === 'HALF_OPEN') {
        // A failure in HALF_OPEN means the system is still broken — trip back to OPEN
        state.state = 'OPEN';
        state.trippedAt = now;
        state.halfOpenRequests = 0;
      } else if (state.failureCount >= config.failureThreshold) {
        state.state = 'OPEN';
        state.trippedAt = now;
        state.reason = reason;
      }
    } else {
      state = {
        state: 'CLOSED',
        failureCount: 1,
        lastFailureAt: now,
        halfOpenRequests: 0,
        trippedAt: 0,
      };
    }

    await env.CACHE.put(key, JSON.stringify(state), {
      expirationTtl: Math.ceil((config.resetTimeout * 2) / 1000),
    });

    // If we just tripped the circuit, log a security event
    if (state.state === 'OPEN' && raw) {
      const prevState = JSON.parse(raw) as CircuitBreakerState;
      if (prevState.state !== 'OPEN') {
        await logSecurityEvent(env, {
          type: 'login_failed',
          address: entityId,
          ip: entityId,
          metadata: {
            circuit_breaker: circuitId,
            reason: reason ?? 'Threshold exceeded',
            failure_count: String(state.failureCount),
          },
        }).catch(() => {});
      }
    }

    return state.state;
  } catch {
    return 'CLOSED';
  }
}

/**
 * Record a success for a circuit breaker entity.
 * In HALF_OPEN, a success transitions back to CLOSED.
 * In CLOSED, this reduces the failure count (sliding window decay).
 */
export async function recordCircuitSuccess(
  env: Env,
  circuitId: string,
  entityId: string,
): Promise<void> {
  const config = DEFAULT_CIRCUIT_CONFIGS[circuitId];
  if (!config || !env.CACHE) return;

  try {
    const key = stateKey(config.prefix, entityId);
    const raw = await env.CACHE.get(key);
    if (!raw) return;

    const state = JSON.parse(raw) as CircuitBreakerState;

    if (state.state === 'HALF_OPEN') {
      // Success in HALF_OPEN → system recovered → transition to CLOSED
      await env.CACHE.delete(key);
      return;
    }

    if (state.state === 'CLOSED' && state.failureCount > 0) {
      // Decay failure count (sliding window)
      state.failureCount = Math.max(0, state.failureCount - 1);
      await env.CACHE.put(key, JSON.stringify(state), {
        expirationTtl: Math.ceil((config.resetTimeout * 2) / 1000),
      });
    }
  } catch {
    // Best-effort
  }
}

/**
 * Track a half-open probe request count.
 */
export async function recordHalfOpenProbe(
  env: Env,
  circuitId: string,
  entityId: string,
): Promise<void> {
  const config = DEFAULT_CIRCUIT_CONFIGS[circuitId];
  if (!config || !env.CACHE) return;

  try {
    const key = stateKey(config.prefix, entityId);
    const raw = await env.CACHE.get(key);
    if (!raw) return;

    const state = JSON.parse(raw) as CircuitBreakerState;
    if (state.state === 'HALF_OPEN') {
      state.halfOpenRequests++;
      await env.CACHE.put(key, JSON.stringify(state), {
        expirationTtl: Math.ceil((config.resetTimeout * 2) / 1000),
      });
    }
  } catch {
    // Best-effort
  }
}

/**
 * Get circuit breaker status for an entity.
 */
export async function getCircuitStatus(
  env: Env,
  circuitId: string,
  entityId: string,
): Promise<{ state: CircuitState; failureCount: number }> {
  const config = DEFAULT_CIRCUIT_CONFIGS[circuitId];
  if (!config || !env.CACHE) {
    return { state: 'CLOSED', failureCount: 0 };
  }

  try {
    const raw = await env.CACHE.get(stateKey(config.prefix, entityId));
    if (!raw) return { state: 'CLOSED', failureCount: 0 };

    const state = JSON.parse(raw) as CircuitBreakerState;
    return { state: state.state, failureCount: state.failureCount };
  } catch {
    return { state: 'CLOSED', failureCount: 0 };
  }
}

/**
 * Reset a circuit breaker for an entity (admin operation).
 */
export async function resetCircuit(
  env: Env,
  circuitId: string,
  entityId: string,
): Promise<boolean> {
  const config = DEFAULT_CIRCUIT_CONFIGS[circuitId];
  if (!config || !env.CACHE) return false;

  try {
    await env.CACHE.delete(stateKey(config.prefix, entityId));
    await env.CACHE.delete(recentFailuresKey(config.prefix, entityId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Middleware-compatible circuit breaker check.
 * Returns a Response if blocked, null if allowed through.
 */
export async function circuitBreakerMiddleware(
  env: Env,
  circuitId: string,
  entityId: string,
): Promise<Response | null> {
  const result = await checkCircuit(env, circuitId, entityId);
  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests — temporarily blocked',
        code: 'DF-429',
        retryAfterMs: 300_000,
      }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': '300',
          'x-circuit-state': result.state,
        },
      },
    );
  }
  if (result.state === 'HALF_OPEN') {
    await recordHalfOpenProbe(env, circuitId, entityId);
  }
  return null;
}
