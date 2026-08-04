/**
 * @degenfeed/api-worker — Unified Video Embed (oEmbed wrapper)
 *
 * Discovery layer for the Video Wrapper system. Takes ANY video URL
 * (PeerTube watch/embed, Blossom blob, IPFS gateway, YouTube, Vimeo, or a
 * direct mp4/webm file) and returns:
 *
 *   1. Standard oEmbed JSON (type: video) — title, thumbnail, embed HTML
 *   2. A `protocols` map with native representations for every supported
 *      protocol (ActivityPub, Nostr NIP-71, Bluesky AT embed, Lens, Farcaster,
 *      RSS Media enclosure) — the "one canonical URL → every protocol" wrapper.
 *
 * Routes:
 *   GET /api/video/embed?url=<video-url>   — oEmbed JSON
 *   GET /api/video/rss.xml                 — Media RSS of announced videos
 *
 * Fail-open: all metadata enrichment is best-effort with short timeouts.
 * Never blocks on upstream providers.
 */

import { serializeVideoEvent } from '@degenfeed/nostr-sdk';
import { Hono } from 'hono';
import { log } from '../../logger';
import { jsonResponse } from '../../response-helpers';
import { safeFetch } from '../../sanitize';
import type { Env } from '../../types';

// ─── Types ──────────────────────────────────────────────────────────────

export interface VideoProtocolSurfaces {
  activitypub?: {
    type: 'Video';
    url: string;
    name?: string;
    summary?: string;
    icon?: string;
    duration?: number;
  };
  nostr?: {
    kind: number;
    tags: string[][];
    content: string;
  };
  bluesky?: {
    $type: 'app.bsky.embed.external';
    external: {
      uri: string;
      title: string;
      description: string;
      thumb?: string;
    };
  };
  lens?: {
    type: 'video';
    url: string;
    title: string;
    duration?: number;
    thumbnail?: string;
  };
  farcaster?: {
    embeds: Array<{ url: string }>;
  };
  rss?: {
    enclosure: {
      url: string;
      type: string;
      length?: number;
    };
    mediaThumbnail?: string;
  };
}

export interface VideoEmbedResponse {
  type: 'video';
  version: '1.0';
  title?: string;
  author_name?: string;
  author_url?: string;
  provider_name: string;
  provider_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  duration?: number;
  html: string;
  /** Which wrapper backend produced this embed */
  source: VideoSourceId;
  /** Canonical URL for the video (wrapper target) */
  canonical_url: string;
  /** Native protocol representations of the canonical URL */
  protocols: VideoProtocolSurfaces;
}

export type VideoSourceId =
  | 'peertube'
  | 'blossom'
  | 'ipfs'
  | 'youtube'
  | 'vimeo'
  | 'direct'
  | 'unknown';

// ─── URL detection ──────────────────────────────────────────────────────

