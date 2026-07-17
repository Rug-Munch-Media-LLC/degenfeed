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
    allowNonCrypto,
    preferEnglish: prefersEnglish(
      params.get('lang') || '',
      request.headers.get('accept-language') || '',
    ),
  });
  await enrichNostrEngagement(relevant);

  // 5. Score and rank with merged preferences (query > stored > cookie).
  const mergedPrefs = mergePreferences(
    parsePrefsFromQuery(params),
    userCtx.preferences,
    parseCookiePrefs(cookieHeader),
  );
  const queryThreshold = Number(params.get('hideLowQualityThreshold'));
  const { ranked, topOfHour, nextCursor } = await scoreAndRank(env, relevant, {
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
      newSinceLastVisit: countNewSinceLastVisit(cookieHeader, ranked),
      fetchedAt: Date.now(),
    },
  };
  if (!cursor) await setCachedFeed(env, cacheKey, responseBody);
  return cachedJsonResponse(responseBody);
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
