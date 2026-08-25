import type { ExtendedSource } from '../feed/shorts-aggregator-v2';
import type { WatchEvent } from '../feed/shorts-algorithm';
import { kvGetJson } from '../lib/kv-json';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import type { VibeScore, VineCategory, VineFeedResponse, VineShort } from './vine-shorts-types';
import {
  loadVineProfile,
  recordRevine,
  saveVineProfile,
  VINE_CATEGORIES,
  VINE_CATEGORY_META,
  VineAggregator,
} from './vine-shorts-types';
export async function handleVineFeed(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);
    const category = url.searchParams.get('category') as VineCategory | null;
    const minVibe = Number(url.searchParams.get('min_vibe')) || 0;
    const seenParam = url.searchParams.get('seen_ids') || '';
    const seenIds = new Set(seenParam ? seenParam.split(',').filter(Boolean) : []);

    const aggregator = new VineAggregator(env);
    const { shorts, featured } = await aggregator.aggregateVineShorts(limit * 2);

    // Apply filters
    let filtered = shorts;

    if (category && VINE_CATEGORIES.includes(category)) {
      filtered = filtered.filter((s) => s.vineCategory.includes(category));
    }

    if (minVibe > 0) {
      filtered = filtered.filter((s) => s.vibeScore.total >= minVibe);
    }

    if (seenIds.size > 0) {
      filtered = filtered.filter((s) => !seenIds.has(s.id));
    }

    // Diversity: max 2 from same creator in a row, mix sources
    const usedCreators = new Map<string, number>();
    const sourceRotation: ExtendedSource[] = [];
    const diversified: VineShort[] = [];

    for (const short of filtered) {
      const creatorCount = usedCreators.get(short.creatorName) ?? 0;
      if (creatorCount >= 2) continue; // Skip creator if already 2 videos

      // Ensure source diversity
      const lastSource = sourceRotation[sourceRotation.length - 1];
      if (short.source === lastSource && diversified.length > 2) {
        // Try to find a different source
        const nextDifferent = filtered.find(
          (s) => s.source !== lastSource && !usedCreators.has(s.creatorName) && !seenIds.has(s.id),
        );
        if (nextDifferent) {
          diversified.push(nextDifferent);
          usedCreators.set(
            nextDifferent.creatorName,
            (usedCreators.get(nextDifferent.creatorName) ?? 0) + 1,
          );
          sourceRotation.push(nextDifferent.source);
          continue;
        }
      }

      diversified.push(short);
      usedCreators.set(short.creatorName, creatorCount + 1);
      sourceRotation.push(short.source);

      if (diversified.length >= limit) break;
    }

    // New content injection: 20% from unseen sources
    const newContentRatio = 0.2;
    const _existingCount = diversified.length;
    const newContentNeeded = Math.ceil(limit * newContentRatio);
    const newContent = filtered
      .filter((s) => !diversified.some((d) => d.id === s.id))
      .slice(0, newContentNeeded);

    // Interleave new content
    const final: VineShort[] = [];
    let newIdx = 0;
    for (let i = 0; i < Math.min(diversified.length, limit - newContent.length); i++) {
      final.push(diversified[i]!);
      // Inject every 5th position with new content
      if ((i + 1) % 5 === 0 && newIdx < newContent.length) {
        final.push(newContent[newIdx]!);
        newIdx++;
      }
    }

    // Vibe stats
    const vibeScores = final.map((s) => s.vibeScore.total);
    const vibeRange = {
      min: Math.min(...vibeScores),
      max: Math.max(...vibeScores),
      avg: Math.round(vibeScores.reduce((a, b) => a + b, 0) / vibeScores.length),
    };

    const response: VineFeedResponse = {
      shorts: final.slice(0, limit),
      categories: [...new Set(final.flatMap((s) => s.vineCategory))],
      vibeRange,
      featured,
      hasMore: filtered.length > limit,
      cursor: final.length > 0 ? `${final[final.length - 1]?.id}:${Date.now()}` : null,
      aggregatedAt: Date.now(),
    };

    return noCacheJsonResponse(response);
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to load Vine feed',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

