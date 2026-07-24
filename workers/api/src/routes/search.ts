/**
 * /api/search — Federated cross-protocol search.
 *
 * Queries ALL supported protocols in parallel (Nostr, Farcaster, Lens,
 * Bluesky, Mastodon, Lemmy, PeerTube, RSS) plus the local MeiliSearch
 * index, then deduplicates and ranks results by relevance.
 *
 * Endpoints:
 *   GET /api/search?q=bitcoin&limit=50&protocols=nostr,farcaster,lemmy,peertube
 *   GET /api/search/identity?q=handle&limit=5
 *
 * Response shape:
 *   { data: Post[], identities: Identity[], communities: Community[],
 *     videos: Video[], meta: { total, query, limit, protocols, sources } }
 */

import { detectNiches, isSpamPost } from '@degenfeed/feed-core';
import { RssProvider } from '@degenfeed/feed-providers';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { type Env, jsonResponse } from '../index';

// ─── Constants ────────────────────────────────────────────────────

const SEARCHABLE_SOURCES = [
  'rss',
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'lemmy',
  'peertube',
] as const;
type SearchSource = (typeof SEARCHABLE_SOURCES)[number];
const DEFAULT_SOURCES: SearchSource[] = [...SEARCHABLE_SOURCES];

// Own instances — trusted, no rate limiting needed.
const LEMMY_OWN_URL = 'https://community.degenfeed.xyz';
const PEERTUBE_OWN_URL = 'https://video.degenfeed.xyz';
const MASTODON_OWN_URL = 'https://social.degenfeed.xyz';

const USER_AGENT = 'DegenFeed/0.1 (+https://degenfeed.xyz)';
const FETCHER_TIMEOUT_MS = 3500;
// Hard deadline for the entire federated fan-out.
const HARD_DEADLINE_MS = 5000;

/**
 * Relevance ranking protocol weights.
 * Nostr=1, Farcaster=1, Lens=0.8, Bluesky=0.8, Mastodon=0.6.
 */
const PROTOCOL_WEIGHT: Record<string, number> = {
  nostr: 1,
  farcaster: 1,
  lens: 0.8,
  bluesky: 0.8,
  mastodon: 0.6,
  lemmy: 0.7,
  reddit: 0.7,
  rss: 0.6,
};

// ─── Result shapes ────────────────────────────────────────────────

export interface FederatedPost {
  id: string;
  protocol: string;
  author: { displayName: string; avatarUrl: string | null };
  text: string;
  url: string | null;
  image: string | null;
  niches: string[];
  createdAt: number;
  metrics: { likes: number; reposts: number; replies: number; quotes: number };
  verified?: boolean;
  score?: number;
}

export interface CommunityResult {
  id: string;
  name: string;
  protocol: string;
  description: string;
  memberCount: number;
  url: string;
  icon: string | null;
}

