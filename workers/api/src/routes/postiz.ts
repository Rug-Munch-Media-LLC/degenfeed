/**
 * @degenfeed/api-worker — Postiz Scheduling & Analytics Routes
 *
 * Exposes DegenFeed's Postiz (self-hosted social scheduler) through the
 * worker API. Postiz runs at schedule.degenfeed.xyz and provides:
 *   - Cross-platform post scheduling (X, LinkedIn, Instagram, YouTube, etc.)
 *   - Post performance analytics
 *   - Connected channel (integration) listing
 *
 * Routes:
 *   GET  /api/postiz/schedules    — upcoming scheduled posts for the current user
 *   POST /api/postiz/schedule     — schedule a cross-platform post
 *   GET  /api/postiz/analytics    — post / account performance analytics
 *   GET  /api/postiz/integrations — list connected Postiz channels (dashboard)
 *   GET  /api/postiz/status       — Postiz connection status + health
 */

import { jsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import {
  cancelPostizSchedule,
  getPostizAccountAnalytics,
  getPostizAnalytics,
  listPostizIntegrations,
  listPostizSchedules,
  scheduleCrossPlatformPost,
  type PostizIntegration,
} from '../lib/postiz-bridge';
import { requirePremiumTier } from '../premium';
import { getUserTier } from '../lib/membership-tiers';

// ─── Response helpers ───────────────────────────────────────────────────────

function ok(data: unknown, status = 200): Response {
  return jsonResponse({ data }, status);
}

function err(message: string, status = 400, code?: string): Response {
  return jsonResponse({ error: message, code }, status);
}

// ─── Route handlers ─────────────────────────────────────────────────────────

/**
 * GET /api/postiz/schedules
 *
 * Returns upcoming scheduled posts for the current user, merged with the
 * connected Postiz integrations. Requires a logged-in session; Postiz
 * scheduling is a premium (Pro+) feature.
 *
 * Query params:
 *   ?status=scheduled|published  — filter (default scheduled)
 *   ?limit=N                     — max items (default 50)
 */
export async function handlePostizSchedules(req: Request, env: Env): Promise<Response> {
  const session = await requireSession(req, env);
  if (session instanceof Response) return session;

  // Postiz scheduling requires Pro+
  const gate = await requirePremiumTier(session.address, env, 'pro');
  if (gate) return gate;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'scheduled';
    const limit = Math.min(Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50, 100);

    const [schedules, integrations] = await Promise.all([
      listPostizSchedules(env, status, limit).catch(() => []),
      listPostizIntegrations(env).catch(() => [] as PostizIntegration[]),
    ]);

    return ok({
      schedules,
      total: schedules.length,
      status,
      integrations: integrations.map((i) => ({
        id: i.id,
        name: i.name,
        identifier: i.identifier,
        picture: i.picture,
        profile: i.profile,
        disabled: i.disabled ?? false,
      })),
      postizUrl: 'https://schedule.degenfeed.xyz',
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return err(`Failed to load Postiz schedules: ${error}`, 500, 'POSTIZ_SCHEDULES_ERROR');
  }
}

/**
 * POST /api/postiz/schedule
 *
 * Schedules a cross-platform post via Postiz.
 *
 * Body:
 *   { text, title?, platforms: string[], scheduledAt?: ISO, mediaUrls?: string[], hashtags?: string[] }
 *
 * `scheduledAt` optional — when omitted the post publishes immediately.
 */
export async function handlePostizSchedule(req: Request, env: Env): Promise<Response> {
  const session = await requireSession(req, env);
  if (session instanceof Response) return session;

  const gate = await requirePremiumTier(session.address, env, 'pro');
  if (gate) return gate;

  let body: {
    text?: string;
    title?: string;
    platforms?: string[];
    scheduledAt?: string | null;
    mediaUrls?: string[];
    hashtags?: string[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err('Invalid JSON body', 400, 'INVALID_JSON');
  }

  const text = body.text?.trim();
  if (!text) {
    return err('`text` is required', 400, 'MISSING_FIELD');
  }

  const platforms = Array.isArray(body.platforms) && body.platforms.length > 0
    ? body.platforms.map((p) => p.trim()).filter(Boolean)
    : [];
  if (platforms.length === 0) {
    return err('At least one `platform` is required (e.g. ["twitter","linkedin"])', 400, 'MISSING_FIELD');
  }

  let scheduledAt: string | null = null;
  if (body.scheduledAt) {
    const ts = new Date(body.scheduledAt).getTime();
    if (Number.isNaN(ts)) {
      return err('Invalid `scheduledAt`. Must be a valid ISO 8601 datetime.', 400, 'INVALID_DATE');
    }
    scheduledAt = new Date(ts).toISOString();
  }

  const result = await scheduleCrossPlatformPost(
    {
      text,
      title: body.title,
      platforms,
      scheduledAt,
      mediaUrls: Array.isArray(body.mediaUrls) ? body.mediaUrls : undefined,
      hashtags: Array.isArray(body.hashtags) ? body.hashtags : undefined,
    },
    env,
  );

  if (!result.ok) {
    return err(result.error ?? 'Postiz scheduling failed', 502, 'POSTIZ_SCHEDULE_FAILED');
  }

  return ok(
    {
      ok: true,
      postIds: result.postIds,
      scheduledAt,
      results: result.results,
    },
    201,
  );
}

/**
 * GET /api/postiz/analytics
 *
 * Returns post performance analytics.
 *
 * Query params:
 *   ?postId=<postiz-post-id>       — per-post engagement analytics
 *   ?integration=<integration-id>  — account-level analytics (followers/impressions)
 *   ?days=N                        — lookback for account analytics (default 30)
 */
export async function handlePostizAnalytics(req: Request, env: Env): Promise<Response> {
  const session = await requireSession(req, env);
  if (session instanceof Response) return session;

  const url = new URL(req.url);
  const postId = url.searchParams.get('postId');
  const integration = url.searchParams.get('integration');
  const days = Math.min(Number.parseInt(url.searchParams.get('days') || '30', 10) || 30, 90);

  try {
    if (postId) {
      const analytics = await getPostizAnalytics(postId, env);
      if (!analytics) {
        return err(`No analytics for post ${postId}`, 404, 'POSTIZ_ANALYTICS_NOT_FOUND');
      }
      return ok({ type: 'post', postId, analytics });
    }

    if (integration) {
      const analytics = await getPostizAccountAnalytics(integration, env, days);
      return ok({ type: 'integration', integration, days, analytics });
    }

    // No specific target — return aggregate over all connected integrations.
    const integrations = await listPostizIntegrations(env);
    const accountAnalytics: Array<{
      integration: string;
      name: string;
      identifier: string;
      analytics: Array<{ label: string; data: Array<{ total: string; date: string }>; percentageChange?: number }>;
    }> = [];

    for (const integrationRecord of integrations) {
      if (integrationRecord.disabled) continue;
      const analytics = await getPostizAccountAnalytics(integrationRecord.id, env, days);
      accountAnalytics.push({
        integration: integrationRecord.id,
        name: integrationRecord.name,
        identifier: integrationRecord.identifier,
        analytics,
      });
    }

    return ok({ type: 'all', days, integrations: accountAnalytics });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return err(`Failed to load Postiz analytics: ${error}`, 500, 'POSTIZ_ANALYTICS_ERROR');
  }
}

/**
 * GET /api/postiz/integrations
 *
 * Lists connected Postiz channels. Used by the dashboard Schedule tab to
 * show which platforms the user can schedule to.
 */
export async function handlePostizIntegrations(_req: Request, env: Env): Promise<Response> {
  try {
    const integrations = await listPostizIntegrations(env);
    return ok({
      integrations: integrations.map((i) => ({
        id: i.id,
        name: i.name,
        identifier: i.identifier,
        picture: i.picture,
        profile: i.profile,
        disabled: i.disabled ?? false,
        customer: i.customer,
      })),
      total: integrations.length,
      postizUrl: 'https://schedule.degenfeed.xyz',
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return err(`Failed to load Postiz integrations: ${error}`, 500, 'POSTIZ_INTEGRATIONS_ERROR');
  }
}

/**
 * GET /api/postiz/status
 *
 * Postiz connection + health status, plus whether the calling user has
 * access (tier) to Postiz scheduling.
 */
export async function handlePostizStatus(req: Request, env: Env): Promise<Response> {
  try {
    const { checkPostizHealth } = await import('../lib/postiz-bridge');

    let userTier: string | null = null;
    const session = await requireSession(req, env).catch(() => null);
    if (session && !(session instanceof Response)) {
      userTier = await getUserTier(session.address, env);
    }

    const health = await checkPostizHealth();

    return ok({
      postiz: {
        configured: Boolean(env.POSTIZ_BASE_URL && env.POSTIZ_API_KEY),
        available: health.available,
        message: health.message,
        url: env.POSTIZ_BASE_URL || 'not-configured',
      },
      access: {
        tier: userTier,
        canSchedule: userTier === 'pro' || userTier === 'platinum' || userTier === 'enterprise',
      },
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return err(`Failed to check Postiz status: ${error}`, 500, 'POSTIZ_STATUS_ERROR');
  }
}

/**
 * DELETE /api/postiz/schedules/:id
 *
 * Cancels / deletes a scheduled post in Postiz.
 */
export async function handlePostizCancel(req: Request, env: Env, scheduleId: string): Promise<Response> {
  const session = await requireSession(req, env);
  if (session instanceof Response) return session;

  if (!scheduleId) {
    return err('`scheduleId` is required', 400, 'MISSING_FIELD');
  }

  const okResult = await cancelPostizSchedule(scheduleId, env);
  if (!okResult) {
    return err(`Failed to cancel Postiz schedule ${scheduleId}`, 502, 'POSTIZ_CANCEL_FAILED');
  }

  return ok({ ok: true, scheduleId });
}
