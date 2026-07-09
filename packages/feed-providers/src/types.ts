import type { Protocol, UnifiedPost } from '@degenfeed/types';

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

export interface FeedProvider {
  readonly protocol: Protocol;
  fetchFeed(opts?: FetchOptions): Promise<FeedResult>;
  healthCheck?(opts?: FetchOptions): Promise<HealthResult>;
}