export interface VideoResult {
  id: string;
  title: string;
  source: string;
  channelName: string;
  thumbnailUrl: string | null;
  url: string;
  views: number;
  durationSeconds: number;
  publishedAt: number;
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

export interface FederatedResults {
  posts: FederatedPost[];
  identities: IdentitySearchResult[];
  communities: CommunityResult[];
  videos: VideoResult[];
  sources: Record<string, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────

async function fetchJsonWithTimeout<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = FETCHER_TIMEOUT_MS,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/json',
        ...init.headers,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function unifiedToFederated(p: UnifiedPost): FederatedPost {
  return {
    id: p.id,
    protocol: p.protocol,
    author: {
      displayName: p.author.displayName,
      avatarUrl: p.author.avatarUrl || null,
    },
    text: p.text,
    url: p.embeds.find((e) => e.kind === 'link')?.url ?? null,
    image: p.embeds.find((e) => e.kind === 'image')?.url ?? null,
    niches: p.niches,
    createdAt: p.createdAt,
    metrics: {
      likes: p.metrics.likes,
      reposts: p.metrics.reposts,
      replies: p.metrics.replies,
      quotes: p.metrics.quotes,
    },
    verified: p.author.verified.length > 0,
  };
}

// ─── Relevance ranking ────────────────────────────────────────────
//
// Scoring model:
//   Exact phrase match:      +10  (partial word matches scale up to +6)
//   Engagement:              up to +5 (log-scaled likes + 2×reposts)
//   Recency:                 +3 (<24h), +1 (<7d)
//   Source authority:        +2 (verified accounts)
//   Protocol weight:         multiplier (nostr/farcaster=1, lens/bluesky=0.8, mastodon=0.6)

export function relevanceScore(post: FederatedPost, query: string): number {
  const q = query.toLowerCase().trim();
  const text = post.text.toLowerCase();
  let score = 0;

  if (q && text.includes(q)) {
    score += 10;
  } else if (q) {
    const words = q.split(/\s+/).filter((w) => w.length > 1);
    if (words.length > 0) {
      const matched = words.filter((w) => text.includes(w)).length;
      score += (matched / words.length) * 6;
    }
  }

  const engagement = post.metrics.likes + post.metrics.reposts * 2;
  if (engagement > 0) score += Math.min(5, Math.log10(1 + engagement) * 2.5);

  const age = Date.now() - post.createdAt;
  if (age >= 0 && age < 86_400_000) score += 3;
  else if (age >= 0 && age < 7 * 86_400_000) score += 1;

  if (post.verified) score += 2;

  return score * (PROTOCOL_WEIGHT[post.protocol] ?? 0.5);
}

/** Dedup key: normalized content prefix + author. Keeps highest-ranked duplicate. */
function dedupKey(post: FederatedPost): string {
  const content = post.text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 100);
  const author = post.author.displayName.toLowerCase().replace(/\s+/g, '');
  return `${content}|${author}`;
}

export function deduplicateAndRank(posts: FederatedPost[], query: string): FederatedPost[] {
  const best = new Map<string, FederatedPost>();
  for (const post of posts) {
    const scored = { ...post, score: relevanceScore(post, query) };
    const key = dedupKey(scored);
    const existing = best.get(key);
    if (!existing || (scored.score ?? 0) > (existing.score ?? 0)) {
      best.set(key, scored);
    }
  }
  return Array.from(best.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

// ─── Protocol search fetchers ─────────────────────────────────────

/** Nostr full-text search via nostr.band. */
async function searchNostr(query: string): Promise<FederatedPost[]> {
  const data = await fetchJsonWithTimeout<{
    posts?: Array<Record<string, unknown>>;
    notes?: Array<Record<string, unknown>>;
  }>(`https://api.nostr.band/v0/search/posts?q=${encodeURIComponent(query)}&limit=20`);
  const items = data?.posts ?? data?.notes ?? [];
  const posts: FederatedPost[] = [];
  for (const p of items) {
    const id = (p.id as string) ?? '';
    const text = (p.content as string) ?? (p.text as string) ?? '';
    if (!id || !text) continue;
    const author = (p.author ?? p.profile ?? {}) as Record<string, unknown>;
    const createdAtRaw = (p.created_at as number) ?? 0;
    posts.push({
      id: `nostr:${id}`,
      protocol: 'nostr',
      author: {
        displayName:
          (author.display_name as string) ||
          (author.name as string) ||
          `${((p.pubkey as string) ?? '').slice(0, 8)}…`,
        avatarUrl: (author.picture as string) || null,
      },
      text,
      url: null,
      image: null,
      niches: detectNiches(text),
      createdAt: createdAtRaw > 1e12 ? createdAtRaw : createdAtRaw * 1000,
      metrics: {
        likes: (p.reactions_count as number) ?? 0,
        reposts: (p.reposts_count as number) ?? 0,
        replies: (p.replies_count as number) ?? 0,
        quotes: 0,
      },
      verified: Boolean(author.nip05),
    });
  }
  return posts;
}

/** Farcaster cast search via the free public API (Neynar-compatible). */
async function searchFarcaster(query: string, env: Env): Promise<FederatedPost[]> {
  const base = env.FARCASTER_HUB_URL?.startsWith('https://api.')
    ? env.FARCASTER_HUB_URL
    : 'https://api.farcaster.xyz';
  const data = await fetchJsonWithTimeout<{
    result?: {
      casts?: Array<{
        hash: string;
        fid?: number;
        text?: string;
        timestamp?: number;
        author?: {
          fid?: number;
          username?: string;
          displayName?: string;
          pfp?: { url?: string };
        };
        reactions?: { count?: number };
        recasts?: { count?: number };
        replies?: { count?: number };
      }>;
    };
  }>(`${base}/v2/cast-search?q=${encodeURIComponent(query)}&limit=20`);
  const posts: FederatedPost[] = [];
  for (const c of data?.result?.casts ?? []) {
    const fid = c.fid ?? c.author?.fid;
    if (!fid || !c.text || !c.hash) continue;
    posts.push({
      id: `farcaster:${c.hash}`,
      protocol: 'farcaster',
      author: {
        displayName: c.author?.displayName || c.author?.username || `FID ${fid}`,
        avatarUrl: c.author?.pfp?.url || null,
      },
      text: c.text,
      url: null,
      image: null,
      niches: detectNiches(c.text),
      createdAt: c.timestamp ? (c.timestamp > 1e12 ? c.timestamp : c.timestamp * 1000) : Date.now(),
      metrics: {
        likes: c.reactions?.count ?? 0,
        reposts: c.recasts?.count ?? 0,
        replies: c.replies?.count ?? 0,
        quotes: 0,
      },
    });
  }
  return posts;
}

/** Lens post search via the public GraphQL API. */
async function searchLens(query: string, env: Env): Promise<FederatedPost[]> {
  const apiUrl = env.LENS_API_URL || 'https://api.lens.xyz/graphql';
  const data = await fetchJsonWithTimeout<{
    data?: {
      posts?: {
        items?: Array<{
          id: string;
          metadata?: {
            content?: string;
            asset?: { image?: { raw?: { uri?: string } } };
          };
          author?: {
            username?: { localName?: string };
            metadata?: { displayName?: string; picture?: string };
          };
          createdAt?: string;
          stats?: {
            reactions?: number;
            comments?: number;
            mirrors?: number;
            quotes?: number;
          };
        }>;
      };
    };
  }>(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query:
        'query($q:String!){posts(request:{filter:{searchQuery:$q},pageSize:FIFTY}){items{id metadata{content asset{...on PostMetadataMediaImage{image{raw{uri}}}}} author{username{localName}metadata{displayName picture}} createdAt stats{reactions comments mirrors quotes}}}}',
      variables: { q: query },
    }),
  });
  const posts: FederatedPost[] = [];
  for (const item of (data?.data?.posts?.items ?? []).slice(0, 20)) {
    const text = item.metadata?.content ?? '';
    if (!item.id || !text) continue;
    posts.push({
      id: `lens:${item.id}`,
      protocol: 'lens',
      author: {
        displayName:
          item.author?.metadata?.displayName || item.author?.username?.localName || 'lens user',
        avatarUrl: item.author?.metadata?.picture || null,
      },
      text,
      url: null,
      image: item.metadata?.asset?.image?.raw?.uri ?? null,
      niches: detectNiches(text),
      createdAt: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
      metrics: {
        likes: item.stats?.reactions ?? 0,
        reposts: item.stats?.mirrors ?? 0,
        replies: item.stats?.comments ?? 0,
        quotes: item.stats?.quotes ?? 0,
      },
    });
  }
  return posts;
}

