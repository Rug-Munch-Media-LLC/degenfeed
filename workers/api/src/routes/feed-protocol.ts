/**
 * @degenfeed/api-worker — Protocol-specific feed routes
 *
 * Endpoints that return feeds scoped to a single protocol with
 * different sort/ranking modes. Works for ANY protocol in the system.
 *
 * Routes:
 *   GET /api/feed/protocol/:protocol          — Protocol feed (default: scored)
 *   GET /api/feed/protocol/:protocol/popular  — By engagement (likes + reposts)
 *   GET /api/feed/protocol/:protocol/trending — By velocity (engagement rate over time)
 *   GET /api/feed/protocol/:protocol/newest   — Chronological (newest first)
 *   GET /api/feed/protocol/:protocol/videos   — Video/image content only
 */

import type { UnifiedPost } from '@degenfeed/types';
import {
  applyCurationPipeline,
  applyUserFilters,
  collectProviderResults,
  computeAllAuthorStats,
  computeTrending,
  DEFAULT_PROTOCOLS,
  deduplicateCrossProtocol,
  deprioritizeStaleContent,
  enrichNostrEngagement,
  FEED_GENERATION_TIMEOUT_MS,
  fetchFromProviders,
  loadUserRankingContext,
  mergePreferences,
  ProviderTimer,
  parseCookiePrefs,
  parsePrefsFromQuery,
  predictEngagementBoost,
  prepareBasePosts,
  scoreAndRank,
  setFeedCache,
  writePostsToKV,
} from '../feed';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

type ExecCtx = { waitUntil: (p: Promise<unknown>) => void };

/**
 * Validate that a protocol string is known to the system.
 */
function isValidProtocol(p: string): boolean {
  const known = new Set(DEFAULT_PROTOCOLS);
  // Extended list of all supported protocols
  const extended = [
    'nostr',
    'farcaster',
    'lens',
    'bluesky',
    'mastodon',
    'reddit',
    'rss',
    'threads',
    'lemmy',
    'pixelfed',
    'peertube',
    'kbin',
    'tildes',
    'zora',
    'telegram',
    'discord',
    'matrix',
    'github',
    'youtube',
    'twitter',
    'atproto',
    'ethereum',
    'solana',
    'mirror',
    'paragraph',
    'substack',
    'medium',
    'audius',
    'rarible',
    'deso',
    'hive',
    'misskey',
    'pleroma',
    'writefreely',
    'pixelfed',
    'dtube',
    'lbry',
    'gab',
    'minds',
    'aether',
    'scuttlebutt',
    'diaspora',
    'friendica',
    'steem',
    'subsocial',
    'session',
    'microblog',
    'cyberconnect',
    'arena',
    'funkwhale',
    'castopod',
    'mediagoblin',
    'newsletter-bridge',
    'webhook',
    'email',
    'google',
    'ponder',
  ];
  known.add(...extended);
  return known.has(p);
}

/**
 * Human-readable label for a protocol identifier.
 */
function protocolLabel(protocol: string): string {
  const labels: Record<string, string> = {
    nostr: 'Nostr',
    farcaster: 'Farcaster',
    lens: 'Lens Protocol',
    bluesky: 'Bluesky',
    mastodon: 'Mastodon',
    reddit: 'Reddit',
    rss: 'RSS',
    threads: 'Threads',
    lemmy: 'Lemmy',
    pixelfed: 'Pixelfed',
    peertube: 'PeerTube',
    kbin: 'Kbin',
    tildes: 'Tildes',
    zora: 'Zora',
    telegram: 'Telegram',
    discord: 'Discord',
    matrix: 'Matrix',
    github: 'GitHub',
    youtube: 'YouTube',
    atproto: 'AT Protocol',
    ethereum: 'Ethereum',
    solana: 'Solana',
    twitter: 'Twitter/X',
    mirror: 'Mirror.xyz',
    paragraph: 'Paragraph',
    substack: 'Substack',
    medium: 'Medium',
    audius: 'Audius',
    rarible: 'Rarible',
    deso: 'DeSo',
    hive: 'Hive',
    misskey: 'Misskey',
    pleroma: 'Pleroma',
    writefreely: 'WriteFreely',
    dtube: 'DTube',
    lbry: 'LBRY/Odysee',
    gab: 'Gab',
    minds: 'Minds',
    aether: 'Aether',
    scuttlebutt: 'Secure Scuttlebutt',
    diaspora: 'Diaspora',
    friendica: 'Friendica',
    steem: 'Steem',
    subsocial: 'Subsocial',
    session: 'Session',
    microblog: 'Micro.blog',
    cyberconnect: 'CyberConnect',
    arena: 'Are.na',
    funkwhale: 'Funkwhale',
    castopod: 'Castopod',
    mediagoblin: 'MediaGoblin',
    ponder: 'Ponder',
    'newsletter-bridge': 'Newsletter Bridge',
    webhook: 'Webhook',
    email: 'Email',
    google: 'Google',
  };
  return labels[protocol] ?? protocol.charAt(0).toUpperCase() + protocol.slice(1);
}

