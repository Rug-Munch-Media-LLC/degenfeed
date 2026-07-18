/**
 * /api/feed/for-you — TikTok-style recommendation engine v3
 *
 * Research synthesis:
 *   TikTok: watch time, completion rate, shares, profile visits, "not interested"
 *   Twitter/X: engagement prediction, author diversity, topic authority, recency
 *   Instagram: interests, relationship, timeliness, frequency, following, usage
 *
 * V3 pipeline:
 *   1. Cold start: new users → high-engagement content across all categories
 *   2. Dwell time: KV-tracked view duration → boosts similar content
 *   3. Feedback: "Show less/more like this" → topic/creator weight adjustment
 *   4. Engagement prediction v2: 9-factor model with dwell + feedback signals
 *   5. Creator diversity: max 3 per creator per page, rotation enforced
 *   6. Algorithm transparency: each post gets a human-readable "why" reason
 *
 * Also provides topic preference management + dwell recording + feedback endpoints.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { parseProtocols } from '@degenfeed/utils';
import {
  applyUserFilters,
  cachedJsonResponse,
  collectProviderResults,
  computeAllAuthorStats,
  computeFreshnessMeta,
  computeTrending,
  deduplicateCrossProtocol,
  deprioritizeStaleContent,
  emptyDwellProfile,
  emptyFeedbackProfile,
  FEED_GENERATION_TIMEOUT_MS,
  fetchFromProviders,
  filterSuppressedPosts,
  getCategoryCounts,
  getFeedCache,
  getLastSync,
  buildCatchUpSummary,
  loadUserRankingContext,
  predictEngagementV2,
  coldStartReasons,
  computeDwellBoost,
  computeFeedbackBoost,
  getDwellWeightedCreators,
  getDwellWeightedNiches,
  loadDwellProfile,
  loadFeedbackProfile,
  recordDwellEvent,
  recordFeedback,
  prefersEnglish,
  prepareBasePosts,
  ProviderTimer,
  scoreAndRank,
  setFeedCache,
  shouldTriggerSmartRefresh,
  updateFeedFreshness,
  updateLastSync,
  verifyDiversity,
  writePostsToKV,
  ALL_CATEGORIES,
  ensureCategory,
} from '../feed';
import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession, verifySessionCookie } from '../session';
import { DEFAULT_PROTOCOLS } from './feed';
import { mergePreferences } from '../feed/feed-scorer';

type ExecCtx = { waitUntil: (p: Promise<unknown>) => void };

// ─── KV helpers ─────────────────────────────────────────────────────

import {
  emptyBehaviorProfile,
  type UserBehaviorProfile,
  getLearnedTopics,
  adjustTopicWeight,
  clearTopic,
  isOnboardingMode,
  personalizeScore,
} from '@degenfeed/feed-core';

function behaviorKey(address: string): string {
  return `user:behavior:${address.toLowerCase()}`;
}

async function readBehavior(env: Env, address: string): Promise<UserBehaviorProfile> {
  try {
    const raw = await env.CACHE?.get(behaviorKey(address));
    if (raw) return JSON.parse(raw) as UserBehaviorProfile;
  } catch {
    /* ignore */
  }
  return emptyBehaviorProfile();
}

async function writeBehavior(
  env: Env,
  address: string,
  profile: UserBehaviorProfile,
): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(behaviorKey(address), JSON.stringify(profile), {
      expirationTtl: 60 * 60 * 24 * 30,
    });
  } catch {
    console.warn('[for-you] KV write failed');
  }
}

async function sessionAddress(request: Request, env: Env): Promise<string | null> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('__Host-dfid='));
  if (!match || !env.AUTH_SECRET) return null;
  const cookieValue = match.slice('__Host-dfid='.length);
  const payload = await verifySessionCookie(cookieValue, env.AUTH_SECRET);
  return payload?.address ?? null;
}

// ─── Creator diversity enforcement ─────────────────────────────────

function enforceCreatorDiversity(posts: UnifiedPost[], maxPerCreator = 3): UnifiedPost[] {
  const creatorCounts = new Map<string, number>();
  const result: UnifiedPost[] = [];

  for (const post of posts) {
    const creatorId = post.author.id;
    const count = creatorCounts.get(creatorId) ?? 0;
    if (count >= maxPerCreator) continue;
    creatorCounts.set(creatorId, count + 1);
    result.push(post);
  }

  return result;
}

// ─── For You feed handler ──────────────────────────────────────────

