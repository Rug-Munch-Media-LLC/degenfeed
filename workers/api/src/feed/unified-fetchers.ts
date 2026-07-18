/**
 * unified-fetchers — Direct API fetchers for Lemmy, PeerTube, and YouTube.
 *
 * These are called by the unified feed orchestrator and bypass the main
 * provider registry because they fetch from specific self-hosted instances
 * rather than the generic protocol providers.
 */

import type { UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

// ─── Shared helpers ───────────────────────────────────────────────

function makeMinimalIdentity(
  protocol: string,
  id: string,
  name: string,
  handle?: string,
  avatarUrl?: string,
): UnifiedIdentity {
  return {
    id: `${protocol}:${id}`,
    primary: { protocol: protocol as never, id },
    handles: handle ? { [protocol]: handle } : {},
    displayName: name,
    bio: '',
    avatarUrl: avatarUrl ?? '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: {},
  };
}

function makeMetrics(likes = 0, reposts = 0, replies = 0, quotes = 0, views = 0) {
  return { likes, reposts, replies, quotes, views };
}

const EMPTY_METRICS = makeMetrics();
const EMPTY_ENGAGEMENT = {
  viewerLiked: false,
  viewerReposted: false,
  viewerBookmarked: false,
  raw: makeMetrics(),
};

// ─── Lemmy API fetcher ─────────────────────────────────────────────

interface LemmyApiPost {
  post: {
    id: number;
    body?: string;
    name: string;
    published: string;
    url?: string;
    thumbnail_url?: string;
    ap_id: string;
  };
  creator: {
    id: number;
    name: string;
    actor_id: string;
    avatar?: string;
  };
  community: {
    id: number;
    name: string;
    title: string;
    actor_id: string;
    icon?: string;
  };
  counts: {
    upvotes: number;
    downvotes: number;
    comments: number;
    score: number;
  };
}

interface LemmyApiResponse {
  posts: LemmyApiPost[];
  next_page?: string;
}

const LEMMY_INSTANCE = 'https://community.degenfeed.xyz';

export async function fetchLemmyPosts(
  section: string,
  cursor?: string,
  limit = 30,
): Promise<{ posts: UnifiedPost[]; nextCursor?: string }> {
  const sortMap: Record<string, string> = {
    hot: 'Hot',
    new: 'New',
    top: 'TopDay',
    active: 'Active',
  };
  const sort = sortMap[section] || 'Hot';
  const params = new URLSearchParams({ sort, limit: String(limit), type_: 'All' });
  if (cursor) params.set('page_cursor', cursor);

  const url = `${LEMMY_INSTANCE}/api/v3/post/list?${params.toString()}`;
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'DegenFeed/1.0' },
  });
  if (!res.ok) return { posts: [] };
  const data = (await res.json()) as LemmyApiResponse;

  const posts: UnifiedPost[] = (data.posts ?? []).map((p) => {
    const text = p.post.body ?? p.post.name;
    const published = Date.parse(p.post.published);
    const embeds: Array<{
      kind: 'image' | 'video' | 'link' | 'frame' | 'quote' | 'code';
      url: string;
      meta?: Record<string, unknown>;
    }> = [];
    if (p.post.url) {
      embeds.push({ kind: 'link', url: p.post.url });
    }
    if (p.post.thumbnail_url) {
      embeds.push({ kind: 'image', url: p.post.thumbnail_url });
    }

    return {
      id: `lemmy:${p.post.id}`,
      protocol: 'lemmy' as const,
      author: makeMinimalIdentity(
        'lemmy',
        String(p.creator.id),
        p.creator.name,
        p.creator.actor_id,
        p.creator.avatar,
      ),
      text,
      html: undefined,
      embeds,
      createdAt: Number.isNaN(published) ? Date.now() : published,
      metrics: makeMetrics(p.counts.upvotes, 0, p.counts.comments),
      engagement: { ...EMPTY_ENGAGEMENT, raw: makeMetrics(p.counts.upvotes, 0, p.counts.comments) },
      raw: p,
      niches: [],
      url: `${LEMMY_INSTANCE}/post/${p.post.id}`,
      community: p.community.name,
      communityTitle: p.community.title,
    } as unknown as UnifiedPost;
  });

  return { posts, nextCursor: data.next_page };
}

// ─── PeerTube API fetcher ──────────────────────────────────────────

interface PeerTubeApiVideo {
  uuid: string;
  name: string;
  description?: string;
  publishedAt: string;
  duration: number;
  views: number;
  likes: number;
  thumbnailPath: string;
  account: {
    id: number;
    name: string;
    displayName: string;
    url: string;
    avatar?: { path: string };
  };
  channel: {
    id: number;
    name: string;
    displayName: string;
    url: string;
    avatar?: { path: string };
  };
}

interface PeerTubeApiResponse {
  total: number;
  data: PeerTubeApiVideo[];
}

const PEERTUBE_INSTANCE = 'https://video.degenfeed.xyz';

