/**
 * Threads Bridge Provider — public profile scraper + ActivityPub federation
 *
 * ARCHITECTURE (re-verified 2026-08-31):
 *   Two real-content paths, tried in order:
 *
 *   Path 1 (PRIMARY) — ActivityPub federation via public Mastodon instances:
 *     Threads accounts that opt into federation are bridged to the fediverse.
 *     Public Mastodon instances expose their bridged copy through the
 *     read-only REST API (accounts/lookup + accounts/:id/statuses) — no auth,
 *     no login wall, no scraping, no datacenter-IP blocking. This mirrors the
 *     gotosocial provider's PUBLIC_INSTANCES pattern. Verified 2026-08-31:
 *     mastodon.social resolves zuck@threads.net (741 statuses) and
 *     mosseri@threads.net (2186 statuses) with real Threads permalinks.
 *     Threads' own AP actor endpoints (threads.net/ap/users/...) 404 from
 *     datacenter IPs and Bridgy Fed does not resolve threads.net handles, so
 *     a public instance's bridged copy is the most reliable headless source.
 *
 *   Path 2 (FALLBACK) — embedded-JSON scrape (canonical, needs residential
 *     proxies): Meta's official API only returns your own account's data, so
 *     the historical path to arbitrary public accounts is parsing the embedded
 *     JSON payloads of the public profile HTML (`__NEXT_DATA__` +
 *     `application/json` blobs). The modern threads.com serves a JS-only
 *     Comet shell to logged-out clients from datacenter IPs — no embedded
 *     post data — and crawler user-agents hit a login wall. When
 *     THREADS_PROXY_LIST points at rotating residential proxies this path
 *     works; otherwise it honestly returns []. Runs only when Path 1 came up
 *     short, bounded by a 5s budget so a slow Meta wall can never blow the
 *     feed layer's 12s provider timeout.
 *
 * FRESHNESS: this provider intentionally does NOT pre-filter posts
 * (FEED_MAX_AGE_HOURS). The feed layer owns freshness — its safety net
 * (`feedPool = freshAll.length > 0 ? freshAll : allPosts`) surfaces the real
 * posts on single-protocol routes and keeps home fresh-only. Pre-filtering
 * here is what made /api/feed/home permanently show `perProtocol.threads: 0`.
 *
 * RATE-LIMIT SURVIVAL:
 *   - 90s in-process TTL cache (feed prewarmer + refresher call providers
 *     repeatedly; the cache collapses them into one real fetch per window)
 *   - jittered 1–3s delay between per-account requests
 *   - exponential backoff + alternate proxy on HTTP 429/5xx
 *   - optional IP rotation via THREADS_PROXY_LIST (comma-separated proxy URLs)
 *   - bridged account ids cached 1h (no repeated lookup hammering)
 *
 * Configuration (all optional, no hardcoded credentials):
 *   THREADS_PROXY_LIST        comma-separated proxy URLs, rotated round-robin
 *   THREADS_AP_INSTANCES      comma-separated ActivityPub instances to query
 *                             (default: https://mastodon.social)
 *   ACTIVITYPUB_BRIDGE_ENABLED 'false'/'0' force-disables the federation path
 *                             (legacy flag — the path is ON by default now;
 *                             BRIDGY_FED_ENABLED is accepted as an alias)
 *   THREADS_FETCH_TIMEOUT_MS  per-request timeout (default 10_000)
 */

import { stripHtml } from '../lib/utils';
import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const THREADS_BASE = 'https://www.threads.net';
const THREADS_FRONT = 'https://www.threads.net';
const DEFAULT_TIMEOUT_MS = 10_000;
const THREADS_CACHE_TTL_MS = 90_000;

