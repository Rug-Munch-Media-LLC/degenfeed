/**
 * Shared article image extraction for publishing providers
 * (Substack, Medium, Paragraph, Mirror) + protocol JSON payloads.
 *
 * Every provider must surface images in `post.media[]` / embeds so
 * the image-proxy route can serve them. This module centralizes the regex
 * and JSON-walking work so all providers behave identically:
 *
 * HTML / RSS / Open Graph:
 *   - <img src="…">                  (inline HTML)
 *   - <enclosure url="…">            (RSS enclosures)
 *   - <media:content url="…">        (Media RSS)
 *   - <media:thumbnail url="…">      (Media RSS thumbnails)
 *   - <media:group>…<media:thumbnail> (YouTube / media RSS groups)
 *   - <meta property="og:image">     (Open Graph)
 *   - <meta name="twitter:image">    (Twitter cards)
 *
 * Protocol JSON payloads (via extractImagesFromJson):
 *   - mastodon:   media_attachments[].url / preview_url / remote_url,
 *                 card.image
 *   - bluesky:    embed.images[].thumb / fullsize, embed.external.thumb
 *   - lens:       metadata.media[].original.url, metadata.image.original.url
 *   - nostr:      tags ["picture", url], tags ["imeta", "url …"]
 *   - farcaster:  embeds[].url (image URLs)
 *   - soundcloud: artwork_url (or -large → -t500x500 upgrade)
 *   - rss/json:   generic image-looking URL fields
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
export function normalizeImageUrl(raw: string, baseUrl?: string): string | null {
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
 * SoundCloud artwork helper.
 * SoundCloud returns `artwork_url` in API payloads (handled by
 * extractImagesFromJson), but feed HTML/RSS items often embed the 64×64
 * `-large` thumbnail directly. Upgrading to `-t500x500` yields a
 * much higher-resolution image from the same CDN.
 */
export function soundcloudArtworkUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const normalized = normalizeImageUrl(raw);
  if (!normalized) return undefined;
  if (!/\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(normalized)) return undefined;
  // SoundCloud pattern: .../artworks-<id>-large.jpg → -t500x500.jpg
  return normalized.replace(/-large\.(jpg|jpeg|png|webp)/i, '-t500x500.$1');
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
  // (also matches YouTube's <media:group><media:thumbnail url="..."> since the
  //  media:thumbnail tag itself carries the url attribute)
  const rssUrlRe = /<(?:enclosure|media:content|media:thumbnail)[^>]+url\s*=\s*["']([^"']+)["']/gi;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((m = rssUrlRe.exec(html)) !== null) push(m[1]);

  // <media:group>…<media:thumbnail url="...">…</media:group> (YouTube)
  // Handles the case where the thumbnail tag appears before any url attr,
  // or with attributes in nonstandard order (url after width/height).
  const mediaGroupRe = /<media:group[^>]*>([\s\S]*?)<\/media:group>/gi;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((m = mediaGroupRe.exec(html)) !== null) {
    const group = m[1] ?? '';
    const groupImg = group.match(/<media:thumbnail[^>]+url\s*=\s*["']([^"']+)["']/i);
    if (groupImg?.[1]) push(groupImg[1]);
  }

  // <a href="..."><img ...></a> wrappers already covered by the img regex.
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

/** Minimal JSON value walker — strings that look like image URLs. */
function walkJsonForImages(value: unknown, push: (url: string) => void, depth = 0): void {
  if (value == null || depth > 8) return;
  if (typeof value === 'string') {
    const url = normalizeImageUrl(value);
    if (url && looksLikeImageUrl(url)) push(url);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkJsonForImages(item, push, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      walkJsonForImages(v, push, depth + 1);
    }
  }
}

function looksLikeImageUrl(url: string): boolean {
  // Accept explicit image extensions, plus common protocol image CDNs that
  // serve extension-less URLs (bluesky /imgs/..., nostr.build, etc.)
  return (
    /\.(?:jpg|jpeg|png|gif|webp|avif|svg|bmp)(?:\?|$)/i.test(url) ||
    /cdn\.bsky\.app/i.test(url) ||
    /nostr\.build/i.test(url) ||
    /imagedelivery\.net/i.test(url) ||
    /\.cloudfront\.net/i.test(url) ||
    /cdn\.farcaster\.xyz/i.test(url)
  );
}

/**
 * Extract image URLs from a protocol JSON payload (parsed object).
 * Handles the shapes the social APIs return so providers can pass the raw
 * native object directly and get back a normalized image list.
 *
 *   - mastodon: media_attachments[].url / preview_url / remote_url, card.image
 *   - bluesky:  embed.images[].thumb / fullsize, embed.external.thumb
 *   - lens:      metadata.media[].original.url, metadata.image.original.url
 *   - nostr:     tags ["picture", url] / ["imeta", "url …"]
 *   - farcaster: embeds[].url (image-looking URLs)
 *   - soundcloud: artwork_url (upgraded to -t500x500)
 *   - default:   any string field that looks like an image URL
 */
