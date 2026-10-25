/**
 * @degenfeed/utils — RSS item parsing
 *
 * Single responsibility: pull the common fields out of `<item>` elements in
 * an RSS 2.0 / RSS 1.0 (RDF) document. No network access, no XML validation
 * beyond the shape guards below.
 */

/** Parsed RSS item as extracted from XML. Missing tags become `''`. */
export interface RssItem {
  title?: string;
  link?: string;
  guid?: string;
  description?: string;
  author?: string;
  pubDate?: string;
}

/**
 * Parse RSS XML items into structured objects.
 *
 * Extracts common RSS fields from `<item>` elements including
 * title, link, guid, description, author (with `<dc:creator>` fallback),
 * and pubDate.
 *
 * @param xml - Raw RSS XML string
 * @returns Array of parsed RSS items
 *
 * @example
 * ```ts
 * const items = parseRssItems(`<?xml version="1.0"?>
 *   <rss version="2.0"><channel>
 *     <item>
 *       <title>Hello World</title>
 *       <link>https://example.com/post/1</link>
 *       <guid>123</guid>
 *       <description>My first post</description>
 *       <author>alice</author>
 *       <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
 *     </item>
 *   </channel></rss>`);
 * // items[0].title === 'Hello World'
 * ```
 */
export function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  for (const m of xml.matchAll(itemRe)) {
    if (!m[1]) continue;
    const e: string = m[1];
    items.push({
      title: (e.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '',
      link: (e.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '',
      guid: (e.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1] || '',
      description: (e.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || '',
      author:
        (e.match(/<author[^>]*>([\s\S]*?)<\/author>/i) || [])[1] ||
        (e.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i) || [])[1] ||
        '',
      pubDate: (e.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || '',
    });
  }
  return items;
}
