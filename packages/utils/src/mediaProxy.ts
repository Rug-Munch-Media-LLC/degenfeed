/**
 * @degenfeed/utils — mediaProxy
 *
 * Shared helper for routing external media URLs through the DegenFeed image
 * proxy (`/api/image-proxy`). The proxy adds CORS headers, 1h edge caching,
 * protocol-aware transformations, and hotlink-bypass, so <img>/<Image> tags
 * pointing at fediverse/media CDNs render reliably.
 *
 * Used by @degenfeed/ui (PostCardMedia, VideoPlayer posters) and
 * @degenfeed/web (visual feed cards, lightbox).
 */

/**
 * Wrap an external http(s) media URL with the image proxy. Local paths,
 * data:/blob: URIs, and already-proxied URLs are passed through unchanged.
 *
 * @example
 *   proxyMediaUrl('https://nostr.build/i/abc.png')
 *   // => '/api/image-proxy?url=https%3A%2F%2Fnostr.build%2Fi%2Fabc.png'
 */
export function proxyMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('/')) return url; // already local / proxied
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.includes('/api/image-proxy')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return url;
  } catch {
    return url;
  }
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Convenience alias matching the task template: `proxyUrl(url)`.
 */
export const proxyUrl = proxyMediaUrl;
