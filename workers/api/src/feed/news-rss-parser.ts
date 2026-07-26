/**
 * news-rss-parser — RSS/Atom feed parser for the news pipeline.
 *
 * Extracted from news-aggregator.ts during de-godding.
 * Parses RSS 2.0 and Atom feeds into ParsedRssItem objects.
 */

import { type Env } from '../types';
import { extractText, extractAll, decodeXmlEntities, stripTags } from './news-helpers';
import type { ParsedRssItem } from './news-types';

/**
 * Fetch an RSS/Atom feed URL and return raw XML text.
 */
export async function fetchRssFeed(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'user-agent': 'DegenFeed/0.1 (news aggregator; +https://degenfeed.xyz)',
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      return null;
    }
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Parse RSS 2.0 or Atom XML into ParsedRssItem array.
 */
export function parseFeedXml(xml: string, maxItems = 20): ParsedRssItem[] {
  // Try Atom first
  if (xml.trim().includes('<feed')) {
    return parseAtom(xml, maxItems);
  }

  // RSS 2.0
  const items: ParsedRssItem[] = [];
  const itemRe = /<item([^>]*)>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null = itemRe.exec(xml);

  while (m !== null && items.length < maxItems) {
    const itemXml = m[2] || '';
    const title = extractText('title', itemXml);
    const link = extractText('link', itemXml) || extractText('guid', itemXml);
    const description = extractText('description', itemXml);
    const content = extractText('content:encoded', itemXml) || extractText('content', itemXml);
    const pubDate = extractText('pubDate', itemXml) || extractText('dc:date', itemXml);
    const creator = extractText('dc:creator', itemXml) || extractText('author', itemXml);
    const categories = extractAll('category', itemXml);

    let image = '';
    const media = itemXml.match(/<media:content[^>]+url\s*=\s*["']([^"']+)["']/i);
    if (media?.[1]) image = media[1];
    const mediaThumbnailMatch = itemXml.match(/<media:thumbnail[^>]+url\s*=\s*["']([^"']+)["']/i);
    const mediaThumbnail = mediaThumbnailMatch?.[1] ?? '';
    const enclosure = itemXml.match(/<enclosure[^>]+url\s*=\s*["']([^"']+)["']/i);
    const enclosureUrl = enclosure?.[1] ?? '';
    const enclosureTypeMatch = enclosure?.input?.match(/type\s*=\s*["']([^"']+)["']/i);
    const enclosureType = enclosureTypeMatch?.[1] ?? '';
    if (!image && enclosureUrl && enclosureType?.startsWith('image')) image = enclosureUrl;
    if (!image && mediaThumbnail) image = mediaThumbnail;
    const imgTag = itemXml.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
    if (!image && imgTag?.[1]) image = imgTag[1];

    if (title && link) {
      items.push({
        title, link, description, pubDate, creator, content, image, categories,
        mediaThumbnail, enclosureUrl, enclosureType,
      });
    }
    m = itemRe.exec(xml);
  }

  return items;
}

/**
 * Parse Atom XML feed format.
 */
function parseAtom(xml: string, maxItems = 20): ParsedRssItem[] {
  const items: ParsedRssItem[] = [];
  const entryRe = /<entry([^>]*)>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null = entryRe.exec(xml);

  while (m !== null && items.length < maxItems) {
    const entryXml = m[2] || '';
    const title = extractText('title', entryXml);
    const linkMatch = entryXml.match(/<link[^>]+href\s*=\s*["']([^"']+)["']/i);
    const link = linkMatch?.[1] || extractText('id', entryXml);
    const description = extractText('summary', entryXml);
    const content = extractText('content', entryXml);
    const pubDate = extractText('updated', entryXml) || extractText('published', entryXml);
    const creator = extractText('name', entryXml);
    const categories = extractAll('category', entryXml);

    let image = '';
    const imgTag = entryXml.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
    if (imgTag?.[1]) image = imgTag[1];
    const mediaThumbnailMatch = entryXml.match(/<media:thumbnail[^>]+url\s*=\s*["']([^"']+)["']/i);
    if (!image && mediaThumbnailMatch?.[1]) image = mediaThumbnailMatch[1];

    if (title && link) {
      items.push({ title, link, description, pubDate, creator, content, image, categories });
    }
    m = entryRe.exec(xml);
  }

  return items;
}
