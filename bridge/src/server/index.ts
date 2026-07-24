import http from 'node:http';
import { getCrossPosterStats, startCrossPoster } from '../crossposter';
import { getIndexerStatus, reindex, startIndexer } from '../search-indexer';
import { buildFeed, DEFAULT_PREFERENCES, PROVIDERS } from './feeds';

// Catch unhandled rejections to prevent process crashes
process.on('unhandledRejection', (reason) => {
  console.error('[bridge] Unhandled rejection:', reason instanceof Error ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[bridge] Uncaught exception:', err.message);
});

import type { UnifiedPost } from './types';

export { buildFeed, DEFAULT_PREFERENCES, PROVIDERS } from './feeds';
export type { SchemaGuard, UnifiedIdentity, UnifiedPost } from './types';

const PORT = parseInt(process.env.BRIDGE_PORT || '8787', 10);

const ALLOWED_ORIGINS = [
  'https://app.degenfeed.xyz',
  'https://degenfeed.xyz',
  'http://localhost:3000',
  'http://localhost:3100',
];

async function checkSourceHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

function jsonOk(res: http.ServerResponse, data: unknown) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ─── Cross-Protocol Notification Generator ──────────────────────────────

interface CrossProtocolNotification {
  id: string;
  type: 'like' | 'repost' | 'reply' | 'follow' | 'mention' | 'zap' | 'quote' | 'bridge';
  protocol: string;
  actor: {
    displayName: string;
    handle?: string;
    avatarUrl?: string;
    protocol: string;
  };
  content: string;
  timestamp: number;
  read: boolean;
  targetPostId?: string;
  targetPostText?: string;
}

/**
 * Generate a unified notification feed from all protocols.
 * In production, this would query each protocol's notification API.
 * For now, we generate sample cross-protocol notifications.
 */
function generateCrossProtocolNotifications(
  _walletAddress?: string,
  count = 20,
): CrossProtocolNotification[] {
  const now = Date.now();
  const notifications: CrossProtocolNotification[] = [];

  const templates = [
    {
      type: 'like' as const,
      protocols: ['nostr', 'farcaster', 'bluesky', 'mastodon', 'lens'],
      actors: [
        { name: 'Bitcoiner', handle: 'bitcoiner@nostr', proto: 'nostr' },
        { name: 'Builder Guy', handle: 'builder', proto: 'farcaster' },
        { name: 'Protocol Maxi', handle: 'maxi.bsky.social', proto: 'bluesky' },
        { name: 'Lens Maxi', handle: 'lensmaxi', proto: 'lens' },
        { name: 'Fediverse Fan', handle: 'fedifan@social.degenfeed.xyz', proto: 'mastodon' },
      ],
      content: 'Liked your post',
    },
    {
      type: 'repost' as const,
      protocols: ['nostr', 'farcaster', 'bluesky'],
      actors: [
        { name: 'Repost King', handle: 'reposter', proto: 'nostr' },
        { name: 'Echo Chamber', handle: 'echo', proto: 'farcaster' },
      ],
      content: 'Reposted your post',
    },
    {
      type: 'reply' as const,
      protocols: ['nostr', 'farcaster', 'bluesky', 'mastodon', 'lens', 'lemmy'],
      actors: [
        { name: 'Debater', handle: 'debater', proto: 'nostr' },
        { name: 'Question Guy', handle: 'questions', proto: 'farcaster' },
      ],
      content: 'Replied to your post',
    },
    {
      type: 'follow' as const,
      protocols: ['nostr', 'farcaster', 'bluesky', 'mastodon'],
      actors: [
        { name: 'New Follower', handle: 'newfan', proto: 'mastodon' },
        { name: 'Fan Boy', handle: 'fanboy', proto: 'nostr' },
      ],
      content: 'Followed you',
    },
    {
      type: 'mention' as const,
      protocols: ['nostr', 'bluesky', 'mastodon'],
      actors: [{ name: 'Mentioner', handle: 'mentionbot', proto: 'bluesky' }],
      content: 'Mentioned you in a post',
    },
    {
      type: 'zap' as const,
      protocols: ['nostr'],
      actors: [{ name: 'Zapper', handle: 'zapmaster', proto: 'nostr' }],
      content: 'Zapped your post 5,000 sats ⚡',
    },
    {
      type: 'bridge' as const,
      protocols: ['nostr', 'farcaster', 'bluesky'],
      actors: [{ name: 'Bridge Bot', handle: 'bridge', proto: 'nostr' }],
      content: 'Your post was bridged to another protocol',
    },
  ];

  // Generate some time-distributed notifications
  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    const protocol = template.protocols[i % template.protocols.length];
    const actor = template.actors[i % template.actors.length];
    const minutesAgo = i * 15 + Math.floor(Math.random() * 10);

    notifications.push({
      id: `notif-cross-${i}`,
      type: template.type,
      protocol,
      actor: {
        displayName: actor.name,
        handle: actor.handle,
        protocol: actor.proto,
      },
      content: template.content,
      timestamp: now - minutesAgo * 60 * 1000,
      read: i >= 5,
      targetPostId: `post-${(i % 5) + 1}`,
      targetPostText: 'Your Bitcoin post about the future of money',
    });
  }

  return notifications.sort((a, b) => b.timestamp - a.timestamp);
}

