/**
 * @degenfeed/api-worker — Unified Reliability Wrapper
 *
 * Chains circuit breaker → retry → execution for bridge operations.
 */

import type { Env } from '../types';
import { getCircuitBreaker } from './bridge-reliability-circuit';
import { withRetry } from './bridge-reliability-retry';
import type { CircuitBreakerConfig, RetryOptions } from './bridge-reliability-types';
import { HttpStatusError } from './bridge-reliability-types';

export async function withReliability<T>(
  protocol: string,
  operation: () => Promise<T>,
  options?: {
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerConfig;
    env?: Env;
  },
): Promise<T> {
  const cb = getCircuitBreaker(options?.env);
  return cb.execute(
    protocol,
    async () => withRetry(operation, options?.retry),
    options?.circuitBreaker,
  );
}

export async function expectOk(response: Response, context?: string): Promise<unknown> {
  if (response.ok) {
    return response.json().catch(() => null);
  }
  const body = await response.text().catch(() => '');
  const msg = context ? `${context}: ` : '';
  throw new HttpStatusError(
    response.status,
    response.statusText,
    `${msg}HTTP ${response.status} ${response.statusText} — ${body.slice(0, 500)}`,
  );
}
