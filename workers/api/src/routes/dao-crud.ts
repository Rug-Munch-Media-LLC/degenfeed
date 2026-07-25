/**
 * @degenfeed/api-worker — DAO CRUD Operations
 *
 * Types, KV helpers, guard helpers, and DAO CRUD route handlers.
 * Shared infrastructure for dao-proposals, dao-delegation, dao-treasury-inline.
 */

import type { Env } from '../index';
import { jsonResponse, log } from '../index';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';

// ─── Types ──────────────────────────────────────────────────────────────

export type DaoVisibility = 'public' | 'private' | 'unlisted';
export type ProposalStatus = 'active' | 'passed' | 'failed' | 'cancelled' | 'queued' | 'executed';
export type VoteChoice = 'for' | 'against' | 'abstain';
export type ActivityType =
  | 'proposal_created'
  | 'proposal_passed'
  | 'proposal_failed'
  | 'proposal_executed'
  | 'vote_cast'
  | 'member_joined'
  | 'member_left'
  | 'treasury_transfer'
  | 'treasury_stream_started'
  | 'delegation_changed'
  | 'grant_created'
  | 'grant_milestone_completed';

export interface Dao {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  banner?: string;
  creator: string;
  createdAt: number;
  chain: 'ethereum' | 'solana' | 'base' | 'polygon';
  contractAddress?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  visibility: DaoVisibility;
  memberCount: number;
  proposalCount: number;
  treasuryValue?: string;
  tags?: string[];
  website?: string;
  discord?: string;
  twitter?: string;
  governance: {
    votingPeriod: number;
    quorumPercent: number;
    minDelay: number;
    executeWindow: number;
    proposalThreshold: number;
    votingDelay: number;
  };
}

export interface Proposal {
  id: string;
  daoId: string;
  title: string;
  description: string;
  creator: string;
  createdAt: number;
  startAt: number;
  endAt: number;
  status: ProposalStatus;
  type: 'text' | 'transfer' | 'config_change' | 'membership' | 'grant' | 'stream' | 'custom';
  targets?: string[];
  values?: string[];
  calldatas?: string[];
  descriptionHash?: string;
  voteSummary?: {
    for: number;
    against: number;
    abstain: number;
    totalPower: number;
  };
  executedAt?: number;
  executionTxHash?: string;
  queuedAt?: number;
}

export interface VoteRecord {
  votes: Array<{
    voter: string;
    choice: VoteChoice;
    power: number;
    timestamp: number;
  }>;
  totals: {
    for: number;
    against: number;
    abstain: number;
  };
  totalPowerParticipated: number;
}

export interface Delegation {
  delegator: string;
  delegate: string;
  amount: number;
  timestamp: number;
}

export interface TreasuryOverview {
  totalBalance: string;
  tokenCount: number;
  tokens: Array<{
    address: string;
    symbol: string;
    name: string;
    balance: string;
    valueUsd: number;
  }>;
  nativeBalance: string;
  nativeValueUsd: number;
  updatedAt: number;
}

export interface TreasuryTransaction {
  id: string;
  daoId: string;
  type: 'transfer' | 'stream' | 'grant' | 'deposit' | 'swap';
  from: string;
  to: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  amount: string;
  valueUsd: number;
  txHash?: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  proposalId?: string;
}

export interface TreasuryStream {
  id: string;
  daoId: string;
  recipient: string;
  tokenAddress: string;
  tokenSymbol: string;
  totalAmount: string;
  releasedAmount: string;
  startTime: number;
  endTime: number;
  interval: number;
  amountPerInterval: string;
  status: 'active' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: number;
  cancelledAt?: number;
  proposalId?: string;
}

export interface GrantProgram {
  id: string;
  daoId: string;
  title: string;
  description: string;
  totalBudget: string;
  remainingBudget: string;
  tokenAddress: string;
  tokenSymbol: string;
  milestones: Array<{
    id: string;
    title: string;
    description: string;
    amount: string;
    status: 'pending' | 'completed';
    completedAt?: number;
  }>;
  recipient: string;
  status: 'active' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: number;
  proposalId?: string;
}

