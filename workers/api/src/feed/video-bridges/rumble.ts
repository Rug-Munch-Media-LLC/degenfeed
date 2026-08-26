/**
 * @degenfeed/api-worker — Rumble Video Bridge
 *
 * Fetches video content from Rumble via RSS feeds.
 * Sources:
 *   - Channel RSS: https://rumble.com/c/{channel}/rss
 *   - Global RSS:  https://rumble.com/feed.rss
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { VideoPlatform } from '../../lib/creator-resolver';
import type { UnifiedVideo } from '../video-aggregator-types';

const PLATFORM: VideoPlatform = 'rumble';
const PLATFORM_LABEL = 'Rumble';
const PLATFORM_COLOR = '#85C742';

// ─── Fetch channel videos ──────────────────────────────────────────────────

export async function fetchRumbleChannelVideos(
  channelName: string,
  limit: number = 10,
): Promise<UnifiedVideo[]> {
  try {
    const name = channelName.replace(/^@/, '').toLowerCase();
    const url = `https://rumble.com/c/${encodeURIComponent(name)}/rss`;
    const res = await fetch(url, {
      headers: { accept: 'application/rss+xml' },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    return parseRumbleRss(xml, name, limit);
  } catch {
    return [];
  }
}

// ─── Fetch trending ────────────────────────────────────────────────────────

export async function fetchRumbleTrending(
  _category: string = '',
  limit: number = 20,
): Promise<UnifiedVideo[]> {
  try {
    const url = 'https://rumble.com/feed.rss';
    const res = await fetch(url, {
      headers: { accept: 'application/rss+xml' },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    return parseRumbleRss(xml, 'trending', limit);
  } catch {
    return [];
  }
}

// ─── Search ────────────────────────────────────────────────────────────────

export async function searchRumble(query: string, limit: number = 10): Promise<UnifiedVideo[]> {
  try {
    const url = `https://rumble.com/search/${encodeURIComponent(query)}/rss`;
    const res = await fetch(url, {
      headers: { accept: 'application/rss+xml' },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    return parseRumbleRss(xml, 'search', limit);
  } catch {
    return [];
  }
}

// ─── RSS parser ────────────────────────────────────────────────────────────

function parseRumbleRss(xml: string, _channelName: string, limit: number): UnifiedVideo[] {
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
      const thumbnail = extractXmlAttr(block, 'media:thumbnail', 'url');
      const channelName =
        extractXmlTag(block, 'channel') || extractXmlTag(block, 'media:credit') || 'Rumble Creator';
      const duration = Number.parseInt(extractXmlTag(block, 'media:duration') || '0', 10);

      if (title && link) {
        const publishedMs = Date.parse(pubDate);
        const decodedTitle = decodeXmlEntities(title);
        const decodedDesc = decodeXmlEntities(description);
        const decodedChannel = decodeXmlEntities(channelName);

        videos.push({
          id: `rumble:${simpleHash(link)}`,
          title: decodedTitle,
          description: decodedDesc,
          thumbnail: thumbnail || `https://placehold.co/640x360/85C742/FFFFFF?text=Rumble`,
          url: link,
          duration,
          platform: PLATFORM,
          platformLabel: PLATFORM_LABEL,
          platformColor: PLATFORM_COLOR,
          creatorName: decodedChannel,
          creatorId: `rumble:${decodedChannel}`,
          creatorAvatar: '',
          creatorUrl: `https://rumble.com/c/${encodeURIComponent(decodedChannel)}`,
          viewCount: 0,
          likeCount: 0,
          publishedAt: new Date(publishedMs).toISOString(),
          publishedMs: Number.isNaN(publishedMs) ? Date.now() : publishedMs,
          category: inferCategory(decodedTitle, decodedDesc),
          tags: [],
          isShort: duration > 0 && duration <= 60,
          isLive: false,
          qualityScore: 30,
        });
      }
    }
    match = itemRegex.exec(xml);
  }

  return videos;
}

// ─── XML helpers ───────────────────────────────────────────────────────────

function extractXmlTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)</${escaped}>`, 'i');
  const m = re.exec(xml);
  return m?.[1]?.trim() ?? '';
}

function extractXmlAttr(xml: string, tag: string, attr: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escaped}[^>]*${attr}\\s*=\\s*["']([^"']*)["']`, 'i');
  const m = re.exec(xml);
  return m?.[1] ?? '';
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .trim();
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// ─── Category inference ────────────────────────────────────────────────────

function inferCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  const map: Array<[string, string]> = [
    ['crypto', 'crypto'],
    ['bitcoin', 'crypto'],
    ['news', 'news'],
    ['politics', 'news'],
    ['gaming', 'gaming'],
    ['gameplay', 'gaming'],
    ['music', 'music'],
    ['sport', 'sports'],
    ['tech', 'tech'],
    ['comedy', 'comedy'],
    ['funny', 'comedy'],
  ];
  for (const [kw, cat] of map) {
    if (text.includes(kw)) return cat;
  }
  return 'entertainment';
}