async function generateForYouFeed(
  request: Request,
  env: Env,
  execCtx: ExecCtx | undefined,
  userId: string | null,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const requestedProtocols = parseProtocols(params.get('protocols'), DEFAULT_PROTOCOLS);
  const limit = Math.min(Number(params.get('limit')) || 50, 200);
  const category = params.get('category')?.toLowerCase() ?? '';
  const cursor = Number(params.get('cursor')) || 0;
  const direction = params.get('direction') === 'asc' ? 'asc' : 'desc';
  const cookieHeader = request.headers.get('cookie') ?? '';
  const now = Date.now();
  const feedStartTime = Date.now();

  // 1. Load user context
  const userCtx = await loadUserRankingContext(request, env);
  const address = await sessionAddress(request, env);

  // 2. Load behavior, dwell, and feedback profiles
  const behaviorProfile = address ? await readBehavior(env, address) : null;
  const dwellProfile = address ? await loadDwellProfile(env, address) : emptyDwellProfile();
  const feedbackProfile = address ? await loadFeedbackProfile(env, address) : emptyFeedbackProfile();
  const isOnboarding = !behaviorProfile || isOnboardingMode(behaviorProfile);

  // 3. Fetch from providers
  const notices: string[] = [];
  const timer = new ProviderTimer();
  const fetchResults = await Promise.race([
    fetchFromProviders(env, requestedProtocols, isOnboarding ? limit * 2 : limit, notices, execCtx, timer),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`feed generation timeout after ${FEED_GENERATION_TIMEOUT_MS}ms`)),
        FEED_GENERATION_TIMEOUT_MS,
      ),
    ),
  ]).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : 'feed generation timed out';
    notices.push(msg);
    console.warn('[for-you]', msg);
    return [] as Awaited<ReturnType<typeof fetchFromProviders>>;
  });
  const { posts: allPosts, errors, perProtocol } = collectProviderResults(fetchResults);

  // 4. Dedup + enrich
  const dedupResult = deduplicateCrossProtocol(allPosts);
  const deduped = prepareBasePosts(dedupResult.posts, {
    category,
    type: params.get('type') || '',
  });
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

  // 5. Filter suppressed posts (strong negative feedback)
  const filtered = filterSuppressedPosts(relevant, feedbackProfile);

  // 6. Compute trending
  const computedTrendingSet = new Set<string>();
  const trending = await computeTrending(filtered, Number(params.get('trending')) || 24);
  for (const t of trending) {
    computedTrendingSet.add(t.topic.toLowerCase());
  }

  const authorStats = computeAllAuthorStats(filtered);

  // 7. Cold start: if onboarding, mix high-engagement across all categories
  let coldStartPosts: UnifiedPost[] = [];
  let isColdStart = isOnboarding;

  if (isColdStart) {
    // Sort by engagement across all categories (diverse categories enforced)
    filtered.sort((a, b) => {
      const engA = a.metrics.likes + a.metrics.reposts * 2 + a.metrics.replies * 3 + (a.metrics.quotes ?? 0);
      const engB = b.metrics.likes + b.metrics.reposts * 2 + b.metrics.replies * 3 + (b.metrics.quotes ?? 0);
      if (engB !== engA) return engB - engA;
      return b.createdAt - a.createdAt;
    });

    // Enforce category diversity in cold start
    const catCounts = new Map<string, number>();
    const maxPerCat = Math.ceil(limit / ALL_CATEGORIES.length) + 2;
    for (const post of filtered) {
      const cat = ensureCategory(post);
      const count = catCounts.get(cat) ?? 0;
      if (count >= maxPerCat) continue;
      catCounts.set(cat, count + 1);
      coldStartPosts.push(post);
      if (coldStartPosts.length >= limit * 2) break;
    }
    coldStartPosts = enforceCreatorDiversity(coldStartPosts, 3);
    coldStartPosts = deprioritizeStaleContent(coldStartPosts, now);
  }

  // 8. Score and rank
  const mergedPrefs = mergePreferences(null, userCtx.preferences, null);
  const { ranked, topOfHour, nextCursor, debug } = await scoreAndRank(env, isColdStart ? coldStartPosts : filtered, {
    prefs: mergedPrefs,
    followed: userCtx.followed,
    sort: 'scored',
    diverse: params.get('diverse') !== 'false',
    limit,
    cursor,
    direction,
    hideLowQuality:
      params.get('hideLowQuality') === 'true' || userCtx.preferences?.hideLowQuality === true,
    hideLowQualityThreshold:
      Number(params.get('hideLowQualityThreshold')) ||
      userCtx.preferences?.hideLowQualityThreshold ||
      1.0,
    showOriginalContent:
      params.get('showOriginalContent') === 'true' ||
      userCtx.preferences?.showOriginalContent === true,
    minEngagement: isColdStart ? 5 : (Number(params.get('minEngagement')) || userCtx.preferences?.minEngagement || 0),
    maxPerNiche: Number(params.get('maxPerNiche')) || userCtx.preferences?.maxPerNiche || 5,
    interleaveProtocols:
      params.get('interleaveProtocols') !== 'false' &&
      (userCtx.preferences?.interleaveProtocols ?? true),
  });

  // 9. V3 personalization: engagement prediction v2 + dwell boost + feedback boost
  let finalRanked: UnifiedPost[] = ranked;
  const algorithmReasons: Map<string, string[]> = new Map();
  let personalizationApplied = false;

  if (!isColdStart || !isOnboarding) {
    // Build user signal sets
    const userNiches = new Set<string>();
    if (behaviorProfile) {
      const learnedTopics = getLearnedTopics(behaviorProfile);
      for (const { topic } of learnedTopics) userNiches.add(topic.toLowerCase());
      // Also add topics from the behavior profile directly
      for (const topic of Object.keys(behaviorProfile.topics ?? {})) {
        userNiches.add(topic.toLowerCase());
      }
    }
    for (const niche of userCtx.preferences?.preferredNiches ?? []) {
      userNiches.add(niche.toLowerCase());
    }
    // Also add dwell-weighted niches
    const dwellWeightedNiches = getDwellWeightedNiches(dwellProfile);
    const dwellWeightedCreators = getDwellWeightedCreators(dwellProfile);

    const userContentTypes = new Set<string>();
    if (behaviorProfile) {
      for (const type of Object.keys(behaviorProfile.contentTypes ?? {})) {
        userContentTypes.add(type);
      }
    }

    const personalized: Array<UnifiedPost & { _personalizationScore: number }> = ranked.map((post) => {
      // A. Legacy personalizeScore (backward compat)
      let legacyBoost = 0;
      let legacyReasons: string[] = [];
      if (behaviorProfile) {
        const result = personalizeScore(post, behaviorProfile);
        legacyBoost = result.boost;
        legacyReasons = result.reasons;
      }

      // B. Engagement prediction v2
      const v2Pred = predictEngagementV2({
        post,
        userNiches,
        userCreators: userCtx.followed,
        userContentTypes,
        dwellWeightedNiches,
        dwellWeightedCreators,
        feedbackProfile,
        behaviorProfile: undefined,
        followedCreators: userCtx.followed,
        now,
      });

      // C. Dwell boost
      const dwellResult = computeDwellBoost(post, dwellProfile);

      // D. Feedback boost
      const feedbackResult = computeFeedbackBoost(post, feedbackProfile);

      // Combine: legacy + v2 prediction + dwell + feedback
      const combinedBoost =
        (legacyBoost * 0.15) + // legacy weight
        (v2Pred.normalizedScore * 0.45) + // v2 prediction weight
        ((dwellResult.multiplier - 1.0) * 0.25) + // dwell weight (normalize to 0-1 range)
        ((feedbackResult.multiplier - 1.0) * 0.15); // feedback weight

      // Collect algorithm reasons
      const reasons = [
        ...v2Pred.algorithmReasons,
        ...dwellResult.factors,
        ...feedbackResult.factors,
        ...legacyReasons,
      ];
      // Dedup reasons
      const uniqueReasons = [...new Set(reasons)];
      algorithmReasons.set(post.id, uniqueReasons.length > 0 ? uniqueReasons : []);

      return {
        ...post,
        _personalizationScore: combinedBoost,
      };
    });

    // Sort by combined score
    personalized.sort((a, b) => {
      const baseA = a.score?.total ?? 0;
      const baseB = b.score?.total ?? 0;
      return (baseB + b._personalizationScore * 10) - (baseA + a._personalizationScore * 10);
    });

    personalizationApplied = true;
    finalRanked = personalized.map(({ _personalizationScore, ...clean }) => clean);
  }

  // 10. Cold start: attach cold start algorithm reasons
  if (isColdStart) {
    for (const post of finalRanked) {
      algorithmReasons.set(post.id, coldStartReasons(post));
    }
  }

  // 11. Creator diversity enforcement
  finalRanked = enforceCreatorDiversity(finalRanked, 3);

  // 12. Stale content deprioritization
  finalRanked = deprioritizeStaleContent(finalRanked, now);

  // 13. Attach algorithm reasons to posts
  finalRanked = finalRanked.map((post) => ({
    ...post,
    algorithmReasons: algorithmReasons.get(post.id) ?? [],
    score: post.score
      ? { ...post.score, algorithmReasons: algorithmReasons.get(post.id) ?? [] }
      : undefined,
  }));

  // 14. Smart refresh
  let catchUp = null;
  if (userId) {
    const lastSync = await getLastSync(env, userId);
    if (shouldTriggerSmartRefresh(lastSync, now)) {
      catchUp = buildCatchUpSummary(finalRanked, userCtx.followed, lastSync, now);
    }
    void updateLastSync(env, userId);
  }

  // 15. Freshness
  const freshnessEntry = await updateFeedFreshness(env, 'for-you', finalRanked);
  const freshnessMeta = computeFreshnessMeta(freshnessEntry, now);

  // 16. Coverage audit
  const categoryCounts = getCategoryCounts(finalRanked);
  const diversityCheck = verifyDiversity(finalRanked);

  const feedElapsed = Date.now() - feedStartTime;
  const responseBody = {
    data: finalRanked,
    meta: {
      total: finalRanked.length,
      limit,
      perProtocol,
      errors: errors.length > 0 ? errors : undefined,
      notices: notices.length > 0 ? notices : undefined,
      topOfHour,
      nextCursor,
      sort: 'for-you-v3',
      fetchedAt: now,
      freshness: {
        updatedLabel: freshnessMeta.updatedLabel,
        updatedSecondsAgo: freshnessMeta.updatedSecondsAgo,
      },
      dedup: {
        crossProtocol: dedupResult.crossProtocol,
        urlDedup: dedupResult.urlDedup,
        totalRemoved: dedupResult.deduped,
      },
      catchUp: catchUp && catchUp.triggered
        ? {
            triggered: true,
            awayMinutes: catchUp.awayMinutes,
            totalNewPosts: catchUp.totalNewPosts,
            topPostIds: catchUp.topPosts.map((p) => p.id),
            trendingSince: catchUp.trendingSince,
          }
        : undefined,
      personalization: {
        hasProfile: !!behaviorProfile,
        personalizationApplied,
        isOnboarding: isColdStart,
        isColdStart,
        hasDwellData: dwellProfile.entries.length > 0,
        hasFeedbackData: feedbackProfile.entries.length > 0,
        dwellEntries: dwellProfile.entries.length,
        feedbackEntries: feedbackProfile.entries.length,
      },
      algorithm: {
        version: 'v3',
        factors: [
          'content-similarity',
          'creator-affinity',
          'topic-match',
          'timing',
          'post-type-preference',
          'scroll-velocity',
          'social-proof',
          'diversity-bonus',
          'dwell-boost',
          'feedback-boost',
        ],
        coldStartActive: isColdStart,
      },
      categoryCoverage: {
        counts: categoryCounts,
        uniqueCategories: diversityCheck.uniqueCategories,
        dominantCategory: diversityCheck.dominantCategory,
        dominantPct: diversityCheck.dominantPct,
        sufficientlyDiverse: diversityCheck.diverse,
      },
    },
  };

  if (!cursor) void setFeedCache(env, userId, 'for-you', responseBody, responseBody.meta);
  const resp = cachedJsonResponse(responseBody);

  const debugParts = [
    `feed-generation=${(feedElapsed / 1000).toFixed(1)}s`,
    `v3-personalization=${personalizationApplied}`,
    `cold-start=${isColdStart}`,
    `dwell-entries=${dwellProfile.entries.length}`,
    `feedback-entries=${feedbackProfile.entries.length}`,
    `dedup=cross=${dedupResult.crossProtocol},url=${dedupResult.urlDedup}`,
    `freshness=${freshnessMeta.updatedLabel}`,
    `creator-diversity=${3}/page`,
    `categories=${diversityCheck.uniqueCategories}/${ALL_CATEGORIES.length}`,
    catchUp?.triggered ? `catchup=${catchUp.awayMinutes}m,${catchUp.totalNewPosts}new` : '',
  ];
  if (timer.getResults().length > 0) {
    debugParts.push(`timings=${timer.toDebugString()}`);
  }
  resp.headers.set('X-DegenFeed-Debug', debugParts.filter(Boolean).join(' | '));
  return resp;
}

