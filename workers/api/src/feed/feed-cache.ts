/**
 * feed-cache — KV read/write abstraction for the feed pipeline.
 *
 * Owns cache key generation, the feed-level response cache
 * (stale-while-revalidate: fresh hits are served, stale entries are
 * refetched), per-provider result caching, the post KV store for O(1)
 * ID lookups, provider health caching, and per-user ranking context
 * (follows, mutes, preferences) loaded via the session cookie.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { Env } from '../types';

export const CACHE_PROVIDER_TTL = 120;
export const FEED_CACHE_TTL = 45;
export const FEED_CACHE_FRESH_MS = 30_000;

// ─── Generic KV JSON helpers ───────────────────────────────────────

export async function readJsonCache<T>(env: Env, key: string, label: string): Promise<T | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[feed] ${label} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function writeJsonCache(
  env: Env,
  key: string,
  value: unknown,
  ttl: number,
  label: string,
): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(key, JSON.stringify(value), { expirationTtl: ttl });
  } catch (err) {
    // Non-critical cache write — log and continue
    console.warn(`[feed] ${label} failed:`, err instanceof Error ? err.message : err);
  }
}

// ─── Feed-level response cache ─────────────────────────────────────
// Skips all provider fetches when a fresh result exists. Entries
// older than FEED_CACHE_FRESH_MS are treated as stale and refetched.

export interface CachedFeedResponse {
  data: unknown;
  meta: Record<string, unknown>;
}

export function feedCacheKey(protocols: Protocol[], category: string, sort: string): string {
  return `feed:v1:${protocols.join(',')}:${category}:${sort}`;
}

export async function getCachedFeed(env: Env, key: string): Promise<CachedFeedResponse | null> {
  const cached = await readJsonCache<CachedFeedResponse>(env, key, 'feed cache read');
  if (!cached) return null;
  if (Date.now() - (cached.meta.fetchedAt as number) < FEED_CACHE_FRESH_MS) {
    return { data: cached.data, meta: cached.meta };
  }
  return null;
}

export async function setCachedFeed(
  env: Env,
  key: string,
  data: unknown,
  ttl = FEED_CACHE_TTL,
): Promise<void> {
  await writeJsonCache(env, key, data, ttl, 'feed cache write');
}

/**
 * JSON response with edge cache headers (s-maxage +
 * stale-while-revalidate) and a weak length-based etag.
 */
export function cachedJsonResponse(data: unknown, status = 200, maxAge = 30): Response {
  const body = JSON.stringify(data);
  const hash = String(body.length);
  return new Response(body, {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
      etag: `"${hash}"`,
      vary: 'Accept-Language',
    },
  });
}

// ─── Per-provider KV cache (stale-while-revalidate) ────────────────
// Caches provider results in KV with CACHE_PROVIDER_TTL expiry.
// On cache hit the response is returned immediately and a background
// refresh is triggered so subsequent requests see fresh data.

export function providerCacheKey(protocol: string, limit: number): string {
  return `feed:provider:${protocol}:l=${limit}`;
}

export async function readProviderCache(
  env: Env,
  protocol: string,
  limit: number,
): Promise<UnifiedPost[] | null> {
  const cached = await readJsonCache<{
    posts: UnifiedPost[];
    fetchedAt: number;
  }>(env, providerCacheKey(protocol, limit), 'readProviderCache');
  return cached?.posts ?? null;
}

export async function writeProviderCache(
  env: Env,
  protocol: string,
  limit: number,
  posts: UnifiedPost[],
): Promise<void> {
  if (posts.length === 0) return;
  await writeJsonCache(
    env,
    providerCacheKey(protocol, limit),
    { posts, fetchedAt: Date.now() },
    CACHE_PROVIDER_TTL,
    'writeProviderCache',
  );
}

// ─── Post KV store ─────────────────────────────────────────────────
// After dedup, every post is written to KV for O(1) ID lookups.

export async function writePostsToKV(env: Env, posts: UnifiedPost[]): Promise<void> {
  if (!env.CACHE || posts.length === 0) return;
  try {
    const puts = posts.slice(0, 100).map((p) =>
      env.CACHE?.put(`post:${p.id}`, JSON.stringify(p), {
        expirationTtl: 3600,
      }).catch(() => {}),
    );
    await Promise.allSettled(puts);
  } catch (err) {
    // Non-critical cache write — log and continue
    console.warn('[feed] writePostsToKV failed:', err instanceof Error ? err.message : err);
  }
}

// ─── Provider health cache ─────────────────────────────────────────

export interface CachedHealth {
  health: Record<string, unknown>;
  checkedAt: number;
}

export async function readCachedHealth(env: Env, key: string): Promise<CachedHealth | null> {
  const parsed = await readJsonCache<CachedHealth>(env, key, 'readCachedHealth');
  if (!parsed) return null;
  // 30s stale-while-revalidate: return cached data if it's within the window.
  if (Date.now() - parsed.checkedAt < 30_000) return parsed;
  return null;
}

