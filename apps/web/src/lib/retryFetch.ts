'use client';

/**
 * Fetch with automatic retries + exponential backoff.
 * Retries on network errors, 408, 429, and 5xx responses.
 * Stops on 4xx (except 408/429) and redirects.
 */
export interface RetryOptions {
  /** Max retry attempts (default 3) */
  maxRetries?: number;
  /** Base delay in ms (default 300). Doubles each retry with jitter. */
  baseDelayMs?: number;
  /** Max total delay in ms (default 10_000) */
  maxDelayMs?: number;
  /** Additional fetch options */
  fetchOptions?: RequestInit;
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export async function retryFetch(
  url: string,
  options: RetryOptions = {},
): Promise<Response> {
  const { maxRetries = 3, baseDelayMs = 300, maxDelayMs = 10_000, fetchOptions } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      const res = await fetch(url, {
        credentials: 'include',
        ...fetchOptions,
        signal: fetchOptions?.signal ?? controller.signal,
      });

      clearTimeout(timeoutId);

      // Non-retryable status codes
      if (res.ok) return res;
      if (!RETRYABLE_STATUS.has(res.status) && res.status < 500) return res;

      // Retryable — fall through to retry logic
      lastError = new Error(`HTTP ${res.status} ${res.statusText}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new Error('Request timed out');
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
      // Network error — retry
    }

    if (attempt < maxRetries) {
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * baseDelayMs,
        maxDelayMs,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Request failed after retries');
}

/**
 * Convenience wrapper for JSON requests with retry.
 */
export async function retryFetchJson<T>(
  url: string,
  options: RetryOptions = {},
): Promise<T> {
  const res = await retryFetch(url, {
    ...options,
    fetchOptions: {
      ...options.fetchOptions,
      headers: {
        'content-type': 'application/json',
        ...options.fetchOptions?.headers,
      },
    },
  });
  return res.json() as Promise<T>;
}