export async function handleForYouFeed(
  request: Request,
  env: Env,
  execCtx?: ExecCtx,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const userId = await sessionAddress(request, env);

  // SWR cache
  if (!params.get('cursor')) {
    const cacheResult = await getFeedCache(env, userId, 'for-you');
    if (cacheResult.type === 'hit' && cacheResult.entry) {
      const resp = cachedJsonResponse(cacheResult.entry, 200, 30);
      resp.headers.set('X-DegenFeed-Debug', `cache=hit,v3`);
      return resp;
    }
    if (cacheResult.type === 'stale' && cacheResult.entry) {
      if (execCtx?.waitUntil) {
        execCtx.waitUntil(
          generateForYouFeed(request, env, execCtx, userId).catch(() => {}),
        );
      } else {
        void generateForYouFeed(request, env, execCtx, userId);
      }
      const resp = cachedJsonResponse(cacheResult.entry, 200, 30);
      resp.headers.set('X-DegenFeed-Debug', `cache=stale(swr),v3,background=refresh`);
      return resp;
    }
  }

  return generateForYouFeed(request, env, execCtx, userId);
}

// ─── Minimal post info for recording ──────────────────────────────
interface DwellPostInfo {
  id: string;
  niches?: string[];
  authorId?: string;
  contentType?: string;
}