/** Bluesky post search via the public AppView. */
async function searchBluesky(query: string, env: Env): Promise<FederatedPost[]> {
  const base = env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';
  const data = await fetchJsonWithTimeout<{
    posts?: Array<{
      uri: string;
      author: {
        did: string;
        handle: string;
        displayName?: string;
        avatar?: string;
      };
      record: { text: string; createdAt: string };
      likeCount?: number;
      repostCount?: number;
      replyCount?: number;
    }>;
  }>(`${base}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=20&sort=latest`);
  const posts: FederatedPost[] = [];
  for (const p of data?.posts ?? []) {
    if (!p.uri || !p.record?.text) continue;
    posts.push({
      id: `bluesky:${p.uri}`,
      protocol: 'bluesky',
      author: {
        displayName: p.author.displayName || p.author.handle,
        avatarUrl: p.author.avatar || null,
      },
      text: p.record.text,
      url: null,
      image: null,
      niches: detectNiches(p.record.text),
      createdAt: new Date(p.record.createdAt).getTime(),
      metrics: {
        likes: p.likeCount ?? 0,
        reposts: p.repostCount ?? 0,
        replies: p.replyCount ?? 0,
        quotes: 0,
      },
    });
  }
  return posts;
}

/** Mastodon status search via our own instance (trusted, resolve enabled). */
async function searchMastodon(query: string): Promise<FederatedPost[]> {
  const data = await fetchJsonWithTimeout<{
    statuses?: Array<{
      id: string;
      content: string;
      url?: string;
      created_at: string;
      favourites_count?: number;
      reblogs_count?: number;
      replies_count?: number;
      account?: {
        display_name?: string;
        username?: string;
        avatar?: string;
        bot?: boolean;
      };
      media_attachments?: Array<{
        type: string;
        preview_url?: string;
        url?: string;
      }>;
    }>;
  }>(
    `${MASTODON_OWN_URL}/api/v2/search?q=${encodeURIComponent(query)}&type=statuses&limit=20&resolve=true`,
  );
  const posts: FederatedPost[] = [];
  for (const s of data?.statuses ?? []) {
    const text = stripHtml(s.content ?? '');
    if (!s.id || !text) continue;
    const image = s.media_attachments?.find((m) => m.type === 'image');
    posts.push({
      id: `mastodon:${s.id}`,
      protocol: 'mastodon',
      author: {
        displayName: s.account?.display_name || s.account?.username || 'mastodon user',
        avatarUrl: s.account?.avatar || null,
      },
      text,
      url: s.url ?? null,
      image: image?.preview_url ?? image?.url ?? null,
      niches: detectNiches(text),
      createdAt: new Date(s.created_at).getTime(),
      metrics: {
        likes: s.favourites_count ?? 0,
        reposts: s.reblogs_count ?? 0,
        replies: s.replies_count ?? 0,
        quotes: 0,
      },
    });
  }
  return posts;
}

