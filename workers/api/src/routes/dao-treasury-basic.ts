/**
 * @degenfeed/api-worker — Basic DAO Treasury operations (KV-based)
 *
 * These are distinct from the Service-based handlers in dao-treasury.ts.
 * Both are used by app.ts route registrations.
 */

import { jsonResponse } from '../response-helpers';
import { sanitizeString } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';
import {
  checkDaoMember,
  generateId,
  getDaoOr404,
  KV,
  kvAppendToList,
  kvGet,
  kvGetList,
  kvPut,
  nonceId,
  recordActivity,
} from './dao-core';
import type {
  GrantProgram,
  Proposal,
  TreasuryOverview,
  TreasuryStream,
  TreasuryTransaction,
} from './dao-types';

export async function handleDaoTreasuryOverview(
  _request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const treasury = await kvGet<TreasuryOverview>(kv, `dao:treasury:${daoId}`);
  if (!treasury)
    return jsonResponse({
      totalBalance: '0',
      tokenCount: 0,
      tokens: [],
      nativeBalance: '0',
      nativeValueUsd: 0,
      updatedAt: Date.now(),
    });
  return jsonResponse({ treasury });
}

export async function handleDaoTreasuryTransactions(
  _request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const txIds = await kvGetList<string>(kv, `dao:treasury:tx:idx:${daoId}`);
  const txs = (
    await Promise.all(
      txIds.map((txId) => kvGet<TreasuryTransaction>(kv, `dao:treasury:tx:${txId}`)),
    )
  ).filter((tx): tx is TreasuryTransaction => tx !== null);
  txs.sort((a, b) => b.timestamp - a.timestamp);
  return jsonResponse({ data: txs, meta: { total: txs.length, daoId } });
}

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
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const to = typeof body.to === 'string' ? body.to.trim() : '';
  const _tokenAddress =
    typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : undefined;
  const tokenSymbol = sanitizeString(body.tokenSymbol, 16);
  const amount = typeof body.amount === 'string' ? body.amount : '';
  const description = sanitizeString(body.description, 1000);
  if (!to) return jsonResponse({ error: 'Recipient address (to) is required' }, 400);
  if (!amount) return jsonResponse({ error: 'Amount is required' }, 400);
  const proposalId = generateId('prop');
  const now = Date.now();
  const proposal: Proposal = {
    id: proposalId,
    daoId,
    title: `Treasury transfer: ${amount} ${tokenSymbol || 'ETH'} → ${to.slice(0, 10)}...`,
    description: description || `Transfer ${amount} ${tokenSymbol || 'tokens'} to ${to}`,
    creator: wallet,
    createdAt: now,
    startAt: now,
    endAt: now + 3 * 86400 * 1000,
    status: 'active',
    type: 'transfer',
    targets: [to],
    values: [amount],
  };
  await Promise.all([
    kvPut(kv, KV.proposal(daoId, proposalId), proposal),
    kvAppendToList(kv, KV.proposalIdx(daoId), proposalId),
  ]);
  return jsonResponse(
    {
      success: true,
      message: 'Transfer requires approval. A proposal has been created.',
      proposal,
    },
    201,
  );
}

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
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const recipient = typeof body.recipient === 'string' ? body.recipient.trim().toLowerCase() : '';
  const tokenAddress = typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : '';
  const tokenSymbol = sanitizeString(body.tokenSymbol, 16) || 'ETH';
  const totalAmount = typeof body.totalAmount === 'string' ? body.totalAmount : '';
  const durationDays = typeof body.durationDays === 'number' ? body.durationDays : 30;
  const intervalHours = typeof body.intervalHours === 'number' ? body.intervalHours : 24;
  const _description = sanitizeString(body.description, 1000);
  if (!recipient) return jsonResponse({ error: 'recipient is required' }, 400);
  if (!totalAmount) return jsonResponse({ error: 'totalAmount is required' }, 400);
  const now = Date.now();
  const endTime = now + durationDays * 86400 * 1000;
  const interval = intervalHours * 3600 * 1000;
  const intervals = Math.floor((endTime - now) / interval);
  const amountPerInterval =
    intervals > 0 ? (BigInt(totalAmount) / BigInt(intervals)).toString() : totalAmount;
  const streamId = generateId('stream');
  const stream: TreasuryStream = {
    id: streamId,
    daoId,
    recipient,
    tokenAddress,
    tokenSymbol,
    totalAmount,
    releasedAmount: '0',
    startTime: now,
    endTime,
    interval,
    amountPerInterval,
    status: 'active',
    createdBy: wallet,
    createdAt: now,
  };
  await Promise.all([
    kvPut(kv, `dao:treasury:stream:${streamId}`, stream),
    kvAppendToList(kv, `dao:treasury:stream:idx:${daoId}`, streamId),
  ]);
  const tx: TreasuryTransaction = {
    id: nonceId(),
    daoId,
    type: 'stream',
    from: daoId,
    to: recipient,
    tokenAddress,
    tokenSymbol,
    amount: totalAmount,
    valueUsd: 0,
    timestamp: now,
    status: 'confirmed',
  };
  await kvPut(kv, `dao:treasury:tx:${tx.id}`, tx);
  await kvAppendToList(kv, `dao:treasury:tx:idx:${daoId}`, tx.id);
  await recordActivity(env, daoId, 'treasury_stream_started', wallet, {
    streamId,
    recipient,
    amount: totalAmount,
  });
  return jsonResponse({ success: true, stream }, 201);
}