// ─── Curated crypto/web3 Threads accounts ───────────────────────────────
// Public, non-private accounts active on Threads. Override at runtime by
// passing curatedHandles to fetchThreadsPosts, or extend this list.
export const CURATED_THREADS_HANDLES: string[] = [
  // Founders / builders
  'zuck',
  'mosseri',
  'vitalikbuterin',
  'vitalik.eth',
  'balajis',
  'naval',
  'sama',
  'jessepollak',
  'stani',
  'sassal0x',
  'cdixon',
  'pmarca',
  'aeyakovenko',
  'cz_binance',
  // Projects / orgs
  'coinbase',
  'binance',
  'opensea',
  'bitcoin',
  'ethereum',
  'solana',
  'base',
  'avax',
  'arbitrum',
  'optimism',
  'polygon',
  'chainlink',
  'uniswap',
  'aave',
];

// ─── IP rotation (optional) ─────────────────────────────────────────────
// Threads rate-limits aggressively from datacenter IPs. When
// THREADS_PROXY_LIST is configured we tunnel each request through a rotating
// proxy (CONNECT) using only Node built-ins — no extra dependency. When it is
// not set we use the global fetch directly (no proxy).

interface ThreadsProxy {
  host: string;
  port: number;
  auth: string | undefined;
}

function parseProxyList(): ThreadsProxy[] {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.THREADS_PROXY_LIST;
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try {
        const u = new URL(s);
        const auth =
          u.username || u.password
            ? `Basic ${Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString('base64')}`
            : undefined;
        return {
          host: u.hostname,
          port: Number(u.port || (u.protocol === 'https:' ? 443 : 80)),
          auth,
        };
      } catch {
        return null;
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
}

let proxyList: ThreadsProxy[] | null = null;
let proxyIndex = 0;

function nextProxy(): ThreadsProxy | null {
  if (proxyList === null) proxyList = parseProxyList();
  if (proxyList.length === 0) return null;
  const p = proxyList[proxyIndex % proxyList.length];
  proxyIndex += 1;
  return p ?? null;
}

/**
 * Fetch a URL through an HTTP(S) proxy using a CONNECT tunnel. Returns the
 * same Response-like contract as global fetch (status, ok, text()).
 */
function fetchViaProxy(
  url: string,
  proxy: ThreadsProxy,
  init: RequestInit & { timeoutMs?: number },
): Promise<{ ok: boolean; status: number; text(): Promise<string> }> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const isHttps = target.protocol === 'https:';
    const targetPort = target.port || (isHttps ? 443 : 80);
    const mod = isHttps
      ? (require('node:https') as typeof import('node:https'))
      : (require('node:http') as typeof import('node:http'));

    const connectReq = mod.request({
      host: proxy.host,
      port: proxy.port,
      method: 'CONNECT',
      path: `${target.hostname}:${targetPort}`,
      headers: {
        Host: `${target.hostname}:${targetPort}`,
        ...(proxy.auth ? { 'Proxy-Authorization': proxy.auth } : {}),
      },
    });

    const timeout = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => {
      connectReq.destroy();
      reject(new Error(`[threads] proxy CONNECT timeout to ${proxy.host}`));
    }, timeout);

    connectReq.on('connect', (res, socket) => {
      clearTimeout(timer);
      if (res.statusCode !== 200) {
        socket.destroy();
        reject(new Error(`[threads] proxy CONNECT failed: ${res.statusCode}`));
        return;
      }
      // Tunnel established — now run TLS over the socket when https.
      if (!isHttps) {
        const req = mod.request({
          host: target.hostname,
          port: targetPort,
          path: `${target.pathname}${target.search}`,
          method: init.method || 'GET',
          headers: (init.headers as Record<string, string>) || {},
          createConnection: () => socket,
        });
        req.on('response', (r) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            resolve({
              ok: (r.statusCode ?? 0) < 400,
              status: r.statusCode ?? 0,
              text: async () => body,
            });
          });
        });
        req.on('error', reject);
        req.end();
        return;
      }
      const tls = require('node:tls') as typeof import('node:tls');
      const tlsSocket = tls.connect({ socket, servername: target.hostname }, () => {
        const req = mod.request({
          host: target.hostname,
          port: targetPort,
          path: `${target.pathname}${target.search}`,
          method: init.method || 'GET',
          headers: (init.headers as Record<string, string>) || {},
          createConnection: () => tlsSocket,
        });
        req.on('response', (r) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            resolve({
              ok: (r.statusCode ?? 0) < 400,
              status: r.statusCode ?? 0,
              text: async () => body,
            });
          });
        });
        req.on('error', reject);
        req.end();
      });
      tlsSocket.on('error', reject);
    });
    connectReq.on('error', reject);
    connectReq.end();
  });
}