interface LemmySearchResponse {
  posts?: Array<{
    post: {
      id: number;
      name: string;
      body?: string;
      url?: string;
      published: string;
    };
    creator?: {
      id: number;
      name: string;
      display_name?: string;
      avatar?: string;
    };
    community?: { name: string; title?: string };
    counts?: { score?: number; upvotes?: number; comments?: number };
  }>;
  communities?: Array<{
    community: {
      id: number;
      name: string;
      title?: string;
      description?: string;
      icon?: string;
      actor_id?: string;
    };
    counts?: { subscribers?: number };
  }>;
}

/** Lemmy post search via our own instance (trusted). */
async function searchLemmyPosts(query: string): Promise<FederatedPost[]> {
  const data = await fetchJsonWithTimeout<LemmySearchResponse>(
    `${LEMMY_OWN_URL}/api/v3/search?q=${encodeURIComponent(query)}&type_=Posts&limit=20`,
  );
  const posts: FederatedPost[] = [];
  for (const pv of data?.posts ?? []) {
    const post = pv.post;
    if (!post?.id || !post.name) continue;
    const communityTitle = pv.community?.title || pv.community?.name || '';
    const text = communityTitle ? `${post.name} [${communityTitle}]` : post.name;
    posts.push({
      id: `lemmy:lemmy:${pv.community?.name ?? '?'}:${post.id}`,
      protocol: 'lemmy',
      author: {
        displayName: pv.creator?.display_name || pv.creator?.name || 'anon',
        avatarUrl: pv.creator?.avatar || null,
      },
      text,
      url: post.url ?? null,
      image: null,
      niches: detectNiches(`${post.name} ${post.body ?? ''}`),
      createdAt: new Date(post.published).getTime(),
      metrics: {
        likes: pv.counts?.upvotes ?? pv.counts?.score ?? 0,
        reposts: 0,
        replies: pv.counts?.comments ?? 0,
        quotes: 0,
      },
    });
  }
  return posts;
}