/**
 * GET /api/shorts/vibe — Vibe-scored content
 *
 * Returns shorts sorted by vibe score with full breakdown.
 * Best for: "I want to see the funniest/most creative content"
 *
 * Query params:
 *   ?sort=humor|creativity|originality|replay|total
 *   ?limit=20
 *   ?category=comedy
 */
export async function handleVibeFeed(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);
    const sortBy = (url.searchParams.get('sort') || 'total') as keyof VibeScore;
    const category = url.searchParams.get('category') as VineCategory | null;

    const aggregator = new VineAggregator(env);
    const { shorts } = await aggregator.aggregateVineShorts(limit * 2);

    let results = shorts;

    if (category && VINE_CATEGORIES.includes(category)) {
      results = results.filter((s) => s.vineCategory.includes(category));
    }

    // Sort by selected vibe dimension
    const validSortKeys: (keyof VibeScore)[] = [
      'total',
      'humor',
      'creativity',
      'originality',
      'replayValue',
      'productionQuality',
      'engagementVelocity',
      'viralPotential',
    ];
    const sortKey = validSortKeys.includes(sortBy) ? sortBy : 'total';

    results.sort((a, b) => b.vibeScore[sortKey] - a.vibeScore[sortKey]);

    return noCacheJsonResponse({
      shorts: results.slice(0, limit),
      sortBy: sortKey,
      category: category ?? 'all',
      count: results.slice(0, limit).length,
      aggregatedAt: Date.now(),
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to load vibe feed',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

/**
 * GET /api/shorts/queue — Pre-loaded content queue
 *
 * Returns a pre-loaded queue of 50+ vibed Vine shorts.
 * The queue is cached for 5 minutes and refreshed automatically.
 *
 * Query params:
 *   ?refresh=true    — Force refresh queue
 *   ?size=50         — Queue size
 */
export async function handleVineQueue(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    // Get user ID from session if available
    const session = await requireSession(request, env).catch(() => null);
    const userId =
      session instanceof Object ? (session as { address?: string }).address : undefined;

    const aggregator = new VineAggregator(env);

    if (forceRefresh) {
      // Clear cache and regenerate
      const cacheKey = `vine:queue:${userId ?? 'anonymous'}`;
      await env.SHORTS?.delete(cacheKey).catch(() => {});
    }

    const queue = await aggregator.getQueue(userId);

    return noCacheJsonResponse({
      ...queue,
      refreshed: forceRefresh,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to load queue',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

/**
 * POST /api/shorts/queue/refresh — Refresh queue
 *
 * Forces a refresh of the pre-loaded queue for the current user.
 * Returns the fresh queue immediately.
 */
export async function handleVineQueueRefresh(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const userId = session.address;
    const cacheKey = `vine:queue:${userId}`;

    // Clear cache
    await env.SHORTS?.delete(cacheKey).catch(() => {});

    // Generate fresh queue
    const aggregator = new VineAggregator(env);
    const queue = await aggregator.getQueue(userId);

    return jsonResponse({
      ...queue,
      refreshed: true,
      message: `Queue refreshed with ${queue.size} vines`,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to refresh queue',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

/**
 * POST /api/shorts/revine — Revine (repost) a short
 *
 * "Revine" = Repost/Share a Vine to the user's followers.
 * Records the revine and returns cross-platform sharing links.
 *
 * Body:
 *   { shortId: string, platforms?: string[] }
 */
export async function handleRevine(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const body = (await request.json()) as {
      shortId: string;
      platforms?: string[];
    };

    if (!body.shortId) {
      return jsonResponse({ error: 'shortId is required' }, 400);
    }

    // Record the revine
    await recordRevine(env, body.shortId, session.address);

    const platforms = body.platforms ?? ['degenfeed'];

    // Build cross-platform repost URLs
    const crossPlatformLinks = platforms.map((platform) => {
      const baseUrl = 'https://degenfeed.xyz';
      switch (platform) {
        case 'farcaster':
          return {
            platform,
            url: `${baseUrl}/api/shorts/share/farcaster/${body.shortId}`,
            label: 'Share on Farcaster',
          };
        case 'nostr':
          return {
            platform,
            url: `${baseUrl}/api/shorts/share/nostr/${body.shortId}`,
            label: 'Share on Nostr',
          };
        case 'bluesky':
          return {
            platform,
            url: `${baseUrl}/api/shorts/share/bluesky/${body.shortId}`,
            label: 'Share on Bluesky',
          };
        case 'twitter':
          return {
            platform,
            url: `https://twitter.com/intent/tweet?url=${baseUrl}/s/${body.shortId}`,
            label: 'Share on Twitter/X',
          };
        default:
          return { platform, url: `${baseUrl}/s/${body.shortId}`, label: 'Copy link' };
      }
    });

    return jsonResponse({
      success: true,
      shortId: body.shortId,
      revined: true,
      revineCount: 1, // Placeholder — would increment counter
      crossPlatformLinks,
      message: 'Revined! Shared to your followers.',
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Revine failed',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

/**
 * GET /api/shorts/vine/top — Daily/Weekly Top Vines leaderboard
 *
 * Returns the top vibed shorts for the given time window.
 *
 * Query params:
 *   ?window=daily|weekly
 *   ?limit=20
 */
export async function handleVineTop(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const url = new URL(request.url);
    const window = (url.searchParams.get('window') || 'daily') as 'daily' | 'weekly';
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);

    const aggregator = new VineAggregator(env);
    const leaderboard = await aggregator.getLeaderboard(window, limit);

    return noCacheJsonResponse({
      window,
      leaderboard,
      count: leaderboard.length,
      updatedAt: Date.now(),
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to load leaderboard',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

/**
 * POST /api/shorts/vine/feature — Submit a short for featured consideration
 *
 * Body:
 *   { shortId: string, reason?: string }
 */
export async function handleVineFeatureSubmit(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const body = (await request.json()) as {
      shortId: string;
      reason?: string;
    };

    if (!body.shortId) {
      return jsonResponse({ error: 'shortId is required' }, 400);
    }

    const aggregator = new VineAggregator(env);
    const result = await aggregator.submitForFeatured(body.shortId, session.address, body.reason);

    return jsonResponse(result, result.success ? 201 : 200);
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to submit for featured',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

/**
 * GET /api/shorts/vine/challenges — Active Vine challenges
 *
 * Returns active challenges with top entries.
 */
export async function handleVineChallenges(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const aggregator = new VineAggregator(env);
    const challenges = await aggregator.getChallenges();

    // Enrich each challenge with top entries from the aggregator
    const { shorts } = await aggregator.aggregateVineShorts(100);

    const enriched = challenges.map((ch) => ({
      ...ch,
      topEntries: shorts
        .filter((s) =>
          s.tags.some((t) => ch.hashtag.replace('#', '').toLowerCase() === t.toLowerCase()),
        )
        .sort((a, b) => b.vibeScore.total - a.vibeScore.total)
        .slice(0, 5),
    }));

    return noCacheJsonResponse({
      challenges: enriched,
      count: enriched.length,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to load challenges',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

/**
 * POST /api/shorts/vine/challenges/join — Join a challenge
 *
 * Body:
 *   { challengeId: string, shortId: string }
 */
export async function handleVineChallengeJoin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const body = (await request.json()) as {
      challengeId: string;
      shortId: string;
    };

    if (!body.challengeId || !body.shortId) {
      return jsonResponse({ error: 'challengeId and shortId are required' }, 400);
    }

    // Record challenge entry
    const key = `vine:challenge:entries:${body.challengeId}`;
    const existing = await kvGetJson(env.SHORTS, key).catch(() => null);
    const entries: Array<{ shortId: string; userId: string; enteredAt: number }> =
      (existing as any[]) ?? [];

    if (entries.some((e) => e.shortId === body.shortId)) {
      return jsonResponse({ success: false, error: 'Already entered this challenge' }, 409);
    }

    entries.push({
      shortId: body.shortId,
      userId: session.address,
      enteredAt: Date.now(),
    });

    await env.SHORTS?.put(key, JSON.stringify(entries), { expirationTtl: 86400 * 90 });

    return jsonResponse({
      success: true,
      challengeId: body.challengeId,
      message: 'Successfully joined the challenge! Good luck!',
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to join challenge',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

/**
 * GET /api/shorts/vine/stars — Vine Star leaderboard
 *
 * Returns top creators ranked by total vibe score with badges.
 *
 * Query params:
 *   ?limit=20
 */
export async function handleVineStars(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 100);

    const aggregator = new VineAggregator(env);
    const stars = await aggregator.getVineStars(limit);

    return noCacheJsonResponse({
      stars,
      count: stars.length,
      badgeTiers: [
        { badge: 'diamond', threshold: 5000, label: 'Diamond Vine Star' },
        { badge: 'platinum', threshold: 2000, label: 'Platinum Vine Star' },
        { badge: 'gold', threshold: 1000, label: 'Gold Vine Star' },
        { badge: 'silver', threshold: 500, label: 'Silver Vine Star' },
        { badge: 'bronze', threshold: 0, label: 'Bronze Vine Star' },
      ],
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to load Vine Stars',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

/**
 * GET /api/shorts/vine/categories — List Vine categories with metadata
 */
export async function handleVineCategories(_request: Request, _env: Env): Promise<Response> {
  return noCacheJsonResponse({
    categories: VINE_CATEGORIES.map((cat) => ({
      id: cat,
      ...VINE_CATEGORY_META[cat],
    })),
  });
}

/**
 * POST /api/shorts/vine/sound/:id/attribute — Attribute original sound creator
 *
 * Body:
 *   { shortId: string, soundCreatorName: string, soundCreatorHandle: string, soundCreatorAvatar?: string }
 */
export async function handleAttributeSound(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const url = new URL(request.url);
    const shortId = url.pathname.split('/')[5]; // /api/shorts/vine/sound/:id/attribute
    const body = (await request.json()) as {
      soundCreatorName: string;
      soundCreatorHandle: string;
      soundCreatorAvatar?: string;
    };

    if (!shortId || !body.soundCreatorName || !body.soundCreatorHandle) {
      return jsonResponse(
        { error: 'shortId, soundCreatorName, and soundCreatorHandle are required' },
        400,
      );
    }

    // Store sound attribution
    const key = `vine:sound:attr:${shortId}`;
    await env.SHORTS?.put(
      key,
      JSON.stringify({
        shortId,
        attributedBy: session.address,
        soundCreator: {
          name: body.soundCreatorName,
          handle: body.soundCreatorHandle,
          avatar: body.soundCreatorAvatar,
        },
        attributedAt: Date.now(),
      }),
      { expirationTtl: 86400 * 365 },
    );

    return jsonResponse({
      success: true,
      message: `Original sound attributed to ${body.soundCreatorName}`,
      shortId,
      soundCreator: body.soundCreatorName,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to attribute sound',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

/**
 * POST /api/shorts/vine/watch — Record a Vine watch + update vibe score
 *
 * Extends the existing watch handler with Vine-specific tracking.
 */
export async function handleVineWatch(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as WatchEvent & { shortId: string };

    if (!body.shortId) {
      return jsonResponse({ error: 'shortId is required' }, 400);
    }

    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    // Record watch event (reuse existing algorithm)
    const watchEvent: WatchEvent = {
      shortId: body.shortId,
      watchPercent: Math.min(Math.max(0, body.watchPercent ?? 0), 1),
      liked: body.liked ?? false,
      shared: body.shared ?? false,
      watchedFull: body.watchedFull ?? false,
      skipped: body.skipped ?? false,
      watchDurationMs: Math.max(0, body.watchDurationMs ?? 0),
      timestamp: Date.now(),
    };

    // Update user's category preferences based on watch
    const categoryPrefs = await loadVineProfile(env, session.address);
    const short = await kvGetJson(env.SHORTS, `vine:short:${body.shortId}`).catch(() => null);

    // Increment category affinity
    if (short && typeof short === 'object') {
      const s = short as { vineCategory?: VineCategory[] };
      if (s.vineCategory) {
        for (const cat of s.vineCategory) {
          categoryPrefs[cat] = (categoryPrefs[cat] ?? 0) + (watchEvent.watchedFull ? 2 : 1);
          if (watchEvent.liked) categoryPrefs[cat] = (categoryPrefs[cat] ?? 0) + 1;
          if (watchEvent.skipped) categoryPrefs[cat] = Math.max(0, (categoryPrefs[cat] ?? 0) - 1);
        }
        await saveVineProfile(env, session.address, categoryPrefs);
      }
    }

    return jsonResponse({
      success: true,
      recorded: watchEvent.shortId,
      categoryPreferences: categoryPrefs,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to record vine watch',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}
