/**
 * SoundCloud Provider — Audio/AudioFeeds
 *
 * SoundCloud has RSS feeds for artists/tracks. While not fully open-source,
 * it has 76M+ monthly active users and provides public RSS/API access.
 *
 * What it adds: Audio content to the timeline (music, podcasts, mixes)
 * API: RSS feeds per artist + public API
 * Rate limit: 10 req/s (unauthenticated)
 *
 * NOTE (2026-08-06): SoundCloud RSS only exists for accounts that have
 * enabled "podcast" RSS on their profile — most big artists have it
 * disabled. The curated IDs below were verified to return items. The
 * provider ALSO resolves user IDs from profile pages at runtime
 * (https://soundcloud.com/{username} contains `soundcloud:users:{id}`),
 * so new curated users can be added without re-verifying IDs.
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;
const USER_AGENT = 'DegenFeed-Bridge/0.2 (SoundCloud RSS)';

/** 90s TTL — collapse repeated feed-build calls into one real fetch window. */
const SC_CACHE_TTL_MS = 90_000;
let scCache: { posts: UnifiedPost[]; expiresAt: number } | null = null;

/** Memoized username → RSS URL resolution (profile pages are expensive). */
const RESOLVED_USER_URLS_MAX = 2_000;
const resolvedUserUrls = new Map<string, string | null>();
function rememberResolvedUserUrl(username: string, url: string | null): void {
  resolvedUserUrls.delete(username);
  resolvedUserUrls.set(username, url);
  if (resolvedUserUrls.size > RESOLVED_USER_URLS_MAX) {
    const oldest = resolvedUserUrls.keys().next();
    if (!oldest.done) resolvedUserUrls.delete(oldest.value);
  }
}

const SOUNDCLOUD_FEEDS: Array<{ url: string; label: string; genre: string }> = [
  // Electronic/Dance music curators — verified RSS-enabled 2026-08-06
  {
    url: 'https://feeds.soundcloud.com/users/soundcloud:users:8553751/sounds.rss',
    label: 'Monstercat',
    genre: 'electronic',
  },
  {
    url: 'https://feeds.soundcloud.com/users/soundcloud:users:53282567/sounds.rss',
    label: 'CloudKid',
    genre: 'electronic',
  },
  {
    url: 'https://feeds.soundcloud.com/users/soundcloud:users:1444689353/sounds.rss',
    label: 'NCS',
    genre: 'electronic',
  },
  {
    url: 'https://feeds.soundcloud.com/users/soundcloud:users:371762/sounds.rss',
    label: 'Proximity',
    genre: 'chill',
  },
  {
    url: 'https://feeds.soundcloud.com/users/soundcloud:users:26057743/sounds.rss',
    label: 'Trap City',
    genre: 'trap',
  },
  // Mainstream electronic artists — verified RSS-enabled 2026-08-06
  {
    url: 'https://feeds.soundcloud.com/users/soundcloud:users:856062/sounds.rss',
    label: 'Skrillex',
    genre: 'dubstep',
  },
  {
    url: 'https://feeds.soundcloud.com/users/soundcloud:users:16730/sounds.rss',
    label: 'Diplo',
    genre: 'electronic',
  },
  {
    url: 'https://feeds.soundcloud.com/users/soundcloud:users:203410014/sounds.rss',
    label: 'deadmau5',
    genre: 'progressive',
  },
];

/** Usernames to resolve at runtime → RSS (extra sources beyond the static list). */
const RESOLVE_USERNAMES = [
  'monstercat',
  'cloudkid',
  'skrillex',
  'diplo',
  'proximity',
  'trapcity',
  'ncs',
  'deadmau5',
];

interface SoundCloudRSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  'itunes:duration'?: string;
  'media:content'?: { '@_url'?: string };
  enclosure?: { '@_url'?: string; '@_type'?: string };
}

async function parseFeedXML(xml: string): Promise<SoundCloudRSSItem[]> {
  const items: SoundCloudRSSItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const xmlMatches = xml.matchAll(itemRegex);
  for (const match of xmlMatches) {
    const itemXml = match[1]!;
    const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    const link = itemXml.match(/<link>(.*?)<\/link>/);
    const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
    const desc = itemXml.match(
      /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/,
    );
    const duration = itemXml.match(/<itunes:duration>(.*?)<\/itunes:duration>/);
    const enclosureUrl = itemXml.match(/<enclosure[^>]*url="([^"]*)"/);
    const mediaUrl = itemXml.match(/<media:content[^>]*url="([^"]*)"/);
    const mediaType = itemXml.match(/<media:content[^>]*type="([^"]*)"/);

    items.push({
      title: title?.[1] ?? title?.[2] ?? '',
      link: link?.[1] ?? '',
      pubDate: pubDate?.[1] ?? '',
      description: desc?.[1] ?? desc?.[2] ?? '',
      'itunes:duration': duration?.[1],
      'media:content': mediaUrl ? { '@_url': mediaUrl[1] } : undefined,
      enclosure: enclosureUrl ? { '@_url': enclosureUrl[1], '@_type': mediaType?.[1] } : undefined,
    });
  }
  return items;
}

