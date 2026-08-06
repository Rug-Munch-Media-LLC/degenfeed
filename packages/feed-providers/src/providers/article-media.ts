/**
 * Shared article image extraction for publishing providers
 * (Substack, Medium, Paragraph, Mirror).
 *
 * Every article provider must surface images in `post.media[]` / embeds so
 * the image-proxy route can serve them. This module centralizes the regex
 * work so all four providers behave identically:
 *
 *   - <img src="…">                  (inline HTML)
 *   - <enclosure url="…">            (RSS enclosures)
 *   - <media:content url="…">        (Media RSS)
 *   - <media:thumbnail url="…">      (Media RSS thumbnails)
 *   - <meta property="og:image">     (Open Graph)
 *   - <meta name="twitter:image">    (Twitter cards)
 *
 * All returned URLs are deduplicated and resolved to absolute URLs when a
 * base URL is provided.
 */

/** Strip HTML tags + common entities to plain text (article variant). */
export function stripArticleHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize an extracted URL: trim, strip tracking junk, absolute-ify. */
function normalizeImageUrl(raw: string, baseUrl?: string): string | null {
  const trimmed = raw.trim().replace(/["'<>]/g, '');
  if (!trimmed) return null;
  // Ignore obviously non-image data / relative placeholders
  if (trimmed.startsWith('data:')) return trimmed.split(',')[0]?.startsWith('data:image') ? trimmed : null;
  if (trimmed.startsWith('#') || trimmed.startsWith('mailto:')) return null;
  try {
    if (baseUrl) return new URL(trimmed, baseUrl).toString();
    const u = new URL(trimmed);
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Extract image URLs from an HTML string (article body / description).
 * Looks for <img src>, og:image / twitter:image meta tags, and enclosure /
 * media:content / media:thumbnail RSS elements.
 */
export function extractImagesFromHtml(html: string, baseUrl?: string): string[] {
  if (!html) return [];
  const found: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string | undefined): void => {
    if (!raw) return;
    const url = normalizeImageUrl(raw, baseUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    found.push(url);
  };

  // <img ... src="...">
  const imgRe = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((m = imgRe.exec(html)) !== null) push(m[1]);

  // <meta property="og:image" content="...">  /  name="twitter:image"
  const metaRe = /<meta[^>]+(?:property|name)\s*=\s*["'](?:og:image|twitter:image|twitter:image:src)["'][^>]*content\s*=\s*["']([^"']+)["']/gi;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((m = metaRe.exec(html)) !== null) push(m[1]);

  // <enclosure url="...">, <media:content url="...">, <media:thumbnail url="...">
  const rssUrlRe = /<(?:enclosure|media:content|media:thumbnail)[^>]+url\s*=\s*["']([^"']+)["']/gi;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((m = rssUrlRe.exec(html)) !== null) push(m[1]);

  return found;
}

/**
 * Extract image URLs from a raw RSS <item> block. `itemXml` is the inner
 * XML of one <item> element (which may itself contain <content:encoded>).
 */
export function extractImagesFromItemXml(itemXml: string, baseUrl?: string): string[] {
  if (!itemXml) return [];
  const found = extractImagesFromHtml(itemXml, baseUrl);
  // content:encoded may be CDATA-wrapped — unescape once and re-scan
  const unescaped = itemXml
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&');
  if (unescaped !== itemXml) {
    for (const url of extractImagesFromHtml(unescaped, baseUrl)) {
      if (!found.includes(url)) found.push(url);
    }
  }
  return found;
}

/** First usable image from a set of candidate fields/arrays (empty → undefined). */
export function firstImage(
  ...candidates: Array<string | string[] | undefined | null>
): string | undefined {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      if (candidate[0]) return candidate[0];
    } else if (candidate) {
      return candidate;
    }
  }
  return undefined;
}
