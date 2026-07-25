/**
 * @degenfeed/api-worker — Feed Quality Dashboard Route
 *
 * Admin-only endpoint that returns feed quality metrics:
 * quality scores, category distribution, diversity, engagement, freshness.
 *
 * GET /api/admin/feed-quality/dashboard
 * GET /api/admin/feed-quality/history
 * POST /api/admin/feed-quality/snapshot
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse } from '../index';
import {
  buildQualityDashboard,
  loadDashboardHistory,
  loadLatestDashboardSnapshot,
  storeDashboardSnapshot,
} from '../feed/feed-quality-dashboard';

const QUALITY_DASHBOARD_PREFIX = '/api/admin/feed-quality';

export const qualityDashboardRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /api/admin/feed-quality/dashboard
 *
 * Returns the current feed quality dashboard computed from the
 * provided posts payload, or the latest snapshot from KV.
 *
 * Query params:
 *   - posts (optional): JSON array of posts to compute metrics from.
 *     If omitted, returns the latest cached snapshot.
 */
qualityDashboardRoutes.get('/dashboard', async (c) => {
  // Admin auth check — require admin session or API key
  const authResult = await authenticateAdmin(c);
  if (!authResult.authorized) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const postsParam = c.req.query('posts');

  if (postsParam) {
    try {
      const posts = JSON.parse(postsParam) as any[];
      const metrics = buildQualityDashboard(posts as any, Date.now());
      return jsonResponse(metrics);
    } catch (err) {
      return jsonResponse({ error: 'Invalid posts payload' }, 400);
    }
  }

  // Try cached snapshot
  const cached = await loadLatestDashboardSnapshot(c.env);
  if (cached) {
    return jsonResponse(cached);
  }

  return jsonResponse({ error: 'No dashboard data available. POST a snapshot first.' }, 404);
});

/**
 * POST /api/admin/feed-quality/snapshot
 *
 * Accepts a JSON body with { posts: UnifiedPost[] } and stores
 * a quality dashboard snapshot.
 */
qualityDashboardRoutes.post('/snapshot', async (c) => {
  const authResult = await authenticateAdmin(c);
  if (!authResult.authorized) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json() as { posts?: any[] };
    if (!body.posts || !Array.isArray(body.posts)) {
      return jsonResponse({ error: 'Body must contain { posts: UnifiedPost[] }' }, 400);
    }

    const metrics = buildQualityDashboard(body.posts as any, Date.now());
    await storeDashboardSnapshot(c.env, metrics);

    return jsonResponse({
      ok: true,
      metrics,
    });
  } catch (err) {
    return jsonResponse({ error: 'Failed to process snapshot' }, 500);
  }
});

/**
 * GET /api/admin/feed-quality/history
 *
 * Returns historical dashboard snapshots from KV.
 * Query params:
 *   - limit (default 24): max snapshots to return
 */
qualityDashboardRoutes.get('/history', async (c) => {
  const authResult = await authenticateAdmin(c);
  if (!authResult.authorized) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 24));
  const history = await loadDashboardHistory(c.env, limit);

  return jsonResponse({ history, count: history.length });
});

// ─── Auth Helper ───────────────────────────────────────────────────────

async function authenticateAdmin(
  c: { req: { header: (name: string) => string | null }; env: Env },
): Promise<{ authorized: boolean }> {
  // Check for admin session cookie
  const cookie = c.req.header('cookie') ?? '';
  const sessionMatch = cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith('__Host-dfid='));

  if (sessionMatch && c.env.AUTH_SECRET) {
    try {
      const { verifySessionCookie } = await import('../session');
      const payload = await verifySessionCookie(sessionMatch.slice('__Host-dfid='.length), c.env.AUTH_SECRET);
      if (payload?.address) {
        // Check if the address has admin role
        const adminAddresses = (c.env as any).ADMIN_ADDRESSES as string ?? '';
        const admins = adminAddresses.split(',').map((a) => a.trim().toLowerCase());
        if (admins.includes(payload.address.toLowerCase())) {
          return { authorized: true };
        }
      }
    } catch {
      // Fall through to API key check
    }
  }

  // Check for admin API key
  const authHeader = c.req.header('authorization') ?? '';
  const adminKey = (c.env as any).ADMIN_API_KEY as string;
  if (adminKey && authHeader.replace(/^Bearer\s+/i, '').trim() === adminKey) {
    return { authorized: true };
  }

  return { authorized: false };
}