/** Lemmy community search via our own instance (trusted). */
async function searchLemmyCommunities(query: string): Promise<CommunityResult[]> {
  const data = await fetchJsonWithTimeout<LemmySearchResponse>(
    `${LEMMY_OWN_URL}/api/v3/search?q=${encodeURIComponent(query)}&type_=Communities&limit=20`,
  );
  const communities: CommunityResult[] = [];
  for (const cv of data?.communities ?? []) {
    const c = cv.community;
    if (!c?.id || !c.name) continue;
    communities.push({
      id: `lemmy:${c.name}`,
      name: c.title || c.name,
      protocol: 'lemmy',
      description: (c.description ?? '').slice(0, 200),
      memberCount: cv.counts?.subscribers ?? 0,
      url: c.actor_id ?? `${LEMMY_OWN_URL}/c/${c.name}`,
      icon: c.icon ?? null,
    });
  }
  return communities;
}

/** PeerTube video search via our own instance (trusted). */
async function searchPeerTube(query: string): Promise<VideoResult[]> {
  const data = await fetchJsonWithTimeout<{
    data?: Array<{
      id: number;
      uuid: string;
      name: string;
      duration?: number;
      views?: number;
      publishedAt?: string;
      thumbnailPath?: string;
      url?: string;
      channel?: { displayName?: string; name?: string };
    }>;
  }>(`${PEERTUBE_OWN_URL}/api/v1/search/videos?search=${encodeURIComponent(query)}&count=20`);
  const videos: VideoResult[] = [];
  for (const v of data?.data ?? []) {
    if (!v.uuid || !v.name) continue;
    videos.push({
      id: `peertube:${v.uuid}`,
      title: v.name,
      source: 'peertube',
      channelName: v.channel?.displayName || v.channel?.name || '',
      thumbnailUrl: v.thumbnailPath ? `${PEERTUBE_OWN_URL}${v.thumbnailPath}` : null,
      url: v.url ?? `${PEERTUBE_OWN_URL}/w/${v.uuid}`,
      views: v.views ?? 0,
      durationSeconds: v.duration ?? 0,
      publishedAt: v.publishedAt ? new Date(v.publishedAt).getTime() : 0,
    });
  }
  return videos;
}

/** RSS: fetch curated crypto feeds and filter by query text. */
async function searchRss(query: string): Promise<FederatedPost[]> {
  try {
    const rss = new RssProvider({
      feeds: [
        'https://cointelegraph.com/rss',
        'https://decrypt.co/feed',
        'https://bitcoinmagazine.com/.rss/full/',
        'https://www.theblock.co/rss',
      ],
    });
    const result = await rss.fetchFeed({ timeoutMs: FETCHER_TIMEOUT_MS });
    const q = query.toLowerCase();
    return result.posts
      .filter((p) => !isSpamPost(p))
      .filter((p) => `${p.text} ${p.author.displayName}`.toLowerCase().includes(q))
      .map(unifiedToFederated);
  } catch {
    return [];
  }
}

// ─── MeiliSearch (local index) ────────────────────────────────────

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

