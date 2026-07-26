/**
 * Circuit Breaker — Prevents cascading failures from failing providers.
 * Tracks failure counts per provider and opens the circuit when threshold exceeded.
 */

interface CircuitBreakerState {
  failures: number;
  lastFailure: number | null;
  lastSuccess: number | null;
  state: 'closed' | 'open' | 'half-open';
}

class ProviderCircuitBreaker {
  private providers = new Map<string, CircuitBreakerState>();
  private thresholds = new Map<string, number>();

  register(protocol: string, threshold = 5): void {
    if (!this.providers.has(protocol)) {
      this.providers.set(protocol, {
        failures: 0,
        lastFailure: null,
        lastSuccess: null,
        state: 'closed',
      });
      this.thresholds.set(protocol, threshold);
    }
  }

  isAllowed(protocol: string): boolean {
    const state = this.providers.get(protocol);
    if (!state) return true;

    if (state.state === 'open') {
      const resetAfter = 30000; // 30s reset timeout
      if (state.lastFailure && Date.now() - state.lastFailure >= resetAfter) {
        state.state = 'half-open';
        return true;
      }
      return false;
    }

    return true;
  }

  recordSuccess(protocol: string): void {
    const state = this.providers.get(protocol);
    if (state) {
      state.failures = 0;
      state.lastSuccess = Date.now();
      state.state = 'closed';
    }
  }

  recordFailure(protocol: string): void {
    const state = this.providers.get(protocol);
    if (state) {
      state.failures++;
      state.lastFailure = Date.now();
      const threshold = this.thresholds.get(protocol) || 5;
      if (state.failures >= threshold) {
        state.state = 'open';
      }
    }
  }

  getState(protocol: string): string {
    return this.providers.get(protocol)?.state || 'closed';
  }
}

export const providerCircuitBreaker = new ProviderCircuitBreaker();
