import type { Protocol } from '@degenfeed/types';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  type: 'post' | 'creator' | 'coin' | 'community' | 'article' | 'video';
  title: string;
  description: string;
  thumbnail?: string;
  url: string;
  source: Protocol;
  sourceLabel: string;
  sourceColor: string;
  relevanceScore: number;
  metadata: Record<string, unknown>;
}

export interface CrossSearchResults {
  query: string;
  totalResults: number;
  results: {
    posts: SearchResult[];
    creators: SearchResult[];
    coins: SearchResult[];
    communities: SearchResult[];
    articles: SearchResult[];
    videos: SearchResult[];
  };
  sourceBreakdown: Record<string, number>;
  searchTime: number;
}

export interface AutocompleteSuggestion {
  text: string;
  type: 'query' | 'creator' | 'community' | 'coin' | 'trending';
  source?: Protocol;
  score: number;
}

export interface TrendingItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: Protocol;
  sourceLabel: string;
  sourceColor: string;
  score: number;
  velocity: number;
  engagement: number;
  thumbnailUrl?: string;
  publishedAt: number;
  metadata: Record<string, unknown>;
}

// ─── Protocol metadata ──────────────────────────────────────────────

interface ProtocolMeta {
  label: string;
  color: string;
  icon: string;
}

export const PROTOCOL_META: Record<string, ProtocolMeta> = {
  nostr: { label: 'Nostr', color: '#8b5cf6', icon: '☰' },
  farcaster: { label: 'Farcaster', color: '#8a63d2', icon: '◇' },
  lens: { label: 'Lens', color: '#abfe2c', icon: '◎' },
  bluesky: { label: 'Bluesky', color: '#1185fe', icon: '☁' },
  activitypub: { label: 'Mastodon', color: '#6364ff', icon: 'M' },
  atproto: { label: 'AT Protocol', color: '#1185fe', icon: '☁' },
  mastodon: { label: 'Mastodon', color: '#6364ff', icon: 'M' },
  lemmy: { label: 'Lemmy', color: '#00b868', icon: '🍋' },
  reddit: { label: 'Reddit', color: '#ff4500', icon: 'R' },
  rss: { label: 'RSS', color: '#ffa500', icon: 'A' },
  peertube: { label: 'PeerTube', color: '#d22d23', icon: '▶' },
  youtube: { label: 'YouTube', color: '#ff0000', icon: '▶' },
  mirror: { label: 'Mirror.xyz', color: '#0a0a0a', icon: 'M' },
  paragraph: { label: 'Paragraph', color: '#6b21a8', icon: 'P' },
  substack: { label: 'Substack', color: '#ff6719', icon: 'S' },
  medium: { label: 'Medium', color: '#000000', icon: 'M' },
  zora: { label: 'Zora', color: '#7c3aed', icon: 'Z' },
  ghost: { label: 'Ghost', color: '#15171a', icon: 'G' },
  threads: { label: 'Threads', color: '#101010', icon: '▣' },
  discord: { label: 'Discord', color: '#5865f2', icon: 'D' },
  telegram: { label: 'Telegram', color: '#26a5e4', icon: 'T' },
  matrix: { label: 'Matrix', color: '#000000', icon: 'M' },
  kbin: { label: 'Kbin', color: '#6364ff', icon: 'K' },
  github: { label: 'GitHub', color: '#333', icon: 'G' },
};

function getMeta(protocol: string): ProtocolMeta {
  return PROTOCOL_META[protocol] ?? { label: protocol, color: '#666', icon: '?' };
}

// ─── Constants ──────────────────────────────────────────────────────

const FETCHER_TIMEOUT_MS = 3000;
const HARD_DEADLINE_MS = 5000;
const USER_AGENT = 'DegenFeed/0.1 (+https://degenfeed.xyz)';

const LEMMY_OWN_URL = 'https://community.degenfeed.xyz';
const PEERTUBE_OWN_URL = 'https://video.degenfeed.xyz';
const GOTOSOCIAL_INSTANCE_URL = 'https://social.degenfeed.xyz';

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.fdn.fr',
  'https://invidious.privacydev.net',
  'https://yewtu.be',
];

// ─── Content categories ────────────────────────────────────────────────

/**
 * Content-type categories used by /api/search?category=… and
 * /api/feed/category/{category}. Each maps to the cross-search result
 * buckets + protocol whitelist that best represent it.
 */
export type ContentCategory =
  | 'social'
  | 'video'
  | 'audio'
  | 'newsletters'
  | 'discussion'
  | 'markets'
  | 'governance'
  | 'reading';

export const CONTENT_CATEGORIES: ContentCategory[] = [
  'social',
  'video',
  'audio',
  'newsletters',
  'discussion',
  'markets',
  'governance',
  'reading',
];

const SOCIAL_PROTOCOLS: Protocol[] = [
  'mastodon',
  'bluesky',
  'nostr',
  'farcaster',
  'lens',
  'threads',
  'telegram',
  'discord',
  'pixelfed',
];

const VIDEO_PROTOCOLS: Protocol[] = ['youtube', 'peertube'];

const NEWSLETTER_PROTOCOLS: Protocol[] = ['mirror', 'paragraph'];

const DISCUSSION_PROTOCOLS: Protocol[] = ['lemmy', 'reddit', 'kbin', 'tildes'];

function categoryTypesFor(category: ContentCategory): {
  types: ('posts' | 'creators' | 'coins' | 'communities' | 'articles' | 'videos')[];
  protocols?: Protocol[];
} {
  switch (category) {
    case 'video':
      return { types: ['videos'], protocols: VIDEO_PROTOCOLS };
    case 'audio':
      return {
        types: ['posts', 'articles'],
        protocols: ['peertube', 'paragraph', 'mirror', 'rss'],
      };
    case 'newsletters':
      return { types: ['articles'], protocols: NEWSLETTER_PROTOCOLS };
    case 'discussion':
      return { types: ['posts', 'communities'], protocols: DISCUSSION_PROTOCOLS };
    case 'markets':
      return {
        types: ['posts', 'coins'],
        protocols: ['zora', 'nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'lemmy', 'reddit'],
      };
    case 'governance':
      return {
        types: ['posts'],
        protocols: ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'lemmy'],
      };
    case 'reading':
      return { types: ['articles'], protocols: ['mirror', 'paragraph', 'rss'] };
    case 'social':
    default:
      return { types: ['posts', 'creators', 'communities'], protocols: SOCIAL_PROTOCOLS };
  }
}