/** Resolve a SoundCloud username to its RSS feed URL (profile page meta). */
async function resolveUserRssUrl(username: string): Promise<string | null> {
  if (resolvedUserUrls.has(username)) return resolvedUserUrls.get(username) ?? null;
  try {
    const res = await $fetch(`https://soundcloud.com/${encodeURIComponent(username)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DegenFeed-Bridge/0.2)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      rememberResolvedUserUrl(username, null);
      return null;
    }
    const html = await res.text();
    const m = html.match(/soundcloud:users:(\d+)/);
    if (!m?.[1]) {
      rememberResolvedUserUrl(username, null);
      return null;
    }
    const url = `https://feeds.soundcloud.com/users/soundcloud:users:${m[1]}/sounds.rss`;
    rememberResolvedUserUrl(username, url);
    return url;
  } catch {
    rememberResolvedUserUrl(username, null);
    return null;
  }
}

async function fetchFeed(
  source: { url: string; label: string; genre: string },
  limit: number,
): Promise<UnifiedPost[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await $fetch(source.url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return [];

    const xml = await res.text();
    const items = await parseFeedXML(xml);
    const posts: UnifiedPost[] = [];

    for (const item of items.slice(0, limit)) {
      const audioUrl = item.enclosure?.['@_url'] ?? item['media:content']?.['@_url'] ?? '';
      const createdAt = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
      if (!item.title && !audioUrl) continue;

      posts.push({
        id: `soundcloud-${Buffer.from(item.link ?? item.title ?? '')
          .toString('base64')
          .slice(0, 32)}`,
        protocol: 'soundcloud',
        author: {
          id: `soundcloud:${source.label}`,
          primary: { protocol: 'soundcloud', id: source.label },
          handles: { soundcloud: source.label.toLowerCase().replace(/\s+/g, '') },
          displayName: source.label,
          bio: `${source.genre} music curator`,
          avatarUrl: '',
          followerCount: 0,
          followingCount: 0,
          url: `https://soundcloud.com/${source.label.toLowerCase().replace(/\s+/g, '')}`,
          links: [],
          keys: {},
        },
        text: item.title ?? '',
        html: `<p>${item.description ?? ''}</p>`,
        embeds: [
          ...(audioUrl ? [{ kind: 'audio' as const, url: audioUrl }] : []),
          ...(item.link ? [{ kind: 'link' as const, url: item.link }] : []),
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
        niches: ['music', 'audio', source.genre],
        contentType: 'audio',
      });
    }
    return posts;
  } catch {
    return [];
  }
}

export async function fetchSoundCloudPosts(limit: number = 20): Promise<UnifiedPost[]> {
  const key = 'provider:soundcloud';
  if (!checkRateLimit(key, { maxRequests: 30, windowMs: 60_000 })) return [];

  // Serve from cache first — the prewarmer + refresher call this repeatedly.
  const cached = scCache && Date.now() < scCache.expiresAt ? scCache.posts : null;
  if (cached) return cached.slice(0, limit);

  // Resolve extra usernames at runtime — only once per process (memoized).
  const extraSources: Array<{ url: string; label: string; genre: string }> = [];
  for (const username of RESOLVE_USERNAMES) {
    if (extraSources.length >= 6) break;
    if (SOUNDCLOUD_FEEDS.some((s) => s.label.toLowerCase() === username.toLowerCase())) continue;
    const url = await resolveUserRssUrl(username);
    if (url) extraSources.push({ url, label: username, genre: 'electronic' });
  }

  const sources = [...SOUNDCLOUD_FEEDS, ...extraSources];
  const perSource = Math.max(3, Math.ceil(limit / sources.length));

  // Fetch in small batches (3) — SoundCloud throttles concurrent RSS fetches.
  const posts: UnifiedPost[] = [];
  const BATCH = 3;
  for (let i = 0; i < sources.length; i += BATCH) {
    const batch = sources.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map((src) => fetchFeed(src, perSource)));
    for (const r of results) {
      if (r.status === 'fulfilled') posts.push(...r.value);
    }
  }

  // Deduplicate by id (resolved sources may overlap with static list)
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of posts.sort((a, b) => b.createdAt - a.createdAt)) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    deduped.push(p);
    if (deduped.length >= limit) break;
  }

  // console.log(`[bridge] SoundCloud: ${deduped.length} posts from ${sources.length} sources`);
  // Only cache non-empty results so a bad window is retried next cycle.
  if (deduped.length > 0) {
    scCache = { posts: deduped, expiresAt: Date.now() + SC_CACHE_TTL_MS };
  }
  return deduped;
}

export const schema: SchemaGuard = {
  id: 'soundcloud',
  name: 'SoundCloud Music',
  description: 'Electronic music, mixes & tracks from SoundCloud curators',
  endpoint: '/api/feed/soundcloud',
  requiresAuth: false,
  contentType: 'audio',
};