const PRIVATE_IPV4_RE = /^(10\.|127\.|0\.0\.0\.0|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;
const PRIVATE_IPV6_PREFIXES = ['::1', 'fc00:', 'fd00:', 'fe80:'];
const VIDEO_DENIED_PATH_PATTERNS = [
  /\/\.\./,
  /\/proc\//,
  /\/sys\//,
  /\/etc\//,
  /\/\.env/,
  /\/\.git\//,
];

/**
 * Permissive video-URL validation for the wrapper.
 *
 * Unlike `isValidFetchUrl` (which enforces an SSRF allowlist), the wrapper
 * accepts ANY public http(s) video URL — PeerTube, Blossom, IPFS gateways,
 * YouTube, Vimeo, direct mp4 — because the URL is only embedded client-side
 * and never fetched server-side (enrichment calls use `safeFetch`, which
 * still applies the strict allowlist + redirect validation).
 *
 * Security guards retained: protocol whitelist, private-IP block (SSRF via
 * link preview clients), path-traversal block.
 */
export function isValidVideoUrl(rawUrl: string): boolean {
  if (rawUrl.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (!url.hostname) return false;
  if (PRIVATE_IPV4_RE.test(url.hostname)) return false;
  const lower = url.hostname.toLowerCase();
  for (const prefix of PRIVATE_IPV6_PREFIXES) {
    if (lower === prefix || lower.startsWith(prefix)) return false;
  }
  for (const pattern of VIDEO_DENIED_PATH_PATTERNS) {
    if (pattern.test(url.pathname)) return false;
  }
  return true;
}

const PEERTUBE_HOSTS = [
  'video.degenfeed.xyz',
  'peertube.tv',
  'framatube.org',
  'makertube.net',
  'diode.zone',
  'spectra.video',
];

function isPeerTubeUrl(u: URL): boolean {
  if (PEERTUBE_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) return true;
  return (
    /\/videos\/(watch|embed)\//.test(u.pathname) ||
    /\/w\/|\/v\//.test(u.pathname) ||
    /[?&]v=[a-zA-Z0-9-]+/.test(u.search)
  );
}

function isBlossomUrl(u: URL): boolean {
  return (
    u.hostname.includes('nostr.build') ||
    u.hostname.includes('blossom') ||
    /\/media\/[0-9a-f]{64}/.test(u.pathname) ||
    /\/[0-9a-f]{64}\.(mp4|webm|mov)$/.test(u.pathname)
  );
}

function isIpfsUrl(u: URL): boolean {
  return u.protocol === 'ipfs:' || /\/ipfs\/[a-zA-Z0-9]{20,}/.test(u.pathname);
}

function isYouTubeUrl(u: URL): boolean {
  return (
    u.hostname === 'youtube.com' ||
    u.hostname.endsWith('.youtube.com') ||
    u.hostname === 'youtu.be' ||
    u.hostname === 'www.youtube-nocookie.com'
  );
}

function isVimeoUrl(u: URL): boolean {
  return u.hostname === 'vimeo.com' || u.hostname.endsWith('.vimeo.com');
}

/** Extract a PeerTube video UUID from a watch/embed URL. */
function extractPeerTubeUuid(u: URL): string | null {
  const m = u.pathname.match(/\/(?:videos\/(?:watch|embed)\/|w\/|v\/)([a-zA-Z0-9-]+)/);
  if (m?.[1]) return m[1];
  const q = u.searchParams.get('v');
  if (q) return q;
  return null;
}

/** Extract an IPFS CID from a URL. */
function extractIpfsCid(u: URL): string | null {
  const m = u.pathname.match(/\/ipfs\/([a-zA-Z0-9]{20,})/);
  return m?.[1] ?? null;
}

/** Resolve the source id + canonical URL for a given video URL. */
function detectSource(rawUrl: string): {
  source: VideoSourceId;
  canonical: string;
  detail?: Record<string, string>;
} {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { source: 'unknown', canonical: rawUrl };
  }

  if (isYouTubeUrl(u)) return { source: 'youtube', canonical: rawUrl };
  if (isVimeoUrl(u)) return { source: 'vimeo', canonical: rawUrl };
  if (isPeerTubeUrl(u)) {
    const uuid = extractPeerTubeUuid(u);
    const host = u.hostname;
    return {
      source: 'peertube',
      canonical: uuid ? `https://${host}/videos/watch/${uuid}` : rawUrl,
      detail: uuid ? { uuid, host } : undefined,
    };
  }
  if (isBlossomUrl(u)) return { source: 'blossom', canonical: rawUrl };
  if (isIpfsUrl(u)) {
    const cid = extractIpfsCid(u);
    return {
      source: 'ipfs',
      canonical: cid ? `https://ipfs.degenfeed.xyz/ipfs/${cid}` : rawUrl,
      detail: cid ? { cid } : undefined,
    };
  }
  if (isYouTubeUrl(u)) return { source: 'youtube', canonical: rawUrl };
  if (isVimeoUrl(u)) return { source: 'vimeo', canonical: rawUrl };

  // Direct video file (mp4/webm/mov/m3u8) → wrapper "direct" source
  if (/\.(mp4|webm|mov|m4v|m3u8)(\?.*)?$/i.test(u.pathname)) {
    return { source: 'direct', canonical: rawUrl };
  }

  return { source: 'unknown', canonical: rawUrl };
}

// ─── Embed HTML builders ────────────────────────────────────────────────

/**
 * Deterministic short hash for event IDs (Workers-safe — no Node Buffer).
 */
function simpleHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function peerTubeIframe(url: string): string {
  // Convert a watch URL to an embed URL if needed.
  const embedUrl = url.replace(/\/videos\/watch\//, '/videos/embed/').replace(/\/w\//, '/v/');
  return `<iframe width="560" height="315" src="${escapeHtml(embedUrl)}" title="PeerTube video player" frameborder="0" allowfullscreen sandbox="allow-same-origin allow-scripts allow-popups" referrerpolicy="no-referrer"></iframe>`;
}

function youtubeIframe(url: string): string {
  let videoId = '';
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') videoId = u.pathname.slice(1) || '';
    else videoId = u.searchParams.get('v') ?? '';
  } catch {
    /* invalid */
  }
  if (!videoId) return `<a href="${escapeHtml(url)}">Watch on YouTube</a>`;
  return `<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/${escapeHtml(videoId)}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
}

function vimeoIframe(url: string): string {
  return `<iframe src="https://player.vimeo.com/video/${escapeHtml(url.split('/').pop() ?? '')}" width="560" height="315" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
}

function directVideoTag(url: string, mimeType?: string): string {
  const type = mimeType ? ` type="${escapeHtml(mimeType)}"` : '';
  return `<video controls preload="metadata" width="560" height="315" src="${escapeHtml(url)}"${type}></video>`;
}

// ─── Protocol surfaces ──────────────────────────────────────────────────

/**
 * Build the per-protocol native representations of a canonical video URL.
 * This is the heart of the wrapper — one URL, many protocols.
 */
function buildProtocolSurfaces(params: {
  canonicalUrl: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  duration?: number;
  isShort?: boolean;
  tags?: string[];
  pubkey?: string;
}): VideoProtocolSurfaces {
  const {
    canonicalUrl,
    title,
    description = '',
    thumbnailUrl,
    mimeType = 'video/mp4',
    sizeBytes,
    duration,
    isShort = false,
    tags = [],
  } = params;

  const surfaces: VideoProtocolSurfaces = {
    activitypub: {
      type: 'Video',
      url: canonicalUrl,
      name: title,
      summary: description || undefined,
      icon: thumbnailUrl,
      duration,
    },
    bluesky: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: canonicalUrl,
        title: title.slice(0, 300),
        description: description.slice(0, 300),
        thumb: thumbnailUrl,
      },
    },
    lens: {
      type: 'video',
      url: canonicalUrl,
      title,
      duration,
      thumbnail: thumbnailUrl,
    },
    farcaster: {
      embeds: [{ url: canonicalUrl }],
    },
    rss: {
      enclosure: {
        url: canonicalUrl,
        type: mimeType,
        length: sizeBytes,
      },
      mediaThumbnail: thumbnailUrl,
    },
  };

  // Nostr NIP-71 (kind 34235 video / 34236 short) — native video event.
  if (params.pubkey) {
    const serialized = serializeVideoEvent({
      id: `video-${simpleHash(canonicalUrl)}`,
      title,
      url: canonicalUrl,
      mimeType,
      thumbnailUrl,
      duration,
      size: sizeBytes,
      summary: description || undefined,
      isShort,
      tags,
    });
    surfaces.nostr = serialized;
  }

  return surfaces;
}

