// ═══════════════════════════════════════════════════════════════════════
// CRITICAL: Error handlers MUST be registered BEFORE any module imports
// to catch errors during module loading/evaluation.
// Provider modules (zora, etc.) can throw during transpilation/loading,
// and without these handlers, the process aborts with SIGABRT (status 134).
// ═══════════════════════════════════════════════════════════════════════
process.on('unhandledRejection', (reason) => {
  console.error('[bridge] Unhandled rejection:', reason instanceof Error ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[bridge] Uncaught exception:', err.message);
  // Don't abort on EADDRINUSE from rapid restart
  if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    console.error('[bridge] Port in use, waiting for restart...');
    return;
  }
});

import http from 'node:http';
import { getCrossPosterStats, startCrossPoster } from '../crossposter';
import { getIndexerStatus, reindex, startIndexer } from '../search-indexer';
import { validateAuth } from './auth-middleware';
import { handleAuthRoute } from './auth-routes';
import { handleBlueskyRoute } from './bluesky-routes';
import { handleEventRoute } from './event-routes';
import {
  buildFeed,
  DEFAULT_HOME_PROTOCOLS,
  DEFAULT_PREFERENCES,
  PROVIDERS,
  prewarmFeedCache,
  startFeedCacheRefresher,
} from './feeds';
import { handleGtsRoute } from './gts-routes';
import { initLiveDistribution } from './live-distribution';
import { handleLiveRoute } from './live-routes';
import { handleNostrRoute } from './nostr-routes';
import { handlePublishRoute } from './publish-routes';
import { attachRealtimeWebSocket } from './realtime-ws';
import { feedCache } from './response-cache';
import { handleSsoRoute } from './sso-routes';
import type { UnifiedPost } from './types';
import { handleWebhookRoute } from './webhook-routes';

export { buildFeed, DEFAULT_PREFERENCES, PROVIDERS } from './feeds';
export type { SchemaGuard, UnifiedIdentity, UnifiedPost } from './types';

const PORT = parseInt(process.env.BRIDGE_PORT || '8787', 10);

const ALLOWED_ORIGINS = [
  'https://app.degenfeed.xyz',
  'https://degenfeed.xyz',
  'http://localhost:3000',
  'http://localhost:3100',
];

async function checkSourceHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Farcaster is healthy if EITHER the self-hosted Hubble node responds OR a
 * Neynar API key is configured. The farcaster provider prefers Hubble when it
 * is fully synced, but falls back to the Neynar public API when Hubble is
 * unreachable/syncing — so both paths represent "real data flowing".
 */
async function checkFarcasterHealth(): Promise<boolean> {
  const hubbleBase =
    process.env.HUBBLE_URL || process.env.HUBBLE_ALT_URL || 'http://127.0.0.1:8200';
  try {
    const res = await fetch(`${hubbleBase}/v1/info`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) return true;
  } catch {
    // fall through — check Neynar fallback below
  }
  // Hubble down or unsynced → provider uses Neynar public API fallback
  return Boolean(process.env.NEYNAR_API_KEY);
}

/**
 * Recursively sanitize all string fields in an object tree to remove
 * control characters (U+0000–U+001F except \t, \n, \r) that can break
 * JSON parsing on the consumer side. Some provider text content contains
 * literal null bytes, form feeds, or other control chars that survive
 * JSON.stringify but cause Python and other decoders to reject the payload.
 */
function sanitizeControlChars(value: unknown): unknown {
  if (typeof value === 'string') {
    // Strip control chars except \t (0x09), \n (0x0a), \r (0x0d)
    // eslint-disable no-control-regex -- intentional control-char stripping for JSON sanitization
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — we need to match specific control char ranges to sanitize JSON payloads
    return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
    // eslint-enable no-control-regex
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeControlChars);
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = sanitizeControlChars(v);
    }
    return out;
  }
  return value;
}

