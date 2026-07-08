/**
 * @degenfeed/api-worker — Main router
 *
 * Dispatches requests to route handler modules.
 * Shared utilities (Env, rateLimit, jsonResponse, GTS config) are
 * re-exported for route module use.
 */

import {
  applyCors,
  corsHeaders,
  getAllowedOrigin,
  isAllowedOrigin,
  parseOriginHeader,
} from './cors';
import { handleAccountDelete, handleAccountExport } from './routes/account';
import { handleGtSAuthorize, handleGtSCallback, handleGtSRegister } from './routes/auth';
import { handleBillingCheckout, handleBillingStatus, handleBillingVerify } from './routes/billing';
import { handleBlinkTip } from './routes/blink';
import { handleCron } from './routes/cron';
import { handleNewsletterFeed, handleTopFeed } from './routes/curated';
import { handleDiscover } from './routes/discover';
import { handleEngage } from './routes/engage';
import {
  handleCategoryFeed,
  handleFeedHealth,
  handleHomeFeed,
  handleProviderFeed,
  handleRedditFeed,
  handleTrendingFeed,
} from './routes/feed';
import { handleFarcasterFeed } from './routes/farcaster-feed';
import { handleFundingFeed } from './routes/funding';
import { handleRelaysHealth } from './routes/health';
import { handleResolveIdentity } from './routes/identity';
import { handleLandingCss, handleLandingHtml, handleLandingJs } from './routes/landing';
import { handleNewsFeed } from './routes/news';
import {
  handleNewsletterDigest,
  handleNewsletterStatus,
  handleNewsletterSubscribe,
} from './routes/newsletter';
import { handleNotifications } from './routes/notifications';
import { handleNotify } from './routes/notify';
import { handlePostById } from './routes/post';
import { handlePreferences } from './routes/preferences';
import { handlePrices } from './routes/prices';
import { handleActivityPubFeed, handleThreadsFeed } from './routes/protocols';
import { handlePublish } from './routes/publish';
import {
  handleRmiHeadlines,
  handleRmiHealth,
  handleRmiNews,
  handleRmiSentiment,
  handleRmiSources,
  handleRmiStats,
} from './routes/rmi';
import { handleRssFeed } from './routes/rss';
import { handleRssXml } from './routes/rss-xml';
import { handleSearch, handleSearchIdentity } from './routes/search';
import {
  handleLightningInvoice,
  handleTipCreate,
  handleTipFrame,
  handleTipFrameCallback,
  handleTipFrameTx,
  handleTipResolve,
  handleTipSettingsGet,
  handleTipSettingsPost,
} from './routes/tip';
import { handleWalletNonce, handleWalletVerify } from './routes/wallet';
import { handleX402Paywall, handleX402Verify } from './routes/x402';
import {
  applySessionRefresh,
  handleSessionSignOut,
  handleSessionVerify,
  requireSession,
} from './session';

// ─── Environment variables ───────────────────────────────────────────

export interface Env {
  AUTH_SECRET?: string;
  CACHE?: KVNamespace;
  SUBSCRIPTIONS?: KVNamespace;
  GTS_CLIENT_ID?: string;
  GTS_CLIENT_SECRET?: string;
  GTS_INSTANCE_URL?: string;
  GTS_API_BASE?: string;
  GTS_REDIRECT_URI?: string;
  RELAY_URLS?: string;
  FARCASTER_HUB_URL?: string;
  LENS_API_URL?: string;
  BSKY_PUBLIC_URL?: string;
  BSKY_SOCIAL_URL?: string;
  THREADS_PDS_URL?: string;
  RATE_WINDOW_MS?: string;
  RATE_MAX_REQ?: string;
  /** When "true", disables in-process rate limiting (use only for local dev). */
  RATE_LIMIT_DISABLED?: string;
  /** Comma-separated list of allowed CORS origins for state-changing requests. */
  ALLOWED_ORIGINS?: string;
  SOLANA_RPC_URL?: string;
  /** Base URL of the rmi-backend (default: http://127.0.0.1:8000) */
  RMI_BACKEND_URL?: string;
  /** Optional bearer for rmi-backend if gated */
  RMI_API_KEY?: string;
  /** Optional Sentry DSN for error reporting */
  SENTRY_DSN?: string;
  /** Optional Postmark server token for transactional email delivery */
  POSTMARK_SERVER_TOKEN?: string;
}

// ─── Shared constants ────────────────────────────────────────────────

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
];
export const FARCASTER_HUBS = [
  'https://hub.farcaster.standardcrypto.vc:2281',
  'https://hub-grpc.pinata.cloud',
];
export const LENS_APIS = ['https://api.lens.xyz/graphql', 'https://api-v2.lens.dev/graphql'];
export const BSKY_PUBLIC = 'https://public.api.bsky.app';
export const BSKY_SOCIAL = 'https://bsky.social';
export const THREADS_PUBLIC = 'https://public.threads.net';

