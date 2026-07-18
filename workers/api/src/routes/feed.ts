/**
 * Feed routes — thin orchestrator over the feed pipeline layers.
 *
 * Pipeline: fetch (providers + circuit breakers) → enrich (dedup,
 * spam, mutes, language) → score (ranking v2 + velocity) → cache (KV).
 * Layer implementations live in src/feed/; auxiliary routes (reddit,
 * single provider, health) live in ./feed-misc.
 */

import { parseProtocols } from '@degenfeed/utils';
import {
  PRESET_NAMES,
  presetKvKey,
  resolvePreset,
  type PresetName,
} from '@degenfeed/feed-core';
import {
  applyUserFilters,
  cachedJsonResponse,
  collectProviderResults,
  computeTrending,
  countNewSinceLastVisit,
  DEFAULT_PROTOCOLS,
  enrichNostrEngagement,
  feedCacheKey,
  fetchFromProviders,
  getCachedFeed,
  loadUserRankingContext,
  mergePreferences,
  parseCookiePrefs,
  parsePrefsFromQuery,
  prefersEnglish,
  prepareBasePosts,
  scoreAndRank,
  setCachedFeed,
  writePostsToKV,
} from '../feed';
import { type Env, jsonResponse } from '../index';
import type { StoredPresetEntry } from './presets';

// Backward-compatible re-exports for stream.ts, newsletter.ts, app.ts, and tests.
export { DEFAULT_PROTOCOLS, getProvider } from '../feed';
export { handleFeedHealth, handleProviderFeed, handleRedditFeed } from './feed-misc';

type ExecCtx = { waitUntil: (p: Promise<unknown>) => void };