/**
 * Fetch posts from a single protocol provider.
 */
async function fetchProtocolFeed(
  env: Env,
  protocol: string,
  _sort: string,
  limit: number,
  notices: string[],
  execCtx: ExecCtx | undefined,
  timer: ProviderTimer,
) {
  const results = await Promise.race([
    fetchFromProviders(env, [protocol], limit, notices, execCtx, timer),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(`Protocol feed generation timeout after ${FEED_GENERATION_TIMEOUT_MS}ms`),
          ),
        FEED_GENERATION_TIMEOUT_MS,
      ),
    ),
  ]).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : 'protocol feed generation timed out';
    notices.push(msg);
    console.warn('[feed-protocol]', msg);
    return [] as Awaited<ReturnType<typeof fetchFromProviders>>;
  });

  return results;
}

/**
 * Generate a protocol-scoped feed response with the requested sort.
 */
async function generateProtocolFeed(
  request: Request,
  env: Env,
  execCtx: ExecCtx | undefined,
  protocol: string,
  sort: string,
): Promise<Response> {
  const feedStartTime = Date.now();
  const params = new URL(request.url).searchParams;
  const cookieHeader = request.headers.get('cookie') ?? '';
  const now = Date.now();
  const userId = null; // Protocol feeds don't need per-user cache

  const limit = Math.min(Number(params.get('limit')) || 50, 200);

  // Offset-based pagination: ?page=N advances the slice so infinite scroll
  // requests genuinely new posts on each page. (Previously every page
  // returned the same top-N — the client deduped them to nothing and
  // hasMore never flipped, so the feed appeared to hang forever.)
  const page = Math.max(1, Number(params.get('page')) || 1);
  const offset = (page - 1) * limit;

  // 1. Fetch from providers for this protocol
  const notices: string[] = [];
  const timer = new ProviderTimer();
  const results = await fetchProtocolFeed(env, protocol, sort, limit, notices, execCtx, timer);

  const { posts: allPosts, errors } = collectProviderResults(results);

  // If no posts came back, return empty
  if (allPosts.length === 0) {
    return jsonResponse({
      data: [],
      meta: {
        protocol,
        total: 0,
        limit,
        page,
        hasMore: false,
        errors: errors.length > 0 ? errors : undefined,
        notices: notices.length > 0 ? notices : undefined,
        fetchedAt: now,
        sort,
        protocolLabel: protocolLabel(protocol),
        activeUsers24h: 0,
        engagementVelocity: 0,
      },
    });
  }

  // 2. Dedup
  const dedupResult = deduplicateCrossProtocol(allPosts);
  const deduped = prepareBasePosts(dedupResult.posts, {
    category: params.get('category') || '',
    type: params.get('type') || '',
  });
  void writePostsToKV(env, deduped);

  // 3. Per-user filtering (minimal — just use defaults)
  const userCtx = await loadUserRankingContext(request, env);
  const relevant = applyUserFilters(deduped, {
    mutedAuthors: userCtx.mutedAuthors,
    mutedWords: userCtx.mutedWords,
    mutedCommunities: userCtx.mutedCommunities,
    blockedCommunities: userCtx.blockedCommunities,
    allowNonCrypto: params.get('allowNonCrypto') === 'true',
    preferEnglish: false,
  });
  await enrichNostrEngagement(relevant);

  // 4. Compute trending topics for this protocol
  const trendingTopics = await computeTrending(relevant, 24);

  // 5. Score and sort based on the requested sort mode
  let sorted: UnifiedPost[];

  switch (sort) {
    case 'popular':
      // Sort by total engagement (likes + reposts + replies)
      sorted = [...relevant].sort((a, b) => {
        const aEng = a.metrics.likes + a.metrics.reposts + a.metrics.replies;
        const bEng = b.metrics.likes + b.metrics.reposts + b.metrics.replies;
        return bEng - aEng;
      });
      break;

    case 'trending': {
      // Sort by engagement velocity (recent activity / time)
      const velocity = new Map<string, number>();
      for (const post of relevant) {
        const ageHours = (now - post.createdAt) / 3_600_000;
        const totalEng = post.metrics.likes + post.metrics.reposts + post.metrics.replies;
        // Posts less than 1 hour old get a bonus
        const recencyBonus = ageHours < 1 ? 2.0 : ageHours < 6 ? 1.5 : 1.0;
        const score = ageHours > 0 ? (totalEng / ageHours) * recencyBonus : totalEng;
        velocity.set(post.id, score);
      }
      sorted = [...relevant].sort((a, b) => (velocity.get(b.id) ?? 0) - (velocity.get(a.id) ?? 0));
      break;
    }

    case 'newest':
    case 'latest':
      sorted = [...relevant].sort((a, b) => b.createdAt - a.createdAt);
      break;

    case 'videos': {
      // Filter to video/image content only, then sort by recency
      const mediaPosts = relevant.filter(
        (p) =>
          p.contentType === 'video' ||
          p.contentType === 'image' ||
          p.embeds.some((e) => e.kind === 'image' || e.kind === 'video'),
      );
      sorted = mediaPosts.sort((a, b) => b.createdAt - a.createdAt);
      break;
    }

    case 'top':
    case 'scored':
    default: {
      // 'top' and 'scored' — full scoring pipeline ranking
      const mergedPrefs = mergePreferences(
        parsePrefsFromQuery(params),
        userCtx.preferences,
        parseCookiePrefs(cookieHeader),
      );
      const authorStats = computeAllAuthorStats(relevant);
      const trendingSet = new Set<string>();
      for (const t of trendingTopics) {
        trendingSet.add(t.topic.toLowerCase());
      }
      for (const post of relevant) {
        const stats = authorStats.get(post.author.id);
        const _prediction = predictEngagementBoost({
          post,
          authorStats: stats,
          trendingTopics: trendingSet,
          now,
        });
      }

      const { ranked } = await scoreAndRank(env, relevant, {
        prefs: mergedPrefs,
        followed: userCtx.followed,
        sort: 'scored',
        diverse: params.get('diverse') !== 'false',
        limit,
        cursor: 0,
        direction: 'desc',
        hideLowQuality: false,
        showOriginalContent: false,
        minEngagement: 0,
        maxPerNiche: 5,
        interleaveProtocols: false,
      });
      sorted = ranked;
      break;
    }
  }

  // 6. Curation pipeline
  const curated = applyCurationPipeline(sorted, {
    freshnessBoost: true,
    interleaveProtocols: false,
    maxConsecutiveProtocols: 99,
    contentTypeVariety: sort !== 'videos',
    maxConsecutiveContentType: 5,
    categoryRotation: true,
    minCategories: 2,
    now,
  });

  // 7. Remove stale content
  const freshnessSorted = deprioritizeStaleContent(curated, now);

  // 8. Paginate: slice the sorted list by page so ?page=2, ?page=3 ...
  //    return genuinely new posts instead of the same top-N.
  const sliced = freshnessSorted.slice(offset, offset + limit);
  const hasMore = offset + sliced.length < freshnessSorted.length;

  // 9. Compute protocol-level stats
  const activeUsers24h = new Set(sliced.map((p) => p.author.id)).size;
  const totalEngagement = sliced.reduce((sum, p) => sum + p.metrics.likes + p.metrics.reposts, 0);
  const engagementVelocity =
    sliced.length > 0 && now > 0
      ? Math.round((totalEngagement / Math.max(1, sliced.length)) * 100) / 100
      : 0;

  // 10. Build response
  const feedElapsed = Date.now() - feedStartTime;
  const responseBody = {
    data: sliced,
    meta: {
      protocol,
      total: sliced.length,
      limit,
      page,
      hasMore,
      errors: errors.length > 0 ? errors : undefined,
      notices: notices.length > 0 ? notices : undefined,
      trending: trendingTopics.slice(0, 10),
      fetchedAt: now,
      sort,
      protocolLabel: protocolLabel(protocol),
      activeUsers24h,
      engagementVelocity,
    },
  };

  // Cache the result (page-scoped so page 2 doesn't clobber page 1)
  void setFeedCache(
    env,
    userId,
    `protocol:${protocol}:${sort}:p${page}` as never,
    responseBody,
    responseBody.meta,
  );

  return jsonResponse(responseBody, 200, {
    'X-DegenFeed-Debug': `protocol=${protocol},sort=${sort},feed-generation=${(feedElapsed / 1000).toFixed(1)}s,cache=miss`,
  });
}

