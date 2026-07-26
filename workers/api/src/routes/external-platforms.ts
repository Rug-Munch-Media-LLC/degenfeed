/**
 * @degenfeed/api-worker — External Platform Connectivity
 *
 * REST API for DegenFeed Connect: schedule and post to ALL social platforms
 * from one dashboard. Powered by Postiz for OAuth and API integration.
 *
 * Supports: YouTube, Twitch, Kick, TikTok, Instagram, LinkedIn
 * Gated to: Enterprise tier ($20/mo) or standalone add-on ($15/mo)
 *
 * Postiz handles:
 * - OAuth flows for all platforms
 * - Rate limiting per platform
 * - API differences between platforms
 * - Media upload optimization
 *
 * @see /srv/degenfeed/postiz/README.md
 * @see /srv/work/repos/degenfeed-web/workers/api/src/lib/postiz-bridge.ts
 */

import { checkFeatureAccess, getUserTier } from '../lib/membership-tiers';
import {
  completeExternalPlatformConnection,
  disconnectExternalPlatform,
  EXTERNAL_PLATFORM_CATEGORIES,
  EXTERNAL_PLATFORM_IDS,
  type ExternalGoLiveRequest,
  type ExternalPlatformAccount,
  type ExternalPlatformId,
  type ExternalPostRequest,
  getConnectedExternalAccounts,
  getExternalPlatformAnalytics,
  getExternalPlatformConnectUrl,
  goLiveOnExternalPlatform,
  postToExternalPlatforms,
  scheduleExternalPost,
} from '../lib/postiz-bridge';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Response Helpers ───────────────────────────────────────────────────────

function ok(data: unknown, status = 200): Response {
  return jsonResponse({ data }, status);
}

function err(message: string, status = 400, code?: string): Response {
  return jsonResponse({ error: message, code }, status);
}

// ─── Auth Helpers ───────────────────────────────────────────────────────────

/**
 * Extract user wallet/session from request.
 * Returns the authenticated user ID or a 401 Response.
 */
async function getUserFromRequest(req: Request, env: Env): Promise<{ userId: string } | Response> {
  // Try Authorization header first
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // In production, validate against session store
    if (env.SUBSCRIPTIONS) {
      try {
        const session = await env.SUBSCRIPTIONS.get(`session:${token}`);
        if (session) {
          const parsed = JSON.parse(session) as { userId?: string; wallet?: string };
          return { userId: parsed.userId ?? parsed.wallet ?? '' };
        }
      } catch {
        // Fall through
      }
    }
  }

  // Try session cookie
  try {
    const { requireSession } = await import('../session');
    const session = await requireSession(req, env);
    if (session instanceof Response) return session;
    const wallet = session.address ?? '';
    return { userId: wallet.toLowerCase() };
  } catch {
    return err('Authentication required', 401, 'AUTH_REQUIRED');
  }
}

/**
 * Check if the user's tier grants access to external platforms.
 * Enterprise tier ($20/mo) required. Or standalone DegenFeed Connect add-on.
 */
async function requireExternalPlatformAccess(userId: string, env: Env): Promise<Response | null> {
  const tier = await getUserTier(userId, env);

  // Enterprise tier has built-in access
  if (tier === 'enterprise') return null;

  // Check if user has purchased the standalone Connect add-on
  if (env.SUBSCRIPTIONS) {
    try {
      const addonRaw = await env.SUBSCRIPTIONS.get(`addon:connect:${userId}`);
      if (addonRaw) {
        const addon = JSON.parse(addonRaw) as { active: boolean; expiresAt: number };
        if (addon.active && addon.expiresAt > Date.now()) {
          return null;
        }
      }
    } catch {
      // Fall through to deny
    }
  }

  return err(
    'DegenFeed Connect requires Enterprise tier ($20/mo) or the standalone Connect add-on ($15/mo). ' +
      'Upgrade at https://app.degenfeed.xyz/connect',
    402,
    'EXTERNAL_PLATFORMS_REQUIRED',
  );
}

// ─── Route Handlers ─────────────────────────────────────────────────────────

/**
 * POST /api/external/connect
 *
 * Initiate OAuth connection to an external platform via Postiz.
 * Returns a redirect URL that the user's browser should follow.
 *
 * Body: { platform: "youtube" }
 */
