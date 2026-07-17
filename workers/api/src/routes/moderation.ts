/**
 * moderation — Content moderation routes.
 *
 * Provides:
 *   - Report submission (from ReportModal)
 *   - Report listing / resolution / post removal (admin-only)
 *   - Cross-protocol user bans
 *   - Block/mute sync (existing, preserved)
 *
 * Admin access is gated by an ADMIN_WALLETS env var (comma-separated,
 * lowercase addresses).
 */

import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';

// ─── KV key helpers ───────────────────────────────────────────────────

function reportKey(id: string): string {
  return `mod:report:${id}`;
}

function reportIndexKey(): string {
  return 'mod:reports:index';
}

function reportCounterKey(): string {
  return 'mod:report:counter';
}

function banKey(address: string): string {
  return `mod:ban:${address.toLowerCase()}`;
}

function banIndexKey(): string {
  return 'mod:bans:index';
}

function modKey(address: string): string {
  return `user:moderation:${address.toLowerCase()}`;
}

// ─── Admin gating ─────────────────────────────────────────────────────

function isAdmin(env: Env, address: string): boolean {
  if (!env.ADMIN_WALLETS) return false;
  const admins = env.ADMIN_WALLETS.split(',').map((a) => a.trim().toLowerCase());
  return admins.includes(address.toLowerCase());
}

async function requireAdmin(
  request: Request,
  env: Env,
): Promise<{ address: string } | Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  if (!isAdmin(env, session.address)) {
    return jsonResponse({ error: 'Forbidden: admin access required' }, 403);
  }
  return { address: session.address };
}

// ─── Types ────────────────────────────────────────────────────────────

export interface ReportEntry {
  id: string;
  postId: string;
  protocol: string;
  reason: string;
  description?: string;
  reporterAddress: string;
  reportedAt: number;
  status: 'pending' | 'resolved' | 'dismissed';
  resolvedBy?: string;
  resolvedAt?: number;
  postText?: string;
  postAuthorId?: string;
  postAuthorHandle?: string;
}

interface ReportIndex {
  ids: string[];
}

interface BanEntry {
  userId: string;
  protocol: string;
  reason: string;
  bannedBy: string;
  bannedAt: number;
  /** Wallet address used to identify the user across protocols */
  walletAddress?: string;
}

interface BanIndex {
  ids: string[];
}

interface ModEntry {
  targetId: string;
  targetHandle: string;
  protocol: string;
  action: 'block' | 'mute';
  timestamp: number;
}

