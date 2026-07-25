/**
 * @degenfeed/api-worker — Trending Sidebar
 *
 * GET /api/trending/sidebar — Returns all sidebar sections in one call.
 * Aggregates topics, communities, videos, spaces, nostr, farcaster, and tippers.
 * Cached for 120 seconds (2 min) in KV.
 */

import { type Env, jsonResponse } from '../index';

// ─── Types ────────────────────────────────────────────────────────────────

export interface TrendingTopic {
  topic: string;
  count: number;
  score: number;
  change: number; // direction: positive = up, negative = down
}

export interface ActiveCommunity {
  id: string;
  name: string;
  displayName?: string;
  icon?: string;
  memberCount: number;
  protocol: string;
}

export interface PopularVideo {
  id: string;
  title: string;
  platform: 'peertube' | 'youtube';
  url: string;
  thumbnailUrl?: string;
  authorName: string;
  viewCount: number;
}

export interface LiveSpace {
  id: string;
  title: string;
  hostName: string;
  hostAvatarUrl?: string;
  listenerCount: number;
  speakerCount: number;
}

export interface TrendingNostrNote {
  id: string;
  content: string;
  authorName: string;
  authorAvatar?: string;
  likes: number;
  replies: number;
}

export interface TrendingFarcasterCast {
  hash: string;
  text: string;
  authorName: string;
  authorAvatar?: string;
  likes: number;
  recasts: number;
}

export interface TopTipper {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  amountUsd: number;
  tipCount: number;
}

export interface TrendingSidebarResponse {
  topics: TrendingTopic[];
  communities: ActiveCommunity[];
  videos: PopularVideo[];
  spaces: LiveSpace[];
  nostr: TrendingNostrNote[];
  farcaster: TrendingFarcasterCast[];
  tippers: TopTipper[];
  fetchedAt: number;
}

// ─── KV TTL ────────────────────────────────────────────────────────────────

const SIDEBAR_CACHE_TTL = 120; // 2 minutes
const CACHE_KEY = 'trending:sidebar:v1';
const _FETCH_TIMEOUT_MS = 4000;
const API_TIMEOUT_MS = 2000;

// ─── Feed helper (internal loopback) ───────────────────────────────────────