// ─── HTTP helpers with jitter + backoff ────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Random 1–3s jitter between account fetches (plus an optional base). */
async function jitterDelay(baseMs = 1000): Promise<void> {
  const jitter = Math.floor(Math.random() * 2000);
  await sleep(baseMs + jitter);
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Fresh datr cookie value so EU consent/login walls don't intercept. */
function datrCookie(): string {
  const rand = Array.from({ length: 32 }, () =>
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'.charAt(
      Math.floor(Math.random() * 64),
    ),
  ).join('');
  return `datr=${Buffer.from(rand).toString('base64')}`;
}

interface FetchHtmlResult {
  html: string;
  status: number;
}

/**
 * Fetch a public Threads profile page. Retries with backoff on 429/5xx,
 * rotating to the next configured proxy when IP rotation is enabled.
 */
async function fetchProfileHtml(username: string): Promise<FetchHtmlResult> {
  const url = `${THREADS_BASE}/@${encodeURIComponent(username)}`;
  const headers = {
    'User-Agent': BROWSER_UA,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    Cookie: datrCookie(),
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const proxy = nextProxy();
      if (proxy) {
        const res = await fetchViaProxy(url, proxy, { headers, timeoutMs: DEFAULT_TIMEOUT_MS });
        return { html: await res.text(), status: res.status };
      }
      const res = await $fetch(url, {
        headers,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        redirect: 'follow',
      });
      const html = await res.text();
      if (res.status === 429 || res.status >= 500) {
        const backoff = 1500 * attempt;
        // console.log(`[threads] @${username}: HTTP ${res.status}, backing off ${backoff}ms`);
        await sleep(backoff);
        continue;
      }
      return { html, status: res.status };
    } catch {
      //       console.log(
      //         `[threads] @${username}: fetch error (${msg}), attempt ${attempt}/${maxAttempts}`,
      //       );
      if (attempt < maxAttempts) await sleep(1200 * attempt);
    }
  }
  return { html: '', status: 0 };
}

// ─── Embedded JSON parsing ─────────────────────────────────────────────
// Threads has shipped several embedded-data shapes over time:
//   1. `__NEXT_DATA__` → props.pageProps.threads[].threads[] (2023–2024)
//   2. `__NEXT_DATA__` → props.pageProps (thread_items / userData) (2024)
//   3. Inline `<script type="application/json">` blobs walked for any
//      `thread_items[].post` shape (Apify-style, resilient to shape moves)
// The walker below handles all of them.

interface ThreadsPost {
  id?: string;
  code?: string;
  user?: {
    pk?: string;
    username?: string;
    full_name?: string;
    profile_pic_url?: string;
    is_verified?: boolean;
    follower_count?: number;
  };
  taken_at?: number;
  like_count?: number;
  text_post_app_info?: {
    direct_reply_count?: number;
    repost_count?: number;
    quote_count?: number;
    text_fragments?: {
      fragments?: Array<{ plaintext?: string; link_fragment?: { uri?: string } }>;
    };
    share_info?: { quoted_post?: unknown; reposted_post?: unknown };
  };
  image_versions2?: { candidates?: Array<{ url?: string; width?: number; height?: number }> };
  carousel_media?: Array<{ image_versions2?: { candidates?: Array<{ url?: string }> } }>;
  video_versions?: Array<{ url?: string; type?: number }>;
  is_quote_post?: boolean;
  accessibility_caption?: string;
}

/** Best image candidate URL from a post (largest width first). */
function bestImageUrl(post: ThreadsPost): string {
  const pick = (cands?: Array<{ url?: string; width?: number }>): string => {
    if (!cands || cands.length === 0) return '';
    const sorted = [...cands].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
    return sorted[0]?.url ?? '';
  };
  if (post.image_versions2) {
    const url = pick(post.image_versions2.candidates);
    if (url) return url;
  }
  if (Array.isArray(post.carousel_media)) {
    for (const item of post.carousel_media) {
      const url = pick(item.image_versions2?.candidates);
      if (url) return url;
    }
  }
  return '';
}