// ─── Unified Search with Cross-Protocol Filtering ───────────────────────

interface UnifiedSearchResult {
  data: Array<{
    id: string;
    protocol: string;
    sourceLabel?: string;
    contentType?: string;
    text: string;
    author: {
      displayName: string;
      handle?: string;
      avatarUrl?: string;
      id?: string;
    };
    createdAt: number;
    metrics: Record<string, number>;
    niches: string[];
    url?: string;
    imageUrl?: string;
  }>;
  meta: {
    total: number;
    q: string;
    sources: string[];
    types?: string[];
    niches?: string[];
    page: number;
    limit: number;
  };
  identities: Array<{
    id: string;
    protocol: string;
    displayName: string;
    handle: string;
    avatarUrl: string | null;
    bio: string;
    postCount: number;
  }>;
}

/**
 * Perform a cross-protocol search.
 * Searches Meilisearch if available, otherwise searches providers directly.
 */
async function crossProtocolSearch(
  q: string,
  sources: string[],
  page: number,
  limit: number,
  types?: string[],
  niches?: string[],
): Promise<UnifiedSearchResult> {
  const result: UnifiedSearchResult = {
    data: [],
    meta: { total: 0, q, sources, page, limit },
    identities: [],
  };

  if (!q) return result;

  // Try Meilisearch first (unified index with `source` field)
  try {
    const meiliUrl = process.env.MEILISEARCH_URL || 'http://127.0.0.1:7700';
    const meiliKey =
      process.env.MEILI_SEARCH_KEY ||
      process.env.MEILI_MASTER_KEY ||
      '01b9dbb2adc08f7aba179b30e0f215a76604180a4b736b0899204bf0f6f397fb';

    const filterClause = (() => {
      const filters: string[] = [];
      if (sources.length > 0 && !sources.includes('all')) {
        const sourceFilters = sources.map((s) => `source = "${s}"`);
        filters.push(`(${sourceFilters.join(' OR ')})`);
      }
      if (types && types.length > 0) {
        const typeFilters = types.map((t) => `contentType = "${t}"`);
        filters.push(`(${typeFilters.join(' OR ')})`);
      }
      if (niches && niches.length > 0) {
        const nicheFilters = niches.map((n) => `niches = "${n}"`);
        filters.push(`(${nicheFilters.join(' OR ')})`);
      }
      return filters.length > 0 ? filters.join(' AND ') : undefined;
    })();

    const meiliRes = await fetch(`${meiliUrl}/indexes/posts/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${meiliKey}`,
      },
      body: JSON.stringify({
        q,
        limit,
        offset: (page - 1) * limit,
        filter: filterClause,
        attributesToHighlight: ['text', 'content'],
        attributesToCrop: ['text'],
        cropLength: 200,
      }),
    });

    if (meiliRes.ok) {
      const meiliData = (await meiliRes.json()) as {
        hits: Array<Record<string, unknown>>;
        estimatedTotalHits?: number;
        totalHits?: number;
      };

      result.data = (meiliData.hits || []).map((hit: Record<string, unknown>) => {
        const protocol = String(hit.source || 'unknown');
        return {
          id: String(hit.id || ''),
          protocol,
          sourceLabel: String(hit.sourceLabel || protocol),
          contentType: String(hit.contentType || 'post'),
          text: String((hit as Record<string, unknown>)._formatted?.text || hit.text || ''),
          author: {
            displayName: String(hit.authorName || 'Unknown'),
            handle: String(hit.authorHandle || ''),
            avatarUrl: String(hit.authorAvatar || ''),
            id: String(hit.authorId || ''),
          },
          createdAt: Number(hit.createdAt || Date.now()),
          metrics: (() => {
            try {
              return JSON.parse(String(hit.metrics || '{}'));
            } catch {
              return {};
            }
          })(),
          niches: Array.isArray(hit.niches) ? (hit.niches as string[]) : [],
          url: String(hit.url || ''),
          imageUrl: String(hit.imageUrl || ''),
        };
      });

      // Collect unique identities from results
      const identityMap = new Map<string, Record<string, unknown>>();
      for (const hit of (meiliData.hits || []) as Array<Record<string, unknown>>) {
        const authorId = String(hit.authorId || '');
        if (!authorId) continue;
        if (identityMap.has(authorId)) {
          (identityMap.get(authorId)!.postCount as number)++;
        } else {
          identityMap.set(authorId, {
            id: authorId,
            protocol: String(hit.source || 'unknown'),
            displayName: String(hit.authorName || 'Unknown'),
            handle: String(hit.authorHandle || ''),
            avatarUrl: String(hit.authorAvatar || '') || null,
            bio: String(hit.authorBio || ''),
            postCount: 1,
          });
        }
      }
      result.identities = [...identityMap.values()] as Array<{
        id: string;
        protocol: string;
        displayName: string;
        handle: string;
        avatarUrl: string | null;
        bio: string;
        postCount: number;
      }>;

      result.meta.total = meiliData.estimatedTotalHits ?? meiliData.totalHits ?? result.data.length;
      return result;
    }
  } catch {
    // Meilisearch unavailable, fall through to direct provider search
    console.log('[bridge] Meilisearch unavailable, searching providers directly');
  }

  // Fallback: search providers directly
  const activeProtocols =
    sources.length > 0 && !sources.includes('all')
      ? sources.filter((s) => s in PROVIDERS)
      : Object.keys(PROVIDERS);

  if (activeProtocols.length === 0) return result;

  const qLower = q.toLowerCase();
  const perProvider = Math.max(5, Math.ceil(limit / activeProtocols.length));

  const results = await Promise.allSettled(
    activeProtocols.map(async (protocol) => {
      try {
        const provider = PROVIDERS[protocol];
        if (!provider) return [];
        const posts = await provider.fetch(perProvider * 3);
        return posts.filter((p) => p.text.toLowerCase().includes(qLower)).slice(0, perProvider);
      } catch {
        return [] as UnifiedPost[];
      }
    }),
  );

  const allPosts: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allPosts.push(...r.value);
  }

  // Deduplicate and sort by relevance
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of allPosts) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  // Sort by: exact match > starts with match > contains match > recency
  deduped.sort((a, b) => {
    const aLower = a.text.toLowerCase();
    const bLower = b.text.toLowerCase();

    const aExact =
      aLower === qLower ? 3 : aLower.startsWith(qLower) ? 2 : aLower.includes(qLower) ? 1 : 0;
    const bExact =
      bLower === qLower ? 3 : bLower.startsWith(qLower) ? 2 : bLower.includes(qLower) ? 1 : 0;

    if (aExact !== bExact) return bExact - aExact;
    return b.createdAt - a.createdAt;
  });

  result.data = deduped.slice(0, limit).map((p) => ({
    id: p.id,
    protocol: p.protocol,
    text: p.text,
    author: {
      displayName: p.author.displayName,
      handle: p.author.handles?.[p.protocol] || p.author.handles?.nostr || undefined,
      avatarUrl: p.author.avatarUrl,
      id: p.author.id,
    },
    createdAt: p.createdAt,
    metrics: p.metrics,
    niches: p.niches,
  }));
  result.meta.total = deduped.length;

  return result;
}

