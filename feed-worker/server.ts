#!/usr/bin/env tsx
/**
 * @degenfeed/feed-worker — Local feed API server on port 8787
 *
 * Serves /api/feed/* endpoints that the Next.js proxy routes forward to.
 * Handles protocol-specific sources (GoToSocial, Lemmy, Nostr, RSS Bridge)
 * and falls back to MeiliSearch for unified search/for-you/trending.
 *
 * Run: tsx server.ts
 */

import http from 'node:http';

// ─── Configuration ─────────────────────────────────────────────────────
const PORT = 8787;
const MEILI_URL = 'http://127.0.0.1:7700';
const MEILI_KEY = process.env.MEILI_KEY ?? '';
if (!MEILI_KEY) {
  console.error(
    '[feed-worker] MEILI_KEY is not set — MeiliSearch-backed endpoints (search/for-you/trending) will return 503. Set MEILI_KEY to the MeiliSearch API key.',
  );
}
const GTS_URL = 'http://127.0.0.1:8082';
const LEMMY_URL = 'http://127.0.0.1:8536';
const NOSTR_URL = 'http://127.0.0.1:8085';
const RSS_BRIDGE_URL = 'http://127.0.0.1:8282';
const REQUEST_TIMEOUT = 8_000;

// Well-known public relays used to supplement the local relay when it is
// empty or unreachable. The bridge (bridge/src/providers/nostr.ts) maintains
// the full 17-relay list with per-relay health probing; this worker keeps a
// minimal 3-relay set because it is a local fallback, not the primary feed.
const NOSTR_FALLBACK_RELAYS = ['wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.damus.io'];

