import type { Protocol, UnifiedPost } from '@degenfeed/types';

/**
 * Schema guard function — validates external API responses at runtime.
 * Every provider should define a guard for its raw API response shape
 * so breaking API changes produce loud errors, not silent feed outages.
 */
export type SchemaGuard = (data: unknown) => boolean;

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  concurrency?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface FeedResult {
  posts: UnifiedPost[];
  notice?: string;
  nextCursor?: string;
}

export interface HealthResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Standardized provider interface.
 *
 * Every provider MUST define `schema` for runtime response validation.
 * The `fetch()` / `transform()` split is OPTIONAL for backward compat
 * but RECOMMENDED for new providers — they enable better error tracking
 * and make the data pipeline explicit.
 *
 * Pattern:
 *   schema  → runtime guard for raw API responses
 *   fetch() → raw data from external API
 *   transform() → convert raw data into UnifiedPost[]
 *   fetchFeed() → convenience that chains fetch() + transform() [existing pattern]
 */
export interface FeedProvider {
  readonly protocol: Protocol;
  /** Runtime schema guard for the provider's raw API response */
  readonly schema: SchemaGuard;
  /** Fetch raw data from the external API (optional — use fetchFeed if preferred) */
  fetch?(opts?: FetchOptions): Promise<unknown>;
  /** Transform raw API data into unified posts (optional — use fetchFeed if preferred) */
  transform?(raw: unknown, opts?: FetchOptions): UnifiedPost[];
  /** Combined fetch + transform (legacy pattern, still the primary API) */
  fetchFeed(opts?: FetchOptions): Promise<FeedResult>;
  healthCheck?(opts?: FetchOptions): Promise<HealthResult>;
}