// ─── KV Key Patterns ───────────────────────────────────────────────────

export const KV = {
  dao: (id: string) => `dao:${id}`,
  daoIdx: 'dao:idx',
  daoMembers: (daoId: string) => `dao:members:${daoId}`,
  proposal: (daoId: string, id: string) => `dao:proposal:${daoId}:${id}`,
  proposalIdx: (daoId: string) => `dao:proposal:idx:${daoId}`,
  vote: (proposalId: string) => `dao:vote:${proposalId}`,
  delegation: (daoId: string, address: string) => `dao:delegation:${daoId}:${address}`,
  delegates: (daoId: string) => `dao:delegates:${daoId}`,
  treasury: (daoId: string) => `dao:treasury:${daoId}`,
  treasuryTx: (txId: string) => `dao:treasury:tx:${txId}`,
  treasuryTxIdx: (daoId: string) => `dao:treasury:tx:idx:${daoId}`,
  treasuryStream: (streamId: string) => `dao:treasury:stream:${streamId}`,
  treasuryStreamIdx: (daoId: string) => `dao:treasury:stream:idx:${daoId}`,
  treasuryGrant: (grantId: string) => `dao:treasury:grant:${grantId}`,
  treasuryGrantIdx: (daoId: string) => `dao:treasury:grant:idx:${daoId}`,
} as const;

// ─── ID Generation ────────────────────────────────────────────────────

export function generateId(prefix: string): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < 16; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue;
    id += byte.toString(36).padStart(2, '0');
  }
  return `${prefix}_${id.slice(0, 16)}`;
}

function nonceId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

// ─── KV Helpers ───────────────────────────────────────────────────────

export async function kvGet<T>(kv: KVNamespace | undefined, key: string): Promise<T | null> {
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function kvPut(
  kv: KVNamespace | undefined,
  key: string,
  value: unknown,
  ttl?: number,
): Promise<void> {
  if (!kv) return;
  try {
    const opts = ttl ? { expirationTtl: ttl } : {};
    await kv.put(key, JSON.stringify(value), opts);
  } catch (err) {
    log('warn', `[dao] KV put failed: ${key}`, String(err));
  }
}

export async function kvGetList<T>(kv: KVNamespace | undefined, key: string): Promise<T[]> {
  const data = await kvGet<T[]>(kv, key);
  return data ?? [];
}

export async function kvAppendToList(
  kv: KVNamespace | undefined,
  key: string,
  item: string,
): Promise<void> {
  const list = await kvGetList<string>(kv, key);
  if (!list.includes(item)) {
    list.push(item);
    await kvPut(kv, key, list);
  }
}

export async function kvRemoveFromList(
  kv: KVNamespace | undefined,
  key: string,
  item: string,
): Promise<void> {
  const list = await kvGetList<string>(kv, key);
  const filtered = list.filter((i) => i !== item);
  await kvPut(kv, key, filtered);
}

// ─── Guard Helpers ───────────────────────────────────────────────────

export async function getDaoOr404(env: Env, daoId: string): Promise<Dao | Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const dao = await kvGet<Dao>(kv, KV.dao(daoId));
  if (!dao) return jsonResponse({ error: 'DAO not found' }, 404);
  return dao;
}

export async function getProposalOr404(
  env: Env,
  daoId: string,
  proposalId: string,
): Promise<Proposal | Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const proposal = await kvGet<Proposal>(kv, KV.proposal(daoId, proposalId));
  if (!proposal) return jsonResponse({ error: 'Proposal not found' }, 404);
  return proposal;
}

export async function checkDaoMember(env: Env, daoId: string, wallet: string): Promise<Response | null> {
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const members = await kvGetList<string>(kv, KV.daoMembers(daoId));
  if (!members.includes(wallet.toLowerCase())) {
    return jsonResponse({ error: 'Must be a DAO member' }, 403);
  }
  return null;
}