// ─── Rate limiting ───────────────────────────────────────────────────

const DEFAULT_RATE_WINDOW = 5000;
const DEFAULT_RATE_MAX = 20;

interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

/**
 * KV-backed fixed-window rate limiter.
 *
 * Cloudflare Workers can spin up many isolates per zone, so any in-memory
 * counter is unreliable. We use the CACHE KV namespace with a per-bucket
 * TTL equal to the window. Each bucket key = `${ip}:${path}:${windowMs/1000}`,
 * storing a JSON `{ count, resetAt }`. The bucket auto-expires after one
 * window so the counter resets.
 *
 * If `CACHE` is not bound (local dev), the function falls back to a
 * permissive "always allow" result and logs once — never blocks real users.
 */
export async function rateLimit(
  env: Env,
  ip: string,
  path: string,
  maxReq: number = DEFAULT_RATE_MAX,
  windowMs: number = DEFAULT_RATE_WINDOW,
): Promise<RateLimitResult> {
  if (env.RATE_LIMIT_DISABLED === 'true') {
    return { allowed: true, retryAfter: 0 };
  }
  if (!env.CACHE) {
    // No KV bound (local dev). Skip throttling so the dev experience works.
    return { allowed: true, retryAfter: 0 };
  }
  const bucketSec = Math.max(1, Math.ceil(windowMs / 1000));
  const key = `rl:${ip}:${path}:${bucketSec}`;
  const now = Date.now();
  const resetAt = now + windowMs;

  let count = 1;
  try {
    const raw = await env.CACHE.get(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { count: number; resetAt: number };
      if (parsed.resetAt > now) {
        count = parsed.count + 1;
      }
    }
    // TTL covers the window so the key expires automatically.
    await env.CACHE.put(key, JSON.stringify({ count, resetAt }), {
      expirationTtl: bucketSec,
    });
  } catch {
    // KV hiccup — fail open so a single KV outage doesn't break the API.
    return { allowed: true, retryAfter: 0 };
  }

  if (count > maxReq) {
    return { allowed: false, retryAfter: Math.max(0, resetAt - now) };
  }
  return { allowed: true, retryAfter: 0 };
}

// Rate limit cleanup inline in rateLimit() — avoids global setInterval (CF Workers restriction)

// ─── GotoSocial config ───────────────────────────────────────────────

export const GTS_AUTH_CONFIG = {
  clientId: '', // Must be set via GTS_CLIENT_ID env var
  clientSecret: '', // Must be set via GTS_CLIENT_SECRET env var
  instanceUrl: 'https://social.degenfeed.xyz',
  apiBase: 'https://social.degenfeed.xyz',
  redirectUri: 'https://degenfeed.xyz/auth/callback',
  scopes: 'read write follow push',
};

export function getGtsConfig(env: Env) {
  return {
    clientId: env.GTS_CLIENT_ID ?? GTS_AUTH_CONFIG.clientId,
    clientSecret: env.GTS_CLIENT_SECRET ?? GTS_AUTH_CONFIG.clientSecret,
    instanceUrl: env.GTS_INSTANCE_URL ?? GTS_AUTH_CONFIG.instanceUrl,
    apiBase: env.GTS_API_BASE ?? GTS_AUTH_CONFIG.apiBase,
    redirectUri: env.GTS_REDIRECT_URI ?? GTS_AUTH_CONFIG.redirectUri,
    scopes: GTS_AUTH_CONFIG.scopes,
  };
}

// ─── Response helper ─────────────────────────────────────────────────

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=30',
    },
  });
}

export function noCacheJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, must-revalidate',
    },
  });
}

// ─── CORS / CSRF helpers ─────────────────────────────────────────────

const CSRF_EXEMPT_PATHS = [
  // /api/auth/gotosocial/callback is now protected by a signed state nonce
  // (see routes/auth.ts) AND a normal origin check, so it's no longer exempt.
  '/api/tip/frame/',
  '/api/bridge/rss-to-nostr',
  '/api/blink/tip',
  '/api/x402/verify',
];

function isStateChanging(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'DELETE';
}

function isCsrfExempt(path: string): boolean {
  return CSRF_EXEMPT_PATHS.some((prefix) => path.startsWith(prefix));
}

function validateOrigin(request: Request, path: string, env: Env): boolean {
  if (isCsrfExempt(path)) return true;
  const origin = request.headers.get('origin');
  if (origin) return isAllowedOrigin(origin, env.ALLOWED_ORIGINS);
  const referer = request.headers.get('referer');
  if (referer) {
    const refererOrigin = parseOriginHeader(referer);
    return refererOrigin ? isAllowedOrigin(refererOrigin, env.ALLOWED_ORIGINS) : false;
  }
  return false;
}

