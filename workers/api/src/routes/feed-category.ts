/**
 * feed-category routes — Category-based feed delivery, mix blending,
 * per-protocol category, and the "Everything" blend.
 *
 * Routes:
 *   GET /api/feed/category/[slug]
 *   GET /api/feed/mix
 *   GET /api/feed/per-protocol/[protocol]/[category]
 *   GET /api/feed/everything
 */

import type { Protocol } from '@degenfeed/types';
import { parseProtocols } from '@degenfeed/utils';
import {
  applyUserFilters,
  buildCategoryFeed,
  buildCategoryMix,
  buildEverythingBlend,
  buildPerProtocolCategoryFeed,
  CATEGORIES,
  CATEGORY_SLUGS,
  collectProviderResults,
  computeAllAuthorStats,
  computeFreshnessMeta,
  computeTrending,
  deduplicateCrossProtocol,
  DEFAULT_PROTOCOLS,
  enrichNostrEngagement,
  FEED_GENERATION_TIMEOUT_MS,
  fetchFromProviders,
  getFeedCache,
  loadUserRankingContext,
  predictEngagementBoost,
  prefersEnglish,
  prepareBasePosts,
  ProviderTimer,
  setFeedCache,
  updateFeedFreshness,
  writePostsToKV,
} from '../feed';
import type { Env } from '../index';
import { jsonResponse } from '../index';

type ExecCtx = { waitUntil: (p: Promise<unknown>) => void };

// ─── GET /api/feed/category/[slug] ────────────────────────────────────

export async function handleCategorySlugFeed(
  request: Request,
  env: Env,
  slug: string,
  execCtx?: ExecCtx,
): Promise<Response> {
  const categorySlug = slug.toLowerCase();
  if (!CATEGORY_SLUGS.has(categorySlug)) {
    return jsonResponse(
      {
        error: `Unknown category: "${slug}". Valid categories: ${Array.from(CATEGORY_SLUGS).join(', ')}`,
      },
      400,
    );
  }

  const params = new URL(request.url).searchParams;
  const requestedProtocols = parseProtocols(params.get('protocols'), DEFAULT_PROTOCOLS);
  const limit = Math.min(Number(params.get('limit')) || 50, 200);
  const minScore = Number(params.get('minScore')) || 0.15;
  const cookieHeader = request.headers.get('cookie') ?? '';

  const feedStartTime = Date.now();

  // 1. Load user context
  const userCtx = await loadUserRankingContext(request, env);

  // 2. Fetch from all providers
  const notices: string[] = [];
  const timer = new ProviderTimer();
  const fetchResults = await Promise.race([
    fetchFromProviders(env, requestedProtocols, limit, notices, execCtx, timer),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`feed generation timeout after ${FEED_GENERATION_TIMEOUT_MS}ms`)),
        FEED_GENERATION_TIMEOUT_MS,
      ),
    ),
  ]).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : 'feed generation timed out';
    notices.push(msg);
    console.warn('[category]', msg);
    return [] as Awaited<ReturnType<typeof fetchFromProviders>>;
  });
  const { posts: allPosts, errors, perProtocol } = collectProviderResults(fetchResults);

  // 3. Enrich
  const deduped = prepareBasePosts(allPosts, {});
  void writePostsToKV(env, deduped);
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

  // 4. Build category feed with quality scoring
  const feed = buildCategoryFeed(relevant, {
    category: categorySlug as Parameters<typeof buildCategoryFeed>[1]['category'],
    minScore,
    maxPerAuthor: 3,
    maxPerProtocol: 10,
    limit,
  });

  const categoryDef = CATEGORIES[categorySlug as keyof typeof CATEGORIES];

  const elapsed = Date.now() - feedStartTime;

  return jsonResponse({
    data: feed.posts,
    meta: {
      total: feed.posts.length,
      limit,
      category: { slug: categorySlug, label: categoryDef.label, emoji: categoryDef.emoji },
      perProtocol,
      errors: errors.length > 0 ? errors : undefined,
      notices: notices.length > 0 ? notices : undefined,
      fetchedAt: Date.now(),
      categoryMeta: feed.meta,
      feedGenerationMs: elapsed,
    },
  });
}

// ─── GET /api/feed/mix ───────────────────────────────────────────────

