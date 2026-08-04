export function stripHtml(html: string): string {
  return (
    html
      // Unwrap CDATA sections FIRST — otherwise <![CDATA[...]]> is matched as an
      // HTML tag below and the content is destroyed (feeds with CDATA titles —
      // CoinDesk, The Verge, OpenAI, Blockworks, etc. — returned 0 items).
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      // Replace non-break tags with spaces first
      .replace(/<(?!br\s*\/?)[^>]+>/gi, ' ')
      // Then handle <br> as newlines
      .replace(/<br\s*\/?>/gi, '\n')
      // Decode entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&#x60;/g, '`')
      .replace(/&#x3D;/g, '=')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#\d+;/g, (_match, num) => String.fromCharCode(num))
      // Collapse horizontal whitespace but keep newlines
      .replace(/[ \t]+/g, ' ')
      .replace(/\n */g, '\n')
      .trim()
  );
}

/**
 * Extract the first usable image URL from HTML content.
 * Skips data URIs, icons, badges, and favicons.
 */
export function extractFeaturedImage(html: string): string | undefined {
  if (!html) return undefined;
  // Prefer the largest candidate from a srcset when present, else the src.
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    const srcset = tag.match(/\bsrcset=["']([^"']+)["']/i)?.[1];
    const candidate = srcsetLargest(srcset) || src;
    if (candidate && isLikelyHeroImage(candidate)) return candidate;
  }
  // Try <figure> with <img> inside
  const figureMatch = html.match(/<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
  if (figureMatch?.[1] && isLikelyHeroImage(figureMatch[1])) return figureMatch[1];

  return undefined;
}

/**
 * Extract metadata from HTML content - description, keywords, author
 */
export function extractMetadata(html: string): {
  description?: string;
  authorName?: string;
  keywords?: string[];
} {
  const meta: { description?: string; authorName?: string; keywords?: string[] } = {};

  if (!html) return meta;

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (descMatch) meta.description = stripHtml(descMatch[1]).slice(0, 500);

  const authorMatch = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i);
  if (authorMatch) meta.authorName = stripHtml(authorMatch[1]);

  const keywordsMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);
  if (keywordsMatch) {
    meta.keywords = keywordsMatch[1].split(',').map((k) => k.trim().toLowerCase());
  }

  return meta;
}

/**
 * Extract enclosures (featured media) from feed item
 */
export function extractEnclosures(e: string): { url?: string; type?: string }[] {
  const enclosures: { url?: string; type?: string }[] = [];
  const enclosureRe = /<enclosure[^>]*>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex loop
  while ((m = enclosureRe.exec(e)) !== null) {
    const urlMatch = m[0].match(/url=["']([^"']+)["']/i);
    const typeMatch = m[0].match(/type=["']([^"']+)["']/i);
    if (urlMatch) {
      enclosures.push({ url: urlMatch[1], type: typeMatch?.[1] });
    }
  }
  return enclosures;
}

/**
 * Parse a podcast episode duration from an RSS item.
 * Handles iTunes-style "HH:MM:SS", "MM:SS", or plain seconds.
 */
export function parsePodcastDuration(e: string): number | undefined {
  const match = e.match(/<itunes:duration[^>]*>([^<]+)<\/itunes:duration>/i);
  if (!match || !match[1]) return undefined;
  const raw = match[1].trim();
  const parts = raw.split(':').map((p) => Number.parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return undefined;
  if (parts.length === 3) {
    const [h = 0, m = 0, s = 0] = parts;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m = 0, s = 0] = parts;
    return m * 60 + s;
  }
  return parts[0] ?? 0;
}

/**
 * Minimum acceptable article hero image dimensions (CSS pixels).
 * Smaller images are icons/badges/trackers and are skipped so cards
 * never render a 1×1 pixel or a 16×16 favicon as a hero.
 */
export const MIN_IMAGE_WIDTH = 200;
export const MIN_IMAGE_HEIGHT = 150;

/**
 * URL patterns that identify icons, badges, avatars, sprites and other
 * non-hero images. Used to filter candidates before dimension checks.
 */
const IMAGE_JUNK_PATTERNS = [
  'favicon',
  'icon',
  'badge',
  'avatar',
  'button',
  'sprite',
  'logo',
  'tracking',
  'pixel',
  '1x1',
  'spacer',
  'blank.gif',
  'transparent',
];

/** True when a URL is a plausible hero image (not an obvious icon/badge). */
export function isLikelyHeroImage(url: string): boolean {
  if (!url?.startsWith('http')) return false;
  const lower = url.toLowerCase();
  return !IMAGE_JUNK_PATTERNS.some((p) => lower.includes(p));
}