// ─── Route Handlers ─────────────────────────────────────────

/**
 * GET /api/feed/protocol/:protocol
 * Default protocol feed (scored/ranked)
 */
export async function handleProtocolFeed(
  request: Request,
  env: Env,
  protocol: string,
  execCtx?: ExecCtx,
): Promise<Response> {
  if (!isValidProtocol(protocol)) {
    return jsonResponse(
      {
        error: `Unknown protocol: "${protocol}"`,
        data: [],
        meta: { protocol, total: 0, sort: 'scored' },
      },
      404,
    );
  }

  const sort = new URL(request.url).searchParams.get('sort') || 'latest';
  return generateProtocolFeed(request, env, execCtx, protocol, sort);
}

/**
 * GET /api/feed/protocol/:protocol/popular
 * Popular posts sorted by total engagement.
 */
export async function handleProtocolPopular(
  request: Request,
  env: Env,
  protocol: string,
  execCtx?: ExecCtx,
): Promise<Response> {
  if (!isValidProtocol(protocol)) {
    return jsonResponse({ error: `Unknown protocol: "${protocol}"` }, 404);
  }
  return generateProtocolFeed(request, env, execCtx, protocol, 'popular');
}

/**
 * GET /api/feed/protocol/:protocol/trending
 * Trending posts sorted by engagement velocity.
 */
