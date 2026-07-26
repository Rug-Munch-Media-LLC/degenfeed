/**
 * @degenfeed/api-worker — Bridge Reliability Types
 *
 * Shared types, interfaces, and error classes for cross-protocol bridge reliability.
 */

// ─── Error Types ─────────────────────────────────────────

export class CircuitBreakerOpenError extends Error {
  readonly protocol: string;
  readonly openedAt: number;

  constructor(protocol: string, openedAt?: number) {
    super(`Circuit breaker is OPEN for protocol "${protocol}" — failing fast`);
    this.name = 'CircuitBreakerOpenError';
    this.protocol = protocol;
    this.openedAt = openedAt ?? Date.now();
  }
}

export class MaxRetriesExceededError extends Error {
  readonly attempt: number;
  override readonly cause: Error;

  constructor(message: string, attempt: number, cause: Error) {
    super(message);
    this.name = 'MaxRetriesExceededError';
    this.attempt = attempt;
    this.cause = cause;
  }
}

export class HttpStatusError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body?: string;

  constructor(status: number, statusText: string, body?: string) {
    super(`HTTP ${status} ${statusText}`);
    this.name = 'HttpStatusError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

// ─── Types ───────────────────────────────────────────────

export type ProtocolStatus = 'up' | 'degraded' | 'down';

export interface ProtocolHealth {
  protocol: string;
  reachable: boolean;
  latencyMs: number;
  successRate24h: number;
  rateLimitRemaining: number;
  circuitBreakerOpen: boolean;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastError?: string;
  consecutiveFailures: number;
  checkedAt: number;
}

export interface BridgeHealthReport {
  overall: ProtocolStatus;
  protocols: Record<string, ProtocolHealth>;
  summary: { total: number; up: number; degraded: number; down: number };
  checkedAt: number;
  latencyMs: number;
}

export interface BridgeStats {
  periodStart: number;
  periodEnd: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  successRate: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  byProtocol: Record<string, ProtocolStats>;
  circuitBreakerTrips: number;
}

export interface ProtocolStats {
  totalOps: number;
  successOps: number;
  failedOps: number;
  successRate: number;
  totalLatency: number;
  avgLatencyMs: number;
  circuitBreakerTripped: boolean;
  lastError?: string;
}

export interface CircuitBreakerConfig {
  threshold?: number;
  resetTimeout?: number;
  halfOpenSuccesses?: number;
  kvPrefix?: string;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  timeoutMs?: number;
  nonRetryableStatuses?: Set<number>;
  isRetryable?: (error: unknown) => boolean;
}

export interface ProtocolHealthCheckResult {
  reachable: boolean;
  latencyMs: number;
  error?: string;
}