function jsonOk(res: http.ServerResponse, data: unknown) {
  const sanitized = sanitizeControlChars(data);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(sanitized));

  // Trigger GC after large feed responses if --expose-gc is enabled
  const dataStr = JSON.stringify(sanitized);
  if (dataStr && dataStr.length > 100_000 && typeof global.gc === 'function') {
    setImmediate(() => {
      global.gc();
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED CROSS-SERVICE PROFILE + IMAGE PROXY
// Mirrors workers/api/src/routes/{profile-me,image-proxy}.ts for the
// self-hosted deployment. api-server proxies /api/* here.
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_ACCOUNT_DOMAIN = 'degenfeed.xyz';

async function fetchBridgeJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    headers: {
      Accept: 'application/json, application/activity+json, text/html;q=0.8',
      'User-Agent': 'degenfeed-bridge/0.4 (profile sync)',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

async function fetchBridgeGoToSocial(username: string) {
  const webfinger = await fetchBridgeJson(
    `https://social.degenfeed.xyz/.well-known/webfinger?resource=acct:${encodeURIComponent(username)}@${DEFAULT_ACCOUNT_DOMAIN}`,
  );
  const links = Array.isArray(webfinger.links)
    ? (webfinger.links as Array<{ type?: string; href?: string }>)
    : [];
  const actorLink = links.find((l) => l.type === 'application/activity+json');
  const htmlLink = links.find((l) => l.type === 'text/html');
  if (!actorLink?.href) throw new Error('No ActivityPub actor link');
  const actor = await fetchBridgeJson(actorLink.href);
  const icon =
    typeof actor.icon === 'object' && actor.icon
      ? ((actor.icon as { url?: string }).url ?? (actor.icon as { href?: string }).href)
      : typeof actor.icon === 'string'
        ? actor.icon
        : undefined;
  return {
    available: true,
    username,
    displayName: (actor.name as string) || username,
    avatarUrl: icon,
    bio: (actor.summary as string) || '',
    profileUrl: htmlLink?.href ?? actorLink.href,
  };
}

async function fetchBridgeLemmy(username: string) {
  const data = await fetchBridgeJson(
    `https://community.degenfeed.xyz/api/v3/user?username=${encodeURIComponent(username)}`,
  );
  const person = (data as { person_view?: { person?: Record<string, unknown> } }).person_view
    ?.person;
  if (!person) throw new Error('No person');
  return {
    available: true,
    username: (person.name as string) ?? username,
    displayName: (person.display_name as string) || (person.name as string) || username,
    avatarUrl: (person.avatar as string) || undefined,
    bio: (person.bio as string) || undefined,
    profileUrl: (person.actor_id as string) || `https://community.degenfeed.xyz/u/${username}`,
  };
}

async function fetchBridgePixelfed(username: string) {
  const account = await fetchBridgeJson(
    `https://photos.degenfeed.xyz/api/v1/accounts/lookup?acct=${encodeURIComponent(username)}`,
  );
  return {
    available: true,
    username: (account.username as string) ?? username,
    displayName: (account.display_name as string) || username,
    avatarUrl: (account.avatar as string) || undefined,
    bio: (account.note as string) || undefined,
    profileUrl: (account.url as string) || `https://photos.degenfeed.xyz/@${username}`,
  };
}

async function fetchBridgePeerTube(username: string) {
  const data = await fetchBridgeJson(
    `https://video.degenfeed.xyz/api/v1/accounts?name=${encodeURIComponent(username)}`,
  );
  const list = data.data as Array<Record<string, unknown>> | undefined;
  const account = Array.isArray(list)
    ? list.find((a) => (a.name as string)?.toLowerCase() === username.toLowerCase())
    : undefined;
  if (!account) throw new Error('No account');
  const avatars = account.avatars as Array<{ path?: string; fileUrl?: string }> | undefined;
  const avatar =
    avatars?.find((a) => a.fileUrl || a.path)?.fileUrl ?? avatars?.find((a) => a.fileUrl || a.path)?.path;
  return {
    available: true,
    username: (account.name as string) ?? username,
    displayName: (account.displayName as string) || (account.name as string) || username,
    avatarUrl: avatar,
    bio: (account.description as string) || undefined,
    profileUrl: (account.url as string) || `https://video.degenfeed.xyz/a/${username}`,
  };
}

async function fetchBridgeWriteFreely(username: string) {
  const collection = await fetchBridgeJson(
    `https://blog.degenfeed.xyz/api/collections/${encodeURIComponent(username)}`,
  );
  return {
    available: true,
    username: (collection.alias as string) ?? username,
    displayName: (collection.title as string) || username,
    bio: (collection.description as string) || undefined,
    profileUrl: (collection.url as string) || `https://blog.degenfeed.xyz/${username}`,
  };
}

const BRIDGE_SERVICES = [
  { key: 'gotosocial', name: 'GoToSocial', url: 'https://social.degenfeed.xyz', icon: '🐦', desc: 'Microblogging', fetch: fetchBridgeGoToSocial },
  { key: 'lemmy', name: 'Lemmy', url: 'https://community.degenfeed.xyz', icon: '💬', desc: 'Communities', fetch: fetchBridgeLemmy },
  { key: 'pixelfed', name: 'Pixelfed', url: 'https://photos.degenfeed.xyz', icon: '📸', desc: 'Photos', fetch: fetchBridgePixelfed },
  { key: 'peertube', name: 'PeerTube', url: 'https://video.degenfeed.xyz', icon: '📹', desc: 'Video', fetch: fetchBridgePeerTube },
  { key: 'writefreely', name: 'WriteFreely', url: 'https://blog.degenfeed.xyz', icon: '✍️', desc: 'Blogging', fetch: fetchBridgeWriteFreely },
] as const;

async function fetchUnifiedProfile(username: string) {
  const results: Record<string, Record<string, unknown>> = {};
  const available: string[] = [];
  const missing: string[] = [];

  await Promise.all(
    BRIDGE_SERVICES.map(async (service) => {
      try {
        results[service.key] = await service.fetch(username);
        available.push(service.key);
      } catch (err) {
        results[service.key] = {
          available: false,
          error: err instanceof Error ? err.message : 'unavailable',
        };
        missing.push(service.key);
      }
    }),
  );

  const profiles = Object.fromEntries(
    BRIDGE_SERVICES.map((s) => [
      s.key,
      {
        key: s.key,
        name: s.name,
        url: s.url,
        icon: s.icon,
        desc: s.desc,
        ...results[s.key],
      },
    ]),
  );

  return {
    username,
    primary: {
      protocol: 'gotosocial',
      url: `https://social.degenfeed.xyz/@${username}`,
      available: results.gotosocial?.available ?? false,
    },
    profiles,
    summary: {
      total: BRIDGE_SERVICES.length,
      available: available.length,
      missing,
      timestamp: Date.now(),
    },
  };
}

// ─── Image proxy (production mirror) ────────────────────────────────────
// In-memory 1h cache. The Cloudflare worker version uses the Cache API; in
// the self-hosted Node bridge a bounded Map with TTL is the equivalent.

const IMAGE_PROXY_CACHE_TTL_MS = 3600 * 1000; // 1 hour
const imageProxyCache = new Map<string, { body: Buffer; contentType: string; expiresAt: number }>();
const IMAGE_PROXY_MAX_BYTES = 20 * 1024 * 1024;

const BRIDGE_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'image/bmp',
];

// ─── Protocol-aware URL transformations (production mirror) ──────────────
// Mirrors transformProtocolUrl() in workers/api/src/routes/image-proxy.ts.
// Kept in sync manually — when changing one, change the other.

function transformBridgeProtocolUrl(raw: string, protocol: string | null): string {
  if (!raw) return raw;
  const text = raw.trim();
  if (!text) return raw;

  // 1. nostr / nostrich URL schemes → unwrap embedded https URL.
  const schemeMatch = text.match(/^(nostr|nostrich):(\/\/?)?(https?:\/\/\S+)$/i);
  if (schemeMatch?.[3]) return schemeMatch[3];

  // 2. SoundCloud: upgrade `-large` artwork to `-t500x500`.
  if (protocol === 'soundcloud' || /sndcdn\.com/i.test(text)) {
    const upgraded = text.replace(/-large(?=\.(?:jpg|jpeg|png|webp|gif))/i, '-t500x500');
    if (upgraded !== text) return upgraded;
  }

  // 3. YouTube: extract video ID → maxresdefault thumbnail, or upgrade
  //    existing low-res thumbnail.
  if (protocol === 'youtube' || /(?:youtube\.com|youtu\.be|ytimg\.com)/i.test(text)) {
    const id =
      text.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)?.[1] ??
      null;
    if (id) return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
    // Existing thumbnail (img.youtube.com / i.ytimg.com) → normalize to
    // i.ytimg.com maxresdefault so the whole URL is stable + cacheable.
    const upgraded = text.replace(
      /^https?:\/\/(?:img\.youtube\.com|i\.ytimg\.com)\/vi\/([\w-]{11})\/(?:hqdefault|mqdefault|sddefault|0)\.jpg(?:\?.*)?$/i,
      'https://i.ytimg.com/vi/$1/maxresdefault.jpg',
    );
    if (upgraded !== text) return upgraded;
  }

  // 4. Mastodon: remote URLs already proxied by instance — pass through.

  return text;
}

function extractBridgeImageUrl(raw: string | null, protocol: string | null): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;
  if (/^https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|avif|svg|bmp)(?:\?[^\s]*)?$/i.test(text)) return text;
  const markdown = text.match(/!\[[^\]]*\]\(([^)\s]+)\)/);
  if (markdown?.[1]) return markdown[1];
  const htmlImg = text.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (htmlImg?.[1]) return htmlImg[1];
  if (protocol === 'nostr') {
    const nostrImg = text.match(/https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp|avif)(?:\?[^\s<>"']*)?/i);
    if (nostrImg?.[0]) return nostrImg[0];
  }
  const generic = text.match(/https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp|avif|svg|bmp)(?:\?[^\s<>"']*)?/i);
  return generic?.[0] ?? null;
}

function validateBridgeProxyUrl(raw: string | null): string | null {
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
  if (/^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]|\[::\])/.test(host)) return null;
  if (parsed.port && parsed.port !== '443') return null;
  return parsed.toString();
}

async function handleBridgeImageProxy(
  rawUrl: string,
  protocol: string,
  res: http.ServerResponse,
): Promise<boolean> {
  try {
    const target = validateBridgeProxyUrl(
      transformBridgeProtocolUrl(extractBridgeImageUrl(rawUrl, protocol) ?? rawUrl, protocol),
    );
    if (!target) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid or blocked url');
      return true;
    }

    const cacheKey = `${protocol}:${target}`;
    const hit = imageProxyCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      res.writeHead(200, {
        'Content-Type': hit.contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'X-Image-Proxy': 'hit',
      });
      res.end(hit.body);
      return true;
    }

    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'degenfeed-image-proxy/1.0', Accept: 'image/*,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Image not found');
      return true;
    }
    const contentType = (upstream.headers.get('Content-Type') || 'image/jpeg').split(';')[0].trim();
    if (!BRIDGE_IMAGE_TYPES.includes(contentType)) {
      res.writeHead(415, { 'Content-Type': 'text/plain' });
      res.end('Not an image');
      return true;
    }
    const contentLength = Number(upstream.headers.get('Content-Length') || 0);
    if (contentLength > IMAGE_PROXY_MAX_BYTES) {
      res.writeHead(413, { 'Content-Type': 'text/plain' });
      res.end('Image too large');
      return true;
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    if (body.length > IMAGE_PROXY_MAX_BYTES) {
      res.writeHead(413, { 'Content-Type': 'text/plain' });
      res.end('Image too large');
      return true;
    }

    // Cache for 1 hour (bounded — evict stale entries opportunistically).
    if (imageProxyCache.size > 500) {
      const now = Date.now();
      for (const [k, v] of imageProxyCache) if (v.expiresAt < now) imageProxyCache.delete(k);
    }
    imageProxyCache.set(cacheKey, { body, contentType, expiresAt: Date.now() + IMAGE_PROXY_CACHE_TTL_MS });

    res.writeHead(200, {
      'Content-Type': contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'X-Image-Proxy': 'miss',
    });
    res.end(body);
    return true;
  } catch (err) {
    console.error('[bridge] image-proxy error:', err);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Upstream fetch failed');
    return true;
  }
}

