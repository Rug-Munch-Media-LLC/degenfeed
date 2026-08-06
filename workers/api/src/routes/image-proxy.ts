/**
 * @degenfeed/api-worker — Cross-Protocol Image Proxy
 *
 * GET /api/image-proxy?url=<encoded_url>&protocol=<protocol>
 *
 * Fetches an image from ANY protocol's remote URL and serves it with:
 *   - Proper CORS headers (Access-Control-Allow-Origin: *) so canvas reads
 *     and cross-origin embedding work from any origin
 *   - Protocol-aware image extraction (nostr markdown vs mastodon HTML vs
 *     bluesky CDN vs RSS enclosures)
 *   - 1-hour edge caching via the Cache API
 *   - SSRF guard (https-only, no private/link-local targets)
 *   - Size cap (20MB) so the worker never buffers a huge binary
 *
 * Why a proxy at all? Fediverse image hosts frequently:
 *   1. Refuse hotlinking with a strict Referer policy (403 without a browser
 *      Referer — `<img>` tags send none).
 *   2. Send no CORS headers, breaking canvas-based features.
 *   3. Are slow — the edge cache turns repeated loads into cache hits.
 *
 * Security: the `url` param is validated (scheme, host, credentials) and the
 * upstream response is verified to be an image before being streamed back.
 */

import { Hono } from 'hono';
import type { Env } from '../types';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB
const CACHE_TTL_SECONDS = 3600; // 1 hour (task spec)
const USER_AGENT = 'degenfeed-image-proxy/1.0';

const IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
];

/** Host suffixes that are commonly used for image hosting per protocol. */
const IMAGE_HOST_PATTERNS = [
  /\.(?:jpg|jpeg|png|gif|webp|avif|svg|bmp|ico)(?:$|\?)/i,
  /nostr\.build/i,
  /m\.primal\.net/i,
  /void\.cat/i,
  /imagedelivery\.net/i,
  /cdn\.bsky\.app/i,
  /cdn\.farcaster\.xyz/i,
  /(?:cdn|media|files|static)\..*\.(?:social|xyz|io|net|org|com)/i,
];

// ─── SSRF guard ──────────────────────────────────────────────────────────

const PRIVATE_HOST_RE =
  /^(localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|\[::1\]|\[::\]|\[fc|\[fd)/i;

/**
 * Validate the target URL. Returns a normalized https URL or null.
 * Guards against SSRF: https-only, no credentials, no private/link-local
 * targets, no ports other than the defaults (proxies/tunnels often hide on
 * odd ports).
 */
export function validateProxyUrl(raw: string | null): URL | null {
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  const host = parsed.hostname.toLowerCase();
  if (PRIVATE_HOST_RE.test(host)) return null;
  // Numeric IPv4 private ranges (parse if the host is an IP)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const octets = host.split('.').map(Number);
    if (octets.length === 4 && octets.every((o) => o >= 0 && o <= 255)) {
      const first = octets[0] ?? -1;
      const second = octets[1] ?? -1;
      if (first === 127 || first === 0 || first === 10 || (first === 192 && second === 168) || (first === 172 && second >= 16 && second <= 31)) {
        return null;
      }
    }
  }
  if (parsed.port && parsed.port !== '443') return null;
  return parsed;
}

// ─── Protocol-aware image extraction ─────────────────────────────────────

function looksLikeImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return IMAGE_HOST_PATTERNS.some((re) => re.test(url.pathname) || re.test(url.hostname));
  } catch {
    return /^data:image\/(?:png|jpeg|gif|webp);/i.test(raw);
  }
}

/**
 * Extract an image URL from a status/post payload. `raw` may already be a
 * direct image URL (pass-through) or post text/HTML that embeds images in a
 * protocol-specific format.
 *
 * Protocol formats:
 *   - nostr:      Markdown `![alt](https://...)`, bare `https://...` links,
 *                 nostr.build / m.primal.net / void.cat media
 *   - mastodon:   HTML `<img src="...">`, media_attachments remote URLs
 *   - bluesky:    `https://cdn.bsky.app/img/...` (already an image URL)
 *   - rss:        `<img src="...">`, `<enclosure url="...">`
 *   - peertube:   `/static/thumbnails/...` URLs (image URL pass-through)
 *   - pixelfed:   `/storage/...` URLs (image URL pass-through)
 *   - default:    generic Markdown + HTML + extension scan
 */
