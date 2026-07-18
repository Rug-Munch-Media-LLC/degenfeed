'use client';

/**
 * Fetch with localStorage cache fallback.
 * On success: stores response in localStorage.
 * On failure: returns cached version if available.
 */

const CACHE_PREFIX = 'df_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable
  }
}

/**
 * Fetch JSON with cache fallback. On success, updates cache. On failure, returns cached data.
 */
export async function fetchWithCache<T>(
  url: string,
  cacheKey: string,
  fetchOptions?: RequestInit,
): Promise<{ data: T; fromCache: boolean }> {
  try {
    const res = await fetch(url, { credentials: 'include', ...fetchOptions });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as T;
    setCache(cacheKey, data);
    return { data, fromCache: false };
  } catch (err) {
    const cached = getCached<T>(cacheKey);
    if (cached) {
      return { data: cached, fromCache: true };
    }
    throw err;
  }
}