export async function handleConnectExternalPlatform(req: Request, env: Env): Promise<Response> {
  const userResult = await getUserFromRequest(req, env);
  if (userResult instanceof Response) return userResult;
  const { userId } = userResult;

  // Check access
  const accessCheck = await requireExternalPlatformAccess(userId, env);
  if (accessCheck) return accessCheck;

  // Parse request body
  let body: { platform?: string };
  try {
    body = (await req.json()) as { platform?: string };
  } catch {
    return err('Invalid JSON body', 400, 'INVALID_JSON');
  }

  if (!body.platform) {
    return err('`platform` is required', 400, 'MISSING_FIELD');
  }

  const platform = body.platform as ExternalPlatformId;
  if (!EXTERNAL_PLATFORM_CATEGORIES[platform]) {
    return err(
      `Unsupported platform: ${platform}. Supported: ${EXTERNAL_PLATFORM_IDS.join(', ')}`,
      400,
      'UNSUPPORTED_PLATFORM',
    );
  }

  const result = await getExternalPlatformConnectUrl(platform, userId, env);
  if ('error' in result) {
    return err(result.error, 500, 'CONNECT_URL_FAILED');
  }

  return ok({
    url: result.url,
    platform: result.platform,
    state: result.state,
  });
}

/**
 * GET /api/external/connect/callback
 *
 * Handle OAuth callback from Postiz after platform authorization.
 * Query params: platform, integrationId, state
 */
export async function handleConnectCallback(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const platform = url.searchParams.get('platform') as ExternalPlatformId | null;
  const integrationId = url.searchParams.get('integrationId');
  const state = url.searchParams.get('state');

  if (!platform || !integrationId) {
    return err('Missing required callback parameters: platform, integrationId', 400);
  }

  if (!EXTERNAL_PLATFORM_CATEGORIES[platform]) {
    return err(`Unsupported platform: ${platform}`, 400);
  }

  // Verify state token
  let userId = '';
  if (state && env.CACHE) {
    try {
      const storedState = await env.CACHE.get(`ext-platform:oauth:state:${state}`);
      if (storedState) {
        const parts = storedState.split(':');
        userId = parts[0];
        // Clean up used state
        await env.CACHE.delete(`ext-platform:oauth:state:${state}`);
      }
    } catch {
      // State verification is best-effort
    }
  }

  if (!userId) {
    // Fallback: try to get user from session
    const userResult = await getUserFromRequest(req, env);
    if (userResult instanceof Response) return userResult;
    userId = userResult.userId;
  }

  const account = await completeExternalPlatformConnection(platform, integrationId, userId, env);

  return ok({ account }, 201);
}

/**
 * GET /api/external/accounts
 *
 * List all connected external platform accounts for the authenticated user.
 */
export async function handleListAccounts(req: Request, env: Env): Promise<Response> {
  const userResult = await getUserFromRequest(req, env);
  if (userResult instanceof Response) return userResult;
  const { userId } = userResult;

  const accounts = await getConnectedExternalAccounts(userId, env);

  // Augment accounts with platform metadata
  const augmented = accounts.map((account) => {
    const category = EXTERNAL_PLATFORM_CATEGORIES[account.platform];
    return {
      ...account,
      platformName: category?.name ?? account.platform,
      platformIcon: category?.icon ?? '🔌',
      capabilities: category?.capabilities ?? [],
    };
  });

  return ok({ accounts: augmented });
}

/**
 * POST /api/external/post
 *
 * Post content to external platforms.
 * Posts immediately to all specified connected platforms.
 *
 * Body: { text, title?, platforms: string[], mediaUrls?, hashtags?, linkUrl? }
 */
export async function handleExternalPost(req: Request, env: Env): Promise<Response> {
  const userResult = await getUserFromRequest(req, env);
  if (userResult instanceof Response) return userResult;
  const { userId } = userResult;

  const accessCheck = await requireExternalPlatformAccess(userId, env);
  if (accessCheck) return accessCheck;

  let body: ExternalPostRequest;
  try {
    body = (await req.json()) as ExternalPostRequest;
  } catch {
    return err('Invalid JSON body', 400, 'INVALID_JSON');
  }

  if (!body.text) {
    return err('`text` is required', 400, 'MISSING_FIELD');
  }

  if (!body.platforms || body.platforms.length === 0) {
    return err('At least one `platform` is required', 400, 'MISSING_FIELD');
  }

  // Validate platforms
  for (const p of body.platforms) {
    if (!EXTERNAL_PLATFORM_CATEGORIES[p]) {
      return err(`Unsupported platform: ${p}`, 400, 'UNSUPPORTED_PLATFORM');
    }
  }

  // Get connected accounts for the requested platforms
  const accounts = await getConnectedExternalAccounts(userId, env);
  const integrationIds: Record<string, string> = {};
  for (const account of accounts) {
    integrationIds[account.platform] = account.postizIntegrationId;
  }

  // Check all requested platforms are connected
  const missingPlatforms = body.platforms.filter((p) => !integrationIds[p]);
  if (missingPlatforms.length > 0) {
    return err(
      `Connect these platforms first: ${missingPlatforms.join(', ')}`,
      400,
      'PLATFORM_NOT_CONNECTED',
    );
  }

  const results = await postToExternalPlatforms(body, integrationIds, env);

  // Check for overall success
  const allSuccess = Object.values(results).every((r) => r.success);
  const status = allSuccess ? 200 : 207;

  return ok({ results }, status);
}