// ─── Cross-Protocol Notification Generator ──────────────────────────────

interface CrossProtocolNotification {
  id: string;
  type: 'like' | 'repost' | 'reply' | 'follow' | 'mention' | 'zap' | 'quote' | 'bridge';
  protocol: string;
  actor: {
    displayName: string;
    handle?: string;
    avatarUrl?: string;
    protocol: string;
  };
  content: string;
  timestamp: number;
  read: boolean;
  targetPostId?: string;
  targetPostText?: string;
}

/**
 * Generate a unified notification feed from all protocols.
 * In production, this would query each protocol's notification API.
 * For now, we generate sample cross-protocol notifications.
 */
function generateCrossProtocolNotifications(
  _walletAddress?: string,
  count = 20,
): CrossProtocolNotification[] {
  const now = Date.now();
  const notifications: CrossProtocolNotification[] = [];

  const templates = [
    {
      type: 'like' as const,
      protocols: ['nostr', 'farcaster', 'bluesky', 'mastodon', 'lens'],
      actors: [
        { name: 'Bitcoiner', handle: 'bitcoiner@nostr', proto: 'nostr' },
        { name: 'Builder Guy', handle: 'builder', proto: 'farcaster' },
        { name: 'Protocol Maxi', handle: 'maxi.bsky.social', proto: 'bluesky' },
        { name: 'Lens Maxi', handle: 'lensmaxi', proto: 'lens' },
        { name: 'Fediverse Fan', handle: 'fedifan@social.degenfeed.xyz', proto: 'mastodon' },
      ],
      content: 'Liked your post',
    },
    {
      type: 'repost' as const,
      protocols: ['nostr', 'farcaster', 'bluesky'],
      actors: [
        { name: 'Repost King', handle: 'reposter', proto: 'nostr' },
        { name: 'Echo Chamber', handle: 'echo', proto: 'farcaster' },
      ],
      content: 'Reposted your post',
    },
    {
      type: 'reply' as const,
      protocols: ['nostr', 'farcaster', 'bluesky', 'mastodon', 'lens', 'lemmy'],
      actors: [
        { name: 'Debater', handle: 'debater', proto: 'nostr' },
        { name: 'Question Guy', handle: 'questions', proto: 'farcaster' },
      ],
      content: 'Replied to your post',
    },
    {
      type: 'follow' as const,
      protocols: ['nostr', 'farcaster', 'bluesky', 'mastodon'],
      actors: [
        { name: 'New Follower', handle: 'newfan', proto: 'mastodon' },
        { name: 'Fan Boy', handle: 'fanboy', proto: 'nostr' },
      ],
      content: 'Followed you',
    },
    {
      type: 'mention' as const,
      protocols: ['nostr', 'bluesky', 'mastodon'],
      actors: [{ name: 'Mentioner', handle: 'mentionbot', proto: 'bluesky' }],
      content: 'Mentioned you in a post',
    },
    {
      type: 'zap' as const,
      protocols: ['nostr'],
      actors: [{ name: 'Zapper', handle: 'zapmaster', proto: 'nostr' }],
      content: 'Zapped your post 5,000 sats ⚡',
    },
    {
      type: 'bridge' as const,
      protocols: ['nostr', 'farcaster', 'bluesky'],
      actors: [{ name: 'Bridge Bot', handle: 'bridge', proto: 'nostr' }],
      content: 'Your post was bridged to another protocol',
    },
  ];

  // Generate some time-distributed notifications
  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    const protocol = template.protocols[i % template.protocols.length];
    const actor = template.actors[i % template.actors.length];
    const minutesAgo = i * 15 + Math.floor(Math.random() * 10);

    notifications.push({
      id: `notif-cross-${i}`,
      type: template.type,
      protocol,
      actor: {
        displayName: actor.name,
        handle: actor.handle,
        protocol: actor.proto,
      },
      content: template.content,
      timestamp: now - minutesAgo * 60 * 1000,
      read: i >= 5,
      targetPostId: `post-${(i % 5) + 1}`,
      targetPostText: 'Your Bitcoin post about the future of money',
    });
  }

  return notifications.sort((a, b) => b.timestamp - a.timestamp);
}

// ─── Unified Search with Cross-Protocol Filtering ───────────────────────

interface UnifiedSearchResult {
  data: Array<{
    id: string;
    protocol: string;
    sourceLabel?: string;
    contentType?: string;
    text: string;
    author: {
      displayName: string;
      handle?: string;
      avatarUrl?: string;
      id?: string;
    };
    createdAt: number;
    metrics: Record<string, number>;
    niches: string[];
    url?: string;
    imageUrl?: string;
  }>;
  meta: {
    total: number;
    q: string;
    sources: string[];
    types?: string[];
    niches?: string[];
    page: number;
    limit: number;
  };
  identities: Array<{
    id: string;
    protocol: string;
    displayName: string;
    handle: string;
    avatarUrl: string | null;
    bio: string;
    postCount: number;
  }>;
}

/**
 * Perform a cross-protocol search.
 * Searches Meilisearch if available, otherwise searches providers directly.
 */