async function searchLocal(
  query: string,
  options: { protocols?: string[]; category?: string; limit?: number } = {},
): Promise<FederatedPost[]> {
  try {
    const filters: string[] = [];
    if (options.protocols?.length && options.protocols.length < SEARCHABLE_SOURCES.length) {
      const vals = options.protocols.map((p) => JSON.stringify(p)).join(', ');
      filters.push(`protocol IN [${vals}]`);
    }
    if (options.category) filters.push(`niches = ${JSON.stringify(options.category)}`);

    const body: Record<string, unknown> = {
      q: query,
      limit: options.limit ?? 25,
    };
    if (filters.length > 0) body.filter = filters.join(' AND ');

    const res = await fetch(`${MEILISEARCH_URL}/indexes/posts/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { hits: MeiliSearchHit[] };
    return (data.hits ?? []).map((h) => ({
      id: h.originalId ?? h.id,
      protocol: h.protocol,
      author: {
        displayName: h.authorDisplayName,
        avatarUrl: h.authorAvatarUrl,
      },
      text: h.text,
      url: h.url,
      image: h.image,
      niches: h.niches ?? [],
      createdAt: h.createdAt,
      metrics: {
        likes: h.likes,
        reposts: h.reposts,
        replies: h.replies,
        quotes: h.quotes,
      },
    }));
  } catch {
    return [];
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

// ─── Identity search ──────────────────────────────────────────────

async function searchIdentities(
  query: string,
  _env: Env,
  limit = 10,
): Promise<IdentitySearchResult[]> {
  // Primary: MeiliSearch posts index aggregated by author.
  try {
    const meiliRes = await fetch(`${MEILISEARCH_URL}/indexes/posts/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        q: query,
        limit: 100,
        attributesToSearchOn: ['authorDisplayName', 'authorBio'],
      }),
    });
    if (meiliRes.ok) {
      const meiliData = (await meiliRes.json()) as { hits: MeiliSearchHit[] };
      const seen = new Map<string, IdentitySearchResult>();
      for (const h of meiliData.hits ?? []) {
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
      if (seen.size > 0) return Array.from(seen.values());
    }
  } catch {
    /* MeiliSearch identity search unavailable */
  }

  // Fallback: exact handle resolution via identity package.
  try {
    const { resolveHandle } = await import('@degenfeed/identity');
    const result = await resolveHandle(query);
    if (result) {
      return [
        {
          id: `${result.protocol}:${result.id}`,
          protocol: result.protocol,
          displayName: result.handle,
          handle: result.handle,
          avatarUrl: null,
          bio: '',
          postCount: 0,
        },
      ];
    }
  } catch {
    /* identity resolution unavailable */
  }
  return [];
}

// ─── Federated search orchestrator ────────────────────────────────

export async function federatedSearch(
  query: string,
  sources: SearchSource[],
  env: Env,
  limit = 50,
): Promise<FederatedResults> {
  const results: FederatedResults = {
    posts: [],
    identities: [],
    communities: [],
    videos: [],
    sources: {},
  };

  const track = (source: string, count: number) => {
    results.sources[source] = (results.sources[source] ?? 0) + count;
  };

  const fetchers: Promise<void>[] = [];

  for (const source of sources) {
    switch (source) {
      case 'nostr':
        fetchers.push(
          searchNostr(query).then((p) => {
            results.posts.push(...p);
            track('nostr', p.length);
          }),
        );
        break;
      case 'farcaster':
        fetchers.push(
          searchFarcaster(query, env).then((p) => {
            results.posts.push(...p);
            track('farcaster', p.length);
          }),
        );
        break;
      case 'lens':
        fetchers.push(
          searchLens(query, env).then((p) => {
            results.posts.push(...p);
            track('lens', p.length);
          }),
        );
        break;
      case 'bluesky':
        fetchers.push(
          searchBluesky(query, env).then((p) => {
            results.posts.push(...p);
            track('bluesky', p.length);
          }),
        );
        break;
      case 'mastodon':
        fetchers.push(
          searchMastodon(query).then((p) => {
            results.posts.push(...p);
            track('mastodon', p.length);
          }),
        );
        break;
      case 'lemmy':
        fetchers.push(
          searchLemmyPosts(query).then((p) => {
            results.posts.push(...p);
            track('lemmy', p.length);
          }),
          searchLemmyCommunities(query).then((c) => {
            results.communities.push(...c);
            track('lemmy:communities', c.length);
          }),
        );
        break;
      case 'peertube':
        fetchers.push(
          searchPeerTube(query).then((v) => {
            results.videos.push(...v);
            track('peertube', v.length);
          }),
        );
        break;
      case 'rss':
        fetchers.push(
          searchRss(query).then((p) => {
            results.posts.push(...p);
            track('rss', p.length);
          }),
        );
        break;
    }
  }

  // Always search the local MeiliSearch index and identities.
  fetchers.push(
    searchLocal(query, { protocols: sources, limit }).then((p) => {
      results.posts.push(...p);
      track('local', p.length);
    }),
    searchIdentities(query, env, 12).then((i) => {
      results.identities.push(...i);
      track('identities', i.length);
    }),
  );

  // Race everything against a hard deadline so slow protocols never block the edge.
  const deadline = new Promise<void>((resolve) => setTimeout(resolve, HARD_DEADLINE_MS));
  await Promise.race([Promise.allSettled(fetchers).then(() => undefined), deadline]);

  results.posts = deduplicateAndRank(results.posts, query).slice(0, limit);
  results.videos.sort((a, b) => b.views - a.views || b.publishedAt - a.publishedAt);
  results.communities.sort((a, b) => b.memberCount - a.memberCount);

  return results;
}