export function extractImagesFromJson(
  payload: unknown,
  protocol?: string | null,
  baseUrl?: string,
): string[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const found: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | undefined | null): void => {
    if (!raw) return;
    const url = normalizeImageUrl(raw, baseUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    found.push(url);
  };
  const p = payload as Record<string, unknown>;

  // Mastodon: media_attachments[].url / preview_url / remote_url
  const attachments = p.media_attachments;
  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (typeof att !== 'object' || att === null) continue;
      const a = att as Record<string, unknown>;
      push(typeof a.url === 'string' ? a.url : undefined);
      push(typeof a.preview_url === 'string' ? a.preview_url : undefined);
      push(typeof a.remote_url === 'string' ? a.remote_url : undefined);
    }
  }
  // Mastodon card.image
  const card = p.card;
  if (typeof card === 'object' && card !== null) {
    const c = card as Record<string, unknown>;
    push(typeof c.image === 'string' ? c.image : undefined);
  }

  // Bluesky: embed.images[].thumb / fullsize, embed.external.thumb
  const embed = p.embed;
  if (typeof embed === 'object' && embed !== null) {
    const e = embed as Record<string, unknown>;
    const images = e.images;
    if (Array.isArray(images)) {
      for (const img of images) {
        if (typeof img !== 'object' || img === null) continue;
        const i = img as Record<string, unknown>;
        push(typeof i.thumb === 'string' ? i.thumb : undefined);
        push(typeof i.fullsize === 'string' ? i.fullsize : undefined);
      }
    }
    const external = e.external;
    if (typeof external === 'object' && external !== null) {
      const ex = external as Record<string, unknown>;
      push(typeof ex.thumb === 'string' ? ex.thumb : undefined);
    }
  }
  // Bluesky record.embed variant
  const record = p.record;
  if (typeof record === 'object' && record !== null) {
    const r = record as Record<string, unknown>;
    const recEmbed = r.embed;
    if (typeof recEmbed === 'object' && recEmbed !== null) {
      const re = recEmbed as Record<string, unknown>;
      const images = re.images;
      if (Array.isArray(images)) {
        for (const img of images) {
          if (typeof img !== 'object' || img === null) continue;
          const i = img as Record<string, unknown>;
          push(typeof i.thumb === 'string' ? i.thumb : undefined);
          push(typeof i.fullsize === 'string' ? i.fullsize : undefined);
        }
      }
      const external = re.external;
      if (typeof external === 'object' && external !== null) {
        const ex = external as Record<string, unknown>;
        push(typeof ex.thumb === 'string' ? ex.thumb : undefined);
      }
    }
  }

  // Lens: metadata.media[].original.url, metadata.image.original.url
  const metadata = p.metadata;
  if (typeof metadata === 'object' && metadata !== null) {
    const m = metadata as Record<string, unknown>;
    const media = m.media;
    if (Array.isArray(media)) {
      for (const item of media) {
        if (typeof item !== 'object' || item === null) continue;
        const original = (item as Record<string, unknown>).original;
        if (typeof original === 'object' && original !== null) {
          push(typeof (original as Record<string, unknown>).url === 'string'
            ? ((original as Record<string, unknown>).url as string)
            : undefined);
        }
      }
    }
    const image = m.image;
    if (typeof image === 'object' && image !== null) {
      const original = (image as Record<string, unknown>).original;
      if (typeof original === 'object' && original !== null) {
        push(typeof (original as Record<string, unknown>).url === 'string'
          ? ((original as Record<string, unknown>).url as string)
          : undefined);
      }
    }
  }

  // Nostr: tags ["picture", url] / ["imeta", "url …", "dim …", "blurhash …"]
  const tags = p.tags;
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (!Array.isArray(tag)) continue;
      if (tag[0] === 'picture' && typeof tag[1] === 'string') push(tag[1]);
      if (tag[0] === 'imeta') {
        for (const part of tag) {
          if (typeof part === 'string' && part.startsWith('url ')) {
            push(part.slice(4).trim());
          }
        }
      }
    }
  }

  // Farcaster: embeds[].url (image-looking URLs)
  const embeds = p.embeds ?? p.embedsDeprecated;
  if (Array.isArray(embeds)) {
    for (const e of embeds) {
      let url: string | undefined;
      if (typeof e === 'string') url = e;
      else if (typeof e === 'object' && e !== null) {
        url = typeof (e as Record<string, unknown>).url === 'string'
          ? ((e as Record<string, unknown>).url as string)
          : undefined;
      }
      if (url && looksLikeImageUrl(normalizeImageUrl(url) ?? '')) push(url);
    }
  }

  // SoundCloud: artwork_url (upgrade -large → -t500x500)
  const artwork = p.artwork_url;
  if (typeof artwork === 'string') {
    push(soundcloudArtworkUrl(artwork));
  }

  // Generic fallback: walk any image-looking string fields (nested).
  // Only for unknown protocols — known protocols have explicit handlers
  // above that prevent the generic walk from pulling in unrelated string
  // fields (avatar URLs, permalinks, etc.).
  const knownProtocols = new Set(['mastodon', 'bluesky', 'lens', 'nostr', 'farcaster', 'soundcloud', 'rss']);
  if (found.length === 0 || !protocol || !knownProtocols.has(protocol)) {
    walkJsonForImages(payload, (url) => {
      const normalized = normalizeImageUrl(url, baseUrl);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        found.push(normalized);
      }
    });
  }

  return found;
}