// ─── Activity Recording ──────────────────────────────────────────────

export async function recordActivity(
  env: Env,
  daoId: string,
  type: ActivityType,
  actor: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const kv = env.GOVERNANCE;
  if (!kv) return;
  const eventId = nonceId();
  const event = {
    id: eventId,
    daoId,
    type,
    actor: actor.toLowerCase(),
    metadata: metadata ?? {},
    timestamp: Date.now(),
  };
  await kvPut(kv, `dao:activity:${daoId}:${eventId}`, event, 90 * 86400);
  await kvAppendToList(kv, `dao:activity:idx:${daoId}`, eventId);
  await kvAppendToList(kv, `dao:activity:mine:${actor.toLowerCase()}`, `${daoId}:${eventId}`);
}

// ─── Voting Power Calculation ────────────────────────────────────────

export async function getVotingPower(env: Env, daoId: string, wallet: string): Promise<number> {
  const kv = env.GOVERNANCE;
  if (!kv) return 1;
  const delegation = await kvGet<Delegation>(kv, KV.delegation(daoId, wallet.toLowerCase()));
  if (delegation) {
    return Math.max(delegation.amount, 1);
  }
  return 1;
}

// ═══════════════════════════════════════════════════════════════════════
// DAO CRUD ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

// ─── POST /api/dao/create ─────────────────────────────────────────

export async function handleDaoCreate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const sizeCheck = validateBodySize(request, 100 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  const name = sanitizeString(body.name, 64);
  const displayName = sanitizeString(body.displayName, 128) || name;
  const description = sanitizeString(body.description, 5000);
  const chain = typeof body.chain === 'string' ? body.chain : 'ethereum';
  const contractAddress = typeof body.contractAddress === 'string' ? body.contractAddress.trim() : undefined;
  const tokenAddress = typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : undefined;
  const tokenSymbol = sanitizeString(body.tokenSymbol, 16);
  const visibility = typeof body.visibility === 'string' && ['public', 'private', 'unlisted'].includes(body.visibility) ? (body.visibility as DaoVisibility) : 'public';
  const tags = Array.isArray(body.tags) ? (body.tags as string[]).filter((t): t is string => typeof t === 'string').map((t) => t.toLowerCase().trim()).slice(0, 20) : undefined;
  const website = typeof body.website === 'string' ? body.website.trim() : undefined;
  const discord = typeof body.discord === 'string' ? body.discord.trim() : undefined;
  const twitter = typeof body.twitter === 'string' ? body.twitter.trim() : undefined;

  if (!name || name.length < 2) return jsonResponse({ error: 'DAO name must be at least 2 characters' }, 400);
  if (!description || description.length < 20) return jsonResponse({ error: 'Description must be at least 20 characters' }, 400);
  if (!['ethereum', 'solana', 'base', 'polygon'].includes(chain)) return jsonResponse({ error: 'Invalid chain' }, 400);
  if (hasSuspiciousPayload(description) || hasSuspiciousPayload(name)) return jsonResponse({ error: 'Invalid characters in name or description' }, 400);

  const governanceDefaults = { votingPeriod: 3 * 86400 * 1000, quorumPercent: 10, minDelay: 2 * 86400 * 1000, executeWindow: 7 * 86400 * 1000, proposalThreshold: 0, votingDelay: 0 };
  const govRaw = body.governance as Record<string, unknown> | undefined;
  const governance = {
    votingPeriod: typeof govRaw?.votingPeriod === 'number' ? govRaw.votingPeriod : governanceDefaults.votingPeriod,
    quorumPercent: typeof govRaw?.quorumPercent === 'number' ? Math.min(100, Math.max(1, govRaw.quorumPercent)) : governanceDefaults.quorumPercent,
    minDelay: typeof govRaw?.minDelay === 'number' ? govRaw.minDelay : governanceDefaults.minDelay,
    executeWindow: typeof govRaw?.executeWindow === 'number' ? govRaw.executeWindow : governanceDefaults.executeWindow,
    proposalThreshold: typeof govRaw?.proposalThreshold === 'number' ? govRaw.proposalThreshold : governanceDefaults.proposalThreshold,
    votingDelay: typeof govRaw?.votingDelay === 'number' ? govRaw.votingDelay : governanceDefaults.votingDelay,
  };

  const daoId = generateId('dao');
  const wallet = session.address.toLowerCase();
  const now = Date.now();
  const dao: Dao = { id: daoId, name, displayName, description, icon: typeof body.icon === 'string' ? body.icon : undefined, banner: typeof body.banner === 'string' ? body.banner : undefined, creator: wallet, createdAt: now, chain: chain as Dao['chain'], contractAddress, tokenAddress, tokenSymbol, visibility, memberCount: 1, proposalCount: 0, tags, website, discord, twitter, governance };
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  await Promise.all([kvPut(kv, KV.dao(daoId), dao), kvAppendToList(kv, KV.daoIdx, daoId), kvPut(kv, KV.daoMembers(daoId), [wallet])]);
  await recordActivity(env, daoId, 'member_joined', wallet, { role: 'creator' });
  return jsonResponse({ success: true, dao }, 201);
}

