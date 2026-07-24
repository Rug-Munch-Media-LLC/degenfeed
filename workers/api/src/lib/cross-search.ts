import type { Protocol } from '@degenfeed/types';
import type { Env } from '../index';

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
const GTS_OWN_URL = 'https://social.degenfeed.xyz';

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
    protocols?: Protocol[];
    limit: number;
  }): Promise<CrossSearchResults> {
    const start = performance.now();
    const q = opts.query.trim();
    const types = opts.types ?? ['posts', 'creators', 'communities'];
    const limit = Math.min(opts.limit, 100);

    const results: CrossSearchResults = {
      query: q,
      totalResults: 0,
      results: { posts: [], creators: [], coins: [], communities: [], articles: [], videos: [] },
      sourceBreakdown: {},
      searchTime: 0,
    };

    const fetchers: Promise<void>[] = [];

    if (types.includes('posts') || types.includes('creators') || types.includes('communities')) {
      fetchers.push(this.searchActivityPub(q).then((r) => this.#collect(results, r, 'posts')));
      fetchers.push(this.searchATProtocol(q).then((r) => this.#collect(results, r, 'posts')));
      fetchers.push(this.searchNostr(q).then((r) => this.#collect(results, r, 'posts')));
      fetchers.push(this.searchFarcaster(q).then((r) => this.#collect(results, r, 'posts')));
      fetchers.push(this.searchLens(q).then((r) => this.#collect(results, r, 'posts')));
      fetchers.push(this.searchLemmy(q).then((r) => this.#collect(results, r, 'posts')));
    }

    if (types.includes('communities')) {
      fetchers.push(
        this.searchLemmyCommunities(q).then((r) => this.#collect(results, r, 'communities')),
      );
    }

    if (types.includes('articles')) {
      fetchers.push(this.searchMirror(q).then((r) => this.#collect(results, r, 'articles')));
      fetchers.push(this.searchParagraph(q).then((r) => this.#collect(results, r, 'articles')));
    }

    if (types.includes('videos')) {
      fetchers.push(this.searchYouTube(q).then((r) => this.#collect(results, r, 'videos')));
      fetchers.push(this.searchPeerTube(q).then((r) => this.#collect(results, r, 'videos')));
    }

    if (types.includes('coins')) {
      fetchers.push(this.searchZora(q).then((r) => this.#collect(results, r, 'coins')));
    }

    // Hard deadline
    const deadline = new Promise<void>((resolve) => setTimeout(resolve, HARD_DEADLINE_MS));
    await Promise.race([Promise.allSettled(fetchers).then(() => undefined), deadline]);

    // Deduplicate by URL and rank
    for (const category of Object.keys(results.results) as (keyof typeof results.results)[]) {
      const seen = new Set<string>();
      results.results[category] = (results.results[category] as SearchResult[])
        .filter((r) => {
          const key = r.url || r.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
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
      `${GTS_OWN_URL}/api/v2/search?q=${encodeURIComponent(query)}&type=statuses&limit=20&resolve=true`,
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
    const base = this.env.FARCASTER_HUB_URL?.startsWith('https://api.')
      ? this.env.FARCASTER_HUB_URL
      : 'https://api.farcaster.xyz';
    const data = await fetchJsonWithTimeout<{
      result?: {
        casts?: Array<{
          hash: string;
          text?: string;
          timestamp?: number;
          author?: { displayName?: string; username?: string; pfp?: { url?: string } };
          reactions?: { count?: number };
          recasts?: { count?: number };
        }>;
      };
    }>(`${base}/v2/cast-search?q=${encodeURIComponent(query)}&limit=20`);
    return (data?.result?.casts ?? []).slice(0, 10).map((c) => {
      return makeResult({
        id: `farcaster:${c.hash}`,
        type: 'post',
        title: truncate(c.text ?? '', 80),
        description: truncate(c.text ?? '', 200),
        source: 'farcaster',
        relevanceScore: 0.8 + ((c.reactions?.count ?? 0) + (c.recasts?.count ?? 0) * 2) * 0.01,
        url: `https://warpcast.com/${c.author?.username || '~'}/${c.hash.slice(0, 8)}`,
        metadata: {
          author: c.author?.displayName || c.author?.username || 'unknown',
          avatarUrl: c.author?.pfp?.url,
          likes: c.reactions?.count ?? 0,
          recasts: c.recasts?.count ?? 0,
        },
      });
    });
  }

  // ─── Lens Search ──────────────────────────────────────────────

  async searchLens(query: string): Promise<SearchResult[]> {
    const apiUrl = this.env.LENS_API_URL || 'https://api.lens.xyz/graphql';
    const data = await fetchJsonWithTimeout<{
      data?: {
        posts?: {
          items?: Array<{
            id: string;
            metadata?: { content?: string; asset?: { image?: { raw?: { uri?: string } } } };
            author?: {
              username?: { localName?: string };
              metadata?: { displayName?: string; picture?: string };
            };
            createdAt?: string;
            stats?: { reactions?: number; comments?: number; mirrors?: number };
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
    return (data?.data?.posts?.items ?? []).slice(0, 10).map((item) => {
      const text = item.metadata?.content ?? '';
      return makeResult({
        id: `lens:${item.id}`,
        type: 'post',
        title: truncate(text, 80),
        description: truncate(text, 200),
        source: 'lens',
        relevanceScore: 0.7 + (item.stats?.reactions ?? 0) * 0.01,
        thumbnail: item.metadata?.asset?.image?.raw?.uri,
        url: `https://hey.xyz/posts/${item.id}`,
        metadata: {
          author:
            item.author?.metadata?.displayName || item.author?.username?.localName || 'lens user',
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
    // Public YouTube search via Innertube (no API key required for basic search)
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
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(query)}&key=${this.env.YOUTUBE_API_KEY || ''}`,
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
    }>(`${GTS_OWN_URL}/api/v1/trends/statuses?limit=10`);
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
    const base = this.env.FARCASTER_HUB_URL?.startsWith('https://api.')
      ? this.env.FARCASTER_HUB_URL
      : 'https://api.farcaster.xyz';
    const data = await fetchJsonWithTimeout<{
      result?: {
        casts?: Array<{
          hash: string;
          text?: string;
          timestamp?: number;
          author?: { displayName?: string; username?: string; pfp?: { url?: string } };
          reactions?: { count?: number };
          recasts?: { count?: number };
        }>;
      };
    }>(`${base}/v2/feed?limit=10&feedType=trending`);
    return (data?.result?.casts ?? []).map((c) => ({
      id: `farcaster:${c.hash}`,
      title: truncate(c.text ?? '', 80),
      description: truncate(c.text ?? '', 200),
      url: `https://warpcast.com/${c.author?.username || '~'}/${c.hash.slice(0, 8)}`,
      source: 'farcaster',
      sourceLabel: 'Farcaster',
      sourceColor: '#8a63d2',
      score: (c.reactions?.count ?? 0) + (c.recasts?.count ?? 0) * 2,
      velocity:
        (c.reactions?.count ?? 0) /
        Math.max(
          1,
          (c.timestamp ?? Date.now()) > 1e12
            ? (Date.now() - (c.timestamp ?? Date.now())) / 3600000
            : 1,
        ),
      engagement: (c.reactions?.count ?? 0) + (c.recasts?.count ?? 0),
      publishedAt: (c.timestamp ?? 0) > 1e12 ? (c.timestamp ?? 0) : (c.timestamp ?? 0) * 1000,
      metadata: {
        author: c.author?.displayName || c.author?.username || 'unknown',
        avatarUrl: c.author?.pfp?.url,
      },
    }));
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