// ─── Metadata enrichment (fail-open) ────────────────────────────────────

interface EnrichedMeta {
  title?: string;
  authorName?: string;
  thumbnail?: string;
  duration?: number;
  mimeType?: string;
  sizeBytes?: number;
}

async function enrichPeerTube(canonical: string, _env: Env): Promise<EnrichedMeta> {
  try {
    const uuid = new URL(canonical).pathname.split('/').pop() ?? '';
    if (!uuid) return {};
    const instance = new URL(canonical).origin;
    const res = await safeFetch(`${instance}/api/v1/videos/${uuid}`, {
      headers: { 'user-agent': 'DegenFeed-VideoWrapper/0.1' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      name?: string;
      duration?: number;
      thumbnailPath?: string;
      previewPath?: string;
      account?: { displayName?: string; name?: string };
      channel?: { displayName?: string; name?: string };
      files?: Array<{ mimeType?: string; size?: number }>;
    };
    const file = data.files?.[0];
    return {
      title: data.name,
      authorName: data.account?.displayName || data.account?.name || data.channel?.displayName,
      thumbnail: data.previewPath
        ? `${instance}${data.previewPath}`
        : data.thumbnailPath
          ? `${instance}${data.thumbnailPath}`
          : undefined,
      duration: data.duration,
      mimeType: file?.mimeType,
      sizeBytes: file?.size,
    };
  } catch (err) {
    log('warn', '[video-embed] PeerTube enrichment failed', err);
    return {};
  }
}

async function enrichYouTube(url: string): Promise<EnrichedMeta> {
  try {
    const res = await safeFetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      title: data.title,
      authorName: data.author_name,
      thumbnail: data.thumbnail_url,
    };
  } catch (err) {
    log('warn', '[video-embed] YouTube enrichment failed', err);
    return {};
  }
}

async function enrichVimeo(url: string): Promise<EnrichedMeta> {
  try {
    const res = await safeFetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
      duration?: number;
    };
    return {
      title: data.title,
      authorName: data.author_name,
      thumbnail: data.thumbnail_url,
      duration: data.duration,
    };
  } catch (err) {
    log('warn', '[video-embed] Vimeo enrichment failed', err);
    return {};
  }
}