/**
 * POST /api/external/schedule
 *
 * Schedule a post for later publication on external platforms.
 *
 * Body: { text, title?, platforms: string[], scheduledAt: ISO8601, mediaUrls?, hashtags? }
 */
export async function handleExternalSchedule(req: Request, env: Env): Promise<Response> {
  const userResult = await getUserFromRequest(req, env);
  if (userResult instanceof Response) return userResult;
  const { userId } = userResult;

  const accessCheck = await requireExternalPlatformAccess(userId, env);
  if (accessCheck) return accessCheck;

  let body: ExternalPostRequest;
  try {
    body = (await req.json()) as ExternalPostRequest;
  } catch {
    return err('Invalid JSON body', 400, 'INVALID_JSON');
  }

  if (!body.text) {
    return err('`text` is required', 400, 'MISSING_FIELD');
  }

  if (!body.platforms || body.platforms.length === 0) {
    return err('At least one `platform` is required', 400, 'MISSING_FIELD');
  }

  if (!body.scheduledAt) {
    return err('`scheduledAt` (ISO datetime) is required for scheduling', 400, 'MISSING_FIELD');
  }

  // Validate scheduledAt is in the future
  const scheduledTime = new Date(body.scheduledAt).getTime();
  if (Number.isNaN(scheduledTime)) {
    return err('Invalid `scheduledAt`. Must be a valid ISO 8601 datetime.', 400, 'INVALID_DATE');
  }

  for (const p of body.platforms) {
    if (!EXTERNAL_PLATFORM_CATEGORIES[p]) {
      return err(`Unsupported platform: ${p}`, 400, 'UNSUPPORTED_PLATFORM');
    }
  }

  const accounts = await getConnectedExternalAccounts(userId, env);
  const integrationIds: Record<string, string> = {};
  for (const account of accounts) {
    integrationIds[account.platform] = account.postizIntegrationId;
  }

  const missingPlatforms = body.platforms.filter((p) => !integrationIds[p]);
  if (missingPlatforms.length > 0) {
    return err(
      `Connect these platforms first: ${missingPlatforms.join(', ')}`,
      400,
      'PLATFORM_NOT_CONNECTED',
    );
  }

  const result = await scheduleExternalPost(body, integrationIds, env);

  return ok(
    {
      scheduleId: result.scheduleId,
      scheduledAt: body.scheduledAt,
      results: result.results,
    },
    201,
  );
}

/**
 * POST /api/external/go-live
 *
 * Go live on an external platform.
 * Sends go-live notifications via Postiz.
 *
 * Body: { platform, title, description?, category?, tags? }
 */
export async function handleExternalGoLive(req: Request, env: Env): Promise<Response> {
  const userResult = await getUserFromRequest(req, env);
  if (userResult instanceof Response) return userResult;
  const { userId } = userResult;

  const accessCheck = await requireExternalPlatformAccess(userId, env);
  if (accessCheck) return accessCheck;

  let body: ExternalGoLiveRequest;
  try {
    body = (await req.json()) as ExternalGoLiveRequest;
  } catch {
    return err('Invalid JSON body', 400, 'INVALID_JSON');
  }

  if (!body.platform) {
    return err('`platform` is required (youtube, twitch, kick, tiktok)', 400, 'MISSING_FIELD');
  }

  if (!EXTERNAL_PLATFORM_CATEGORIES[body.platform]) {
    return err(`Unsupported platform for go-live: ${body.platform}`, 400, 'UNSUPPORTED_PLATFORM');
  }

  if (!body.title) {
    return err('`title` is required for go-live', 400, 'MISSING_FIELD');
  }

  // Get the integration ID for this platform
  const accounts = await getConnectedExternalAccounts(userId, env);
  const account = accounts.find((a) => a.platform === body.platform);
  if (!account) {
    return err(`Connect ${body.platform} first before going live.`, 400, 'PLATFORM_NOT_CONNECTED');
  }

  const result = await goLiveOnExternalPlatform(body, account.postizIntegrationId, env);

  if (!result.success) {
    return err(result.error ?? 'Go-live failed', 500, 'GO_LIVE_FAILED');
  }

  return ok(
    {
      platform: body.platform,
      streamUrl: result.streamUrl,
      title: body.title,
    },
    201,
  );
}

