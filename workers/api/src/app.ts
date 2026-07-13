/**
 * @degenfeed/api-worker — Hono entry point
 *
 * Wraps the existing route handlers in a Hono app for runtime portability.
 * Keeps all handler signatures intact — Hono's c.req.raw returns a standard
 * Request, and handlers return Response, so no handler changes are needed.
 *
 * To deploy on Node.js/Deno/Bun instead of Cloudflare Workers, change
 * wrangler.toml "main" back to "src/index.ts" and run:
 *   npm run dev:node    # development
 *   npm run start:node  # production
 */

import { Hono } from 'hono';
import { applyCors, getAllowedOrigin, isAllowedOrigin, parseOriginHeader } from './cors';
import type { Env } from './index';
import { jsonResponse, rateLimit } from './index';
import { validateBodySize } from './sanitize';

// ─── Route handlers ──────────────────────────────────────────

import { handleAccountDelete, handleAccountExport } from './routes/account';
import {
  handleGtSAuthorize,
  handleGtSCallback,
  handleGtSRegister,
  handleRedditCallback,
  handleThreadsAuthorize,
  handleThreadsCallback,
  handleWarpcastAuthorize,
  handleWarpcastCallback,
} from './routes/auth';
import { handleBillingCheckout, handleBillingStatus, handleBillingVerify } from './routes/billing';
import { handleBlinkTip } from './routes/blink';
import { handleCommunities } from './routes/communities';
import { handleAltFeed, handleNewsletterFeed, handleTopFeed } from './routes/curated';
import { handleDiscover } from './routes/discover';
import { handleEmbedResolve } from './routes/embed';
import { handleEngage } from './routes/engage';
import { handleFarcasterFeed } from './routes/farcaster-feed';
import { handleFeatures } from './routes/features';
import {
  handleCategoryFeed,
  handleFeedHealth,
  handleHomeFeed,
  handleProviderFeed,
  handleRedditFeed,
  handleTrendingFeed,
} from './routes/feed';
import { handleFrameAction, handleFrameResolve } from './routes/frame';
import { handleFundingFeed } from './routes/funding';
import { handleRelaysHealth } from './routes/health';
import { handleResolveIdentity } from './routes/identity';
import { handleLandingCss, handleLandingHtml, handleLandingJs } from './routes/landing';
import { handleLinksPage } from './routes/links';
import { handleNewsFeed } from './routes/news';
import {
  handleNewsletterDigest,
  handleNewsletterStatus,
  handleNewsletterSubscribe,
} from './routes/newsletter';
import { handleNotifications } from './routes/notifications';
import { handleNotify } from './routes/notify';
import { handlePostOg } from './routes/og';
import { handleDiscoverPeople } from './routes/people';
import { handlePostById } from './routes/post';
import { handlePreferences } from './routes/preferences';
import { handleFeedPresets } from './routes/presets';
import { handlePrices } from './routes/prices';
import { handleIdentityProfile } from './routes/profile';
import { handleActivityPubFeed, handleThreadsFeed } from './routes/protocols';
import { handlePublish } from './routes/publish';
import { handlePushSend, handlePushSubscribe } from './routes/push';
import { handleRelatedPosts } from './routes/related';
import { handlePostReplies } from './routes/replies';
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
import { handleSearch, handleSearchIdentity, handleSearchIndex } from './routes/search';
import { handleStreamFeed } from './routes/stream';
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

// ─── App ────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

// ─── Constants ──────────────────────────────────────────────

const CSRF_EXEMPT_PATHS = ['/api/tip/frame/', '/api/blink/tip', '/api/x402/verify'];
const MAX_BODY_BYTES = 1_048_576;
const DEFAULT_RATE_WINDOW = 5000;
const DEFAULT_RATE_MAX = 20;