/** Enrich metadata for the detected source. Fail-open — empty on any error. */
async function enrich(source: VideoSourceId, canonical: string, env: Env): Promise<EnrichedMeta> {
  switch (source) {
    case 'peertube':
      return enrichPeerTube(canonical, env);
    case 'youtube':
      return enrichYouTube(canonical);
    case 'vimeo':
      return enrichVimeo(canonical);
    default:
      return {};
  }
}

// ─── Router ─────────────────────────────────────────────────────────────

const videoEmbed = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════════════════
// GET /api/video/embed?url=<video-url> — unified oEmbed JSON
// ═══════════════════════════════════════════════════════════════════════

videoEmbed.get('/', async (c) => {
  const rawUrl = c.req.query('url')?.trim();
  if (!rawUrl) return jsonResponse({ error: 'url query param is required' }, 400);
  if (!isValidVideoUrl(rawUrl)) return jsonResponse({ error: 'Invalid URL' }, 400);

  const { source, canonical, detail } = detectSource(rawUrl);
  if (source === 'unknown') {
    return jsonResponse({ error: 'Unsupported video URL' }, 400);
  }

  // KV cache for the oEmbed JSON (TTL 10 min — metadata rarely changes).
  const cacheKey = `video:embed:v1:${encodeURIComponent(canonical)}`;
  try {
    const cached = await c.env.CACHE?.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=600, s-maxage=600',
        },
      });
    }
  } catch {
    /* cache miss — continue */
  }

  const meta = await enrich(source, canonical, c.env);
  const title = meta.title || new URL(canonical).pathname.split('/').pop() || 'Video';
  const isShort = (meta.duration ?? 0) <= 180 || source === 'blossom';

  let html: string;
  switch (source) {
    case 'peertube':
      html = peerTubeIframe(canonical);
      break;
    case 'youtube':
      html = youtubeIframe(canonical);
      break;
    case 'vimeo':
      html = vimeoIframe(canonical);
      break;
    case 'blossom':
    case 'ipfs':
    case 'direct':
      html = directVideoTag(canonical, meta.mimeType);
      break;
    default:
      html = `<a href="${escapeHtml(canonical)}">Watch video</a>`;
  }

  const providerNames: Record<VideoSourceId, string> = {
    peertube: 'PeerTube (DegenFeed)',
    blossom: 'Blossom (nostr.build)',
    ipfs: 'IPFS',
    youtube: 'YouTube',
    vimeo: 'Vimeo',
    direct: 'DegenFeed Video',
    unknown: 'DegenFeed',
  };

  const responseBody: VideoEmbedResponse = {
    type: 'video',
    version: '1.0',
    title,
    author_name: meta.authorName,
    thumbnail_url: meta.thumbnail,
    duration: meta.duration,
    provider_name: providerNames[source],
    provider_url: source === 'peertube' ? new URL(canonical).origin : 'https://degenfeed.xyz',
    width: 560,
    height: 315,
    html,
    source,
    canonical_url: canonical,
    protocols: buildProtocolSurfaces({
      canonicalUrl: canonical,
      title,
      description: meta.title ? '' : undefined,
      thumbnailUrl: meta.thumbnail,
      mimeType: meta.mimeType,
      sizeBytes: meta.sizeBytes,
      duration: meta.duration,
      isShort,
      tags: detail?.uuid ? ['peertube'] : [],
      pubkey: c.env.NOSTR_NSEC || c.env.NOSTR_PRIVATE_KEY,
    }),
  };

  try {
    await c.env.CACHE?.put(cacheKey, JSON.stringify(responseBody), { expirationTtl: 600 });
  } catch {
    /* non-fatal */
  }

  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=600, s-maxage=600',
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/video/rss.xml — Media RSS feed of announced videos
// ═══════════════════════════════════════════════════════════════════════

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface RssVideoItem {
  id: string;
  title: string;
  url: string;
  enclosureUrl: string;
  enclosureType: string;
  enclosureLength?: number;
  thumbnailUrl?: string;
  description?: string;
  publishedAt: number;
}

