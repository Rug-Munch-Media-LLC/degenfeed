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
import {
  apiKeyMiddleware,
  deleteApiKey,
  generateApiKey,
  storeApiKey,
  VALID_SCOPES,
} from './api-key';
import { applyCors, getAllowedOrigin, isAllowedOrigin, parseOriginHeader } from './cors';
import type { Env } from './index';
import { jsonResponse, rateLimit } from './index';
import { validateBodySize } from './sanitize';
import { parseSessionCookie, validateCsrfToken } from './session';

// ─── Error logger ────────────────────────────────────────────

import { logError } from './error-logger';
import { requireAdminFromSession } from './lib/admin-guard';

// ─── Route handlers ──────────────────────────────────────────

import { handleAccountDelete, handleAccountExport } from './routes/account';
import { handleAnalytics } from './routes/analytics';
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
import {
  handleBillingCancel,
  handleBillingCheckout,
  handleBillingMyStatus,
  handleBillingStatus,
  handleBillingSubscribe,
  handleBillingVerify,
} from './routes/billing';
import { handleBlinkTip } from './routes/blink';
import {
  handleBlueskyLeaderboard,
  handleBlueskyTipCreate,
  handleBlueskyTipStats,
} from './routes/bluesky-tip';
import { handleCommunities } from './routes/communities';
import {
  handleCommunitiesList,
  handleCommunityCreate,
  handleCommunityFeed,
  handleCommunityGet,
  handleCommunityJoin,
} from './routes/community';
import { handleContentResolve } from './routes/content';
import { handleCrossReply } from './routes/cross-reply';
import { handleAltFeed, handleNewsletterFeed, handleTopFeed } from './routes/curated';
import {
  handleCuratedFeed,
  handleEngagementFeedback,
  handleMarkSeen,
  handleScrollDepth,
} from './routes/curated-feed';
import {
  handleCustomFeedCreate,
  handleCustomFeedDelete,
  handleCustomFeedGet,
  handleCustomFeedList,
  handleCustomFeedPublic,
  handleCustomFeedSubscribe,
  handleCustomFeedUpdate,
} from './routes/custom-feed';
import {
  handleDigestStatus,
  handleDigestSubscribeEmail,
  handleDigestToday,
  handleDigestUnsubscribeEmail,
  handleDigestYesterday,
} from './routes/digest';
import {
  handleDiscover,
  handleDiscoverCommunities,
  handleDiscoverFeatured,
  handleDiscoverNew,
  handleDiscoverPeople,
  handleDiscoverTopics,
  handleDiscoverTrending,
} from './routes/discover';
import {
  handleEmailRegister,
  handleEmailSignIn,
  handleEmailStatus,
  handleEmailVerify,
  handlePasswordResetConfirm,
  handlePasswordResetRequest,
} from './routes/email-auth';
import { handleEmbedPost, handleEmbedResolve } from './routes/embed';
import { handleEngage } from './routes/engage';
import { handleFarcasterFeed } from './routes/farcaster-feed';
import {
  handleFarcasterCoinDeploy,
  handleFarcasterCoinGet,
  handleFarcasterCoinTip,
} from './routes/farcaster-coin';
import { handleFeatures } from './routes/features';
import {
  handleFeedCacheInvalidate,
  handleFeedHealth,
  handleHomeFeed,
  handleProviderFeed,
  handleRedditFeed,
  handleTrendingFeed,
} from './routes/feed';
import {
  handleCategoryMixFeed,
  handleCategorySlugFeed,
  handleEverythingFeed,
  handlePerProtocolCategoryFeed,
} from './routes/feed-category';
import { handleUnifiedFeed } from './routes/feed-unified';
import { handleVisualFeed, handleVisualForYou, handleVisualTrending } from './routes/visual-feed';
import {
  handleAdjustTopic,
  handleClearTopic,
  handleFeedback,
  handleForYouFeed,
  handleGetTopics,
  handleRecordDwell,
} from './routes/for-you';
import { handleFrameAction, handleFrameResolve } from './routes/frame';
import { handleFundingFeed } from './routes/funding';
import {
  handleAchievementCheck,
  handleAchievements,
  handleActivityRecord,
  handleChallengeProgress,
  handleChallengesToday,
  handleRecentActivity,
  handleSocialProof,
  handleStreakCheck,
  handleStreakLeaderboard,
  handleXp,
  handleXpAward,
} from './routes/gamification';
import {
  handleProposalCreate,
  handleProposalResults,
  handleProposalsList,
  handleProposalVote,
} from './routes/governance';
import { handleProtocolsHealth, handleRelaysHealth } from './routes/health';
import {
  handleGetIdentityProfile,
  handleLinkIdentity,
  handleResolveIdentity,
  handleUnlinkIdentity,
} from './routes/identity';
import {
  handleCreateAtproto,
  handleLinkAtproto,
  handleLinkTelegram,
  handleLinkZora,
  handleResolveDid,
  handleResolveWallet,
  handleResolveZora,
  handleStatus as handleIdentityExtensionsStatus,
} from './routes/identity-extensions';
import { handleLandingCss, handleLandingHtml, handleLandingJs } from './routes/landing';
import {
  handleLeaderboardCommunities,
  handleLeaderboardCreators,
  handleLeaderboardTippers,
  handleLeaderboardTrending,
  handleRefreshLeaderboards,
} from './routes/leaderboard';
import { handleLemmyDiscover } from './routes/lemmy-discover';
import {
  handleLensCoinDeploy,
  handleLensCoinGet,
  handleLensCoinTip,
} from './routes/lens-coin';
import {
  handleLemmyTipCreate,
  handleLemmyTipLeaderboard,
  handleLemmyTipStats,
} from './routes/lemmy-tip';
import { handleLinksPage } from './routes/links';
import {
  handleMastodonLeaderboard,
  handleMastodonTipCreate,
  handleMastodonTipStats,
} from './routes/mastodon-tip';
import {
  handleConversationMessages,
  handleConversations,
  handleDeleteMessage,
  handleSendMessage,
  handleUnreadCount,
} from './routes/messages';
import {
  handleBanUser,
  handleBlockSync,
  handleCheckBanned,
  handleListReports,
  handleModerationStats,
  handleRemovePost,
  handleResolveReport,
  handleSubmitReport,
} from './routes/moderation';
import { handleNewsFeed } from './routes/news';
import {
  handleNewsletterDigest,
  handleNewsletterStatus,
  handleNewsletterSubscribe,
} from './routes/newsletter';
import { handleMarkAllRead, handleNotifications } from './routes/notifications';
import { handleNotify } from './routes/notify';
import {
  handleDiscordAuthorize,
  handleDiscordCallback,
  handleGitHubAuthorize,
  handleGitHubCallback,
  handleGoogleAuthorize,
  handleGoogleCallback,
  handleRedditAuthorize,
  handleTelegramAuthorize,
  handleTelegramCallback,
  handleTwitterAuthorize,
  handleTwitterCallback,
} from './routes/oauth-providers';
import { handlePostOg } from './routes/og';
import {
  handlePeerTubeLeaderboard,
  handlePeerTubeTipCreate,
  handlePeerTubeTipStats,
} from './routes/peertube-tip';
import {
  handlePermanenceAnchor,
  handlePermanenceStore,
  handlePermanenceVerify,
} from './routes/permanence';
import { handlePostById } from './routes/post';
import { handlePreferences } from './routes/preferences';
import { handleFeedPresets } from './routes/presets';
import { handlePrices } from './routes/prices';
import { handleIdentityProfile } from './routes/profile';
import { handleProtocolSections } from './routes/protocol-sections';
import { handleActivityPubFeed, handleThreadsFeed } from './routes/protocols';
import { handlePublish } from './routes/publish';
import { handlePushSend, handlePushSubscribe } from './routes/push';
import {
  handleBlueskyPoolStats,
  handleRegisterPlatform,
  handleRegisterPlatformStatus,
} from './routes/register-platform';
import registerAll from './routes/register-all';
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
import { handleListScheduledPosts, handleSchedulePost } from './routes/scheduled';
import { handleSearch, handleSearchIdentity, handleSearchIndex } from './routes/search';
import { handleShortsFeed } from './routes/shorts';
import {
  handleSourcesApprove,
  handleSourcesDiscover,
  handleSourcesPending,
  handleSourcesReject,
} from './routes/source-discovery';
import {
  handleRecordEngagement,
  handleSourcesHealth,
  handleSourcesHealthCheck,
  handleSourcesNewThisWeek,
  handleSourcesStale,
  handleSourcesStats,
  handleSourcesTrending,
} from './routes/source-health';
import { handleStreamFeed } from './routes/stream';
import {
  handleSubscriptionCancel,
  handleSubscriptionConfirm,
  handleSubscriptionContentCheck,
  handleSubscriptionCreate,
  handleSubscriptionMy,
  handleSubscriptionStatus,
  handleSubscriptionSubscribe,
  handleSubscriptionTiers,
} from './routes/subscription';
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
import { handleTokenGateResolve, handleTokenGateVerify } from './routes/token-gate';
import tokenCommunity from './routes/token-community';
import peertubeStreams from './routes/peertube-streams';
import streams from './routes/streams';
import { handleTokenWebSocket, handleTokenSSE } from './routes/token-websocket';
import { handleTranslate } from './routes/translate';
import {
  handleUnifiedTipActivity,
  handleUnifiedTipCreate,
  handleUnifiedTipLeaderboard,
  handleUnifiedTipStats,
} from './routes/unified-tip';
import { handleWalletNonce, handleWalletVerify } from './routes/wallet';
import { handleX402Paywall, handleX402Verify } from './routes/x402';
import { creatorConfig } from './routes/creator-config';
import feddyCommunities from './routes/feddy-communities';
import { crossProtocolCoin } from './routes/cross-protocol-coin';

// ─── App ────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

// ─── Global onError handler ─────────────────────────────────
// Catches uncaught exceptions from any route handler so the API
// never returns an unhandled 500 without structured logging.
app.onError(async (err, c) => {
  const path = c.req.path;
  const method = c.req.method;
  const code = await logError(c.env, err, {
    route: path,
    method,
    statusCode: 500,
  });
  return new Response(
    JSON.stringify({
      error: 'Internal server error',
      code,
    }),
    {
      status: 500,
      headers: { 'content-type': 'application/json' },
    },
  );
});

// ─── Constants ──────────────────────────────────────────────