const STATIC_REDIRECTS: Record<string, string> = {
  '/docs': 'https://app.degenfeed.xyz/docs',
  '/about': 'https://app.degenfeed.xyz/about',
  '/faq': 'https://app.degenfeed.xyz/faq',
  '/legal': 'https://app.degenfeed.xyz/legal',
  '/privacy': 'https://app.degenfeed.xyz/privacy',
  '/terms': 'https://app.degenfeed.xyz/terms',
  '/acceptable-use': 'https://app.degenfeed.xyz/acceptable-use',
  '/community-guidelines': 'https://app.degenfeed.xyz/community-guidelines',
  '/premium': 'https://app.degenfeed.xyz/premium',
  '/newsletter': 'https://app.degenfeed.xyz/newsletter',
  '/status': 'https://app.degenfeed.xyz/status',
  '/discover': 'https://app.degenfeed.xyz/discover',
  '/feed': 'https://app.degenfeed.xyz/feed',
  '/news': 'https://app.degenfeed.xyz/news',
  '/home': 'https://app.degenfeed.xyz/home',
};

// ─── Session helper ─────────────────────────────────────────

async function withSession(
  c: Parameters<typeof handlePublish>[0] extends Request ? any : never,
  handler: () => Promise<Response>,
): Promise<Response> {
  const { requireSession, applySessionRefresh } = await import('./session');
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const resp = await handler();
  if (c.env.AUTH_SECRET) return applySessionRefresh(resp, session, c.env.AUTH_SECRET);
  return resp;
}

// ─── Middleware: CORS post-response ──────────────────────────
// Registered first so it wraps every response with CORS headers.
app.use('*', async (c, next) => {
  await next();
  const origin = getAllowedOrigin(c.req.raw, c.env.ALLOWED_ORIGINS);
  if (c.res) c.res = applyCors(c.res, origin);
});

// ─── Middleware: OPTIONS preflight ───────────────────────────
// Short-circuits before body size, CSRF, rate limit, and route handlers.
app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  await next();
});

// ─── Middleware: body size + CSRF for state-changing requests ──
app.use('*', async (c, next) => {
  const method = c.req.method;
  if (!['POST', 'PUT', 'DELETE'].includes(method)) {
    return next();
  }
  const path = c.req.path;
  const sizeCheck = validateBodySize(c.req.raw, MAX_BODY_BYTES);
  if (!sizeCheck.ok) {
    return jsonResponse({ error: sizeCheck.error }, 413);
  }
  const isCsrfExempt = (p: string) => CSRF_EXEMPT_PATHS.some((prefix) => p.startsWith(prefix));
  if (!isCsrfExempt(path)) {
    const origin = c.req.header('origin');
    if (origin) {
      if (!isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS)) {
        return jsonResponse({ error: 'Forbidden' }, 403);
      }
    } else {
      const referer = c.req.header('referer');
      if (referer) {
        const refererOrigin = parseOriginHeader(referer);
        if (!refererOrigin || !isAllowedOrigin(refererOrigin, c.env.ALLOWED_ORIGINS)) {
          return jsonResponse({ error: 'Forbidden' }, 403);
        }
      } else {
        return jsonResponse({ error: 'Forbidden' }, 403);
      }
    }
  }
  await next();
});

// ─── Middleware: rate limiting ───────────────────────────────
app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const maxReq = Number(c.env.RATE_MAX_REQ) || DEFAULT_RATE_MAX;
  const windowMs = Number(c.env.RATE_WINDOW_MS) || DEFAULT_RATE_WINDOW;
  const rl = await rateLimit(c.env, ip, c.req.path, maxReq, windowMs);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit', retryAfterMs: rl.retryAfter }), {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': String(Math.ceil(rl.retryAfter / 1000)),
      },
    });
  }
  await next();
});

// ─── Landing pages / static assets ─────────────────────────

