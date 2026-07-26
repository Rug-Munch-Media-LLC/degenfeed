/**
 * @degenfeed/api-worker — DAO Membership (join, leave, list, get)
 */

import { jsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import {
  getDaoOr404,
  getVotingPower,
  KV,
  kvGet,
  kvGetList,
  kvPut,
  recordActivity,
} from './dao-core';
import type { Dao, Delegation } from './dao-types';

export interface MemberInfo {
  address: string;
  votingPower: number;
  delegation: Delegation | null;
  joinedAt?: number;
  isCreator: boolean;
}

export async function handleDaoMembersList(
  _request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const dao = daoResult as Dao;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const memberAddresses = await kvGetList<string>(kv, KV.daoMembers(daoId));
  const members: MemberInfo[] = [];
  for (const addr of memberAddresses) {
    const votingPower = await getVotingPower(env, daoId, addr);
    const delegation = await kvGet<Delegation>(kv, KV.delegation(daoId, addr));
    members.push({
      address: addr,
      votingPower,
      delegation,
      isCreator: addr === dao.creator,
    });
  }
  members.sort((a, b) => b.votingPower - a.votingPower);

  return jsonResponse({
    data: members,
    meta: {
      total: members.length,
      daoId,
      totalVotingPower: members.reduce((s, m) => s + m.votingPower, 0),
    },
  });
}

export async function handleDaoMemberGet(
  _request: Request,
  env: Env,
  daoId: string,
  address: string,
): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const dao = daoResult as Dao;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const normalizedAddr = address.toLowerCase();
  const members = await kvGetList<string>(kv, KV.daoMembers(daoId));
  if (!members.includes(normalizedAddr)) {
    return jsonResponse({ error: 'Address is not a member of this DAO' }, 404);
  }

  const votingPower = await getVotingPower(env, daoId, normalizedAddr);
  const delegation = await kvGet<Delegation>(kv, KV.delegation(daoId, normalizedAddr));

  return jsonResponse({
    data: {
      address: normalizedAddr,
      votingPower,
      delegation,
      isCreator: normalizedAddr === dao.creator,
    },
  });
}

export async function handleDaoJoin(request: Request, env: Env, daoId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const dao = daoResult as Dao;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const wallet = session.address.toLowerCase();
  const members = await kvGetList<string>(kv, KV.daoMembers(daoId));
  if (members.includes(wallet)) return jsonResponse({ error: 'Already a member' }, 409);
  members.push(wallet);
  dao.memberCount = members.length;
  await Promise.all([kvPut(kv, KV.daoMembers(daoId), members), kvPut(kv, KV.dao(daoId), dao)]);
  await recordActivity(env, daoId, 'member_joined', wallet);
  return jsonResponse({ success: true, memberCount: dao.memberCount });
}

export async function handleDaoLeave(request: Request, env: Env, daoId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const dao = daoResult as Dao;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const wallet = session.address.toLowerCase();
  if (dao.creator === wallet) {
    return jsonResponse(
      { error: 'DAO creator cannot leave. Transfer ownership or delete the DAO.' },
      403,
    );
  }
  const members = await kvGetList<string>(kv, KV.daoMembers(daoId));
  if (!members.includes(wallet)) return jsonResponse({ error: 'Not a member' }, 404);
  const updatedMembers = members.filter((m) => m !== wallet);
  dao.memberCount = updatedMembers.length;
  await Promise.all([
    kvPut(kv, KV.daoMembers(daoId), updatedMembers),
    kvPut(kv, KV.dao(daoId), dao),
  ]);
  await recordActivity(env, daoId, 'member_left', wallet);
  return jsonResponse({ success: true, memberCount: dao.memberCount });
}