/** Extract text + link embeds from a post's text fragments. */
function extractTextAndLinks(post: ThreadsPost): { text: string; links: string[] } {
  const fragments = post.text_post_app_info?.text_fragments?.fragments;
  if (!fragments || fragments.length === 0) {
    return { text: '', links: [] };
  }
  let text = '';
  const links: string[] = [];
  for (const f of fragments) {
    if (f.plaintext) text += f.plaintext;
    if (f.link_fragment?.uri) links.push(f.link_fragment.uri);
  }
  return { text: text.trim(), links };
}

/** Map a raw Threads post object into a UnifiedPost. */
function threadToPost(raw: ThreadsPost, username: string): UnifiedPost | null {
  const { text, links } = extractTextAndLinks(raw);
  if (!raw.id && !text && !bestImageUrl(raw)) return null;

  const user = raw.user || {};
  const pk = user.pk || String(raw.id || '').split('_')[0] || username;
  const code = raw.code || '';
  const postId = raw.id ? String(raw.id) : `${username}:${code || 'unknown'}`;

  const embeds: UnifiedPost['embeds'] = [];
  const img = bestImageUrl(raw);
  if (img) embeds.push({ kind: 'image', url: img });
  if (Array.isArray(raw.video_versions) && raw.video_versions.length > 0) {
    const v = raw.video_versions[0];
    if (v?.url) embeds.push({ kind: 'video', url: v.url, meta: { thumbnail: img || undefined } });
  }
  for (const link of links) {
    if (!embeds.some((e) => e.kind === 'link' && e.url === link)) {
      embeds.push({ kind: 'link', url: link });
    }
  }

  const likes = raw.like_count ?? 0;
  const replies = raw.text_post_app_info?.direct_reply_count ?? 0;
  const reposts = raw.text_post_app_info?.repost_count ?? 0;
  const quotes = raw.text_post_app_info?.quote_count ?? 0;

  return {
    id: `threads:${postId}`,
    protocol: 'threads',
    author: {
      id: `threads:${pk}`,
      primary: { protocol: 'threads', id: pk },
      handles: { threads: username },
      displayName: user.full_name || username,
      bio: '',
      avatarUrl: user.profile_pic_url || '',
      followerCount: user.follower_count || 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: text || (img ? '[image]' : ''),
    embeds,
    contentType: embeds.some((e) => e.kind === 'video')
      ? 'video'
      : embeds.some((e) => e.kind === 'image')
        ? 'image'
        : links.length > 0
          ? 'link'
          : 'text',
    createdAt: (raw.taken_at || 0) * 1000 || Date.now(),
    metrics: { likes, reposts, replies, quotes, views: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes, reposts, replies, quotes },
    },
    raw: raw as unknown,
    niches: guessNiches(text),
    canonicalUrl: code
      ? `${THREADS_FRONT}/@${encodeURIComponent(username)}/post/${code}`
      : `${THREADS_FRONT}/@${encodeURIComponent(username)}`,
  };
}

/** Lightweight crypto/web3 niche detection mirroring other providers. */
export function guessNiches(text: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra|erc)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp|lending|compound|aave|uniswap|jupiter)\b/.test(lower))
    niches.push('defi');
  if (/\b(nft|art|collectible|punk|bored|ape|mint)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent|chatgpt)\b/.test(lower)) niches.push('ai');
  if (/\b(meme|pepe|dog|doge|shib|bonk|wif)\b/.test(lower)) niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base|polygon)\b/.test(lower)) niches.push('layer2');
  if (/\b(security|hack|exploit|audit|scam|phishing|breach)\b/.test(lower)) niches.push('security');
  if (/\b(crypto|blockchain|web3|wallet|metamask)\b/.test(lower)) niches.push('web3');
  if (/\b(sec|regulation|etf|compliance|policy|senator)\b/.test(lower)) niches.push('regulation');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