function compareForSort(a: SearchResult, b: SearchResult, sort: 'newest' | 'relevant' | 'popular') {
  if (sort === 'newest') {
    const aTime = Number(a.metadata?.publishedAt ?? a.metadata?.createdAt ?? 0);
    const bTime = Number(b.metadata?.publishedAt ?? b.metadata?.createdAt ?? 0);
    if (aTime !== bTime) return bTime - aTime;
  }
  if (sort === 'popular') {
    const engagement = (r: SearchResult) =>
      (Number(r.metadata?.likes) || 0) +
      (Number(r.metadata?.reposts) || 0) * 2 +
      (Number(r.metadata?.replies) || 0) * 3 +
      (Number(r.metadata?.views) || 0) / 100;
    const diff = engagement(b) - engagement(a);
    if (diff !== 0) return diff;
  }
  return b.relevanceScore - a.relevanceScore;
}

// ─── Helpers ────────────────────────────────────────────────────────

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

function truncate(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function makeResult(opts: {
  id: string;
  type: SearchResult['type'];
  title: string;
  description: string;
  source: Protocol;
  relevanceScore?: number;
  thumbnail?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}): SearchResult {
  const meta = getMeta(opts.source);
  return {
    id: opts.id,
    type: opts.type,
    title: opts.title,
    description: opts.description,
    thumbnail: opts.thumbnail,
    url: opts.url ?? '',
    source: opts.source,
    sourceLabel: meta.label,
    sourceColor: meta.color,
    relevanceScore: opts.relevanceScore ?? 0.5,
    metadata: opts.metadata ?? {},
  };
}

// ─── CrossNetworkSearch Engine ──────────────────────────────────────

export class CrossNetworkSearch {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async search(opts: {
    query: string;
    types?: ('posts' | 'creators' | 'coins' | 'communities' | 'articles' | 'videos')[];
    protocols?: string[];
    limit: number;
    sort?: 'newest' | 'relevant' | 'popular';
    category?: ContentCategory;
  }): Promise<CrossSearchResults> {
    const start = performance.now();
    const q = opts.query.trim();
    const types = opts.types ?? ['posts', 'creators', 'communities'];
    const limit = Math.min(opts.limit, 100);
    const sort = opts.sort ?? 'relevant';
    const category = opts.category;

    const results: CrossSearchResults = {
      query: q,
      totalResults: 0,
      results: { posts: [], creators: [], coins: [], communities: [], articles: [], videos: [] },
      sourceBreakdown: {},
      searchTime: 0,
    };

    const fetchers: Promise<void>[] = [];

    // Restrict the fetched provider set when a content category is requested.
    // This keeps audio/newsletters/discussion etc. scoped to relevant sources
    // instead of spraying generic posts across every protocol.
    const categoryTypes = category ? categoryTypesFor(category) : null;
    const effectiveTypes: typeof types = categoryTypes?.types ?? types;
    const protocolWhitelist = categoryTypes?.protocols ?? opts.protocols;

    const wantsPost = (t: (typeof types)[number]) => effectiveTypes.includes(t);
    const protocolEnabled = (p: Protocol) =>
      !protocolWhitelist || protocolWhitelist.length === 0 || protocolWhitelist.includes(p);
    if (wantsPost('posts') || wantsPost('creators') || wantsPost('communities')) {
      if (protocolEnabled('mastodon')) {
        fetchers.push(this.searchActivityPub(q).then((r) => this.#collect(results, r, 'posts')));
      }
      if (protocolEnabled('bluesky')) {
        fetchers.push(this.searchATProtocol(q).then((r) => this.#collect(results, r, 'posts')));
      }
      if (protocolEnabled('nostr')) {
        fetchers.push(this.searchNostr(q).then((r) => this.#collect(results, r, 'posts')));
      }
      if (protocolEnabled('farcaster')) {
        fetchers.push(this.searchFarcaster(q).then((r) => this.#collect(results, r, 'posts')));
      }
      if (protocolEnabled('lens')) {
        fetchers.push(this.searchLens(q).then((r) => this.#collect(results, r, 'posts')));
      }
      if (protocolEnabled('lemmy') || protocolEnabled('reddit')) {
        fetchers.push(this.searchLemmy(q).then((r) => this.#collect(results, r, 'posts')));
        if (protocolEnabled('reddit')) {
          fetchers.push(this.searchReddit(q).then((r) => this.#collect(results, r, 'posts')));
        }
      }
    }

    if (wantsPost('communities')) {
      fetchers.push(
        this.searchLemmyCommunities(q).then((r) => this.#collect(results, r, 'communities')),
      );
    }

    if (wantsPost('articles')) {
      if (protocolEnabled('mirror')) {
        fetchers.push(this.searchMirror(q).then((r) => this.#collect(results, r, 'articles')));
      }
      if (protocolEnabled('paragraph')) {
        fetchers.push(this.searchParagraph(q).then((r) => this.#collect(results, r, 'articles')));
      }
    }

    if (wantsPost('videos')) {
      if (protocolEnabled('youtube')) {
        fetchers.push(this.searchYouTube(q).then((r) => this.#collect(results, r, 'videos')));
      }
      if (protocolEnabled('peertube')) {
        fetchers.push(this.searchPeerTube(q).then((r) => this.#collect(results, r, 'videos')));
      }
    }

    if (wantsPost('coins')) {
      fetchers.push(this.searchZora(q).then((r) => this.#collect(results, r, 'coins')));
    }

    // Generic bridge search for every remaining protocol family (threads,
    // telegram, discord, kbin, tildes, pixelfed, …). Only runs when no
    // specific protocol filter excludes it.
    if (
      protocolEnabled('threads') ||
      protocolEnabled('telegram') ||
      protocolEnabled('discord') ||
      protocolEnabled('kbin') ||
      protocolEnabled('tildes') ||
      protocolEnabled('pixelfed')
    ) {
      fetchers.push(this.searchBridge(q).then((r) => this.#collect(results, r, 'posts')));
    }

    // Hard deadline
    const deadline = new Promise<void>((resolve) => setTimeout(resolve, HARD_DEADLINE_MS));
    await Promise.race([Promise.allSettled(fetchers).then(() => undefined), deadline]);

    // Deduplicate by URL and rank
    for (const categoryKey of Object.keys(results.results) as (keyof typeof results.results)[]) {
      const seen = new Set<string>();
      results.results[categoryKey] = (results.results[categoryKey] as SearchResult[])
        .filter((r) => {
          const key = r.url || r.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => compareForSort(a, b, sort))
        .slice(0, Math.ceil(limit / Object.keys(types).length || 1));
    }

    results.totalResults = Object.values(results.results).reduce((sum, arr) => sum + arr.length, 0);
    results.searchTime = performance.now() - start;

    return results;
  }

  #collect(
    results: CrossSearchResults,
    items: SearchResult[],
    category: keyof CrossSearchResults['results'],
  ): void {
    for (const item of items) {
      results.results[category].push(item);
      results.sourceBreakdown[item.source] = (results.sourceBreakdown[item.source] ?? 0) + 1;
    }
  }

  // ─── ActivityPub (Mastodon) Search ────────────────────────────

  async searchActivityPub(query: string): Promise<SearchResult[]> {
    const data = await fetchJsonWithTimeout<{
      statuses?: Array<{
        id: string;
        content: string;
        url?: string;
        created_at: string;
        account?: { display_name?: string; username?: string; avatar?: string };
        favourites_count?: number;
        reblogs_count?: number;
        media_attachments?: Array<{ type: string; preview_url?: string }>;
      }>;
    }>(
      `${GOTOSOCIAL_INSTANCE_URL}/api/v2/search?q=${encodeURIComponent(query)}&type=statuses&limit=20&resolve=true`,
    );
    return (data?.statuses ?? []).slice(0, 10).map((s) => {
      const text = stripHtml(s.content ?? '');
      const img = s.media_attachments?.find((m) => m.type === 'image');
      return makeResult({
        id: `activitypub:${s.id}`,
        type: 'post',
        title: truncate(text, 80),
        description: truncate(text, 200),
        source: 'mastodon',
        relevanceScore: 0.6 + (s.favourites_count ?? 0) * 0.01,
        thumbnail: img?.preview_url,
        url: s.url ?? '',
        metadata: {
          author: s.account?.display_name || s.account?.username || 'unknown',
          avatarUrl: s.account?.avatar,
          likes: s.favourites_count ?? 0,
          reposts: s.reblogs_count ?? 0,
          createdAt: s.created_at,
        },
      });
    });
  }

  // ─── AT Protocol (Bluesky) Search ──────────────────────────────

  async searchATProtocol(query: string): Promise<SearchResult[]> {
    const base = this.env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';
    const data = await fetchJsonWithTimeout<{
      posts?: Array<{
        uri: string;
        author: { did: string; handle: string; displayName?: string; avatar?: string };
        record: { text: string; createdAt: string };
        likeCount?: number;
        repostCount?: number;
        replyCount?: number;
      }>;
    }>(`${base}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=20&sort=top`);
    return (data?.posts ?? []).slice(0, 10).map((p) => {
      return makeResult({
        id: `atproto:${p.uri}`,
        type: 'post',
        title: truncate(p.record.text, 80),
        description: truncate(p.record.text, 200),
        source: 'bluesky',
        relevanceScore: 0.7 + (p.likeCount ?? 0) * 0.01,
        url: `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split('/').pop()}`,
        metadata: {
          author: p.author.displayName || p.author.handle,
          avatarUrl: p.author.avatar,
          likes: p.likeCount ?? 0,
          reposts: p.repostCount ?? 0,
          createdAt: p.record.createdAt,
        },
      });
    });
  }

  // ─── Nostr Search ──────────────────────────────────────────────

  async searchNostr(query: string): Promise<SearchResult[]> {
    const data = await fetchJsonWithTimeout<{
      posts?: Array<Record<string, unknown>>;
      notes?: Array<Record<string, unknown>>;
    }>(`https://api.nostr.band/v0/search/posts?q=${encodeURIComponent(query)}&limit=20`);
    const items = data?.posts ?? data?.notes ?? [];
    return items.slice(0, 10).map((p) => {
      const id = (p.id as string) ?? '';
      const text = (p.content as string) ?? (p.text as string) ?? '';
      const author = (p.author ?? p.profile ?? {}) as Record<string, unknown>;
      return makeResult({
        id: `nostr:${id}`,
        type: 'post',
        title: truncate(text, 80),
        description: truncate(text, 200),
        source: 'nostr',
        relevanceScore: 0.8 + ((p.reactions_count as number) ?? 0) * 0.01,
        metadata: {
          author:
            (author.display_name as string) ||
            (author.name as string) ||
            `${((p.pubkey as string) ?? '').slice(0, 8)}…`,
          avatarUrl: author.picture as string,
          likes: (p.reactions_count as number) ?? 0,
          createdAt: (p.created_at as number) ?? 0,
        },
      });
    });
  }

  // ─── Farcaster Search ─────────────────────────────────────────

  async searchFarcaster(query: string): Promise<SearchResult[]> {
    // 1. Prefer Neynar full-text cast search when an API key is configured
    if (this.env.NEYNAR_API_KEY) {
      try {
        const data = await fetchJsonWithTimeout<{
          result?: {
            casts?: Array<{
              hash: string;
              text?: string;
              timestamp?: string;
              author?: {
                username?: string;
                display_name?: string;
                pfp_url?: string;
                fid?: number;
              };
              reactions?: { count?: number; likes_count?: number; recasts_count?: number };
              replies?: { count?: number };
            }>;
          };
        }>(
          `https://api.neynar.com/v2/farcaster/cast/search?q=${encodeURIComponent(query)}&limit=10&priority_mode=true`,
          {
            headers: { 'x-api-key': this.env.NEYNAR_API_KEY },
          },
          4000,
        );
        const casts = data?.result?.casts ?? [];
        if (casts.length > 0) {
          return casts.map((c) => {
            const text = c.text ?? '';
            const ts = c.timestamp ? new Date(c.timestamp).getTime() : Date.now();
            return makeResult({
              id: `farcaster:${c.hash}`,
              type: 'post',
              title: truncate(text, 80),
              description: truncate(text, 200),
              source: 'farcaster',
              relevanceScore: 0.8 + (c.reactions?.likes_count ?? 0) * 0.01,
              url: `https://warpcast.com/${c.author?.username ?? '~'}/${c.hash.slice(0, 10)}`,
              metadata: {
                author:
                  c.author?.display_name || c.author?.username || `fid:${c.author?.fid ?? '?'}`,
                avatarUrl: c.author?.pfp_url,
                likes: c.reactions?.likes_count ?? c.reactions?.count ?? 0,
                reposts: c.reactions?.recasts_count ?? 0,
                replies: c.replies?.count ?? 0,
                createdAt: ts,
              },
            });
          });
        }
      } catch {
        // fall through to hub lookup
      }
    }

    // 2. Fall back to Hubble — look up username proof for exact match, then fetch casts
    const hubUrl = this.env.FARCASTER_HUB_URL || 'http://127.0.0.1:2281';
    const results: SearchResult[] = [];

    // Try exact username lookup via Hubble's userNameProof
    try {
      const nameResp = await fetch(
        `${hubUrl}/v1/userNameProofByName?name=${encodeURIComponent(query)}`,
        {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (nameResp.ok) {
        const proof = (await nameResp.json()) as { fid?: number; name?: string } | null;
        if (proof?.fid) {
          const castResp = await fetch(`${hubUrl}/v1/castsByFid?fid=${proof.fid}&pageSize=5`, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
          });
          if (castResp.ok) {
            const castData = (await castResp.json()) as {
              messages?: Array<{
                hash: string;
                data: { castAddBody: { text: string }; fid: number; timestamp: number };
              }>;
            };
            for (const msg of castData.messages ?? []) {
              const text = msg.data?.castAddBody?.text;
              if (!text) continue;
              results.push(
                makeResult({
                  id: `farcaster:${msg.hash}`,
                  type: 'post',
                  title: truncate(text, 80),
                  description: truncate(text, 200),
                  source: 'farcaster',
                  relevanceScore: 0.5,
                  url: `https://warpcast.com/${query}/${msg.hash}`,
                  metadata: {
                    author: query,
                    createdAt: (msg.data.timestamp + 1609459200) * 1000,
                  },
                }),
              );
            }
          }
        }
      }
    } catch {
      /* non-critical */
    }

    return results;
  }

  // ─── Lens Search ──────────────────────────────────────────────────────

  async searchLens(query: string): Promise<SearchResult[]> {
    const apiUrl = this.env.LENS_API_URL || 'https://api.lens.xyz/graphql';
    const data = await fetchJsonWithTimeout<{
      data?: {
        posts?: {
          items?: Array<{
            id: string;
            metadata?: { content?: string; image?: { item?: string | null } | null };
            author?: {
              username?: { localName?: string };
              metadata?: { name?: string | null; picture?: string | null };
            };
            timestamp?: string;
            stats?: { reactions?: number; comments?: number; reposts?: number };
          }>;
        };
      };
    }>(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query:
          'query($q:String!){posts(request:{filter:{searchQuery:$q},pageSize:FIFTY}){items{__typename ... on Post{id timestamp metadata{... on TextOnlyMetadata{content} ... on ImageMetadata{content image{item}} ... on VideoMetadata{content}} author{address username{localName}metadata{name picture}} stats{reactions comments reposts quotes}}}}}',
        variables: { q: query },
      }),
    });
    return (data?.data?.posts?.items ?? []).slice(0, 10).map((item) => {
      const text = item.metadata?.content ?? '';
      return makeResult({
        id: `lens:${item.id}`,
        type: 'post',
        title: truncate(text, 80),
        description: truncate(text, 200),
        source: 'lens',
        relevanceScore: 0.7 + (item.stats?.reactions ?? 0) * 0.01,
        thumbnail: item.metadata?.image?.item ?? undefined,
        url: `https://hey.xyz/posts/${item.id}`,
        metadata: {
          author: item.author?.metadata?.name || item.author?.username?.localName || 'lens user',
          avatarUrl: item.author?.metadata?.picture,
          reactions: item.stats?.reactions ?? 0,
        },
      });
    });
  }

  // ─── Lemmy Search ─────────────────────────────────────────────

  async searchLemmy(query: string): Promise<SearchResult[]> {
    const data = await fetchJsonWithTimeout<{
      posts?: Array<{
        post: { id: number; name: string; body?: string; url?: string; published: string };
        creator?: { id: number; name: string; display_name?: string; avatar?: string };
        counts?: { score?: number; upvotes?: number; comments?: number };
      }>;
    }>(`${LEMMY_OWN_URL}/api/v3/search?q=${encodeURIComponent(query)}&type_=Posts&limit=20`);
    return (data?.posts ?? []).slice(0, 10).map((pv) => {
      const post = pv.post;
      const text = post.body ? `${post.name}: ${post.body}` : post.name;
      return makeResult({
        id: `lemmy:${post.id}`,
        type: 'post',
        title: truncate(post.name, 80),
        description: truncate(text, 200),
        source: 'lemmy',
        relevanceScore: 0.6 + (pv.counts?.upvotes ?? pv.counts?.score ?? 0) * 0.01,
        url: post.url ?? `${LEMMY_OWN_URL}/post/${post.id}`,
        metadata: {
          author: pv.creator?.display_name || pv.creator?.name || 'anon',
          avatarUrl: pv.creator?.avatar,
          score: pv.counts?.score ?? 0,
          comments: pv.counts?.comments ?? 0,
        },
      });
    });
  }

  async searchLemmyCommunities(query: string): Promise<SearchResult[]> {
    const data = await fetchJsonWithTimeout<{
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
    }>(`${LEMMY_OWN_URL}/api/v3/search?q=${encodeURIComponent(query)}&type_=Communities&limit=20`);
    return (data?.communities ?? []).slice(0, 10).map((cv) => {
      const c = cv.community;
      return makeResult({
        id: `lemmy:community:${c.name}`,
        type: 'community',
        title: c.title || c.name,
        description: (c.description ?? '').slice(0, 200),
        source: 'lemmy',
        relevanceScore: 0.5 + ((cv.counts?.subscribers ?? 0) / 1000) * 0.3,
        thumbnail: c.icon,
        url: c.actor_id ?? `${LEMMY_OWN_URL}/c/${c.name}`,
        metadata: { subscribers: cv.counts?.subscribers ?? 0 },
      });
    });
  }

  // ─── Reddit Search ────────────────────────────────────────────

  async searchReddit(query: string): Promise<SearchResult[]> {
    // Reddit's public JSON API mirrors the HTML search page. No auth for
    // basic top/hot search. Use old.reddit to avoid bot walls where possible.
    const data = await fetchJsonWithTimeout<{
      data?: {
        children?: Array<{
          data?: {
            id?: string;
            title?: string;
            selftext?: string;
            url?: string;
            permalink?: string;
            thumbnail?: string;
            author?: string;
            created_utc?: number;
            score?: number;
            num_comments?: number;
            subreddit?: string;
            over_18?: boolean;
          };
        }>;
      };
    }>(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=20&type=link`,
      {
        headers: { 'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)' },
      },
    );
    const children = data?.data?.children ?? [];
    return children
      .filter((c) => c.data && !c.data.over_18)
      .slice(0, 10)
      .map((c) => {
        const d = c.data as NonNullable<(typeof children)[number]['data']>;
        const text = d.selftext ? `${d.title}: ${d.selftext}` : (d.title ?? '');
        return makeResult({
          id: `reddit:${d.id}`,
          type: 'post',
          title: truncate(d.title ?? '', 80),
          description: truncate(text, 200),
          source: 'reddit',
          relevanceScore: 0.6 + ((d.score ?? 0) / 1000) * 0.3,
          thumbnail: d.thumbnail?.startsWith('http') ? d.thumbnail : undefined,
          url: `https://www.reddit.com${d.permalink ?? ''}`,
          metadata: {
            author: d.author ?? 'anon',
            likes: d.score ?? 0,
            replies: d.num_comments ?? 0,
            community: `r/${d.subreddit ?? ''}`,
            createdAt: (d.created_utc ?? 0) * 1000,
          },
        });
      });
  }

  // ─── RSS-Bridge Generic Search (fallback for other protocols) ──

  async searchBridge(query: string): Promise<SearchResult[]> {
    // RSS-Bridge exposes search via `?q=` on bridges that support it
    // (Twitter, Telegram, etc.). Try a small set of likely bridges.
    const bridgeUrl = this.env.RSS_BRIDGE_URL || 'http://127.0.0.1:8282';
    const candidates = [
      `${bridgeUrl}/?action=search&query=${encodeURIComponent(query)}&format=json`,
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(3500),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as {
          items?: Array<{
            id?: string;
            title?: string;
            content_text?: string;
            url?: string;
            date_published?: string;
            author?: { name?: string };
            image?: string;
            _bridge?: string;
          }>;
        };
        const items = data?.items ?? [];
        if (items.length === 0) continue;
        return items.slice(0, 10).map((it) => {
          const rawSource = (it._bridge ?? 'rss').toLowerCase();
          const source = /^[a-z-]+$/.test(rawSource) ? (rawSource as Protocol) : 'rss';
          return makeResult({
            id: `bridge:${it.id ?? it.url ?? Math.random()}`,
            type: 'post',
            title: truncate(it.title ?? '', 80),
            description: truncate(it.content_text ?? it.title ?? '', 200),
            source: source as Protocol,
            relevanceScore: 0.4,
            thumbnail: it.image,
            url: it.url ?? '',
            metadata: {
              author: it.author?.name ?? 'unknown',
              createdAt: it.date_published,
            },
          });
        });
      } catch {
        // try next candidate
      }
    }
    return [];
  }

  // ─── Per-protocol search dispatch ─────────────────────────────

  async searchByProtocol(query: string, protocol: string): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    switch (protocol.toLowerCase()) {
      case 'mastodon':
      case 'activitypub':
        return this.searchActivityPub(q);
      case 'bluesky':
      case 'atproto':
        return this.searchATProtocol(q);
      case 'nostr':
        return this.searchNostr(q);
      case 'farcaster':
        return this.searchFarcaster(q);
      case 'lens':
        return this.searchLens(q);
      case 'lemmy':
        return this.searchLemmy(q);
      case 'reddit':
        return this.searchReddit(q);
      case 'youtube':
        return this.searchYouTube(q);
      case 'peertube':
        return this.searchPeerTube(q);
      case 'mirror':
        return this.searchMirror(q);
      case 'paragraph':
        return this.searchParagraph(q);
      case 'zora':
        return this.searchZora(q);
      default:
        // All other protocols → generic bridge search
        return this.searchBridge(q);
    }
  }

  // ─── Mirror.xyz Search ────────────────────────────────────────

  async searchMirror(query: string): Promise<SearchResult[]> {
    // Mirror.xyz uses The Graph subgraph for search
    const data = await fetchJsonWithTimeout<{
      data?: {
        entries?: Array<{
          id: string;
          title?: string;
          body?: string;
          digest?: string;
          timestamp?: string;
          author?: { handle?: string; avatarURL?: string };
        }>;
      };
    }>('https://api.thegraph.com/subgraphs/name/mirror-xyz/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `{ entries(where: { title_contains: "${query.replace(/"/g, '\\"')}" }, first: 10, orderBy: timestamp, orderDirection: desc) { id title digest timestamp author { handle avatarURL } } }`,
      }),
    });
    return (data?.data?.entries ?? []).map((e) => {
      const body = e.digest || e.body || '';
      return makeResult({
        id: `mirror:${e.id}`,
        type: 'article',
        title: e.title ?? 'Untitled',
        description: truncate(body, 200),
        source: 'mirror',
        relevanceScore: 0.7,
        url: `https://mirror.xyz/${e.author?.handle || '?'}/${e.id}`,
        metadata: {
          author: e.author?.handle ?? 'unknown',
          avatarUrl: e.author?.avatarURL,
          publishedAt: e.timestamp,
        },
      });
    });
  }

  // ─── Paragraph.xyz Search ──────────────────────────────────────

  async searchParagraph(query: string): Promise<SearchResult[]> {
    // Paragraph uses a public search API
    const data = await fetchJsonWithTimeout<{
      posts?: Array<{
        id: string;
        title?: string;
        excerpt?: string;
        coverImage?: string;
        url?: string;
        author?: { name?: string; avatar?: string };
        publishedAt?: string;
        claps?: number;
      }>;
    }>(`https://api.paragraph.xyz/api/v2/posts/search?q=${encodeURIComponent(query)}&limit=10`);
    return (data?.posts ?? []).map((p) => {
      return makeResult({
        id: `paragraph:${p.id}`,
        type: 'article',
        title: p.title ?? 'Untitled',
        description: truncate(p.excerpt ?? '', 200),
        source: 'paragraph',
        relevanceScore: 0.6 + ((p.claps ?? 0) / 100) * 0.2,
        thumbnail: p.coverImage,
        url: p.url ?? `https://paragraph.xyz/post/${p.id}`,
        metadata: {
          author: p.author?.name ?? 'unknown',
          avatarUrl: p.author?.avatar,
          claps: p.claps ?? 0,
          publishedAt: p.publishedAt,
        },
      });
    });
  }

  // ─── YouTube Search ────────────────────────────────────────────

  async searchYouTube(query: string): Promise<SearchResult[]> {
    // 1. Prefer public Invidious instances (no API key required)
    for (const instance of INVIDIOUS_INSTANCES) {
      const data = await fetchJsonWithTimeout<
        Array<{
          videoId?: string;
          title?: string;
          description?: string;
          videoThumbnails?: Array<{ url?: string; quality?: string }>;
          author?: string;
          published?: number;
          viewCount?: number;
          lengthSeconds?: number;
        }>
      >(
        `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=1`,
        undefined,
        3000,
      );
      if (data && Array.isArray(data) && data.length > 0) {
        return data.slice(0, 10).map((v) => {
          const thumb =
            v.videoThumbnails?.find((t) => t.quality === 'medium')?.url ||
            v.videoThumbnails?.find((t) => t.quality === 'high')?.url ||
            v.videoThumbnails?.[0]?.url;
          return makeResult({
            id: `youtube:${v.videoId}`,
            type: 'video',
            title: v.title ?? 'Untitled',
            description: truncate(v.description ?? '', 200),
            source: 'youtube',
            relevanceScore: 0.7,
            thumbnail: thumb,
            url: `https://www.youtube.com/watch?v=${v.videoId}`,
            metadata: {
              channelTitle: v.author ?? '',
              views: v.viewCount ?? 0,
              duration: v.lengthSeconds ?? 0,
              publishedAt: v.published,
            },
          });
        });
      }
    }

    // 2. Fallback: Google YouTube Data API when a key is configured
    if (!this.env.YOUTUBE_API_KEY) return [];
    const data = await fetchJsonWithTimeout<{
      items?: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          description: string;
          thumbnails?: {
            high?: { url: string };
            medium?: { url: string };
            default?: { url: string };
          };
          channelTitle: string;
          publishedAt: string;
        };
        statistics?: { viewCount?: string; likeCount?: string };
      }>;
    }>(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(query)}&key=${this.env.YOUTUBE_API_KEY}`,
    );
    if (!data?.items) return [];
    return data.items.map((item) => {
      const thumb =
        item.snippet.thumbnails?.high?.url ||
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url;
      return makeResult({
        id: `youtube:${item.id.videoId}`,
        type: 'video',
        title: item.snippet.title,
        description: truncate(item.snippet.description, 200),
        source: 'youtube',
        relevanceScore: 0.7,
        thumbnail: thumb,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        metadata: {
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
        },
      });
    });
  }

  // ─── PeerTube Search ──────────────────────────────────────────

  async searchPeerTube(query: string): Promise<SearchResult[]> {
    const data = await fetchJsonWithTimeout<{
      data?: Array<{
        uuid: string;
        name: string;
        description?: string;
        duration?: number;
        views?: number;
        thumbnailPath?: string;
        url?: string;
        channel?: { displayName?: string; name?: string };
      }>;
    }>(`${PEERTUBE_OWN_URL}/api/v1/search/videos?search=${encodeURIComponent(query)}&count=10`);
    return (data?.data ?? []).map((v) => {
      return makeResult({
        id: `peertube:${v.uuid}`,
        type: 'video',
        title: v.name,
        description: truncate(v.description ?? '', 200),
        source: 'peertube',
        relevanceScore: 0.5 + ((v.views ?? 0) / 10000) * 0.3,
        thumbnail: v.thumbnailPath ? `${PEERTUBE_OWN_URL}${v.thumbnailPath}` : undefined,
        url: v.url ?? `${PEERTUBE_OWN_URL}/w/${v.uuid}`,
        metadata: {
          channelName: v.channel?.displayName || v.channel?.name || '',
          views: v.views ?? 0,
          duration: v.duration ?? 0,
        },
      });
    });
  }

  // ─── Zora Search (coins / NFTs) ───────────────────────────────

  async searchZora(query: string): Promise<SearchResult[]> {
    // Zora API v3 search for coins and collections
    const data = await fetchJsonWithTimeout<{
      data?: {
        tokens?: {
          nodes?: Array<{
            token: {
              collectionAddress: string;
              tokenId: string;
              name?: string;
              description?: string;
              image?: { url?: string };
              collection?: { name?: string };
            };
            tokenMarketData?: { price?: { nativePrice?: { decimal?: number } } };
          }>;
        };
      };
    }>('https://api.zora.co/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `{ tokens(where: { search: { query: "${query.replace(/"/g, '\\"')}" } }, pagination: { limit: 10 }) { nodes { token { collectionAddress tokenId name description image { url } collection { name } } tokenMarketData { price { nativePrice { decimal } } } } } }`,
      }),
    });
    return (data?.data?.tokens?.nodes ?? []).map((n) => {
      return makeResult({
        id: `zora:${n.token.collectionAddress}:${n.token.tokenId}`,
        type: 'coin',
        title: n.token.name ?? n.token.collection?.name ?? 'Unknown NFT',
        description: truncate(n.token.description ?? '', 200),
        source: 'zora',
        relevanceScore: 0.6,
        thumbnail: n.token.image?.url,
        url: `https://zora.co/collect/${n.token.collectionAddress}/${n.token.tokenId}`,
        metadata: {
          collectionAddress: n.token.collectionAddress,
          tokenId: n.token.tokenId,
          collectionName: n.token.collection?.name,
        },
      });
    });
  }

  // ─── Autocomplete ─────────────────────────────────────────────

  async autocomplete(query: string): Promise<AutocompleteSuggestion[]> {
    if (query.length < 2) return [];
    const suggestions: AutocompleteSuggestion[] = [];
    const q = query.toLowerCase();

    // Static trending queries
    const trending = ['bitcoin', 'ethereum', 'solana', 'defi', 'nft', 'ai', 'memecoin', 'layer2'];
    for (const t of trending) {
      if (t.startsWith(q)) {
        suggestions.push({ text: t, type: 'trending', score: 0.5 });
      }
    }

    // Search MeiliSearch for real suggestions
    try {
      const res = await fetch('https://search.degenfeed.xyz/indexes/posts/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          q: query,
          limit: 5,
          attributesToRetrieve: ['authorDisplayName', 'niches'],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          hits: Array<{ authorDisplayName: string; niches: string[] }>;
        };
        const seen = new Set<string>();
        for (const hit of data.hits ?? []) {
          if (!seen.has(hit.authorDisplayName) && hit.authorDisplayName.toLowerCase().includes(q)) {
            seen.add(hit.authorDisplayName);
            suggestions.push({ text: hit.authorDisplayName, type: 'creator', score: 0.7 });
          }
          for (const niche of hit.niches ?? []) {
            if (niche.toLowerCase().includes(q) && !seen.has(`niche:${niche}`)) {
              seen.add(`niche:${niche}`);
              suggestions.push({ text: niche, type: 'query', score: 0.6 });
            }
          }
        }
      }
    } catch {
      /* non-critical */
    }

    // Sort by score
    return suggestions.sort((a, b) => b.score - a.score).slice(0, 8);
  }

  // ─── Cross-network Trending ───────────────────────────────────

  async trending(limit = 20): Promise<TrendingItem[]> {
    const items: TrendingItem[] = [];

    const fetchers: Promise<void>[] = [
      this.#fetchTrendingMastodon().then((r) => {
        items.push(...r);
      }),
      this.#fetchTrendingBluesky().then((r) => {
        items.push(...r);
      }),
      this.#fetchTrendingNostr().then((r) => {
        items.push(...r);
      }),
      this.#fetchTrendingFarcaster().then((r) => {
        items.push(...r);
      }),
      this.#fetchTrendingLemmy().then((r) => {
        items.push(...r);
      }),
      this.#fetchTrendingYouTube().then((r) => {
        items.push(...r);
      }),
    ];

    const deadline = new Promise<void>((resolve) => setTimeout(resolve, HARD_DEADLINE_MS));
    await Promise.race([Promise.allSettled(fetchers).then(() => undefined), deadline]);

    // Rank by weighted score: engagement × velocity × cross-protocol multiplier
    const scored = items
      .sort((a, b) => {
        const scoreA = a.score * a.velocity * (a.engagement > 100 ? 1.5 : 1);
        const scoreB = b.score * b.velocity * (b.engagement > 100 ? 1.5 : 1);
        return scoreB - scoreA;
      })
      .slice(0, limit);

    // Deduplicate by title similarity
    const seen = new Set<string>();
    return scored.filter((item) => {
      const key = item.title.toLowerCase().slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async #fetchTrendingMastodon(): Promise<TrendingItem[]> {
    const data = await fetchJsonWithTimeout<{
      trending?: Array<{
        id: string;
        content: string;
        url: string;
        created_at: string;
        favourites_count?: number;
        reblogs_count?: number;
        account?: { display_name?: string; avatar?: string };
      }>;
    }>(`${GOTOSOCIAL_INSTANCE_URL}/api/v1/trends/statuses?limit=10`);
    return (data?.trending ?? []).map((s) => {
      const text = stripHtml(s.content);
      return {
        id: `mastodon:${s.id}`,
        title: truncate(text, 80),
        description: truncate(text, 200),
        url: s.url,
        source: 'mastodon',
        sourceLabel: 'Mastodon',
        sourceColor: '#6364ff',
        score: (s.favourites_count ?? 0) + (s.reblogs_count ?? 0) * 2,
        velocity:
          (s.favourites_count ?? 0) /
          Math.max(1, (Date.now() - new Date(s.created_at).getTime()) / 3600000),
        engagement: (s.favourites_count ?? 0) + (s.reblogs_count ?? 0),
        publishedAt: new Date(s.created_at).getTime(),
        metadata: { author: s.account?.display_name || 'unknown', avatarUrl: s.account?.avatar },
      };
    });
  }

  async #fetchTrendingBluesky(): Promise<TrendingItem[]> {
    const base = this.env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';
    const data = await fetchJsonWithTimeout<{
      posts?: Array<{
        uri: string;
        record: { text: string; createdAt: string };
        author: { handle: string; displayName?: string; avatar?: string };
        likeCount?: number;
        repostCount?: number;
      }>;
    }>(`${base}/xrpc/app.bsky.feed.getTimeline?limit=10`);
    return (data?.posts ?? []).map((p) => ({
      id: `bluesky:${p.uri}`,
      title: truncate(p.record.text, 80),
      description: truncate(p.record.text, 200),
      url: `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split('/').pop()}`,
      source: 'bluesky',
      sourceLabel: 'Bluesky',
      sourceColor: '#1185fe',
      score: (p.likeCount ?? 0) + (p.repostCount ?? 0) * 2,
      velocity:
        (p.likeCount ?? 0) /
        Math.max(1, (Date.now() - new Date(p.record.createdAt).getTime()) / 3600000),
      engagement: (p.likeCount ?? 0) + (p.repostCount ?? 0),
      publishedAt: new Date(p.record.createdAt).getTime(),
      metadata: { author: p.author.displayName || p.author.handle, avatarUrl: p.author.avatar },
    }));
  }

  async #fetchTrendingNostr(): Promise<TrendingItem[]> {
    const data = await fetchJsonWithTimeout<{ posts?: Array<Record<string, unknown>> }>(
      'https://api.nostr.band/v0/trending/posts?limit=10',
    );
    return (data?.posts ?? []).map((p) => {
      const id = (p.id as string) ?? '';
      const text = (p.content as string) ?? '';
      const author = (p.author ?? {}) as Record<string, unknown>;
      return {
        id: `nostr:${id}`,
        title: truncate(text, 80),
        description: truncate(text, 200),
        url: '',
        source: 'nostr',
        sourceLabel: 'Nostr',
        sourceColor: '#8b5cf6',
        score: ((p.reactions_count as number) ?? 0) + ((p.reposts_count as number) ?? 0) * 2,
        velocity:
          ((p.reactions_count as number) ?? 0) /
          Math.max(
            1,
            ((p.created_at as number) ?? Date.now()) > 1e12
              ? (Date.now() - ((p.created_at as number) ?? Date.now())) / 3600000
              : 1,
          ),
        engagement: ((p.reactions_count as number) ?? 0) + ((p.reposts_count as number) ?? 0),
        publishedAt:
          ((p.created_at as number) ?? 0) > 1e12
            ? ((p.created_at as number) ?? 0)
            : ((p.created_at as number) ?? 0) * 1000,
        metadata: {
          author: (author.display_name as string) || (author.name as string) || 'unknown',
          avatarUrl: author.picture as string,
        },
      };
    });
  }

  async #fetchTrendingFarcaster(): Promise<TrendingItem[]> {
    const hubUrl = this.env.FARCASTER_HUB_URL || 'http://127.0.0.1:2281';
    const items: TrendingItem[] = [];
    const curatedFids = [3, 2, 1, 228, 239, 354, 5650];

    for (const fid of curatedFids) {
      try {
        const resp = await fetch(`${hubUrl}/v1/castsByFid?fid=${fid}&pageSize=3`, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(4000),
        });
        if (!resp.ok) continue;
        const data = (await resp.json()) as {
          messages?: Array<{
            hash: string;
            data: { castAddBody: { text: string }; fid: number; timestamp: number };
          }>;
        };
        for (const msg of data.messages ?? []) {
          const text = msg.data?.castAddBody?.text;
          if (!text) continue;
          const ts = (msg.data.timestamp + 1609459200) * 1000;
          items.push({
            id: `farcaster:${msg.hash}`,
            title: truncate(text, 80),
            description: truncate(text, 200),
            url: `https://warpcast.com/fid:${msg.data.fid}/${msg.hash.slice(0, 8)}`,
            source: 'farcaster',
            sourceLabel: 'Farcaster',
            sourceColor: '#8a63d2',
            score: 100,
            velocity: 0,
            engagement: 0,
            publishedAt: ts,
            metadata: { author: `fid:${msg.data.fid}`, avatarUrl: '' },
          });
        }
      } catch {}
    }

    return items;
  }

  async #fetchTrendingLemmy(): Promise<TrendingItem[]> {
    const data = await fetchJsonWithTimeout<{
      posts?: Array<{
        post: { id: number; name: string; body?: string; url?: string; published: string };
        counts?: { score?: number; upvotes?: number; comments?: number };
        creator?: { display_name?: string; name?: string; avatar?: string };
      }>;
    }>(`${LEMMY_OWN_URL}/api/v3/post/list?sort=Hot&limit=10`);
    return (data?.posts ?? []).map((pv) => {
      const post = pv.post;
      const text = post.body ? `${post.name}: ${post.body}` : post.name;
      return {
        id: `lemmy:${post.id}`,
        title: truncate(post.name, 80),
        description: truncate(text, 200),
        url: post.url ?? `${LEMMY_OWN_URL}/post/${post.id}`,
        source: 'lemmy',
        sourceLabel: 'Lemmy',
        sourceColor: '#00b868',
        score: pv.counts?.score ?? 0,
        velocity:
          (pv.counts?.upvotes ?? 0) /
          Math.max(1, (Date.now() - new Date(post.published).getTime()) / 3600000),
        engagement: (pv.counts?.upvotes ?? 0) + (pv.counts?.comments ?? 0),
        publishedAt: new Date(post.published).getTime(),
        metadata: {
          author: pv.creator?.display_name || pv.creator?.name || 'anon',
          avatarUrl: pv.creator?.avatar,
        },
      };
    });
  }

  async #fetchTrendingYouTube(): Promise<TrendingItem[]> {
    const apiKey = this.env.YOUTUBE_API_KEY;
    if (!apiKey) return [];
    const data = await fetchJsonWithTimeout<{
      items?: Array<{
        id: string;
        snippet: {
          title: string;
          description: string;
          publishedAt: string;
          channelTitle: string;
          thumbnails?: { high?: { url: string } };
        };
        statistics?: { viewCount?: string; likeCount?: string };
      }>;
    }>(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&maxResults=10&key=${apiKey}`,
    );
    return (data?.items ?? []).map((item) => ({
      id: `youtube:${item.id}`,
      title: item.snippet.title,
      description: truncate(item.snippet.description, 200),
      url: `https://www.youtube.com/watch?v=${item.id}`,
      source: 'youtube',
      sourceLabel: 'YouTube',
      sourceColor: '#ff0000',
      score: parseInt(item.statistics?.viewCount ?? '0', 10) / 1000,
      velocity:
        parseInt(item.statistics?.viewCount ?? '0', 10) /
        Math.max(1, (Date.now() - new Date(item.snippet.publishedAt).getTime()) / 3600000),
      engagement: parseInt(item.statistics?.likeCount ?? '0', 10),
      thumbnailUrl: item.snippet.thumbnails?.high?.url,
      publishedAt: new Date(item.snippet.publishedAt).getTime(),
      metadata: { channelTitle: item.snippet.channelTitle },
    }));
  }
}