function buildFakePost(info: DwellPostInfo): UnifiedPost {
  return {
    id: info.id,
    text: '',
    html: '',
    author: {
      id: info.authorId ?? '',
      primary: { protocol: 'nostr' as const, id: info.authorId ?? '' },
      displayName: '',
      bio: '',
      avatarUrl: '',
      handles: {},
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    embeds: [],
    niches: info.niches ?? [],
    createdAt: Date.now(),
    protocol: 'nostr',
    contentType: (info.contentType as UnifiedPost['contentType']) ?? 'text',
    qualityScore: { score: 0, max: 100, ratio: 0, reasons: [] },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: null,
  };
}

// ─── Dwell time recording endpoint ──────────────────────────────────

export async function handleRecordDwell(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    postId?: string;
    niches?: string[];
    authorId?: string;
    contentType?: string;
    dwellMs?: number;
    completionRate?: number;
    shared?: boolean;
    profileVisit?: boolean;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.postId || typeof body.dwellMs !== 'number') {
    return jsonResponse({ error: 'postId and dwellMs required' }, 400);
  }

  const fakePost = buildFakePost({
    id: body.postId,
    niches: body.niches,
    authorId: body.authorId,
    contentType: body.contentType,
  });

  await recordDwellEvent(
    env,
    session.address,
    fakePost,
    body.dwellMs ?? 0,
    body.completionRate ?? 0,
    body.shared ?? false,
    body.profileVisit ?? false,
  );

  return noCacheJsonResponse({ ok: true });
}