const CSRF_EXEMPT_PATHS = ['/api/tip/frame/', '/api/blink/tip', '/api/x402/verify'];
const CSRF_SKIP_PREFIXES = ['/api/auth/'];
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
  // biome-ignore lint/suspicious/noExplicitAny: conditional type gate — actual shape matches Hono Context
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
// Protects POST/PUT/PATCH/DELETE against cross-site request forgery via:
//   1. Origin / Referer header validation (same‑site check)
//   2. X‑CSRF‑Token header validation against a per‑session token stored in KV
// Skips GET/HEAD/OPTIONS (safe methods), /api/auth/* (auth flows use their
// own nonce‑based CSRF), and requests with Authorization: Bearer (API clients
// are already independently authenticated).
app.use('*', async (c, next) => {
  const method = c.req.method;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }
  const path = c.req.path;

  // Skip body size and CSRF for /api/auth/* — these use OAuth state nonces
  // which provide their own CSRF protection.
  const isAuthPath = CSRF_SKIP_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (isAuthPath) {
    // Still enforce body size limits for auth endpoints
    const sizeCheck = validateBodySize(c.req.raw, MAX_BODY_BYTES);
    if (!sizeCheck.ok) {
      return jsonResponse({ error: sizeCheck.error }, 413);
    }
    return next();
  }

  // Skip CSRF for API clients using Bearer tokens — already authenticated
  // via API key middleware (separate scoped keys, not session cookies).
  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const sizeCheck = validateBodySize(c.req.raw, MAX_BODY_BYTES);
    if (!sizeCheck.ok) {
      return jsonResponse({ error: sizeCheck.error }, 413);
    }
    return next();
  }

  const sizeCheck = validateBodySize(c.req.raw, MAX_BODY_BYTES);
  if (!sizeCheck.ok) {
    return jsonResponse({ error: sizeCheck.error }, 413);
  }

  // ── Origin / Referer validation ──────────────────────────────
  const isWebhookExempt = CSRF_EXEMPT_PATHS.some((prefix) => path.startsWith(prefix));
  if (!isWebhookExempt) {
    const origin = c.req.header('origin');
    if (origin) {
      if (!isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS)) {
        return jsonResponse({ error: 'CSRF validation failed', code: 'DF-403' }, 403);
      }
    } else {
      const referer = c.req.header('referer');
      if (referer) {
        const refererOrigin = parseOriginHeader(referer);
        if (!refererOrigin || !isAllowedOrigin(refererOrigin, c.env.ALLOWED_ORIGINS)) {
          return jsonResponse({ error: 'CSRF validation failed', code: 'DF-403' }, 403);
        }
      } else {
        return jsonResponse({ error: 'CSRF validation failed', code: 'DF-403' }, 403);
      }
    }
  }

  // ── X-CSRF-Token validation ──────────────────────────────────
  // Only applies to cookie‑authenticated sessions (not Bearer API keys).
  const cookieValue = parseSessionCookie(c.req.header('cookie') ?? null);
  if (cookieValue) {
    const csrfToken = c.req.header('x-csrf-token');
    const valid = await validateCsrfToken(cookieValue, csrfToken ?? null, c.env);
    if (!valid) {
      return jsonResponse({ error: 'CSRF validation failed', code: 'DF-403' }, 403);
    }
  }

  await next();
});

// ─── Middleware: API key authentication (v1 routes) ──────────
app.use('/v1/*', apiKeyMiddleware);

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

// ─── Middleware: Deprecation headers for legacy /api/ routes ──
// Legacy /api/* routes get deprecation headers encouraging migration to /v1/
app.use('/api/*', async (c, next) => {
  await next();
  if (c.res) {
    const headers = new Headers(c.res.headers);
    if (!headers.has('Deprecation')) {
      headers.set('Deprecation', 'true');
      headers.set('Sunset', 'Sat, 01 Nov 2026 00:00:00 GMT');
      headers.set('Link', '</v1/>; rel="successor-version"');
      c.res = new Response(c.res.body, {
        status: c.res.status,
        statusText: c.res.statusText,
        headers,
      });
    }
  }
});

// ─── Middleware: Admin wallet guard ─────────────────────────
// Protects all /api/admin/* routes — requires a valid session
// with a wallet in the ADMIN_WALLETS env var.
app.use('/api/admin/*', async (c, next) => {
  const result = await requireAdminFromSession(c.req.raw, c.env);
  if (result instanceof Response) return result;
  return next();
});

// ─── Landing pages / static assets ─────────────────────────

