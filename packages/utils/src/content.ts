/**
 * @degenfeed/utils — Content parsing utilities
 *
 * Shared content-processing functions extracted from protocol adapters.
 * These are pure functions with no network or protocol dependencies.
 */

// ─── Types ──────────────────────────────────────────────────────────────

/** Parsed RSS item as extracted from XML */
export interface RssItem {
  title?: string;
  link?: string;
  guid?: string;
  description?: string;
  author?: string;
  pubDate?: string;
}

// ─── HTML sanitization ────────────────────────────────────────────────

/**
 * Strip HTML tags and decode common XML/HTML entities.
 * Converts `<br>` to newlines for better readability.
 *
 * @param html - Raw HTML string to sanitize
 * @returns Plain text with tags removed and entities decoded
 *
 * @example
 * ```ts
 * stripHtml('<p>Hello &amp; <b>world</b></p>')
 * // => 'Hello & world'
 * ```
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;|&nbsp;/g, (m) => {
      const map: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&nbsp;': ' ',
      };
      return map[m] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Niche classification ──────────────────────────────────────────────

/**
 * Guess content niches from text using keyword matching.
 *
 * Unions keyword patterns from all protocol adapters for comprehensive
 * detection. Pass optional extra context (e.g., title, tags) to improve
 * detection accuracy.
 *
 * @param text  - Post body/content text to classify
 * @param extra - Optional extra context (title, joined tags, etc.)
 * @returns Array of niche strings (never empty; defaults to ['social'])
 *
 * @example
 * ```ts
 * guessNiches('Bitcoin and blockchain technology')
 * // => ['crypto', 'tech']
 *
 * guessNiches('Just a regular post')
 * // => ['social']
 * ```
 */
export function guessNiches(text: string, extra?: string): string[] {
  const lower = extra ? `${text} ${extra}`.toLowerCase() : text.toLowerCase();
  const n: string[] = [];

  if (/\b(btc|bitcoin|crypto|blockchain|web3|defi|nft|eth|solana|token)\b/.test(lower))
    n.push('crypto');

  if (
    /\b(tech|programming|code|software|linux|foss|self-host|startup|saas|developer|javascript|typescript|webdev|elixir)\b/.test(
      lower,
    )
  )
    n.push('tech');

  if (
    /\b(privacy|surveillance|encryption|security|decentralized|nomadic|federation|permissions)\b/.test(
      lower,
    )
  )
    n.push('privacy');

  if (/\b(fediverse|activitypub|social)\b/.test(lower)) n.push('fediverse');

  if (
    /\b(ai|artificial intelligence|llm|machine learning|gpt|openai|stable diffusion)\b/.test(lower)
  )
    n.push('ai');

  if (
    /\b(art|illustration|drawing|photo|photography|music|creative|writing|manga|anime)\b/.test(
      lower,
    )
  )
    n.push('art');

  if (/\b(gaming|game|games|vtuber|stream|play)\b/.test(lower)) n.push('gaming');

  if (/\b(news|update|report|breaking)\b/.test(lower)) n.push('news');

  if (/\b(identity|ceramic|orbis)\b/.test(lower)) n.push('identity');

  if (/\b(writing|blog|publishing|writer|poetry|essay|journalism)\b/.test(lower)) n.push('writing');

  if (n.length === 0) n.push('social');
  return n;
}

// ─── RSS parsing ────────────────────────────────────────────────────────

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
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
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
