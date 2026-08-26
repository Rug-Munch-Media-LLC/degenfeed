/**
 * Vimeo Provider — Professional Video Platform
 *
 * 200M+ users. The Vimeo API requires a bearer token for public data
 * (datacenter fetches get error 8003 "app didn't receive credentials"),
 * so this provider uses Vimeo's public channel RSS feeds instead:
 *
 *   https://vimeo.com/channels/{slug}/videos/rss
 *
 * Channel RSS is unauthenticated, returns ~10 recent videos per channel,
 * and includes duration, thumbnail and author credit via media: tags.
 *
 * Rate limit: channels fetch sequentially; 10 req/refresh is well within
 * any limit.
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;
const USER_AGENT = 'DegenFeed-Bridge/0.2 (Vimeo RSS)';

/** 90s TTL — collapse repeated feed-build calls into one real fetch window. */
const VIMEO_CACHE_TTL_MS = 90_000;
let vimeoCache: { posts: UnifiedPost[]; expiresAt: number } | null = null;

const VIMEO_CHANNELS = [
  'staffpicks',
  'music',
  'animation',
  'documentary',
  'art',
  'video',
  'lessons',
];

interface VimeoRSSItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  videoId: string;
  duration: number;
  author: string;
  thumbnail: string;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
}

/** Parse a Vimeo channel RSS document into normalized items. */
function parseVimeoRSS(xml: string): VimeoRSSItem[] {
  const items: VimeoRSSItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null = itemRe.exec(xml);
  while (m !== null) {
    const block = m[1];
    if (block) {
      const title =
        block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
      const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() ?? '';
      const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? '';
      const description =
        block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1]?.trim() ?? '';
      const mediaThumb =
        block.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1]?.trim() ?? '';
      const mediaAuthor =
        block.match(/<media:credit[^>]*>([\s\S]*?)<\/media:credit>/i)?.[1]?.trim() ?? '';
      const durationRaw = block.match(/<media:content[^>]*duration="(\d+)"/i)?.[1];
      const videoId =
        link.match(/\/videos\/(\d+)/)?.[1] ?? link.match(/\/video\/(\d+)/)?.[1] ?? '';
      const duration = durationRaw ? Number.parseInt(durationRaw, 10) : 0;

      if (title && link) {
        items.push({
          title: decodeHtmlEntities(title),
          link,
          pubDate,
          description: decodeHtmlEntities(description).slice(0, 500),
          videoId,
          duration: Number.isFinite(duration) ? duration : 0,
          author: decodeHtmlEntities(mediaAuthor),
          thumbnail: mediaThumb,
        });
      }
    }
    m = itemRe.exec(xml);
  }
  return items;
}

async function fetchChannel(channel: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await $fetch(`https://vimeo.com/channels/${channel}/videos/rss`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return [];

    const xml = await res.text();
    const items = parseVimeoRSS(xml);
    const posts: UnifiedPost[] = [];

    for (const item of items.slice(0, limit)) {
      const createdAt = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
      posts.push({
        id: `vimeo:${item.videoId || Buffer.from(item.link).toString('base64').slice(0, 16)}`,
        protocol: 'vimeo',
        author: {
          id: `vimeo:channel:${channel}`,
          primary: { protocol: 'vimeo', id: item.author || channel },
          handles: { vimeo: channel },
          displayName: item.author || channel,
          bio: `${channel} channel video`,
          avatarUrl: '',
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: {},
        },
        text: `🎬 ${item.title}`,
        html: item.description ? `<p>${item.description}</p>` : undefined,
        embeds: [
          { kind: 'video' as const, url: item.link, meta: { duration: item.duration } },
          ...(item.thumbnail ? [{ kind: 'image' as const, url: item.thumbnail }] : []),
        ],
        createdAt,
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: item,
        niches: ['video', channel],
        contentType: 'video',
      });
    }
    return posts;
  } catch {
    return [];
  }
}

export async function fetchVimeoPosts(limit: number = 20): Promise<UnifiedPost[]> {
  const key = 'provider:vimeo';
  if (!checkRateLimit(key, { maxRequests: 30, windowMs: 60_000 })) return [];

  // Serve from cache first — the prewarmer + refresher call this repeatedly.
  const cached = vimeoCache && Date.now() < vimeoCache.expiresAt ? vimeoCache.posts : null;
  if (cached) return cached.slice(0, limit);

  const perChannel = Math.max(3, Math.ceil(limit / VIMEO_CHANNELS.length));

  // Fetch in small batches (3) — Vimeo RSS can be flaky under concurrency.
  const posts: UnifiedPost[] = [];
  const BATCH = 3;
  for (let i = 0; i < VIMEO_CHANNELS.length; i += BATCH) {
    const batch = VIMEO_CHANNELS.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map((channel) => fetchChannel(channel, perChannel)));
    for (const r of results) {
      if (r.status === 'fulfilled') posts.push(...r.value);
    }
  }

  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of posts.sort((a, b) => b.createdAt - a.createdAt)) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    deduped.push(p);
    if (deduped.length >= limit) break;
  }

  // console.log(`[bridge] Vimeo: ${deduped.length} posts from ${VIMEO_CHANNELS.length} channels`);
  // Only cache non-empty results so a bad window is retried next cycle.
  if (deduped.length > 0) {
    vimeoCache = { posts: deduped, expiresAt: Date.now() + VIMEO_CACHE_TTL_MS };
  }
  return deduped;
}

export const schema: SchemaGuard = {
  id: 'vimeo',
  name: 'Vimeo',
  description: 'High-quality curated videos — staff picks, music, animation, documentaries',
  endpoint: '/api/feed/vimeo',
  requiresAuth: false,
  contentType: 'video',
};
