/**
 * @degenfeed/api-worker — DAO Membership (join, leave)
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import { requireSession } from '../session';
import { getDaoOr404, checkDaoMember, recordActivity, kvGet, kvGetList, kvPut, KV } from './dao-core';
import type { Dao } from './dao-types';

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
    return jsonResponse({ error: 'DAO creator cannot leave. Transfer ownership or delete the DAO.' }, 403);
  }
  const members = await kvGetList<string>(kv, KV.daoMembers(daoId));
  if (!members.includes(wallet)) return jsonResponse({ error: 'Not a member' }, 404);
  const updatedMembers = members.filter((m) => m !== wallet);
  dao.memberCount = updatedMembers.length;
  await Promise.all([kvPut(kv, KV.daoMembers(daoId), updatedMembers), kvPut(kv, KV.dao(daoId), dao)]);
  await recordActivity(env, daoId, 'member_left', wallet);
  return jsonResponse({ success: true, memberCount: dao.memberCount });
}