async function fetchRecentPosts(_env: Env, limit = 100): Promise<unknown[]> {
  try {
    const feedReq = new Request(
      `http://localhost/api/feed/home?limit=${limit}&sort=hot&protocols=nostr,farcaster,lens,bluesky,mastodon,threads,reddit,rss`,
    );
    const feedRes = await fetch(feedReq);
    if (!feedRes.ok) return [];
    const body = (await feedRes.json()) as { data?: unknown[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

// ─── Section data fetchers ─────────────────────────────────────────────────

function computeTopics(posts: unknown[]): TrendingTopic[] {
  const now = Date.now();
  const cutoff = now - 24 * 3600000;
  const nicheMap = new Map<string, { count: number; score: number; prevScore: number }>();
  const prevCutoff = now - 48 * 3600000;

  for (const post of posts as Array<Record<string, unknown>>) {
    const createdAt = Number(post.createdAt) || 0;
    if (createdAt < cutoff) continue;
    const engagement =
      Number((post.metrics as Record<string, number>)?.likes || 0) +
      Number((post.metrics as Record<string, number>)?.reposts || 0) * 2 +
      Number((post.metrics as Record<string, number>)?.replies || 0) * 3;
    const recency = Math.max(0.1, 1 - (now - createdAt) / (24 * 3600000));
    const niches = (post.niches as string[]) ?? [];

    for (const niche of niches) {
      const cur = nicheMap.get(niche) ?? { count: 0, score: 0, prevScore: 0 };
      cur.count++;
      cur.score += engagement * recency;
      // Track previous period contribution
      if (createdAt >= prevCutoff && createdAt < cutoff) {
        cur.prevScore += engagement * recency * 0.5;
      }
      nicheMap.set(niche, cur);
    }
  }

  return Array.from(nicheMap.entries())
    .map(([topic, data]) => {
      const change =
        data.prevScore > 0
          ? Math.round(((data.score - data.prevScore) / data.prevScore) * 100)
          : data.score > 0
            ? 100
            : 0;
      return {
        topic,
        count: data.count,
        score: Math.round(data.score * 100) / 100,
        change: Math.max(-100, Math.min(100, change)),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

async function fetchCommunities(_env: Env): Promise<ActiveCommunity[]> {
  try {
    const res = await fetch(`http://localhost/api/discover/communities`, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: ActiveCommunity[] };
    return (body.data ?? []).slice(0, 3);
  } catch {
    return [];
  }
}

async function fetchVideos(_env: Env): Promise<PopularVideo[]> {
  // Try PeerTube API + YouTube RSS
  const videos: PopularVideo[] = [];

  // 1. PeerTube trending
  try {
    const ptRes = await fetch('https://peertube.tv/api/v1/videos?sort=-trending&count=3', {
      headers: { 'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)' },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (ptRes.ok) {
      const ptData = (await ptRes.json()) as {
        data?: Array<{
          uuid: string;
          name: string;
          thumbnailPath?: string;
          author?: { displayName?: string };
          account?: { displayName?: string };
          embedPath?: string;
        }>;
      };
      for (const v of (ptData.data ?? []).slice(0, 3)) {
        videos.push({
          id: `peertube:${v.uuid}`,
          title: v.name,
          platform: 'peertube',
          url: `https://peertube.tv/w/${v.uuid}`,
          thumbnailUrl: v.thumbnailPath ? `https://peertube.tv${v.thumbnailPath}` : undefined,
          authorName: v.author?.displayName ?? v.account?.displayName ?? 'Unknown',
          viewCount: 0,
        });
      }
    }
  } catch {
    // PeerTube unavailable — use fallback
  }

  // 2. YouTube trending via RSS (if PeerTube returned nothing)
  if (videos.length < 3) {
    try {
      const ytRes = await fetch('https://www.youtube.com/feed/trending?hl=en', {
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; DegenFeed/0.1)',
        },
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
      if (ytRes.ok) {
        const html = await ytRes.text();
        // Extract video IDs from the initial data
        const matches = html.match(/"videoId":"([^"]+)"/g) ?? [];
        const seen = new Set<string>();
        for (const m of matches.slice(0, 10)) {
          const vid = m.replace(/"videoId":"/, '').replace('"', '');
          if (seen.has(vid)) continue;
          seen.add(vid);
          if (videos.length >= 3) break;
          // Try to get title from nearby JSON
          const titleMatch = html.match(
            new RegExp(`"videoId":"${vid}".*?"title":\\{"runs":\\[\\{"text":"([^"]+)"`, 's'),
          );
          videos.push({
            id: `youtube:${vid}`,
            title: titleMatch?.[1] ?? `YouTube Video ${vid}`,
            platform: 'youtube',
            url: `https://youtube.com/watch?v=${vid}`,
            thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
            authorName: 'YouTube',
            viewCount: 0,
          });
        }
      }
    } catch {
      // YouTube unavailable
    }
  }

  return videos.slice(0, 3);
}

async function fetchLiveSpaces(_env: Env): Promise<LiveSpace[]> {
  try {
    const res = await fetch(`http://localhost/api/spaces/live`, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      spaces?: Array<{
        id: string;
        title: string;
        hostName: string;
        hostAvatarUrl?: string;
        listeners: number;
        speakers: Array<unknown>;
      }>;
    };
    return (body.spaces ?? []).slice(0, 3).map((s) => ({
      id: s.id,
      title: s.title,
      hostName: s.hostName,
      hostAvatarUrl: s.hostAvatarUrl,
      listenerCount: s.listeners,
      speakerCount: s.speakers?.length ?? 0,
    }));
  } catch {
    return [];
  }
}

async function fetchNostrTrending(): Promise<TrendingNostrNote[]> {
  try {
    const res = await fetch('https://api.nostr.band/v0/trending/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 3 }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      notes?: Array<{
        id: string;
        content: string;
        pubkey: string;
        likes: number;
        replies: number;
        author?: { name?: string; picture?: string };
      }>;
    };
    return (body.notes ?? []).slice(0, 3).map((n) => {
      const cleaned = n.content
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\n+/g, ' ')
        .trim()
        .slice(0, 120);
      return {
        id: n.id,
        content: cleaned || '(media)',
        authorName: n.author?.name ?? n.pubkey.slice(0, 12),
        authorAvatar: n.author?.picture,
        likes: n.likes ?? 0,
        replies: n.replies ?? 0,
      };
    });
  } catch {
    return [];
  }
}

async function fetchFarcasterTrending(env: Env): Promise<TrendingFarcasterCast[]> {
  try {
    const hubUrl = env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';
    const curatedFids = [3, 2, 1, 228, 239, 5650, 602];
    const casts: TrendingFarcasterCast[] = [];

    for (const fid of curatedFids) {
      try {
        const res = await fetch(
          `${hubUrl}/v1/castsByFid?fid=${fid}&pageSize=1`,
          {
            signal: AbortSignal.timeout(API_TIMEOUT_MS),
            headers: { accept: 'application/json' },
          },
        );
        if (!res.ok) continue;
        const data = (await res.json()) as { messages?: Array<{ hash: string; data: { castAddBody: { text: string }; fid: number; timestamp: number } }> };
        for (const msg of data.messages ?? []) {
          const text = msg.data?.castAddBody?.text;
          if (!text) continue;
          casts.push({ hash: msg.hash, text: text.slice(0, 200), author: { username: `fid:${msg.data.fid}` }, reactions: { likes_count: 0, recasts_count: 0 } } as TrendingFarcasterCast);
        }
      } catch { continue; }
      if (casts.length >= 3) break;
    }

    return casts.slice(0, 3).map((c) => ({
      hash: c.hash,
      text: c.text.slice(0, 120),
      authorName: c.author.display_name ?? c.author.username ?? 'Unknown',
      authorAvatar: c.author.pfp_url,
      likes: c.reactions?.likes_count ?? 0,
      recasts: c.reactions?.recasts_count ?? 0,
    }));
  } catch {
    return [];
  }
}

async function fetchTopTippers(_env: Env): Promise<TopTipper[]> {
  try {
    const res = await fetch(`http://localhost/api/tip/unified/leaderboard?period=weekly&limit=3`, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      entries?: Array<{
        userId?: string;
        totalUsd?: number;
        count?: number;
        displayName?: string;
        handle?: string;
        avatarUrl?: string;
      }>;
    };
    return (body.entries ?? []).slice(0, 3).map((e, i) => ({
      id: e.userId ?? `tipper:${i}`,
      name: e.displayName ?? e.handle ?? `Tipper #${i + 1}`,
      handle: e.handle ?? '',
      avatarUrl: e.avatarUrl ?? '',
      amountUsd: e.totalUsd ?? 0,
      tipCount: e.count ?? 0,
    }));
  } catch {
    return [];
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────

export async function handleTrendingSidebar(_request: Request, env: Env): Promise<Response> {
  // Try cache first
  try {
    const cached = await env.CACHE?.get(CACHE_KEY);
    if (cached) {
      return jsonResponse(JSON.parse(cached));
    }
  } catch {
    /* KV operation failed -- non-critical, continue */
  }

  // Fetch all sections in parallel
  const postsPromise = fetchRecentPosts(env, 200)
    .then(computeTopics)
    .catch(() => [] as TrendingTopic[]);
  const communitiesPromise = fetchCommunities(env);
  const videosPromise = fetchVideos(env);
  const spacesPromise = fetchLiveSpaces(env);
  const nostrPromise = fetchNostrTrending();
  const farcasterPromise = fetchFarcasterTrending(env);
  const tippersPromise = fetchTopTippers(env);

  const [topics, communities, videos, spaces, nostrNotes, farcasterCasts, tippers] =
    await Promise.all([
      postsPromise,
      communitiesPromise,
      videosPromise,
      spacesPromise,
      nostrPromise,
      farcasterPromise,
      tippersPromise,
    ]);

  const response: TrendingSidebarResponse = {
    topics,
    communities,
    videos,
    spaces,
    nostr: nostrNotes,
    farcaster: farcasterCasts,
    tippers,
    fetchedAt: Date.now(),
  };

  // Cache for 2 minutes
  try {
    await env.CACHE?.put(CACHE_KEY, JSON.stringify(response), {
      expirationTtl: SIDEBAR_CACHE_TTL,
    });
  } catch {
    /* KV operation failed -- non-critical, continue */
  }

  return jsonResponse(response);
}