export async function handleProtocolTrendingRoute(
  request: Request,
  env: Env,
  protocol: string,
  execCtx?: ExecCtx,
): Promise<Response> {
  if (!isValidProtocol(protocol)) {
    return jsonResponse({ error: `Unknown protocol: "${protocol}"` }, 404);
  }
  return generateProtocolFeed(request, env, execCtx, protocol, 'trending');
}

/**
 * GET /api/feed/protocol/:protocol/newest
 * Newest posts in chronological order.
 */
export async function handleProtocolNewest(
  request: Request,
  env: Env,
  protocol: string,
  execCtx?: ExecCtx,
): Promise<Response> {
  if (!isValidProtocol(protocol)) {
    return jsonResponse({ error: `Unknown protocol: "${protocol}"` }, 404);
  }
  return generateProtocolFeed(request, env, execCtx, protocol, 'newest');
}

/**
 * GET /api/feed/protocol/:protocol/latest
 * Newest posts in chronological order (user-facing "Latest" sort).
 */
export async function handleProtocolLatest(
  request: Request,
  env: Env,
  protocol: string,
  execCtx?: ExecCtx,
): Promise<Response> {
  if (!isValidProtocol(protocol)) {
    return jsonResponse({ error: `Unknown protocol: "${protocol}"` }, 404);
  }
  return generateProtocolFeed(request, env, execCtx, protocol, 'latest');
}

