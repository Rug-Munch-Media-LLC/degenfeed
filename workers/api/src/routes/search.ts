/**
 * /api/search — Cross-protocol global search.
 *
 * Searches posts, identities, and content across all connected protocols.
 * Uses the aggregated feed as the search corpus (no MeiliSearch dependency).
 *
 * Endpoints:
 *   GET /api/search?q=bitcoin&limit=10&protocols=nostr,farcaster
 *   GET /api/search/identity?q=handle&limit=5
 */

import {
  deduplicatePosts,
  enrichPostNiches,
  isRelevantPost,
  isSpamPost,
} from '@degenfeed/feed-core';
import {
  BlueskyProvider,
  MastodonProvider,
  NostrProvider,
  RssProvider,
} from '@degenfeed/feed-providers';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { type Env, jsonResponse } from '../index';

const DEFAULT_PROTOCOLS: Protocol[] = ['rss', 'nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'];

// ─── MeiliSearch ──────────────────────────────────────────────────

// search.degenfeed.xyz nginx injects the Master Key via proxy_set_header Authorization.
// The Worker does not need to send its own API key — nginx handles auth at the edge.
const MEILISEARCH_URL = 'https://search.degenfeed.xyz';

/**
 * Sanitize a string into a valid MeiliSearch document identifier.
 * MeiliSearch only allows: a-z, A-Z, 0-9, hyphens (-), underscores (_).
 */
function sanitizeMeiliId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

interface MeiliSearchHit {
  id: string;
  originalId?: string;
  protocol: string;
  text: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  authorBio: string;
  niches: string[];
  createdAt: number;
  url: string | null;
  image: string | null;
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
}