// ─── HTTP handlers ────────────────────────────────────────────────

export async function handleSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.toLowerCase().trim() ?? '';
  if (!q || q.length < 2) return jsonResponse({ error: 'Query too short (min 2 chars)' }, 400);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
  const protocolsParam = url.searchParams.get('protocols') ?? '';
  const sources = protocolsParam
    ? protocolsParam
        .split(',')
        .map((p) => p.trim())
        .filter((p): p is SearchSource => (SEARCHABLE_SOURCES as readonly string[]).includes(p))
    : DEFAULT_SOURCES;

  const cacheKey = `search:v2:${q}:${sources.join(',')}:${limit}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* KV operation failed -- non-critical, continue */
  }

  const results = await federatedSearch(q, sources, env, limit);

  const response = {
    data: results.posts.map((p) => ({ ...p, text: p.text.slice(0, 300) })),
    identities: results.identities,
    communities: results.communities,
    videos: results.videos,
    meta: {
      total: results.posts.length,
      query: q,
      limit,
      protocols: sources as string[] as Protocol[],
      sources: results.sources,
    },
  };

  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), {
      expirationTtl: 120,
    });
  } catch {
    /* KV operation failed -- non-critical, continue */
  }

  return jsonResponse(response);
}

export async function handleSearchIdentity(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.toLowerCase().trim() ?? '';
  if (!q || q.length < 2) return jsonResponse({ error: 'Query too short' }, 400);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);

  const data = await searchIdentities(q, env, limit);
  return jsonResponse({ data, meta: { query: q, total: data.length } });
}

// ─── GET /api/search/autocomplete — Smart autocomplete ───────────

export async function handleSearchAutocomplete(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (!q || q.length < 2) {
    return jsonResponse({ suggestions: [] });
  }

  const cacheKey = `search:ac:${q}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* cache miss */
  }

  const { CrossNetworkSearch } = await import('../lib/cross-search');
  const engine = new CrossNetworkSearch(env);
  const suggestions = await engine.autocomplete(q);

  const response = { suggestions };
  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 60 });
  } catch {
    /* non-critical */
  }

  return jsonResponse(response);
}

// ─── GET /api/search/creators — Find creators across all networks ──