export async function writeCachedHealth(env: Env, key: string, body: CachedHealth): Promise<void> {
  await writeJsonCache(env, key, body, 60, 'writeCachedHealth');
}

// ─── Per-user ranking context ──────────────────────────────────────
// Loads followed authors, mutes, and stored algorithm preferences
// from KV via the session cookie. Unauthenticated users get an
// empty context.

import type { PresetName } from '@degenfeed/feed-core';

export interface StoredUserPreferences {
  preferredNiches: string[];
  preferredPlatforms: Protocol[];
  recencyWeight: number;
  engagementWeight: number;
  diversityBoost: boolean;
  hideLowQuality?: boolean;
  hideLowQualityThreshold?: number;
  allowNonCrypto?: boolean;
  // ── New quality filters ────────────────────────────────────────
  /** Show only original content (filter reposts & link-only). */
  showOriginalContent?: boolean;
  /** Minimum total engagement to show a post. */
  minEngagement?: number;
  /** Max posts per niche per page. */
  maxPerNiche?: number;
  /** Whether to interleave protocols. */
  interleaveProtocols?: boolean;
  /** Active quality preset name. */
  presetName?: PresetName;
}

export interface UserRankingContext {
  followed: Set<string>;
  mutedAuthors: Set<string>;
  mutedWords: Set<string>;
  mutedCommunities: Set<string>;
  blockedCommunities: Set<string>;
  preferences: StoredUserPreferences | null;
}

export async function loadUserRankingContext(
  request: Request,
  env: Env,
): Promise<UserRankingContext> {
  const empty: UserRankingContext = {
    followed: new Set(),
    mutedAuthors: new Set(),
    mutedWords: new Set(),
    mutedCommunities: new Set(),
    blockedCommunities: new Set(),
    preferences: null,
  };
  const cookie = request.headers.get('cookie');
  if (!cookie) return empty;
  // Parse session cookie
  const match = cookie
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('__Host-dfid='));
  if (!match) return empty;
  const value = match.slice('__Host-dfid='.length);
  // Verify session
  if (!env.AUTH_SECRET) return empty;
  const { verifySessionCookie } = await import('../session');
  const payload = await verifySessionCookie(value, env.AUTH_SECRET);
  if (!payload) return empty;
  // Load user-specific KV entries
  try {
    const [
      followsRaw,
      mutedAuthorsRaw,
      mutedWordsRaw,
      mutedCommunitiesRaw,
      blockedCommunitiesRaw,
      prefsRaw,
    ] = await Promise.all([
      env.CACHE?.get(`user:follows:${payload.address}`),
      env.CACHE?.get(`user:muted_authors:${payload.address}`),
      env.CACHE?.get(`user:muted_words:${payload.address}`),
      env.CACHE?.get(`user:muted_communities:${payload.address}`),
      env.CACHE?.get(`user:blocked_communities:${payload.address}`),
      env.CACHE?.get(`user:prefs:${payload.address}`),
    ]);
    const followed = new Set<string>(followsRaw ? JSON.parse(followsRaw) : []);
    const mutedAuthors = new Set<string>(mutedAuthorsRaw ? JSON.parse(mutedAuthorsRaw) : []);
    const mutedWords = new Set<string>(mutedWordsRaw ? JSON.parse(mutedWordsRaw) : []);
    const mutedCommunities = new Set<string>(
      mutedCommunitiesRaw ? JSON.parse(mutedCommunitiesRaw) : [],
    );
    const blockedCommunities = new Set<string>(
      blockedCommunitiesRaw ? JSON.parse(blockedCommunitiesRaw) : [],
    );
    const preferences = prefsRaw ? (JSON.parse(prefsRaw) as StoredUserPreferences) : null;
    if (preferences && typeof preferences.hideLowQuality !== 'boolean') {
      preferences.hideLowQuality = false;
    }
    if (preferences && typeof preferences.allowNonCrypto !== 'boolean') {
      preferences.allowNonCrypto = false;
    }
    if (preferences && typeof preferences.hideLowQualityThreshold !== 'number') {
      preferences.hideLowQualityThreshold = 1.0;
    }
    // Ensure new quality filters have defaults
    if (preferences && typeof preferences.showOriginalContent !== 'boolean') {
      preferences.showOriginalContent = false;
    }
    if (preferences && typeof preferences.minEngagement !== 'number') {
      preferences.minEngagement = 0;
    }
    if (preferences && typeof preferences.maxPerNiche !== 'number') {
      preferences.maxPerNiche = 5;
    }
    if (preferences && typeof preferences.interleaveProtocols !== 'boolean') {
      preferences.interleaveProtocols = true;
    }
    return {
      followed,
      mutedAuthors,
      mutedWords,
      mutedCommunities,
      blockedCommunities,
      preferences,
    };
  } catch (err) {
    console.warn('[feed] loadUserRankingContext failed:', err instanceof Error ? err.message : err);
    return empty;
  }
}
