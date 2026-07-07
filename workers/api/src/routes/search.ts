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

function rmiUrl(env: Env): string {
  return (env as Env & { RMI_BACKEND_URL?: string }).RMI_BACKEND_URL || 'http://127.0.0.1:8000';
}

export async function handleSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.toLowerCase().trim() ?? '';
  if (!q || q.length < 2) return jsonResponse({ error: 'Query too short (min 2 chars)' }, 400);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 25, 100);
  const protocolsParam = url.searchParams.get('protocols') ?? '';
  const protocols = protocolsParam
    ? protocolsParam.split(',').filter((p): p is Protocol => DEFAULT_PROTOCOLS.includes(p as Protocol))
    : DEFAULT_PROTOCOLS;

  const cacheKey = `search:v1:${q}:${protocols.join(',')}:${limit}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch { /* ignore */ }

  const all: UnifiedPost[] = [];
  const timeoutMs = 2000;
  // Hard deadline for the entire search: 5 seconds from the edge.
  // Each provider gets 2s, and we race all of them against a 5s deadline.
  const hardDeadline = 5000;

  const providers: { protocol: Protocol; fetch: () => Promise<UnifiedPost[]> }[] = [
    { protocol: 'rss', fetch: async () => {
      const rss = new RssProvider({ feeds: ['https://cointelegraph.com/rss', 'https://decrypt.co/feed', 'https://bitcoinmagazine.com/.rss/full/', 'https://www.theblock.co/rss'] });
      const r = await rss.fetchFeed({ timeoutMs });
      return r.posts;
    } },
    { protocol: 'nostr', fetch: async () => {
      const p = new NostrProvider({ relays: (env.RELAY_URLS ?? '').split(',').filter(Boolean) });
      const r = await p.fetchFeed({ timeoutMs });
      return r.posts;
    } },
    { protocol: 'bluesky', fetch: async () => {
      const p = new BlueskyProvider({ baseUrl: env.BSKY_PUBLIC_URL });
      const r = await p.fetchFeed({ timeoutMs });
      return r.posts;
    } },
    { protocol: 'mastodon', fetch: async () => {
      const p = new MastodonProvider({ instanceUrl: env.GTS_INSTANCE_URL });
      const r = await p.fetchFeed({ timeoutMs });
      return r.posts;
    } },
  ];

  const selected = providers.filter((p) => protocols.includes(p.protocol));
  // Race all providers against a hard deadline
  const deadlinePromise = new Promise<never>((resolve) => {
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
      const text = `${p.text} ${p.author.displayName} ${p.author.bio} ${p.niches.join(' ')}`.toLowerCase();
      return text.includes(q);
    });

  const deduped = deduplicatePosts(filtered);
  const relevant = deduped.filter(isRelevantPost);
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
  } catch { /* ignore */ }

  return jsonResponse(response);
}

export async function handleSearchIdentity(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.toLowerCase().trim() ?? '';
  if (!q || q.length < 2) return jsonResponse({ error: 'Query too short' }, 400);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 5, 20);

  // Resolve via the identity package
  try {
    const { resolveHandle } = await import('@degenfeed/identity');
    const result = await resolveHandle(q);
    if (result) {
      return jsonResponse({
        data: [result],
        meta: { query: q, total: 1 },
      });
    }
  } catch { /* identity resolution unavailable */ }

  return jsonResponse({
    data: [],
    meta: { query: q, total: 0 },
  });
}
