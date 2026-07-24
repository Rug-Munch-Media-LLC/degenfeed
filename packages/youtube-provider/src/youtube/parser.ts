import type { RSSEntry, YouTubeChannel } from './types';

/**
 * Parse YouTube Atom RSS feed XML into structured entries.
 */
function parseYouTubeRss(xml: string, channel: YouTubeChannel): RSSEntry[] {
  const entries: RSSEntry[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  const matches = Array.from(xml.matchAll(entryRegex));

  for (const match of matches) {
    const entryXml = match[1];
    if (!entryXml) continue;
    try {
      const videoId = extractXmlTag(entryXml, 'yt:videoId') ?? '';
      const title = decodeXmlEntities(extractXmlTag(entryXml, 'title') ?? '');
      const link = extractLinkHref(entryXml);
      const published = extractXmlTag(entryXml, 'published') ?? '';
      const description = decodeXmlEntities(extractXmlTag(entryXml, 'media:description') ?? '');
      const thumbnail = extractThumbnailUrl(entryXml) ?? undefined;
      if (!videoId || !title) continue;
      const durationStr = extractXmlTag(entryXml, 'yt:duration');
      const duration = durationStr ? parseDurationAttribute(durationStr) : undefined;
      const views = extractMediaStatisticsViews(entryXml);
      entries.push({
        videoId,
        title,
        link: link ?? `https://www.youtube.com/watch?v=${videoId}`,
        published,
        updated: extractXmlTag(entryXml, 'updated') ?? published,
        description,
        channelName: channel.name,
        channelId: channel.channelId,
        thumbnail,
        duration,
        views,
      });
    } catch {
      /* skip malformed entries */
    }
  }
  return entries;
}

function parseDurationAttribute(xml: string): number | undefined {
  const match = xml.match(/seconds\s*=\s*["'](\d+)["']/i);
  if (match?.[1]) {
    const val = Number.parseInt(match[1], 10);
    return Number.isFinite(val) ? val : undefined;
  }
  return undefined;
}

function extractMediaStatisticsViews(xml: string): number | undefined {
  const match = xml.match(/<media:statistics[^>]*views\s*=\s*["'](\d+)["']/i);
  if (match?.[1]) {
    const val = Number.parseInt(match[1], 10);
    return Number.isFinite(val) ? val : undefined;
  }
  return undefined;
}

function extractXmlTag(xml: string, tag: string): string | null {
  const escaped = tag.replace(':', '\\:');
  const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`);
  const match = xml.match(re);
  return match?.[1]?.trim() ?? null;
}

function extractLinkHref(xml: string): string | null {
  const match = xml.match(/<link[^>]*href="([^"]+)"/);
  return match?.[1] ?? null;
}

function extractThumbnailUrl(xml: string): string | null {
  const match = xml.match(/<media:thumbnail[^>]*url="([^"]+)"/);
  if (match?.[1]) return match[1];
  const contentMatch = xml.match(/<media:content[^>]*url="([^"]+)"/);
  return contentMatch?.[1] ?? null;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .trim();
}

/**
 * Fetch a single YouTube RSS feed and parse it.
 */
export async function fetchChannelFeed(
  channel: YouTubeChannel,
  signal?: AbortSignal,
): Promise<RSSEntry[]> {
  try {
    const response = await fetch(
      channel.feed ?? `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`,
      {
        signal,
        headers: {
          'User-Agent': 'DegenFeed/1.0 (+https://degenfeed.xyz)',
          Accept: 'application/xml, text/xml, */*',
        },
      },
    );
    if (!response.ok) {
      console.warn(`[youtube-provider] HTTP ${response.status} for ${channel.name}`, {
        status: response.status,
        channel: channel.name,
      });
      return [];
    }
    const xml = await response.text();
    if (!xml || xml.length < 100) return [];
    return parseYouTubeRss(xml, channel);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return [];
    console.warn(
      `[youtube-provider] Failed to fetch ${channel.name}`,
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}
