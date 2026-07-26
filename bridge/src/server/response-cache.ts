/**
 * Feed Response Cache — Stale-While-Revalidate response cache
 *
 * Caches complete feed responses with TTL.
 * Serves stale cache while fetching fresh data (stale-while-revalidate).
 * Prevents cache stampede with a pending-request deduplication lock.
 * Size-limited to prevent memory exhaustion (SIGABRT #1 cause).
 *
 * Use:
 *   const result = await feedCache.getOrFetch(key, fetchFn, ttlMs)
 *   Returns cached or fresh data, never blocks more than fetchTimeout
 */

import type { UnifiedPost } from './types';

interface CacheEntry {
  /** The cached response data */
  data: CacheData;
  /** When this entry was first stored */
  cachedAt: number;
  /** Next refresh timestamp (cachedAt + ttl) */
  expiresAt: number;
  /** Whether a background refresh is in progress */
  refreshing: boolean;
  /** Promise for in-flight refresh (deduplication) */
  refreshPromise: Promise<CacheData> | null;
}

interface CacheData {
  posts: UnifiedPost[];
  meta: Record<string, unknown>;
}

interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  staleHits: number;
  refreshes: number;
  evictions: number;
}

export class FeedResponseCache {
  private cache = new Map<string, CacheEntry>();
  private maxEntries: number;
  private defaultTTL: number;
  private staleTTL: number;
  private fetchTimeout: number;
  private hits = 0;
  private misses = 0;
  private staleHits = 0;
  private refreshes = 0;
  private evictions = 0;

  constructor(options?: {
    maxEntries?: number;
    defaultTTL?: number;
    staleTTL?: number;
    fetchTimeout?: number;
  }) {
    this.maxEntries = options?.maxEntries ?? 30;
    this.defaultTTL = options?.defaultTTL ?? 30_000; // 30s default TTL
    this.staleTTL = options?.staleTTL ?? 120_000; // 2min max stale age (was 5min)
    this.fetchTimeout = options?.fetchTimeout ?? 8_000; // 8s max fetch time

    // Periodic eviction of expired entries (every 30s)
    setInterval(() => this.evictExpired(), 30_000).unref();

    // Periodic memory reporting (every 60s)
    setInterval(() => this.reportMemory(), 60_000).unref();
  }

  /**
   * Get a cached value, or fetch and cache if missing.
   *
   * Stale-while-revalidate:
   * - If cached and fresh (< TTL): return cached, no refresh
   * - If cached but stale (> TTL but < staleTTL): return cached, trigger background refresh
   * - If cached and expired (> staleTTL): await refresh (or serve stale if refresh fails)
   * - If not cached: await refresh
   *
   * @param key Cache key (usually URL path + query)
   * @param fetchFn Async function to fetch fresh data
   * @param ttlMs Optional custom TTL for this entry
   */
  async getOrFetch(
    key: string,
    fetchFn: () => Promise<CacheData>,
    ttlMs?: number,
  ): Promise<CacheData> {
    const ttl = ttlMs ?? this.defaultTTL;
    const now = Date.now();
    const entry = this.cache.get(key);

    // Case 1: Cache hit and fresh — return immediately
    if (entry && now < entry.expiresAt) {
      this.hits++;
      return entry.data;
    }

    // Case 2: Cache hit but stale — return stale, trigger background refresh
    if (entry && now < entry.cachedAt + this.staleTTL) {
      this.staleHits++;
      this.triggerRefresh(key, entry, fetchFn, ttl);
      return entry.data;
    }

    // Case 3: Cache miss or expired beyond staleTTL — fetch synchronously
    // But first, check if there's already a refresh in progress (dedup)
    if (entry?.refreshPromise) {
      this.staleHits++;
      // Return stale while waiting, or wait for the in-flight refresh
      if (entry.data) {
        return entry.data;
      }
      try {
        return await entry.refreshPromise;
      } catch {
        // Refresh failed, return stale if we have it
        if (entry.data) return entry.data;
        throw new Error('Feed fetch failed and no cache available');
      }
    }

    this.misses++;
    return this.fetchAndCache(key, fetchFn, ttl);
  }

