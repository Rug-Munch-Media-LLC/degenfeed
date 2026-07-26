/**
 * @degenfeed/api-worker — BitChute Video Bridge
 *
 * Fetches video content from BitChute (WebTorrent-based platform).
 * Sources:
 *   - Channel RSS: https://www.bitchute.com/feeds/rss/channel/{id}
 *   - Global RSS:  https://www.bitchute.com/feeds/rss/
 *
 * BitChute uses RSS feeds for content distribution.
 * Video content is served via WebTorrent peer-to-peer.
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { VideoPlatform } from '../../lib/creator-resolver';
import type { UnifiedVideo } from '../video-aggregator';

const PLATFORM: VideoPlatform = 'bitchute';
const PLATFORM_LABEL = 'BitChute';
const PLATFORM_COLOR = '#8B0000';

const BITCHUTE_WEB = 'https://www.bitchute.com';

// ─── Fetch channel videos ──────────────────────────────────────────────────

export async function fetchBitchuteChannelVideos(
  channelId: string,
  limit: number = 10,
): Promise<UnifiedVideo[]> {
  try {
    const id = channelId.replace(/^@/, '').toLowerCase();
    const url = `${BITCHUTE_WEB}/feeds/rss/channel/${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      headers: { accept: 'application/rss+xml' },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    return parseBitchuteRss(xml, id, limit);
  } catch {
    return [];
  }
}

// ─── Fetch trending ────────────────────────────────────────────────────────

export async function fetchBitchuteTrending(
  _category: string = '',
  limit: number = 20,
): Promise<UnifiedVideo[]> {
  try {
    const url = `${BITCHUTE_WEB}/feeds/rss/`;
    const res = await fetch(url, {
      headers: { accept: 'application/rss+xml' },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    return parseBitchuteRss(xml, 'trending', limit);
  } catch {
    return [];
  }
}

// ─── Search (BitChute has no search RSS; we scrape the search page) ────────

export async function searchBitchute(query: string, limit: number = 10): Promise<UnifiedVideo[]> {
  try {
    const url = `${BITCHUTE_WEB}/search/${encodeURIComponent(query)}/`;
    const res = await fetch(url, {
      headers: {
        accept: 'text/html',
        'user-agent': 'DegenFeed/1.0',
      },
    });
    if (!res.ok) return [];

    const html = await res.text();

    // Extract video entries from search results page
    const videos: UnifiedVideo[] = [];
    const videoRegex = /<a[^>]*href="\/video\/([^"/]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match = videoRegex.exec(html);

    while (match !== null && videos.length < limit) {
      const videoId = match[1];
      const block = match[2];
      if (!block) {
        match = videoRegex.exec(html);
        continue;
      }
      const titleMatch = block.match(/title="([^"]+)"/);
      const title = titleMatch?.[1] ?? 'Untitled';
      const channelMatch = html.match(
        new RegExp(`<a[^>]*href="/channel/${videoId}"[^>]*>([^<]+)</a>`, 'i'),
      );

      const thumbnail = `https://www.bitchute.com/thumbnail/${videoId}/`;

      videos.push({
        id: `bitchute:${videoId}`,
        title,
        description: '',
        thumbnail,
        url: `${BITCHUTE_WEB}/video/${videoId}`,
        duration: 0,
        platform: PLATFORM,
        platformLabel: PLATFORM_LABEL,
        platformColor: PLATFORM_COLOR,
        creatorName: channelMatch?.[1]?.trim() ?? 'BitChute Creator',
        creatorId: `bitchute:${videoId}`,
        creatorAvatar: '',
        creatorUrl: `${BITCHUTE_WEB}/channel/${videoId}`,
        viewCount: 0,
        likeCount: 0,
        publishedAt: new Date().toISOString(),
        publishedMs: Date.now(),
        category: 'entertainment',
        tags: [],
        isShort: false,
        isLive: false,
        qualityScore: 20,
      });

      match = videoRegex.exec(html);
    }

    return videos;
  } catch {
    return [];
  }
}

// ─── RSS parser ────────────────────────────────────────────────────────────

function parseBitchuteRss(xml: string, _channelId: string, limit: number): UnifiedVideo[] {
  const videos: UnifiedVideo[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match = itemRegex.exec(xml);

  while (match !== null && videos.length < limit) {
    const block = match[1];
    if (block) {
      const title = extractXmlTag(block, 'title');
      const link = extractXmlTag(block, 'link');
      const pubDate = extractXmlTag(block, 'pubDate');
      const description = extractXmlTag(block, 'description');
      const author = extractXmlTag(block, 'author');
      const channelName = extractXmlTag(block, 'dc:creator') || author;

      // Extract video ID from link
      const videoIdMatch = link.match(/\/video\/([^"/?]+)/);
      const videoId = videoIdMatch?.[1] ?? simpleHash(link);

      if (title && link) {
        const publishedMs = Date.parse(pubDate);
        const decodedTitle = decodeXml(title);
        const decodedDesc = decodeXml(description);
        const decodedChannel = decodeXml(channelName || 'BitChute Creator');

        videos.push({
          id: `bitchute:${videoId}`,
          title: decodedTitle,
          description: decodedDesc,
          thumbnail: `https://www.bitchute.com/thumbnail/${videoId}/`,
          url: link,
          duration: 0,
          platform: PLATFORM,
          platformLabel: PLATFORM_LABEL,
          platformColor: PLATFORM_COLOR,
          creatorName: decodedChannel,
          creatorId: `bitchute:${decodedChannel}`,
          creatorAvatar: '',
          creatorUrl: `${BITCHUTE_WEB}/channel/${decodedChannel}`,
          viewCount: 0,
          likeCount: 0,
          publishedAt: new Date(publishedMs).toISOString(),
          publishedMs: Number.isNaN(publishedMs) ? Date.now() : publishedMs,
          category: inferCategory(decodedTitle, decodedDesc),
          tags: [],
          isShort: false,
          isLive: false,
          qualityScore: 20,
        });
      }
    }
    match = itemRegex.exec(xml);
  }

  return videos;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function extractXmlTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)</${escaped}>`, 'i');
  const m = re.exec(xml);
  return m?.[1]?.trim() ?? '';
}

function decodeXml(str: string): string {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function inferCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  const map: Array<[string, string]> = [
    ['news', 'news'],
    ['politics', 'news'],
    ['gaming', 'gaming'],
    ['music', 'music'],
    ['tech', 'tech'],
    ['comedy', 'comedy'],
    ['crypto', 'crypto'],
  ];
  for (const [kw, cat] of map) {
    if (text.includes(kw)) return cat;
  }
  return 'entertainment';
}
