/**
 * Simple circuit breaker with 3 states: CLOSED, OPEN, HALF_OPEN
 *
 * - CLOSED: normal operation, counts consecutive failures
 * - OPEN: rejects all requests after `failureThreshold` consecutive failures
 * - HALF_OPEN: allows 1 test request after `cooldownMs` has elapsed
 *
 * On success in HALF_OPEN → back to CLOSED
 * On failure in HALF_OPEN → back to OPEN (restart cooldown)
 */

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly successThreshold: number;

  constructor(name: string, failureThreshold = 3, cooldownMs = 60000, successThreshold = 1) {
    if (failureThreshold < 1) throw new Error('failureThreshold must be >= 1');
    if (cooldownMs < 0) throw new Error('cooldownMs must be >= 0');
    if (successThreshold < 1) throw new Error('successThreshold must be >= 1');
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.successThreshold = successThreshold;
  }

  getState(): CircuitState {
    if (this.state === 'OPEN' && Date.now() - this.lastFailureTime >= this.cooldownMs) {
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }
    return this.state;
  }

  /**
   * Execute a function under circuit breaker protection.
   * Throws CircuitBreakerError if the circuit is OPEN.
   * Re-throws any error from fn, tracking it as a failure.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new CircuitBreakerError(
        `[${this.name}] circuit breaker is OPEN after ${this.failureCount} consecutive failures`,
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  /** Reset the breaker to CLOSED state */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        console.log(
          `[circuit-breaker] ${this.name}: CLOSED after ${this.successThreshold} successful test request(s)`,
        );
      }
    } else {
      // CLOSED — reset failure count on success
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(
        `[circuit-breaker] ${this.name}: OPEN after ${this.failureCount} consecutive failures, cooldown ${this.cooldownMs}ms`,
      );
    }
  }
}