/**
 * GET /api/feed/protocol/:protocol/top
 * Top-ranked posts using the full scoring pipeline.
 */
export async function handleProtocolTop(
  request: Request,
  env: Env,
  protocol: string,
  execCtx?: ExecCtx,
): Promise<Response> {
  if (!isValidProtocol(protocol)) {
    return jsonResponse({ error: `Unknown protocol: "${protocol}"` }, 404);
  }
  return generateProtocolFeed(request, env, execCtx, protocol, 'top');
}

/**
 * GET /api/feed/protocol/:protocol/videos
 * Video/image content only from this protocol.
 */
export async function handleProtocolVideos(
  request: Request,
  env: Env,
  protocol: string,
  execCtx?: ExecCtx,
): Promise<Response> {
  if (!isValidProtocol(protocol)) {
    return jsonResponse({ error: `Unknown protocol: "${protocol}"` }, 404);
  }
  return generateProtocolFeed(request, env, execCtx, protocol, 'videos');
}

/**
 * GET /api/feed/protocols — List all known protocols with metadata.
 */
export async function handleProtocolsList(_request: Request, _env: Env): Promise<Response> {
  const protocols = [
    { id: 'nostr', label: 'Nostr', category: 'social', health: 'online' as const },
    { id: 'farcaster', label: 'Farcaster', category: 'social', health: 'online' as const },
    { id: 'lens', label: 'Lens Protocol', category: 'social', health: 'online' as const },
    { id: 'bluesky', label: 'Bluesky', category: 'social', health: 'online' as const },
    { id: 'mastodon', label: 'Mastodon', category: 'social', health: 'online' as const },
    { id: 'reddit', label: 'Reddit', category: 'social', health: 'online' as const },
    { id: 'rss', label: 'RSS/News', category: 'news', health: 'online' as const },
    { id: 'threads', label: 'Threads', category: 'social', health: 'degraded' as const },
    { id: 'lemmy', label: 'Lemmy', category: 'social', health: 'online' as const },
    { id: 'pixelfed', label: 'Pixelfed', category: 'media', health: 'online' as const },
    { id: 'peertube', label: 'PeerTube', category: 'video', health: 'online' as const },
    { id: 'zora', label: 'Zora', category: 'nft', health: 'online' as const },
    { id: 'telegram', label: 'Telegram', category: 'messaging', health: 'online' as const },
    { id: 'discord', label: 'Discord', category: 'messaging', health: 'online' as const },
    { id: 'github', label: 'GitHub', category: 'dev', health: 'online' as const },
    { id: 'youtube', label: 'YouTube', category: 'video', health: 'online' as const },
    { id: 'audius', label: 'Audius', category: 'music', health: 'online' as const },
    { id: 'rarible', label: 'Rarible', category: 'nft', health: 'online' as const },
    { id: 'mirror', label: 'Mirror.xyz', category: 'publishing', health: 'online' as const },
    { id: 'paragraph', label: 'Paragraph', category: 'publishing', health: 'online' as const },
    { id: 'misskey', label: 'Misskey', category: 'social', health: 'degraded' as const },
    { id: 'pleroma', label: 'Pleroma', category: 'social', health: 'degraded' as const },
    { id: 'writefreely', label: 'WriteFreely', category: 'publishing', health: 'online' as const },
    { id: 'kbin', label: 'Kbin', category: 'social', health: 'degraded' as const },
    { id: 'tildes', label: 'Tildes', category: 'social', health: 'degraded' as const },
    { id: 'hive', label: 'Hive', category: 'social', health: 'online' as const },
    { id: 'diaspora', label: 'Diaspora', category: 'social', health: 'degraded' as const },
    { id: 'ethereum', label: 'Ethereum', category: 'blockchain', health: 'online' as const },
    { id: 'solana', label: 'Solana', category: 'blockchain', health: 'online' as const },
  ];
  return jsonResponse({ protocols });
}
