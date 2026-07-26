/**
 * @degenfeed/api-worker — Retry with Exponential Backoff
 *
 * Transient error recovery for bridge operations.
 */

import type { RetryOptions } from './bridge-reliability-types';
import {
  CircuitBreakerOpenError,
  HttpStatusError,
  MaxRetriesExceededError,
} from './bridge-reliability-types';

const DEFAULT_RETRY: Required<Omit<RetryOptions, 'isRetryable'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30_000,
  timeoutMs: 15_000,
  nonRetryableStatuses: new Set([400, 401, 403, 404, 409]),
};

const RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponential = Math.min(maxDelay, baseDelay * 2 ** attempt);
  return Math.random() * exponential;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_RETRY.maxRetries;
  const baseDelay = options?.baseDelay ?? DEFAULT_RETRY.baseDelay;
  const maxDelay = options?.maxDelay ?? DEFAULT_RETRY.maxDelay;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_RETRY.timeoutMs;
  const nonRetryableStatuses = options?.nonRetryableStatuses ?? DEFAULT_RETRY.nonRetryableStatuses;
  const isRetryable = options?.isRetryable;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await executeWithTimeout(operation, timeoutMs);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError instanceof CircuitBreakerOpenError) throw lastError;
      if (!isErrorRetryable(error, nonRetryableStatuses, isRetryable)) throw lastError;
      if (attempt >= maxRetries) {
        throw new MaxRetriesExceededError(
          `Operation failed after ${maxRetries + 1} attempts: ${lastError.message}`,
          attempt,
          lastError,
        );
      }
      const delay = calculateBackoff(attempt, baseDelay, maxDelay);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Unknown retry error');
}

async function executeWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isErrorRetryable(
  error: unknown,
  nonRetryableStatuses: Set<number>,
  customCheck?: (error: unknown) => boolean,
): boolean {
  if (customCheck) return customCheck(error);
  if (error instanceof TypeError && error.message.includes('fetch')) return true;
  if (error instanceof HttpStatusError) {
    if (nonRetryableStatuses.has(error.status)) return false;
    return RETRYABLE_STATUSES.includes(error.status);
  }
  if (error instanceof Error && error.message.includes('timed out')) return true;
  return true;
}
