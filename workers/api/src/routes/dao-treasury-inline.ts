/**
 * @degenfeed/api-worker — DAO Treasury Route Handlers (inline from dao.ts)
 *
 * Treasury handlers extracted from the original dao.ts monolithic file.
 * Shares types and helpers from dao-crud.ts.
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import {
  getDaoOr404, checkDaoMember, kvGet, kvPut, kvGetList, kvAppendToList, KV, generateId, recordActivity,
} from './dao-crud';
import type { Dao, TreasuryOverview, TreasuryTransaction, TreasuryStream, GrantProgram, ActivityType } from './dao-crud';

// ─── GET /api/dao/:daoId/treasury — Treasury overview ───────────────

export async function handleDaoTreasuryOverview(
  _request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const treasury = await kvGet<TreasuryOverview>(kv, KV.treasury(daoId));
  return jsonResponse({ data: treasury ?? { totalBalance: '0', tokenCount: 0, tokens: [], nativeBalance: '0', nativeValueUsd: 0, updatedAt: Date.now() } });
}

// ─── GET /api/dao/:daoId/treasury/transactions — List transactions ──

export async function handleDaoTreasuryTransactions(
  _request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const txIds = await kvGetList<string>(kv, KV.treasuryTxIdx(daoId));
  const txs = await Promise.all(txIds.map((txId) => kvGet<TreasuryTransaction>(kv, KV.treasuryTx(txId))));
  const validTxs = txs.filter((tx): tx is TreasuryTransaction => tx !== null);
  validTxs.sort((a, b) => b.timestamp - a.timestamp);

  return jsonResponse({ data: validTxs, meta: { total: validTxs.length, daoId } });
}

// ─── POST /api/dao/:daoId/treasury/transfer — Execute transfer ────

export async function handleDaoTreasuryTransfer(
  request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const wallet = session.address.toLowerCase();
  const membershipError = await checkDaoMember(env, daoId, wallet);
  if (membershipError) return membershipError;

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  const to = typeof body.to === 'string' ? body.to.trim().toLowerCase() : '';
  const amount = typeof body.amount === 'string' ? body.amount : '';
  const tokenAddress = typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : '';
  const tokenSymbol = sanitizeString(body.tokenSymbol, 16) || 'ETH';

  if (!to) return jsonResponse({ error: 'Recipient address (to) is required' }, 400);
  if (!amount) return jsonResponse({ error: 'Amount is required' }, 400);

  const txId = generateId('tx');
  const tx: TreasuryTransaction = {
    id: txId, daoId, type: 'transfer', from: wallet, to, tokenAddress, tokenSymbol, amount,
    valueUsd: 0, timestamp: Date.now(), status: 'pending',
  };

  await Promise.all([kvPut(kv, KV.treasuryTx(txId), tx), kvAppendToList(kv, KV.treasuryTxIdx(daoId), txId)]);
  await recordActivity(env, daoId, 'treasury_transfer', wallet, { txId, to, amount, tokenSymbol });

  return jsonResponse({ success: true, transaction: tx }, 201);
}

// ─── POST /api/dao/:daoId/treasury/stream — Create streaming payment ─

export async function handleDaoTreasuryStreamCreate(
  request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const wallet = session.address.toLowerCase();
  const membershipError = await checkDaoMember(env, daoId, wallet);
  if (membershipError) return membershipError;

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  const recipient = typeof body.recipient === 'string' ? body.recipient.trim().toLowerCase() : '';
  const totalAmount = typeof body.totalAmount === 'string' ? body.totalAmount : '';
  const tokenAddress = typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : '';
  const tokenSymbol = sanitizeString(body.tokenSymbol, 16) || 'ETH';
  const startTime = typeof body.startTime === 'number' ? body.startTime : Date.now();
  const endTime = typeof body.endTime === 'number' ? body.endTime : startTime + 30 * 86400 * 1000;
  const interval = typeof body.interval === 'number' ? body.interval : 7 * 86400 * 1000;

  if (!recipient) return jsonResponse({ error: 'recipient is required' }, 400);
  if (!totalAmount) return jsonResponse({ error: 'totalAmount is required' }, 400);

  const streamId = generateId('stream');
  const amountPerInterval = (Number.parseFloat(totalAmount) / Math.ceil((endTime - startTime) / interval)).toFixed(6);
  const stream: TreasuryStream = {
    id: streamId, daoId, recipient, tokenAddress, tokenSymbol, totalAmount, releasedAmount: '0',
    startTime, endTime, interval, amountPerInterval, status: 'active', createdBy: wallet, createdAt: Date.now(),
  };

  await Promise.all([kvPut(kv, KV.treasuryStream(streamId), stream), kvAppendToList(kv, KV.treasuryStreamIdx(daoId), streamId)]);
  await recordActivity(env, daoId, 'treasury_stream_started', wallet, { streamId, recipient, totalAmount });

  return jsonResponse({ success: true, stream }, 201);
}

// ─── GET /api/dao/:daoId/treasury/streams — List active streams ────

export async function handleDaoTreasuryStreams(
  _request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const streamIds = await kvGetList<string>(kv, KV.treasuryStreamIdx(daoId));
  const streams = await Promise.all(streamIds.map((sid) => kvGet<TreasuryStream>(kv, KV.treasuryStream(sid))));
  const validStreams = streams.filter((s): s is TreasuryStream => s !== null);
  validStreams.sort((a, b) => b.createdAt - a.createdAt);

  return jsonResponse({ data: validStreams, meta: { total: validStreams.length, daoId } });
}

// ─── DELETE /api/dao/:daoId/treasury/streams/:streamId — Cancel stream ─

export async function handleDaoTreasuryStreamDelete(
  request: Request,
  env: Env,
  daoId: string,
  streamId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const stream = await kvGet<TreasuryStream>(kv, KV.treasuryStream(streamId));
  if (!stream) return jsonResponse({ error: 'Stream not found' }, 404);
  if (stream.daoId !== daoId) return jsonResponse({ error: 'Stream does not belong to this DAO' }, 404);

  const wallet = session.address.toLowerCase();
  if (stream.createdBy !== wallet) return jsonResponse({ error: 'Only the stream creator can cancel' }, 403);

  stream.status = 'cancelled';
  stream.cancelledAt = Date.now();
  await kvPut(kv, KV.treasuryStream(streamId), stream);

  return jsonResponse({ success: true, stream });
}

// ─── POST /api/dao/:daoId/treasury/grant — Create a grant program ────

export async function handleDaoTreasuryGrantCreate(
  request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const wallet = session.address.toLowerCase();
  const membershipError = await checkDaoMember(env, daoId, wallet);
  if (membershipError) return membershipError;

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  const title = sanitizeString(body.title, 200);
  const description = sanitizeString(body.description, 5000);
  const totalBudget = typeof body.totalBudget === 'string' ? body.totalBudget : '';
  const tokenAddress = typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : '';
  const tokenSymbol = sanitizeString(body.tokenSymbol, 16) || 'ETH';
  const recipient = typeof body.recipient === 'string' ? body.recipient.trim().toLowerCase() : '';
  const milestonesRaw = Array.isArray(body.milestones) ? (body.milestones as Array<Record<string, unknown>>) : [];

  if (!title || title.length < 4) return jsonResponse({ error: 'Title must be at least 4 characters' }, 400);
  if (!totalBudget) return jsonResponse({ error: 'totalBudget is required' }, 400);
  if (!recipient) return jsonResponse({ error: 'recipient is required' }, 400);

  const milestones = milestonesRaw.map((m) => ({ id: generateId('ms'), title: sanitizeString(m.title, 200) || 'Milestone', description: sanitizeString(m.description, 2000) || '', amount: typeof m.amount === 'string' ? m.amount : '0', status: 'pending' as const }));

  const grantId = generateId('grant');
  const grant: GrantProgram = { id: grantId, daoId, title, description, totalBudget, remainingBudget: totalBudget, tokenAddress, tokenSymbol, milestones, recipient, status: 'active', createdBy: wallet, createdAt: Date.now() };

  await Promise.all([kvPut(kv, KV.treasuryGrant(grantId), grant), kvAppendToList(kv, KV.treasuryGrantIdx(daoId), grantId)]);
  await recordActivity(env, daoId, 'grant_created', wallet, { grantId, title, totalBudget });

  return jsonResponse({ success: true, grant }, 201);
}

// ─── GET /api/dao/:daoId/treasury/grants — Active grants ────────────

export async function handleDaoTreasuryGrants(
  _request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const grantIds = await kvGetList<string>(kv, KV.treasuryGrantIdx(daoId));
  const grants = await Promise.all(grantIds.map((gid) => kvGet<GrantProgram>(kv, KV.treasuryGrant(gid))));
  const validGrants = grants.filter((g): g is GrantProgram => g !== null);
  validGrants.sort((a, b) => b.createdAt - a.createdAt);

  return jsonResponse({ data: validGrants, meta: { total: validGrants.length, daoId } });
}

// ─── POST /api/dao/:daoId/treasury/grant/:grantId/milestone — Complete milestone ─

export async function handleDaoTreasuryGrantMilestone(
  request: Request,
  env: Env,
  daoId: string,
  grantId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const grant = await kvGet<GrantProgram>(kv, KV.treasuryGrant(grantId));
  if (!grant) return jsonResponse({ error: 'Grant not found' }, 404);
  if (grant.daoId !== daoId) return jsonResponse({ error: 'Grant does not belong to this DAO' }, 404);

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  const milestoneId = typeof body.milestoneId === 'string' ? body.milestoneId : '';
  if (!milestoneId) return jsonResponse({ error: 'milestoneId is required' }, 400);

  const milestone = grant.milestones.find((m) => m.id === milestoneId);
  if (!milestone) return jsonResponse({ error: 'Milestone not found' }, 404);
  if (milestone.status === 'completed') return jsonResponse({ error: 'Milestone already completed' }, 400);

  milestone.status = 'completed';
  milestone.completedAt = Date.now();

  const remaining = BigInt(grant.remainingBudget);
  const spent = BigInt(milestone.amount);
  grant.remainingBudget = (remaining - spent).toString();

  const allCompleted = grant.milestones.every((m) => m.status === 'completed');
  if (allCompleted) grant.status = 'completed';

  await kvPut(kv, KV.treasuryGrant(grantId), grant);
  await recordActivity(env, daoId, 'grant_milestone_completed', session.address.toLowerCase(), { grantId, milestoneId: milestone.id, title: milestone.title });

  return jsonResponse({ success: true, grant });
}