  /**
   * Force evict a specific key from cache.
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Get cache stats for monitoring.
   */
  getStats(): CacheStats {
    return {
      size: this.cache.size,
      maxSize: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      staleHits: this.staleHits,
      refreshes: this.refreshes,
      evictions: this.evictions,
    };
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Fetch fresh data and store in cache.
   */
  private async fetchAndCache(
    key: string,
    fetchFn: () => Promise<CacheData>,
    ttl: number,
  ): Promise<CacheData> {
    const now = Date.now();

    // Enforce max size — evict oldest entry if at capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictOne();
    }

    try {
      const data = await this.fetchWithTimeout(fetchFn);
      this.cache.set(key, {
        data,
        cachedAt: now,
        expiresAt: now + ttl,
        refreshing: false,
        refreshPromise: null,
      });
      return data;
    } catch (err) {
      // If we had a stale entry, return it rather than failing
      const existing = this.cache.get(key);
      if (existing?.data) {
        console.error(`[response-cache] Fetch failed for "${key}", serving stale:`, err);
        return existing.data;
      }
      throw err;
    }
  }

  /**
   * Trigger a background refresh of a stale entry.
   * Uses deduplication — only one refresh per key at a time.
   */
  private triggerRefresh(
    key: string,
    entry: CacheEntry,
    fetchFn: () => Promise<CacheData>,
    ttl: number,
  ): void {
    if (entry.refreshing || entry.refreshPromise) return; // Already refreshing

    entry.refreshing = true;
    entry.refreshPromise = this.fetchWithTimeout(fetchFn)
      .then((data) => {
        const now = Date.now();
        this.refreshes++;
        // Update cache with fresh data
        this.cache.set(key, {
          data,
          cachedAt: now,
          expiresAt: now + ttl,
          refreshing: false,
          refreshPromise: null,
        });
        return data;
      })
      .catch((err) => {
        console.error(`[response-cache] Background refresh failed for "${key}":`, err);
        entry.refreshing = false;
        entry.refreshPromise = null;
        // Keep serving stale data — don't invalidate on refresh failure
        // Return a sentinel to maintain Promise<CacheData> type
        return null as unknown as CacheData;
      });
  }

  /**
   * Fetch with timeout to prevent hanging.
   */
  private async fetchWithTimeout(fetchFn: () => Promise<CacheData>): Promise<CacheData> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.fetchTimeout);

    try {
      const result = await fetchFn();
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Evict expired entries from cache.
   */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      // Remove entries past the stale TTL
      if (now > entry.cachedAt + this.staleTTL && !entry.refreshing) {
        this.cache.delete(key);
        this.evictions++;
      }
    }
  }

  /**
   * Report memory usage to console for monitoring OOM trends.
   */
  private reportMemory(): void {
    const mem = process.memoryUsage();
    const stats = this.getStats();
    console.log(
      `[response-cache] rss=${Math.round(mem.rss / 1024 / 1024)}MB ` +
      `heap=${Math.round(mem.heapUsed / 1024 / 1024)}/${Math.round(mem.heapTotal / 1024 / 1024)}MB ` +
      `entries=${stats.size}/${stats.maxSize} ` +
      `hits=${stats.hits} misses=${stats.misses} stale=${stats.staleHits} evictions=${stats.evictions}`,
    );

    // If heap usage exceeds 1.5GB, suggest a forced GC
    if (mem.heapUsed > 1.5 * 1024 * 1024 * 1024) {
      console.warn('[response-cache] Heap usage >1.5GB, suggesting GC');
      if (typeof global.gc === 'function') {
        global.gc();
        console.log('[response-cache] Forced global.gc() completed');
      }
    }
  }

  /**
   * Evict a single entry (oldest by cachedAt) to make room.
   */
  private evictOne(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.cachedAt < oldestTime && !entry.refreshing) {
        oldestTime = entry.cachedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.evictions++;
    }
  }
}

/**
 * Singleton feed cache instance.
 * maxEntries=30 to prevent memory exhaustion with 210MB peak.
 * defaultTTL=30s — reduced from 45s for fresher content.
 * staleTTL=120s (2min) — reduced from 5min to serve fresher stale content.
 */
export const feedCache = new FeedResponseCache({
  maxEntries: 30,
  defaultTTL: 30_000,
  staleTTL: 120_000,
  fetchTimeout: 8_000,
});
