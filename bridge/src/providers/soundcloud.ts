/**
 * SoundCloud Provider — Audio/AudioFeeds
 *
 * SoundCloud has RSS feeds for artists/tracks. While not fully open-source,
 * it has 76M+ monthly active users and provides public RSS/API access.
 *
 * What it adds: Audio content to the timeline (music, podcasts, mixes)
 * API: RSS feeds per artist + public API
 * Rate limit: 10 req/s (unauthenticated)
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;
const USER_AGENT = 'DegenFeed-Bridge/0.1 (SoundCloud RSS)';

const SOUNDCLOUD_FEEDS: Array<{ url: string; label: string; genre: string }> = [
  // Electronic/Dance music curators
  {
    url: 'https://feeds.soundcloud.com/users/soundcloud:users:11813417/sounds.rss',
    label: 'Monstercat',
    genre: 'electronic',
  },
  {
    url: 'https://feeds.soundcloud.com/users/soundcloud:users:25298967/sounds.rss',
    label: 'MrSuicideSheep',
    genre: 'chill',
  },
  {
    url: 'https://feeds.soundcloud.com/users/soundcloud:users:58789854/sounds.rss',
    label: 'UKF',
    genre: 'dubstep',
  },
  {
    url: 'https://feeds.soundcloud.com/users/soundcloud:users:14167058/sounds.rss',
    label: 'Trap Nation',
    genre: 'trap',
  },
  // Web3/Crypto music
  {
    url: 'https://feeds.soundcloud.com/users/soundcloud:users:112580959/sounds.rss',
    label: 'Audius',
    genre: 'web3',
  },
  {
    url: 'https://feeds.soundcloud.com/users/soundcloud:users:85743833/sounds.rss',
    label: 'DJ Mixes',
    genre: 'mixes',
  },
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
    const itemXml = match[1];
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

async function fetchFeed(
  source: { url: string; label: string; genre: string },
  limit: number,
): Promise<UnifiedPost[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
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

  const perSource = Math.max(3, Math.ceil(limit / SOUNDCLOUD_FEEDS.length));
  const results = await Promise.allSettled(
    SOUNDCLOUD_FEEDS.map((src) => fetchFeed(src, perSource)),
  );

  const posts: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') posts.push(...r.value);
  }

  return posts.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export const schema: SchemaGuard = {
  id: 'soundcloud',
  name: 'SoundCloud Music',
  description: 'Electronic music, mixes & tracks from SoundCloud curators',
  endpoint: '/api/feed/soundcloud',
  requiresAuth: false,
  contentType: 'audio',
};
