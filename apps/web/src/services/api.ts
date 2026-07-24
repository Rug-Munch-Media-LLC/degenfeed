/**
 * @degenfeed/web — Centralized API Client
 *
 * Single entry point for all HTTP calls. Wraps retryFetch with:
 * - Consistent error handling (always returns ApiResponse shape)
 * - CSRF token attachment (delegated to retryFetch)
 * - Type-safe response parsing
 * - Request deduplication for concurrent calls
 */

import { retryFetch, retryFetchJson } from '../lib/retryFetch';
import type { ApiResponse, AsyncState, LoadingState } from '../types/api';

// ─── Request Deduplication ────────────────────────────────────

const inflightRequests = new Map<string, Promise<Response>>();

function dedupKey(url: string, init?: RequestInit): string {
  return `${init?.method ?? 'GET'}:${url}:${JSON.stringify(init?.body ?? null)}`;
}

// ─── Base Fetch with Dedup ────────────────────────────────────

/**
 * Fetch with deduplication — concurrent calls to the same endpoint
 * share one request. Only deduplicates GET requests.
 */
async function dedupedFetch(url: string, init?: RequestInit): Promise<Response> {
  const key = dedupKey(url, init);
  const isGet = !init?.method || init.method === 'GET';

  if (isGet && inflightRequests.has(key)) {
    const pending = inflightRequests.get(key) as Promise<Response> | undefined;
    if (pending) return pending.then((r) => r.clone());
  }

  const promise = retryFetch(url, { fetchOptions: init });
  if (isGet) {
    inflightRequests.set(key, promise);
    promise.finally(() => inflightRequests.delete(key));
  }
  return promise;
}

// ─── Typed Response Handler ───────────────────────────────────

/**
 * Parse an API response into the standard ApiResponse<T> shape.
 * Handles JSON parse failures, network errors, and non-2xx responses.
 */
async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  if (!response.ok) {
    let body: string | undefined;
    try {
      body = await response.text();
      const parsed = JSON.parse(body);
      return {
        success: false,
        error: parsed.error ?? parsed.message ?? `HTTP ${response.status}`,
        errors: parsed.errors,
      };
    } catch {
      return { success: false, error: body ?? `HTTP ${response.status} ${response.statusText}` };
    }
  }

  try {
    const data = (await response.json()) as T;
    // If the API already returns an ApiResponse envelope, pass through
    if (
      data !== null &&
      typeof data === 'object' &&
      'success' in (data as Record<string, unknown>)
    ) {
      return data as unknown as ApiResponse<T>;
    }
    return { success: true, data };
  } catch (_err) {
    return { success: false, error: 'Failed to parse response JSON' };
  }
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Main API client. All services use this.
 *
 * @example
 * ```ts
 * const { data, error } = await api.get<Post[]>('/api/feed/home');
 * if (error) { ... }
 * ```
 */
export const api = {
  /** GET request */
  async get<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
    const res = await dedupedFetch(url, { method: 'GET', ...init });
    return handleResponse<T>(res);
  },

  /** POST request */
  async post<T>(url: string, body?: unknown, init?: RequestInit): Promise<ApiResponse<T>> {
    const res = await dedupedFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    });
    return handleResponse<T>(res);
  },

  /** PUT request */
  async put<T>(url: string, body?: unknown, init?: RequestInit): Promise<ApiResponse<T>> {
    const res = await dedupedFetch(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    });
    return handleResponse<T>(res);
  },

  /** DELETE request */
  async del<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
    const res = await dedupedFetch(url, { method: 'DELETE', ...init });
    return handleResponse<T>(res);
  },

  /**
   * Create an async state container.
   * Useful for components that manage their own loading state.
   */
  createAsyncState<T>(initial: LoadingState = 'idle'): AsyncState<T> {
    return { data: null, state: initial, error: null };
  },
};

/** Shortcut: parse a response body as JSON (for non-standard endpoints) */
export const parseJson = retryFetchJson;

export type { ApiResponse, AsyncState, LoadingState };
