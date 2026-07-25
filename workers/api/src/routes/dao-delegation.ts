/**
 * @degenfeed/api-worker — DAO Delegation endpoints
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import { requireSession } from '../session';
import {
  checkDaoMember,
  getDaoOr404,
  KV,
  kvGet,
  kvGetList,
  kvPut,
  recordActivity,
} from './dao-core';
import type { Delegation } from './dao-types';

export async function handleDaoDelegate(
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

  const delegate = typeof body.delegate === 'string' ? body.delegate.trim().toLowerCase() : '';
  const amount = typeof body.amount === 'number' ? Math.max(1, body.amount) : 1;

  if (!delegate) return jsonResponse({ error: 'delegate address is required' }, 400);
  if (delegate === wallet) return jsonResponse({ error: 'Cannot delegate to yourself' }, 400);

  const delegation: Delegation = { delegator: wallet, delegate, amount, timestamp: Date.now() };
  await kvPut(kv, KV.delegation(daoId, wallet), delegation);

  // Update delegates index
  const delegates = await kvGetList<{ address: string; totalDelegated: number }>(
    kv,
    KV.delegates(daoId),
  );
  const existingDelegate = delegates.find((d) => d.address === delegate);
  if (existingDelegate) {
    existingDelegate.totalDelegated += amount;
  } else {
    delegates.push({ address: delegate, totalDelegated: amount });
  }
  delegates.sort((a, b) => b.totalDelegated - a.totalDelegated);
  await kvPut(kv, KV.delegates(daoId), delegates);

  await recordActivity(env, daoId, 'delegation_changed', wallet, { delegate, amount });
  return jsonResponse({ success: true, delegation });
}

export async function handleDaoRevokeDelegation(
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

  const existing = await kvGet<Delegation>(kv, KV.delegation(daoId, wallet));
  if (existing) {
    const delegates = await kvGetList<{ address: string; totalDelegated: number }>(
      kv,
      KV.delegates(daoId),
    );
    const delegateIdx = delegates.findIndex((d) => d.address === existing.delegate);
    if (delegateIdx !== -1) {
      const d = delegates[delegateIdx];
      if (d) {
        d.totalDelegated -= existing.amount;
        if (d.totalDelegated <= 0) delegates.splice(delegateIdx, 1);
      }
    }
    delegates.sort((a, b) => b.totalDelegated - a.totalDelegated);
    await kvPut(kv, KV.delegates(daoId), delegates);
  }
  await kvPut(kv, KV.delegation(daoId, wallet), null);
  await kv.delete(KV.delegation(daoId, wallet)).catch(() => {});
  return jsonResponse({ success: true, message: 'Delegation revoked' });
}

export async function handleDaoDelegationMine(
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
  const delegation = await kvGet<Delegation>(kv, KV.delegation(daoId, wallet));
  return jsonResponse({
    delegation: delegation ?? null,
    votingPower: delegation ? delegation.amount : 1,
  });
}

export async function handleDaoDelegationStatus(
  _request: Request,
  env: Env,
  daoId: string,
  address: string,
): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const delegation = await kvGet<Delegation>(kv, KV.delegation(daoId, address.toLowerCase()));
  return jsonResponse({
    delegation: delegation ?? null,
    votingPower: delegation ? delegation.amount : 1,
  });
}

export async function handleDaoDelegatesTop(
  _request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const delegates = await kvGetList<{ address: string; totalDelegated: number }>(
    kv,
    KV.delegates(daoId),
  );
  return jsonResponse({ data: delegates, meta: { total: delegates.length, daoId } });
}