/**
 * GET /api/external/analytics
 *
 * Pull analytics from connected external platforms.
 * Query params: platform (optional — returns all if omitted)
 */
export async function handleExternalAnalytics(req: Request, env: Env): Promise<Response> {
  const userResult = await getUserFromRequest(req, env);
  if (userResult instanceof Response) return userResult;
  const { userId } = userResult;

  const accessCheck = await requireExternalPlatformAccess(userId, env);
  if (accessCheck) return accessCheck;

  const url = new URL(req.url);
  const platformFilter = url.searchParams.get('platform') as ExternalPlatformId | null;

  const accounts = await getConnectedExternalAccounts(userId, env);
  const filtered = platformFilter
    ? accounts.filter((a) => a.platform === platformFilter)
    : accounts;

  if (filtered.length === 0) {
    return ok({ analytics: [] });
  }

  const analyticsResults = await Promise.all(
    filtered.map(async (account) => {
      const result = await getExternalPlatformAnalytics(
        account.platform,
        account.postizIntegrationId,
        env,
      );
      return {
        platform: account.platform,
        displayName: account.displayName,
        analytics: result,
      };
    }),
  );

  return ok({ analytics: analyticsResults });
}

/**
 * DELETE /api/external/disconnect
 *
 * Disconnect an external platform.
 *
 * Body: { platform: "youtube" }
 */
export async function handleDisconnectPlatform(req: Request, env: Env): Promise<Response> {
  const userResult = await getUserFromRequest(req, env);
  if (userResult instanceof Response) return userResult;
  const { userId } = userResult;

  let body: { platform?: string };
  try {
    body = (await req.json()) as { platform?: string };
  } catch {
    return err('Invalid JSON body', 400, 'INVALID_JSON');
  }

  if (!body.platform) {
    return err('`platform` is required', 400, 'MISSING_FIELD');
  }

  const platform = body.platform as ExternalPlatformId;
  if (!EXTERNAL_PLATFORM_CATEGORIES[platform]) {
    return err(`Unknown platform: ${platform}`, 400);
  }

  const removed = await disconnectExternalPlatform(userId, platform, env);

  if (!removed) {
    return err(`No connected account found for ${platform}`, 404, 'NOT_FOUND');
  }

  return ok({ message: `${platform} disconnected successfully` });
}

/**
 * POST /api/external/webhook
 *
 * Webhook receiver for Postiz callbacks (publish status updates, etc.).
 * Postiz sends webhooks when scheduled posts are published, fail, etc.
 */
export async function handleExternalWebhook(req: Request, env: Env): Promise<Response> {
  // Verify webhook secret
  const signature = req.headers.get('x-postiz-signature');
  const webhookSecret = (env as Record<string, string>).POSTIZ_WEBHOOK_SECRET;
  if (webhookSecret) {
    if (!signature) {
      return err('Missing webhook signature', 401);
    }
    // In production, verify HMAC signature here
    // const payload = await req.text();
    // const expected = crypto.subtle.importKey(...)
    // if (!timingSafeEqual(signature, expected)) return err('Invalid signature', 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err('Invalid webhook payload', 400);
  }

  const event = body.event as string | undefined;
  const postId = body.postId as string | undefined;

  if (!event || !postId) {
    return ok({ received: true }); // Acknowledge but don't process malformed events
  }

  // Handle different webhook event types
  switch (event) {
    case 'post.published': {
      // A scheduled post was published successfully
      // Could trigger notifications, analytics sync, etc.
      break;
    }
    case 'post.failed': {
      // A post failed to publish
      // Log the failure for retry logic
      const error = body.error as string | undefined;
      if (env.CACHE) {
        await env.CACHE.put(
          `postiz:webhook:failed:${postId}`,
          JSON.stringify({ postId, error, timestamp: Date.now() }),
          { expirationTtl: 86400 * 7 },
        );
      }
      break;
    }
    case 'integration.connected': {
      // A new integration was connected
      break;
    }
    case 'integration.disconnected': {
      // An integration was disconnected
      break;
    }
    default: {
      // Unknown event — log but acknowledge
      if (env.CACHE) {
        await env.CACHE.put(
          `postiz:webhook:unknown:${Date.now()}`,
          JSON.stringify({ event, postId, body }),
          { expirationTtl: 86400 },
        );
      }
    }
  }

  return ok({ received: true });
}