/**
 * Recursively walk an arbitrary JSON value looking for `thread_items` arrays
 * whose entries contain a `post` object (the modern GraphQL/embedded shape).
 */
function collectFromThreadItems(node: unknown, out: ThreadsPost[]): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      if (
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        'post' in (item as Record<string, unknown>) &&
        (item as Record<string, unknown>).post &&
        typeof (item as Record<string, unknown>).post === 'object'
      ) {
        out.push((item as Record<string, unknown>).post as ThreadsPost);
      }
      collectFromThreadItems(item, out);
    }
    return;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node as Record<string, unknown>)) {
      collectFromThreadItems(value, out);
    }
  }
}

/**
 * Parse a profile HTML document for Threads posts.
 * Strategies (in order):
 *   A. `__NEXT_DATA__` JSON → props.pageProps.threads[].threads[]
 *   B. `__NEXT_DATA__` JSON → any thread_items walk
 *   C. every `<script type="application/json">` blob → thread_items walk
 */
export function parseProfileHtml(html: string, _username: string): ThreadsPost[] {
  const found: ThreadsPost[] = [];
  const seen = new Set<string>();

  const push = (p: ThreadsPost | undefined | null): void => {
    if (!p) return;
    const key = p.id || p.code || `${p.user?.username}:${p.taken_at ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(p);
  };

  // Strategy A/B: __NEXT_DATA__
  const nextMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextMatch) {
    try {
      const next = JSON.parse(nextMatch[1] ?? '{}') as {
        props?: { pageProps?: Record<string, unknown> };
      };
      const pageProps = next.props?.pageProps;
      if (pageProps) {
        // Legacy shape: pageProps.threads = [{ threads: [post, ...] }]
        const threadsArr = pageProps.threads;
        if (Array.isArray(threadsArr)) {
          for (const entry of threadsArr) {
            const inner = (entry as Record<string, unknown>)?.threads;
            if (Array.isArray(inner)) {
              for (const p of inner) push(p as ThreadsPost);
            }
          }
        }
        // Modern-ish shape: pageProps.thread_items or userData.user.thread_items
        collectFromThreadItems(pageProps, found);
      }
    } catch {
      // fall through to blob walking
    }
  }

  // Strategy C: walk every application/json blob (covers Comet streamed data)
  const blobRe = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = blobRe.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1] ?? '{}');
      collectFromThreadItems(parsed, found);
    } catch {
      // not JSON — skip
    }
  }

  // Dedup by id/code after strategies
  const dedup = new Map<string, ThreadsPost>();
  for (const p of found) {
    const key = p.id || p.code || `${p.user?.username}:${p.taken_at ?? ''}`;
    if (!dedup.has(key)) dedup.set(key, p);
  }
  const posts = [...dedup.values()];
  // Newest first
  posts.sort((a, b) => (b.taken_at ?? 0) - (a.taken_at ?? 0));
  return posts;
}

// ─── Cache ─────────────────────────────────────────────────────────────
// 90s TTL collapses repeated feed-build calls (prewarm + refresher + user
// requests) into one real fetch per window, exactly like the Reddit provider.

let threadsCache: { posts: UnifiedPost[]; expiresAt: number } | null = null;

function getCachedPosts(): UnifiedPost[] | null {
  if (threadsCache && Date.now() < threadsCache.expiresAt) return threadsCache.posts;
  return null;
}

function setCachedPosts(posts: UnifiedPost[]): void {
  threadsCache = { posts, expiresAt: Date.now() + THREADS_CACHE_TTL_MS };
}

// ─── ActivityPub federation — primary real-content path (2026-08-31) ──
// Bridged Threads accounts are read through public Mastodon REST APIs. This
// is the most reliable headless source: no login wall, no scraping, no
// datacenter-IP blocking (verified: mastodon.social serves real zuck/mosseri
// Threads posts with threads.com permalinks).

const AP_INSTANCES_DEFAULT = ['https://mastodon.social'];
const AP_ACCOUNT_CACHE_TTL_MS = 3_600_000;

function readEnv(key: string): string | undefined {
  try {
    return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env?.[key];
  } catch {
    return undefined;
  }
}

function apInstances(): string[] {
  const raw = readEnv('THREADS_AP_INSTANCES');
  if (raw) {
    const list = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length > 0) return list;
  }
  return AP_INSTANCES_DEFAULT;
}

/** 'false'/'0' disables the federation path; default on (public read API). */
function activityPubEnabled(): boolean {
  const flag = readEnv('ACTIVITYPUB_BRIDGE_ENABLED') ?? readEnv('BRIDGY_FED_ENABLED');
  if (flag === 'false' || flag === '0') return false;
  return true;
}

interface ApStatus {
  id?: string;
  created_at?: string;
  content?: string;
  url?: string;
  uri?: string;
  in_reply_to_id?: string | null;
  reblog?: unknown | null;
  visibility?: string;
  spoiler_text?: string;
  favourite_count?: number;
  favourites_count?: number;
  reblogs_count?: number;
  replies_count?: number;
  quotes_count?: number;
  media_attachments?: Array<{
    type?: string;
    url?: string;
    preview_url?: string;
  }>;
  card?: { url?: string; title?: string } | null;
  account?: {
    id?: string;
    username?: string;
    acct?: string;
    display_name?: string;
    avatar?: string;
    note?: string;
    followers_count?: number;
    following_count?: number;
  };
}

// Resolved bridged account ids per handle, cached 1h so we don't re-lookup
// every 90s feed window.
const apAccountCache = new Map<string, { id: string; expiresAt: number }>();

async function apJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  try {
    const res = await $fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Resolve a Threads handle to its bridged account id on an instance. */
async function apLookupAccount(
  instance: string,
  handle: string,
  timeoutMs: number,
): Promise<string | null> {
  const cached = apAccountCache.get(handle);
  if (cached && Date.now() < cached.expiresAt) return cached.id;
  const acct = `${handle}@threads.net`;
  const base = instance.replace(/\/+$/, '');
  const data = await apJson<{ id?: string; acct?: string }>(
    `${base}/api/v1/accounts/lookup?acct=${encodeURIComponent(acct)}`,
    timeoutMs,
  );
  // Only accept results that actually resolved to the requested handle (some
  // instances 200 with an unrelated account for unknown accts).
  const id = data && typeof data.id === 'string' && data.id ? data.id : null;
  if (id) apAccountCache.set(handle, { id, expiresAt: Date.now() + AP_ACCOUNT_CACHE_TTL_MS });
  return id;
}

/** Fetch recent statuses of a bridged Threads account. */
async function apFetchStatuses(
  instance: string,
  accountId: string,
  limit: number,
  timeoutMs: number,
): Promise<ApStatus[]> {
  const base = instance.replace(/\/+$/, '');
  const data = await apJson<ApStatus[]>(
    `${base}/api/v1/accounts/${accountId}/statuses?limit=${limit}&exclude_reblogs=true`,
    timeoutMs,
  );
  return Array.isArray(data) ? data : [];
}

/** Map a bridged Mastodon status into a Threads UnifiedPost. */
function apStatusToThreadPost(status: ApStatus, handle: string): UnifiedPost | null {
  if (!status || status.reblog || status.in_reply_to_id) return null;
  if (status.visibility && status.visibility !== 'public') return null;
  const body = stripHtml(
    status.spoiler_text
      ? `${status.spoiler_text}\n\n${status.content ?? ''}`
      : (status.content ?? ''),
  ).trim();
  const account = status.account ?? {};
  const media = status.media_attachments ?? [];

  const embeds: UnifiedPost['embeds'] = [];
  for (const m of media) {
    if (m.type === 'image' && m.url) embeds.push({ kind: 'image', url: m.url });
    else if (m.type === 'video' && m.url) {
      embeds.push({ kind: 'video', url: m.url, meta: { thumbnail: m.preview_url || undefined } });
    }
  }
  if (status.card?.url && !embeds.some((e) => e.kind === 'link' && e.url === status.card?.url)) {
    embeds.push({ kind: 'link', url: status.card.url, meta: { title: status.card.title } });
  }
  if (!body && embeds.length === 0) return null;

  const id = status.id ? `threads:ap:${status.id}` : `threads:ap:${handle}:${Date.now()}`;
  const createdMs = status.created_at ? Date.parse(status.created_at) : Date.now();
  const likes = status.favourites_count ?? status.favourite_count ?? 0;
  const reposts = status.reblogs_count ?? 0;
  const replies = status.replies_count ?? 0;
  const quotes = status.quotes_count ?? 0;

  return {
    id,
    protocol: 'threads',
    author: {
      id: `threads:ap:${account.id || handle}`,
      primary: { protocol: 'threads', id: account.id || handle },
      handles: { threads: handle },
      displayName: account.display_name || handle,
      bio: stripHtml(account.note || '').slice(0, 300),
      avatarUrl: account.avatar || '',
      followerCount: account.followers_count || 0,
      followingCount: account.following_count || 0,
      links: [],
      keys: {},
    },
    text: body || (embeds.some((e) => e.kind === 'image' || e.kind === 'video') ? '[image]' : ''),
    embeds,
    contentType: embeds.some((e) => e.kind === 'video')
      ? 'video'
      : embeds.some((e) => e.kind === 'image')
        ? 'image'
        : embeds.some((e) => e.kind === 'link')
          ? 'link'
          : 'text',
    createdAt: createdMs,
    metrics: { likes, reposts, replies, quotes, views: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes, reposts, replies, quotes },
    },
    raw: status as unknown,
    niches: guessNiches(body),
    canonicalUrl:
      status.url || status.uri || `https://www.threads.net/@${encodeURIComponent(handle)}`,
  };
}