interface ModStore {
  entries: ModEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────

async function getReportList(env: Env): Promise<string[]> {
  try {
    const raw = await env.REPORTS?.get(reportIndexKey());
    if (raw) {
      const idx = JSON.parse(raw) as ReportIndex;
      return idx.ids ?? [];
    }
  } catch {
    // ignore
  }
  return [];
}

async function saveReportList(env: Env, ids: string[]): Promise<void> {
  await env.REPORTS?.put(reportIndexKey(), JSON.stringify({ ids } satisfies ReportIndex));
}

async function getNextReportId(env: Env): Promise<string> {
  const raw = await env.REPORTS?.get(reportCounterKey());
  const next = raw ? parseInt(raw, 10) + 1 : 1;
  await env.REPORTS?.put(reportCounterKey(), String(next));
  return `R${String(next).padStart(8, '0')}`;
}

async function getBans(env: Env): Promise<BanEntry[]> {
  try {
    const raw = await env.REPORTS?.get(banIndexKey());
    if (raw) {
      const idx = JSON.parse(raw) as BanIndex;
      const bans: BanEntry[] = [];
      for (const id of idx.ids ?? []) {
        const banRaw = await env.REPORTS?.get(banKey(id));
        if (banRaw) {
          try {
            bans.push(JSON.parse(banRaw) as BanEntry);
          } catch {
            // skip corrupt entry
          }
        }
      }
      return bans;
    }
  } catch {
    // ignore
  }
  return [];
}

// ─── GET /api/moderation/reports — List reports (admin only) ──────────

export async function handleListReports(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pending';
  const protocol = url.searchParams.get('protocol');
  const reason = url.searchParams.get('reason');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const ids = await getReportList(env);
  const reports: ReportEntry[] = [];

  for (const id of ids) {
    if (reports.length >= offset + limit) break;
    const raw = await env.REPORTS?.get(reportKey(id));
    if (!raw) continue;
    try {
      const report = JSON.parse(raw) as ReportEntry;
      // Apply filters
      if (status !== 'all' && report.status !== status) continue;
      if (protocol && report.protocol !== protocol) continue;
      if (reason && report.reason !== reason) continue;
      if (reports.length >= offset) {
        reports.push(report);
      }
    } catch {
      // skip corrupt entry
    }
  }

  return noCacheJsonResponse({
    reports: reports.slice(0, limit),
    total: ids.length,
    filtered: reports.length,
    limit,
    offset,
  });
}

// ─── POST /api/moderation/report — Submit a report ───────────────────

export async function handleSubmitReport(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { postId?: string; reason?: string; protocol?: string; description?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.postId || !body.reason) {
    return jsonResponse({ error: 'postId and reason are required' }, 400);
  }

  const validReasons = ['spam', 'harassment', 'scam', 'nsfw', 'other'];
  if (!validReasons.includes(body.reason)) {
    return jsonResponse({ error: 'Invalid reason' }, 400);
  }

  const id = await getNextReportId(env);
  const report: ReportEntry = {
    id,
    postId: body.postId,
    protocol: body.protocol || 'unknown',
    reason: body.reason,
    description: body.description,
    reporterAddress: session.address,
    reportedAt: Date.now(),
    status: 'pending',
  };

  try {
    await env.REPORTS?.put(reportKey(id), JSON.stringify(report));

    // Update index
    const ids = await getReportList(env);
    ids.unshift(id);
    await saveReportList(env, ids);

    return jsonResponse({ ok: true, reportId: id }, 201);
  } catch {
    return jsonResponse({ error: 'Failed to submit report' }, 500);
  }
}

// ─── POST /api/moderation/reports/:id/resolve — Resolve a report ─────

export async function handleResolveReport(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const reportId = pathParts[pathParts.length - 2]; // /api/moderation/reports/:id/resolve

  if (!reportId) {
    return jsonResponse({ error: 'Report ID required' }, 400);
  }

  const raw = await env.REPORTS?.get(reportKey(reportId));
  if (!raw) {
    return jsonResponse({ error: 'Report not found' }, 404);
  }

  try {
    const report = JSON.parse(raw) as ReportEntry;
    report.status = 'resolved';
    report.resolvedBy = admin.address;
    report.resolvedAt = Date.now();
    await env.REPORTS?.put(reportKey(reportId), JSON.stringify(report));
    return jsonResponse({ ok: true, reportId, status: 'resolved' });
  } catch {
    return jsonResponse({ error: 'Failed to resolve report' }, 500);
  }
}

// ─── POST /api/moderation/reports/:id/remove — Remove the post ──────

export async function handleRemovePost(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const reportId = pathParts[pathParts.length - 2]; // /api/moderation/reports/:id/remove

  if (!reportId) {
    return jsonResponse({ error: 'Report ID required' }, 400);
  }

  const raw = await env.REPORTS?.get(reportKey(reportId));
  if (!raw) {
    return jsonResponse({ error: 'Report not found' }, 404);
  }

  try {
    const report = JSON.parse(raw) as ReportEntry;
    report.status = 'resolved';
    report.resolvedBy = admin.address;
    report.resolvedAt = Date.now();
    await env.REPORTS?.put(reportKey(reportId), JSON.stringify(report));

    // Store the removed post ID for the feed pipeline to check
    const removedPostKey = `mod:removed:${report.postId}`;
    await env.REPORTS?.put(removedPostKey, JSON.stringify({
      removedBy: admin.address,
      removedAt: Date.now(),
      reportId,
    }), { expirationTtl: 60 * 60 * 24 * 90 }); // 90 days

    return jsonResponse({ ok: true, reportId, postId: report.postId, action: 'removed' });
  } catch {
    return jsonResponse({ error: 'Failed to remove post' }, 500);
  }
}

// ─── POST /api/moderation/ban — Ban a user across all protocols ─────

export async function handleBanUser(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: { userId?: string; protocol?: string; reason?: string; walletAddress?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.userId || !body.reason) {
    return jsonResponse({ error: 'userId and reason are required' }, 400);
  }

  const banId = `ban:${body.userId.toLowerCase()}:${body.protocol || 'all'}`;
  const banEntry: BanEntry = {
    userId: body.userId,
    protocol: body.protocol || 'all',
    reason: body.reason,
    bannedBy: admin.address,
    bannedAt: Date.now(),
    walletAddress: body.walletAddress,
  };

  try {
    await env.REPORTS?.put(banKey(banId), JSON.stringify(banEntry), {
      expirationTtl: 60 * 60 * 24 * 400, // ~13 months
    });

    // Update ban index
    const raw = await env.REPORTS?.get(banIndexKey());
    const idx: BanIndex = raw ? JSON.parse(raw) : { ids: [] };
    if (!idx.ids.includes(banId)) {
      idx.ids.push(banId);
    }
    await env.REPORTS?.put(banIndexKey(), JSON.stringify(idx));

    // Also ban by wallet address if provided (cross-protocol)
    if (body.walletAddress) {
      const walletBanId = `ban:wallet:${body.walletAddress.toLowerCase()}`;
      await env.REPORTS?.put(banKey(walletBanId), JSON.stringify({
        ...banEntry,
        userId: body.walletAddress,
        protocol: 'all',
      }), { expirationTtl: 60 * 60 * 24 * 400 });
      if (!idx.ids.includes(walletBanId)) {
        idx.ids.push(walletBanId);
      }
      await env.REPORTS?.put(banIndexKey(), JSON.stringify(idx));
    }

    return jsonResponse({ ok: true, banId, userId: body.userId, protocol: body.protocol || 'all' });
  } catch {
    return jsonResponse({ error: 'Failed to ban user' }, 500);
  }
}

// ─── GET /api/moderation/stats — Moderation statistics ───────────────

export async function handleModerationStats(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const ids = await getReportList(env);
  let totalPending = 0;
  let totalResolved = 0;
  let totalDismissed = 0;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let todayCount = 0;
  let weekCount = 0;
  let monthCount = 0;
  const reporterCounts: Record<string, number> = {};
  const reportedUserCounts: Record<string, number> = {};

  for (const id of ids) {
    const raw = await env.REPORTS?.get(reportKey(id));
    if (!raw) continue;
    try {
      const report = JSON.parse(raw) as ReportEntry;
      if (report.status === 'pending') totalPending++;
      else if (report.status === 'resolved') totalResolved++;
      else if (report.status === 'dismissed') totalDismissed++;

      if (now - report.reportedAt < dayMs) todayCount++;
      if (now - report.reportedAt < 7 * dayMs) weekCount++;
      if (now - report.reportedAt < 30 * dayMs) monthCount++;

      reporterCounts[report.reporterAddress] = (reporterCounts[report.reporterAddress] ?? 0) + 1;
      if (report.postAuthorId) {
        reportedUserCounts[report.postAuthorId] = (reportedUserCounts[report.postAuthorId] ?? 0) + 1;
      }
    } catch {
      // skip
    }
  }

  const total = ids.length;
  const resolutionRate = total > 0 ? ((totalResolved + totalDismissed) / total) : 0;

  // Top reporters
  const topReporters = Object.entries(reporterCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([address, count]) => ({ address, count }));

  // Most reported users
  const mostReported = Object.entries(reportedUserCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([userId, count]) => ({ userId, count }));

  const bans = await getBans(env);

  return noCacheJsonResponse({
    stats: {
      total,
      pending: totalPending,
      resolved: totalResolved,
      dismissed: totalDismissed,
      today: todayCount,
      week: weekCount,
      month: monthCount,
      resolutionRate: Math.round(resolutionRate * 10000) / 100, // percentage
      activeBans: bans.length,
    },
    topReporters,
    mostReported,
  });
}

// ─── GET /api/moderation/banned — Check if a user is banned ──────────
// Used by the feed pipeline, not admin-gated. Checks by userId or walletAddress.
export async function handleCheckBanned(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const walletAddress = url.searchParams.get('walletAddress');

  if (!userId && !walletAddress) {
    return jsonResponse({ error: 'userId or walletAddress required' }, 400);
  }

  const raw = await env.REPORTS?.get(banIndexKey());
  if (!raw) return jsonResponse({ banned: false });

  const idx: BanIndex = JSON.parse(raw);
  for (const banId of idx.ids ?? []) {
    const banRaw = await env.REPORTS?.get(banKey(banId));
    if (!banRaw) continue;
    try {
      const ban = JSON.parse(banRaw) as BanEntry;
      if (userId && ban.userId.toLowerCase() === userId.toLowerCase()) {
        return jsonResponse({ banned: true, ban });
      }
      if (walletAddress && ban.walletAddress?.toLowerCase() === walletAddress.toLowerCase()) {
        return jsonResponse({ banned: true, ban });
      }
    } catch {
      // skip
    }
  }

  return jsonResponse({ banned: false });
}

// ═════════════════════════════════════════════════════════════════════
// Existing: block/mute sync (unchanged)
// ═════════════════════════════════════════════════════════════════════

interface SyncBody {
  targetId: string;
  targetHandle?: string;
  protocol: string;
  action: 'block' | 'unblock' | 'mute' | 'unmute';
}

export async function handleBlockSync(request: Request, env: Env): Promise<Response> {
  // ── GET: return blocked/muted lists for the authenticated user ──
  if (request.method === 'GET') {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const raw = await env.CACHE?.get(modKey(session.address));
    const store: ModStore = raw ? JSON.parse(raw) : { entries: [] };

    const blocked = store.entries
      .filter((e) => e.action === 'block')
      .map((e) => ({
        targetId: e.targetId,
        targetHandle: e.targetHandle,
        protocol: e.protocol,
        blockedAt: e.timestamp,
      }));
    const muted = store.entries
      .filter((e) => e.action === 'mute')
      .map((e) => ({ targetId: e.targetId, targetHandle: e.targetHandle, mutedAt: e.timestamp }));

    return noCacheJsonResponse({ blocked, muted });
  }

  // ── POST: sync a block/mute action from the client ──
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const session = await requireSession(request, env);
  const address = session instanceof Response ? 'anonymous' : session.address;

  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { targetId, targetHandle, protocol, action } = body;

  if (!targetId || !action) {
    return jsonResponse({ error: 'targetId and action required' }, 400);
  }

  if (!['block', 'unblock', 'mute', 'unmute'].includes(action)) {
    return jsonResponse({ error: 'Invalid action' }, 400);
  }

  try {
    const raw = await env.CACHE?.get(modKey(address));
    const store: ModStore = raw ? JSON.parse(raw) : { entries: [] };

    if (action === 'block' || action === 'mute') {
      store.entries = store.entries.filter((e) => e.targetId !== targetId);
      store.entries.push({
        targetId,
        targetHandle: targetHandle || '',
        protocol,
        action,
        timestamp: Date.now(),
      });
    } else if (action === 'unblock') {
      store.entries = store.entries.filter(
        (e) => !(e.targetId === targetId && e.action === 'block'),
      );
    } else if (action === 'unmute') {
      store.entries = store.entries.filter(
        (e) => !(e.targetId === targetId && e.action === 'mute'),
      );
    }

    await env.CACHE?.put(modKey(address), JSON.stringify(store), {
      expirationTtl: 60 * 60 * 24 * 400,
    });

    return jsonResponse({ ok: true, action, targetId, protocol });
  } catch {
    return jsonResponse({ error: 'Failed to persist moderation state' }, 500);
  }
}