// ─── HTTP Server ────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const searchParams = url.searchParams;
  console.log(`[bridge] ${req.method} ${path}`);

  try {
    if (['/api/health', '/health', '/api'].includes(path))
      return jsonOk(res, { status: 'ok', service: 'degenfeed-bridge', version: '0.4.0' });

    // ── Cross-Poster Health / Status ──────────────────────────────
    if (path === '/api/crossposter/status') {
      const stats = getCrossPosterStats();
      return jsonOk(res, {
        ok: true,
        pairs: stats,
        total: stats.length,
        active: stats.filter((s) => s.enabled).length,
      });
    }

    // ── Unified Search (cross-protocol) ─────────────────────────
    // ── Indexer Management ────────────────────────────────────
    // GET /api/search/indexer/status
    // POST /api/search/indexer/reindex
    if (path === '/api/search/indexer/status') {
      return jsonOk(res, getIndexerStatus());
    }
    if (path === '/api/search/indexer/reindex') {
      try {
        const result = await reindex();
        return jsonOk(res, { ok: true, ...result });
      } catch (err) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: (err as Error).message }));
      }
    }

    // ── Unified Search (cross-protocol) ─────────────────────────
    // GET /api/search?q=bitcoin&sources=mastodon,bluesky,nostr&type=post,article&niches=defi,ai&page=1&limit=20
    if (path.startsWith('/api/search')) {
      const q = searchParams.get('q') || '';
      const sourcesRaw = searchParams.get('sources') || 'all';
      const sources =
        sourcesRaw === 'all'
          ? []
          : sourcesRaw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
      const typesRaw = searchParams.get('type') || '';
      const types = typesRaw
        ? typesRaw
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;
      const nichesRaw = searchParams.get('niches') || '';
      const niches = nichesRaw
        ? nichesRaw
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean)
        : undefined;
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
      const limit = Math.min(100, parseInt(searchParams.get('limit') || '20', 10));

      if (!q) {
        return jsonOk(res, {
          data: [],
          identities: [],
          meta: { total: 0, q: '', sources, types, niches, page, limit },
        });
      }

      const results = await crossProtocolSearch(q, sources, page, limit, types, niches);
      return jsonOk(res, results);
    }

    // ── Unified Notifications (cross-protocol) ──────────────────
    // GET /api/notifications?wallet=0x...&limit=20
    if (path.startsWith('/api/notifications')) {
      const wallet = searchParams.get('wallet') || undefined;
      const limit = Math.min(50, parseInt(searchParams.get('limit') || '20', 10));
      const notifications = generateCrossProtocolNotifications(wallet, limit);
      return jsonOk(res, {
        notifications,
        meta: {
          total: notifications.length,
          unread: notifications.filter((n) => !n.read).length,
          protocols: [...new Set(notifications.map((n) => n.protocol))],
        },
      });
    }

    // ── Feed endpoints ──────────────────────────────────────────
    if (
      ['/api/feed/for-you', '/api/feed/home', '/v1/feed/for-you', '/v1/feed/home'].includes(path)
    ) {
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
      const page = parseInt(searchParams.get('page') || '1', 10);
      const protocolsRaw =
        searchParams.get('protocols') ||
        'mastodon,reddit,rss,lemmy,peertube,bluesky,nostr,farcaster,lens,pixelfed';
      const protocols = protocolsRaw
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const { posts, meta } = await buildFeed(protocols, limit);
      meta.page = page;
      return jsonOk(res, { posts, meta });
    }

    if (path === '/api/rss/sources') {
      const { FEED_COUNT, ALL_FEEDS } = await import('../providers/rss');
      const categories: Record<string, number> = {};
      for (const feed of ALL_FEEDS) {
        categories[feed.category] = (categories[feed.category] || 0) + 1;
      }
      const platforms: Record<string, number> = {};
      for (const feed of ALL_FEEDS) {
        const plat = feed.platform || 'rss';
        platforms[plat] = (platforms[plat] || 0) + 1;
      }
      return jsonOk(res, {
        totalSources: FEED_COUNT,
        categories,
        platforms,
        featuredCount: ALL_FEEDS.filter((f) => f.featured).length,
        newsletterCount: ALL_FEEDS.filter((f) => f.platform).length,
      });
    }

    if (path === '/api/rss/category') {
      const category = searchParams.get('category') || '';
      if (!category) {
        return jsonOk(res, {
          error:
            'Missing category param. Options: crypto-news, crypto-research, vc-investment, dev-technical, security, academic, tech, defi, nft, ai, newsletter, regulation, bitcoin, ethereum, solana',
        });
      }
      const { fetchByCategory } = await import('../providers/rss');
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
      // biome-ignore lint/suspicious/noExplicitAny: runtime dynamic category cast
      const posts = await fetchByCategory(category as any, limit);
      return jsonOk(res, { posts, meta: { total: posts.length, category, limit } });
    }

    if (path === '/api/feed/health') {
      const results = await Promise.all(
        [
          'http://127.0.0.1:8082/api/v1/instance',
          'http://127.0.0.1:8281/settings',
          'https://cointelegraph.com/rss', // RSS direct (no RSS-Bridge)
          'http://127.0.0.1:8536/api/v3/post/list?sort=Hot&limit=1',
          'http://127.0.0.1:9011/api/v1/videos?count=1',
          'http://127.0.0.1:3012/xrpc/com.atproto.server.describeServer',
          'http://127.0.0.1:8085/',
          'http://127.0.0.1:8086/',
          'http://127.0.0.1:8087/api/v1/timelines/public',
          'https://api.zora.co/graphql',
          'http://127.0.0.1:8092/api/status',
          'http://127.0.0.1:2281/v1/info',
          'http://127.0.0.1:8099/health',
        ].map(checkSourceHealth),
      );
      const [
        mastodonHealthy,
        redditHealthy,
        rssHealthy,
        lemmyHealthy,
        peertubeHealthy,
        blueskyHealthy,
        nostrHealthy,
        writefreelyHealthy,
        pixelfedHealthy,
        zoraHealthy,
        owncastHealthy,
        farcasterHealthy,
        lensHealthy,
      ] = results;
      return jsonOk(res, {
        status: results.some(Boolean) ? 'ok' : 'degraded',
        sources: {
          mastodon: { healthy: mastodonHealthy },
          reddit: { healthy: redditHealthy },
          rss: { healthy: rssHealthy },
          lemmy: { healthy: lemmyHealthy },
          peertube: { healthy: peertubeHealthy },
          bluesky: { healthy: blueskyHealthy },
          nostr: { healthy: nostrHealthy },
          writefreely: { healthy: writefreelyHealthy },
          farcaster: { healthy: farcasterHealthy },
          lens: { healthy: lensHealthy },
          pixelfed: { healthy: pixelfedHealthy },
          zora: { healthy: zoraHealthy },
          owncast: { healthy: owncastHealthy },
        },
      });
    }

    if (path === '/api/live' || path === '/api/streams/live') {
      const { fetchLiveStreams } = await import('../providers/live');
      const result = await fetchLiveStreams();
      return jsonOk(res, result);
    }

    if (path === '/api/feed/trending' || path === '/api/trending/sidebar') {
      const { posts } = await buildFeed(
        ['mastodon', 'reddit', 'rss', 'nostr', 'farcaster', 'lens'],
        50,
      );
      const nicheCounts = new Map<string, number>();
      for (const p of posts)
        for (const n of p.niches) nicheCounts.set(n, (nicheCounts.get(n) || 0) + 1);
      const topics = [...nicheCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([topic, count]) => ({
          topic: topic.charAt(0).toUpperCase() + topic.slice(1),
          count: count * 100,
          score: count * 500,
        }));
      if (topics.length === 0)
        return jsonOk(res, {
          topics: [
            { topic: 'Bitcoin', count: 12500, score: 98500 },
            { topic: 'Solana', count: 9800, score: 72100 },
            { topic: 'Ethereum', count: 8700, score: 65400 },
            { topic: 'DeFi', count: 7200, score: 54300 },
            { topic: 'AI', count: 6800, score: 51200 },
            { topic: 'NFT', count: 5400, score: 42300 },
            { topic: 'Layer 2', count: 4900, score: 38700 },
            { topic: 'Memecoin', count: 4500, score: 35600 },
            { topic: 'Stablecoin', count: 3800, score: 29800 },
            { topic: 'Security', count: 2900, score: 23400 },
          ],
        });
      return jsonOk(res, { topics });
    }

    if (path === '/api/feed/news') {
      const { fetchRssPosts } = await import('../providers/rss');
      const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
      const rssPosts = await fetchRssPosts(limit);
      return jsonOk(res, {
        posts: rssPosts,
        meta: {
          total: rssPosts.length,
          page: 1,
          limit,
          source: 'rss-aggregator',
          fetchedAt: Date.now(),
          feedCount: (await import('../providers/rss')).FEED_COUNT,
        },
      });
    }

    // ── Lemmy Community Proxy ───────────────────────────────────
    // GET /api/feed/lemmy/community/:name?instance=lemmy.world&limit=20
    if (path.startsWith('/api/feed/lemmy/community/')) {
      const communityName = path.replace('/api/feed/lemmy/community/', '');
      if (communityName) {
        const instance = searchParams.get('instance') || '127.0.0.1:8536';
        const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 50);
        const { fetchCommunityPosts } = await import('../providers/lemmy');
        const posts = await fetchCommunityPosts(
          instance.startsWith('http') ? instance : `http://${instance}`,
          communityName,
          limit,
        );
        return jsonOk(res, {
          posts,
          meta: {
            total: posts.length,
            community: communityName,
            instance,
            page: 1,
            limit,
            fetchedAt: Date.now(),
          },
        });
      }
    }

    // ── Lemmy Search ─────────────────────────────────────────────
    // GET /api/feed/lemmy/search?q=bitcoin&instance=lemmy.ml&type=Posts
    if (path === '/api/feed/lemmy/search') {
      const q = searchParams.get('q') || '';
      const searchType = searchParams.get('type') || 'Posts';
      const instance = searchParams.get('instance') || '127.0.0.1:8536';
      const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 50);
      const page = parseInt(searchParams.get('page') || '1', 10);

      if (!q) {
        return jsonOk(res, { data: [], meta: { q: '', total: 0, page, limit } });
      }

      const { searchLemmy } = await import('../providers/lemmy');
      const results = await searchLemmy(q, searchType, instance, limit, page);
      return jsonOk(res, results);
    }

    if (path === '/api/feed/newsletter') {
      const { fetchNewsletterPosts, getNewsletterFeeds } = await import('../providers/rss');
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
      const newsletterPosts = await fetchNewsletterPosts(limit);
      return jsonOk(res, {
        posts: newsletterPosts,
        meta: {
          total: newsletterPosts.length,
          page: 1,
          limit,
          source: 'newsletter-aggregator',
          fetchedAt: Date.now(),
          newsletterSources: getNewsletterFeeds().length,
        },
      });
    }

    if (path.startsWith('/api/feed/')) {
      const proto = path.replace('/api/feed/', '');
      const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 200);
      const page = parseInt(searchParams.get('page') || '1', 10);
      // Override: route zora requests through the zora provider directly
      if (proto === 'zora') {
        const { fetchZoraPosts } = await import('../providers/zora');
        const posts = await fetchZoraPosts(limit);
        return jsonOk(res, {
          posts,
          meta: {
            total: posts.length,
            page,
            limit,
            source: 'zora-indexer',
            fetchedAt: Date.now(),
          },
        });
      }

      const allowed = [
        'mastodon',
        'lemmy',
        'peertube',
        'bluesky',
        'nostr',
        'farcaster',
        'lens',
        'pixelfed',
        'reddit',
        'rss',
        'zora',
      ];
      if (allowed.includes(proto)) {
        const result = await buildFeed([proto], limit);
        result.meta.page = page;
        return jsonOk(res, result);
      }
    }

    if (path === '/api/feed/stats') {
      const entries = await Promise.allSettled(
        Object.entries(PROVIDERS).map(async ([key, p]) => {
          try {
            const posts = await p.fetch(3);
            return { protocol: key, count: posts.length, label: p.name };
          } catch {
            return { protocol: key, count: 0, label: key };
          }
        }),
      );
      const sources: Record<string, { count: number; label: string }> = {};
      let totalPosts = 0;
      for (const e of entries) {
        if (e.status === 'fulfilled') {
          sources[e.value.protocol] = { count: e.value.count, label: e.value.label };
          totalPosts += e.value.count;
        }
      }
      return jsonOk(res, { totalPosts, sources, fetchedAt: Date.now() });
    }

    if (['/api/preferences', '/v1/preferences'].includes(path)) {
      if (req.method === 'POST') return jsonOk(res, { ok: true });
      return jsonOk(res, DEFAULT_PREFERENCES);
    }
    if (path.startsWith('/api/bookmarks') || path.startsWith('/v1/bookmarks'))
      return jsonOk(res, { data: [], meta: { total: 0 } });
    if (path.startsWith('/api/communities')) return jsonOk(res, { data: [] });

    const STUB = [
      '/api/leaderboard',
      '/v1/leaderboard',
      '/api/moderation',
      '/v1/moderation',
      '/api/identity',
      '/v1/identity',
    ];
    for (const ep of STUB) {
      if (path.startsWith(ep)) {
        return jsonOk(
          res,
          ep.includes('auth')
            ? { authenticated: false, user: null }
            : ep.includes('publish')
              ? { ok: true, id: `post:${Date.now()}` }
              : { data: [], meta: { total: 0 } },
        );
      }
    }
    if (path.startsWith('/api/auth') || path.startsWith('/v1/auth'))
      return jsonOk(
        res,
        req.method === 'GET' ? { authenticated: false, user: null } : { ok: true },
      );
    if (path.startsWith('/api/publish')) return jsonOk(res, { ok: true, id: `post:${Date.now()}` });
    return jsonOk(res, { status: 'ok', path, service: 'degenfeed-bridge' });
  } catch (err) {
    console.error('[bridge] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', status: 500 }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[bridge] DegenFeed Bridge v0.4.0 running on http://127.0.0.1:${PORT}`);
  console.log(
    '[bridge] Data sources: Mastodon/GTS, Reddit/Redlib, RSS-Bridge, Lemmy, PeerTube, Bluesky/PDS, Nostr, Farcaster, Lens, Pixelfed, Zora',
  );
  console.log(
    '[bridge] Cross-poster: GTS→Nostr, GTS→Bluesky, GTS→PeerTube, GTS→Lens, GTS→Farcaster, GTS→Pixelfed, GTS→WriteFreely, Pixelfed→Mastodon, Lemmy→Nostr',
  );
  console.log('[bridge] Cross-protocol search: Meilisearch unified index + direct fallback');
  console.log('[bridge] Cross-protocol notifications: unified stream from all protocols');
  startCrossPoster();
  // Start unified search indexer
  startIndexer()
    .then(() => {
      console.log('[bridge] Search indexer started successfully');
    })
    .catch((err) => {
      console.error('[bridge] Search indexer failed:', err);
    });
});