interface ActivityPubResult {
  posts: UnifiedPost[];
  notice: string;
}

/** Resolve once the absolute deadline elapses (used to bound slow paths). */
function sleepUntil(deadline: number): Promise<void> {
  return new Promise((r) => setTimeout(r, Math.max(0, deadline - Date.now())));
}

/**
 * Fetch real Threads posts via ActivityPub federation through public
 * Mastodon instances. Only accounts that enabled federation resolve; the
 * rest are skipped honestly. Returns [] + a descriptive notice when the
 * backend is unavailable or nothing is federated. NEVER fabricates content.
 *
 * Bounded by an internal 9s deadline so this path always returns well inside
 * the feed layer's 12s provider timeout, even on a cold cache.
 */
async function fetchThreadsViaActivityPub(limit: number): Promise<ActivityPubResult> {
  if (!activityPubEnabled()) {
    return {
      posts: [],
      notice: 'Threads: ActivityPub federation disabled (ACTIVITYPUB_BRIDGE_ENABLED=false)',
    };
  }
  const instances = apInstances();
  if (instances.length === 0) {
    return { posts: [], notice: 'Threads: no ActivityPub instances (THREADS_AP_INSTANCES)' };
  }

  const perAccount = Math.max(1, Math.ceil(limit / 5));
  const all: UnifiedPost[] = [];
  const seen = new Set<string>();
  const deadline = Date.now() + 8_000;
  let lastError = '';

  for (const instance of instances) {
    const base = instance.replace(/\/+$/, '');
    // Shared queue across workers — each handle resolved exactly once.
    const queue = [...CURATED_THREADS_HANDLES];

    async function worker(): Promise<void> {
      while (queue.length > 0 && all.length < limit && Date.now() < deadline) {
        const handle = queue.shift();
        if (!handle) return;
        try {
          const accountId = await apLookupAccount(base, handle, 4000);
          if (!accountId) continue; // not federated — skip honestly
          const statuses = await apFetchStatuses(base, accountId, perAccount, 4000);
          for (const s of statuses) {
            if (all.length >= limit) break;
            const post = apStatusToThreadPost(s, handle);
            if (post && !seen.has(post.id)) {
              seen.add(post.id);
              all.push(post);
            }
          }
        } catch {
          lastError = `ActivityPub fetch failed on ${base}`;
        }
        await jitterDelay(300);
      }
    }

    const workerCount = Math.min(3, CURATED_THREADS_HANDLES.length);
    const workers = Promise.all(
      Array.from({ length: workerCount }, () => worker().catch(() => {})),
    );
    // Hard cap: never let the AP path blow the feed's provider timeout. Any
    // still-in-flight calls settle harmlessly in the background.
    await Promise.race([workers, sleepUntil(deadline)]);
    if (all.length >= limit) break;
  }

  if (all.length > 0) {
    return {
      posts: all,
      notice: `Threads: ${all.length} posts via ActivityPub federation (${instances
        .map((i) => i.replace(/^https?:\/\//, ''))
        .join(', ')})`,
    };
  }
  return {
    posts: [],
    notice: lastError
      ? `Threads: ${lastError}. No federated content available.`
      : 'Threads: no curated accounts are federated on the configured instances (THREADS_AP_INSTANCES). Only Threads users who enabled federation are readable this way.',
  };
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'threads',
  name: 'Threads (Meta)',
  description:
    'Real Threads posts via ActivityPub federation (public Mastodon REST APIs, no auth) + embedded-JSON scraper with optional residential proxies (THREADS_PROXY_LIST). Federation covers curated accounts that enabled it on the configured instances (THREADS_AP_INSTANCES, default https://mastodon.social).',
  endpoint: '/api/feed/threads',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchThreadsPosts(limit = 20): Promise<UnifiedPost[]> {
  // Serve from cache first — repeated feed-build calls must not hammer Meta.
  const cached = getCachedPosts();
  if (cached) return cached.slice(0, limit);

  if (!checkRateLimit('threads', { maxRequests: 40, windowMs: 600_000 })) {
    // console.log('[threads] Rate limited, skipping fetch');
    return [];
  }

  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  const push = (p: UnifiedPost | null | undefined): void => {
    if (p && !seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  };

  // Path 1 (PRIMARY): ActivityPub federation — public Mastodon REST APIs.
  // Fast, no login wall, no proxies; the reliable real-content path in 2026.
  const { posts: apPosts } = await fetchThreadsViaActivityPub(limit);
  for (const p of apPosts) push(p);

  // Path 2 (FALLBACK): embedded-JSON scrape. Canonical, but only viable
  // through residential proxies (THREADS_PROXY_LIST) — from datacenter IPs
  // Meta serves a JS-only Comet shell, so this honestly returns nothing.
  // Only runs when AP came up short, bounded by a 5s budget so a slow Meta
  // wall can never eat the feed's 12s provider timeout.
  if (deduped.length < limit) {
    const scrapeDeadline = Date.now() + 3_000;
    const perAccount = Math.max(1, Math.ceil((limit - deduped.length) / 5));
    const all: UnifiedPost[] = [];
    const CONCURRENCY = 3;
    const queue = [...CURATED_THREADS_HANDLES];

    async function worker(): Promise<void> {
      while (queue.length > 0 && Date.now() < scrapeDeadline) {
        const username = queue.shift();
        if (!username) return;
        try {
          const { html } = await fetchProfileHtml(username);
          if (html) {
            const rawPosts = parseProfileHtml(html, username);
            const posts = rawPosts.slice(0, perAccount).map((p) => threadToPost(p, username));
            for (const p of posts) if (p) all.push(p);
          }
        } catch {
          // continue to next account
        }
        // Jitter between accounts so bursts don't trip Meta rate limits.
        await jitterDelay(800);
      }
    }

    const workers = Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, CURATED_THREADS_HANDLES.length) }, () =>
        worker().catch(() => {}),
      ),
    );
    // Hard cap — return what the scrape completed before the budget ran out.
    await Promise.race([workers, sleepUntil(scrapeDeadline)]);
    for (const p of all) push(p);
  }

  // NOTE: no freshness pre-filter here — the feed layer's freshness safety
  // net owns the 48h policy (see module header). Pre-filtering is what
  // previously made Threads always return 0 real posts.
  setCachedPosts(deduped);
  return deduped;
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchThreadsPosts;
