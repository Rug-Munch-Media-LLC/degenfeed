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

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

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

async function requireAdmin(request: Request, env: Env): Promise<{ address: string } | Response> {
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
  action: string;
  timestamp: number;
  /** For word mutes */
  word?: string;
  /** For community actions */
  communityId?: string;
  communityName?: string;
  instance?: string;
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
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    postId?: string;
    reason?: string;
    protocol?: string;
    description?: string;
  };
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
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

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
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

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
    await env.REPORTS?.put(
      removedPostKey,
      JSON.stringify({
        removedBy: admin.address,
        removedAt: Date.now(),
        reportId,
      }),
      { expirationTtl: 60 * 60 * 24 * 90 },
    ); // 90 days

    return jsonResponse({
      ok: true,
      reportId,
      postId: report.postId,
      action: 'removed',
    });
  } catch {
    return jsonResponse({ error: 'Failed to remove post' }, 500);
  }
}

// ─── POST /api/moderation/ban — Ban a user across all protocols ─────

export async function handleBanUser(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  let body: {
    userId?: string;
    protocol?: string;
    reason?: string;
    walletAddress?: string;
  };
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
      await env.REPORTS?.put(
        banKey(walletBanId),
        JSON.stringify({
          ...banEntry,
          userId: body.walletAddress,
          protocol: 'all',
        }),
        { expirationTtl: 60 * 60 * 24 * 400 },
      );
      if (!idx.ids.includes(walletBanId)) {
        idx.ids.push(walletBanId);
      }
      await env.REPORTS?.put(banIndexKey(), JSON.stringify(idx));
    }

    return jsonResponse({
      ok: true,
      banId,
      userId: body.userId,
      protocol: body.protocol || 'all',
    });
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
        reportedUserCounts[report.postAuthorId] =
          (reportedUserCounts[report.postAuthorId] ?? 0) + 1;
      }
    } catch {
      // skip
    }
  }

  const total = ids.length;
  const resolutionRate = total > 0 ? (totalResolved + totalDismissed) / total : 0;

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
// Block/mute sync — also supports communities and words
// ═════════════════════════════════════════════════════════════════════

interface SyncBody {
  targetId?: string;
  targetHandle?: string;
  protocol?: string;
  action: string;
  word?: string;
  communityId?: string;
  communityName?: string;
  instance?: string;
}

function _modStoreKey(address: string): string {
  return `user:moderation:${address.toLowerCase()}`;
}