async function searchMeiliSearch(
  q: string,
  options: {
    protocols?: Protocol[];
    category?: string;
    limit?: number;
    dateFrom?: number;
    dateTo?: number;
  },
): Promise<{ hits: MeiliSearchHit[]; total: number } | null> {
  try {
    const filters: string[] = [];
    if (options.protocols?.length && options.protocols.length < 6) {
      const vals = options.protocols.map((p) => JSON.stringify(p)).join(', ');
      filters.push(`protocol IN [${vals}]`);
    }
    if (options.category) {
      filters.push(`niches = ${JSON.stringify(options.category)}`);
    }
    if (options.dateFrom) filters.push(`createdAt >= ${options.dateFrom}`);
    if (options.dateTo) filters.push(`createdAt <= ${options.dateTo}`);

    const body: Record<string, unknown> = { q, limit: options.limit ?? 25 };
    if (filters.length > 0) body.filter = filters.join(' AND ');

    const res = await fetch(`${MEILISEARCH_URL}/indexes/posts/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      hits: MeiliSearchHit[];
      total: number;
      estimatedTotalHits: number;
    };
    return { hits: data.hits, total: data.total ?? data.estimatedTotalHits ?? data.hits.length };
  } catch {
    return null;
  }
}

export async function indexPost(post: UnifiedPost): Promise<boolean> {
  try {
    const doc = {
      id: sanitizeMeiliId(post.id),
      originalId: post.id,
      protocol: post.protocol,
      text: post.text,
      authorDisplayName: post.author.displayName,
      authorAvatarUrl: post.author.avatarUrl,
      authorBio: post.author.bio ?? '',
      niches: post.niches,
      createdAt: post.createdAt,
      url: post.embeds.find((e) => e.kind === 'link')?.url ?? null,
      image: post.embeds.find((e) => e.kind === 'image')?.url ?? null,
      likes: post.metrics.likes,
      reposts: post.metrics.reposts,
      replies: post.metrics.replies,
      quotes: post.metrics.quotes,
    };
    const res = await fetch(`${MEILISEARCH_URL}/indexes/posts/documents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([doc]),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function handleSearchIndex(request: Request, _env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as { posts: UnifiedPost[] };
    if (!Array.isArray(body.posts) || body.posts.length === 0) {
      return jsonResponse({ error: 'No posts provided' }, 400);
    }
    if (body.posts.length > 500) {
      return jsonResponse({ error: 'Batch too large (max 500)' }, 400);
    }
    const results = await Promise.allSettled(body.posts.map(indexPost));
    const indexed = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    return jsonResponse({ indexed, total: body.posts.length });
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }
}

export async function handleSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.toLowerCase().trim() ?? '';
  if (!q || q.length < 2) return jsonResponse({ error: 'Query too short (min 2 chars)' }, 400);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 25, 100);
  const protocolsParam = url.searchParams.get('protocols') ?? '';
  const protocols = protocolsParam
    ? protocolsParam
        .split(',')
        .filter((p): p is Protocol => DEFAULT_PROTOCOLS.includes(p as Protocol))
    : DEFAULT_PROTOCOLS;
  const category = url.searchParams.get('category') ?? undefined;

  // Fast path: MeiliSearch full-text index
  const meiliResult = await searchMeiliSearch(q, { protocols, limit, category });
  if (meiliResult && meiliResult.hits.length > 0) {
    const data = meiliResult.hits.map((h) => ({
      id: h.originalId ?? h.id,
      protocol: h.protocol,
      author: { displayName: h.authorDisplayName, avatarUrl: h.authorAvatarUrl },
      text: h.text.slice(0, 300),
      url: h.url,
      image: h.image,
      niches: h.niches,
      createdAt: h.createdAt,
      metrics: { likes: h.likes, reposts: h.reposts, replies: h.replies, quotes: h.quotes },
    }));
    const response = { data, meta: { total: meiliResult.total, query: q, limit, protocols } };
    try {
      await env.CACHE?.put(
        `search:v1:${q}:${protocols.join(',')}:${limit}`,
        JSON.stringify(response),
        { expirationTtl: 120 },
      );
    } catch {
      /* ignore */
    }
    return jsonResponse(response);
  }

  const cacheKey = `search:v1:${q}:${protocols.join(',')}:${limit}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* ignore */
  }

  const all: UnifiedPost[] = [];
  const timeoutMs = 2000;
  // Hard deadline for the entire search: 5 seconds from the edge.
  // Each provider gets 2s, and we race all of them against a 5s deadline.
  const hardDeadline = 5000;

  const providers: { protocol: Protocol; fetch: () => Promise<UnifiedPost[]> }[] = [
    {
      protocol: 'rss',
      fetch: async () => {
        const rss = new RssProvider({
          feeds: [
            'https://cointelegraph.com/rss',
            'https://decrypt.co/feed',
            'https://bitcoinmagazine.com/.rss/full/',
            'https://www.theblock.co/rss',
          ],
        });
        const r = await rss.fetchFeed({ timeoutMs });
        return r.posts;
      },
    },
    {
      protocol: 'nostr',
      fetch: async () => {
        const p = new NostrProvider({ relays: (env.RELAY_URLS ?? '').split(',').filter(Boolean) });
        const r = await p.fetchFeed({ timeoutMs });
        return r.posts;
      },
    },
    {
      protocol: 'bluesky',
      fetch: async () => {
        const p = new BlueskyProvider({ baseUrl: env.BSKY_PUBLIC_URL });
        const r = await p.fetchFeed({ timeoutMs });
        return r.posts;
      },
    },
    {
      protocol: 'mastodon',
      fetch: async () => {
        const p = new MastodonProvider({ instanceUrl: env.GTS_INSTANCE_URL });
        const r = await p.fetchFeed({ timeoutMs });
        return r.posts;
      },
    },
  ];

  const selected = providers.filter((p) => protocols.includes(p.protocol));
  // Race all providers against a hard deadline
  const deadlinePromise = new Promise<void>((resolve) => {
    setTimeout(() => resolve(), hardDeadline);
  });
  const results = await Promise.race([
    Promise.allSettled(selected.map((p) => p.fetch())),
    deadlinePromise.then(() => [] as PromiseSettledResult<UnifiedPost[]>[]),
  ]);
  for (const r of results as PromiseSettledResult<UnifiedPost[]>[]) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  const filtered = all
    .filter((p) => !isSpamPost(p))
    .map(enrichPostNiches)
    .filter((p) => {
      const text =
        `${p.text} ${p.author.displayName} ${p.author.bio} ${p.niches.join(' ')}`.toLowerCase();
      return text.includes(q);
    });

  const deduped = deduplicatePosts(filtered);
  // Add our own Mastodon instance search results
  try {
    const encodedQ = encodeURIComponent(q);
    const mastoRes = await fetch(
      'https://social.degenfeed.xyz/api/v2/search?q=' +
        encodedQ +
        '&type=statuses,accounts,hashtags&limit=10&resolve=true',
      {
        headers: { 'user-agent': 'DegenFeed/0.1' },
      },
    );
    if (mastoRes.ok) {
      const mastoData = (await mastoRes.json()) as { statuses?: Array<Record<string, unknown>> };
      if (mastoData.statuses?.length) {
        const { MastodonProvider } = await import('@degenfeed/feed-providers');
        const mp = new MastodonProvider({ instanceUrl: 'https://social.degenfeed.xyz' });
        const result = await mp.fetchFeed({ timeoutMs: 2000 });
        for (const p of result.posts) {
          if (p.text.toLowerCase().includes(q) || p.author.displayName.toLowerCase().includes(q)) {
            deduped.push(p);
          }
        }
      }
    }
  } catch {
    /* Mastodon search unavailable */
  }
  const relevant = deduplicatePosts(deduped).filter(isRelevantPost);

  const sorted = relevant.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);

  const response = {
    data: sorted.map((p) => ({
      id: p.id,
      protocol: p.protocol,
      author: { displayName: p.author.displayName, avatarUrl: p.author.avatarUrl },
      text: p.text.slice(0, 300),
      url: p.embeds.find((e) => e.kind === 'link')?.url || null,
      image: p.embeds.find((e) => e.kind === 'image')?.url || null,
      niches: p.niches,
      createdAt: p.createdAt,
      metrics: p.metrics,
    })),
    meta: { total: sorted.length, query: q, limit, protocols },
  };

  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 120 });
  } catch {
    /* ignore */
  }

  return jsonResponse(response);
}

export async function handleSearchIdentity(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.toLowerCase().trim() ?? '';
  if (!q || q.length < 2) return jsonResponse({ error: 'Query too short' }, 400);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);

  // Try MeiliSearch first — search posts index aggregated by author
  try {
    const meiliBody = {
      q,
      limit: 100,
      attributesToSearchOn: ['authorDisplayName', 'authorBio'],
    };
    const meiliRes = await fetch(`${MEILISEARCH_URL}/indexes/posts/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(meiliBody),
    });
    if (meiliRes.ok) {
      const meiliData = (await meiliRes.json()) as {
        hits: MeiliSearchHit[];
        total: number;
        estimatedTotalHits: number;
      };
      // Deduplicate by author id
      const seen = new Map<string, IdentitySearchResult>();
      for (const h of meiliData.hits) {
        const key = `${h.protocol}:${h.authorDisplayName}`;
        if (seen.has(key)) continue;
        seen.set(key, {
          id: `${h.protocol}:${h.authorDisplayName.toLowerCase().replace(/\s+/g, '_')}`,
          protocol: h.protocol,
          displayName: h.authorDisplayName,
          handle: null,
          avatarUrl: h.authorAvatarUrl,
          bio: h.authorBio?.slice(0, 200) ?? '',
          postCount: 1,
        });
        if (seen.size >= limit) break;
      }
      const data = Array.from(seen.values());
      if (data.length > 0) {
        return jsonResponse({ data, meta: { query: q, total: data.length } });
      }
    }
  } catch {
    /* MeiliSearch identity search unavailable */
  }

  // Fallback: exact handle resolution via identity package
  try {
    const { resolveHandle } = await import('@degenfeed/identity');
    const result = await resolveHandle(q);
    if (result) {
      return jsonResponse({
        data: [
          {
            id: `${result.protocol}:${result.id}`,
            protocol: result.protocol,
            displayName: result.handle,
            handle: result.handle,
            avatarUrl: null,
            bio: '',
            postCount: 0,
          },
        ],
        meta: { query: q, total: 1 },
      });
    }
  } catch {
    /* identity resolution unavailable */
  }

  return jsonResponse({
    data: [],
    meta: { query: q, total: 0 },
  });
}

interface IdentitySearchResult {
  id: string;
  protocol: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  bio: string;
  postCount: number;
}
