/**
 * Bandcamp Provider — Music & Album Discovery
 *
 * Bandcamp has per-artist RSS feeds for new releases. 50M+ monthly visitors.
 * Not open-source but provides public RSS feeds.
 *
 * What it adds: Music albums, tracks, and merch from indie artists
 * API: RSS feeds
 * Rate limit: ~10 req/s
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;
const USER_AGENT = 'DegenFeed-Bridge/0.1 (Bandcamp RSS)';

const BANDCAMP_FEEDS: Array<{ url: string; label: string; tag: string }> = [
  { url: 'https://bandcamp.com/feed?tag=electronic', label: 'Electronic', tag: 'electronic' },
  { url: 'https://bandcamp.com/feed?tag=hip-hop', label: 'Hip-Hop', tag: 'hip-hop' },
  { url: 'https://bandcamp.com/feed?tag=experimental', label: 'Experimental', tag: 'experimental' },
  { url: 'https://bandcamp.com/feed?tag=ambient', label: 'Ambient', tag: 'ambient' },
  { url: 'https://bandcamp.com/feed?tag=techno', label: 'Techno', tag: 'techno' },
  { url: 'https://bandcamp.com/feed?tag=jazz', label: 'Jazz', tag: 'jazz' },
];

interface BandcampItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  'media:content'?: { '@_url'?: string; '@_medium'?: string };
}

async function parseFeedXML(xml: string): Promise<BandcampItem[]> {
  const items: BandcampItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const xmlMatches = xml.matchAll(itemRegex);
  for (const match of xmlMatches) {
    const ix = match[1];
    const title = ix.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    const link = ix.match(/<link>(.*?)<\/link>/);
    const pubDate = ix.match(/<pubDate>(.*?)<\/pubDate>/);
    const desc = ix.match(
      /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/,
    );
    const mediaUrl = ix.match(/<media:content[^>]*url="([^"]*)"/);
    const mediaMedium = ix.match(/<media:content[^>]*medium="([^"]*)"/);

    items.push({
      title: title?.[1] ?? title?.[2] ?? '',
      link: link?.[1] ?? '',
      pubDate: pubDate?.[1] ?? '',
      description: desc?.[1] ?? desc?.[2] ?? '',
      'media:content': mediaUrl
        ? { '@_url': mediaUrl[1], '@_medium': mediaMedium?.[1] }
        : undefined,
    });
  }
  return items;
}

async function fetchFeed(
  source: { url: string; label: string; tag: string },
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
      const coverUrl = item['media:content']?.['@_url'] ?? '';
      const createdAt = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();

      posts.push({
        id: `bandcamp-${Buffer.from(item.link ?? item.title ?? '')
          .toString('base64')
          .slice(0, 32)}`,
        protocol: 'bandcamp',
        author: {
          id: `bandcamp:${source.label}`,
          primary: { protocol: 'bandcamp', id: source.label.toLowerCase() },
          handles: { bandcamp: source.label.toLowerCase() },
          displayName: `Bandcamp ${source.label}`,
          bio: `New ${source.tag} releases on Bandcamp`,
          avatarUrl: '',
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: {},
        },
        text: `🎵 ${item.title ?? ''}`,
        html: `<p>${item.description ?? ''}</p>`,
        embeds: [
          ...(coverUrl ? [{ kind: 'image' as const, url: coverUrl }] : []),
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
        niches: ['music', 'bandcamp', source.tag],
        contentType: 'audio',
      });
    }
    return posts;
  } catch {
    return [];
  }
}

export async function fetchBandcampPosts(limit: number = 20): Promise<UnifiedPost[]> {
  const key = 'provider:bandcamp';
  if (!checkRateLimit(key, { maxRequests: 30, windowMs: 60_000 })) return [];

  const perSource = Math.max(3, Math.ceil(limit / BANDCAMP_FEEDS.length));
  const results = await Promise.allSettled(BANDCAMP_FEEDS.map((src) => fetchFeed(src, perSource)));

  const posts: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') posts.push(...r.value);
  }

  return posts.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export const schema: SchemaGuard = {
  id: 'bandcamp',
  name: 'Bandcamp Music',
  description: 'Indie music, albums & tracks — new releases from Bandcamp artists',
  endpoint: '/api/feed/bandcamp',
  requiresAuth: false,
  contentType: 'audio',
};