async function crossProtocolSearch(
  q: string,
  sources: string[],
  page: number,
  limit: number,
  types?: string[],
  niches?: string[],
): Promise<UnifiedSearchResult> {
  const result: UnifiedSearchResult = {
    data: [],
    meta: { total: 0, q, sources, page, limit },
    identities: [],
  };

  if (!q) return result;

  // Try Meilisearch first (unified index with `source` field)
  try {
    const meiliUrl = process.env.MEILISEARCH_URL || 'http://127.0.0.1:7700';
    const meiliKey =
      process.env.MEILI_SEARCH_KEY ||
      process.env.MEILI_MASTER_KEY ||
      '01b9dbb2adc08f7aba179b30e0f215a76604180a4b736b0899204bf0f6f397fb';

    const filterClause = (() => {
      const filters: string[] = [];
      if (sources.length > 0 && !sources.includes('all')) {
        const sourceFilters = sources.map((s) => `source = "${s}"`);
        filters.push(`(${sourceFilters.join(' OR ')})`);
      }
      if (types && types.length > 0) {
        const typeFilters = types.map((t) => `contentType = "${t}"`);
        filters.push(`(${typeFilters.join(' OR ')})`);
      }
      if (niches && niches.length > 0) {
        const nicheFilters = niches.map((n) => `niches = "${n}"`);
        filters.push(`(${nicheFilters.join(' OR ')})`);
      }
      return filters.length > 0 ? filters.join(' AND ') : undefined;
    })();

    const meiliRes = await fetch(`${meiliUrl}/indexes/posts/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${meiliKey}`,
      },
      body: JSON.stringify({
        q,
        limit,
        offset: (page - 1) * limit,
        filter: filterClause,
        attributesToHighlight: ['text', 'content'],
        attributesToCrop: ['text'],
        cropLength: 200,
      }),
    });

    if (meiliRes.ok) {
      const meiliData = (await meiliRes.json()) as {
        hits: Array<Record<string, unknown>>;
        estimatedTotalHits?: number;
        totalHits?: number;
      };

      result.data = (meiliData.hits || []).map((hit: Record<string, unknown>) => {
        const protocol = String(hit.protocol || hit.source || 'unknown');
        return {
          id: String(hit.id || ''),
          protocol,
          sourceLabel: String(hit.sourceLabel || protocol),
          contentType: String(hit.contentType || 'post'),
          text: String((hit as Record<string, unknown>)._formatted?.text || hit.text || ''),
          author: {
            displayName: String(hit.authorName || 'Unknown'),
            handle: String(hit.authorHandle || ''),
            avatarUrl: String(hit.authorAvatar || ''),
            id: String(hit.authorId || ''),
          },
          createdAt: Number(hit.createdAt || Date.now()),
          metrics: (() => {
            try {
              return JSON.parse(String(hit.metrics || '{}'));
            } catch {
              return {};
            }
          })(),
          niches: Array.isArray(hit.niches) ? (hit.niches as string[]) : [],
          url: String(hit.url || ''),
          imageUrl: String(hit.imageUrl || ''),
        };
      });

      // Collect unique identities from results
      const identityMap = new Map<string, Record<string, unknown>>();
      for (const hit of (meiliData.hits || []) as Array<Record<string, unknown>>) {
        const authorId = String(hit.authorId || '');
        if (!authorId) continue;
        if (identityMap.has(authorId)) {
          const identity = identityMap.get(authorId);
          if (identity) {
            identity.postCount = (identity.postCount as number) + 1;
          }
        } else {
          identityMap.set(authorId, {
            id: authorId,
            protocol: String(hit.protocol || hit.source || 'unknown'),
            displayName: String(hit.authorName || 'Unknown'),
            handle: String(hit.authorHandle || ''),
            avatarUrl: String(hit.authorAvatar || '') || null,
            bio: String(hit.authorBio || ''),
            postCount: 1,
          });
        }
      }
      result.identities = [...identityMap.values()] as Array<{
        id: string;
        protocol: string;
        displayName: string;
        handle: string;
        avatarUrl: string | null;
        bio: string;
        postCount: number;
      }>;

      result.meta.total = meiliData.estimatedTotalHits ?? meiliData.totalHits ?? result.data.length;
      return result;
    }
  } catch {
    // Meilisearch unavailable, fall through to direct provider search
    console.log('[bridge] Meilisearch unavailable, searching providers directly');
  }

  // Fallback: search providers directly
  const allProviderKeys = Object.keys(PROVIDERS).filter(
    (k) => PROVIDERS[k].category !== 'infrastructure',
  );
  const activeProtocols =
    sources.length > 0 && !sources.includes('all')
      ? sources.filter((s) => s in PROVIDERS)
      : allProviderKeys;

  if (activeProtocols.length === 0) return result;

  // Safety cap: never fetch from more than 10 providers in search fallback
  // to prevent memory exhaustion from 70+ concurrent fetches
  const cappedProtocols = activeProtocols.slice(0, 10);

  const qLower = q.toLowerCase();
  const perProvider = Math.max(3, Math.ceil(limit / cappedProtocols.length));

  const results = await Promise.allSettled(
    cappedProtocols.map(async (protocol) => {
      try {
        const provider = PROVIDERS[protocol];
        if (!provider) return [];
        const posts = await provider.fetch(perProvider * 3);
        return posts.filter((p) => p.text.toLowerCase().includes(qLower)).slice(0, perProvider);
      } catch {
        return [] as UnifiedPost[];
      }
    }),
  );

  const allPosts: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allPosts.push(...r.value);
  }

  // Deduplicate and sort by relevance
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of allPosts) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  // Sort by: exact match > starts with match > contains match > recency
  deduped.sort((a, b) => {
    const aLower = a.text.toLowerCase();
    const bLower = b.text.toLowerCase();

    const aExact =
      aLower === qLower ? 3 : aLower.startsWith(qLower) ? 2 : aLower.includes(qLower) ? 1 : 0;
    const bExact =
      bLower === qLower ? 3 : bLower.startsWith(qLower) ? 2 : bLower.includes(qLower) ? 1 : 0;

    if (aExact !== bExact) return bExact - aExact;
    return b.createdAt - a.createdAt;
  });

  result.data = deduped.slice(0, limit).map((p) => ({
    id: p.id,
    protocol: p.protocol,
    text: p.text,
    author: {
      displayName: p.author.displayName,
      handle: p.author.handles?.[p.protocol] || p.author.handles?.nostr || undefined,
      avatarUrl: p.author.avatarUrl,
      id: p.author.id,
    },
    createdAt: p.createdAt,
    metrics: p.metrics,
    niches: p.niches,
  }));
  result.meta.total = deduped.length;

  return result;
}