// ─── Feedback endpoint: "Show more/less like this" ─────────────────

export async function handleFeedback(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    postId?: string;
    action?: 'show-more' | 'show-less';
    niches?: string[];
    authorId?: string;
    contentType?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.postId || !body.action) {
    return jsonResponse({ error: 'postId and action (show-more or show-less) required' }, 400);
  }

  if (body.action !== 'show-more' && body.action !== 'show-less') {
    return jsonResponse({ error: 'action must be show-more or show-less' }, 400);
  }

  const fakePost = buildFakePost({
    id: body.postId,
    niches: body.niches,
    authorId: body.authorId,
    contentType: body.contentType,
  });

  const profile = await recordFeedback(env, session.address, fakePost, body.action);

  return noCacheJsonResponse({
    ok: true,
    action: body.action,
    topicWeights: profile.topicWeights,
    creatorWeights: profile.creatorWeights,
    contentTypeWeights: profile.contentTypeWeights,
  });
}

// ─── Topic preference management endpoints ─────────────────────────

export async function handleGetTopics(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const profile = await readBehavior(env, session.address);
  const topics = getLearnedTopics(profile);

  return noCacheJsonResponse({ topics });
}

export async function handleAdjustTopic(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { topic?: string; delta?: number } = {};
  try {
    body = (await request.json()) as { topic?: string; delta?: number };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const topic = body.topic?.toLowerCase().trim();
  if (!topic) return jsonResponse({ error: 'topic required' }, 400);
  const delta = typeof body.delta === 'number' ? body.delta : 0.2;

  let profile = await readBehavior(env, session.address);
  profile = adjustTopicWeight(profile, topic, delta);
  await writeBehavior(env, session.address, profile);

  return noCacheJsonResponse({ ok: true, topics: getLearnedTopics(profile) });
}

export async function handleClearTopic(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { topic?: string } = {};
  try {
    body = (await request.json()) as { topic?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const topic = body.topic?.toLowerCase().trim();
  if (!topic) return jsonResponse({ error: 'topic required' }, 400);

  let profile = await readBehavior(env, session.address);
  profile = clearTopic(profile, topic);
  await writeBehavior(env, session.address, profile);

  return noCacheJsonResponse({ ok: true });
}
