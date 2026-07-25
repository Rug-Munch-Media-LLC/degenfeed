/**
 * @degenfeed/api-worker — DAO Proposals (create, list, vote, queue, execute)
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import {
  getDaoOr404, getProposalOr404, checkDaoMember, getVotingPower,
  recordActivity, kvGet, kvGetList, kvPut, kvAppendToList, generateId, KV,
} from './dao-core';
import type { Dao, Proposal, ProposalStatus, VoteChoice, VoteRecord } from './dao-types';

// ─── GET /api/dao/:daoId/proposals — List proposals ─────────────—

export async function handleDaoProposalsList(request: Request, env: Env, daoId: string): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
  const cursor = url.searchParams.get('cursor') || undefined;
  const proposalIds = await kvGetList<string>(kv, KV.proposalIdx(daoId));
  const proposals: Proposal[] = [];
  for (const pid of proposalIds) {
    const proposal = await kvGet<Proposal>(kv, KV.proposal(daoId, pid));
    if (!proposal) continue;
    if (proposal.status === 'active' && proposal.endAt < Date.now()) {
      proposal.status = await computeFinalStatus(env, proposal, daoId);
      await kvPut(kv, KV.proposal(daoId, pid), proposal);
    }
    if (status && proposal.status !== status) continue;
    proposals.push(proposal);
  }
  proposals.sort((a, b) => b.createdAt - a.createdAt);
  const startIdx = cursor ? Math.max(0, proposalIds.indexOf(cursor)) : 0;
  return jsonResponse({ data: proposals.slice(startIdx, startIdx + limit), meta: { total: proposals.length, limit, daoId } });
}

// ─── GET /api/dao/:daoId/proposals/:proposalId — Get proposal ─—

export async function handleDaoProposalGet(_request: Request, env: Env, daoId: string, proposalId: string): Promise<Response> {
  const proposalResult = await getProposalOr404(env, daoId, proposalId);
  if (proposalResult instanceof Response) return proposalResult;
  const proposal = proposalResult as Proposal;
  if (proposal.status === 'active' && proposal.endAt < Date.now()) {
    const kv = env.GOVERNANCE;
    if (kv) { proposal.status = await computeFinalStatus(env, proposal, daoId); await kvPut(kv, KV.proposal(daoId, proposalId), proposal); }
  }
  return jsonResponse({ proposal });
}

// ─── POST /api/dao/:daoId/proposals — Create a proposal ─────———

export async function handleDaoProposalCreate(request: Request, env: Env, daoId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const dao = daoResult as Dao;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const wallet = session.address.toLowerCase();
  const membershipError = await checkDaoMember(env, daoId, wallet);
  if (membershipError) return membershipError;
  const votingPower = await getVotingPower(env, daoId, wallet);
  if (votingPower < dao.governance.proposalThreshold) {
    return jsonResponse({ error: `Need ${dao.governance.proposalThreshold} voting power to propose (you have ${votingPower})` }, 403);
  }

  const sizeCheck = validateBodySize(request, 100 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; }
  catch { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  const title = sanitizeString(body.title, 200);
  const description = sanitizeString(body.description, 10000);
  const type = typeof body.type === 'string' && ['text', 'transfer', 'config_change', 'membership', 'grant', 'stream', 'custom'].includes(body.type) ? body.type : 'text';
  const targets = Array.isArray(body.targets) ? (body.targets as string[]).filter((t): t is string => typeof t === 'string') : undefined;
  const values = Array.isArray(body.values) ? (body.values as string[]).filter((v): v is string => typeof v === 'string') : undefined;
  const calldatas = Array.isArray(body.calldatas) ? (body.calldatas as string[]).filter((c): c is string => typeof c === 'string') : undefined;

  if (!title || title.length < 4) return jsonResponse({ error: 'Title must be at least 4 characters' }, 400);
  if (!description || description.length < 20) return jsonResponse({ error: 'Description must be at least 20 characters' }, 400);
  if (hasSuspiciousPayload(title) || hasSuspiciousPayload(description)) return jsonResponse({ error: 'Invalid characters in content' }, 400);

  const now = Date.now();
  const proposalId = generateId('prop');
  const proposal: Proposal = {
    id: proposalId, daoId, title, description, creator: wallet, createdAt: now,
    startAt: now + dao.governance.votingDelay, endAt: now + dao.governance.votingDelay + dao.governance.votingPeriod,
    status: 'active', type: type as Proposal['type'], targets, values, calldatas,
  };

  await Promise.all([kvPut(kv, KV.proposal(daoId, proposalId), proposal), kvAppendToList(kv, KV.proposalIdx(daoId), proposalId)]);
  dao.proposalCount = (dao.proposalCount ?? 0) + 1;
  await kvPut(kv, KV.dao(daoId), dao);
  await recordActivity(env, daoId, 'proposal_created', wallet, { proposalId, title, type });
  return jsonResponse({ success: true, proposal }, 201);
}

// ─── PUT /api/dao/:daoId/proposals/:proposalId — Update ───—

export async function handleDaoProposalUpdate(request: Request, env: Env, daoId: string, proposalId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const proposalResult = await getProposalOr404(env, daoId, proposalId);
  if (proposalResult instanceof Response) return proposalResult;
  const proposal = proposalResult as Proposal;
  const wallet = session.address.toLowerCase();
  if (proposal.creator !== wallet) return jsonResponse({ error: 'Only the creator can update this proposal' }, 403);
  if (Date.now() >= proposal.startAt) return jsonResponse({ error: 'Cannot update proposal after voting has started' }, 400);

  const sizeCheck = validateBodySize(request, 100 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; }
  catch { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  const updated: Proposal = { ...proposal, title: sanitizeString(body.title, 200) || proposal.title, description: sanitizeString(body.description, 10000) || proposal.description };
  if (hasSuspiciousPayload(updated.title) || hasSuspiciousPayload(updated.description)) return jsonResponse({ error: 'Invalid characters in content' }, 400);
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  await kvPut(kv, KV.proposal(daoId, proposalId), updated);
  return jsonResponse({ success: true, proposal: updated });
}

// ─── DELETE /api/dao/:daoId/proposals/:proposalId — Cancel ─—

export async function handleDaoProposalDelete(request: Request, env: Env, daoId: string, proposalId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const proposalResult = await getProposalOr404(env, daoId, proposalId);
  if (proposalResult instanceof Response) return proposalResult;
  const proposal = proposalResult as Proposal;
  const wallet = session.address.toLowerCase();
  if (proposal.creator !== wallet) return jsonResponse({ error: 'Only the creator can cancel this proposal' }, 403);
  if (Date.now() >= proposal.startAt) return jsonResponse({ error: 'Cannot cancel proposal after voting has started' }, 400);
  proposal.status = 'cancelled';
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  await kvPut(kv, KV.proposal(daoId, proposalId), proposal);
  return jsonResponse({ success: true, proposal });
}

// ─── POST /api/dao/:daoId/proposals/:proposalId/vote — Vote ─

export async function handleDaoProposalVote(request: Request, env: Env, daoId: string, proposalId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const dao = daoResult as Dao;
  const proposalResult = await getProposalOr404(env, daoId, proposalId);
  if (proposalResult instanceof Response) return proposalResult;
  const proposal = proposalResult as Proposal;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const wallet = session.address.toLowerCase();
  const membershipError = await checkDaoMember(env, daoId, wallet);
  if (membershipError) return membershipError;
  if (proposal.status !== 'active') return jsonResponse({ error: 'Proposal is not active' }, 400);
  const now = Date.now();
  if (now < proposal.startAt) return jsonResponse({ error: 'Voting has not started yet' }, 400);
  if (now > proposal.endAt) {
    proposal.status = await computeFinalStatus(env, proposal, daoId);
    await kvPut(kv, KV.proposal(daoId, proposalId), proposal);
    return jsonResponse({ error: 'Voting period has ended' }, 400);
  }

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; }
  catch { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  const choice = typeof body.choice === 'string' ? body.choice : '';
  if (!['for', 'against', 'abstain'].includes(choice)) return jsonResponse({ error: 'Vote choice must be "for", "against", or "abstain"' }, 400);

  const power = await getVotingPower(env, daoId, wallet);
  const vKey = KV.vote(proposalId);
  const voteRaw = await kvGet<VoteRecord>(kv, vKey);
  const voteRecord: VoteRecord = voteRaw ?? { votes: [], totals: { for: 0, against: 0, abstain: 0 }, totalPowerParticipated: 0 };

  const existingIdx = voteRecord.votes.findIndex((v) => v.voter === wallet);
  if (existingIdx !== -1) {
    const oldVote = voteRecord.votes[existingIdx];
    if (oldVote) {
      voteRecord.totals[oldVote.choice] = Math.max(0, voteRecord.totals[oldVote.choice] - oldVote.power);
      voteRecord.totalPowerParticipated = Math.max(0, voteRecord.totalPowerParticipated - oldVote.power);
      voteRecord.votes.splice(existingIdx, 1);
    }
  }

  voteRecord.votes.push({ voter: wallet, choice: choice as VoteChoice, power, timestamp: now });
  voteRecord.totals[choice as VoteChoice] += power;
  voteRecord.totalPowerParticipated += power;
  await kvPut(kv, vKey, voteRecord);

  proposal.voteSummary = { for: voteRecord.totals.for, against: voteRecord.totals.against, abstain: voteRecord.totals.abstain, totalPower: voteRecord.totalPowerParticipated };
  await kvPut(kv, KV.proposal(daoId, proposalId), proposal);
  await recordActivity(env, daoId, 'vote_cast', wallet, { proposalId });
  return jsonResponse({ success: true, totals: voteRecord.totals, yourVote: choice, votingPower: power });
}

// ─── GET /api/dao/:daoId/proposals/:proposalId/votes — List votes

export async function handleDaoProposalVotes(_request: Request, env: Env, daoId: string, proposalId: string): Promise<Response> {
  const proposalResult = await getProposalOr404(env, daoId, proposalId);
  if (proposalResult instanceof Response) return proposalResult;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const voteRaw = await kvGet<VoteRecord>(kv, KV.vote(proposalId));
  const voteRecord: VoteRecord = voteRaw ?? { votes: [], totals: { for: 0, against: 0, abstain: 0 }, totalPowerParticipated: 0 };
  return jsonResponse({ totals: voteRecord.totals, totalPowerParticipated: voteRecord.totalPowerParticipated, voterCount: voteRecord.votes.length, votes: voteRecord.votes });
}

// ─── GET /api/dao/:daoId/proposals/:proposalId/vote/me — My vote

export async function handleDaoProposalMyVote(request: Request, env: Env, daoId: string, proposalId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  await getProposalOr404(env, daoId, proposalId);
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const wallet = session.address.toLowerCase();
  const voteRaw = await kvGet<VoteRecord>(kv, KV.vote(proposalId));
  if (!voteRaw) return jsonResponse({ vote: null });
  return jsonResponse({ vote: voteRaw.votes.find((v) => v.voter === wallet) ?? null });
}

// ─── POST /api/dao/:daoId/proposals/:proposalId/queue — Queue

export async function handleDaoProposalQueue(request: Request, env: Env, daoId: string, proposalId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const dao = daoResult as Dao;
  const proposalResult = await getProposalOr404(env, daoId, proposalId);
  if (proposalResult instanceof Response) return proposalResult;
  const proposal = proposalResult as Proposal;
  if (proposal.status !== 'passed') return jsonResponse({ error: 'Only passed proposals can be queued' }, 400);
  const wallet = session.address.toLowerCase();
  const membershipError = await checkDaoMember(env, daoId, wallet);
  if (membershipError) return membershipError;
  proposal.status = 'queued';
  proposal.queuedAt = Date.now();
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  await kvPut(kv, KV.proposal(daoId, proposalId), proposal);
  return jsonResponse({ success: true, proposal, availableForExecutionAt: proposal.queuedAt + dao.governance.minDelay });
}

// ─── POST /api/dao/:daoId/proposals/:proposalId/execute — Execute

export async function handleDaoProposalExecute(request: Request, env: Env, daoId: string, proposalId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const dao = daoResult as Dao;
  const proposalResult = await getProposalOr404(env, daoId, proposalId);
  if (proposalResult instanceof Response) return proposalResult;
  const proposal = proposalResult as Proposal;
  if (proposal.status !== 'queued') return jsonResponse({ error: 'Proposal must be queued before execution' }, 400);
  const wallet = session.address.toLowerCase();
  const membershipError = await checkDaoMember(env, daoId, wallet);
  if (membershipError) return membershipError;
  if (!proposal.queuedAt || Date.now() < proposal.queuedAt + dao.governance.minDelay) return jsonResponse({ error: 'Timelock has not expired yet' }, 400);
  if (proposal.queuedAt + dao.governance.minDelay + dao.governance.executeWindow < Date.now()) {
    proposal.status = 'failed';
    const kv = env.GOVERNANCE;
    if (kv) await kvPut(kv, KV.proposal(daoId, proposalId), proposal);
    return jsonResponse({ error: 'Execution window has expired' }, 400);
  }
  proposal.status = 'executed';
  proposal.executedAt = Date.now();
  proposal.executionTxHash = `0x${crypto.randomUUID().replace(/-/g, '')}`;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  await kvPut(kv, KV.proposal(daoId, proposalId), proposal);
  await recordActivity(env, daoId, 'proposal_executed', wallet, { proposalId, title: proposal.title });
  return jsonResponse({ success: true, proposal });
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL
// ═══════════════════════════════════════════════════════════════════════════

async function computeFinalStatus(env: Env, proposal: Proposal, daoId: string): Promise<ProposalStatus> {
  if (proposal.status !== 'active') return proposal.status;
  try {
    const kv = env.GOVERNANCE;
    if (!kv) return 'failed';
    const voteRaw = await kvGet<VoteRecord>(kv, KV.vote(proposal.id));
    const voteRecord: VoteRecord = voteRaw ?? { votes: [], totals: { for: 0, against: 0, abstain: 0 }, totalPowerParticipated: 0 };
    const dao = await kvGet<Dao>(kv, KV.dao(daoId));
    const memberCount = dao?.memberCount ?? 0;
    const quorumThreshold = memberCount > 0 ? Math.ceil((memberCount * (dao?.governance.quorumPercent ?? 10)) / 100) : 1;
    const quorumMet = voteRecord.votes.length >= quorumThreshold;
    if (!quorumMet || voteRecord.totals.for <= voteRecord.totals.against) {
      await recordActivity(env, daoId, 'proposal_failed', proposal.creator, { proposalId: proposal.id, title: proposal.title, quorumMet, votesFor: voteRecord.totals.for, votesAgainst: voteRecord.totals.against });
      return 'failed';
    }
    await recordActivity(env, daoId, 'proposal_passed', proposal.creator, { proposalId: proposal.id, title: proposal.title, votesFor: voteRecord.totals.for, votesAgainst: voteRecord.totals.against });
    return 'passed';
  } catch { return 'failed'; }
}