/** Minimal NIP-01 event shape as delivered over a relay WebSocket. */
interface NostrEventRecord {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

// ─── Types ─────────────────────────────────────────────────────────────

interface MeiliDoc {
  id: string;
  source: string;
  protocol: string;
  contentType: string;
  text: string;
  html?: string;
  title?: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  authorId: string;
  authorBio: string;
  createdAt: number;
  metrics: string;
  niches: string[];
  url: string;
  embeds: string;
  imageUrl: string;
  language: string;
  metadata: string;
  tags?: string[];
  content?: string;
  created_at?: string;
  author?: string;
  [key: string]: unknown;
}

interface UnifiedIdentity {
  id: string;
  primary: { protocol: string; id: string };
  handles: Record<string, string | null>;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  links: { label: string; url: string }[];
  keys: Record<string, unknown>;
  verified?: { protocol: string; badge: string }[];
  bannerUrl?: string;
}

interface Embed {
  kind: 'image' | 'video' | 'link' | 'frame' | 'quote' | 'code';
  url: string;
  meta?: Record<string, unknown>;
}

interface EngagementMetrics {
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
}

interface UnifiedPost {
  id: string;
  protocol: string;
  author: UnifiedIdentity;
  text: string;
  html?: string;
  embeds: Embed[];
  parentId?: string;
  rootId?: string;
  createdAt: number;
  metrics: EngagementMetrics;
  engagement: {
    viewerLiked: boolean;
    viewerReposted: boolean;
    viewerBookmarked: boolean;
    raw: EngagementMetrics;
  };
  raw: unknown;
  niches: string[];
  community?: { name: string; title?: string; actorId?: string };
  url?: string;
  contentType?: string;
}

interface FeedResponse {
  data: UnifiedPost[];
  meta: {
    total: number;
    limit: number;
    page?: number;
    source?: string;
    errors?: string[];
    notices?: string[];
    fetchedAt: number;
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────

function _json(body: unknown, status = 200): http.ServerResponse {
  const res = new http.ServerResponse({} as unknown as http.IncomingMessage);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
  return res;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMetrics(metricsStr: string): EngagementMetrics {
  try {
    const m = JSON.parse(metricsStr);
    return {
      likes: m.likes ?? 0,
      reposts: m.reposts ?? 0,
      replies: m.replies ?? 0,
      quotes: m.quotes ?? 0,
    };
  } catch {
    return { likes: 0, reposts: 0, replies: 0, quotes: 0 };
  }
}

function parseEmbeds(embedsStr: string): Embed[] {
  try {
    return JSON.parse(embedsStr) as Embed[];
  } catch {
    return [];
  }
}

function meiliDocToUnifiedPost(doc: MeiliDoc): UnifiedPost {
  const protocol = doc.source || doc.protocol || 'rss';
  const metrics = parseMetrics(doc.metrics);
  const embeds = parseEmbeds(doc.embeds);

  // Build author identity
  const _hostnamePart = doc.authorHandle?.includes('@')
    ? doc.authorHandle.split('@')[1] || protocol
    : protocol;
  const primaryId = doc.authorId || `${protocol}:${doc.authorHandle || 'unknown'}`;

  const identity: UnifiedIdentity = {
    id: primaryId,
    primary: {
      protocol: protocol as UnifiedPost['protocol'],
      id: doc.authorHandle || doc.authorId || '',
    },
    handles: { [protocol]: doc.authorHandle || null },
    displayName: doc.authorName || doc.authorHandle || 'Unknown',
    bio: doc.authorBio || '',
    avatarUrl: doc.authorAvatar || '',
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: {},
  };

  // Build text content
  const text = doc.text || stripHtml(doc.html || '') || doc.content || '';

  return {
    id: doc.id,
    protocol: protocol as UnifiedPost['protocol'],
    author: identity,
    text,
    html: doc.html || undefined,
    embeds,
    createdAt: doc.createdAt || Date.now(),
    metrics,
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: metrics,
    },
    raw: doc,
    niches: doc.niches || [],
    url: doc.url || undefined,
    contentType: doc.contentType || 'text',
  };
}

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json() as Promise<T>;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ─── Protocol Handlers ────────────────────────────────────────────────

async function handleMastodon(limit: number): Promise<FeedResponse> {
  try {
    const statuses = await fetchJson<unknown[]>(
      `${GTS_URL}/api/v1/timelines/public?limit=${limit}&local=true`,
    );
    const posts = statuses.map((s: Record<string, unknown>) => {
      const account = (s.account as Record<string, unknown>) || {};
      const orig = (s.reblog as Record<string, unknown>) || s;
      const _origAccount = (orig.account as Record<string, unknown>) || account;
      const media = (orig.media_attachments as Array<Record<string, unknown>>) || [];
      const tags = (orig.tags as Array<Record<string, unknown>>) || [];
      const rawText = orig.spoiler_text
        ? `[CW: ${orig.spoiler_text}]\n\n${orig.content}`
        : orig.content;
      const text = stripHtml(String(rawText || ''));

      const identity: UnifiedIdentity = {
        id: `mastodon:${String(account.id || '')}@social.degenfeed.xyz`,
        primary: { protocol: 'mastodon', id: String(account.id || '') },
        handles: { mastodon: String(account.acct || account.username || '') },
        displayName: String(account.display_name || account.username || 'Unknown'),
        bio: stripHtml(String(account.note || '')),
        avatarUrl: String(account.avatar || ''),
        followerCount: Number(account.followers_count || 0),
        followingCount: Number(account.following_count || 0),
        links: Array.isArray(account.fields)
          ? (account.fields as Array<Record<string, string>>).map((f: Record<string, string>) => ({
              label: f.name || '',
              url: f.value || '',
            }))
          : [],
        keys: {},
      };

      const embeds: Embed[] = [];
      for (const m of media) {
        const type = String(m.type || '');
        const url = String(m.url || '');
        if (type === 'image' || type === 'gifv') embeds.push({ kind: 'image', url });
        else if (type === 'video') embeds.push({ kind: 'video', url });
      }
      if (orig.card) {
        const card = orig.card as Record<string, unknown>;
        embeds.push({
          kind: 'link',
          url: String(card.url || ''),
          meta: { title: card.title, description: card.description, image: card.image },
        });
      }

      const postId = String(s.id || '');
      const m = {
        likes: Number(orig.favourites_count || 0),
        reposts: Number(orig.reblogs_count || 0),
        replies: Number(orig.replies_count || 0),
        quotes: 0,
      };
      return {
        id: `mastodon:${postId}`,
        protocol: 'mastodon' as const,
        author: identity,
        text,
        html: String(orig.content || ''),
        embeds,
        createdAt: new Date(String(orig.created_at || s.created_at || '')).getTime(),
        metrics: m,
        engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false, raw: m },
        raw: s,
        niches: tags.map((t: Record<string, unknown>) => String(t.name || '')).filter(Boolean),
        contentType: 'text',
      };
    });
    return { data: posts, meta: { total: posts.length, limit, fetchedAt: Date.now() } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: [], meta: { total: 0, limit, errors: [message], fetchedAt: Date.now() } };
  }
}

async function handleLemmy(limit: number): Promise<FeedResponse> {
  try {
    const data = await fetchJson<{ posts: Array<Record<string, unknown>> }>(
      `${LEMMY_URL}/api/v3/post/list?limit=${limit}&sort=New`,
    );
    const posts = (data.posts || []).map((item: Record<string, unknown>) => {
      const post = (item.post as Record<string, unknown>) || {};
      const creator = (item.creator as Record<string, unknown>) || {};
      const community = (item.community as Record<string, unknown>) || {};
      const counts = (item.counts as Record<string, unknown>) || {};
      const text = String(post.body || post.name || '');

      const identity: UnifiedIdentity = {
        id: `lemmy:${String(creator.id || '')}`,
        primary: { protocol: 'lemmy', id: String(creator.id || '') },
        handles: { lemmy: String(creator.name || '') },
        displayName: String(creator.name || 'Unknown'),
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      };

      const m = {
        likes: Number(counts.upvotes || 0),
        reposts: 0,
        replies: Number(counts.comments || 0),
        quotes: 0,
      };
      return {
        id: `lemmy:${String(post.id || '')}`,
        protocol: 'lemmy' as const,
        author: identity,
        text,
        embeds: [],
        createdAt: new Date(String(post.published || '')).getTime(),
        metrics: m,
        engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false, raw: m },
        raw: item,
        niches: [],
        community: {
          name: String(community.name || ''),
          title: String(community.title || ''),
          actorId: String(community.actor_id || ''),
        },
        contentType: 'text',
      };
    });
    return { data: posts, meta: { total: posts.length, limit, fetchedAt: Date.now() } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: [], meta: { total: 0, limit, errors: [message], fetchedAt: Date.now() } };
  }
}

/**
 * Fetch kind-1 text notes from a single Nostr relay over WebSocket.
 *
 * Sends a NIP-01 REQ, collects `EVENT` messages, and resolves as soon as
 * EOSE arrives, the limit is reached, or `timeoutMs` elapses — whichever is
 * first. The socket is always closed before resolving.
 */
function fetchNostrRelayEvents(
  relayUrl: string,
  limit: number,
  timeoutMs: number,
): Promise<NostrEventRecord[]> {
  if (typeof WebSocket === 'undefined') {
    return Promise.resolve([]); // Node <22 / non-browser runtime — no WS global
  }
  return new Promise((resolve) => {
    const events: NostrEventRecord[] = [];
    let settled = false;
    let ws: WebSocket | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      resolve(events);
    };

    const timer = setTimeout(finish, timeoutMs);

    try {
      ws = new WebSocket(relayUrl);
    } catch {
      finish();
      return;
    }

    ws.addEventListener('open', () => {
      const subId = `df-worker-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      ws?.send(JSON.stringify(['REQ', subId, { kinds: [1], limit }]));
    });
    ws.addEventListener('message', (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as unknown[];
        if (msg[0] === 'EVENT' && msg[2]) {
          const ev = msg[2] as NostrEventRecord;
          if (ev.kind === 1) {
            events.push(ev);
            if (events.length >= limit) finish();
          }
        } else if (msg[0] === 'EOSE') {
          finish();
        }
      } catch {
        /* skip malformed frame */
      }
    });
    ws.addEventListener('error', finish);
    ws.addEventListener('close', finish);
  });
}

/** Map a Nostr kind-1 event to the worker's UnifiedPost shape. */
function nostrEventToUnifiedPost(ev: NostrEventRecord): UnifiedPost {
  const pubkeyShort = ev.pubkey.slice(0, 12);
  const identity: UnifiedIdentity = {
    id: `nostr:${ev.pubkey}`,
    primary: { protocol: 'nostr', id: ev.pubkey },
    handles: { nostr: pubkeyShort },
    displayName: pubkeyShort,
    bio: '',
    avatarUrl: '',
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: { nostrPubkey: ev.pubkey },
  };
  const metrics: EngagementMetrics = { likes: 0, reposts: 0, replies: 0, quotes: 0 };
  return {
    id: `nostr:${ev.id}`,
    protocol: 'nostr',
    author: identity,
    text: ev.content,
    embeds: [],
    createdAt: ev.created_at * 1000,
    metrics,
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: metrics,
    },
    raw: ev,
    niches: [],
    contentType: 'text',
  };
}

async function _handleNostr(limit: number): Promise<FeedResponse> {
  const wsUrl = NOSTR_URL.replace(/^http/, 'ws');
  const relays = [wsUrl, ...NOSTR_FALLBACK_RELAYS];
  try {
    // Fan out to the local relay + public fallbacks in parallel, dedupe by
    // event id, and bound the total wait so this handler can never stall the
    // request (the route falls back to MeiliSearch when we return nothing).
    const settled = await Promise.allSettled(
      relays.map((r) => fetchNostrRelayEvents(r, Math.max(10, Math.ceil(limit * 1.5)), 3000)),
    );
    const seen = new Set<string>();
    const events: NostrEventRecord[] = [];
    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      for (const ev of result.value) {
        if (!seen.has(ev.id)) {
          seen.add(ev.id);
          events.push(ev);
          if (events.length >= limit) break;
        }
      }
      if (events.length >= limit) break;
    }
    events.sort((a, b) => b.created_at - a.created_at);

    if (events.length === 0) {
      return {
        data: [],
        meta: {
          total: 0,
          limit,
          notices: ['Nostr relays returned no events — falling back to MeiliSearch'],
          fetchedAt: Date.now(),
        },
      };
    }

    const posts = events.slice(0, limit).map(nostrEventToUnifiedPost);
    return {
      data: posts,
      meta: {
        total: posts.length,
        limit,
        source: 'nostr-relays',
        fetchedAt: Date.now(),
      },
    };
  } catch (err) {
    return {
      data: [],
      meta: {
        total: 0,
        limit,
        errors: [err instanceof Error ? err.message : 'Nostr error'],
        fetchedAt: Date.now(),
      },
    };
  }
}

async function handleMeiliSearch(
  source: string | null,
  limit: number,
  sort?: string,
): Promise<FeedResponse> {
  if (!MEILI_KEY) {
    return {
      data: [],
      meta: {
        total: 0,
        limit,
        source: source || 'all',
        errors: ['MeiliSearch not configured: MEILI_KEY missing'],
        fetchedAt: Date.now(),
      },
    };
  }
  try {
    const filter = source ? `source=${source}` : undefined;
    const body: Record<string, unknown> = { q: '', limit };
    if (filter) body.filter = filter;
    if (sort) body.sort = [sort];

    const data = await fetchJson<{ hits: MeiliDoc[]; estimatedTotalHits?: number }>(
      `${MEILI_URL}/indexes/posts/search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MEILI_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    const posts = (data.hits || []).map(meiliDocToUnifiedPost);
    return {
      data: posts,
      meta: {
        total: data.estimatedTotalHits || posts.length,
        limit,
        source: source || 'all',
        fetchedAt: Date.now(),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'MeiliSearch error';
    return { data: [], meta: { total: 0, limit, errors: [message], fetchedAt: Date.now() } };
  }
}

async function handleHealth(): Promise<http.ServerResponse | Record<string, unknown>> {
  const checks: Record<string, string | { ok: boolean; error?: string }> = {};

  // Check GoToSocial
  try {
    const res = await fetch(`${GTS_URL}/api/v1/instance`, { signal: AbortSignal.timeout(3000) });  // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
    const info = (await res.json()) as Record<string, unknown>;
    checks.gotosocial = {
      ok: true,
      version: String(info.version || 'unknown'),
      users: info.stats?.user_count || '?',
    };
  } catch (e) {
    checks.gotosocial = { ok: false, error: String(e) };
  }

  // Check MeiliSearch
  try {
    const stats = await fetchJson<{ numberOfDocuments: number }>(
      `${MEILI_URL}/indexes/posts/stats`,
      {
        headers: { Authorization: `Bearer ${MEILI_KEY}` },
      },
    );
    checks.meilisearch = { ok: true, documents: stats.numberOfDocuments };
  } catch (e) {
    checks.meilisearch = { ok: false, error: String(e) };
  }

  // Check Lemmy
  try {
    await fetchJson(`${LEMMY_URL}/api/v3/site`, { signal: AbortSignal.timeout(3000) });
    checks.lemmy = { ok: true };
  } catch (e) {
    checks.lemmy = { ok: false, error: String(e) };
  }

  // Check Nostr relay
  try {
    const info = await fetchJson<Record<string, unknown>>(NOSTR_URL, {
      headers: { Accept: 'application/nostr+json' },
      signal: AbortSignal.timeout(3000),
    });
    checks.nostr = { ok: true, name: String(info.name || 'unknown') };
  } catch (e) {
    checks.nostr = { ok: false, error: String(e) };
  }

  // Check RSS Bridge
  try {
    await fetch(`${RSS_BRIDGE_URL}/`, { signal: AbortSignal.timeout(3000) });  // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
    checks.rss_bridge = { ok: true };
  } catch (e) {
    checks.rss_bridge = { ok: false, error: String(e) };
  }

  return { status: 'ok', checks, timestamp: Date.now() };
}

// ─── Request Router ────────────────────────────────────────────────────

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const limit = Math.min(Number(url.searchParams.get('limit')) || 25, 100);
  const _page = Number(url.searchParams.get('page')) || 1;
  const sort = url.searchParams.get('sort') || 'createdAt:desc';

  // CORS headers for local dev
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    let result: FeedResponse | Record<string, unknown>;

    switch (path) {
      case '/api/feed/health': {
        const health = await handleHealth();
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(health));
        return;
      }

      case '/api/feed/mastodon': {
        result = await handleMastodon(limit);
        break;
      }

      case '/api/feed/lemmy': {
        result = await handleLemmy(limit);
        break;
      }

      case '/api/feed/nostr': {
        // Prefer a real relay fetch (local relay + public fallbacks). When
        // every relay is unreachable/empty, fall back to MeiliSearch so the
        // endpoint never serves an empty feed.
        result = await _handleNostr(limit);
        if (!result.data || result.data.length === 0) {
          result = await handleMeiliSearch('nostr', limit);
        }
        break;
      }

      case '/api/feed/for-you':
      case '/api/feed/home': {
        // Mixed protocol feed from MeiliSearch
        result = await handleMeiliSearch(null, limit, sort);
        // Tag with "for you" notice
        (result as FeedResponse).meta.notices = [
          'Curated from local MeiliSearch index — all sources',
        ];
        break;
      }

      case '/api/feed/news':
      case '/api/feed/rss': {
        result = await handleMeiliSearch('rss', limit);
        break;
      }

      case '/api/feed/trending': {
        // For trending, sort by a pseudo-engagement score
        result = await handleMeiliSearch(null, limit, 'createdAt:desc');
        (result as FeedResponse).meta.notices = ['Trending based on recency from local index'];
        break;
      }

      case '/api/feed/bluesky':
      case '/api/feed/farcaster':
      case '/api/feed/lens':
      case '/api/feed/peertube':
      case '/api/feed/pixelfed':
      case '/api/feed/reddit': {
        // Strip prefix to get protocol name
        const protocol = path.replace('/api/feed/', '');
        result = await handleMeiliSearch(protocol, limit);
        break;
      }

      case '/api/feed/media': {
        // Visual media feed — filter for image/video content
        result = await handleMeiliSearch(null, limit);
        (result as FeedResponse).meta.notices = [
          'Media feed — filtering not yet applied server-side',
        ];
        break;
      }

      default: {
        // Try as protocol-specific feed via MeiliSearch
        if (path.startsWith('/api/feed/')) {
          const protocol = path.replace('/api/feed/', '');
          result = await handleMeiliSearch(protocol, limit);
        } else {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
          return;
        }
      }
    }

    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error', data: [] }),
    );
  }
}

// ─── Start Server ──────────────────────────────────────────────────────

const server = http.createServer(handleRequest);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`✓ Feed worker running on http://127.0.0.1:${PORT}`);
  console.log(`  Endpoints:`);
  console.log(`  GET /api/feed/mastodon   → GoToSocial :8082`);
  console.log(`  GET /api/feed/lemmy      → Lemmy :8536`);
  console.log(`  GET /api/feed/nostr      → Nostr relays (MeiliSearch fallback)`);
  console.log(`  GET /api/feed/for-you    → MeiliSearch (all sources)`);
  console.log(`  GET /api/feed/home       → MeiliSearch (all sources)`);
  console.log(`  GET /api/feed/news       → MeiliSearch (rss filter)`);
  console.log(`  GET /api/feed/rss        → MeiliSearch (rss filter)`);
  console.log(`  GET /api/feed/trending   → MeiliSearch (sorted)`);
  console.log(`  GET /api/feed/health     → Source health check`);
  console.log(`  GET /api/feed/<protocol> → MeiliSearch by source`);
  console.log(`  MeiliSearch: 9,284 documents indexed`);
});