export async function handleCategoryMixFeed(
  request: Request,
  env: Env,
  execCtx?: ExecCtx,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const rawCategories = params.get('categories') ?? '';
  const rawRatios = params.get('ratio') ?? '';
  const requestedProtocols = parseProtocols(params.get('protocols'), DEFAULT_PROTOCOLS);
  const limit = Math.min(Number(params.get('limit')) || 50, 200);
  const minScore = Number(params.get('minScore')) || 0.15;
  const cookieHeader = request.headers.get('cookie') ?? '';

  // Parse categories and ratios
  const catList = rawCategories.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const ratioList = rawRatios
    ? rawRatios.split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : [];

  // Validate categories
  const validCats: string[] = [];
  for (const c of catList) {
    if (CATEGORY_SLUGS.has(c)) validCats.push(c);
  }
  if (validCats.length === 0) {
    return jsonResponse(
      {
        error: 'categories required. Valid: defi,nft,trading,ai,memecoin,security,news,memes',
      },
      400,
    );
  }

  // Build category:weight record
  const categoryWeights: Record<string, number> = {};
  if (ratioList.length === validCats.length) {
    for (let i = 0; i < validCats.length; i++) {
      const cat = validCats[i] as string;
      const ratio = ratioList[i] as number;
      categoryWeights[cat] = ratio;
    }
  } else {
    // Equal weights by default
    for (const cat of validCats) {
      categoryWeights[cat] = 1;
    }
  }

  // 1. Fetch from all providers
  const feedStartTime = Date.now();
  const userCtx = await loadUserRankingContext(request, env);

  const notices: string[] = [];
  const timer = new ProviderTimer();
  const fetchResults = await Promise.race([
    fetchFromProviders(env, requestedProtocols, limit * 2, notices, execCtx, timer),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`feed generation timeout after ${FEED_GENERATION_TIMEOUT_MS}ms`)),
        FEED_GENERATION_TIMEOUT_MS,
      ),
    ),
  ]).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : 'feed generation timed out';
    notices.push(msg);
    console.warn('[mix]', msg);
    return [] as Awaited<ReturnType<typeof fetchFromProviders>>;
  });
  const { posts: allPosts, errors, perProtocol } = collectProviderResults(fetchResults);

  // 2. Enrich
  const deduped = prepareBasePosts(allPosts, {});
  void writePostsToKV(env, deduped);
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

  // 3. Build mix
  const mix = buildCategoryMix(relevant, {
    categories: categoryWeights as Parameters<typeof buildCategoryMix>[1]['categories'],
    minScore,
    limit,
  });

  const elapsed = Date.now() - feedStartTime;

  return jsonResponse({
    data: mix.posts,
    meta: {
      total: mix.posts.length,
      limit,
      mix: validCats.join(','),
      ratios: categoryWeights,
      perProtocol,
      errors: errors.length > 0 ? errors : undefined,
      notices: notices.length > 0 ? notices : undefined,
      fetchedAt: Date.now(),
      mixMeta: mix.meta,
      feedGenerationMs: elapsed,
    },
  });
}

// ─── GET /api/feed/per-protocol/[protocol]/[category] ─────────────────

export async function handlePerProtocolCategoryFeed(
  request: Request,
  env: Env,
  protocol: string,
  category: string,
  execCtx?: ExecCtx,
): Promise<Response> {
  const categorySlug = category.toLowerCase();
  if (!CATEGORY_SLUGS.has(categorySlug)) {
    return jsonResponse(
      {
        error: `Unknown category: "${category}". Valid: ${Array.from(CATEGORY_SLUGS).join(', ')}`,
      },
      400,
    );
  }

  const validProtocols = new Set<Protocol>(DEFAULT_PROTOCOLS);
  if (!validProtocols.has(protocol as Protocol)) {
    return jsonResponse(
      {
        error: `Unknown protocol: "${protocol}". Valid: ${DEFAULT_PROTOCOLS.join(', ')}`,
      },
      400,
    );
  }

  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 50, 200);
  const cookieHeader = request.headers.get('cookie') ?? '';

  const feedStartTime = Date.now();

  // 1. Fetch from the single protocol
  const userCtx = await loadUserRankingContext(request, env);
  const notices: string[] = [];
  const timer = new ProviderTimer();
  const fetchResults = await Promise.race([
    fetchFromProviders(env, [protocol as Protocol], limit, notices, execCtx, timer),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`feed generation timeout after ${FEED_GENERATION_TIMEOUT_MS}ms`)),
        FEED_GENERATION_TIMEOUT_MS,
      ),
    ),
  ]).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : 'feed generation timed out';
    notices.push(msg);
    console.warn('[per-protocol]', msg);
    return [] as Awaited<ReturnType<typeof fetchFromProviders>>;
  });
  const { posts: allPosts, errors, perProtocol } = collectProviderResults(fetchResults);

  // 2. Enrich
  const deduped = prepareBasePosts(allPosts, {});
  void writePostsToKV(env, deduped);
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

  // 3. Build per-protocol per-category feed
  const feed = buildPerProtocolCategoryFeed(relevant, {
    protocol: protocol as Protocol,
    category: categorySlug as Parameters<typeof buildPerProtocolCategoryFeed>[1]['category'],
    limit,
  });

  const categoryDef = CATEGORIES[categorySlug as keyof typeof CATEGORIES];

  const elapsed = Date.now() - feedStartTime;

  return jsonResponse({
    data: feed.posts,
    meta: {
      total: feed.posts.length,
      limit,
      protocol,
      category: { slug: categorySlug, label: categoryDef.label, emoji: categoryDef.emoji },
      perProtocol,
      errors: errors.length > 0 ? errors : undefined,
      notices: notices.length > 0 ? notices : undefined,
      fetchedAt: Date.now(),
      categoryMeta: feed.meta,
      feedGenerationMs: elapsed,
    },
  });
}