// ─── Worker fetch handler ────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = getAllowedOrigin(request, env.ALLOWED_ORIGINS);

    // Helper: require session, run handler, attach refreshed cookie.
    const withSession = async (handler: () => Promise<Response>): Promise<Response> => {
      const session = await requireSession(request, env);
      if (session instanceof Response) return session;
      const resp = await handler();
      if (!env.AUTH_SECRET) return resp;
      return applySessionRefresh(resp, session, env.AUTH_SECRET);
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Rate limiting
    const ip =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for') ||
      'unknown';
    const maxReq = Number(env.RATE_MAX_REQ) || DEFAULT_RATE_MAX;
    const windowMs = Number(env.RATE_WINDOW_MS) || DEFAULT_RATE_WINDOW;
    const rl = await rateLimit(env, ip, path, maxReq, windowMs);
    if (!rl.allowed) {
      const response = new Response(
        JSON.stringify({ error: 'Rate limit', retryAfterMs: rl.retryAfter }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': String(Math.ceil(rl.retryAfter / 1000)),
          },
        },
      );
      return applyCors(response, origin);
    }

    // CSRF origin check for state-changing requests
    if (isStateChanging(request.method) && !validateOrigin(request, path, env)) {
      return applyCors(jsonResponse({ error: 'Forbidden' }, 403), origin);
    }

    let response: Response;

    try {
      // Landing page assets — served by the Worker to avoid the 301 loop
      // caused by the tunnel routing degenfeed.xyz to port 80 (which serves
      // a different app). Must be checked BEFORE the /api/* routes so
      // /styles.css and /app.js are not treated as API paths.
      if (path === '/styles.css') {
        response = handleLandingCss(request, env);
      } else if (path === '/app.js') {
        response = handleLandingJs(request, env);
      } else if (path === '/favicon.svg') {
        response = new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="6" fill="#000"/><path d="M8 8h16l-6 16H12L8 8Z" fill="#00ff41" stroke="#00ff41" stroke-width=".5"/><text x="16" y="21" text-anchor="middle" fill="#000" font-family="ui-monospace,monospace" font-size="10" font-weight="900">DF</text></svg>',
          { status: 200, headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=604800' } }
        );
      } else if (path === '/' || path === '/index.html' || path === '') {
        response = handleLandingHtml(request, env);
      } else if (path === '/api/health') {
        response = await handleRelaysHealth(env);
      } else if (path === '/api/feed/home') {
        response = await handleHomeFeed(request, env);
      } else if (path === '/api/feed/trending') {
        response = await handleTrendingFeed(request, env);
      } else if (path === '/api/feed/health') {
        response = await handleFeedHealth(request, env);
      } else if (path === '/api/feed/rss.xml' || path === '/api/feed/atom.xml') {
        response = await handleRssXml(request, env);
      } else if (path === '/api/feed/news') {
        response = await handleNewsFeed(request, env);
      } else if (path.startsWith('/api/feed/post/')) {
        const postId = path.replace('/api/feed/post/', '');
        response = await handlePostById(request, env, postId);
      } else if (path === '/api/feed/reddit') {
        response = await handleRedditFeed(request, env);
      } else if (path === '/api/feed/activitypub') {
        response = await handleActivityPubFeed(request, env);
      } else if (path === '/api/feed/threads') {
        response = await handleThreadsFeed(request, env);
      } else if (path === '/api/feed/farcaster') {
        response = await handleFarcasterFeed(request, env);
      } else if (path.startsWith('/api/feed/') && !path.startsWith('/api/feed/category/')) {
        const provider = path.replace('/api/feed/', '');
        response = await handleProviderFeed(request, env, provider);
      } else if (path.startsWith('/api/feed/category/')) {
        const category = path.replace('/api/feed/category/', '');
        response = await handleCategoryFeed(request, env, category);
      } else if (path === '/api/bridge/rss-to-nostr') {
        response = await withSession(async () => {
          const { handleRssToNostrBridge } = await import('./routes/publish');
          return handleRssToNostrBridge(request, env);
        });
      } else if (path === '/api/feed/rss') {
        response = await handleRssFeed(request, env);
      } else if (path === '/api/auth/signout') {
        response = await handleSessionSignOut(request, env);
      } else if (path === '/api/auth/gotosocial/authorize') {
        response = await handleGtSAuthorize(request, env);
      } else if (path === '/api/auth/gotosocial/callback') {
        response = await handleGtSCallback(request, env);
      } else if (path === '/api/auth/gotosocial/register') {
        response = await handleGtSRegister(request, env);
      } else if (path === '/api/auth/session') {
        response = await handleSessionVerify(request, env);
      } else if (path === '/api/account/export') {
        response = await handleAccountExport(request, env);
      } else if (path === '/api/account/delete') {
        response = await handleAccountDelete(request, env);
      } else if (path === '/api/publish') {
        response = await withSession(() => handlePublish(request, env));
      } else if (path === '/api/engage') {
        response = await withSession(() => handleEngage(request, env));
      } else if (path === '/api/feed/top') {
        response = await handleTopFeed(request, env);
      } else if (path === '/api/feed/newsletters') {
        response = await handleNewsletterFeed(request, env);
      } else if (path === '/api/prices') {
        response = await handlePrices(request, env);
      } else if (path === '/api/auth/wallet/nonce') {
        response = await handleWalletNonce(request, env);
      } else if (path === '/api/auth/wallet/verify') {
        response = await handleWalletVerify(request, env);
      } else if (path === '/api/tip/lightning/invoice') {
        response = await handleLightningInvoice(request, env);
      } else if (path.startsWith('/api/tip/frame/tx/')) {
        response = await handleTipFrameTx(request, env);
      } else if (path.startsWith('/api/tip/frame/callback/')) {
        response = await handleTipFrameCallback(request, env);
      } else if (path.startsWith('/api/tip/frame/')) {
        response = await handleTipFrame(request, env);
      } else if (path === '/api/tip/resolve') {
        response = await handleTipResolve(request, env);
      } else if (path === '/api/tip/create') {
        response = await withSession(() => handleTipCreate(request, env));
      } else if (path === '/api/tip/settings') {
        response = await withSession(async () => {
          if (request.method === 'GET') return handleTipSettingsGet(request, env);
          if (request.method === 'POST') return handleTipSettingsPost(request, env);
          return jsonResponse({ error: 'Method not allowed' }, 405);
        });
      } else if (path === '/api/feed/funding') {
        response = await handleFundingFeed(request, env);
      } else if (path === '/api/notifications') {
        response = await handleNotifications(request, env);
      } else if (path === '/api/identity/resolve') {
        response = await handleResolveIdentity(request, env);
      } else if (path === '/api/blink/tip') {
        response = await handleBlinkTip(request, env);
      } else if (path === '/api/billing/checkout') {
        response = await handleBillingCheckout(request, env);
      } else if (path === '/api/billing/verify') {
        response = await handleBillingVerify(request, env);
      } else if (path === '/api/billing/status') {
        response = await handleBillingStatus(request, env);
      } else if (path === '/api/preferences') {
        response = await handlePreferences(request, env);
      } else if (path === '/api/x402/paywall') {
        response = await handleX402Paywall(request, env);
      } else if (path === '/api/x402/verify') {
        response = await handleX402Verify(request, env);
      } else if (path === '/api/rmi/news/headlines') {
        response = await handleRmiHeadlines(request, env);
      } else if (path === '/api/rmi/news/sources') {
        response = await handleRmiSources(request, env);
      } else if (path === '/api/rmi/news/sentiment') {
        response = await handleRmiSentiment(request, env);
      } else if (path === '/api/rmi/news/stats') {
        response = await handleRmiStats(request, env);
      } else if (path === '/api/rmi/health') {
        response = await handleRmiHealth(request, env);
      } else if (path === '/api/rmi/news' || path.startsWith('/api/rmi/news/')) {
        response = await handleRmiNews(request, env);
      } else if (path === '/api/notify') {
        response = await handleNotify(request, env);
      } else if (path === '/api/discover') {
        response = await handleDiscover(request, env);
      } else if (path === '/api/newsletter/subscribe') {
        response = await handleNewsletterSubscribe(request, env);
      } else if (path === '/api/newsletter/status') {
        response = await handleNewsletterStatus(request, env);
      } else if (path === '/api/newsletter/digest' || path.startsWith('/api/newsletter/digest')) {
        response = await handleNewsletterDigest(request, env);
      } else if (path === '/api/search/identity') {
        response = await handleSearchIdentity(request, env);
      } else if (path === '/api/search') {
        response = await handleSearch(request, env);
      } else if (path === '/docs') {
        response = new Response(null, { status: 302, headers: { location: 'https://app.degenfeed.xyz/docs' } });
      } else if (
        ['/about', '/faq', '/legal', '/privacy', '/terms', '/acceptable-use',
         '/community-guidelines', '/premium', '/newsletter', '/status',
         '/discover', '/feed', '/news', '/home'].includes(path)
      ) {
        response = new Response(null, { status: 302, headers: { location: `https://app.degenfeed.xyz${path}` } });
      } else {
        response = jsonResponse({ status: 'ok', service: 'degenfeed-api', version: '0.2.0' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      response = jsonResponse({ error: message }, 500);
    }

    return applyCors(response, origin);
  },
  async scheduled(
    _controller: { cron: string; scheduledTime: number; noRetry: () => void },
    env: Env,
  ): Promise<void> {
    await handleCron(env);
  },
};