export async function handleHomeFeed(
  request: Request,
  env: Env,
  execCtx?: ExecCtx,
): Promise<Response> {
  // 1. Parse request
  const params = new URL(request.url).searchParams;
  const requestedProtocols = parseProtocols(params.get('protocols'), DEFAULT_PROTOCOLS);
  const limit = Math.min(Number(params.get('limit')) || 50, 200);
  const category = params.get('category')?.toLowerCase() ?? '';
  const sort = params.get('sort') || 'scored'; // scored | hot | new | top
  const cursor = Number(params.get('cursor')) || 0;
  const direction = params.get('direction') === 'asc' ? 'asc' : 'desc';
  const cookieHeader = request.headers.get('cookie') ?? '';

  // 2. Feed-level cache: skip all provider fetches on a fresh hit.
  const cacheKey = feedCacheKey(requestedProtocols, category, sort);
  if (!cursor) {
    const cached = await getCachedFeed(env, cacheKey);
    if (cached) return jsonResponse(cached);
  }

  // 3. Fetch from providers (circuit breakers + provider cache inside).
  const notices: string[] = [];
  const results = await fetchFromProviders(env, requestedProtocols, limit, notices, execCtx);
  const { posts: allPosts, errors, perProtocol } = collectProviderResults(results);

  // 4. Enrich: dedup + category/type filters, then per-user filters.
  const deduped = prepareBasePosts(allPosts, { category, type: params.get('type') || '' });
  void writePostsToKV(env, deduped);
  const userCtx = await loadUserRankingContext(request, env);
  const allowNonCrypto =
    params.get('allowNonCrypto') === 'true' || userCtx.preferences?.allowNonCrypto === true;
  const relevant = applyUserFilters(deduped, {
    mutedAuthors: userCtx.mutedAuthors,
    mutedWords: userCtx.mutedWords,
    mutedCommunities: userCtx.mutedCommunities,
    blockedCommunities: userCtx.blockedCommunities,
    allowNonCrypto,
    preferEnglish: prefersEnglish(
      params.get('lang') || '',
      request.headers.get('accept-language') || '',
    ),
  });
  await enrichNostrEngagement(relevant);

  // 5a. Resolve quality preset from KV (query param > KV stored > default).
  const presetParam = params.get('preset');
  const protocolsParam = params.get('protocols');
  const activeProtocol = protocolsParam?.split(',')?.filter(Boolean)?.[0] ?? null;
  let presetName: PresetName = 'balanced';
  if (presetParam && (PRESET_NAMES as readonly string[]).includes(presetParam)) {
    presetName = presetParam as PresetName;
  } else if (userCtx.preferences?.presetName) {
    presetName = userCtx.preferences.presetName;
  } else if (activeProtocol) {
    // Try to load per-protocol preset from KV
    try {
      const wallet = request.headers.get('cookie')
        ?.split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('__Host-dfid='))
        ?.slice('__Host-dfid='.length);
      if (wallet && env.CACHE) {
        const { verifySessionCookie } = await import('../session');
        const payload = await verifySessionCookie(wallet, env.AUTH_SECRET ?? '');
        if (payload?.address) {
          const raw = await env.CACHE.get(presetKvKey(payload.address, activeProtocol));
          if (raw) {
            const stored = JSON.parse(raw) as StoredPresetEntry;
            if ((PRESET_NAMES as readonly string[]).includes(stored.presetName)) {
              presetName = stored.presetName as PresetName;
            }
          }
        }
      }
    } catch {
      // Non-critical — default to balanced
    }
  }
  const resolvedPreset = resolvePreset(presetName, activeProtocol ?? undefined);

  // 5b. Score and rank with merged preferences (query > stored > cookie).
  const mergedPrefs = mergePreferences(
    parsePrefsFromQuery(params),
    userCtx.preferences,
    parseCookiePrefs(cookieHeader),
  );
  const queryThreshold = Number(params.get('hideLowQualityThreshold'));
  const showOriginalContent =
    params.get('showOriginalContent') === 'true' ||
    userCtx.preferences?.showOriginalContent === true;
  const minEngagement = Number(params.get('minEngagement')) ||
    (userCtx.preferences?.minEngagement ?? 0);
  const maxPerNiche = Number(params.get('maxPerNiche')) ||
    (userCtx.preferences?.maxPerNiche ?? 5);
  const interleaveProtocols = params.get('interleaveProtocols') !== 'false' &&
    (userCtx.preferences?.interleaveProtocols ?? true);

  const { ranked, topOfHour, nextCursor, debug } = await scoreAndRank(env, relevant, {
    prefs: mergedPrefs,
    followed: userCtx.followed,
    sort,
    diverse: params.get('diverse') !== 'false',
    limit,
    cursor,
    direction,
    hideLowQuality:
      params.get('hideLowQuality') === 'true' || userCtx.preferences?.hideLowQuality === true,
    hideLowQualityThreshold:
      Number.isFinite(queryThreshold) && queryThreshold > 0
        ? queryThreshold
        : (userCtx.preferences?.hideLowQualityThreshold ?? 1.0),
    showOriginalContent,
    minEngagement,
    maxPerNiche,
    interleaveProtocols,
    presetName,
    resolvedPreset,
  });
  const trending = await computeTrending(relevant, Number(params.get('trending')) || 24);

  if (ranked.length === 0 && errors.length > 0) {
    return jsonResponse(
      {
        data: [],
        meta: {
          total: 0,
          limit,
          perProtocol,
          errors,
          notices,
          fetchedAt: Date.now(),
          note:
            relevant.length === 0 ? 'No relevant posts found' : 'All sources failed or filtered',
        },
      },
      200,
    );
  }

  // 6. Respond and cache.
  const responseBody = {
    data: ranked,
    meta: {
      total: ranked.length,
      limit,
      perProtocol,
      errors: errors.length > 0 ? errors : undefined,
      notices: notices.length > 0 ? notices : undefined,
      trending,
      topOfHour,
      nextCursor,
      sort,
      presetName,
      presetLabel: resolvedPreset.profile.label,
      newSinceLastVisit: countNewSinceLastVisit(cookieHeader, ranked),
      fetchedAt: Date.now(),
    },
  };
  if (!cursor) await setCachedFeed(env, cacheKey, responseBody);
  const resp = cachedJsonResponse(responseBody);
  resp.headers.set(
    'X-DegenFeed-Debug',
    `spam=${debug.avgSpam.toFixed(2)},quality=${debug.avgQuality.toFixed(0)},reputation=${debug.avgReputation.toFixed(0)},velocity=${debug.avgVelocity.toFixed(0)}`,
  );
  return resp;
}

export async function handleTrendingFeed(
  request: Request,
  env: Env,
  execCtx?: ExecCtx,
): Promise<Response> {
  const url = new URL(request.url);
  url.searchParams.set('protocols', DEFAULT_PROTOCOLS.join(','));
  return handleHomeFeed(new Request(url.toString()), env, execCtx);
}

export async function handleCategoryFeed(
  request: Request,
  env: Env,
  category: string,
  execCtx?: ExecCtx,
): Promise<Response> {
  const url = new URL(request.url);
  url.searchParams.set('category', category);
  return handleHomeFeed(new Request(url.toString()), env, execCtx);
}