export const VIDEO_RSS_KV_KEY = 'video:announcements:v1:list';

/** Read the KV-backed list of announced videos (newest first). */
export async function getAnnouncedVideos(env: Env, limit = 50): Promise<RssVideoItem[]> {
  try {
    const raw = await env.CACHE?.get(VIDEO_RSS_KV_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RssVideoItem[];
    return (Array.isArray(parsed) ? parsed : []).slice(0, limit);
  } catch {
    return [];
  }
}

videoEmbed.get('/rss.xml', async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 50, 1), 200);
  const items = await getAnnouncedVideos(c.env, limit);

  const rssItems = items
    .map(
      (item) => `  <item>
    <title>${escapeXml(item.title)}</title>
    <link>${escapeXml(item.url)}</link>
    <guid isPermaLink="false">video:${escapeXml(item.id)}</guid>
    <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>
    <description>${escapeXml(item.description ?? item.title)}</description>
    <enclosure url="${escapeXml(item.enclosureUrl)}" type="${escapeXml(item.enclosureType)}" length="${item.enclosureLength ?? 0}"/>
    ${item.thumbnailUrl ? `<media:thumbnail url="${escapeXml(item.thumbnailUrl)}"/>` : ''}
  </item>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>DegenFeed Video</title>
    <link>https://degenfeed.xyz/videos</link>
    <description>Recently announced videos across all protocols.</description>
    <atom:link href="https://degenfeed.xyz/api/video/rss.xml" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=120',
    },
  });
});

export { videoEmbed };