app.all('/styles.css', (c) => handleLandingCss(c.req.raw, c.env));
app.all('/links', (c) => handleLinksPage(c.req.raw, c.env));
app.all('/app.js', (c) => handleLandingJs(c.req.raw, c.env));
app.all(
  '/favicon.svg',
  (_c) =>
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
app.all('/api/health', async (c) => {
  // Base relay health
  const relayResp = await handleRelaysHealth(c.env);
  const relayBody = await relayResp.json();

  // Append error counts if available
  const { getErrorCounts } = await import('./error-logger');
  const errorCounts = await getErrorCounts(c.env);

  return jsonResponse({
    status: 'ok',
    service: 'degenfeed-api',
    relays: (relayBody as Record<string, unknown>).relays,
    healthy: (relayBody as Record<string, unknown>).healthy,
    errors: errorCounts
      ? {
          total: errorCounts.total,
          byRoute: errorCounts.byRoute,
          since: errorCounts.since,
        }
      : null,
    checkedAt: Date.now(),
  });
});
app.get('/api/health/protocols', async (c) => handleProtocolsHealth(c.env));

// ─── API: Analytics ─────────────────────────────────────────
app.get('/api/analytics', (c) => handleAnalytics(c.req.raw, c.env));

// ─── API: Shorts ─────────────────────────────────────────
app.get('/api/shorts', async (c) => handleShortsFeed(c.req.raw, c.env));

// ─── API: Feed (specific routes before parameterized) ──────
app.all('/api/feed/home', async (c) => handleHomeFeed(c.req.raw, c.env, c.executionCtx));
app.get('/api/feed/protocol-sections', async (c) => handleProtocolSections(c.req.raw, c.env));
app.all('/api/feed/for-you', async (c) => handleForYouFeed(c.req.raw, c.env, c.executionCtx));
app.post('/api/feed/dwell', async (c) => handleRecordDwell(c.req.raw, c.env));
app.post('/api/feed/feedback', async (c) => handleFeedback(c.req.raw, c.env));
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


app.all('/api/feed/curated', async (c) => handleCuratedFeed(c.req.raw, c.env, c.executionCtx));
app.all('/api/feed/scroll-depth', async (c) => handleScrollDepth(c.req.raw, c.env));
app.all('/api/feed/seen', async (c) => handleMarkSeen(c.req.raw, c.env));
app.all('/api/feed/engagement-feedback', async (c) => handleEngagementFeedback(c.req.raw, c.env));
app.all('/api/feed/category/:category', async (c) =>
  handleCategorySlugFeed(c.req.raw, c.env, c.req.param('category'), c.executionCtx),
);
app.all('/api/feed/mix', async (c) => handleCategoryMixFeed(c.req.raw, c.env, c.executionCtx));
app.all('/api/feed/everything', async (c) =>
  handleEverythingFeed(c.req.raw, c.env, c.executionCtx),
);
app.all('/api/feed/per-protocol/:protocol/:category', async (c) =>
  handlePerProtocolCategoryFeed(
    c.req.raw,
    c.env,
    c.req.param('protocol'),
    c.req.param('category'),
    c.executionCtx,
  ),
);
// Unified blended feed — interleaves all sources
app.all('/api/feed/unified', async (c) => handleUnifiedFeed(c.req.raw, c.env));
// Visual feed — masonry-grid media feed from Pixelfed, Zora, Bluesky, etc.
app.all('/api/feed/visual', async (c) => handleVisualFeed(c.req.raw, c.env));
app.all('/api/feed/visual/trending', async (c) => handleVisualTrending(c.req.raw, c.env));
app.all('/api/feed/visual/for-you', async (c) => handleVisualForYou(c.req.raw, c.env));
// Feed provider catch-all — must be last /api/feed/* route
app.all('/api/feed/:provider', async (c) =>
  handleProviderFeed(c.req.raw, c.env, c.req.param('provider')),
);

// ─── API: Bridge ────────────────────────────────────────────
app.all('/api/bridge/rss-to-nostr', async (c) => {
  const { handleRssToNostrBridge } = await import('./routes/publish');
  return withSession(c, () => handleRssToNostrBridge(c.req.raw, c.env));
});
// Public read-only bridge status (per-protocol reply counts) — no session needed
app.get('/api/cross-reply/status', async (c) => {
  const { handleCrossReplyStatus } = await import('./routes/cross-reply');
  return handleCrossReplyStatus(c.req.raw, c.env);
});
app.all('/api/cross-reply', async (c) => withSession(c, () => handleCrossReply(c.req.raw, c.env)));

// Unified cross-protocol thread view — public read-only
app.get('/api/thread/:dfUri', async (c) => {
  const { handleUnifiedThread } = await import('./routes/thread');
  return handleUnifiedThread(c.req.raw, c.env, c.req.param('dfUri'));
});

// ─── API: Cross-Protocol Bridge ──────────────────────────────
// Content wrapping, Zora bridge, edit sync, and bridge status
app.all('/api/cross-protocol-bridge/wrap', async (c) => {
  const { handleWrapContent } = await import('./routes/cross-protocol-bridge');
  return withSession(c, () => handleWrapContent(c.req.raw, c.env));
});
app.all('/api/cross-protocol-bridge/zora', async (c) => {
  const { handleZoraBridge } = await import('./routes/cross-protocol-bridge');
  return withSession(c, () => handleZoraBridge(c.req.raw, c.env));
});
app.all('/api/cross-protocol-bridge/sync', async (c) => {
  const { handleSyncEdit } = await import('./routes/cross-protocol-bridge');
  return withSession(c, () => handleSyncEdit(c.req.raw, c.env));
});
app.get('/api/cross-protocol-bridge/status', async (c) => {
  const { handleBridgeStatus } = await import('./routes/cross-protocol-bridge');
  return handleBridgeStatus(c.req.raw, c.env);
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
app.all('/api/auth/reddit/authorize', async (c) => handleRedditAuthorize(c.req.raw, c.env));
app.all('/api/auth/reddit/callback', async (c) => handleRedditCallback(c.req.raw, c.env));
app.all('/api/auth/google/authorize', async (c) => handleGoogleAuthorize(c.req.raw, c.env));
app.all('/api/auth/google/callback', async (c) => handleGoogleCallback(c.req.raw, c.env));
app.all('/api/auth/github/authorize', async (c) => handleGitHubAuthorize(c.req.raw, c.env));
app.all('/api/auth/github/callback', async (c) => handleGitHubCallback(c.req.raw, c.env));
app.all('/api/auth/discord/authorize', async (c) => handleDiscordAuthorize(c.req.raw, c.env));
app.all('/api/auth/discord/callback', async (c) => handleDiscordCallback(c.req.raw, c.env));
app.all('/api/auth/twitter/authorize', async (c) => handleTwitterAuthorize(c.req.raw, c.env));
app.all('/api/auth/twitter/callback', async (c) => handleTwitterCallback(c.req.raw, c.env));
app.all('/api/auth/telegram/authorize', async (c) => handleTelegramAuthorize(c.req.raw, c.env));
app.all('/api/auth/telegram/callback', async (c) => handleTelegramCallback(c.req.raw, c.env));
app.all('/api/auth/session', async (c) => {
  const { handleSessionVerify } = await import('./session');
  return handleSessionVerify(c.req.raw, c.env);
});
app.all('/api/auth/session/revoke', async (c) => {
  const { handleSessionRevoke } = await import('./session');
  return handleSessionRevoke(c.req.raw, c.env);
});
app.all('/api/auth/wallet/nonce', async (c) => handleWalletNonce(c.req.raw, c.env));
app.all('/api/auth/wallet/verify', async (c) => handleWalletVerify(c.req.raw, c.env));

// ─── API: Email Auth ───────────────────────────────────
app.all('/api/auth/email/register', async (c) => handleEmailRegister(c.req.raw, c.env));
app.all('/api/auth/email/signin', async (c) => handleEmailSignIn(c.req.raw, c.env));
app.all('/api/auth/email/verify', async (c) => handleEmailVerify(c.req.raw, c.env));
app.all('/api/auth/email/status', async (c) => handleEmailStatus(c.req.raw, c.env));
app.all('/api/auth/email/password-reset', async (c) =>
  handlePasswordResetRequest(c.req.raw, c.env),
);
app.all('/api/auth/email/password-reset/confirm', async (c) =>
  handlePasswordResetConfirm(c.req.raw, c.env),
);

// ─── API: Custom Feeds (session-gated) ──────────────────────
// Static routes before parameterized routes

app.post('/api/custom-feeds', async (c) =>
  withSession(c, () => handleCustomFeedCreate(c.req.raw, c.env)),
);
app.get('/api/custom-feeds', async (c) => handleCustomFeedList(c.req.raw, c.env));
app.get('/api/custom-feeds/public', async (c) => handleCustomFeedPublic(c.req.raw, c.env));
app.post('/api/custom-feeds/:id/subscribe', async (c) =>
  withSession(c, () => handleCustomFeedSubscribe(c.req.raw, c.env, c.req.param('id'))),
);
app.get('/api/custom-feeds/:id', async (c) =>
  handleCustomFeedGet(c.req.raw, c.env, c.req.param('id')),
);
app.put('/api/custom-feeds/:id', async (c) =>
  withSession(c, () => handleCustomFeedUpdate(c.req.raw, c.env, c.req.param('id'))),
);
app.delete('/api/custom-feeds/:id', async (c) =>
  withSession(c, () => handleCustomFeedDelete(c.req.raw, c.env, c.req.param('id'))),
);

// ─── API: Bookmarks (session-gated) ─────────────────────────
import {
  handleBookmarkAdd,
  handleBookmarkCheck,
  handleBookmarkList,
  handleBookmarkRemove,
} from './routes/bookmarks';
import {
  handleFollowAdd,
  handleFollowCheck,
  handleFollowingFeed,
  handleFollowList,
  handleFollowRemove,
} from './routes/follow';

app.get('/api/bookmarks', async (c) => handleBookmarkList(c.req.raw, c.env));
app.post('/api/bookmarks', async (c) => withSession(c, () => handleBookmarkAdd(c.req.raw, c.env)));
app.delete('/api/bookmarks', async (c) =>
  withSession(c, () => handleBookmarkRemove(c.req.raw, c.env)),
);
app.get('/api/bookmarks/check', async (c) => handleBookmarkCheck(c.req.raw, c.env));

// ─── API: Follow (protocol-native follow/unfollow) ─────────
app.post('/api/follow', async (c) => withSession(c, () => handleFollowAdd(c.req.raw, c.env)));
app.delete('/api/follow', async (c) => withSession(c, () => handleFollowRemove(c.req.raw, c.env)));
app.get('/api/follow/list', async (c) => handleFollowList(c.req.raw, c.env));
app.get('/api/follow/check', async (c) => handleFollowCheck(c.req.raw, c.env));
app.get('/api/follow/feed', async (c) => handleFollowingFeed(c.req.raw, c.env));

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

// ─── API: Unified Tips (cross-platform ledger) ───────────────
// Specific /api/tip/unified/* routes are registered before the generic
// /api/tip/* handlers above never overlap — kept together for clarity.
app.post('/api/tip/unified', async (c) =>
  withSession(c, () => handleUnifiedTipCreate(c.req.raw, c.env)),
);
app.get('/api/tip/unified/stats', async (c) => handleUnifiedTipStats(c.req.raw, c.env));
app.get('/api/tip/unified/leaderboard', async (c) => handleUnifiedTipLeaderboard(c.req.raw, c.env));
app.get('/api/tip/unified/activity', async (c) => handleUnifiedTipActivity(c.req.raw, c.env));

// ─── API: Lemmy Discover ─────────────────────────────────────
app.get('/api/lemmy/discover', async (c) => handleLemmyDiscover(c.req.raw, c.env));

// ─── API: Lemmy Tips ─────────────────────────────────────────
app.all('/api/lemmy/tip/leaderboard', async (c) => handleLemmyTipLeaderboard(c.req.raw, c.env));
app.all('/api/lemmy/tip/stats', async (c) => handleLemmyTipStats(c.req.raw, c.env));
app.all('/api/lemmy/tip', async (c) =>
  withSession(c, () => handleLemmyTipCreate(c.req.raw, c.env)),
);

// ─── API: PeerTube Tips ──────────────────────────────────────
app.post('/api/peertube/tip', async (c) =>
  withSession(c, () => handlePeerTubeTipCreate(c.req.raw, c.env)),
);
app.get('/api/peertube/tip/stats', async (c) => handlePeerTubeTipStats(c.req.raw, c.env));
app.get('/api/peertube/tip/leaderboard', async (c) => handlePeerTubeLeaderboard(c.req.raw, c.env));

// ─── API: Bluesky Tips ───────────────────────────────────────
app.post('/api/bluesky/tip', async (c) =>
  withSession(c, () => handleBlueskyTipCreate(c.req.raw, c.env)),
);
app.get('/api/bluesky/tip/stats', async (c) => handleBlueskyTipStats(c.req.raw, c.env));
app.get('/api/bluesky/tip/leaderboard', async (c) => handleBlueskyLeaderboard(c.req.raw, c.env));

// ─── API: Mastodon Tips ──────────────────────────────────────
app.post('/api/mastodon/tip', async (c) =>
  withSession(c, () => handleMastodonTipCreate(c.req.raw, c.env)),
);
app.get('/api/mastodon/tip/stats', async (c) => handleMastodonTipStats(c.req.raw, c.env));
app.get('/api/mastodon/tip/leaderboard', async (c) => handleMastodonLeaderboard(c.req.raw, c.env));

// ─── API: Farcaster Creator Coins ─────────────────────────────
app.post('/api/farcaster/coin/deploy', async (c) =>
  withSession(c, () => handleFarcasterCoinDeploy(c.req.raw, c.env)),
);
app.get('/api/farcaster/coin/:fid', async (c) => handleFarcasterCoinGet(c.req.raw, c.env));
app.post('/api/farcaster/coin/:fid/tip', async (c) =>
  withSession(c, () => handleFarcasterCoinTip(c.req.raw, c.env)),
);

// ─── API: Lens Protocol Creator Coins ─────────────────────────
app.post('/api/lens/coin/deploy', async (c) =>
  withSession(c, () => handleLensCoinDeploy(c.req.raw, c.env)),
);
app.get('/api/lens/coin/:profileId', async (c) => handleLensCoinGet(c.req.raw, c.env));
app.post('/api/lens/coin/:profileId/tip', async (c) =>
  withSession(c, () => handleLensCoinTip(c.req.raw, c.env)),
);

// ─── API: Cross-Protocol Creator Coins ─────────────────────────
// Any user from ANY protocol can launch a creator coin via /api/coin/launch
app.route('/api/coin', crossProtocolCoin);

// ─── API: Cross-Chain Tip Routing ─────────────────────────────
// Handles tips that originate on one chain/protocol and must be
// settled on another (e.g. Solana tip → Farcaster coin on Base)
app.post('/api/tip/cross-chain', async (c) => {
  const { handleCrossChainTip } = await import('./routes/unified-tip');
  return withSession(c, () => handleCrossChainTip(c.req.raw, c.env));
});

// ─── API: Notifications ──────────────────────────────────────
app.all('/api/notifications', async (c) => handleNotifications(c.req.raw, c.env));
app.post('/api/notifications/mark-all-read', async (c) => handleMarkAllRead(c.req.raw, c.env));
app.all('/api/notify', async (c) => handleNotify(c.req.raw, c.env));

// ─── API: Messages (DM) ─────────────────────────────────────
app.get('/api/messages/unread', async (c) => handleUnreadCount(c.req.raw, c.env));
app.get('/api/messages/conversations', async (c) => handleConversations(c.req.raw, c.env));
app.post('/api/messages/send', async (c) =>
  withSession(c, () => handleSendMessage(c.req.raw, c.env)),
);
app.all('/api/messages/:id', async (c) => {
  if (c.req.method === 'GET') {
    return handleConversationMessages(c.req.raw, c.env, c.req.param('id'));
  }
  if (c.req.method === 'DELETE') {
    return handleDeleteMessage(c.req.raw, c.env, c.req.param('id'));
  }
  return jsonResponse({ error: 'Method not allowed' }, 405);
});

// ─── API: Identity ───────────────────────────────────────────
app.all('/api/identity/resolve', async (c) => handleResolveIdentity(c.req.raw, c.env));
app.get('/api/identity/profile', async (c) => {
  // /api/identity/profile?wallet=0x... returns cross-protocol linked identities
  // /api/identity/profile?handle=... returns resolved identity profile (legacy)
  const wallet = c.req.query('wallet');
  if (wallet) return handleGetIdentityProfile(c.req.raw, c.env);
  return handleIdentityProfile(c.req.raw, c.env);
});
app.post('/api/identity/link', async (c) =>
  withSession(c, () => handleLinkIdentity(c.req.raw, c.env)),
);
app.delete('/api/identity/link', async (c) =>
  withSession(c, () => handleUnlinkIdentity(c.req.raw, c.env)),
);

// ─── API: Identity Extensions (AT Protocol, Zora, Telegram) ──
app.post('/api/identity/extensions/link/atproto', async (c) =>
  withSession(c, () => handleLinkAtproto(c.req.raw, c.env)),
);
app.post('/api/identity/extensions/create/atproto', async (c) =>
  withSession(c, () => handleCreateAtproto(c.req.raw, c.env)),
);
app.post('/api/identity/extensions/link/zora', async (c) =>
  withSession(c, () => handleLinkZora(c.req.raw, c.env)),
);
app.get('/api/identity/extensions/resolve/zora', async (c) =>
  handleResolveZora(c.req.raw, c.env),
);
app.post('/api/identity/extensions/link/telegram', async (c) =>
  withSession(c, () => handleLinkTelegram(c.req.raw, c.env)),
);
app.get('/api/identity/extensions/resolve/did', async (c) =>
  handleResolveDid(c.req.raw, c.env),
);
app.get('/api/identity/extensions/resolve/wallet', async (c) =>
  handleResolveWallet(c.req.raw, c.env),
);
app.get('/api/identity/extensions/status', async (c) =>
  handleIdentityExtensionsStatus(c.req.raw, c.env),
);

// ─── API: Blink ─────────────────────────────────────────────
app.all('/api/blink/tip', async (c) => handleBlinkTip(c.req.raw, c.env));

// ─── API: Billing ────────────────────────────────────────────
app.all('/api/billing/checkout', async (c) => handleBillingCheckout(c.req.raw, c.env));
app.all('/api/billing/verify', async (c) => handleBillingVerify(c.req.raw, c.env));
app.all('/api/billing/status', async (c) => handleBillingStatus(c.req.raw, c.env));
// Session-gated billing endpoints
app.post('/api/billing/subscribe', async (c) =>
  withSession(c, () => handleBillingSubscribe(c.req.raw, c.env)),
);
app.post('/api/billing/cancel', async (c) =>
  withSession(c, () => handleBillingCancel(c.req.raw, c.env)),
);
app.get('/api/billing/my-status', async (c) =>
  withSession(c, () => handleBillingMyStatus(c.req.raw, c.env)),
);

// ─── API: Subscription ──────────────────────────────────────
// Static routes before parameterized
app.all('/api/subscription/create', async (c) =>
  withSession(c, () => handleSubscriptionCreate(c.req.raw, c.env)),
);
app.all('/api/subscription/subscribe', async (c) =>
  withSession(c, () => handleSubscriptionSubscribe(c.req.raw, c.env)),
);
app.all('/api/subscription/confirm', async (c) =>
  withSession(c, () => handleSubscriptionConfirm(c.req.raw, c.env)),
);
app.all('/api/subscription/status', async (c) =>
  withSession(c, () => handleSubscriptionStatus(c.req.raw, c.env)),
);
app.all('/api/subscription/cancel', async (c) =>
  withSession(c, () => handleSubscriptionCancel(c.req.raw, c.env)),
);
app.all('/api/subscription/check-content', async (c) =>
  withSession(c, () => handleSubscriptionContentCheck(c.req.raw, c.env)),
);
// My subscriptions (must be before parameterized route)
app.all('/api/subscription/my', async (c) =>
  withSession(c, () => handleSubscriptionMy(c.req.raw, c.env)),
);
// Parameterized route last
app.all('/api/subscription/:creator', async (c) =>
  handleSubscriptionTiers(c.req.raw, c.env, c.req.param('creator')),
);

// ─── API: Preferences ───────────────────────────────────────
app.all('/api/preferences', async (c) => handlePreferences(c.req.raw, c.env));
app.get('/api/preferences/topics', async (c) => handleGetTopics(c.req.raw, c.env));
app.post('/api/preferences/topics', async (c) =>
  withSession(c, () => handleAdjustTopic(c.req.raw, c.env)),
);
app.post('/api/preferences/topics/clear', async (c) => handleClearTopic(c.req.raw, c.env));

// ─── API: x402 ─────────────────────────────────────────────
app.all('/api/x402/paywall', async (c) => handleX402Paywall(c.req.raw, c.env));
app.all('/api/x402/verify', async (c) => handleX402Verify(c.req.raw, c.env));

// ─── API: Token Gate ─────────────────────────────────────────
app.post('/api/token-gate/verify', async (c) => handleTokenGateVerify(c.req.raw, c.env));
app.post('/api/token-gate/resolve', async (c) => handleTokenGateResolve(c.req.raw, c.env));

// ─── API: Creator Config (vesting, fees, cross-chain) ───────
app.route('/api/creator', creatorConfig);

// ─── API: Token Community (engagement layer) ────────────────
app.route('/api/token', tokenCommunity);

// ─── API: PeerTube Livestreams (creator token streaming) ───
app.route('/api/token', peertubeStreams);

// ─── API: DegenFeed Multi-type Streaming (solo, spaces, collab, coin-launch) ───
app.route('/api/streams', streams);
app.route('/v1/streams', streams);

// ─── WebSocket: Token real-time updates ────────────────────
app.get('/ws/token/:address', async (c) => {
  // SSE fallback: check for text/event-stream Accept header
  const accept = c.req.header('accept');
  if (accept?.includes('text/event-stream')) {
    return handleTokenSSE(c.req.raw, c.env);
  }
  // WebSocket upgrade
  return handleTokenWebSocket(c.req.raw, c.env);
});

// ─── API: Cross-Platform Registration ──────────────────────
app.all('/api/register-platform', async (c) =>
  withSession(c, () => handleRegisterPlatform(c.req.raw, c.env)),
);
app.get('/api/register-platform/status', async (c) =>
  handleRegisterPlatformStatus(c.req.raw, c.env),
);
app.get('/api/register-platform/bluesky-pool', async (c) =>
  handleBlueskyPoolStats(c.req.raw, c.env),
);

// ─── API: Concierge Registration (register-all) ──────────────
app.route('/api/register', registerAll);
app.route('/api/feddy', feddyCommunities);

// ─── V1: Cross-Platform Registration ─────────────────────
app.post('/v1/register-platform', async (c) =>
  withSession(c, () => handleRegisterPlatform(c.req.raw, c.env)),
);
app.get('/v1/register-platform/status', async (c) =>
  handleRegisterPlatformStatus(c.req.raw, c.env),
);
app.get('/v1/register-platform/bluesky-pool', async (c) =>
  handleBlueskyPoolStats(c.req.raw, c.env),
);

// ─── V1: Concierge Registration (register-all) ────────────
app.route('/v1/register', registerAll);

// ─── API: Permanence (Arweave/IPFS) ───────────────────────
app.post('/api/permanence/store', async (c) =>
  withSession(c, () => handlePermanenceStore(c.req.raw, c.env)),
);
app.get('/api/permanence/verify/:hash', async (c) =>
  handlePermanenceVerify(c.req.raw, c.env, c.req.param('hash')),
);
app.post('/api/permanence/anchor', async (c) =>
  withSession(c, () => handlePermanenceAnchor(c.req.raw, c.env)),
);

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
app.get('/api/discover/trending', async (c) => handleDiscoverTrending(c.req.raw, c.env));
app.get('/api/discover/communities', async (c) => handleDiscoverCommunities(c.req.raw, c.env));
app.get('/api/discover/people', async (c) => handleDiscoverPeople(c.req.raw, c.env));
app.get('/api/discover/topics', async (c) => handleDiscoverTopics(c.req.raw, c.env));
app.get('/api/discover/featured', async (c) => handleDiscoverFeatured(c.req.raw, c.env));
app.get('/api/discover/new', async (c) => handleDiscoverNew(c.req.raw, c.env));

// ─── API: Push ─────────────────────────────────────────────
app.all('/api/push/subscribe', async (c) =>
  withSession(c, () => handlePushSubscribe(c.req.raw, c.env)),
);
app.all('/api/push/send', async (c) => handlePushSend(c.req.raw, c.env));

// ─── API: Newsletter ───────────────────────────────────────
app.all('/api/newsletter/subscribe', async (c) => handleNewsletterSubscribe(c.req.raw, c.env));
app.all('/api/newsletter/status', async (c) => handleNewsletterStatus(c.req.raw, c.env));
app.all('/api/newsletter/digest', async (c) => handleNewsletterDigest(c.req.raw, c.env));
app.all('/api/newsletter/digest/*', async (c) => handleNewsletterDigest(c.req.raw, c.env));

// ─── API: Digest (Daily) ───────────────────────────────────
app.all('/api/digest/today', async (c) => handleDigestToday(c.req.raw, c.env));
app.all('/api/digest/yesterday', async (c) => handleDigestYesterday(c.req.raw, c.env));
app.all('/api/digest/subscribe-email', async (c) => handleDigestSubscribeEmail(c.req.raw, c.env));
app.all('/api/digest/unsubscribe-email', async (c) =>
  handleDigestUnsubscribeEmail(c.req.raw, c.env),
);
app.all('/api/digest/status', async (c) => handleDigestStatus(c.req.raw, c.env));

// ─── API: Gamification (Streaks / Achievements / XP / Social Proof) ──
app.all('/api/gamification/streak', async (c) => handleStreakCheck(c.req.raw, c.env));
app.all('/api/gamification/streak/leaderboard', async (c) =>
  handleStreakLeaderboard(c.req.raw, c.env),
);
app.all('/api/gamification/achievements', async (c) => handleAchievements(c.req.raw, c.env));
app.all('/api/gamification/achievements/check', async (c) =>
  handleAchievementCheck(c.req.raw, c.env),
);
app.all('/api/gamification/challenges/today', async (c) => handleChallengesToday(c.req.raw, c.env));
app.all('/api/gamification/challenges/progress', async (c) =>
  handleChallengeProgress(c.req.raw, c.env),
);
app.all('/api/gamification/xp', async (c) => handleXp(c.req.raw, c.env));
app.all('/api/gamification/xp/award', async (c) => handleXpAward(c.req.raw, c.env));
app.all('/api/gamification/social-proof', async (c) => handleSocialProof(c.req.raw, c.env));
app.all('/api/gamification/activity', async (c) => handleActivityRecord(c.req.raw, c.env));
app.all('/api/gamification/activity/recent', async (c) => handleRecentActivity(c.req.raw, c.env));

// ─── API: Deploy ──────────────────────────────────────────
import { handleDeployRequest, handleDeployStatus } from './routes/deploy';

app.all('/api/deploy/request', async (c) => handleDeployRequest(c.req.raw, c.env));
app.all('/api/deploy/status', async (c) => handleDeployStatus(c.req.raw, c.env));

// ─── API: Trending Sidebar ──────────────────────────────────
import { handleTrendingSidebar } from './routes/trending-sidebar';

app.get('/api/trending/sidebar', async (c) => handleTrendingSidebar(c.req.raw, c.env));

// ─── API: Trending Scraper & Aggregation ────────────────────
import {
  handleTrendingAggregated,
  handleTrendingNow,
  handleTrendingPerPlatform,
} from './routes/trending';

app.get('/api/trending/aggregated', async (c) => handleTrendingAggregated(c.req.raw, c.env));
app.get('/api/trending/per-platform', async (c) => handleTrendingPerPlatform(c.req.raw, c.env));
app.get('/api/trending/now', async (c) => handleTrendingNow(c.req.raw, c.env));

// ─── API: Search ────────────────────────────────────────────
app.all('/api/search/identity', async (c) => handleSearchIdentity(c.req.raw, c.env));
app.all('/api/search/index', async (c) => handleSearchIndex(c.req.raw, c.env));
app.all('/api/search', async (c) => handleSearch(c.req.raw, c.env));

// ─── API: Content Resolution (df:// URIs) ───────────────────
app.all('/api/content/*', async (c) => handleContentResolve(c.req.raw, c.env));

// ─── API: Embed ──────────────────────────────────────────────
app.all('/api/embed/resolve', async (c) => handleEmbedResolve(c.req.raw, c.env));
app.all('/api/embed/*', async (c) => handleEmbedPost(c.req.raw, c.env));

// ─── API: Frame ─────────────────────────────────────────────
app.all('/api/frame/resolve', async (c) => handleFrameResolve(c.req.raw, c.env));
app.all('/api/frame/action', async (c) => handleFrameAction(c.req.raw, c.env));

// ─── API: Features ─────────────────────────────────────────
app.all('/api/features', async (c) => handleFeatures(c.req.raw, c.env));

// ─── API: Communities (cross-protocol) ──────────────────────
app.post('/api/community', async (c) =>
  withSession(c, () => handleCommunityCreate(c.req.raw, c.env)),
);
app.get('/api/community/:name', async (c) =>
  handleCommunityGet(c.req.raw, c.env, c.req.param('name')),
);
app.get('/api/community/:name/feed', async (c) =>
  handleCommunityFeed(c.req.raw, c.env, c.req.param('name')),
);
app.post('/api/community/:name/join', async (c) =>
  withSession(c, () => handleCommunityJoin(c.req.raw, c.env, c.req.param('name'))),
);
app.get('/api/communities', async (c) => handleCommunitiesList(c.req.raw, c.env));

// ─── API: Governance (DAOs) ───────────────────────────────
app.post('/api/community/:name/proposals', async (c) =>
  withSession(c, () => handleProposalCreate(c.req.raw, c.env, c.req.param('name'))),
);
app.get('/api/community/:name/proposals', async (c) =>
  handleProposalsList(c.req.raw, c.env, c.req.param('name')),
);
app.post('/api/community/:name/proposals/:id/vote', async (c) =>
  withSession(c, () =>
    handleProposalVote(c.req.raw, c.env, c.req.param('name'), c.req.param('id')),
  ),
);
app.get('/api/community/:name/proposals/:id/results', async (c) =>
  handleProposalResults(c.req.raw, c.env, c.req.param('name'), c.req.param('id')),
);

// ─── API: Moderation ───────────────────────────────────────
app.get('/api/moderation/reports', (c) => handleListReports(c.req.raw, c.env));
app.post('/api/moderation/report', (c) => handleSubmitReport(c.req.raw, c.env));
app.post('/api/moderation/reports/:id/resolve', async (c) => {
  const result = await requireAdminFromSession(c.req.raw, c.env);
  if (result instanceof Response) return result;
  return handleResolveReport(c.req.raw, c.env);
});
app.post('/api/moderation/reports/:id/remove', async (c) => {
  const result = await requireAdminFromSession(c.req.raw, c.env);
  if (result instanceof Response) return result;
  return handleRemovePost(c.req.raw, c.env);
});
app.post('/api/moderation/ban', async (c) => {
  const result = await requireAdminFromSession(c.req.raw, c.env);
  if (result instanceof Response) return result;
  return handleBanUser(c.req.raw, c.env);
});
app.get('/api/moderation/stats', (c) => handleModerationStats(c.req.raw, c.env));
app.get('/api/moderation/banned', (c) => handleCheckBanned(c.req.raw, c.env));
app.all('/api/moderation/sync', (c) => handleBlockSync(c.req.raw, c.env));

// ─── API: Schedule ─────────────────────────────────────────
app.all('/api/schedule', (c) => handleSchedulePost(c.req.raw, c.env));
app.get('/api/scheduled', (c) => handleListScheduledPosts(c.req.raw, c.env));

// ─── API: Audio Spaces ───────────────────────────────────────────
import {
  handleSpaceCreate,
  handleSpaceEnd,
  handleSpaceJoin,
  handleSpaceReact,
  handleSpaceRequestSpeak,
  handleSpacesLive,
  handleSpacesUpcoming,
} from './routes/spaces';

app.post('/api/spaces/create', async (c) => handleSpaceCreate(c.req.raw, c.env));
app.get('/api/spaces/live', async (c) => handleSpacesLive(c.req.raw, c.env));
app.get('/api/spaces/upcoming', async (c) => handleSpacesUpcoming(c.req.raw, c.env));
app.post('/api/spaces/:id/join', async (c) => handleSpaceJoin(c.req.raw, c.env, c.req.param('id')));
app.post('/api/spaces/:id/request-speak', async (c) =>
  handleSpaceRequestSpeak(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/spaces/:id/react', async (c) =>
  handleSpaceReact(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/spaces/:id/end', async (c) => handleSpaceEnd(c.req.raw, c.env, c.req.param('id')));

// ─── API: Translate ─────────────────────────────────────────
app.post('/api/translate', async (c) => handleTranslate(c.req.raw, c.env));

// ─── API: Prices ────────────────────────────────────────────
app.all('/api/prices', async (c) => handlePrices(c.req.raw, c.env));

// ─── API: Reputation ───────────────────────────────────────
import {
  handleReputationEarn,
  handleReputationGet,
  handleReputationHistory,
  handleReputationLeaderboard,
  handleReputationSlash,
  handleReputationStake,
  handleReputationStakeResolve,
  handleReputationStakes,
} from './routes/reputation';

app.get('/api/reputation/leaderboard', async (c) => handleReputationLeaderboard(c.req.raw, c.env));
app.post('/api/reputation/earn', async (c) => handleReputationEarn(c.req.raw, c.env));
app.post('/api/reputation/slash', async (c) => handleReputationSlash(c.req.raw, c.env));
app.post('/api/reputation/stake', async (c) => handleReputationStake(c.req.raw, c.env));
app.post('/api/reputation/stake/resolve', async (c) =>
  handleReputationStakeResolve(c.req.raw, c.env),
);
// Parameterized routes (must be after static routes)
app.get('/api/reputation/:userId/history', async (c) =>
  handleReputationHistory(c.req.raw, c.env, c.req.param('userId')),
);
app.get('/api/reputation/:userId/stakes', async (c) =>
  handleReputationStakes(c.req.raw, c.env, c.req.param('userId')),
);
app.get('/api/reputation/:userId', async (c) =>
  handleReputationGet(c.req.raw, c.env, c.req.param('userId')),
);

// ═══════════════════════════════════════════════════════════
// V1 ROUTES — Stable, versioned public API
// ═══════════════════════════════════════════════════════════

// ─── V1: Shorts ─────────────────────────────────────────
app.get('/v1/shorts', async (c) => handleShortsFeed(c.req.raw, c.env));

// ─── V1: Feed ───────────────────────────────────────────
app.all('/v1/feed/home', async (c) => handleHomeFeed(c.req.raw, c.env, c.executionCtx));
app.all('/v1/feed/trending', async (c) => handleTrendingFeed(c.req.raw, c.env, c.executionCtx));
app.all('/v1/feed/health', async (c) => handleFeedHealth(c.req.raw, c.env));
app.all('/v1/feed/news', async (c) => handleNewsFeed(c.req.raw, c.env));
app.all('/v1/feed/reddit', async (c) => handleRedditFeed(c.req.raw, c.env));
app.all('/v1/feed/activitypub', async (c) => handleActivityPubFeed(c.req.raw, c.env));
app.all('/v1/feed/threads', async (c) => handleThreadsFeed(c.req.raw, c.env));
app.all('/v1/feed/farcaster', async (c) => handleFarcasterFeed(c.req.raw, c.env));
app.all('/v1/feed/rss', async (c) => handleRssFeed(c.req.raw, c.env));
app.all('/v1/feed/post/:postId/replies', async (c) =>
  handlePostReplies(c.req.raw, c.env, c.req.param('postId')),
);
app.all('/v1/feed/post/:postId', async (c) => {
  const postId = c.req.param('postId');
  if (c.req.query('format') === 'og') return handlePostOg(c.req.raw, c.env, postId);
  return handlePostById(c.req.raw, c.env, postId);
});
app.all('/v1/feed/funding', async (c) => handleFundingFeed(c.req.raw, c.env));
app.all('/v1/feed/top', async (c) => handleTopFeed(c.req.raw, c.env));
app.all('/v1/feed/alt', async (c) => handleAltFeed(c.req.raw, c.env));
app.all('/v1/feed/communities', async (c) => handleCommunities(c.req.raw, c.env));
app.all('/v1/feed/newsletters', async (c) => handleNewsletterFeed(c.req.raw, c.env));
app.all('/v1/feed/related', async (c) => handleRelatedPosts(c.req.raw, c.env));
app.all('/v1/feed/presets', async (c) => handleFeedPresets(c.req.raw, c.env));
app.all('/v1/feed/stream', async (c) => handleStreamFeed(c.req.raw, c.env));
app.all('/v1/feed/curated', async (c) => handleCuratedFeed(c.req.raw, c.env, c.executionCtx));
app.all('/v1/feed/scroll-depth', async (c) => handleScrollDepth(c.req.raw, c.env));
app.all('/v1/feed/seen', async (c) => handleMarkSeen(c.req.raw, c.env));
app.all('/v1/feed/engagement-feedback', async (c) => handleEngagementFeedback(c.req.raw, c.env));
app.all('/v1/feed/category/:category', async (c) =>
  handleCategorySlugFeed(c.req.raw, c.env, c.req.param('category'), c.executionCtx),
);
app.all('/v1/feed/mix', async (c) => handleCategoryMixFeed(c.req.raw, c.env, c.executionCtx));
app.all('/v1/feed/everything', async (c) => handleEverythingFeed(c.req.raw, c.env, c.executionCtx));
app.all('/v1/feed/per-protocol/:protocol/:category', async (c) =>
  handlePerProtocolCategoryFeed(
    c.req.raw,
    c.env,
    c.req.param('protocol'),
    c.req.param('category'),
    c.executionCtx,
  ),
);
// V1 unified blended feed
app.all('/v1/feed/unified', async (c) => handleUnifiedFeed(c.req.raw, c.env));
app.all('/v1/feed/:provider', async (c) =>
  handleProviderFeed(c.req.raw, c.env, c.req.param('provider')),
);

// ─── V1: Search ─────────────────────────────────────────
app.all('/v1/search/identity', async (c) => handleSearchIdentity(c.req.raw, c.env));
app.all('/v1/search', async (c) => handleSearch(c.req.raw, c.env));

// ─── V1: Identity ───────────────────────────────────────
app.all('/v1/identity/resolve', async (c) => handleResolveIdentity(c.req.raw, c.env));
app.get('/v1/identity/profile', async (c) => {
  const wallet = c.req.query('wallet');
  if (wallet) return handleGetIdentityProfile(c.req.raw, c.env);
  return handleIdentityProfile(c.req.raw, c.env);
});
app.post('/v1/identity/link', async (c) =>
  withSession(c, () => handleLinkIdentity(c.req.raw, c.env)),
);
app.delete('/v1/identity/link', async (c) =>
  withSession(c, () => handleUnlinkIdentity(c.req.raw, c.env)),
);

// ─── V1: Tips ───────────────────────────────────────────
app.all('/v1/tip/lightning/invoice', async (c) => handleLightningInvoice(c.req.raw, c.env));
app.all('/v1/tip/frame/tx/:id', async (c) => handleTipFrameTx(c.req.raw, c.env));
app.all('/v1/tip/frame/callback/:id', async (c) => handleTipFrameCallback(c.req.raw, c.env));
app.all('/v1/tip/frame/:id', async (c) => handleTipFrame(c.req.raw, c.env));
app.all('/v1/tip/resolve', async (c) => handleTipResolve(c.req.raw, c.env));
app.all('/v1/tip/create', async (c) => withSession(c, () => handleTipCreate(c.req.raw, c.env)));
app.all('/v1/tip/settings', async (c) => {
  if (c.req.method === 'GET') return handleTipSettingsGet(c.req.raw, c.env);
  if (c.req.method === 'POST') return withSession(c, () => handleTipSettingsPost(c.req.raw, c.env));
  return jsonResponse({ error: 'Method not allowed' }, 405);
});

// ─── V1: Unified Tips ───────────────────────────────────
app.post('/v1/tip/unified', async (c) =>
  withSession(c, () => handleUnifiedTipCreate(c.req.raw, c.env)),
);
app.get('/v1/tip/unified/stats', async (c) => handleUnifiedTipStats(c.req.raw, c.env));
app.get('/v1/tip/unified/leaderboard', async (c) => handleUnifiedTipLeaderboard(c.req.raw, c.env));
app.get('/v1/tip/unified/activity', async (c) => handleUnifiedTipActivity(c.req.raw, c.env));

// ─── V1: Health ─────────────────────────────────────────
app.all('/v1/health', async (c) => {
  const relayResp = await handleRelaysHealth(c.env);
  const relayBody = await relayResp.json();
  const { getErrorCounts } = await import('./error-logger');
  const errorCounts = await getErrorCounts(c.env);
  return jsonResponse({
    status: 'ok',
    service: 'degenfeed-api',
    version: '1.0.0',
    relays: (relayBody as Record<string, unknown>).relays,
    healthy: (relayBody as Record<string, unknown>).healthy,
    errors: errorCounts
      ? { total: errorCounts.total, byRoute: errorCounts.byRoute, since: errorCounts.since }
      : null,
    checkedAt: Date.now(),
  });
});
app.get('/v1/health/protocols', async (c) => handleProtocolsHealth(c.env));

// ─── V1: Communities ────────────────────────────────────
app.post('/v1/community', async (c) =>
  withSession(c, () => handleCommunityCreate(c.req.raw, c.env)),
);
app.get('/v1/community/:name', async (c) =>
  handleCommunityGet(c.req.raw, c.env, c.req.param('name')),
);
app.get('/v1/community/:name/feed', async (c) =>
  handleCommunityFeed(c.req.raw, c.env, c.req.param('name')),
);
app.post('/v1/community/:name/join', async (c) =>
  withSession(c, () => handleCommunityJoin(c.req.raw, c.env, c.req.param('name'))),
);
app.get('/v1/communities', async (c) => handleCommunitiesList(c.req.raw, c.env));

// ─── V1: Governance ──────────────────────────────────────
app.post('/v1/community/:name/proposals', async (c) =>
  withSession(c, () => handleProposalCreate(c.req.raw, c.env, c.req.param('name'))),
);
app.get('/v1/community/:name/proposals', async (c) =>
  handleProposalsList(c.req.raw, c.env, c.req.param('name')),
);
app.post('/v1/community/:name/proposals/:id/vote', async (c) =>
  withSession(c, () =>
    handleProposalVote(c.req.raw, c.env, c.req.param('name'), c.req.param('id')),
  ),
);
app.get('/v1/community/:name/proposals/:id/results', async (c) =>
  handleProposalResults(c.req.raw, c.env, c.req.param('name'), c.req.param('id')),
);

// ─── V1: Content Resolution (df:// URIs) ───────────────
app.all('/v1/content/*', async (c) => handleContentResolve(c.req.raw, c.env));

// ─── V1: Leaderboard ────────────────────────────────────
app.get('/v1/leaderboard/creators', async (c) => handleLeaderboardCreators(c.req.raw, c.env));
app.get('/v1/leaderboard/tippers', async (c) => handleLeaderboardTippers(c.req.raw, c.env));
app.get('/v1/leaderboard/trending', async (c) => handleLeaderboardTrending(c.req.raw, c.env));
app.get('/v1/leaderboard/communities', async (c) => handleLeaderboardCommunities(c.req.raw, c.env));

// ─── V1: Status — protocol health ───────────────────────
app.all('/v1/status', async (_c) =>
  jsonResponse({ status: 'ok', service: 'degenfeed-api', version: '1.0.0' }),
);

// ─── V1: Publish & Engage (session-gated) ──────────────
app.all('/v1/publish', async (c) => withSession(c, () => handlePublish(c.req.raw, c.env)));
app.all('/v1/engage', async (c) => withSession(c, () => handleEngage(c.req.raw, c.env)));

// ─── V1: Other public endpoints ─────────────────────────
app.all('/v1/analytics', (c) => handleAnalytics(c.req.raw, c.env));
app.all('/v1/notifications', async (c) => handleNotifications(c.req.raw, c.env));
app.post('/v1/notifications/mark-all-read', async (c) => handleMarkAllRead(c.req.raw, c.env));
app.all('/v1/discover', async (c) => handleDiscover(c.req.raw, c.env));
app.all('/v1/discover/people', async (c) => handleDiscoverPeople(c.req.raw, c.env));
app.all('/v1/prices', async (c) => handlePrices(c.req.raw, c.env));
app.all('/v1/embed/resolve', async (c) => handleEmbedResolve(c.req.raw, c.env));
app.all('/v1/frame/resolve', async (c) => handleFrameResolve(c.req.raw, c.env));
app.all('/v1/frame/action', async (c) => handleFrameAction(c.req.raw, c.env));
app.all('/v1/features', async (c) => handleFeatures(c.req.raw, c.env));
app.all('/v1/notify', async (c) => handleNotify(c.req.raw, c.env));
app.all('/v1/push/subscribe', async (c) =>
  withSession(c, () => handlePushSubscribe(c.req.raw, c.env)),
);

// ─── V1: Newsletter ─────────────────────────────────────
app.all('/v1/newsletter/subscribe', async (c) => handleNewsletterSubscribe(c.req.raw, c.env));
app.all('/v1/newsletter/status', async (c) => handleNewsletterStatus(c.req.raw, c.env));
app.all('/v1/newsletter/digest', async (c) => handleNewsletterDigest(c.req.raw, c.env));

// ─── V1: Digest ──────────────────────────────────────────────
app.all('/v1/digest/today', async (c) => handleDigestToday(c.req.raw, c.env));
app.all('/v1/digest/yesterday', async (c) => handleDigestYesterday(c.req.raw, c.env));
app.all('/v1/digest/subscribe-email', async (c) => handleDigestSubscribeEmail(c.req.raw, c.env));
app.all('/v1/digest/unsubscribe-email', async (c) =>
  handleDigestUnsubscribeEmail(c.req.raw, c.env),
);

// ─── V1: API Key Management ────────────────────────────────

app.post('/v1/api-keys', async (c) => {
  const { requireSession } = await import('./session');
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  let body: { scopes?: string[]; label?: string };
  try {
    const text = await c.req.raw.text();
    body = JSON.parse(text);
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const scopes = body.scopes || ['read:feed'];
  const invalidScopes = scopes.filter((s: string) => !VALID_SCOPES.includes(s as never));
  if (invalidScopes.length > 0) {
    return jsonResponse({ error: `Invalid scopes: ${invalidScopes.join(', ')}` }, 400);
  }

  const userId = session.address || 'anon';
  const apiKey = generateApiKey();
  const record = await storeApiKey(c.env, apiKey, {
    userId,
    scopes,
    tier: 'free',
    label: body.label,
  });

  return jsonResponse(
    {
      key: apiKey,
      keyId: record.keyId,
      scopes: record.scopes,
      tier: record.tier,
      createdAt: record.createdAt,
      label: record.label,
    },
    201,
  );
});

app.get('/v1/api-keys', async (c) => {
  const { requireSession } = await import('./session');
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  return jsonResponse({ keys: [] });
});

app.delete('/v1/api-keys/:keyId', async (c) => {
  const { requireSession } = await import('./session');
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  let body: { key?: string };
  try {
    const text = await c.req.raw.text();
    body = JSON.parse(text);
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.key) {
    return jsonResponse({ error: 'API key required in body' }, 400);
  }

  await deleteApiKey(c.env, body.key);
  return jsonResponse({ success: true });
});

// ═══════════════════════════════════════════════════════════
// V1 ROUTES (continued) — Auth, Bookmarks, CustomFeeds, etc.
// ═══════════════════════════════════════════════════════════

// ─── V1: Auth ──────────────────────────────────────────────
app.all('/v1/auth/signout', async (c) => {
  const { handleSessionSignOut } = await import('./session');
  return handleSessionSignOut(c.req.raw, c.env);
});
app.all('/v1/auth/gotosocial/authorize', async (c) => handleGtSAuthorize(c.req.raw, c.env));
app.all('/v1/auth/gotosocial/callback', async (c) => handleGtSCallback(c.req.raw, c.env));
app.all('/v1/auth/gotosocial/register', async (c) => handleGtSRegister(c.req.raw, c.env));
app.all('/v1/auth/threads/authorize', async (c) => handleThreadsAuthorize(c.req.raw, c.env));
app.all('/v1/auth/threads/callback', async (c) => handleThreadsCallback(c.req.raw, c.env));
app.all('/v1/auth/warpcast/authorize', async (c) => handleWarpcastAuthorize(c.req.raw, c.env));
app.all('/v1/auth/warpcast/callback', async (c) => handleWarpcastCallback(c.req.raw, c.env));
app.all('/v1/auth/reddit/authorize', async (c) => handleRedditAuthorize(c.req.raw, c.env));
app.all('/v1/auth/reddit/callback', async (c) => handleRedditCallback(c.req.raw, c.env));
app.all('/v1/auth/google/authorize', async (c) => handleGoogleAuthorize(c.req.raw, c.env));
app.all('/v1/auth/google/callback', async (c) => handleGoogleCallback(c.req.raw, c.env));
app.all('/v1/auth/github/authorize', async (c) => handleGitHubAuthorize(c.req.raw, c.env));
app.all('/v1/auth/github/callback', async (c) => handleGitHubCallback(c.req.raw, c.env));
app.all('/v1/auth/discord/authorize', async (c) => handleDiscordAuthorize(c.req.raw, c.env));
app.all('/v1/auth/discord/callback', async (c) => handleDiscordCallback(c.req.raw, c.env));
app.all('/v1/auth/twitter/authorize', async (c) => handleTwitterAuthorize(c.req.raw, c.env));
app.all('/v1/auth/twitter/callback', async (c) => handleTwitterCallback(c.req.raw, c.env));
app.all('/v1/auth/telegram/authorize', async (c) => handleTelegramAuthorize(c.req.raw, c.env));
app.all('/v1/auth/telegram/callback', async (c) => handleTelegramCallback(c.req.raw, c.env));
app.all('/v1/auth/session', async (c) => {
  const { handleSessionVerify } = await import('./session');
  return handleSessionVerify(c.req.raw, c.env);
});
app.all('/v1/auth/session/revoke', async (c) => {
  const { handleSessionRevoke } = await import('./session');
  return handleSessionRevoke(c.req.raw, c.env);
});
app.all('/v1/auth/wallet/nonce', async (c) => handleWalletNonce(c.req.raw, c.env));
app.all('/v1/auth/wallet/verify', async (c) => handleWalletVerify(c.req.raw, c.env));

// ─── V1: Email Auth ───────────────────────────────────
app.all('/v1/auth/email/register', async (c) => handleEmailRegister(c.req.raw, c.env));
app.all('/v1/auth/email/signin', async (c) => handleEmailSignIn(c.req.raw, c.env));
app.all('/v1/auth/email/verify', async (c) => handleEmailVerify(c.req.raw, c.env));
app.all('/v1/auth/email/status', async (c) => handleEmailStatus(c.req.raw, c.env));
app.all('/v1/auth/email/password-reset', async (c) => handlePasswordResetRequest(c.req.raw, c.env));
app.all('/v1/auth/email/password-reset/confirm', async (c) =>
  handlePasswordResetConfirm(c.req.raw, c.env),
);

// ─── V1: Bookmarks ────────────────────────────────────────
app.get('/v1/bookmarks', async (c) => handleBookmarkList(c.req.raw, c.env));
app.post('/v1/bookmarks', async (c) => withSession(c, () => handleBookmarkAdd(c.req.raw, c.env)));
app.delete('/v1/bookmarks', async (c) =>
  withSession(c, () => handleBookmarkRemove(c.req.raw, c.env)),
);
app.get('/v1/bookmarks/check', async (c) => handleBookmarkCheck(c.req.raw, c.env));

// ─── V1: Follow ───────────────────────────────────────────
app.post('/v1/follow', async (c) => withSession(c, () => handleFollowAdd(c.req.raw, c.env)));
app.delete('/v1/follow', async (c) => withSession(c, () => handleFollowRemove(c.req.raw, c.env)));
app.get('/v1/follow/list', async (c) => handleFollowList(c.req.raw, c.env));
app.get('/v1/follow/check', async (c) => handleFollowCheck(c.req.raw, c.env));
app.get('/v1/follow/feed', async (c) => handleFollowingFeed(c.req.raw, c.env));

// ─── V1: Custom Feeds ─────────────────────────────────────
app.post('/v1/custom-feeds', async (c) =>
  withSession(c, () => handleCustomFeedCreate(c.req.raw, c.env)),
);
app.get('/v1/custom-feeds', async (c) => handleCustomFeedList(c.req.raw, c.env));
app.get('/v1/custom-feeds/public', async (c) => handleCustomFeedPublic(c.req.raw, c.env));
app.post('/v1/custom-feeds/:id/subscribe', async (c) =>
  withSession(c, () => handleCustomFeedSubscribe(c.req.raw, c.env, c.req.param('id'))),
);
app.get('/v1/custom-feeds/:id', async (c) =>
  handleCustomFeedGet(c.req.raw, c.env, c.req.param('id')),
);
app.put('/v1/custom-feeds/:id', async (c) =>
  withSession(c, () => handleCustomFeedUpdate(c.req.raw, c.env, c.req.param('id'))),
);
app.delete('/v1/custom-feeds/:id', async (c) =>
  withSession(c, () => handleCustomFeedDelete(c.req.raw, c.env, c.req.param('id'))),
);

// ─── V1: Subscription ─────────────────────────────────────
app.all('/v1/subscription/create', async (c) =>
  withSession(c, () => handleSubscriptionCreate(c.req.raw, c.env)),
);
app.all('/v1/subscription/subscribe', async (c) =>
  withSession(c, () => handleSubscriptionSubscribe(c.req.raw, c.env)),
);
app.all('/v1/subscription/confirm', async (c) =>
  withSession(c, () => handleSubscriptionConfirm(c.req.raw, c.env)),
);
app.all('/v1/subscription/status', async (c) =>
  withSession(c, () => handleSubscriptionStatus(c.req.raw, c.env)),
);
app.all('/v1/subscription/cancel', async (c) =>
  withSession(c, () => handleSubscriptionCancel(c.req.raw, c.env)),
);
app.all('/v1/subscription/check-content', async (c) =>
  withSession(c, () => handleSubscriptionContentCheck(c.req.raw, c.env)),
);
app.all('/v1/subscription/my', async (c) =>
  withSession(c, () => handleSubscriptionMy(c.req.raw, c.env)),
);
app.all('/v1/subscription/:creator', async (c) =>
  handleSubscriptionTiers(c.req.raw, c.env, c.req.param('creator')),
);

// ─── V1: Moderation ──────────────────────────────────────
app.get('/v1/moderation/reports', (c) => handleListReports(c.req.raw, c.env));
app.post('/v1/moderation/report', (c) => handleSubmitReport(c.req.raw, c.env));
app.post('/v1/moderation/reports/:id/resolve', (c) => handleResolveReport(c.req.raw, c.env));
app.post('/v1/moderation/reports/:id/remove', (c) => handleRemovePost(c.req.raw, c.env));
app.post('/v1/moderation/ban', (c) => handleBanUser(c.req.raw, c.env));
app.get('/v1/moderation/stats', (c) => handleModerationStats(c.req.raw, c.env));
app.get('/v1/moderation/banned', (c) => handleCheckBanned(c.req.raw, c.env));
app.all('/v1/moderation/sync', (c) => handleBlockSync(c.req.raw, c.env));

// ─── V1: Farcaster Creator Coins ─────────────────────────────
app.post('/v1/farcaster/coin/deploy', async (c) =>
  withSession(c, () => handleFarcasterCoinDeploy(c.req.raw, c.env)),
);
app.get('/v1/farcaster/coin/:fid', async (c) => handleFarcasterCoinGet(c.req.raw, c.env));
app.post('/v1/farcaster/coin/:fid/tip', async (c) =>
  withSession(c, () => handleFarcasterCoinTip(c.req.raw, c.env)),
);

// ─── V1: Lens Protocol Creator Coins ─────────────────────────
app.post('/v1/lens/coin/deploy', async (c) =>
  withSession(c, () => handleLensCoinDeploy(c.req.raw, c.env)),
);
app.get('/v1/lens/coin/:profileId', async (c) => handleLensCoinGet(c.req.raw, c.env));
app.post('/v1/lens/coin/:profileId/tip', async (c) =>
  withSession(c, () => handleLensCoinTip(c.req.raw, c.env)),
);

// ─── V1: Cross-Chain Tip Routing ─────────────────────────
app.post('/v1/tip/cross-chain', async (c) => {
  const { handleCrossChainTip } = await import('./routes/unified-tip');
  return withSession(c, () => handleCrossChainTip(c.req.raw, c.env));
});

// ─── V1: Lemmy Tips ──────────────────────────────────────
app.all('/v1/lemmy/tip/leaderboard', async (c) => handleLemmyTipLeaderboard(c.req.raw, c.env));
app.all('/v1/lemmy/tip/stats', async (c) => handleLemmyTipStats(c.req.raw, c.env));
app.all('/v1/lemmy/tip', async (c) => withSession(c, () => handleLemmyTipCreate(c.req.raw, c.env)));

// ─── V1: PeerTube Tips ────────────────────────────────────
app.post('/v1/peertube/tip', async (c) =>
  withSession(c, () => handlePeerTubeTipCreate(c.req.raw, c.env)),
);
app.get('/v1/peertube/tip/stats', async (c) => handlePeerTubeTipStats(c.req.raw, c.env));
app.get('/v1/peertube/tip/leaderboard', async (c) => handlePeerTubeLeaderboard(c.req.raw, c.env));

// ─── V1: Permanence (Arweave/IPFS) ──────────────────────
app.post('/v1/permanence/store', async (c) =>
  withSession(c, () => handlePermanenceStore(c.req.raw, c.env)),
);
app.get('/v1/permanence/verify/:hash', async (c) =>
  handlePermanenceVerify(c.req.raw, c.env, c.req.param('hash')),
);
app.post('/v1/permanence/anchor', async (c) =>
  withSession(c, () => handlePermanenceAnchor(c.req.raw, c.env)),
);

// ─── V1: Reputation ────────────────────────────────────────
app.get('/v1/reputation/leaderboard', async (c) => handleReputationLeaderboard(c.req.raw, c.env));
app.post('/v1/reputation/earn', async (c) => handleReputationEarn(c.req.raw, c.env));
app.post('/v1/reputation/slash', async (c) => handleReputationSlash(c.req.raw, c.env));
app.post('/v1/reputation/stake', async (c) => handleReputationStake(c.req.raw, c.env));
app.post('/v1/reputation/stake/resolve', async (c) =>
  handleReputationStakeResolve(c.req.raw, c.env),
);
app.get('/v1/reputation/:userId/history', async (c) =>
  handleReputationHistory(c.req.raw, c.env, c.req.param('userId')),
);
app.get('/v1/reputation/:userId/stakes', async (c) =>
  handleReputationStakes(c.req.raw, c.env, c.req.param('userId')),
);
app.get('/v1/reputation/:userId', async (c) =>
  handleReputationGet(c.req.raw, c.env, c.req.param('userId')),
);

// ─── V1: Audio Spaces ──────────────────────────────────────
app.post('/v1/spaces/create', async (c) => handleSpaceCreate(c.req.raw, c.env));
app.get('/v1/spaces/live', async (c) => handleSpacesLive(c.req.raw, c.env));
app.get('/v1/spaces/upcoming', async (c) => handleSpacesUpcoming(c.req.raw, c.env));
app.post('/v1/spaces/:id/join', async (c) => handleSpaceJoin(c.req.raw, c.env, c.req.param('id')));
app.post('/v1/spaces/:id/request-speak', async (c) =>
  handleSpaceRequestSpeak(c.req.raw, c.env, c.req.param('id')),
);
app.post('/v1/spaces/:id/react', async (c) =>
  handleSpaceReact(c.req.raw, c.env, c.req.param('id')),
);
app.post('/v1/spaces/:id/end', async (c) => handleSpaceEnd(c.req.raw, c.env, c.req.param('id')));

// ─── V1: Leaderboard refresh ──────────────────────────────
app.post('/v1/leaderboard/refresh', async (c) => handleRefreshLeaderboards(c.req.raw, c.env));

// ─── V1: Discover (full) ─────────────────────────────────
app.all('/v1/discover', async (c) => handleDiscover(c.req.raw, c.env));
app.get('/v1/discover/trending', async (c) => handleDiscoverTrending(c.req.raw, c.env));
app.get('/v1/discover/communities', async (c) => handleDiscoverCommunities(c.req.raw, c.env));
app.get('/v1/discover/people', async (c) => handleDiscoverPeople(c.req.raw, c.env));
app.get('/v1/discover/topics', async (c) => handleDiscoverTopics(c.req.raw, c.env));
app.get('/v1/discover/featured', async (c) => handleDiscoverFeatured(c.req.raw, c.env));
app.get('/v1/discover/new', async (c) => handleDiscoverNew(c.req.raw, c.env));

// ─── V1: Feed for-you + RSS/Atom ──────────────────────────
app.all('/v1/feed/for-you', async (c) => handleForYouFeed(c.req.raw, c.env, c.executionCtx));
app.all('/v1/feed/rss.xml', async (c) => handleRssXml(c.req.raw, c.env));
app.all('/v1/feed/atom.xml', async (c) => handleRssXml(c.req.raw, c.env));

// ─── V1: Messages (DM) ────────────────────────────────────
app.get('/v1/messages/unread', async (c) => handleUnreadCount(c.req.raw, c.env));
app.get('/v1/messages/conversations', async (c) => handleConversations(c.req.raw, c.env));
app.post('/v1/messages/send', async (c) =>
  withSession(c, () => handleSendMessage(c.req.raw, c.env)),
);
app.all('/v1/messages/:id', async (c) => {
  if (c.req.method === 'GET') {
    return handleConversationMessages(c.req.raw, c.env, c.req.param('id'));
  }
  if (c.req.method === 'DELETE') {
    return handleDeleteMessage(c.req.raw, c.env, c.req.param('id'));
  }
  return jsonResponse({ error: 'Method not allowed' }, 405);
});

// ─── V1: Source Discovery ──────────────────────────────────
app.get('/api/sources/discover', async (c) => handleSourcesDiscover(c.req.raw, c.env));
app.get('/api/sources/pending', async (c) => handleSourcesPending(c.req.raw, c.env));
app.post('/api/sources/approve', async (c) => handleSourcesApprove(c.req.raw, c.env));
app.post('/api/sources/reject', async (c) => handleSourcesReject(c.req.raw, c.env));
app.get('/api/sources/health', async (c) => handleSourcesHealth(c.req.raw, c.env));
app.get('/api/sources/trending', async (c) => handleSourcesTrending(c.req.raw, c.env));
app.get('/api/sources/stale', async (c) => handleSourcesStale(c.req.raw, c.env));
app.get('/api/sources/new-this-week', async (c) => handleSourcesNewThisWeek(c.req.raw, c.env));
app.get('/api/sources/stats', async (c) => handleSourcesStats(c.req.raw, c.env));
app.post('/api/sources/health-check', async (c) => handleSourcesHealthCheck(c.req.raw, c.env));
app.post('/api/sources/record-engagement', async (c) => handleRecordEngagement(c.req.raw, c.env));

// ─── V1: Additional endpoints ─────────────────────────────
app.all('/v1/translate', async (c) => handleTranslate(c.req.raw, c.env));
app.all('/v1/push/send', async (c) => handlePushSend(c.req.raw, c.env));
app.all('/v1/search/index', async (c) => handleSearchIndex(c.req.raw, c.env));
app.all('/v1/bridge/rss-to-nostr', async (c) => {
  const { handleRssToNostrBridge } = await import('./routes/publish');
  return withSession(c, () => handleRssToNostrBridge(c.req.raw, c.env));
});
app.get('/v1/cross-reply/status', async (c) => {
  const { handleCrossReplyStatus } = await import('./routes/cross-reply');
  return handleCrossReplyStatus(c.req.raw, c.env);
});
app.all('/v1/cross-reply', async (c) => withSession(c, () => handleCrossReply(c.req.raw, c.env)));
app.all('/v1/deploy/request', async (c) => handleDeployRequest(c.req.raw, c.env));
app.all('/v1/deploy/status', async (c) => handleDeployStatus(c.req.raw, c.env));
app.all('/v1/account/export', async (c) => handleAccountExport(c.req.raw, c.env));
app.all('/v1/account/delete', async (c) => handleAccountDelete(c.req.raw, c.env));
app.all('/v1/embed/*', async (c) => handleEmbedPost(c.req.raw, c.env));
app.get('/v1/thread/:dfUri', async (c) => {
  const { handleUnifiedThread } = await import('./routes/thread');
  return handleUnifiedThread(c.req.raw, c.env, c.req.param('dfUri'));
});
app.all('/v1/cross-protocol-bridge/wrap', async (c) => {
  const { handleWrapContent } = await import('./routes/cross-protocol-bridge');
  return withSession(c, () => handleWrapContent(c.req.raw, c.env));
});
app.all('/v1/cross-protocol-bridge/zora', async (c) => {
  const { handleZoraBridge } = await import('./routes/cross-protocol-bridge');
  return withSession(c, () => handleZoraBridge(c.req.raw, c.env));
});
app.all('/v1/cross-protocol-bridge/sync', async (c) => {
  const { handleSyncEdit } = await import('./routes/cross-protocol-bridge');
  return withSession(c, () => handleSyncEdit(c.req.raw, c.env));
});
app.get('/v1/cross-protocol-bridge/status', async (c) => {
  const { handleBridgeStatus } = await import('./routes/cross-protocol-bridge');
  return handleBridgeStatus(c.req.raw, c.env);
});
app.all('/v1/blink/tip', async (c) => handleBlinkTip(c.req.raw, c.env));
app.all('/v1/billing/checkout', async (c) => handleBillingCheckout(c.req.raw, c.env));
app.all('/v1/billing/verify', async (c) => handleBillingVerify(c.req.raw, c.env));
app.all('/v1/billing/status', async (c) => handleBillingStatus(c.req.raw, c.env));
app.post('/v1/billing/subscribe', async (c) =>
  withSession(c, () => handleBillingSubscribe(c.req.raw, c.env)),
);
app.post('/v1/billing/cancel', async (c) =>
  withSession(c, () => handleBillingCancel(c.req.raw, c.env)),
);
app.get('/v1/billing/my-status', async (c) =>
  withSession(c, () => handleBillingMyStatus(c.req.raw, c.env)),
);
app.all('/v1/x402/paywall', async (c) => handleX402Paywall(c.req.raw, c.env));
app.all('/v1/x402/verify', async (c) => handleX402Verify(c.req.raw, c.env));
app.post('/v1/token-gate/verify', async (c) => handleTokenGateVerify(c.req.raw, c.env));
app.post('/v1/token-gate/resolve', async (c) => handleTokenGateResolve(c.req.raw, c.env));
app.all('/v1/rmi/news/headlines', async (c) => handleRmiHeadlines(c.req.raw, c.env));
app.all('/v1/rmi/news/sources', async (c) => handleRmiSources(c.req.raw, c.env));
app.all('/v1/rmi/news/sentiment', async (c) => handleRmiSentiment(c.req.raw, c.env));
app.all('/v1/rmi/news/stats', async (c) => handleRmiStats(c.req.raw, c.env));
app.all('/v1/rmi/health', async (c) => handleRmiHealth(c.req.raw, c.env));
app.all('/v1/rmi/news', async (c) => handleRmiNews(c.req.raw, c.env));
app.all('/v1/preferences', async (c) => handlePreferences(c.req.raw, c.env));
app.get('/v1/preferences/topics', async (c) => handleGetTopics(c.req.raw, c.env));
app.post('/v1/preferences/topics', async (c) => handleAdjustTopic(c.req.raw, c.env));
app.post('/v1/preferences/topics/clear', async (c) => handleClearTopic(c.req.raw, c.env));
app.get('/v1/trending/sidebar', async (c) => handleTrendingSidebar(c.req.raw, c.env));
app.get('/v1/trending/aggregated', async (c) => handleTrendingAggregated(c.req.raw, c.env));
app.get('/v1/trending/per-platform', async (c) => handleTrendingPerPlatform(c.req.raw, c.env));
app.get('/v1/trending/now', async (c) => handleTrendingNow(c.req.raw, c.env));
app.all('/v1/schedule', (c) => handleSchedulePost(c.req.raw, c.env));

// ─── API: Leaderboard ────────────────────────────────────────
app.get('/api/leaderboard/creators', async (c) => handleLeaderboardCreators(c.req.raw, c.env));
app.get('/api/leaderboard/tippers', async (c) => handleLeaderboardTippers(c.req.raw, c.env));
app.get('/api/leaderboard/trending', async (c) => handleLeaderboardTrending(c.req.raw, c.env));
app.get('/api/leaderboard/communities', async (c) =>
  handleLeaderboardCommunities(c.req.raw, c.env),
);
app.post('/api/leaderboard/refresh', async (c) => handleRefreshLeaderboards(c.req.raw, c.env));

// ─── Static redirects ──────────────────────────────────────
for (const [from, to] of Object.entries(STATIC_REDIRECTS)) {
  app.all(from, (_c) => new Response(null, { status: 302, headers: { location: to } }));
}

// ─── Feed cache management ─────────────────────────────────
app.post('/api/feed/cache/invalidate', async (c) =>
  withSession(c, () => handleFeedCacheInvalidate(c.req.raw, c.env)),
);
app.post('/v1/feed/cache/invalidate', async (c) =>
  withSession(c, () => handleFeedCacheInvalidate(c.req.raw, c.env)),
);

// ─── Catch-all: return API info ─────────────────────────────
app.all('*', (c) => {
  if (c.req.path.startsWith('/v1/')) {
    return jsonResponse({ status: 'ok', service: 'degenfeed-api', version: '1.0.0' });
  }
  return jsonResponse({ status: 'ok', service: 'degenfeed-api', version: '0.2.0' });
});

// ─── Exports ─────────────────────────────────────────────────

export default app;
export { scheduled } from './index';
export { app };