export async function handleBlockSync(request: Request, env: Env): Promise<Response> {
  // ── GET: return all moderation state for the authenticated user ──
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
      .map((e) => ({
        targetId: e.targetId,
        targetHandle: e.targetHandle,
        mutedAt: e.timestamp,
      }));
    const mutedWords = store.entries
      .filter((e) => e.action === 'mute_word')
      .map((e) => ({ word: e.word, mutedAt: e.timestamp }));
    const mutedCommunities = store.entries
      .filter((e) => e.action === 'mute_community')
      .map((e) => ({
        communityId: e.communityId,
        communityName: e.communityName,
        instance: e.instance,
        mutedAt: e.timestamp,
      }));
    const blockedCommunities = store.entries
      .filter((e) => e.action === 'block_community')
      .map((e) => ({
        communityId: e.communityId,
        communityName: e.communityName,
        instance: e.instance,
        blockedAt: e.timestamp,
      }));

    return noCacheJsonResponse({
      blocked,
      muted,
      mutedWords,
      mutedCommunities,
      blockedCommunities,
    });
  }

  // ── POST: sync a moderation action from the client ──
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  const address = session instanceof Response ? 'anonymous' : session.address;

  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { targetId, targetHandle, protocol, action, word, communityId, communityName, instance } =
    body;

  if (!action) {
    return jsonResponse({ error: 'action required' }, 400);
  }

  const validActions = [
    'block',
    'unblock',
    'mute',
    'unmute',
    'mute_word',
    'unmute_word',
    'mute_community',
    'unmute_community',
    'block_community',
    'unblock_community',
  ];

  if (!validActions.includes(action)) {
    return jsonResponse({ error: `Invalid action: ${action}` }, 400);
  }

  const addr = address.toLowerCase();

  try {
    // Store in the moderation store for cross-device sync
    const raw = await env.CACHE?.get(modKey(addr));
    const store: ModStore = raw ? JSON.parse(raw) : { entries: [] };

    // ── User block/unblock ──
    if (action === 'block' || action === 'mute') {
      if (!targetId) return jsonResponse({ error: 'targetId required' }, 400);
      store.entries = store.entries.filter(
        (e) => !(e.targetId === targetId && (e.action === 'block' || e.action === 'mute')),
      );
      store.entries.push({
        targetId,
        targetHandle: targetHandle || '',
        protocol: protocol || '',
        action,
        timestamp: Date.now(),
      });
      // Also write to dedicated KV for feed pipeline
      const setKey =
        action === 'block' ? `user:muted_authors:${addr}` : `user:muted_authors:${addr}`;
      await syncUserSet(env, setKey, targetId, action === 'block' ? 'add' : 'add');
    } else if (action === 'unblock') {
      if (!targetId) return jsonResponse({ error: 'targetId required' }, 400);
      store.entries = store.entries.filter(
        (e) => !(e.targetId === targetId && e.action === 'block'),
      );
      await syncUserSet(env, `user:muted_authors:${addr}`, targetId, 'remove');
    } else if (action === 'unmute') {
      if (!targetId) return jsonResponse({ error: 'targetId required' }, 400);
      store.entries = store.entries.filter(
        (e) => !(e.targetId === targetId && e.action === 'mute'),
      );
      await syncUserSet(env, `user:muted_authors:${addr}`, targetId, 'remove');
    }

    // ── Word mute/unmute ──
    if (action === 'mute_word') {
      if (!word) return jsonResponse({ error: 'word required' }, 400);
      store.entries = store.entries.filter((e) => !(e.word === word && e.action === 'mute_word'));
      store.entries.push({
        targetId: '',
        targetHandle: '',
        protocol: '',
        action,
        word,
        timestamp: Date.now(),
      });
      await syncUserSet(env, `user:muted_words:${addr}`, word, 'add');
    } else if (action === 'unmute_word') {
      if (!word) return jsonResponse({ error: 'word required' }, 400);
      store.entries = store.entries.filter((e) => !(e.word === word && e.action === 'mute_word'));
      await syncUserSet(env, `user:muted_words:${addr}`, word, 'remove');
    }

    // ── Community mute/unmute/block/unblock ──
    if (action === 'mute_community' || action === 'block_community') {
      if (!communityId) return jsonResponse({ error: 'communityId required' }, 400);
      store.entries = store.entries.filter(
        (e) =>
          !(
            e.communityId === communityId &&
            (e.action === 'mute_community' || e.action === 'block_community')
          ),
      );
      store.entries.push({
        targetId: '',
        targetHandle: '',
        protocol: '',
        action,
        communityId,
        communityName: communityName || '',
        instance,
        timestamp: Date.now(),
      });
      const setKey =
        action === 'mute_community'
          ? `user:muted_communities:${addr}`
          : `user:blocked_communities:${addr}`;
      await syncUserSet(env, setKey, communityId, 'add');
    } else if (action === 'unmute_community' || action === 'unblock_community') {
      if (!communityId) return jsonResponse({ error: 'communityId required' }, 400);
      store.entries = store.entries.filter(
        (e) =>
          !(
            e.communityId === communityId &&
            (e.action === 'mute_community' || e.action === 'block_community')
          ),
      );
      const setKey =
        action === 'unmute_community'
          ? `user:muted_communities:${addr}`
          : `user:blocked_communities:${addr}`;
      await syncUserSet(env, setKey, communityId, 'remove');
    }

    await env.CACHE?.put(modKey(addr), JSON.stringify(store), {
      expirationTtl: 60 * 60 * 24 * 400,
    });

    return jsonResponse({ ok: true, action, targetId, protocol });
  } catch (err) {
    console.error('[moderation] sync failed:', err instanceof Error ? err.message : err);
    return jsonResponse({ error: 'Failed to persist moderation state' }, 500);
  }
}

/** Helper: add/remove a value from a JSON-encoded Set in KV. */
async function syncUserSet(
  env: Env,
  key: string,
  value: string,
  op: 'add' | 'remove',
): Promise<void> {
  if (!env.CACHE) return;
  try {
    const raw = await env.CACHE.get(key);
    const set: string[] = raw ? JSON.parse(raw) : [];
    if (op === 'add') {
      if (!set.includes(value)) set.push(value);
    } else {
      const idx = set.indexOf(value);
      if (idx !== -1) set.splice(idx, 1);
    }
    await env.CACHE.put(key, JSON.stringify(set), {
      expirationTtl: 60 * 60 * 24 * 400,
    });
  } catch {
    // non-critical
  }
}