export async function handleDaoGet(_request: Request, env: Env, daoId: string): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  return jsonResponse({ dao: daoResult as Dao });
}

export async function handleDaoUpdate(request: Request, env: Env, daoId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const dao = daoResult as Dao;
  const wallet = session.address.toLowerCase();
  if (dao.creator !== wallet) return jsonResponse({ error: 'Only the DAO creator can update config' }, 403);
  const sizeCheck = validateBodySize(request, 100 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return jsonResponse({ error: 'Invalid JSON body' }, 400); }
  const updated: Dao = { ...dao, displayName: sanitizeString(body.displayName, 128) || dao.displayName, description: sanitizeString(body.description, 5000) || dao.description, icon: typeof body.icon === 'string' ? body.icon : dao.icon, banner: typeof body.banner === 'string' ? body.banner : dao.banner, visibility: typeof body.visibility === 'string' && ['public', 'private', 'unlisted'].includes(body.visibility) ? (body.visibility as DaoVisibility) : dao.visibility, website: typeof body.website === 'string' ? body.website.trim() : dao.website, discord: typeof body.discord === 'string' ? body.discord.trim() : dao.discord, twitter: typeof body.twitter === 'string' ? body.twitter.trim() : dao.twitter, tags: Array.isArray(body.tags) ? (body.tags as string[]).filter((t): t is string => typeof t === 'string').slice(0, 20) : dao.tags };
  const govRaw = body.governance as Record<string, unknown> | undefined;
  if (govRaw) { updated.governance = { votingPeriod: typeof govRaw.votingPeriod === 'number' ? govRaw.votingPeriod : dao.governance.votingPeriod, quorumPercent: typeof govRaw.quorumPercent === 'number' ? Math.min(100, Math.max(1, govRaw.quorumPercent)) : dao.governance.quorumPercent, minDelay: typeof govRaw.minDelay === 'number' ? govRaw.minDelay : dao.governance.minDelay, executeWindow: typeof govRaw.executeWindow === 'number' ? govRaw.executeWindow : dao.governance.executeWindow, proposalThreshold: typeof govRaw.proposalThreshold === 'number' ? govRaw.proposalThreshold : dao.governance.proposalThreshold, votingDelay: typeof govRaw.votingDelay === 'number' ? govRaw.votingDelay : dao.governance.votingDelay }; }
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  await kvPut(kv, KV.dao(daoId), updated);
  return jsonResponse({ success: true, dao: updated });
}

export async function handleDaoMine(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const wallet = session.address.toLowerCase();
  const allDaoIds = await kvGetList<string>(kv, KV.daoIdx);
  const daos: Dao[] = [];
  const memberChecks = await Promise.all(allDaoIds.map(async (daoId) => { const members = await kvGetList<string>(kv, KV.daoMembers(daoId)); if (members.includes(wallet)) return kvGet<Dao>(kv, KV.dao(daoId)); return null; }));
  for (const dao of memberChecks) { if (dao) daos.push(dao); }
  return jsonResponse({ data: daos, meta: { total: daos.length } });
}

