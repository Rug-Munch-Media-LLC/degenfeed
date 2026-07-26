/**
 * news-cache — Caching layer for news aggregation results.
 *
 * Provides a uniform interface over Cloudflare KV for caching
 * aggregation results, source health data, and per-source article counts.
 *
 * Separated from news-aggregator.ts during de-godding.
 */

import type { Env } from '../types';

export interface NewsCache {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export function createNewsCache(env: Env): NewsCache {
  return {
    async get(key: string) {
      return env.CACHE?.get(key) ?? null;
    },
    async put(key: string, value: string, ttl = 300) {
      await env.CACHE?.put(key, value, { expirationTtl: ttl });
    },
    async delete(key: string) {
      await env.CACHE?.delete(key);
    },
  };
}

export function newsCacheKey(...parts: string[]): string {
  return `news:${parts.join(':')}`;
}

export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 86400, // 24 hours
} as const;