app.all('/styles.css', (c) => handleLandingCss(c.req.raw, c.env));
app.all('/links', (c) => handleLinksPage(c.req.raw, c.env));
app.all('/app.js', (c) => handleLandingJs(c.req.raw, c.env));
app.all(
  '/favicon.svg',
  (c) =>
    new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="6" fill="#000"/><path d="M8 8h16l-6 16H12L8 8Z" fill="#00ff41" stroke="#00ff41" stroke-width=".5"/><text x="16" y="21" text-anchor="middle" fill="#000" font-family="ui-monospace,monospace" font-size="10" font-weight="900">DF</text></svg>',
      {
        status: 200,
        headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=604800' },
      },
    ),
);
app.all('/', (c) => handleLandingHtml(c.req.raw, c.env));
app.all('/index.html', (c) => handleLandingHtml(c.req.raw, c.env));

// ─── API: Health ────────────────────────────────────────────
app.all('/api/health', async (c) => handleRelaysHealth(c.env));

// ─── API: Feed (specific routes before parameterized) ──────
app.all('/api/feed/home', async (c) => handleHomeFeed(c.req.raw, c.env, c.executionCtx));
app.all('/api/feed/trending', async (c) => handleTrendingFeed(c.req.raw, c.env, c.executionCtx));
app.all('/api/feed/health', async (c) => handleFeedHealth(c.req.raw, c.env));
app.all('/api/feed/rss.xml', async (c) => handleRssXml(c.req.raw, c.env));
app.all('/api/feed/atom.xml', async (c) => handleRssXml(c.req.raw, c.env));
app.all('/api/feed/news', async (c) => handleNewsFeed(c.req.raw, c.env));
app.all('/api/feed/reddit', async (c) => handleRedditFeed(c.req.raw, c.env));
app.all('/api/feed/activitypub', async (c) => handleActivityPubFeed(c.req.raw, c.env));
app.all('/api/feed/threads', async (c) => handleThreadsFeed(c.req.raw, c.env));
app.all('/api/feed/farcaster', async (c) => handleFarcasterFeed(c.req.raw, c.env));
app.all('/api/feed/rss', async (c) => handleRssFeed(c.req.raw, c.env));
app.all('/api/feed/post/:postId/replies', async (c) =>
  handlePostReplies(c.req.raw, c.env, c.req.param('postId')),
);
app.all('/api/feed/post/:postId', async (c) => {
  const postId = c.req.param('postId');
  if (c.req.query('format') === 'og') return handlePostOg(c.req.raw, c.env, postId);
  return handlePostById(c.req.raw, c.env, postId);
});
app.all('/api/feed/funding', async (c) => handleFundingFeed(c.req.raw, c.env));
app.all('/api/feed/top', async (c) => handleTopFeed(c.req.raw, c.env));
app.all('/api/feed/alt', async (c) => handleAltFeed(c.req.raw, c.env));
app.all('/api/feed/communities', async (c) => handleCommunities(c.req.raw, c.env));
app.all('/api/feed/newsletters', async (c) => handleNewsletterFeed(c.req.raw, c.env));
app.all('/api/feed/related', async (c) => handleRelatedPosts(c.req.raw, c.env));
app.all('/api/feed/presets', async (c) => handleFeedPresets(c.req.raw, c.env));
app.all('/api/feed/stream', async (c) => handleStreamFeed(c.req.raw, c.env));
app.all('/api/feed/category/:category', async (c) =>
  handleCategoryFeed(c.req.raw, c.env, c.req.param('category'), c.executionCtx),
);
// Feed provider catch-all — must be last /api/feed/* route
app.all('/api/feed/:provider', async (c) =>
  handleProviderFeed(c.req.raw, c.env, c.req.param('provider')),
);

// ─── API: Bridge ────────────────────────────────────────────
app.all('/api/bridge/rss-to-nostr', async (c) => {
  const { handleRssToNostrBridge } = await import('./routes/publish');
  return withSession(c, () => handleRssToNostrBridge(c.req.raw, c.env));
});