export async function handleDaoTreasuryStreams(
  _request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const streamIds = await kvGetList<string>(kv, `dao:treasury:stream:idx:${daoId}`);
  const streams = (
    await Promise.all(
      streamIds.map((sid) => kvGet<TreasuryStream>(kv, `dao:treasury:stream:${sid}`)),
    )
  ).filter((s): s is TreasuryStream => s !== null);
  streams.sort((a, b) => b.createdAt - a.createdAt);
  return jsonResponse({ data: streams, meta: { total: streams.length, daoId } });
}

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
  const stream = await kvGet<TreasuryStream>(kv, `dao:treasury:stream:${streamId}`);
  if (!stream) return jsonResponse({ error: 'Stream not found' }, 404);
  if (stream.daoId !== daoId)
    return jsonResponse({ error: 'Stream does not belong to this DAO' }, 404);
  const wallet = session.address.toLowerCase();
  if (stream.createdBy !== wallet)
    return jsonResponse({ error: 'Only the stream creator can cancel' }, 403);
  stream.status = 'cancelled';
  stream.cancelledAt = Date.now();
  await kvPut(kv, `dao:treasury:stream:${streamId}`, stream);
  return jsonResponse({ success: true, stream });
}

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
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const title = sanitizeString(body.title, 200);
  const description = sanitizeString(body.description, 5000);
  const totalBudget = typeof body.totalBudget === 'string' ? body.totalBudget : '';
  const tokenAddress = typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : '';
  const tokenSymbol = sanitizeString(body.tokenSymbol, 16) || 'ETH';
  const recipient = typeof body.recipient === 'string' ? body.recipient.trim().toLowerCase() : '';
  const milestonesRaw = Array.isArray(body.milestones)
    ? (body.milestones as Array<Record<string, unknown>>)
    : [];
  if (!title || title.length < 4)
    return jsonResponse({ error: 'Title must be at least 4 characters' }, 400);
  if (!totalBudget) return jsonResponse({ error: 'totalBudget is required' }, 400);
  if (!recipient) return jsonResponse({ error: 'recipient is required' }, 400);
  const milestones = milestonesRaw.map((m) => ({
    id: generateId('ms'),
    title: sanitizeString(m.title, 200) || 'Milestone',
    description: sanitizeString(m.description, 2000) || '',
    amount: typeof m.amount === 'string' ? m.amount : '0',
    status: 'pending' as const,
  }));
  const grantId = generateId('grant');
  const grant: GrantProgram = {
    id: grantId,
    daoId,
    title,
    description,
    totalBudget,
    remainingBudget: totalBudget,
    tokenAddress,
    tokenSymbol,
    milestones,
    recipient,
    status: 'active',
    createdBy: wallet,
    createdAt: Date.now(),
  };
  await Promise.all([
    kvPut(kv, `dao:treasury:grant:${grantId}`, grant),
    kvAppendToList(kv, `dao:treasury:grant:idx:${daoId}`, grantId),
  ]);
  await recordActivity(env, daoId, 'grant_created', wallet, { grantId, title, totalBudget });
  return jsonResponse({ success: true, grant }, 201);
}

export async function handleDaoTreasuryGrants(
  _request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const grantIds = await kvGetList<string>(kv, `dao:treasury:grant:idx:${daoId}`);
  const grants = (
    await Promise.all(grantIds.map((gid) => kvGet<GrantProgram>(kv, `dao:treasury:grant:${gid}`)))
  ).filter((g): g is GrantProgram => g !== null);
  grants.sort((a, b) => b.createdAt - a.createdAt);
  return jsonResponse({ data: grants, meta: { total: grants.length, daoId } });
}

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
  const grant = await kvGet<GrantProgram>(kv, `dao:treasury:grant:${grantId}`);
  if (!grant) return jsonResponse({ error: 'Grant not found' }, 404);
  if (grant.daoId !== daoId)
    return jsonResponse({ error: 'Grant does not belong to this DAO' }, 404);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const milestoneId = typeof body.milestoneId === 'string' ? body.milestoneId : '';
  if (!milestoneId) return jsonResponse({ error: 'milestoneId is required' }, 400);
  const milestone = grant.milestones.find((m) => m.id === milestoneId);
  if (!milestone) return jsonResponse({ error: 'Milestone not found' }, 404);
  if (milestone.status === 'completed')
    return jsonResponse({ error: 'Milestone already completed' }, 400);
  milestone.status = 'completed';
  milestone.completedAt = Date.now();
  grant.remainingBudget = (BigInt(grant.remainingBudget) - BigInt(milestone.amount)).toString();
  if (grant.milestones.every((m) => m.status === 'completed')) grant.status = 'completed';
  await kvPut(kv, `dao:treasury:grant:${grantId}`, grant);
  await recordActivity(env, daoId, 'grant_milestone_completed', session.address.toLowerCase(), {
    grantId,
    milestoneId: milestone.id,
    title: milestone.title,
  });
  return jsonResponse({ success: true, grant });
}
