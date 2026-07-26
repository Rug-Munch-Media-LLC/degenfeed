/**
 * @degenfeed/api-worker — Circuit Breaker
 *
 * Prevents cascading failures across protocol bridges.
 * States: CLOSED → OPEN → HALF-OPEN → CLOSED
 */

import type { Env } from '../types';
import type { CircuitBreakerConfig } from './bridge-reliability-types';
import { CircuitBreakerOpenError } from './bridge-reliability-types';

interface CircuitState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  openedAt: number | null;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  lastError: string | null;
}

const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  threshold: 5,
  resetTimeout: 60_000,
  halfOpenSuccesses: 2,
  kvPrefix: 'cb:',
};

export class CircuitBreaker {
  private states = new Map<string, CircuitState>();
  private configs = new Map<string, Required<CircuitBreakerConfig>>();
  private kv: KVNamespace | null = null;
  private kvEnabled = false;

  constructor(kv?: KVNamespace | null) {
    this.kv = kv ?? null;
    this.kvEnabled = !!kv;
  }

  async execute<T>(
    protocol: string,
    operation: () => Promise<T>,
    config?: CircuitBreakerConfig,
  ): Promise<T> {
    const merged = this.mergeConfig(protocol, config);
    const state = await this.getState(protocol);

    if (state.state === 'open') {
      const elapsed = Date.now() - (state.openedAt ?? Date.now());
      if (elapsed < merged.resetTimeout) {
        throw new CircuitBreakerOpenError(protocol, state.openedAt ?? undefined);
      }
      state.state = 'half-open';
      state.openedAt = null;
      await this.persistState(protocol, state);
    }

    try {
      const result = await operation();
      await this.recordSuccess(protocol);
      return result;
    } catch (error) {
      await this.recordFailure(protocol, error);
      throw error;
    }
  }

  async recordSuccess(protocol: string): Promise<void> {
    const state = await this.getState(protocol);
    const config = this.getEffectiveConfig(protocol);
    state.lastSuccessAt = Date.now();
    state.successCount++;

    if (state.state === 'half-open') {
      if (state.successCount >= config.halfOpenSuccesses) {
        state.state = 'closed';
        state.failureCount = 0;
        state.successCount = 0;
        state.lastError = null;
      }
    } else if (state.state === 'closed') {
      state.failureCount = Math.max(0, state.failureCount - 1);
    }

    await this.persistState(protocol, state);
  }

  async recordFailure(protocol: string, error?: unknown): Promise<void> {
    const state = await this.getState(protocol);
    const config = this.getEffectiveConfig(protocol);

    state.failureCount++;
    state.lastFailureAt = Date.now();
    state.lastError = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    state.successCount = 0;

    if (state.failureCount >= config.threshold && state.state !== 'open') {
      state.state = 'open';
      state.openedAt = Date.now();
    }

    await this.persistState(protocol, state);
  }

  async isOpen(protocol: string): Promise<boolean> {
    const state = await this.getState(protocol);
    if (state.state !== 'open') return false;
    const config = this.getEffectiveConfig(protocol);
    const elapsed = Date.now() - (state.openedAt ?? Date.now());
    if (elapsed >= config.resetTimeout) {
      state.state = 'half-open';
      state.openedAt = null;
      await this.persistState(protocol, state);
      return false;
    }
    return true;
  }

  async getCircuitState(protocol: string): Promise<{
    state: string;
    failureCount: number;
    successCount: number;
    openedAt: number | null;
    lastFailureAt: number | null;
    lastSuccessAt: number | null;
    lastError: string | null;
  }> {
    const state = await this.getState(protocol);
    return { ...state };
  }

  configure(protocol: string, config: CircuitBreakerConfig): void {
    this.configs.set(protocol, { ...DEFAULT_CONFIG, ...config });
  }

  reset(protocol: string): void {
    this.states.delete(protocol);
  }

  // ── Private ───────────────────────────────────────────

  private mergeConfig(
    protocol: string,
    config?: CircuitBreakerConfig,
  ): Required<CircuitBreakerConfig> {
    if (config) return { ...DEFAULT_CONFIG, ...config };
    return this.configs.get(protocol) ?? DEFAULT_CONFIG;
  }

  private getEffectiveConfig(protocol: string): Required<CircuitBreakerConfig> {
    return this.configs.get(protocol) ?? DEFAULT_CONFIG;
  }

  private async getState(protocol: string): Promise<CircuitState> {
    if (this.kvEnabled) {
      try {
        const config = this.getEffectiveConfig(protocol);
        const raw = await this.kv!.get(`${config.kvPrefix}${protocol}`);
        if (raw) {
          const parsed = JSON.parse(raw) as CircuitState;
          this.states.set(protocol, parsed);
          return parsed;
        }
      } catch {
        /* fall back to in-memory */
      }
    }

    if (!this.states.has(protocol)) {
      this.states.set(protocol, {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        openedAt: null,
        lastFailureAt: null,
        lastSuccessAt: null,
        lastError: null,
      });
    }
    return this.states.get(protocol)!;
  }

  private async persistState(protocol: string, state: CircuitState): Promise<void> {
    this.states.set(protocol, { ...state });
    if (this.kvEnabled) {
      try {
        const config = this.getEffectiveConfig(protocol);
        await this.kv!.put(`${config.kvPrefix}${protocol}`, JSON.stringify(state), {
          expirationTtl: 86400,
        });
      } catch {
        /* non-critical */
      }
    }
  }
}

// ─── Singleton ───────────────────────────────────────────

let _circuitBreaker: CircuitBreaker | undefined;

export function getCircuitBreaker(env?: Env): CircuitBreaker {
  if (!_circuitBreaker) {
    _circuitBreaker = new CircuitBreaker(env?.CACHE ?? null);
    _circuitBreaker.configure('farcaster', { threshold: 3, resetTimeout: 30_000 });
    _circuitBreaker.configure('lens', { threshold: 3, resetTimeout: 30_000 });
    _circuitBreaker.configure('bluesky', { threshold: 5, resetTimeout: 60_000 });
    _circuitBreaker.configure('mastodon', { threshold: 5, resetTimeout: 60_000 });
    _circuitBreaker.configure('activitypub', { threshold: 5, resetTimeout: 60_000 });
    _circuitBreaker.configure('nostr', { threshold: 8, resetTimeout: 90_000 });
    _circuitBreaker.configure('telegram', { threshold: 5, resetTimeout: 60_000 });
    _circuitBreaker.configure('rss', { threshold: 5, resetTimeout: 60_000 });
    _circuitBreaker.configure('zora', { threshold: 3, resetTimeout: 120_000 });
    _circuitBreaker.configure('threads', { threshold: 3, resetTimeout: 30_000 });
  }
  return _circuitBreaker;
}