// ─── API: Auth ──────────────────────────────────────────────
app.all('/api/auth/signout', async (c) => {
  const { handleSessionSignOut } = await import('./session');
  return handleSessionSignOut(c.req.raw, c.env);
});
app.all('/api/auth/gotosocial/authorize', async (c) => handleGtSAuthorize(c.req.raw, c.env));
app.all('/api/auth/gotosocial/callback', async (c) => handleGtSCallback(c.req.raw, c.env));
app.all('/api/auth/gotosocial/register', async (c) => handleGtSRegister(c.req.raw, c.env));
app.all('/api/auth/threads/authorize', async (c) => handleThreadsAuthorize(c.req.raw, c.env));
app.all('/api/auth/threads/callback', async (c) => handleThreadsCallback(c.req.raw, c.env));
app.all('/api/auth/warpcast/authorize', async (c) => handleWarpcastAuthorize(c.req.raw, c.env));
app.all('/api/auth/warpcast/callback', async (c) => handleWarpcastCallback(c.req.raw, c.env));
app.all('/api/auth/reddit/callback', async (c) => handleRedditCallback(c.req.raw, c.env));
app.all('/api/auth/session', async (c) => {
  const { handleSessionVerify } = await import('./session');
  return handleSessionVerify(c.req.raw, c.env);
});
app.all('/api/auth/wallet/nonce', async (c) => handleWalletNonce(c.req.raw, c.env));
app.all('/api/auth/wallet/verify', async (c) => handleWalletVerify(c.req.raw, c.env));

// ─── API: Account ────────────────────────────────────────────
app.all('/api/account/export', async (c) => handleAccountExport(c.req.raw, c.env));
app.all('/api/account/delete', async (c) => handleAccountDelete(c.req.raw, c.env));

// ─── API: Publish & Engage (session-gated) ──────────────────
app.all('/api/publish', async (c) => withSession(c, () => handlePublish(c.req.raw, c.env)));
app.all('/api/engage', async (c) => withSession(c, () => handleEngage(c.req.raw, c.env)));

// ─── API: Tips ───────────────────────────────────────────────
app.all('/api/tip/lightning/invoice', async (c) => handleLightningInvoice(c.req.raw, c.env));
app.all('/api/tip/frame/tx/:id', async (c) => handleTipFrameTx(c.req.raw, c.env));
app.all('/api/tip/frame/callback/:id', async (c) => handleTipFrameCallback(c.req.raw, c.env));
app.all('/api/tip/frame/:id', async (c) => handleTipFrame(c.req.raw, c.env));
app.all('/api/tip/resolve', async (c) => handleTipResolve(c.req.raw, c.env));
app.all('/api/tip/create', async (c) => withSession(c, () => handleTipCreate(c.req.raw, c.env)));
app.all('/api/tip/settings', async (c) => {
  if (c.req.method === 'GET') return handleTipSettingsGet(c.req.raw, c.env);
  if (c.req.method === 'POST') return withSession(c, () => handleTipSettingsPost(c.req.raw, c.env));
  return jsonResponse({ error: 'Method not allowed' }, 405);
});

// ─── API: Notifications ──────────────────────────────────────
app.all('/api/notifications', async (c) => handleNotifications(c.req.raw, c.env));
app.all('/api/notify', async (c) => handleNotify(c.req.raw, c.env));

// ─── API: Identity ───────────────────────────────────────────
app.all('/api/identity/resolve', async (c) => handleResolveIdentity(c.req.raw, c.env));
app.all('/api/identity/profile', async (c) => handleIdentityProfile(c.req.raw, c.env));

// ─── API: Blink ─────────────────────────────────────────────
app.all('/api/blink/tip', async (c) => handleBlinkTip(c.req.raw, c.env));

