/**
 * @degenfeed/api-worker — Feddy Communities: Moderation
 *
 * Reports, appeals, moderation log, keyword filters, link blocklist,
 * and federation blocklist management.
 */

import { Hono } from 'hono';
import type { Appeal, Report, ReportCategory } from '../lib/feddy-store';
import {
  addFedBlocklistEntry,
  createAppeal,
  createReport,
  type FedBlocklistEntry,
  getAppeals,
  getCommunityByName,
  getFedBlocklist,
  getKeywordFilters,
  getLinkBlocklist,
  getModLog,
  getReports,
  isBanned,
  type KeywordFilter,
  REPORT_CATEGORIES,
  resolveAppeal,
  setKeywordFilters,
  setLinkBlocklist,
  unbanMember,
  updateReportStatus,
} from '../lib/feddy-store';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import { csrfCheck, requireModOrResponse, requireSession, sanitizeString } from './feddy-helpers';

const feddy = new Hono<{ Bindings: Env }>();

// ─── Reports ───────────────────────────────────────────────────────────

feddy.post('/:name/reports', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  interface ReportBody {
    targetWallet?: string;
    targetPostId?: string;
    category?: ReportCategory;
    description?: string;
    evidenceUrls?: string[];
  }
  let body: ReportBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.targetWallet) return jsonResponse({ error: 'targetWallet required' }, 400);

  const category = body.category ?? 'other';
  if (!REPORT_CATEGORIES.includes(category)) {
    return jsonResponse({ error: `Invalid category. Use: ${REPORT_CATEGORIES.join(', ')}` }, 400);
  }

  const report: Report = {
    id: crypto.randomUUID(),
    communityId: community.id,
    reporterWallet: session.address,
    targetWallet: sanitizeString(body.targetWallet, 128).toLowerCase(),
    targetPostId: body.targetPostId ? sanitizeString(body.targetPostId, 64) : undefined,
    category,
    description: sanitizeString(body.description ?? '', 2000),
    evidenceUrls: body.evidenceUrls?.map((u) => sanitizeString(u, 500)).slice(0, 5),
    status: 'open',
    createdAt: Date.now(),
  };

  await createReport(c.env, report);
  return jsonResponse(report, 201);
});

feddy.get('/:name/reports', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  const reports = await getReports(c.env, community.id);
  return noCacheJsonResponse({ reports });
});

feddy.put('/:name/reports/:rid', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const reportId = sanitizeString(c.req.param('rid'), 64);
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface ReportUpdate {
    status?: string;
    resolution?: string;
  }
  let body: ReportUpdate;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const validStatuses = ['open', 'investigating', 'resolved', 'dismissed'];
  if (body.status && !validStatuses.includes(body.status)) {
    return jsonResponse({ error: `Invalid status. Use: ${validStatuses.join(', ')}` }, 400);
  }

  await updateReportStatus(
    c.env,
    community.id,
    reportId,
    (body.status ?? 'resolved') as Report['status'],
    session.address,
    sanitizeString(body.resolution ?? '', 1000),
  );

  return jsonResponse({ ok: true });
});

// ─── Appeals ───────────────────────────────────────────────────────────

feddy.post('/:name/appeals', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const banned = await isBanned(c.env, community.id, session.address);
  if (!banned) return jsonResponse({ error: 'You are not banned from this community' }, 403);

  interface AppealBody {
    reason?: string;
  }
  let body: AppealBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const reason = sanitizeString(body.reason ?? '', 2000);
  if (!reason || reason.length < 10)
    return jsonResponse({ error: 'Reason must be at least 10 characters' }, 400);

  const appeal: Appeal = {
    id: crypto.randomUUID(),
    communityId: community.id,
    wallet: session.address,
    reason,
    status: 'pending',
    createdAt: Date.now(),
  };

  await createAppeal(c.env, appeal);
  return jsonResponse(appeal, 201);
});

feddy.get('/:name/appeals', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  const appeals = await getAppeals(c.env, community.id);
  return noCacheJsonResponse({ appeals });
});

feddy.put('/:name/appeals/:aid', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const appealId = sanitizeString(c.req.param('aid'), 64);
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface AppealResolve {
    status?: 'granted' | 'denied';
    note?: string;
  }
  let body: AppealResolve;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.status || !['granted', 'denied'].includes(body.status)) {
    return jsonResponse({ error: 'Status must be "granted" or "denied"' }, 400);
  }

  const resolved = await resolveAppeal(
    c.env,
    community.id,
    appealId,
    body.status,
    session.address,
    sanitizeString(body.note ?? '', 1000),
  );

  if (!resolved) return jsonResponse({ error: 'Appeal not found' }, 404);

  // If granted, unban the user
  if (body.status === 'granted') {
    const appeal = (await getAppeals(c.env, community.id)).find((a) => a.id === appealId);
    if (appeal) {
      await unbanMember(c.env, community.id, appeal.wallet);
    }
  }

  return jsonResponse({ ok: true, status: body.status });
});

// ─── Mod Log ───────────────────────────────────────────────────────────

feddy.get('/:name/mod-log', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  const log = await getModLog(c.env, community.id);
  return noCacheJsonResponse({ log });
});

// ─── Auto-Mod / Keyword Filters ────────────────────────────────────────

feddy.post('/:name/auto-mod', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface AutoModBody {
    filters?: Array<{
      pattern?: string;
      isRegex?: boolean;
      action?: 'flag' | 'block' | 'require_approval';
    }>;
  }
  let body: AutoModBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const filters: KeywordFilter[] = (body.filters ?? []).map((f) => ({
    id: crypto.randomUUID(),
    pattern: sanitizeString(f.pattern ?? '', 500),
    isRegex: f.isRegex ?? false,
    action: f.action ?? 'flag',
    createdAt: Date.now(),
    createdBy: session.address,
  }));

  await setKeywordFilters(c.env, community.id, filters);
  return jsonResponse({ ok: true, filters });
});

feddy.get('/:name/auto-mod', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const filters = await getKeywordFilters(c.env, community.id);
  return noCacheJsonResponse({ filters });
});

// ─── Link Blocklist ────────────────────────────────────────────────────

feddy.post('/:name/blocklist', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface BlocklistBody {
    domains?: string[];
  }
  let body: BlocklistBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const domains = (body.domains ?? []).map((d) => sanitizeString(d, 200)).filter(Boolean);
  await setLinkBlocklist(c.env, community.id, domains);
  return jsonResponse({ ok: true, domains });
});

feddy.get('/:name/blocklist', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const domains = await getLinkBlocklist(c.env, community.id);
  return noCacheJsonResponse({ domains });
});

// ─── Federation Blocklist ──────────────────────────────────────────────

feddy.post('/:name/fed-blocklist', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface FedBlockBody {
    instanceUrl?: string;
    reason?: string;
  }
  let body: FedBlockBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.instanceUrl) return jsonResponse({ error: 'instanceUrl required' }, 400);

  const entry: FedBlocklistEntry = {
    instanceUrl: sanitizeString(body.instanceUrl, 500),
    reason: sanitizeString(body.reason ?? '', 500),
    blockedBy: session.address,
    blockedAt: Date.now(),
  };

  await addFedBlocklistEntry(c.env, community.id, entry);
  return jsonResponse({ ok: true, blocked: entry.instanceUrl });
});

feddy.get('/:name/fed-blocklist', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const blocklist = await getFedBlocklist(c.env, community.id);
  return noCacheJsonResponse({ blocklist });
});

export default feddy;