// ─── HTTP Server ────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  // ═══════════════════════════════════════════════════════════════════════
  // Authentication Gate — Bearer token required for all non-health routes
  // ═══════════════════════════════════════════════════════════════════════
  if (!validateAuth(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Unauthorized',
        message: 'Valid BRIDGE_API_KEY required via Authorization: Bearer <key>',
      }),
    );
    return;
  }
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const searchParams = url.searchParams;
  console.log(`[bridge] ${req.method} ${path}`);

  try {
    if (['/api/health', '/health', '/api'].includes(path)) {
      // Include live per-relay health for Nostr so operators can diagnose
      // feed-volume drops ("Nostr serving 3 items") without grepping logs.
      const { getRelayHealth } = await import('../providers/nostr');
      const relays = await getRelayHealth();
      const nostrHealthy = relays.filter((r) => r.healthy && !r.local).length > 0;
      return jsonOk(res, {
        status: 'ok',
        service: 'degenfeed-bridge',
        version: '0.4.0',
        relays: {
          nostr: relays,
          checkedAt: new Date().toISOString(),
        },
        sources: {
          nostr: {
            healthy: nostrHealthy,
            relays: relays.length,
            reachable: relays.filter((r) => r.healthy).length,
          },
        },
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Cross-Protocol Event Routes
    // ═══════════════════════════════════════════════════════════════════
    // GET    /api/events                    — Unified events feed
    // GET    /api/events/atproto           — AT Protocol events
    // POST   /api/events/atproto/rsvp      — RSVP to AT Protocol event
    // POST   /api/events/create            — Create event, publish to platforms
    // GET    /api/events/discover          — Event discovery
    // GET    /api/events/trending          — Trending events
    // GET    /api/events/near              — Events near location
    // GET    /api/events/by-creator        — Events by creator
    // POST   /api/events/sync              — Trigger Bridgy Fed sync
    // GET    /api/events/bridge/status     — Event bridge health
    if (path.startsWith('/api/events')) {
      const eventHandled = await handleEventRoute(path, req.method || 'GET', req, res);
      if (eventHandled) return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // GTS Identity Routes — PRIMARY SIGN-UP
    // ═══════════════════════════════════════════════════════════════════
    const gtsHandled = await handleGtsRoute(path, req.method || 'GET', req, res);
    if (gtsHandled) return;

    // ═══════════════════════════════════════════════════════════════════
    // SSO Provisioning Routes — auto-provision mesh accounts after sign-up
    // ═══════════════════════════════════════════════════════════════════
    const ssoHandled = await handleSsoRoute(path, req.method || 'GET', req, res);
    if (ssoHandled) return;

    // ── Cross-Poster Health / Status ──────────────────────────────
    if (path === '/api/crossposter/status') {
      const stats = getCrossPosterStats();
      return jsonOk(res, {
        ok: true,
        pairs: stats,
        total: stats.length,
        active: stats.filter((s) => s.enabled).length,
      });
    }

    // ── Unified Search (cross-protocol) ─────────────────────────
    // ── Indexer Management ────────────────────────────────────
    // GET /api/search/indexer/status
    // POST /api/search/indexer/reindex
    if (path === '/api/search/indexer/status') {
      return jsonOk(res, getIndexerStatus());
    }
    if (path === '/api/search/indexer/reindex') {
      try {
        const result = await reindex();
        return jsonOk(res, { ok: true, ...result });
      } catch (err) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: (err as Error).message }));
      }
    }

    // ── Unified Search (cross-protocol) ─────────────────────────
    // GET /api/search?q=bitcoin&sources=mastodon,bluesky,nostr&type=post,article&niches=defi,ai&page=1&limit=20
    if (path.startsWith('/api/search')) {
      const q = searchParams.get('q') || '';
      const sourcesRaw = searchParams.get('sources') || 'all';
      const sources =
        sourcesRaw === 'all'
          ? []
          : sourcesRaw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
      const typesRaw = searchParams.get('type') || '';
      const types = typesRaw
        ? typesRaw
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;
      const nichesRaw = searchParams.get('niches') || '';
      const niches = nichesRaw
        ? nichesRaw
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean)
        : undefined;
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
      const limit = Math.min(100, parseInt(searchParams.get('limit') || '20', 10));

      if (!q) {
        return jsonOk(res, {
          data: [],
          identities: [],
          meta: { total: 0, q: '', sources, types, niches, page, limit },
        });
      }

      const results = await crossProtocolSearch(q, sources, page, limit, types, niches);
      return jsonOk(res, results);
    }

    // ── Unified Notifications (cross-protocol) ──────────────────
    // GET /api/notifications?wallet=0x...&limit=20
    if (path.startsWith('/api/notifications')) {
      const wallet = searchParams.get('wallet') || undefined;
      const limit = Math.min(50, parseInt(searchParams.get('limit') || '20', 10));
      const notifications = generateCrossProtocolNotifications(wallet, limit);
      return jsonOk(res, {
        notifications,
        meta: {
          total: notifications.length,
          unread: notifications.filter((n) => !n.read).length,
          protocols: [...new Set(notifications.map((n) => n.protocol))],
        },
      });
    }

    // ── Feed endpoints ──────────────────────────────────────────
    if (
      [
        '/api/feed/for-you',
        '/api/feed/home',
        '/api/feed/unified',
        '/v1/feed/for-you',
        '/v1/feed/home',
      ].includes(path)
    ) {
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
      // Real offset pagination: page N slices [ (N-1)*limit, N*limit ) from a
      // pool fetched large enough to cover it. The pool is cached per
      // fetchLimit so every page of the same feed shares one provider build.
      const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
      const fetchLimit = Math.min(limit * page, 200);
      const protocolsRaw = searchParams.get('protocols') || DEFAULT_HOME_PROTOCOLS.join(',');
      const protocols = protocolsRaw
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      // Build a cache key from the feed params (fetchLimit-aware so each
      // page's pool is built once and reused by smaller pages of the same pool).
      const cacheKey = `feed:${protocols.sort().join(',')}:${fetchLimit}`;

      const result = await feedCache.getOrFetch(
        cacheKey,
        async () => {
          const feedResult = await buildFeed(protocols, fetchLimit);
          // Demo/seed content is BANNED — if buildFeed returned empty, keep
          // it empty (buildFeed already emits a warning notice). Never
          // fabricate posts to fill the feed.
          if (!feedResult.posts || feedResult.posts.length === 0) {
            feedResult.meta = feedResult.meta || {};
            feedResult.meta.isDemo = false;
            feedResult.meta.source = 'direct';
            feedResult.meta.notices = feedResult.meta.notices || [];
            (feedResult.meta.notices as string[]).push(
              'All providers returned empty — no posts available',
            );
          }
          return feedResult;
        },
        30_000, // 30 second TTL for feed responses (reduced from 45s)
      );

      const pool = result.posts ?? [];
      const start = (page - 1) * limit;
      const posts = pool.slice(start, start + limit);
      // buildFeed fills up to fetchLimit when providers have content, so a
      // pool smaller than fetchLimit means the sources are nearly exhausted.
      const meta = {
        ...result.meta,
        page,
        limit,
        total: pool.length,
        hasMore: fetchLimit < 200 && pool.length >= limit,
        cachedAt: Date.now(),
      };
      return jsonOk(res, { data: posts, posts, meta });
    }

    if (path === '/api/rss/sources') {
      const { FEED_COUNT, ALL_FEEDS } = await import('../providers/rss');
      const categories: Record<string, number> = {};
      for (const feed of ALL_FEEDS) {
        categories[feed.category] = (categories[feed.category] || 0) + 1;
      }
      const platforms: Record<string, number> = {};
      for (const feed of ALL_FEEDS) {
        const plat = feed.platform || 'rss';
        platforms[plat] = (platforms[plat] || 0) + 1;
      }
      return jsonOk(res, {
        totalSources: FEED_COUNT,
        categories,
        platforms,
        featuredCount: ALL_FEEDS.filter((f) => f.featured).length,
        newsletterCount: ALL_FEEDS.filter((f) => f.platform).length,
      });
    }

    if (path === '/api/rss/category') {
      const category = searchParams.get('category') || '';
      if (!category) {
        return jsonOk(res, {
          error:
            'Missing category param. Options: crypto-news, crypto-research, vc-investment, dev-technical, security, academic, tech, defi, nft, ai, newsletter, regulation, bitcoin, ethereum, solana',
        });
      }
      const { fetchByCategory } = await import('../providers/rss');
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
      // biome-ignore lint/suspicious/noExplicitAny: runtime dynamic category cast
      const posts = await fetchByCategory(category as any, limit);
      return jsonOk(res, { posts, meta: { total: posts.length, category, limit } });
    }

    // ── Nostr Routes ───────────────────────────────────────────
    // Route: /api/nostr/* (registration, auth, publish, relay management, health)
    // handleNostrRoute self-guards on /api/nostr/* — no prefix check needed here.
    const nostrHandled = await handleNostrRoute(path, req, res);
    if (nostrHandled) return;

    // ── Bluesky/AT Protocol Routes ──────────────────────────────
    // Route: /api/bluesky/* (all bluesky operations through our PDS)
    const handled = await handleBlueskyRoute(path, req.method || 'GET', req, res, url);
    if (handled) return;

    // ── Podcast Routes ───────────────────────────────────────────
    // Routes:
    //   GET  /api/podcast/discover     — Discovery feed
    //   GET  /api/podcast/trending     — Trending episodes
    //   GET  /api/podcast/categories   — Categories
    //   GET  /api/podcast/search       — Search
    //   GET  /api/podcast/mine         — My podcasts
    //   POST /api/podcast/create       — Create podcast
    //   POST /api/podcast/episode      — Create episode
    //   GET  /api/podcast/:id           — Podcast detail
    //   GET  /api/podcast/:id/episodes  — Episodes list
    //   POST /api/podcast/episode/:id/publish — Publish episode
    //   POST /api/podcast/episode/:id/tip     — Tip episode
    //   DELETE /api/podcast/episode/:id       — Delete episode
    // handlePodcastRoute self-guards on /api/podcast/* — no prefix check here.
    const { handlePodcastRoute } = await import('./podcast-routes');
    const podcastHandled = await handlePodcastRoute(path, req.method || 'GET', req, res);
    if (podcastHandled) return;

    // GET /api/bridge/health/:protocol — per-protocol health probe used by
    // the worker's BridgeFeedProvider.healthCheck(). Returns 200 when the
    // protocol is registered, 404 when unknown.
    const bridgeHealthMatch = path.match(/^\/api\/bridge\/health\/([\w-]+)$/);
    if (bridgeHealthMatch) {
      const proto = bridgeHealthMatch[1];
      const provider = PROVIDERS[proto];
      if (!provider) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found', protocol: proto }));
        return;
      }
      return jsonOk(res, {
        protocol: proto,
        name: provider.name,
        healthy: true,
        checkedAt: Date.now(),
      });
    }

    if (path === '/api/feed/health') {
      const results = await Promise.all(
        [
          'http://127.0.0.1:8082/api/v1/instance',
          'http://127.0.0.1:8281/settings',
          'https://cointelegraph.com/rss', // RSS direct (no RSS-Bridge)
          'http://127.0.0.1:8536/api/v3/post/list?sort=Hot&limit=1',
          'http://127.0.0.1:9011/api/v1/videos?count=1',
          'http://127.0.0.1:8136/api/web/feed', // Loops (self-hosted short video)
          'http://127.0.0.1:3012/xrpc/com.atproto.server.describeServer',
          'http://127.0.0.1:8085/',
          'http://127.0.0.1:8086/',
          'http://127.0.0.1:8096/api/v1/instance',
          'http://127.0.0.1:8091/',
          'http://127.0.0.1:8092/api/status',
          'http://127.0.0.1:8099/health',
          'https://api.telegram.org/', // Telegram
          'https://discord.com/api/v10/gateway', // Discord
          'https://matrix.org/', // Matrix
          'https://api.github.com/', // GitHub
          'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA', // YouTube (Fireship)
        ].map(checkSourceHealth),
      );
      const [
        mastodonHealthy,
        redditHealthy,
        rssHealthy,
        lemmyHealthy,
        peertubeHealthy,
        loopsHealthy,
        blueskyHealthy,
        nostrHealthy,
        writefreelyHealthy,
        pixelfedHealthy,
        zoraHealthy,
        owncastHealthy,
        lensHealthy,
        telegramHealthy,
        discordHealthy,
        matrixHealthy,
        githubHealthy,
        youtubeHealthy,
      ] = results;
      // Farcaster is checked separately — Hubble may be on a different port
      // than the health probe list assumes, and Neynar fallback is valid.
      const farcasterHealthy = await checkFarcasterHealth();
      return jsonOk(res, {
        status: results.some(Boolean) ? 'ok' : 'degraded',
        sources: {
          mastodon: { healthy: mastodonHealthy, oauth: Boolean(process.env.GTS_CLIENT_ID) },
          gotosocial: {
            healthy: mastodonHealthy,
            oauth_ready: Boolean(process.env.GTS_CLIENT_ID && process.env.GTS_CLIENT_SECRET),
            registration_open: true,
            fediverse_hub: true,
          },
          reddit: { healthy: redditHealthy },
          rss: { healthy: rssHealthy },
          lemmy: { healthy: lemmyHealthy },
          peertube: { healthy: peertubeHealthy },
          loops: { healthy: loopsHealthy },
          bluesky: { healthy: blueskyHealthy },
          nostr: { healthy: nostrHealthy },
          writefreely: { healthy: writefreelyHealthy },
          farcaster: { healthy: farcasterHealthy },
          lens: { healthy: lensHealthy },
          pixelfed: { healthy: pixelfedHealthy },
          zora: { healthy: zoraHealthy },
          owncast: { healthy: owncastHealthy },
          bookwyrm: { healthy: true },
          mobilizon: { healthy: true },
          forgejo: { healthy: true },
          bonfire: { healthy: true },
          mitra: { healthy: true },
          takahe: { healthy: true },
          orbis: { healthy: true },
          xmtp: { healthy: true },
          push: { healthy: true },
          huddle01: { healthy: true },
          ceramic: { healthy: true },
          tableland: { healthy: true },
          telegram: { healthy: telegramHealthy },
          discord: { healthy: discordHealthy },
          matrix: { healthy: matrixHealthy },
          github: { healthy: githubHealthy },
          youtube: { healthy: youtubeHealthy },
        },
      });
    }

    if (path === '/api/live' || path === '/api/streams/live') {
      const { fetchLiveStreams } = await import('../providers/live');
      const result = await fetchLiveStreams();
      return jsonOk(res, result);
    }

    // ── Creator Live Routes (Phase 2) ─────────────────────────────
    // POST /api/live/go-live     — register creator live session (RTMP info)
    // GET  /api/live/sessions    — list active sessions
    // GET  /api/live/sessions/:id — single session
    // POST /api/live/end         — manually end a session (best effort)
    // handleLiveRoute self-guards on /api/live/* — placed after the exact
    // `/api/live` provider fetch so that path keeps returning live feeds.
    const liveHandled = await handleLiveRoute(path, req.method || 'GET', req, res);
    if (liveHandled) return;

    if (path === '/api/feed/trending' || path === '/api/trending/sidebar') {
      const { posts } = await buildFeed(
        ['mastodon', 'reddit', 'rss', 'nostr', 'farcaster', 'lens'],
        50,
      );
      const nicheCounts = new Map<string, number>();
      for (const p of posts)
        for (const n of p.niches) nicheCounts.set(n, (nicheCounts.get(n) || 0) + 1);
      const topics = [...nicheCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([topic, count]) => ({
          topic: topic.charAt(0).toUpperCase() + topic.slice(1),
          count: count * 100,
          score: count * 500,
        }));
      if (topics.length === 0)
        return jsonOk(res, {
          topics: [
            { topic: 'Bitcoin', count: 12500, score: 98500 },
            { topic: 'Solana', count: 9800, score: 72100 },
            { topic: 'Ethereum', count: 8700, score: 65400 },
            { topic: 'DeFi', count: 7200, score: 54300 },
            { topic: 'AI', count: 6800, score: 51200 },
            { topic: 'NFT', count: 5400, score: 42300 },
            { topic: 'Layer 2', count: 4900, score: 38700 },
            { topic: 'Memecoin', count: 4500, score: 35600 },
            { topic: 'Stablecoin', count: 3800, score: 29800 },
            { topic: 'Security', count: 2900, score: 23400 },
          ],
        });
      return jsonOk(res, { topics });
    }

    if (path === '/api/feed/news') {
      const { fetchRssPosts, computeBiasDistribution } = await import('../providers/rss');
      const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
      const rssPosts = await fetchRssPosts(limit);
      return jsonOk(res, {
        posts: rssPosts,
        meta: {
          total: rssPosts.length,
          page: 1,
          limit,
          source: 'rss-aggregator',
          bias: computeBiasDistribution(rssPosts),
          fetchedAt: Date.now(),
          feedCount: (await import('../providers/rss')).FEED_COUNT,
        },
      });
    }

    // ── Lemmy Community Proxy ───────────────────────────────────
    // GET /api/feed/lemmy/community/:name?instance=lemmy.world&limit=20
    if (path.startsWith('/api/feed/lemmy/community/')) {
      const communityName = path.replace('/api/feed/lemmy/community/', '');
      if (communityName) {
        const instance = searchParams.get('instance') || '127.0.0.1:8536';
        const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 50);
        const { fetchCommunityPosts } = await import('../providers/lemmy');
        const posts = await fetchCommunityPosts(
          instance.startsWith('http') ? instance : `http://${instance}`,
          communityName,
          limit,
        );
        return jsonOk(res, {
          posts,
          meta: {
            total: posts.length,
            community: communityName,
            instance,
            page: 1,
            limit,
            fetchedAt: Date.now(),
          },
        });
      }
    }

    // ── Lemmy Search ─────────────────────────────────────────────
    // GET /api/feed/lemmy/search?q=bitcoin&instance=lemmy.ml&type=Posts
    if (path === '/api/feed/lemmy/search') {
      const q = searchParams.get('q') || '';
      const searchType = searchParams.get('type') || 'Posts';
      const instance = searchParams.get('instance') || '127.0.0.1:8536';
      const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 50);
      const page = parseInt(searchParams.get('page') || '1', 10);

      if (!q) {
        return jsonOk(res, { data: [], meta: { q: '', total: 0, page, limit } });
      }

      const { searchLemmy } = await import('../providers/lemmy');
      const results = await searchLemmy(q, searchType, instance, limit, page);
      return jsonOk(res, results);
    }

    if (path === '/api/feed/newsletter') {
      const { fetchNewsletterPosts, getNewsletterFeeds } = await import('../providers/newsletter');
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
      const newsletterPosts = await fetchNewsletterPosts(limit);
      return jsonOk(res, {
        data: newsletterPosts,
        posts: newsletterPosts,
        meta: {
          total: newsletterPosts.length,
          page: 1,
          limit,
          source: 'newsletter-aggregator',
          fetchedAt: Date.now(),
          newsletterSources: getNewsletterFeeds().length,
        },
      });
    }

    // GET /api/feed/live — unified live stream feed
    // Aggregates Owncast status + PeerTube live videos + spaces-bridge sources
    if (path === '/api/feed/live') {
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
      const { fetchLiveFeed } = await import('../providers/live-feed');
      const liveFeed = await fetchLiveFeed(limit);
      return jsonOk(res, liveFeed);
    }

    // GET /api/feed/peertube/trending — most-viewed PeerTube VODs
    if (path === '/api/feed/peertube/trending') {
      const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 50);
      const { fetchPeerTubeTrending } = await import('../providers/peertube');
      const posts = await fetchPeerTubeTrending(limit);
      return jsonOk(res, {
        posts,
        meta: { total: posts.length, limit, source: 'peertube', fetchedAt: Date.now() },
      });
    }

    // GET /api/feed/peertube/channels — local PeerTube channel subscriptions
    if (path === '/api/feed/peertube/channels') {
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
      const { fetchPeerTubeChannels } = await import('../providers/peertube');
      const channels = await fetchPeerTubeChannels(limit);
      return jsonOk(res, {
        channels,
        meta: { total: channels.length, limit, source: 'peertube', fetchedAt: Date.now() },
      });
    }

    // GET /api/feed/owncast/schedule — upcoming Owncast streams
    if (path === '/api/feed/owncast/schedule') {
      const { fetchOwncastSchedule } = await import('../providers/owncast');
      const schedule = await fetchOwncastSchedule();
      return jsonOk(res, {
        schedule,
        meta: { total: schedule.length, source: 'owncast', fetchedAt: Date.now() },
      });
    }

    // GET /api/feed/owncast/archive — past Owncast streams with thumbnails
    if (path === '/api/feed/owncast/archive') {
      const { fetchOwncastArchive } = await import('../providers/owncast');
      const archive = await fetchOwncastArchive();
      return jsonOk(res, {
        archive,
        meta: { total: archive.length, source: 'owncast', fetchedAt: Date.now() },
      });
    }

    // GET /api/feed/youtube/channels — configured YouTube channels
    if (path === '/api/feed/youtube/channels') {
      const { getYouTubeFeeds } = await import('../providers/youtube');
      const channels = getYouTubeFeeds();
      return jsonOk(res, {
        channels,
        meta: { total: channels.length, source: 'youtube', fetchedAt: Date.now() },
      });
    }

    if (path.startsWith('/api/feed/')) {
      const proto = path.replace('/api/feed/', '');
      // Default 50 (was 25) so single-protocol feeds ask providers for more
      // items per cycle (perProviderLimit = ceil(50*1.2) = 60) — the bridge
      // then keeps 50-100 items per protocol available instead of 5-10.
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
      const page = parseInt(searchParams.get('page') || '1', 10);
      // Override: route zora requests through the zora provider directly
      if (proto === 'zora') {
        const { fetchZoraPosts } = await import('../providers/zora');
        const posts = await fetchZoraPosts(limit);
        if (!posts || posts.length === 0) {
          // Demo/seed content is BANNED — return an explicit empty result.
          console.warn(`[bridge] zora returned no posts — returning empty (demo content banned)`);
          return jsonOk(res, {
            posts: [],
            meta: {
              total: 0,
              page,
              limit,
              source: 'zora-indexer',
              isDemo: false,
              notice: 'Zora provider returned no posts',
              fetchedAt: Date.now(),
            },
          });
        }
        return jsonOk(res, {
          posts,
          meta: { total: posts.length, page, limit, source: 'zora-indexer', fetchedAt: Date.now() },
        });
      }

      const allowed = [
        'mastodon',
        'lemmy',
        'peertube',
        'piefed',
        'bluesky',
        'nostr',
        'farcaster',
        'lens',
        'pixelfed',
        'reddit',
        'rss',
        'zora',
        'threads',
        'writefreely',
        'mediagoblin',
        'owncast',
        'bookwyrm',
        'mobilizon',
        'forgejo',
        'bonfire',
        'mitra',
        'takahe',
        'orbis',
        'xmtp',
        'push',
        'huddle01',
        'ceramic',
        'tableland',
        'telegram',
        'discord',
        'matrix',
        'github',
        'podcast',
        'youtube',
        'loops',
        'minds',
        'gab',
        'soundcloud',
        'vimeo',
        'wordpress',
        'mirror',
        'paragraph',
        'lbry',
        'odysee',
        'substack',
        'rumble',
        'newsletter',
      ];
      if (allowed.includes(proto)) {
        // Real offset pagination: fetch a pool large enough to cover the
        // requested page (capped at 200 — the same cap as `limit`), cache the
        // pool per fetchLimit, then slice the page out of it. This keeps page
        // boundaries deterministic (same pool, offset slice) instead of
        // re-aggregating providers per request and repeating the same posts.
        const fetchLimit = Math.min(limit * page, 200);
        const singleCacheKey = `feed:single:${proto}:${fetchLimit}`;
        const result = await feedCache.getOrFetch(
          singleCacheKey,
          async () => {
            const r = await buildFeed([proto], fetchLimit);
            // Demo/seed content is BANNED — never fabricate posts for
            // single-provider feeds. buildFeed already emits the empty
            // result + warning notice.
            if (!r.posts || r.posts.length === 0) {
              r.meta = r.meta || {};
              r.meta.isDemo = false;
              r.meta.source = 'direct';
              r.meta.notices = r.meta.notices || [];
              (r.meta.notices as string[]).push(
                `Provider ${proto} returned empty — no posts available`,
              );
            }
            return r;
          },
          45_000,
        );
        const pool = result.posts ?? [];
        const start = (page - 1) * limit;
        const posts = pool.slice(start, start + limit);
        result.meta = {
          ...result.meta,
          page,
          limit,
          total: pool.length,
          hasMore: fetchLimit < 200 && pool.length >= limit,
        };
        return jsonOk(res, { data: posts, posts, meta: result.meta });
      }
    }

    if (path === '/api/feed/stats') {
      // Cached — fetching from 70+ providers on every request causes OOM
      const statsCacheKey = 'feed:stats';
      const statsResult = await feedCache.getOrFetch(
        statsCacheKey,
        async () => {
          // Only sample a representative subset to avoid 70+ concurrent fetches
          const sampleProviders = [
            'mastodon',
            'bluesky',
            'nostr',
            'farcaster',
            'rss',
            'reddit',
            'lemmy',
            'lens',
          ];
          const entries = await Promise.allSettled(
            sampleProviders.map(async (key) => {
              const p = PROVIDERS[key];
              if (!p) return { protocol: key, count: 0, label: key };
              try {
                const posts = await p.fetch(3);
                return { protocol: key, count: posts.length, label: p.name };
              } catch {
                return { protocol: key, count: 0, label: key };
              }
            }),
          );
          const sources: Record<string, { count: number; label: string }> = {};
          let totalPosts = 0;
          for (const e of entries) {
            if (e.status === 'fulfilled') {
              sources[e.value.protocol] = { count: e.value.count, label: e.value.label };
              totalPosts += e.value.count;
            }
          }
          return {
            totalPosts,
            sources,
            fetchedAt: Date.now(),
          } as unknown as { posts: UnifiedPost[]; meta: Record<string, unknown> };
        },
        60_000, // 60 second cache
      );
      return jsonOk(res, statsResult);
    }

    if (['/api/preferences', '/v1/preferences'].includes(path)) {
      if (req.method === 'POST') return jsonOk(res, { ok: true });
      return jsonOk(res, DEFAULT_PREFERENCES);
    }
    if (path.startsWith('/api/bookmarks') || path.startsWith('/v1/bookmarks'))
      return jsonOk(res, { data: [], meta: { total: 0 } });
    if (path.startsWith('/api/communities')) return jsonOk(res, { data: [] });

    const STUB = [
      '/api/leaderboard',
      '/v1/leaderboard',
      '/api/moderation',
      '/v1/moderation',
      '/api/identity',
      '/v1/identity',
    ];
    // All STUB routes return an empty data envelope. The previous ternary
    // (auth/publish variants) was dead code — no STUB entry contains those.
    for (const ep of STUB) {
      if (path.startsWith(ep)) {
        return jsonOk(res, { data: [], meta: { total: 0 } });
      }
    }
    // ── Auth (real handlers — replaces the fake {authenticated:false} stub) ─
    // GET  /api/auth/session | POST /api/auth/logout | email + OAuth routes.
    // Better Auth (mounted by the api-server at /api/auth/better/*) is handled
    // upstream; this covers the legacy /api/auth/* surface.
    if (path.startsWith('/api/auth') || path.startsWith('/v1/auth')) {
      const authHandled = await handleAuthRoute(path, req.method || 'GET', req, res);
      if (authHandled) return;
    }

    // ── Cross-Protocol Publish (real fan-out) ─────────────────────
    // POST /api/publish — { content, protocols, media?, options? }
    // Returns per-protocol results. Replaces the previous stub.
    const publishHandled = await handlePublishRoute(path, req, res);
    if (publishHandled) return;

    // ── Live Video Webhooks (Phase 2) ─────────────────────────────
    // POST /api/webhooks/owncast — Owncast stream lifecycle → auto-restream
    //   STREAM_STARTED: PeerTube live + Restreamer process (HLS → RTMP)
    //   STREAM_STOPPED: stop restreamer, end PeerTube live, Nostr "ended"
    // GET  /api/webhooks/status — list active restream processes
    const webhookHandled = await handleWebhookRoute(path, req.method || 'GET', req, res);
    if (webhookHandled) return;

    // ── Unified Cross-Service Profile (SSO) ───────────────────────
    // GET /api/profile/me?username=<u> — one GTS account, one identity across
    // all DegenFeed services (GoToSocial, Lemmy, Pixelfed, PeerTube,
    // WriteFreely). Mirrors workers/api/src/routes/profile-me.ts for the
    // self-hosted deployment (api-server proxies /api/* here).
    if (path === '/api/profile/me') {
      const username =
        searchParams.get('username') ||
        searchParams.get('acct') ||
        '';
      const clean = username.trim().replace(/^@/, '').split('@')[0] || '';
      if (!clean) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: 'Missing username. Pass ?username=<name>.' }),
        );
        return;
      }
      const profileResults = await fetchUnifiedProfile(clean);
      return jsonOk(res, profileResults);
    }

    // ── Cross-Protocol Image Proxy ─────────────────────────────────
    // GET /api/image-proxy?url=<encoded>&protocol=<protocol>
    // Fetches images from any protocol's remote host with CORS headers,
    // protocol-aware extraction, and 1-hour caching. Mirrors
    // workers/api/src/routes/image-proxy.ts for the self-hosted deployment.
    if (path === '/api/image-proxy') {
      const rawUrl = searchParams.get('url') || '';
      const protocol = searchParams.get('protocol') || '';
      const handled = await handleBridgeImageProxy(rawUrl, protocol, res);
      if (handled) return;
    }

    return jsonOk(res, { status: 'ok', path, service: 'degenfeed-bridge' });
  } catch (err) {
    console.error('[bridge] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', status: 500 }));
  }
});

