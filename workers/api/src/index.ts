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
import { handleGtSAuthorize, handleGtSCallback, handleGtSRegister } from './routes/auth';
import { handleBillingCheckout, handleBillingStatus, handleBillingVerify } from './routes/billing';
import { handleBlinkTip } from './routes/blink';
import { handleNewsletterFeed, handleTopFeed } from './routes/curated';
import { handleEngage } from './routes/engage';
import {
  handleCategoryFeed,
  handleFeedHealth,
  handleHomeFeed,
  handleProviderFeed,
  handleTrendingFeed,
} from './routes/feed';
import { handleFundingFeed } from './routes/funding';
import { handleRelaysHealth } from './routes/health';
import { handleResolveIdentity } from './routes/identity';
import { handleNewsFeed } from './routes/news';
import { handleNotifications } from './routes/notifications';
import { handlePrices } from './routes/prices';
import { handleActivityPubFeed, handleThreadsFeed } from './routes/protocols';
import { handlePublish } from './routes/publish';
import { handleRssFeed } from './routes/rss';
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
import { handleSessionVerify, requireSession } from './session';

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
  SOLANA_RPC_URL?: string;
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

const requestLog = new Map<string, { count: number; resetAt: number }>();
const DEFAULT_RATE_WINDOW = 5000;
const DEFAULT_RATE_MAX = 20;

export function rateLimit(
  ip: string,
  maxReq: number = DEFAULT_RATE_MAX,
  windowMs: number = DEFAULT_RATE_WINDOW,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  // Inline cleanup: purge expired entries
  if (requestLog.size > 10000) {
    for (const [key, entry] of requestLog) {
      if (now > entry.resetAt) requestLog.delete(key);
    }
  }
  const entry = requestLog.get(ip);
  if (!entry || now > entry.resetAt) {
    requestLog.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  entry.count++;
  if (entry.count > maxReq) {
    return { allowed: false, retryAfter: entry.resetAt - now };
  }
  return { allowed: true, retryAfter: 0 };
}

// Rate limit cleanup inline in rateLimit() — avoids global setInterval (CF Workers restriction)

// ─── GotoSocial config ───────────────────────────────────────────────

export const GTS_AUTH_CONFIG = {
  clientId: '', // Must be set via GTS_CLIENT_ID env var
  clientSecret: '', // Must be set via GTS_CLIENT_SECRET env var
  instanceUrl: 'https://social.degenfeed.xyz',
  apiBase: 'http://127.0.0.1:8082',
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

// ─── CORS / CSRF helpers ─────────────────────────────────────────────

const CSRF_EXEMPT_PATHS = [
  '/api/auth/gotosocial/callback',
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

function validateOrigin(request: Request, path: string): boolean {
  if (isCsrfExempt(path)) return true;
  const origin = request.headers.get('origin');
  if (origin) return isAllowedOrigin(origin);
  const referer = request.headers.get('referer');
  if (referer) {
    const refererOrigin = parseOriginHeader(referer);
    return refererOrigin ? isAllowedOrigin(refererOrigin) : false;
  }
  return false;
}

// ─── Worker fetch handler ────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = getAllowedOrigin(request);

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
    const rl = rateLimit(ip, maxReq, windowMs);
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
    if (isStateChanging(request.method) && !validateOrigin(request, path)) {
      return applyCors(jsonResponse({ error: 'Forbidden' }, 403), origin);
    }

    let response: Response;

    try {
      // Route dispatch — each handler is a separate module
      if (path === '/api/health') {
        response = await handleRelaysHealth(env);
      } else if (path === '/api/feed/home') {
        response = await handleHomeFeed(request, env);
      } else if (path === '/api/feed/trending') {
        response = await handleTrendingFeed(request, env);
      } else if (path === '/api/feed/health') {
        response = await handleFeedHealth(request, env);
      } else if (path.startsWith('/api/feed/') && !path.startsWith('/api/feed/category/')) {
        const provider = path.replace('/api/feed/', '');
        response = await handleProviderFeed(request, env, provider);
      } else if (path.startsWith('/api/feed/category/')) {
        const category = path.replace('/api/feed/category/', '');
        response = await handleCategoryFeed(request, env, category);
      } else if (path === '/api/feed/activitypub') {
        response = await handleActivityPubFeed(request, env);
      } else if (path === '/api/feed/threads') {
        response = await handleThreadsFeed(request, env);
      } else if (path === '/api/feed/news') {
        response = await handleNewsFeed(request, env);
      } else if (path === '/api/bridge/rss-to-nostr') {
        const { handleRssToNostrBridge } = await import('./routes/publish');
        response = await handleRssToNostrBridge(request, env);
      } else if (path === '/api/feed/rss') {
        response = await handleRssFeed(request, env);
      } else if (path === '/api/auth/gotosocial/authorize') {
        response = await handleGtSAuthorize(request, env);
      } else if (path === '/api/auth/gotosocial/callback') {
        response = await handleGtSCallback(request, env);
      } else if (path === '/api/auth/gotosocial/register') {
        response = await handleGtSRegister(request, env);
      } else if (path === '/api/auth/session') {
        response = await handleSessionVerify(request, env);
      } else if (path === '/api/publish') {
        const session = await requireSession(request, env);
        if (session instanceof Response) {
          response = session;
        } else {
          response = await handlePublish(request, env);
        }
      } else if (path === '/api/engage') {
        const session = await requireSession(request, env);
        if (session instanceof Response) {
          response = session;
        } else {
          response = await handleEngage(request, env);
        }
      } else if (path === '/api/feed/top') {
        response = await handleTopFeed(request, env);
      } else if (path === '/api/feed/newsletters') {
        response = await handleNewsletterFeed(request, env);
      } else if (path === '/api/feed/trending') {
        response = await handleTrendingFeed(request, env);
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
        const session = await requireSession(request, env);
        if (session instanceof Response) {
          response = session;
        } else {
          response = await handleTipCreate(request, env);
        }
      } else if (path === '/api/tip/settings') {
        const session = await requireSession(request, env);
        if (session instanceof Response) {
          response = session;
        } else if (request.method === 'GET') {
          response = await handleTipSettingsGet(request, env);
        } else if (request.method === 'POST') {
          response = await handleTipSettingsPost(request, env);
        } else {
          response = jsonResponse({ error: 'Method not allowed' }, 405);
        }
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
      } else if (path === '/api/x402/paywall') {
        response = await handleX402Paywall(request, env);
      } else if (path === '/api/x402/verify') {
        response = await handleX402Verify(request, env);
      } else {
        response = jsonResponse({ status: 'ok', service: 'degenfeed-api', version: '0.1.0' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      response = jsonResponse({ error: message }, 500);
    }

    return applyCors(response, origin);
  },
};