/** Parse an <img> tag's declared width/height attributes (if present). */
function imgTagSize(tag: string): { width?: number; height?: number } {
  const w = tag.match(/\bwidth=["']?(\d+)/i)?.[1];
  const h = tag.match(/\bheight=["']?(\d+)/i)?.[1];
  return {
    width: w ? Number.parseInt(w, 10) : undefined,
    height: h ? Number.parseInt(h, 10) : undefined,
  };
}

/** Pick the largest candidate URL from a srcset attribute (descriptor `w` wins). */
function srcsetLargest(srcset: string | undefined): string | undefined {
  if (!srcset) return undefined;
  let best: { url: string; weight: number } | undefined;
  for (const part of srcset.split(',')) {
    const [rawUrl, descriptor] = part.trim().split(/\s+/);
    if (!rawUrl?.startsWith('http')) continue;
    const weight = descriptor?.endsWith('w')
      ? Number.parseInt(descriptor, 10) || 0
      : descriptor?.endsWith('x')
        ? Number.parseFloat(descriptor) || 0
        : 0;
    if (!best || weight > best.weight) best = { url: rawUrl, weight };
  }
  return best?.url;
}

/**
 * Readability-style largest-image extraction. Scores every <img> in the
 * article HTML by declared width×height (falling back to srcset weight)
 * and returns the largest candidate that plausibly is a hero image
 * (≥ MIN_IMAGE_WIDTH×MIN_IMAGE_HEIGHT when dimensions are declared,
 * and not an icon/badge/spacer by URL pattern).
 *
 * Returns undefined when no usable candidate exists.
 */
export function extractLargestImage(html: string): string | undefined {
  if (!html) return undefined;
  const imgRe = /<img\b[^>]*>/gi;
  let best: { url: string; area: number; weight: number } | undefined;

  for (const tag of html.match(imgRe) ?? []) {
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    const srcset = tag.match(/\bsrcset=["']([^"']+)["']/i)?.[1];
    const candidate = srcsetLargest(srcset) || src;
    if (!candidate || !isLikelyHeroImage(candidate)) continue;

    const { width, height } = imgTagSize(tag);
    // Declared dimensions below the hero threshold → skip outright
    if (width !== undefined && height !== undefined) {
      if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) continue;
      const area = width * height;
      if (!best || area > best.area) best = { url: candidate, area, weight: 0 };
      continue;
    }
    // No dimensions — score by srcset weight (falls back to area 0)
    const parsed = srcsetLargest(srcset);
    const weight = parsed ? Number.parseInt(parsed.split(/\s+/)[1] ?? '0', 10) : 0;
    if (!best || weight > best.weight) best = { url: candidate, area: 0, weight };
  }
  return best?.url;
}

/**
 * Extract OpenGraph / Twitter Card image from article HTML:
 *   <meta property="og:image" content="...">
 *   <meta name="twitter:image" content="...">
 *   <meta property="og:image:url" content="...">
 *   <meta property="og:image:secure_url" content="...">
 * Handles attribute order variants and skips favicons/icons/badges.
 * Prefers plain og:image over og:image:url/secure_url variants.
 */
export function extractOpenGraphImage(html: string): string | undefined {
  if (!html) return undefined;
  const metaRe =
    /<meta[^>]+(?:property|name)=["'](?:og:image(?::url|:secure_url)?|twitter:image(?::src)?)["'][^>]*>/gi;
  const candidates: { url: string; priority: number }[] = [];
  for (const tag of html.match(metaRe) ?? []) {
    const content = tag.match(/(?:content|value)=["']([^"']+)["']/i);
    const url = content?.[1];
    if (!url || !isLikelyHeroImage(url)) continue;
    const property = tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1] || '';
    // Plain og:image and twitter:image are preferred over the :url/:secure_url variants
    const priority = property === 'og:image' || property === 'twitter:image' ? 2 : 1;
    candidates.push({ url, priority });
  }
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0]?.url;
}

/**
 * Extract the first media:thumbnail / media:content image from a raw feed
 * item (RSS Media RSS namespace). Returns undefined when absent.
 */
export function extractMediaImage(itemXml: string): string | undefined {
  if (!itemXml) return undefined;
  const mediaRe = /<media:(?:content|thumbnail)[^>]*url=["']([^"']+)["']/gi;
  const matches = [...itemXml.matchAll(mediaRe)];
  for (const m of matches) {
    const url = m[1];
    if (url && isLikelyHeroImage(url)) return url;
  }
  return undefined;
}

export interface ParsedFeedItem {
  title: string;
  link: string;
  contentHtml: string;
  contentText: string;
  description: string;
  publishedAt: number;
  updatedAt: number;
  authorName?: string;
  authorLink?: string;
  featuredImage?: string;
  categories: string[];
  enclosures: { url?: string; type?: string }[];
  /** Podcast episode duration in seconds (parsed from itunes:duration) */
  duration?: number;
  id: string;
}

/**
 * Parse RSS 2.0 or Atom XML into structured items
 */
export function parseFeedXml(xml: string): {
  title?: string;
  description?: string;
  link?: string;
  image?: string;
  items: ParsedFeedItem[];
} {
  const result: ParsedFeedItem[] = [];

  const feedTitleMatch = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const feedDescMatch =
    xml.match(/<subtitle[^>]*>([\s\S]*?)<\/subtitle>/i) ||
    xml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
  const feedLinkMatch = xml.match(/<link[^>]*href=["']([^"']+)["']/i);

  // Feed-level image: RSS <image><url> or Atom <logo>
  const feedImageMatch =
    xml.match(/<image>[\s\S]*?<url[^>]*>([\s\S]*?)<\/url>[\s\S]*?<\/image>/i) ||
    xml.match(/<logo[^>]*>([\s\S]*?)<\/logo>/i);

  // Try Atom entries first
  const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
  while ((m = entryRe.exec(xml)) !== null) {
    const e = m[1];
    const item = parseAtomEntry(e);
    if (item) result.push(item);
  }

  // Fallback to RSS 2.0 items if no Atom entries found
  if (result.length === 0) {
    const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
    // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
    while ((m = itemRe.exec(xml)) !== null) {
      const e = m[1];
      const item = parseRssItem(e);
      if (item) result.push(item);
    }
  }

  return {
    title: feedTitleMatch ? stripHtml(feedTitleMatch[1]).trim() : undefined,
    description: feedDescMatch ? stripHtml(feedDescMatch[1]).trim().slice(0, 500) : undefined,
    link: feedLinkMatch?.[1],
    image: feedImageMatch?.[1] ? stripHtml(feedImageMatch[1]).trim() : undefined,
    items: result,
  };
}

function parseAtomEntry(e: string): ParsedFeedItem | null {
  const titleMatch = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';
  if (!title) return null;

  // Link - try href attribute first, then content
  const linkMatch = e.match(/<link[^>]+href=["']([^"']+)["']/i);
  const linkAltMatch = e.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  const link = linkMatch?.[1] || (linkAltMatch ? stripHtml(linkAltMatch[1]) : '');

  const updatedMatch = e.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
  const publishedMatch = e.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
  const publishedAt = publishedMatch ? new Date(publishedMatch[1]).getTime() : Date.now();
  const updatedAt = updatedMatch ? new Date(updatedMatch[1]).getTime() : publishedAt;

  const contentMatch = e.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
  const summaryMatch = e.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
  const contentHtml = contentMatch?.[1] || summaryMatch?.[1] || '';
  const contentText = stripHtml(contentHtml);

  const descriptionMatch = e.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
  const description = descriptionMatch
    ? stripHtml(descriptionMatch[1]).slice(0, 500)
    : contentText.slice(0, 500);

  const authorNameMatch = e.match(
    /<author>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i,
  );
  const authorUriMatch = e.match(/<author>[\s\S]*?<uri[^>]*>([\s\S]*?)<\/uri>[\s\S]*?<\/author>/i);

  const categoryMatches = [...e.matchAll(/<category[^>]+term=["']([^"']+)["']/gi)];
  const categories = categoryMatches.map((cm) => cm[1].toLowerCase());

  const enclosures = extractEnclosures(e);
  const featuredImage =
    extractFeaturedImage(contentHtml) || extractMediaImage(e) || enclosures[0]?.url;

  const idMatch = e.match(/<id[^>]*>([\s\S]*?)<\/id>/i);
  const id = idMatch ? stripHtml(idMatch[1]) : `entry:${title}:${publishedAt}`;

  return {
    title,
    link,
    contentHtml,
    contentText,
    description,
    publishedAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
    updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt,
    authorName: authorNameMatch ? stripHtml(authorNameMatch[1]) : undefined,
    authorLink: authorUriMatch ? stripHtml(authorUriMatch[1]) : undefined,
    featuredImage,
    categories,
    enclosures,
    duration: parsePodcastDuration(e),
    id,
  };
}

function parseRssItem(e: string): ParsedFeedItem | null {
  const titleMatch = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';
  if (!title) return null;

  const linkMatch = e.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  const link = linkMatch ? stripHtml(linkMatch[1]).trim() : '';

  const descMatch = e.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
  // Description in RSS may be CDATA-wrapped with HTML
  const contentHtml = descMatch?.[1] || '';
  const contentText = stripHtml(contentHtml);

  const pubDateMatch = e.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
  const dcDateMatch = e.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);
  const dateStr = pubDateMatch?.[1] || dcDateMatch?.[1] || '';
  const publishedAt = dateStr ? new Date(dateStr).getTime() : Date.now();

  const authorMatch = e.match(/<author[^>]*>([\s\S]*?)<\/author>/i);
  const dcCreatorMatch = e.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);

  const categoryMatches = [...e.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)];
  const categories = categoryMatches.map((cm) => stripHtml(cm[1]).toLowerCase()).filter(Boolean);

  const enclosures = extractEnclosures(e);
  const featuredImage =
    extractFeaturedImage(contentHtml) || extractMediaImage(e) || enclosures[0]?.url;

  const guidMatch = e.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
  const id = guidMatch ? stripHtml(guidMatch[1]) : `rss:${title}:${publishedAt}`;

  return {
    title,
    link,
    contentHtml,
    contentText,
    description: contentText.slice(0, 500),
    publishedAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
    updatedAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
    authorName: authorMatch
      ? stripHtml(authorMatch[1])
      : dcCreatorMatch
        ? stripHtml(dcCreatorMatch[1])
        : undefined,
    featuredImage,
    categories,
    enclosures,
    duration: parsePodcastDuration(e),
    id,
  };
}
