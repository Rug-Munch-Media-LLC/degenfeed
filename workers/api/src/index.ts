/**
 * DegenFeed API Worker — Cloudflare Worker
 *
 * Feed proxy that aggregates from Nostr relays, Farcaster Hubs,
 * Lens API, and Bluesky PDS, normalizes to UnifiedPost, and
 * returns ranked feeds.
 *
 * ## Endpoints
 *
 *   GET /api/feed/home?protocols=nostr,farcaster&limit=25
 *     Home feed: recent posts from followed users across protocols.
 *
 *   GET /api/feed/trending?niches=crypto,ai&limit=25
 *     Trending feed: posts ranked by engagement across all protocols.
 *
 *   GET /api/identity/resolve?handle=jack@nostr.com
 *     Resolve a handle to its canonical identity.
 *
 *   GET /api/relays/health
 *     Health check for configured relays and hubs.
 *     KV caching (TODO): worker.degenfeed.cache
 *
 * ## Environment
 *
 *   KV_NAMESPACE (optional): CACHE for cross-region caching
 *   RELAY_URLS: comma-separated Nostr relay URLs
 *   FARCASTER_HUB_URL: Farcaster Hub URL
 *   LENS_API_URL: Lens GraphQL endpoint
 *   BSKY_PUBLIC_URL: Bluesky public API endpoint
 */

import { type NostrFilter, RelayPool } from '@degenfeed/nostr-sdk';
import { type RankingContext, rank } from '@degenfeed/ranking';
import type { Protocol, UnifiedPost } from '@degenfeed/types';

interface Env {
  CACHE?: KVNamespace;
  RELAY_URLS?: string;
  FARCASTER_HUB_URL?: string;
  LENS_API_URL?: string;
  BSKY_PUBLIC_URL?: string;
}

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route
      if (path === '/api/feed/home') {
        return handleHomeFeed(request, env);
      }
      if (path === '/api/feed/trending') {
        return handleTrendingFeed(request, env);
      }
      if (path === '/api/identity/resolve') {
        return handleResolveIdentity(request, env);
      }
      if (path === '/api/relays/health') {
        return handleRelaysHealth(env);
      }
      if (path === '/api/health') {
        return jsonResponse({ status: 'ok', service: 'degenfeed-api', version: '0.1.0' });
      }

      return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      return jsonResponse({ error: message }, 500);
    }
  },
};

// ─── Handlers ──────────────────────────────────────────────────────────

async function handleHomeFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const protocols = (params.get('protocols') ?? 'nostr,farcaster').split(',') as Protocol[];
  const limit = Number(params.get('limit')) || 25;

  const relayUrls = (env.RELAY_URLS ?? '').split(',').filter(Boolean);
  const pool = new RelayPool(relayUrls.length > 0 ? relayUrls : DEFAULT_RELAYS);

  // Fetch from Nostr
  let nostrPosts: UnifiedPost[] = [];
  if (protocols.includes('nostr')) {
    const filter: NostrFilter = {
      kinds: [1],
      limit: limit * 2,
    };
    const events = await pool.list(filter, 3000);
    // Convert events to UnifiedPost (simplified — no identity enrichment)
    nostrPosts = events.map((ev) => ({
      id: `nostr:${ev.id}`,
      protocol: 'nostr' as Protocol,
      author: {
        id: `nostr:${ev.pubkey}`,
        primary: { protocol: 'nostr', id: ev.pubkey },
        handles: { nostr: ev.pubkey, farcaster: null, lens: null, bluesky: null },
        displayName: ev.pubkey.slice(0, 12),
        bio: '',
        avatarUrl: '',
        verified: [],
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: { nostrPubkey: ev.pubkey },
      },
      text: ev.content,
      embeds: [],
      createdAt: ev.created_at * 1000,
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: ev,
      niches: [],
    }));
  }

  pool.disconnectAll();

  // Rank
  const ctx: RankingContext = {
    viewer: null,
    recentAuthors: new Map(),
    sourceQuality: new Map(),
    viewerNiches: new Set(),
    followed: new Set(),
    now: Date.now(),
  };

  const ranked = rank(nostrPosts, ctx).slice(0, limit);

  return jsonResponse({ data: ranked, meta: { total: ranked.length, limit } });
}

async function handleTrendingFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Number(params.get('limit')) || 25;

  const relayUrls = (env.RELAY_URLS ?? '').split(',').filter(Boolean);
  const pool = new RelayPool(relayUrls.length > 0 ? relayUrls : DEFAULT_RELAYS);

  // Fetch recent posts with engagement (kind 1 with lots of p-tags = replies)
  const filter: NostrFilter = {
    kinds: [1],
    limit: limit * 5,
  };
  const events = await pool.list(filter, 4000);
  pool.disconnectAll();

  // Simplified trending: just return recent Nostr posts ranked by engagement
  const posts: UnifiedPost[] = events.map((ev) => ({
    id: `nostr:${ev.id}`,
    protocol: 'nostr',
    author: {
      id: `nostr:${ev.pubkey}`,
      primary: { protocol: 'nostr', id: ev.pubkey },
      handles: { nostr: ev.pubkey, farcaster: null, lens: null, bluesky: null },
      displayName: ev.pubkey.slice(0, 12),
      bio: '',
      avatarUrl: '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { nostrPubkey: ev.pubkey },
    },
    text: ev.content,
    embeds: [],
    createdAt: ev.created_at * 1000,
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: ev,
    niches: [],
  }));

  const ctx: RankingContext = {
    viewer: null,
    recentAuthors: new Map(),
    sourceQuality: new Map(),
    viewerNiches: new Set(),
    followed: new Set(),
    now: Date.now(),
  };

  const ranked = rank(posts, ctx).slice(0, limit);

  return jsonResponse({ data: ranked, meta: { total: ranked.length, limit } });
}

async function handleResolveIdentity(request: Request, _env: Env): Promise<Response> {
  const handle = new URL(request.url).searchParams.get('handle');
  if (!handle) {
    return jsonResponse({ error: 'Missing handle parameter' }, 400);
  }

  // Dynamic import to avoid worker size issues
  const { resolveHandle } = await import('@degenfeed/identity');
  const result = await resolveHandle(handle);
  if (!result) {
    return jsonResponse({ error: 'Handle not found', handle }, 404);
  }

  return jsonResponse({ data: result });
}

async function handleRelaysHealth(env: Env): Promise<Response> {
  const relayUrls = (env.RELAY_URLS ?? '').split(',').filter(Boolean);
  const testRelays = relayUrls.length > 0 ? relayUrls : DEFAULT_RELAYS;

  const results = await Promise.allSettled(
    testRelays.map(async (url) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const ws = new WebSocket(url);
        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => {
            ws.close();
            resolve();
          };
          ws.onerror = () => reject(new Error('Connection failed'));
        });
        return { url, status: 'ok' as const };
      } finally {
        clearTimeout(timeout);
      }
    }),
  );

  const relays = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { url: '', status: 'error' as const },
  );

  return jsonResponse({ data: { relays } });
}

// ─── Response helpers ──────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/json',
    },
  });
}