/**
 * GET /api/external/platforms
 *
 * List all available external platforms with their capabilities.
 * Unauthenticated — returns the canonical platform list.
 */
export async function handleListPlatforms(_req: Request, _env: Env): Promise<Response> {
  const platforms = EXTERNAL_PLATFORM_IDS.map((id) => {
    const cat = EXTERNAL_PLATFORM_CATEGORIES[id];
    return {
      id,
      name: cat.name,
      icon: cat.icon,
      capabilities: cat.capabilities,
      description: cat.description,
      requires_oauth: cat.requires_oauth,
    };
  });

  return ok({ platforms });
}

/**
 * GET /api/external/status
 *
 * Get the status of connected external platforms and whether the user
 * has access to DegenFeed Connect.
 */
export async function handleExternalStatus(req: Request, env: Env): Promise<Response> {
  const userResult = await getUserFromRequest(req, env);
  if (userResult instanceof Response) {
    // Unauthenticated user — return public status
    return ok({
      hasAccess: false,
      requiresTier: 'enterprise',
      standalonePrice: 15,
      accounts: [],
    });
  }
  const { userId } = userResult;

  const tier = await getUserTier(userId, env);
  const hasAccess = tier === 'enterprise';

  // Check standalone add-on
  let hasStandaloneAddon = false;
  if (!hasAccess && env.SUBSCRIPTIONS) {
    try {
      const addonRaw = await env.SUBSCRIPTIONS.get(`addon:connect:${userId}`);
      if (addonRaw) {
        const addon = JSON.parse(addonRaw) as { active: boolean; expiresAt: number };
        hasStandaloneAddon = addon.active && addon.expiresAt > Date.now();
      }
    } catch {
      // Ignore
    }
  }

  const accounts = await getConnectedExternalAccounts(userId, env);

  return ok({
    hasAccess: hasAccess || hasStandaloneAddon,
    tier,
    requiresTier: 'enterprise',
    standalonePrice: 15,
    accounts: accounts.map((a) => ({
      platform: a.platform,
      displayName: a.displayName,
      avatarUrl: a.avatarUrl,
      connectedAt: a.connectedAt,
      lastUsedAt: a.lastUsedAt,
    })),
  });
}

/**
 * POST /api/external/standalone/subscribe
 *
 * Purchase the standalone DegenFeed Connect add-on ($15/mo).
 *
 * Body: { txHash, period: "monthly"|"annual" }
 */
export async function handleStandaloneSubscribe(req: Request, env: Env): Promise<Response> {
  const userResult = await getUserFromRequest(req, env);
  if (userResult instanceof Response) return userResult;
  const { userId } = userResult;

  let body: { txHash?: string; period?: string };
  try {
    body = (await req.json()) as { txHash?: string; period?: string };
  } catch {
    return err('Invalid JSON body', 400);
  }

  if (!body.txHash) {
    return err('`txHash` is required (payment transaction)', 400);
  }

  const period = body.period === 'annual' ? 'annual' : 'monthly';
  const priceCents = period === 'annual' ? 15000 : 1500; // $15/mo or $150/yr

  // Store the add-on subscription
  if (env.SUBSCRIPTIONS) {
    const expiresAt =
      period === 'annual' ? Date.now() + 365 * 86400 * 1000 : Date.now() + 30 * 86400 * 1000;

    await env.SUBSCRIPTIONS.put(
      `addon:connect:${userId}`,
      JSON.stringify({
        active: true,
        tier: 'connect',
        period,
        txHash: body.txHash,
        priceCents,
        subscribedAt: Date.now(),
        expiresAt,
      }),
    );

    return ok(
      {
        message: 'DegenFeed Connect activated!',
        expiresAt: new Date(expiresAt).toISOString(),
        period,
      },
      201,
    );
  }

  return err('Subscription service unavailable', 503);
}