export async function handleDaoDiscover(request: Request, env: Env): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
  const cursor = url.searchParams.get('cursor') || undefined;
  const search = url.searchParams.get('search')?.toLowerCase();
  const tag = url.searchParams.get('tag')?.toLowerCase();
  const chain = url.searchParams.get('chain')?.toLowerCase();
  const sort = url.searchParams.get('sort') || 'members';
  const allDaoIds = await kvGetList<string>(kv, KV.daoIdx);
  const daosRaw = await Promise.all(allDaoIds.map((daoId) => kvGet<Dao>(kv, KV.dao(daoId))));
  let filtered = daosRaw.filter((d): d is Dao => d !== null && d.visibility === 'public');
  if (search) filtered = filtered.filter((d) => d.name.toLowerCase().includes(search) || d.displayName.toLowerCase().includes(search) || d.description.toLowerCase().includes(search));
  if (tag) filtered = filtered.filter((d) => d.tags?.includes(tag));
  if (chain) filtered = filtered.filter((d) => d.chain === chain);
  if (sort === 'newest') filtered.sort((a, b) => b.createdAt - a.createdAt);
  else if (sort === 'name') filtered.sort((a, b) => a.displayName.localeCompare(b.displayName));
  else filtered.sort((a, b) => b.memberCount - a.memberCount);
  const startIdx = cursor ? Math.max(0, allDaoIds.indexOf(cursor)) : 0;
  const paginated = filtered.slice(startIdx, startIdx + limit);
  const nextCursor = filtered.length > startIdx + limit ? filtered[startIdx + limit]?.id : undefined;
  return jsonResponse({ data: paginated, meta: { total: filtered.length, limit, nextCursor } });
}

export async function handleDaoStats(_request: Request, env: Env, daoId: string): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const dao = daoResult as Dao;
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const members = await kvGetList<string>(kv, KV.daoMembers(daoId));
  const proposalIds = await kvGetList<string>(kv, KV.proposalIdx(daoId));
  const treasury = await kvGet<TreasuryOverview>(kv, KV.treasury(daoId));
  let activeProposals = 0, passedProposals = 0, totalVotes = 0;
  const proposals = await Promise.all(proposalIds.map((pid) => kvGet<Proposal>(kv, KV.proposal(daoId, pid))));
  for (const p of proposals) { if (!p) continue; if (p.status === 'active') activeProposals++; if (p.status === 'passed' || p.status === 'executed') passedProposals++; if (p.voteSummary) totalVotes += p.voteSummary.for + p.voteSummary.against + p.voteSummary.abstain; }
  return jsonResponse({ daoId: dao.id, displayName: dao.displayName, members: members.length, proposals: proposalIds.length, activeProposals, passedProposals, totalVotes, treasuryValue: treasury?.totalBalance ?? '0', treasuryTokens: treasury?.tokenCount ?? 0, treasuryNativeValue: treasury?.nativeValueUsd ?? 0, createdAt: dao.createdAt });
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
  if (dao.creator === wallet) return jsonResponse({ error: 'DAO creator cannot leave. Transfer ownership or delete the DAO.' }, 403);
  const members = await kvGetList<string>(kv, KV.daoMembers(daoId));
  if (!members.includes(wallet)) return jsonResponse({ error: 'Not a member' }, 404);
  const updatedMembers = members.filter((m) => m !== wallet);
  dao.memberCount = updatedMembers.length;
  await Promise.all([kvPut(kv, KV.daoMembers(daoId), updatedMembers), kvPut(kv, KV.dao(daoId), dao)]);
  await recordActivity(env, daoId, 'member_left', wallet);
  return jsonResponse({ success: true, memberCount: dao.memberCount });
}
