'use client';

/**
 * Fetch with localStorage cache fallback + stale-while-revalidate (SWR).
 * On success: stores response in localStorage.
 * On failure or slow network: returns cached version immediately while fetching fresh data in background.
 */

const CACHE_PREFIX = 'df_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes — fresh period
const STALE_TTL = 30 * 60 * 1000; // 30 minutes — stale-while-revalidate window

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface SwrResult<T> {
  data: T;
  fromCache: boolean;
  stale: boolean;
}

const pendingRefetches = new Map<string, Promise<unknown>>();

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.timestamp > STALE_TTL) {
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

function isFresh<T>(key: string): boolean {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return false;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    return Date.now() - entry.timestamp <= CACHE_TTL;
  } catch {
    return false;
  }
}

/**
 * Fetch JSON with stale-while-revalidate (SWR) semantics.
 *
 * 1. If a fresh cache entry exists, return it immediately + background-refetch.
 * 2. If a stale cache entry exists, return it immediately + background-refetch.
 * 3. If no cache, fetch from network.
 *
 * Background refetches are deduplicated per cacheKey.
 */
export async function fetchWithSwr<T>(
  url: string,
  cacheKey: string,
  fetchOptions?: RequestInit,
): Promise<SwrResult<T>> {
  // Check for fresh cached data first
  if (isFresh<T>(cacheKey)) {
    const cached = getCached<T>(cacheKey);
    if (cached) {
      // Fire background revalidation (don't await)
      revalidateInBackground(url, cacheKey, fetchOptions);
      return { data: cached, fromCache: true, stale: false };
    }
  }

  // Check for stale cached data
  const stale = getCached<T>(cacheKey);
  if (stale) {
    // Return stale immediately, revalidate in background
    revalidateInBackground(url, cacheKey, fetchOptions);
    return { data: stale, fromCache: true, stale: true };
  }
  const res = await fetch(url, { credentials: 'include', ...fetchOptions });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as T;
  setCache(cacheKey, data);
  return { data, fromCache: false, stale: false };
}

function revalidateInBackground<T>(
  url: string,
  cacheKey: string,
  fetchOptions?: RequestInit,
): void {
  // Deduplicate concurrent background refetches
  if (pendingRefetches.has(cacheKey)) return;

  const promise = fetch(url, { credentials: 'include', ...fetchOptions })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<T>;
    })
    .then((data) => {
      setCache(cacheKey, data);
    })
    .catch(() => {
      // Silently ignore background revalidation errors
    })
    .finally(() => {
      pendingRefetches.delete(cacheKey);
    });

  pendingRefetches.set(cacheKey, promise);
}

/**
 * Fetch JSON with cache fallback (legacy API). On success, updates cache. On failure, returns cached data.
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