export function extractImageUrl(raw: string | null, protocol: string | null): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  // 1. Already an image URL → pass through.
  if (looksLikeImageUrl(text)) return text;

  // 2. Markdown image: ![alt](url)
  const markdown = text.match(/!\[[^\]]*\]\(([^)\s]+)\)/);
  if (markdown?.[1]) return markdown[1];

  // 3. HTML <img src> (mastodon content HTML, RSS description, etc.)
  const htmlImg = text.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (htmlImg?.[1]) return htmlImg[1];

  // 4. RSS enclosure
  const enclosure = text.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (enclosure?.[1]) return enclosure[1];

  // 5. Nostr: any image-host URL embedded in a bare string (e.g. kind-1
  //    content with a single media URL, or nostr.build links).
  if (protocol === 'nostr') {
    const nostrImg = text.match(/https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp|avif)(?:\?[^\s<>"']*)?/i);
    if (nostrImg?.[0]) return nostrImg[0];
  }

  // 6. Generic: first https URL ending in an image extension anywhere in text.
  const generic = text.match(/https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp|avif|svg|bmp)(?:\?[^\s<>"']*)?/i);
  if (generic?.[0]) return generic[0];

  return null;
}

// ─── Handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/image-proxy?url=<encoded>&protocol=<protocol>
 *
 * Query params:
 *   url       — the remote image URL (or post text containing one) [required]
 *   protocol  — protocol hint for extraction + UA selection (nostr, mastodon,
 *               bluesky, lemmy, peertube, pixelfed, rss, …) [optional]
 *   w         — optional width hint (passed through to the upstream as-is;
 *               future: resize via Cloudflare Image Resizing)
 */
export async function handleImageProxy(request: Request, _env: Env): Promise<Response> {
  const urlObj = new URL(request.url);
  const params = urlObj.searchParams;
  const rawUrl = params.get('url');
  const protocol = params.get('protocol')?.toLowerCase() ?? null;

  if (!rawUrl) {
    return new Response('Missing url', { status: 400 });
  }

  const target = validateProxyUrl(extractImageUrl(rawUrl, protocol) ?? rawUrl);
  if (!target) {
    return new Response('Invalid or blocked url', { status: 400 });
  }

  const cacheKey = `${protocol ?? 'generic'}:${target.toString()}`;
  const cache = caches as unknown as { default: Cache };
  let cached: Response | undefined;
  try {
    cached = await cache.default.match(cacheKey);
  } catch {
    // Cache API unavailable — proceed to fetch.
  }
  if (cached) {
    return new Response(cached.body, {
      status: 200,
      headers: {
        'Content-Type': cached.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
        'Access-Control-Allow-Origin': '*',
        'X-Image-Proxy': 'hit',
      },
    });
  }

  // Fetch the upstream image. Per-protocol UA keeps hosts that block generic
  // bots happy (many image CDNs serve 403 to unknown agents).
  const ua =
    protocol === 'mastodon' || protocol === 'gotosocial'
      ? 'Mozilla/5.0 (compatible; degenfeed-image-proxy/1.0; +https://degenfeed.xyz)'
      : protocol === 'bluesky'
        ? 'Mozilla/5.0 (compatible; degenfeed-image-proxy/1.0; +https://degenfeed.xyz)'
        : USER_AGENT;

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': ua, Accept: 'image/*,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return new Response('Upstream fetch failed', { status: 502 });
  }
  if (!upstream.ok) {
    return new Response('Image not found', { status: 404 });
  }

  const contentType = upstream.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  const contentLength = Number(upstream.headers.get('Content-Length') ?? 0);
  if (!IMAGE_CONTENT_TYPES.includes(contentType)) {
    return new Response('Not an image', { status: 415 });
  }
  if (contentLength > MAX_IMAGE_BYTES) {
    return new Response('Image too large', { status: 413 });
  }

  const headers = {
    'Content-Type': contentType || 'image/jpeg',
    'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'X-Image-Proxy': 'miss',
  };

  // Cache for 1 hour (best-effort; the Cache API may be unavailable locally).
  const response = new Response(upstream.body, { status: 200, headers });
  try {
    const cacheResponse = response.clone();
    // Cache-Control on the stored entry governs the Cache API TTL.
    cache.default
      .put(cacheKey, new Response(cacheResponse.body, { headers: cacheResponse.headers }))
      .catch(() => {});
  } catch {
    // Non-critical.
  }

  return response;
}

/**
 * Hono sub-router (task template). Mounted at '/' in app.ts so the final
 * path is /api/image-proxy. `handleImageProxy` is also exported for direct
 * registration alongside the other handler-style routes.
 */
const router = new Hono<{ Bindings: Env }>();

router.get('/api/image-proxy', async (c) => handleImageProxy(c.req.raw, c.env));
router.options('/api/image-proxy', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
});

export default router;