// ─── API: Billing ────────────────────────────────────────────
app.all('/api/billing/checkout', async (c) => handleBillingCheckout(c.req.raw, c.env));
app.all('/api/billing/verify', async (c) => handleBillingVerify(c.req.raw, c.env));
app.all('/api/billing/status', async (c) => handleBillingStatus(c.req.raw, c.env));

// ─── API: Preferences ───────────────────────────────────────
app.all('/api/preferences', async (c) => handlePreferences(c.req.raw, c.env));

// ─── API: x402 ─────────────────────────────────────────────
app.all('/api/x402/paywall', async (c) => handleX402Paywall(c.req.raw, c.env));
app.all('/api/x402/verify', async (c) => handleX402Verify(c.req.raw, c.env));

// ─── API: RMI ──────────────────────────────────────────────
app.all('/api/rmi/news/headlines', async (c) => handleRmiHeadlines(c.req.raw, c.env));
app.all('/api/rmi/news/sources', async (c) => handleRmiSources(c.req.raw, c.env));
app.all('/api/rmi/news/sentiment', async (c) => handleRmiSentiment(c.req.raw, c.env));
app.all('/api/rmi/news/stats', async (c) => handleRmiStats(c.req.raw, c.env));
app.all('/api/rmi/health', async (c) => handleRmiHealth(c.req.raw, c.env));
app.all('/api/rmi/news', async (c) => handleRmiNews(c.req.raw, c.env));
app.all('/api/rmi/news/*', async (c) => handleRmiNews(c.req.raw, c.env));

// ─── API: Discover ─────────────────────────────────────────
app.all('/api/discover', async (c) => handleDiscover(c.req.raw, c.env));
app.all('/api/discover/people', async (c) => handleDiscoverPeople(c.req.raw, c.env));

// ─── API: Push ─────────────────────────────────────────────
app.all('/api/push/subscribe', async (c) => handlePushSubscribe(c.req.raw, c.env));
app.all('/api/push/send', async (c) => handlePushSend(c.req.raw, c.env));

// ─── API: Newsletter ───────────────────────────────────────
app.all('/api/newsletter/subscribe', async (c) => handleNewsletterSubscribe(c.req.raw, c.env));
app.all('/api/newsletter/status', async (c) => handleNewsletterStatus(c.req.raw, c.env));
app.all('/api/newsletter/digest', async (c) => handleNewsletterDigest(c.req.raw, c.env));
app.all('/api/newsletter/digest/*', async (c) => handleNewsletterDigest(c.req.raw, c.env));

// ─── API: Search ────────────────────────────────────────────
app.all('/api/search/identity', async (c) => handleSearchIdentity(c.req.raw, c.env));
app.all('/api/search/index', async (c) => handleSearchIndex(c.req.raw, c.env));
app.all('/api/search', async (c) => handleSearch(c.req.raw, c.env));

// ─── API: Embed ──────────────────────────────────────────────
app.all('/api/embed/resolve', async (c) => handleEmbedResolve(c.req.raw, c.env));

// ─── API: Frame ─────────────────────────────────────────────
app.all('/api/frame/resolve', async (c) => handleFrameResolve(c.req.raw, c.env));
app.all('/api/frame/action', async (c) => handleFrameAction(c.req.raw, c.env));

// ─── API: Features ─────────────────────────────────────────
app.all('/api/features', async (c) => handleFeatures(c.req.raw, c.env));

// ─── API: Prices ────────────────────────────────────────────
app.all('/api/prices', async (c) => handlePrices(c.req.raw, c.env));

// ─── Static redirects ──────────────────────────────────────
for (const [from, to] of Object.entries(STATIC_REDIRECTS)) {
  app.all(from, (c) => new Response(null, { status: 302, headers: { location: to } }));
}

// ─── Catch-all: return API info ─────────────────────────────
app.all('*', (c) => jsonResponse({ status: 'ok', service: 'degenfeed-api', version: '0.2.0' }));

// ─── Exports ─────────────────────────────────────────────────

export default app;
export { scheduled } from './index';
export { app };