export async function fetchPeerTubeVideos(limit = 20): Promise<UnifiedPost[]> {
  const url = `${PEERTUBE_INSTANCE}/api/v1/videos?count=${limit}&sort=-publishedAt&nsfw=false`;
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'DegenFeed/1.0' },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as PeerTubeApiResponse;

  return (data.data ?? []).map((v) => {
    const author = v.account ?? v.channel;
    const authorName = author?.displayName ?? author?.name ?? 'Unknown';
    const published = Date.parse(v.publishedAt);
    const thumbnailUrl = v.thumbnailPath
      ? `${PEERTUBE_INSTANCE}${v.thumbnailPath}`
      : `${PEERTUBE_INSTANCE}/static/thumbnails/${v.uuid}.jpg`;

    return {
      id: `peertube:${v.uuid}`,
      protocol: 'peertube' as const,
      author: makeMinimalIdentity(
        'peertube',
        String(author?.id ?? v.uuid),
        authorName,
        author?.url,
      ),
      text: v.name,
      html: v.description ? `<p>${v.description}</p>` : undefined,
      embeds: [
        {
          kind: 'video',
          url: `${PEERTUBE_INSTANCE}/w/${v.uuid}`,
          meta: { duration: v.duration, thumbnail: thumbnailUrl },
        },
      ],
      createdAt: Number.isNaN(published) ? Date.now() : published,
      metrics: makeMetrics(v.likes ?? 0, 0, 0, 0, v.views),
      engagement: { ...EMPTY_ENGAGEMENT, raw: makeMetrics(v.likes ?? 0, 0, 0, 0, v.views) },
      raw: v,
      niches: [],
      embedUrl: `${PEERTUBE_INSTANCE}/w/${v.uuid}`,
      thumbnail: thumbnailUrl,
      duration: v.duration,
      views: v.views,
    } as unknown as UnifiedPost;
  });
}

// ─── YouTube RSS fetcher ───────────────────────────────────────────
// YouTube offers video data in RSS. Each <entry> maps to a video.

const YOUTUBE_FEEDS = [
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCAl9Ld79qaZxp9JzEOwd3aA', // Bankless
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCqK_GSMbpiV8spgD3ZGloSw', // Coin Bureau
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC7-gGJFlRPPSK4hBbbST6YA', // Whiteboard Crypto
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCznv7Vf9nBdXFXz2L9n7bLQ', // Finematics/Altcoin Daily
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCcQ_2g7TDmI7Tpc4PqFFY_w', // Benjamin Cowen
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCqZQJzTlBvT5GpB1mqGzMxw', // Two Minute Papers
];

export async function fetchYouTubeVideos(
  limit = 20,
): Promise<{ posts: UnifiedPost[]; errors: string[] }> {
  const errors: string[] = [];
  const allPosts: UnifiedPost[] = [];

  const results = await Promise.allSettled(
    YOUTUBE_FEEDS.map(async (feedUrl) => {
      const res = await fetch(feedUrl, {
        headers: { accept: 'application/rss+xml', 'user-agent': 'DegenFeed/1.0' },
      });
      if (!res.ok) return [];
      const xml = await res.text();
      return parseYouTubeRss(xml, feedUrl);
    }),
  );

  for (const [i, r] of results.entries()) {
    if (r.status === 'fulfilled') {
      allPosts.push(...r.value);
    } else {
      errors.push(`youtube:feed:${i}: ${r.reason instanceof Error ? r.reason.message : 'failed'}`);
    }
  }

  // Deduplicate by videoId, limit results
  const seen = new Set<string>();
  const deduped = allPosts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return { posts: deduped.slice(0, limit), errors };
}

function parseYouTubeRss(xml: string, feedUrl: string): UnifiedPost[] {
  const posts: UnifiedPost[] = [];

  const channelIdMatch = feedUrl.match(/channel_id=([\w-]+)/);
  const channelId = channelIdMatch?.[1] ?? '';

  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let entryMatch = entryRegex.exec(xml);
  while (entryMatch !== null) {
    const block = entryMatch[1];
    if (block) {
      const videoId = extractXmlTag(block, 'yt:videoId');
      const title = extractXmlTag(block, 'title');
      const published = extractXmlTag(block, 'published');
      const channelName = extractXmlTag(block, 'name') || extractXmlTag(block, 'author');
      const description = extractXmlTag(block, 'media:description');
      const thumbnailUrl = extractXmlAttr(block, 'media:thumbnail', 'url');

      if (videoId && title) {
        const pubDate = Date.parse(published);
        const authorName = channelName || 'YouTube Creator';

        posts.push({
          id: `youtube:${videoId}`,
          protocol: 'youtube' as const,
          author: makeMinimalIdentity(
            'youtube',
            channelId || videoId,
            decodeXmlEntities(authorName),
            `https://www.youtube.com/channel/${channelId}`,
            thumbnailUrl ? `${thumbnailUrl}&type=avatar` : undefined,
          ),
          text: decodeXmlEntities(title),
          html: description ? `<p>${decodeXmlEntities(description)}</p>` : undefined,
          embeds: [
            {
              kind: 'video',
              url: `https://www.youtube.com/watch?v=${videoId}`,
              meta: {
                channelName: decodeXmlEntities(authorName),
                thumbnail: thumbnailUrl,
              },
            },
          ],
          createdAt: Number.isNaN(pubDate) ? Date.now() : pubDate,
          metrics: EMPTY_METRICS,
          engagement: EMPTY_ENGAGEMENT,
          raw: { videoId, channelId, channelName },
          niches: [],
          embedUrl: `https://www.youtube.com/watch?v=${videoId}`,
          channelName: decodeXmlEntities(authorName),
        } as unknown as UnifiedPost);
      }
    }
    entryMatch = entryRegex.exec(xml);
  }

  return posts;
}

function extractXmlTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)</${escaped}>`, 'i');
  const m = re.exec(xml);
  if (!m?.[1]) return '';
  return decodeXmlEntities(m[1].trim());
}

function extractXmlAttr(xml: string, tag: string, attr: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escaped}[^>]*${attr}\\s*=\\s*["']([^"']*)["']`, 'i');
  const m = re.exec(xml);
  if (!m?.[1]) return '';
  return m[1];
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .trim();
}
