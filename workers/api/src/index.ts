/**
 * @degenfeed/api-worker — Main router
 *
 * Dispatches requests to route handler modules.
 * Shared utilities (Env, rateLimit, jsonResponse, GTS config) are
 * re-exported for route module use.
 */

import { handleRelaysHealth } from './routes/health';
import { handleHomeFeed } from './routes/feed';
import { handleActivityPubFeed, handleThreadsFeed } from './routes/protocols';
import { handleNewsFeed } from './routes/news';
import { handleRssFeed } from './routes/rss';
import { handleGtSAuthorize, handleGtSCallback, handleGtSRegister } from './routes/auth';
import { handleTipResolve, handleTipCreate, handleTipFrame, handleTipFrameTx, handleTipFrameCallback, handleLightningInvoice } from './routes/tip';
import { handlePublish, handleEngage } from './routes/publish';
import { handleFundingFeed } from './routes/funding';
import { handleNotifications } from './routes/notifications';
import { handleResolveIdentity } from './routes/identity';
import { handleTopFeed } from './routes/curated';
import { handleNewsletterFeed } from './routes/curated';
import { handleTrendingFeed } from './routes/feed';
import { handlePrices } from './routes/prices';
import { handleWalletNonce, handleWalletVerify } from './routes/wallet';
import type { Protocol } from '@degenfeed/types';

// ─── Environment variables ───────────────────────────────────────────

export interface Env {
  CACHE?: KVNamespace;
  GTS_CLIENT_ID?: string;
  GTS_CLIENT_SECRET?: string;
  GTS_INSTANCE_URL?: string;
  GTS_API_BASE?: string;
  GTS_REDIRECT_URI?: string;
  RELAY_URLS?: string;
  FARCASTER_HUB_URL?: string;
  LENS_API_URL?: string;
  BSKY_PUBLIC_URL?: string;
  THREADS_PDS_URL?: string;
  RATE_WINDOW_MS?: string;
  RATE_MAX_REQ?: string;
}

// ─── Shared constants ────────────────────────────────────────────────

export const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.nostr.band', 'wss://nostr.wine'];
export const FARCASTER_HUBS = ['https://hub.farcaster.standardcrypto.vc:2281', 'https://hub-grpc.pinata.cloud'];
export const LENS_APIS = ['https://api.lens.xyz/graphql', 'https://api-v2.lens.dev/graphql'];
export const BSKY_PUBLIC = 'https://public.api.bsky.app';
export const THREADS_PUBLIC = 'https://public.threads.net';

// ─── Rate limiting ───────────────────────────────────────────────────

const requestLog = new Map<string, { count: number; resetAt: number }>();
const DEFAULT_RATE_WINDOW = 5000;
const DEFAULT_RATE_MAX = 20;

export function rateLimit(ip: string, maxReq: number = DEFAULT_RATE_MAX, windowMs: number = DEFAULT_RATE_WINDOW): { allowed: boolean; retryAfter: number } {
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
  clientId: '',  // Must be set via GTS_CLIENT_ID env var
  clientSecret: '',  // Must be set via GTS_CLIENT_SECRET env var
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
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=30' },
  });
}

// ─── Worker fetch handler ────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Rate limiting
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    const maxReq = Number(env.RATE_MAX_REQ) || DEFAULT_RATE_MAX;
    const windowMs = Number(env.RATE_WINDOW_MS) || DEFAULT_RATE_WINDOW;
    const rl = rateLimit(ip, maxReq, windowMs);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit', retryAfterMs: rl.retryAfter }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': String(Math.ceil(rl.retryAfter / 1000)) },
      });
    }

    try {
      // Route dispatch — each handler is a separate module
      if (path === '/api/health') {
        return handleRelaysHealth(env);
      }
      if (path === '/api/feed/home') {
        return handleHomeFeed(request, env);
      }
      if (path === '/api/feed/trending') {
        return handleTrendingFeed(request, env);
      }
      if (path === '/api/feed/activitypub') {
        return handleActivityPubFeed(request, env);
      }
      if (path === '/api/feed/threads') {
        return handleThreadsFeed(request, env);
      }
      if (path === '/api/feed/news') {
        return handleNewsFeed(request, env);
      }
            if (path === '/api/bridge/rss-to-nostr') {
        const { handleRssToNostrBridge } = await import('./routes/publish');
        return handleRssToNostrBridge(request, env);
      }
      if (path === '/api/feed/rss') {
        return handleRssFeed(request, env);
      }
      if (path === '/api/auth/gotosocial/authorize') {
        return handleGtSAuthorize(request, env);
      }
      if (path === '/api/auth/gotosocial/callback') {
        return handleGtSCallback(request, env);
      }
      if (path === '/api/auth/gotosocial/register') {
        return handleGtSRegister(request, env);
      }
      if (path === '/api/publish') {
        return handlePublish(request, env);
      }
      if (path === '/api/engage') {
        return handleEngage(request, env);
      }
      if (path === '/api/feed/top') { return handleTopFeed(request, env); }
      if (path === '/api/feed/newsletters') { return handleNewsletterFeed(request, env); }
      if (path === '/api/feed/trending') { return handleTrendingFeed(request, env); }
      if (path === '/api/prices') { return handlePrices(request, env); }
      if (path === '/api/auth/wallet/nonce') { return handleWalletNonce(request, env); }
      if (path === '/api/auth/wallet/verify') { return handleWalletVerify(request, env); }
      if (path === '/api/tip/lightning/invoice') { return handleLightningInvoice(request, env); }
      if (path.startsWith('/api/tip/frame/tx/')) { return handleTipFrameTx(request, env); }
      if (path.startsWith('/api/tip/frame/callback/')) { return handleTipFrameCallback(request, env); }
      if (path.startsWith('/api/tip/frame/')) { return handleTipFrame(request, env); }
      if (path === '/api/tip/resolve') { return handleTipResolve(request, env); }
      if (path === '/api/tip/create') { return handleTipCreate(request, env); }
      if (path === '/api/feed/funding') { return handleFundingFeed(request, env); }
      if (path === '/api/notifications') { return handleNotifications(request, env); }
      if (path === '/api/identity/resolve') {
        return handleResolveIdentity(request, env);
      }

      return jsonResponse({ status: 'ok', service: 'degenfeed-api', version: '0.1.0' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      return jsonResponse({ error: message }, 500);
    }
  },
};
