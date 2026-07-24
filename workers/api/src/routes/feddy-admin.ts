/**
 * @degenfeed/api-worker — Feddy Communities: Admin Actions
 *
 * Moderator/owner actions: add moderator, ban member, unban member.
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import {
  addCommunityMember,
  addModLogEntry,
  banMember,
  getCommunityByName,
  getCommunityMembers,
  isBanned,
  setMemberRole,
  unbanMember,
  getMemberRole,
} from '../lib/feddy-store';
import {
  checkPremium,
  csrfCheck,
  requireModOrResponse,
  requireOwnerOrResponse,
  requireSession,
  sanitizeHtml,
  sanitizeString,
  shortenWallet,
} from './feddy-helpers';

const feddy = new Hono<{ Bindings: Env }>();

// ─── POST /api/feddy/:name/mod — Add moderator ─────────────────────

feddy.post('/:name/mod', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  const callerRole = await getMemberRole(c.env, community.id, session.address);
  if (callerRole !== 'owner' && callerRole !== 'moderator') {
    return jsonResponse({ error: 'Only owner and moderators can manage roles' }, 403);
  }

  interface ModBody {
    wallet?: string;
    action?: 'add' | 'remove';
  }

  let body: ModBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const targetWallet = sanitizeString(body.wallet ?? '', 128).toLowerCase();
  if (!targetWallet) {
    return jsonResponse({ error: 'Wallet address required' }, 400);
  }

  const action = body.action ?? 'add';

  if (action === 'add') {
    await setMemberRole(c.env, community.id, targetWallet, 'moderator');
    await addModLogEntry(c.env, {
      id: crypto.randomUUID(),
      communityId: community.id,
      action: 'change_role',
      moderatorWallet: session.address,
      targetWallet,
      reason: 'Promoted to moderator',
      details: { newRole: 'moderator' },
      createdAt: Date.now(),
    });
    return jsonResponse({ ok: true, role: 'moderator' });
  } else if (action === 'remove') {
    await setMemberRole(c.env, community.id, targetWallet, 'member');
    return jsonResponse({ ok: true, role: 'member' });
  }

  return jsonResponse({ error: 'Invalid action. Use "add" or "remove".' }, 400);
});

// ─── POST /api/feddy/:name/ban — Ban member ────────────────────────

feddy.post('/:name/ban', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  const callerRole = await getMemberRole(c.env, community.id, session.address);
  if (callerRole !== 'owner' && callerRole !== 'moderator') {
    return jsonResponse({ error: 'Only owner and moderators can ban members' }, 403);
  }

  interface BanBody {
    wallet?: string;
    reason?: string;
  }

  let body: BanBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const targetWallet = sanitizeString(body.wallet ?? '', 128).toLowerCase();
  if (!targetWallet) {
    return jsonResponse({ error: 'Wallet address required' }, 400);
  }

  if (targetWallet === community.owner) {
    return jsonResponse({ error: 'Cannot ban the community owner' }, 403);
  }

  const banned = await banMember(c.env, community.id, targetWallet);
  if (!banned) {
    return jsonResponse({ error: 'Failed to ban member' }, 500);
  }

  await addModLogEntry(c.env, {
    id: crypto.randomUUID(),
    communityId: community.id,
    action: 'ban',
    moderatorWallet: session.address,
    targetWallet,
    reason: sanitizeString(body.reason ?? 'No reason provided', 500),
    createdAt: Date.now(),
  });

  return jsonResponse({ ok: true, banned: targetWallet });
});

// ─── POST /api/feddy/:name/unban — Unban member ───────────────────

feddy.post('/:name/unban', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface UnbanBody {
    wallet?: string;
  }
  let body: UnbanBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const wallet = sanitizeString(body.wallet ?? '', 128).toLowerCase();
  if (!wallet) return jsonResponse({ error: 'Wallet required' }, 400);

  const unbanned = await unbanMember(c.env, community.id, wallet);
  if (!unbanned) return jsonResponse({ error: 'Failed to unban or not banned' }, 500);

  return jsonResponse({ ok: true, unbanned: wallet });
});

export default feddy;
