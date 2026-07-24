/**
 * @degenfeed/cross-protocol-bridge — Circuit Breaker
 *
 * Per-bridge-path circuit breaker with configurable thresholds.
 * Prevents cascading failures by halting bridges that are failing.
 */

import type { CircuitBreakerConfig, CircuitBreakerState } from './types';
import { DEFAULT_CIRCUIT_CONFIG } from './types';

export class CircuitBreaker {
  private states = new Map<string, CircuitBreakerState>();
  private configs = new Map<string, CircuitBreakerConfig>();

  /**
   * Configure a circuit breaker for a bridge path.
   */
  configure(pathId: string, overrides?: Partial<CircuitBreakerConfig>): void {
    const config: CircuitBreakerConfig = {
      ...DEFAULT_CIRCUIT_CONFIG,
      ...overrides,
    };
    this.configs.set(pathId, config);

    if (!this.states.has(pathId)) {
      this.states.set(pathId, {
        pathId,
        state: 'closed',
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
        openedAt: null,
        halfOpenAttempts: 0,
      });
    }
  }

  /**
   * Check if a bridge path is allowed to execute.
   */
  isAllowed(pathId: string): boolean {
    const state = this.getOrCreateState(pathId);
    const now = Date.now();

    if (state.state === 'closed') return true;

    if (state.state === 'open') {
      const config = this.configs.get(pathId) ?? DEFAULT_CIRCUIT_CONFIG;
      if (state.openedAt && now - state.openedAt >= config.resetTimeoutMs) {
        // Transition to half-open
        state.state = 'half-open';
        state.halfOpenAttempts = 0;
        return true;
      }
      return false;
    }

    // Half-open: allow limited requests
    const config = this.configs.get(pathId) ?? DEFAULT_CIRCUIT_CONFIG;
    if (state.halfOpenAttempts < config.halfOpenMaxRequests) {
      state.halfOpenAttempts++;
      return true;
    }
    return false;
  }

  /**
   * Record a successful bridge operation.
   */
  recordSuccess(pathId: string): void {
    const state = this.getOrCreateState(pathId);
    state.failureCount = 0;
    state.lastSuccessAt = Date.now();
    state.state = 'closed';
    state.openedAt = null;
    state.halfOpenAttempts = 0;
  }

  /**
   * Record a failed bridge operation.
   */
  recordFailure(pathId: string): void {
    const state = this.getOrCreateState(pathId);
    state.failureCount++;
    state.lastFailureAt = Date.now();

    const config = this.configs.get(pathId) ?? DEFAULT_CIRCUIT_CONFIG;

    if (state.failureCount >= config.failureThreshold) {
      state.state = 'open';
      state.openedAt = Date.now();
    }
  }

  /**
   * Reset the circuit breaker for a path.
   */
  reset(pathId?: string): void {
    if (pathId) {
      this.states.delete(pathId);
    } else {
      this.states.clear();
    }
  }

  /**
   * Get the current state of a circuit breaker.
   */
  getState(pathId: string): CircuitBreakerState | undefined {
    return this.states.get(pathId);
  }

  /**
   * Get all circuit breaker states.
   */
  getAllStates(): CircuitBreakerState[] {
    return Array.from(this.states.values());
  }

  /**
   * Get summary stats.
   */
  getSummary(): { open: number; closed: number; halfOpen: number; total: number } {
    const states = this.getAllStates();
    const open = states.filter((s) => s.state === 'open').length;
    const closed = states.filter((s) => s.state === 'closed').length;
    const halfOpen = states.filter((s) => s.state === 'half-open').length;
    return { open, closed, halfOpen, total: states.length };
  }

  private getOrCreateState(pathId: string): CircuitBreakerState {
    let state = this.states.get(pathId);
    if (!state) {
      this.configure(pathId);
      state = this.states.get(pathId)!;
    }
    return state;
  }
}

/** Singleton instance */
export const circuitBreaker = new CircuitBreaker();
