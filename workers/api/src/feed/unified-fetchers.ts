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
  limit = 50,
): Promise<{ posts: UnifiedPost[]; nextCursor?: string }> {
  const sortMap: Record<string, string> = {
    hot: 'Hot',
    new: 'New',
    top: 'TopDay',
    active: 'Active',
  };
  const sort = sortMap[section] || 'Hot';
  const params = new URLSearchParams({
    sort,
    limit: String(limit),
    type_: 'All',
  });
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
      engagement: {
        ...EMPTY_ENGAGEMENT,
        raw: makeMetrics(p.counts.upvotes, 0, p.counts.comments),
      },
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

const DEFAULT_PEERTUBE_INSTANCE = 'https://video.degenfeed.xyz';

/**
 * Resolve the PeerTube instance URL at runtime.
 * Prefers an explicitly passed instance URL, then the PEERTUBE_INSTANCE_URL
 * binding, then the default self-hosted instance.
 */
export function resolvePeerTubeInstance(
  instanceUrl?: string,
  env?: { PEERTUBE_INSTANCE_URL?: string },
): string {
  const candidate = instanceUrl || env?.PEERTUBE_INSTANCE_URL || DEFAULT_PEERTUBE_INSTANCE;
  return candidate.replace(/\/+$/, '');
}

export async function fetchPeerTubeVideos(
  limit = 50,
  instanceUrl?: string,
  env?: { PEERTUBE_INSTANCE_URL?: string },
): Promise<UnifiedPost[]> {
  const instance = resolvePeerTubeInstance(instanceUrl, env);
  const url = `${instance}/api/v1/videos?count=${limit}&sort=-publishedAt&nsfw=false`;
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
      ? `${instance}${v.thumbnailPath}`
      : `${instance}/static/thumbnails/${v.uuid}.jpg`;

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
          url: `${instance}/w/${v.uuid}`,
          meta: { duration: v.duration, thumbnail: thumbnailUrl },
        },
      ],
      createdAt: Number.isNaN(published) ? Date.now() : published,
      metrics: makeMetrics(v.likes ?? 0, 0, 0, 0, v.views),
      engagement: {
        ...EMPTY_ENGAGEMENT,
        raw: makeMetrics(v.likes ?? 0, 0, 0, 0, v.views),
      },
      raw: v,
      niches: [],
      embedUrl: `${instance}/w/${v.uuid}`,
      thumbnail: thumbnailUrl,
      duration: v.duration,
      views: v.views,
    } as unknown as UnifiedPost;
  });
}

// ─── YouTube RSS fetcher ───────────────────────────────────────────
// YouTube offers video data in RSS. Each <entry> maps to a video.

// YouTube offers video data in RSS. Each <entry> maps to a video.
//
// 2026-08-06: EVERY feed below was verified live against the RSS endpoint
// (HTTP 200) — the previous list contained 16 dead channel IDs (404) which
// left the feed stuck at ~30 posts. Channels are a mix of crypto, tech and
// creator content so a full fetch yields 250+ candidates → 50+ deduped posts.
const YOUTUBE_FEEDS = [
  // ── Crypto / Web3 (verified 200) ───────────────────────────────
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCAl9Ld79qaZxp9JzEOwd3aA', // Bankless
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCqK_GSMbpiV8spgD3ZGloSw', // Coin Bureau
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC7KjtEJT6HvI3kBcF2I4vXg', // Altcoin Daily
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCMRAyvvdf0wVNoEXfyc-J3Q', // CryptosRUs
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCH6KS5IiLfTyunVHPCDYT8Q', // InvestAnswers
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCi8P6Yk4bJpnxS0PU7ZG0AQ', // Cryptonauts
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCiFyJ_EBmF2XJuR9buWE_3A', // Unchained Podcast
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCOZRnhGFjclZcBFHDoIn2Ig', // Cointelegraph
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCXZ3MDueoRA0fHDFF5khbrw', // Thinking Crypto
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCXEl1p2upTA3qOSHaCoGYlw', // Digital Asset News
  'https://www.youtube.com/feeds/videos.xml?user=aantonop', // Andreas Antonopoulos
  'https://www.youtube.com/feeds/videos.xml?user=CoinDesk', // CoinDesk
  // ── Tech / Science / Creator (verified 200) ────────────────────
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCJIfeSCssxSC_Dhc5s7woww', // Lex Fridman
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCG7J20LhUeLl6y_Emi7OJrA', // MKBHD
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCdBK94H6oZT2Q7l0-b0xmMg', // LinusTechTips
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCXuqSBlHAE6Xw-yeJA0Tunw', // TechLinked
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC2Xd-TjJByJyK2w1zNwY0zQ', // Fireship
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC1_uAIS3r8Vu6JjXWvastJg', // 3Blue1Brown
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCQALLeQPoZdZC4JNUboVEUg', // sentdex
];

export async function fetchYouTubeVideos(
  limit = 50,
): Promise<{ posts: UnifiedPost[]; errors: string[] }> {
  const errors: string[] = [];
  const allPosts: UnifiedPost[] = [];

  const results = await Promise.allSettled(
    YOUTUBE_FEEDS.map(async (feedUrl) => {
      const res = await fetch(feedUrl, {
        headers: {
          accept: 'application/rss+xml',
          'user-agent': 'DegenFeed/1.0',
        },
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

  // Support both ?channel_id= and legacy ?user= feed URLs. Legacy user feeds
  // have no channel ID — we derive the author handle from the entry content.
  const channelIdMatch = feedUrl.match(/channel_id=([\w-]+)/);
  const userMatch = feedUrl.match(/[?&]user=([\w.-]+)/);
  const channelId = channelIdMatch?.[1] ?? '';
  const userHandle = userMatch?.[1] ?? '';

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
        const resolvedChannelId = channelId || userHandle || videoId;
        const channelUrl = channelId
          ? `https://www.youtube.com/channel/${channelId}`
          : userHandle
            ? `https://www.youtube.com/@${userHandle}`
            : undefined;

        posts.push({
          id: `youtube:${videoId}`,
          protocol: 'youtube' as const,
          author: makeMinimalIdentity(
            'youtube',
            resolvedChannelId,
            decodeXmlEntities(authorName),
            channelUrl,
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
          raw: { videoId, channelId, channelName, thumbnail: thumbnailUrl, description },
          niches: [],
          contentType: 'video' as const,
          image: thumbnailUrl,
          media: thumbnailUrl,
          thumbnail: thumbnailUrl,
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