// ─── GET /api/feed/everything — Smart blended feed ────────────────────

export async function handleEverythingFeed(
  request: Request,
  env: Env,
  execCtx?: ExecCtx,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const now = Date.now();

  // SWR cache: serve stale immediately
  if (!params.get('cursor')) {
    const cacheResult = await getFeedCache(env, null, 'everything');
    if (cacheResult.type === 'hit' && cacheResult.entry) {
      const resp = new Response(JSON.stringify(cacheResult.entry), {
        headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=45, stale-while-revalidate=90' },
      });
      resp.headers.set('X-DegenFeed-Debug', `cache=hit,feed-generation=0.001s`);
      return resp;
    }
    if (cacheResult.type === 'stale' && cacheResult.entry) {
      if (execCtx?.waitUntil) {
        execCtx.waitUntil(generateEverythingFeed(request, env, execCtx).catch(() => {}));
      } else {
        void generateEverythingFeed(request, env, execCtx);
      }
      const resp = new Response(JSON.stringify(cacheResult.entry), {
        headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=45, stale-while-revalidate=90' },
      });
      resp.headers.set('X-DegenFeed-Debug', `cache=stale(swr),background=refresh,feed-generation=0.002s`);
      return resp;
    }
  }

  return generateEverythingFeed(request, env, execCtx);
}

async function generateEverythingFeed(
  request: Request,
  env: Env,
  execCtx?: ExecCtx,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const requestedProtocols = parseProtocols(params.get('protocols'), DEFAULT_PROTOCOLS);
  const limit = Math.min(Number(params.get('limit')) || 50, 200);
  const cookieHeader = request.headers.get('cookie') ?? '';
  const now = Date.now();

  const feedStartTime = Date.now();

  // 1. Load user context
  const userCtx = await loadUserRankingContext(request, env);

  // 2. Fetch from all providers
  const notices: string[] = [];
  const timer = new ProviderTimer();
  const fetchResults = await Promise.race([
    fetchFromProviders(env, requestedProtocols, limit * 2, notices, execCtx, timer),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`feed generation timeout after ${FEED_GENERATION_TIMEOUT_MS}ms`)),
        FEED_GENERATION_TIMEOUT_MS,
      ),
    ),
  ]).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : 'feed generation timed out';
    notices.push(msg);
    console.warn('[everything]', msg);
    return [] as Awaited<ReturnType<typeof fetchFromProviders>>;
  });
  const { posts: allPosts, errors, perProtocol } = collectProviderResults(fetchResults);

  // 3. Cross-protocol dedup
  const dedupResult = deduplicateCrossProtocol(allPosts);
  const deduped = prepareBasePosts(dedupResult.posts, {});
  void writePostsToKV(env, deduped);

  // 4. Filter
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

  // 5. Engagement prediction boost
  const authorStats = computeAllAuthorStats(relevant);
  const trending = await computeTrending(relevant, Number(params.get('trending')) || 24);
  const trendingSet = new Set(trending.map((t) => t.topic.toLowerCase()));
  for (const post of relevant) {
    const stats = authorStats.get(post.author.id);
    const pred = predictEngagementBoost({
      post,
      authorStats: stats,
      trendingTopics: trendingSet,
      now,
    });
    if (post.score) {
      post.score.total = (post.score.total ?? 0) * pred.boost;
    }
  }

  // 6. Build everything blend
  const userNiches = userCtx.preferences?.preferredNiches ?? [];
  const blended = buildEverythingBlend(relevant, {
    userNiches,
    followedCreators: userCtx.followed,
    limit,
  });

  // 7. Freshness
  const freshnessEntry = await updateFeedFreshness(env, 'everything', blended);
  const freshnessMeta = computeFreshnessMeta(freshnessEntry, now);

  const elapsed = Date.now() - feedStartTime;

  const responseBody = {
    data: blended,
    meta: {
      total: blended.length,
      limit,
      blend: {
        weights: { interest: 30, trending: 20, followed: 20, discovery: 15, quality: 15 },
        userNiches,
        followedCount: userCtx.followed.size,
      },
      perProtocol,
      errors: errors.length > 0 ? errors : undefined,
      notices: notices.length > 0 ? notices : undefined,
      fetchedAt: now,
      feedGenerationMs: elapsed,
      freshness: {
        updatedLabel: freshnessMeta.updatedLabel,
        updatedSecondsAgo: freshnessMeta.updatedSecondsAgo,
      },
      dedup: {
        crossProtocol: dedupResult.crossProtocol,
        urlDedup: dedupResult.urlDedup,
        totalRemoved: dedupResult.deduped,
      },
    },
  };

  // Cache
  void setFeedCache(env, null, 'everything', responseBody, responseBody.meta);

  return jsonResponse(responseBody);
}