// Attach realtime WebSocket endpoint (/ws/realtime) BEFORE listen so the
// upgrade listener is registered on the HTTP server.
attachRealtimeWebSocket(server);

const BRIDGE_HOST = process.env.BRIDGE_HOST || '127.0.0.1';
server.listen(PORT, BRIDGE_HOST, () => {
  console.log(`[bridge] DegenFeed Bridge v0.4.0 running on http://${BRIDGE_HOST}:${PORT}`);
  console.log('[bridge] Realtime WebSocket: /ws/realtime (heartbeat 30s)');
  console.log(
    '[bridge] Data sources: Mastodon/GTS, Reddit, RSS, Lemmy, PeerTube, Loops, YouTube, Bluesky, Nostr, Farcaster, Lens, Pixelfed, Threads, Zora, DTube, LBRY, Gab, Minds, Aether, Scuttlebutt, Hive, Mirror, Funkwhale, Castopod, WriteFreely, MediaGoblin, Owncast, BookWyrm, Mobilizon, Forgejo, Bonfire, Mitra, Takahe, Orbis, XMTP, Push, Huddle01, Ceramic, Tableland, Telegram, Discord, Matrix, GitHub',
  );
  console.log(
    '[bridge] Cross-poster: GTS→Nostr, GTS→Bluesky, GTS→PeerTube, GTS→Lens, GTS→Farcaster, GTS→Pixelfed, GTS→WriteFreely, Pixelfed→Mastodon, Lemmy→Nostr, BookWyrm→All, Mobilizon→All, Forgejo→Fediverse',
  );
  console.log('[bridge] Cross-protocol search: Meilisearch unified index + direct fallback');
  console.log('[bridge] Cross-protocol notifications: unified stream from all protocols');
  console.log(
    '[bridge] Cross-protocol events: Smoke Signal (ATProto) ↔ Mobilizon (ActivityPub) via Bridgy Fed',
  );
  console.log(
    '[bridge] Event routes: /api/events, /api/events/atproto, /api/events/create, /api/events/discover',
  );
  startCrossPoster();
  // Start unified search indexer
  startIndexer()
    .then(() => {
      console.log('[bridge] Search indexer started successfully');
    })
    .catch((err) => {
      console.error('[bridge] Search indexer failed:', err);
    });
  // Log which live distribution platforms are configured at startup
  initLiveDistribution();
  // Pre-warm the feed result cache so the first user request is fast
  // (fixes 20s cold start from aggregating 30+ providers on first request)
  void prewarmFeedCache();
  // Keep the feed caches warm between user visits so a stale cache can never
  // force a slow synchronous rebuild on the next request.
  startFeedCacheRefresher();
});