export async function handleSearchCreators(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.toLowerCase().trim() ?? '';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50);

  if (!q || q.length < 2) {
    return jsonResponse({ data: [], meta: { total: 0 } });
  }

  const cacheKey = `search:creators:${q}:${limit}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* cache miss */
  }

  const { CrossNetworkSearch } = await import('../lib/cross-search');
  const _engine = new CrossNetworkSearch(env);

  // Creators = identity search across all protocols + local index
  const [identities, localPosts] = await Promise.all([
    searchIdentities(q, env, limit),
    searchLocal(q, { limit }),
  ]);

  // Aggregate unique creators from posts
  const creatorMap = new Map<
    string,
    {
      id: string;
      protocol: string;
      displayName: string;
      avatarUrl: string | null;
      bio: string;
      postCount: number;
      totalEngagement: number;
      niches: string[];
    }
  >();

  for (const post of localPosts) {
    const key = `${post.protocol}:${post.author.displayName}`;
    const existing = creatorMap.get(key);
    const eng = post.metrics.likes + post.metrics.reposts * 2;
    if (existing) {
      existing.postCount++;
      existing.totalEngagement += eng;
      for (const n of post.niches) {
        if (!existing.niches.includes(n)) existing.niches.push(n);
      }
    } else {
      creatorMap.set(key, {
        id: key,
        protocol: post.protocol,
        displayName: post.author.displayName,
        avatarUrl: post.author.avatarUrl,
        bio: '',
        postCount: 1,
        totalEngagement: eng,
        niches: [...post.niches],
      });
    }
  }

  // Merge with identity results
  for (const identity of identities) {
    const key = `${identity.protocol}:${identity.displayName}`;
    if (!creatorMap.has(key)) {
      creatorMap.set(key, {
        id: key,
        protocol: identity.protocol,
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl,
        bio: identity.bio,
        postCount: identity.postCount,
        totalEngagement: 0,
        niches: [],
      });
    }
  }

  const creators = Array.from(creatorMap.values())
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, limit);

  const response = { data: creators, meta: { total: creators.length, query: q } };
  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 120 });
  } catch {
    /* non-critical */
  }

  return jsonResponse(response);
}

// ─── GET /api/search/coins — Search creator coins ────────────────

export async function handleSearchCoins(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50);

  if (!q || q.length < 2) {
    return jsonResponse({ data: [], meta: { total: 0 } });
  }

  const cacheKey = `search:coins:${q}:${limit}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* cache miss */
  }

  const { CrossNetworkSearch } = await import('../lib/cross-search');
  const engine = new CrossNetworkSearch(env);
  const coins = await engine.searchZora(q);

  const response = { data: coins.slice(0, limit), meta: { total: coins.length, query: q } };
  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 120 });
  } catch {
    /* non-critical */
  }

  return jsonResponse(response);
}

// ─── GET /api/search/communities — Search communities ────────────

export async function handleSearchCommunities(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.toLowerCase().trim() ?? '';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50);

  if (!q || q.length < 2) {
    return jsonResponse({ data: [], meta: { total: 0 } });
  }

  const cacheKey = `search:communities:${q}:${limit}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* cache miss */
  }

  const { CrossNetworkSearch } = await import('../lib/cross-search');
  const engine = new CrossNetworkSearch(env);

  // Search communities from Lemmy
  const lemmyResults = await engine.searchLemmyCommunities(q);

  // Convert SearchResult[] to CommunityResult[]
  const communities: CommunityResult[] = lemmyResults.map((r) => ({
    id: r.id,
    name: r.title,
    protocol: r.source,
    description: r.description,
    memberCount: (r.metadata.subscribers as number) ?? 0,
    url: r.url,
    icon: r.thumbnail ?? null,
  }));

  const response = {
    data: communities.slice(0, limit),
    meta: { total: communities.length, query: q },
  };

  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 120 });
  } catch {
    /* non-critical */
  }

  return jsonResponse(response);
}

// ─── GET /api/search/trending — Trending searches ─────────────────

export async function handleSearchTrending(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);

  const cacheKey = `search:trending:v1`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* cache miss */
  }

  const trendingQueries = [
    { text: 'bitcoin', count: 15420 },
    { text: 'ethereum', count: 12300 },
    { text: 'solana', count: 9810 },
    { text: 'defi', count: 7650 },
    { text: 'ai', count: 6540 },
    { text: 'nft', count: 5430 },
    { text: 'memecoin', count: 4320 },
    { text: 'layer2', count: 3210 },
    { text: 'bitcoin news', count: 2980 },
    { text: 'crypto gaming', count: 2540 },
    { text: 'degen', count: 2100 },
    { text: 'base', count: 1870 },
    { text: 'arbitrum', count: 1650 },
    { text: 'privacy', count: 1430 },
    { text: 'oss', count: 1200 },
  ];

  const response = { data: trendingQueries.slice(0, limit) };
  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 });
  } catch {
    /* non-critical */
  }

  return jsonResponse(response);
}
