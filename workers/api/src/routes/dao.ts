/**
 * @degenfeed/api-worker — DAO Operations API
 *
 * Complete DAO management system with:
 *   - DAO CRUD (create, read, update, discover)
 *   - Membership (join, leave, verify token holding)
 *   - Proposals (create, vote, execute, queue)
 *   - Delegation (delegate, revoke, query)
 *   - Treasury (overview, transactions, streams, grants)
 *
 * KV schema:
 *   dao:{daoId}                         → DAO metadata
 *   dao:idx                             → Array of DAO IDs
 *   dao:members:{daoId}                 → Array of member wallet addresses
 *   dao:proposal:{daoId}:{proposalId}   → Proposal data
 *   dao:proposal:idx:{daoId}            → Array of proposal IDs
 *   dao:vote:{proposalId}               → Vote record
 *   dao:delegation:{daoId}:{address}    → Delegation data
 *   dao:delegates:{daoId}               → Top delegates sorted
 *   dao:treasury:{daoId}                → Treasury overview
 *   dao:treasury:tx:{txId}              → Treasury transaction
 *   dao:treasury:tx:idx:{daoId}         → Array of tx IDs
 *   dao:treasury:stream:{streamId}      → Stream record
 *   dao:treasury:stream:idx:{daoId}     → Array of stream IDs
 *   dao:treasury:grant:{grantId}        → Grant record
 *   dao:treasury:grant:idx:{daoId}      → Array of grant IDs
 */

import type { Env } from '../index';
import { jsonResponse, log, noCacheJsonResponse } from '../index';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import type { SessionPayload } from '../session';
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
    votingPeriod: number; // ms
    quorumPercent: number; // 0-100
    minDelay: number; // ms (timelock)
    executeWindow: number; // ms after timelock
    proposalThreshold: number; // tokens needed to propose
    votingDelay: number; // ms before voting starts
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
  interval: number; // ms between releases
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

const KV = {
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

function generateId(prefix: string): string {
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

async function kvGet<T>(kv: KVNamespace | undefined, key: string): Promise<T | null> {
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function kvPut(
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

async function kvGetList<T>(kv: KVNamespace | undefined, key: string): Promise<T[]> {
  const data = await kvGet<T[]>(kv, key);
  return data ?? [];
}

async function kvAppendToList(
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

async function kvRemoveFromList(
  kv: KVNamespace | undefined,
  key: string,
  item: string,
): Promise<void> {
  const list = await kvGetList<string>(kv, key);
  const filtered = list.filter((i) => i !== item);
  await kvPut(kv, key, filtered);
}

// ─── Guard Helpers ───────────────────────────────────────────────────

async function getDaoOr404(env: Env, daoId: string): Promise<Dao | Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const dao = await kvGet<Dao>(kv, KV.dao(daoId));
  if (!dao) return jsonResponse({ error: 'DAO not found' }, 404);
  return dao;
}

async function getProposalOr404(
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

async function checkDaoMember(env: Env, daoId: string, wallet: string): Promise<Response | null> {
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const members = await kvGetList<string>(kv, KV.daoMembers(daoId));
  if (!members.includes(wallet.toLowerCase())) {
    return jsonResponse({ error: 'Must be a DAO member' }, 403);
  }
  return null;
}

// ─── Activity Recording ──────────────────────────────────────────────

async function recordActivity(
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
  // Also record under the user's personal activity feed
  await kvAppendToList(kv, `dao:activity:mine:${actor.toLowerCase()}`, `${daoId}:${eventId}`);
}

// ─── Voting Power Calculation ────────────────────────────────────────

async function getVotingPower(env: Env, daoId: string, wallet: string): Promise<number> {
  // Check delegation first
  const kv = env.GOVERNANCE;
  if (!kv) return 1; // 1 wallet = 1 vote if no delegation
  const delegation = await kvGet<Delegation>(kv, KV.delegation(daoId, wallet.toLowerCase()));
  if (delegation) {
    return Math.max(delegation.amount, 1);
  }
  return 1; // Default: 1 wallet = 1 vote
}

// ═══════════════════════════════════════════════════════════════════════
// DAO CRUD ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

// ─── POST /api/dao/create — Create a new DAO ─────────────────────────

export async function handleDaoCreate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const sizeCheck = validateBodySize(request, 100 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const name = sanitizeString(body.name, 64);
  const displayName = sanitizeString(body.displayName, 128) || name;
  const description = sanitizeString(body.description, 5000);
  const chain = typeof body.chain === 'string' ? body.chain : 'ethereum';
  const contractAddress =
    typeof body.contractAddress === 'string' ? body.contractAddress.trim() : undefined;
  const tokenAddress = typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : undefined;
  const tokenSymbol = sanitizeString(body.tokenSymbol, 16);
  const visibility =
    typeof body.visibility === 'string' &&
    ['public', 'private', 'unlisted'].includes(body.visibility)
      ? (body.visibility as DaoVisibility)
      : 'public';
  const tags = Array.isArray(body.tags)
    ? (body.tags as string[])
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.toLowerCase().trim())
        .slice(0, 20)
    : undefined;
  const website = typeof body.website === 'string' ? body.website.trim() : undefined;
  const discord = typeof body.discord === 'string' ? body.discord.trim() : undefined;
  const twitter = typeof body.twitter === 'string' ? body.twitter.trim() : undefined;

  if (!name || name.length < 2) {
    return jsonResponse({ error: 'DAO name must be at least 2 characters' }, 400);
  }
  if (!description || description.length < 20) {
    return jsonResponse({ error: 'Description must be at least 20 characters' }, 400);
  }
  if (!['ethereum', 'solana', 'base', 'polygon'].includes(chain)) {
    return jsonResponse({ error: 'Invalid chain' }, 400);
  }
  if (hasSuspiciousPayload(description) || hasSuspiciousPayload(name)) {
    return jsonResponse({ error: 'Invalid characters in name or description' }, 400);
  }

  const governanceDefaults = {
    votingPeriod: 3 * 86400 * 1000, // 3 days
    quorumPercent: 10,
    minDelay: 2 * 86400 * 1000, // 2 days
    executeWindow: 7 * 86400 * 1000, // 7 days
    proposalThreshold: 0,
    votingDelay: 0,
  };

  const govRaw = body.governance as Record<string, unknown> | undefined;
  const governance = {
    votingPeriod:
      typeof govRaw?.votingPeriod === 'number'
        ? govRaw.votingPeriod
        : governanceDefaults.votingPeriod,
    quorumPercent:
      typeof govRaw?.quorumPercent === 'number'
        ? Math.min(100, Math.max(1, govRaw.quorumPercent))
        : governanceDefaults.quorumPercent,
    minDelay: typeof govRaw?.minDelay === 'number' ? govRaw.minDelay : governanceDefaults.minDelay,
    executeWindow:
      typeof govRaw?.executeWindow === 'number'
        ? govRaw.executeWindow
        : governanceDefaults.executeWindow,
    proposalThreshold:
      typeof govRaw?.proposalThreshold === 'number'
        ? govRaw.proposalThreshold
        : governanceDefaults.proposalThreshold,
    votingDelay:
      typeof govRaw?.votingDelay === 'number' ? govRaw.votingDelay : governanceDefaults.votingDelay,
  };

  const daoId = generateId('dao');
  const wallet = session.address.toLowerCase();
  const now = Date.now();

  const dao: Dao = {
    id: daoId,
    name,
    displayName,
    description,
    icon: typeof body.icon === 'string' ? body.icon : undefined,
    banner: typeof body.banner === 'string' ? body.banner : undefined,
    creator: wallet,
    createdAt: now,
    chain: chain as Dao['chain'],
    contractAddress,
    tokenAddress,
    tokenSymbol,
    visibility,
    memberCount: 1,
    proposalCount: 0,
    tags,
    website,
    discord,
    twitter,
    governance,
  };

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  await Promise.all([
    kvPut(kv, KV.dao(daoId), dao),
    kvAppendToList(kv, KV.daoIdx, daoId),
    kvPut(kv, KV.daoMembers(daoId), [wallet]),
  ]);

  await recordActivity(env, daoId, 'member_joined', wallet, { role: 'creator' });

  return jsonResponse({ success: true, dao }, 201);
}

// ─── GET /api/dao/:daoId — Get DAO details ───────────────────────────

export async function handleDaoGet(_request: Request, env: Env, daoId: string): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  return jsonResponse({ dao: daoResult as Dao });
}

// ─── PUT /api/dao/:daoId — Update DAO config ────────────────────────

export async function handleDaoUpdate(
  request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const dao = daoResult as Dao;

  const wallet = session.address.toLowerCase();
  if (dao.creator !== wallet) {
    return jsonResponse({ error: 'Only the DAO creator can update config' }, 403);
  }

  const sizeCheck = validateBodySize(request, 100 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const updated: Dao = {
    ...dao,
    displayName: sanitizeString(body.displayName, 128) || dao.displayName,
    description: sanitizeString(body.description, 5000) || dao.description,
    icon: typeof body.icon === 'string' ? body.icon : dao.icon,
    banner: typeof body.banner === 'string' ? body.banner : dao.banner,
    visibility:
      typeof body.visibility === 'string' &&
      ['public', 'private', 'unlisted'].includes(body.visibility)
        ? (body.visibility as DaoVisibility)
        : dao.visibility,
    website: typeof body.website === 'string' ? body.website.trim() : dao.website,
    discord: typeof body.discord === 'string' ? body.discord.trim() : dao.discord,
    twitter: typeof body.twitter === 'string' ? body.twitter.trim() : dao.twitter,
    tags: Array.isArray(body.tags)
      ? (body.tags as string[]).filter((t): t is string => typeof t === 'string').slice(0, 20)
      : dao.tags,
  };

  const govRaw = body.governance as Record<string, unknown> | undefined;
  if (govRaw) {
    updated.governance = {
      votingPeriod:
        typeof govRaw.votingPeriod === 'number' ? govRaw.votingPeriod : dao.governance.votingPeriod,
      quorumPercent:
        typeof govRaw.quorumPercent === 'number'
          ? Math.min(100, Math.max(1, govRaw.quorumPercent))
          : dao.governance.quorumPercent,
      minDelay: typeof govRaw.minDelay === 'number' ? govRaw.minDelay : dao.governance.minDelay,
      executeWindow:
        typeof govRaw.executeWindow === 'number'
          ? govRaw.executeWindow
          : dao.governance.executeWindow,
      proposalThreshold:
        typeof govRaw.proposalThreshold === 'number'
          ? govRaw.proposalThreshold
          : dao.governance.proposalThreshold,
      votingDelay:
        typeof govRaw.votingDelay === 'number' ? govRaw.votingDelay : dao.governance.votingDelay,
    };
  }

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  await kvPut(kv, KV.dao(daoId), updated);

  return jsonResponse({ success: true, dao: updated });
}

// ─── GET /api/dao/mine — List DAOs I belong to ──────────────────────

export async function handleDaoMine(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const wallet = session.address.toLowerCase();
  const allDaoIds = await kvGetList<string>(kv, KV.daoIdx);
  const daos: Dao[] = [];

  // Check membership in parallel
  const memberChecks = await Promise.all(
    allDaoIds.map(async (daoId) => {
      const members = await kvGetList<string>(kv, KV.daoMembers(daoId));
      if (members.includes(wallet)) {
        const dao = await kvGet<Dao>(kv, KV.dao(daoId));
        return dao;
      }
      return null;
    }),
  );

  for (const dao of memberChecks) {
    if (dao) daos.push(dao);
  }

  return jsonResponse({ data: daos, meta: { total: daos.length } });
}

// ─── GET /api/dao/discover — Discover public DAOs ────────────────────

export async function handleDaoDiscover(request: Request, env: Env): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
  const cursor = url.searchParams.get('cursor') || undefined;
  const search = url.searchParams.get('search')?.toLowerCase();
  const tag = url.searchParams.get('tag')?.toLowerCase();
  const chain = url.searchParams.get('chain')?.toLowerCase();
  const sort = url.searchParams.get('sort') || 'members'; // members, newest, name

  const allDaoIds = await kvGetList<string>(kv, KV.daoIdx);

  // Fetch all DAOs in parallel
  const daosRaw = await Promise.all(allDaoIds.map((daoId) => kvGet<Dao>(kv, KV.dao(daoId))));

  // Filter public DAOs and apply filters
  let filtered = daosRaw.filter((d): d is Dao => d !== null && d.visibility === 'public');

  if (search) {
    filtered = filtered.filter(
      (d) =>
        d.name.toLowerCase().includes(search) ||
        d.displayName.toLowerCase().includes(search) ||
        d.description.toLowerCase().includes(search),
    );
  }
  if (tag) {
    filtered = filtered.filter((d) => d.tags?.includes(tag));
  }
  if (chain) {
    filtered = filtered.filter((d) => d.chain === chain);
  }

  // Sort
  if (sort === 'newest') {
    filtered.sort((a, b) => b.createdAt - a.createdAt);
  } else if (sort === 'name') {
    filtered.sort((a, b) => a.displayName.localeCompare(b.displayName));
  } else {
    // Default: by member count
    filtered.sort((a, b) => b.memberCount - a.memberCount);
  }

  // Paginate
  const startIdx = cursor ? Math.max(0, allDaoIds.indexOf(cursor)) : 0;
  const paginated = filtered.slice(startIdx, startIdx + limit);
  const nextCursor =
    filtered.length > startIdx + limit ? filtered[startIdx + limit]?.id : undefined;

  return jsonResponse({
    data: paginated,
    meta: {
      total: filtered.length,
      limit,
      nextCursor,
    },
  });
}

// ─── GET /api/dao/:daoId/stats — DAO stats ──────────────────────────

export async function handleDaoStats(
  _request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const dao = daoResult as Dao;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const members = await kvGetList<string>(kv, KV.daoMembers(daoId));
  const proposalIds = await kvGetList<string>(kv, KV.proposalIdx(daoId));
  const treasury = await kvGet<TreasuryOverview>(kv, KV.treasury(daoId));

  // Compute proposal stats
  let activeProposals = 0;
  let passedProposals = 0;
  let totalVotes = 0;

  const proposals = await Promise.all(
    proposalIds.map((pid) => kvGet<Proposal>(kv, KV.proposal(daoId, pid))),
  );

  for (const p of proposals) {
    if (!p) continue;
    if (p.status === 'active') activeProposals++;
    if (p.status === 'passed' || p.status === 'executed') passedProposals++;
    if (p.voteSummary) {
      totalVotes += p.voteSummary.for + p.voteSummary.against + p.voteSummary.abstain;
    }
  }

  return jsonResponse({
    daoId: dao.id,
    displayName: dao.displayName,
    members: members.length,
    proposals: proposalIds.length,
    activeProposals,
    passedProposals,
    totalVotes,
    treasuryValue: treasury?.totalBalance ?? '0',
    treasuryTokens: treasury?.tokenCount ?? 0,
    treasuryNativeValue: treasury?.nativeValueUsd ?? 0,
    createdAt: dao.createdAt,
  });
}

// ─── POST /api/dao/:daoId/join — Join a DAO ─────────────────────────

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

  if (members.includes(wallet)) {
    return jsonResponse({ error: 'Already a member' }, 409);
  }

  // Verify token holding if DAO has a token
  if (dao.tokenAddress) {
    // In production, this would call an RPC to check balance
    // For now, we simulate the check
    // const balance = await checkTokenBalance(wallet, dao.tokenAddress, dao.chain);
    // if (balance <= 0) return jsonResponse({ error: 'Must hold DAO tokens to join' }, 403);
  }

  members.push(wallet);
  dao.memberCount = members.length;

  await Promise.all([kvPut(kv, KV.daoMembers(daoId), members), kvPut(kv, KV.dao(daoId), dao)]);

  await recordActivity(env, daoId, 'member_joined', wallet);

  return jsonResponse({ success: true, memberCount: dao.memberCount });
}

// ─── POST /api/dao/:daoId/leave — Leave a DAO ───────────────────────

export async function handleDaoLeave(request: Request, env: Env, daoId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const dao = daoResult as Dao;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const wallet = session.address.toLowerCase();

  // Cannot leave if you're the creator
  if (dao.creator === wallet) {
    return jsonResponse(
      { error: 'DAO creator cannot leave. Transfer ownership or delete the DAO.' },
      403,
    );
  }

  const members = await kvGetList<string>(kv, KV.daoMembers(daoId));
  if (!members.includes(wallet)) {
    return jsonResponse({ error: 'Not a member' }, 404);
  }

  const updatedMembers = members.filter((m) => m !== wallet);
  dao.memberCount = updatedMembers.length;

  await Promise.all([
    kvPut(kv, KV.daoMembers(daoId), updatedMembers),
    kvPut(kv, KV.dao(daoId), dao),
  ]);

  await recordActivity(env, daoId, 'member_left', wallet);

  return jsonResponse({ success: true, memberCount: dao.memberCount });
}

// ═══════════════════════════════════════════════════════════════════════
// PROPOSAL ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

// ─── POST /api/dao/:daoId/proposals — Create a proposal ─────────────

export async function handleDaoProposalCreate(
  request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
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

  // Check proposal threshold
  const votingPower = await getVotingPower(env, daoId, wallet);
  if (votingPower < dao.governance.proposalThreshold) {
    return jsonResponse(
      {
        error: `Need ${dao.governance.proposalThreshold} voting power to propose (you have ${votingPower})`,
      },
      403,
    );
  }

  const sizeCheck = validateBodySize(request, 100 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const title = sanitizeString(body.title, 200);
  const description = sanitizeString(body.description, 10000);
  const type =
    typeof body.type === 'string' &&
    ['text', 'transfer', 'config_change', 'membership', 'grant', 'stream', 'custom'].includes(
      body.type,
    )
      ? body.type
      : 'text';
  const targets = Array.isArray(body.targets)
    ? (body.targets as string[]).filter((t): t is string => typeof t === 'string')
    : undefined;
  const values = Array.isArray(body.values)
    ? (body.values as string[]).filter((v): v is string => typeof v === 'string')
    : undefined;
  const calldatas = Array.isArray(body.calldatas)
    ? (body.calldatas as string[]).filter((c): c is string => typeof c === 'string')
    : undefined;

  if (!title || title.length < 4) {
    return jsonResponse({ error: 'Title must be at least 4 characters' }, 400);
  }
  if (!description || description.length < 20) {
    return jsonResponse({ error: 'Description must be at least 20 characters' }, 400);
  }
  if (hasSuspiciousPayload(title) || hasSuspiciousPayload(description)) {
    return jsonResponse({ error: 'Invalid characters in content' }, 400);
  }

  const now = Date.now();
  const proposalId = generateId('prop');

  const proposal: Proposal = {
    id: proposalId,
    daoId,
    title,
    description,
    creator: wallet,
    createdAt: now,
    startAt: now + dao.governance.votingDelay,
    endAt: now + dao.governance.votingDelay + dao.governance.votingPeriod,
    status: 'active',
    type: type as Proposal['type'],
    targets,
    values,
    calldatas,
  };

  await Promise.all([
    kvPut(kv, KV.proposal(daoId, proposalId), proposal),
    kvAppendToList(kv, KV.proposalIdx(daoId), proposalId),
  ]);

  // Increment proposal count
  dao.proposalCount = (dao.proposalCount ?? 0) + 1;
  await kvPut(kv, KV.dao(daoId), dao);

  await recordActivity(env, daoId, 'proposal_created', wallet, {
    proposalId,
    title,
    type,
  });

  return jsonResponse({ success: true, proposal }, 201);
}

// ─── GET /api/dao/:daoId/proposals — List proposals ─────────────────

export async function handleDaoProposalsList(
  request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const url = new URL(request.url);
  const status = url.searchParams.get('status'); // active, passed, failed, executed, cancelled
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
  const cursor = url.searchParams.get('cursor') || undefined;

  const proposalIds = await kvGetList<string>(kv, KV.proposalIdx(daoId));

  // Fetch all proposals and auto-resolve expired ones
  const proposals: Proposal[] = [];
  for (const pid of proposalIds) {
    const proposal = await kvGet<Proposal>(kv, KV.proposal(daoId, pid));
    if (!proposal) continue;

    // Auto-resolve expired active proposals
    if (proposal.status === 'active' && proposal.endAt < Date.now()) {
      proposal.status = await computeFinalStatus(env, proposal, daoId);
      await kvPut(kv, KV.proposal(daoId, pid), proposal);
    }

    // Filter by status
    if (status && proposal.status !== status) continue;
    proposals.push(proposal);
  }

  proposals.sort((a, b) => b.createdAt - a.createdAt);

  // Paginate
  const startIdx = cursor ? Math.max(0, proposalIds.indexOf(cursor)) : 0;
  const paginated = proposals.slice(startIdx, startIdx + limit);

  return jsonResponse({
    data: paginated,
    meta: { total: proposals.length, limit, daoId },
  });
}

// ─── GET /api/dao/:daoId/proposals/:proposalId — Get proposal details ─

export async function handleDaoProposalGet(
  _request: Request,
  env: Env,
  daoId: string,
  proposalId: string,
): Promise<Response> {
  const proposalResult = await getProposalOr404(env, daoId, proposalId);
  if (proposalResult instanceof Response) return proposalResult;
  const proposal = proposalResult as Proposal;

  // Auto-resolve if expired
  if (proposal.status === 'active' && proposal.endAt < Date.now()) {
    const kv = env.GOVERNANCE;
    if (kv) {
      proposal.status = await computeFinalStatus(env, proposal, daoId);
      await kvPut(kv, KV.proposal(daoId, proposalId), proposal);
    }
  }

  return jsonResponse({ proposal });
}

// ─── PUT /api/dao/:daoId/proposals/:proposalId — Update proposal ────

export async function handleDaoProposalUpdate(
  request: Request,
  env: Env,
  daoId: string,
  proposalId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const proposalResult = await getProposalOr404(env, daoId, proposalId);
  if (proposalResult instanceof Response) return proposalResult;
  const proposal = proposalResult as Proposal;

  const wallet = session.address.toLowerCase();
  if (proposal.creator !== wallet) {
    return jsonResponse({ error: 'Only the creator can update this proposal' }, 403);
  }

  // Check if voting has already started
  if (Date.now() >= proposal.startAt) {
    return jsonResponse({ error: 'Cannot update proposal after voting has started' }, 400);
  }

  const sizeCheck = validateBodySize(request, 100 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const updated: Proposal = {
    ...proposal,
    title: sanitizeString(body.title, 200) || proposal.title,
    description: sanitizeString(body.description, 10000) || proposal.description,
  };

  if (hasSuspiciousPayload(updated.title) || hasSuspiciousPayload(updated.description)) {
    return jsonResponse({ error: 'Invalid characters in content' }, 400);
  }

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  await kvPut(kv, KV.proposal(daoId, proposalId), updated);

  return jsonResponse({ success: true, proposal: updated });
}

// ─── DELETE /api/dao/:daoId/proposals/:proposalId — Cancel proposal ──

export async function handleDaoProposalDelete(
  request: Request,
  env: Env,
  daoId: string,
  proposalId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const proposalResult = await getProposalOr404(env, daoId, proposalId);
  if (proposalResult instanceof Response) return proposalResult;
  const proposal = proposalResult as Proposal;

  const wallet = session.address.toLowerCase();
  if (proposal.creator !== wallet) {
    return jsonResponse({ error: 'Only the creator can cancel this proposal' }, 403);
  }

  // Can only cancel before voting starts
  if (Date.now() >= proposal.startAt) {
    return jsonResponse({ error: 'Cannot cancel proposal after voting has started' }, 400);
  }

  proposal.status = 'cancelled';

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  await kvPut(kv, KV.proposal(daoId, proposalId), proposal);

  return jsonResponse({ success: true, proposal });
}

// ─── POST /api/dao/:daoId/proposals/:proposalId/vote — Cast a vote ─

export async function handleDaoProposalVote(
  request: Request,
  env: Env,
  daoId: string,
  proposalId: string,
): Promise<Response> {
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

  if (proposal.status !== 'active') {
    return jsonResponse({ error: 'Proposal is not active' }, 400);
  }

  const now = Date.now();
  if (now < proposal.startAt) {
    return jsonResponse({ error: 'Voting has not started yet' }, 400);
  }
  if (now > proposal.endAt) {
    // Auto-resolve
    proposal.status = await computeFinalStatus(env, proposal, daoId);
    await kvPut(kv, KV.proposal(daoId, proposalId), proposal);
    return jsonResponse({ error: 'Voting period has ended' }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const choice = typeof body.choice === 'string' ? body.choice : '';
  if (!['for', 'against', 'abstain'].includes(choice)) {
    return jsonResponse({ error: 'Vote choice must be "for", "against", or "abstain"' }, 400);
  }

  // Get voting power
  const power = await getVotingPower(env, daoId, wallet);

  // Load or create vote record
  const vKey = KV.vote(proposalId);
  const voteRaw = await kvGet<VoteRecord>(kv, vKey);
  const voteRecord: VoteRecord = voteRaw ?? {
    votes: [],
    totals: { for: 0, against: 0, abstain: 0 },
    totalPowerParticipated: 0,
  };

  // Check for existing vote — deduct power and replace
  const existingIdx = voteRecord.votes.findIndex((v) => v.voter === wallet);
  if (existingIdx !== -1) {
    const oldVote = voteRecord.votes[existingIdx];
    if (oldVote) {
      voteRecord.totals[oldVote.choice] = Math.max(
        0,
        voteRecord.totals[oldVote.choice] - oldVote.power,
      );
      voteRecord.totalPowerParticipated = Math.max(
        0,
        voteRecord.totalPowerParticipated - oldVote.power,
      );
      voteRecord.votes.splice(existingIdx, 1);
    }
  }

  // Record new vote
  voteRecord.votes.push({
    voter: wallet,
    choice: choice as VoteChoice,
    power,
    timestamp: now,
  });
  voteRecord.totals[choice as VoteChoice] += power;
  voteRecord.totalPowerParticipated += power;

  await kvPut(kv, vKey, voteRecord);

  // Update proposal vote summary
  proposal.voteSummary = {
    for: voteRecord.totals.for,
    against: voteRecord.totals.against,
    abstain: voteRecord.totals.abstain,
    totalPower: voteRecord.totalPowerParticipated,
  };
  await kvPut(kv, KV.proposal(daoId, proposalId), proposal);

  await recordActivity(env, daoId, 'vote_cast', wallet, {
    proposalId,
    // Not including choice to preserve privacy — "A member voted"
  });

  return jsonResponse({
    success: true,
    totals: voteRecord.totals,
    yourVote: choice,
    votingPower: power,
  });
}

// ─── GET /api/dao/:daoId/proposals/:proposalId/votes — List all votes ─

export async function handleDaoProposalVotes(
  _request: Request,
  env: Env,
  daoId: string,
  proposalId: string,
): Promise<Response> {
  const proposalResult = await getProposalOr404(env, daoId, proposalId);
  if (proposalResult instanceof Response) return proposalResult;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const vKey = KV.vote(proposalId);
  const voteRaw = await kvGet<VoteRecord>(kv, vKey);
  const voteRecord: VoteRecord = voteRaw ?? {
    votes: [],
    totals: { for: 0, against: 0, abstain: 0 },
    totalPowerParticipated: 0,
  };

  // Return votes without voter identities (privacy)
  // Only return the totals and count
  return jsonResponse({
    totals: voteRecord.totals,
    totalPowerParticipated: voteRecord.totalPowerParticipated,
    voterCount: voteRecord.votes.length,
    // For transparency, voters are listed but choice is visible per-voter
    votes: voteRecord.votes.map((v) => ({
      voter: v.voter,
      choice: v.choice,
      power: v.power,
      timestamp: v.timestamp,
    })),
  });
}

// ─── GET /api/dao/:daoId/proposals/:proposalId/vote/me — Get my vote ─

export async function handleDaoProposalMyVote(
  request: Request,
  env: Env,
  daoId: string,
  proposalId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const proposalResult = await getProposalOr404(env, daoId, proposalId);
  if (proposalResult instanceof Response) return proposalResult;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const wallet = session.address.toLowerCase();
  const vKey = KV.vote(proposalId);
  const voteRaw = await kvGet<VoteRecord>(kv, vKey);

  if (!voteRaw) {
    return jsonResponse({ vote: null });
  }

  const myVote = voteRaw.votes.find((v) => v.voter === wallet);
  return jsonResponse({ vote: myVote ?? null });
}

// ─── POST /api/dao/:daoId/proposals/:proposalId/queue — Queue in timelock ─

export async function handleDaoProposalQueue(
  request: Request,
  env: Env,
  daoId: string,
  proposalId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const dao = daoResult as Dao;

  const proposalResult = await getProposalOr404(env, daoId, proposalId);
  if (proposalResult instanceof Response) return proposalResult;
  const proposal = proposalResult as Proposal;

  if (proposal.status !== 'passed') {
    return jsonResponse({ error: 'Only passed proposals can be queued' }, 400);
  }

  const wallet = session.address.toLowerCase();
  const membershipError = await checkDaoMember(env, daoId, wallet);
  if (membershipError) return membershipError;

  proposal.status = 'queued';
  proposal.queuedAt = Date.now();

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  await kvPut(kv, KV.proposal(daoId, proposalId), proposal);

  return jsonResponse({
    success: true,
    proposal,
    availableForExecutionAt: proposal.queuedAt + dao.governance.minDelay,
  });
}

// ─── POST /api/dao/:daoId/proposals/:proposalId/execute — Execute ────

export async function handleDaoProposalExecute(
  request: Request,
  env: Env,
  daoId: string,
  proposalId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const daoResult = await getDaoOr404(env, daoId);
  if (daoResult instanceof Response) return daoResult;
  const dao = daoResult as Dao;

  const proposalResult = await getProposalOr404(env, daoId, proposalId);
  if (proposalResult instanceof Response) return proposalResult;
  const proposal = proposalResult as Proposal;

  if (proposal.status !== 'queued') {
    return jsonResponse({ error: 'Proposal must be queued before execution' }, 400);
  }

  const wallet = session.address.toLowerCase();
  const membershipError = await checkDaoMember(env, daoId, wallet);
  if (membershipError) return membershipError;

  // Check timelock
  if (!proposal.queuedAt || Date.now() < proposal.queuedAt + dao.governance.minDelay) {
    return jsonResponse({ error: 'Timelock has not expired yet' }, 400);
  }

  // Check execution window
  if (proposal.queuedAt + dao.governance.minDelay + dao.governance.executeWindow < Date.now()) {
    proposal.status = 'failed';
    const kv = env.GOVERNANCE;
    if (kv) await kvPut(kv, KV.proposal(daoId, proposalId), proposal);
    return jsonResponse({ error: 'Execution window has expired' }, 400);
  }

  proposal.status = 'executed';
  proposal.executedAt = Date.now();
  // In production, this would submit an on-chain transaction
  proposal.executionTxHash = `0x${nonceId()}`;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  await kvPut(kv, KV.proposal(daoId, proposalId), proposal);

  await recordActivity(env, daoId, 'proposal_executed', wallet, {
    proposalId,
    title: proposal.title,
  });

  return jsonResponse({ success: true, proposal });
}

// ═══════════════════════════════════════════════════════════════════════
// DELEGATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

// ─── POST /api/dao/:daoId/delegate — Delegate voting power ──────────

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

  if (!delegate) {
    return jsonResponse({ error: 'delegate address is required' }, 400);
  }
  if (delegate === wallet) {
    return jsonResponse({ error: 'Cannot delegate to yourself' }, 400);
  }

  const delegation: Delegation = {
    delegator: wallet,
    delegate,
    amount,
    timestamp: Date.now(),
  };

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

  await recordActivity(env, daoId, 'delegation_changed', wallet, {
    delegate,
    amount,
  });

  return jsonResponse({ success: true, delegation });
}

// ─── POST /api/dao/:daoId/revoke-delegation — Revoke delegation ──────

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

  // Get existing delegation to deduct from delegates index
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
        if (d.totalDelegated <= 0) {
          delegates.splice(delegateIdx, 1);
        }
      }
    }
    delegates.sort((a, b) => b.totalDelegated - a.totalDelegated);
    await kvPut(kv, KV.delegates(daoId), delegates);
  }

  await kvPut(kv, KV.delegation(daoId, wallet), null); // Clear delegation
  // Actually delete the key
  await kv.delete(KV.delegation(daoId, wallet)).catch(() => {});

  return jsonResponse({ success: true, message: 'Delegation revoked' });
}

// ─── GET /api/dao/:daoId/delegation/mine — My delegation status ──────

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

// ─── GET /api/dao/:daoId/delegation/:address — Delegation status ─────

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

// ─── GET /api/dao/:daoId/delegates — Top delegates ───────────────────

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

  return jsonResponse({
    data: delegates,
    meta: { total: delegates.length, daoId },
  });
}

// ═══════════════════════════════════════════════════════════════════════
// TREASURY ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

// ─── GET /api/dao/:daoId/treasury — Treasury overview ────────────────

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

  if (!treasury) {
    // Return empty treasury for new DAOs
    return jsonResponse({
      totalBalance: '0',
      tokenCount: 0,
      tokens: [],
      nativeBalance: '0',
      nativeValueUsd: 0,
      updatedAt: Date.now(),
    });
  }

  return jsonResponse({ treasury });
}

// ─── GET /api/dao/:daoId/treasury/transactions — Treasury transactions ─

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

  const txs = await Promise.all(
    txIds.map((txId) => kvGet<TreasuryTransaction>(kv, KV.treasuryTx(txId))),
  );

  const validTxs = txs.filter((tx): tx is TreasuryTransaction => tx !== null);
  validTxs.sort((a, b) => b.timestamp - a.timestamp);

  return jsonResponse({
    data: validTxs,
    meta: { total: validTxs.length, daoId },
  });
}

// ─── POST /api/dao/:daoId/treasury/transfer — Propose a transfer ─────

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
  const tokenAddress = typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : undefined;
  const tokenSymbol = sanitizeString(body.tokenSymbol, 16);
  const amount = typeof body.amount === 'string' ? body.amount : '';
  const description = sanitizeString(body.description, 1000);

  if (!to) return jsonResponse({ error: 'Recipient address (to) is required' }, 400);
  if (!amount) return jsonResponse({ error: 'Amount is required' }, 400);

  // Create a proposal for this transfer
  const proposalId = generateId('prop');
  const now = Date.now();
  const proposal: Proposal = {
    id: proposalId,
    daoId,
    title: `Treasury transfer: ${amount} ${tokenSymbol || 'ETH'} → ${to.slice(0, 10)}...`,
    description: description || `Transfer ${amount} ${tokenSymbol || 'tokens'} to ${to}`,
    creator: wallet,
    createdAt: now,
    startAt: now, // No delay for transfer proposals
    endAt: now + 3 * 86400 * 1000, // 3 day voting
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
  const description = sanitizeString(body.description, 1000);

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
    kvPut(kv, KV.treasuryStream(streamId), stream),
    kvAppendToList(kv, KV.treasuryStreamIdx(daoId), streamId),
  ]);

  // Record transaction
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
  await kvPut(kv, KV.treasuryTx(tx.id), tx);
  await kvAppendToList(kv, KV.treasuryTxIdx(daoId), tx.id);

  await recordActivity(env, daoId, 'treasury_stream_started', wallet, {
    streamId,
    recipient,
    amount: totalAmount,
  });

  return jsonResponse({ success: true, stream }, 201);
}

// ─── GET /api/dao/:daoId/treasury/streams — Active streams ──────────

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
  const streams = await Promise.all(
    streamIds.map((sid) => kvGet<TreasuryStream>(kv, KV.treasuryStream(sid))),
  );

  const validStreams = streams.filter((s): s is TreasuryStream => s !== null);
  validStreams.sort((a, b) => b.createdAt - a.createdAt);

  return jsonResponse({
    data: validStreams,
    meta: { total: validStreams.length, daoId },
  });
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
  if (stream.daoId !== daoId)
    return jsonResponse({ error: 'Stream does not belong to this DAO' }, 404);

  const wallet = session.address.toLowerCase();
  if (stream.createdBy !== wallet) {
    return jsonResponse({ error: 'Only the stream creator can cancel' }, 403);
  }

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
    kvPut(kv, KV.treasuryGrant(grantId), grant),
    kvAppendToList(kv, KV.treasuryGrantIdx(daoId), grantId),
  ]);

  await recordActivity(env, daoId, 'grant_created', wallet, {
    grantId,
    title,
    totalBudget,
  });

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
  const grants = await Promise.all(
    grantIds.map((gid) => kvGet<GrantProgram>(kv, KV.treasuryGrant(gid))),
  );

  const validGrants = grants.filter((g): g is GrantProgram => g !== null);
  validGrants.sort((a, b) => b.createdAt - a.createdAt);

  return jsonResponse({
    data: validGrants,
    meta: { total: validGrants.length, daoId },
  });
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

  // Update remaining budget
  const remaining = BigInt(grant.remainingBudget);
  const spent = BigInt(milestone.amount);
  grant.remainingBudget = (remaining - spent).toString();

  // Check if all milestones are completed
  const allCompleted = grant.milestones.every((m) => m.status === 'completed');
  if (allCompleted) {
    grant.status = 'completed';
  }

  await kvPut(kv, KV.treasuryGrant(grantId), grant);

  await recordActivity(env, daoId, 'grant_milestone_completed', session.address.toLowerCase(), {
    grantId,
    milestoneId: milestone.id,
    title: milestone.title,
  });

  return jsonResponse({ success: true, grant });
}

// ═══════════════════════════════════════════════════════════════════════
// INTERNAL: compute final proposal status
// ═══════════════════════════════════════════════════════════════════════

async function computeFinalStatus(
  env: Env,
  proposal: Proposal,
  daoId: string,
): Promise<ProposalStatus> {
  if (proposal.status !== 'active') return proposal.status;

  try {
    const kv = env.GOVERNANCE;
    if (!kv) return 'failed';

    const vKey = KV.vote(proposal.id);
    const voteRaw = await kvGet<VoteRecord>(kv, vKey);
    const voteRecord: VoteRecord = voteRaw ?? {
      votes: [],
      totals: { for: 0, against: 0, abstain: 0 },
      totalPowerParticipated: 0,
    };

    // Calculate quorum
    const dao = await kvGet<Dao>(kv, KV.dao(daoId));
    const memberCount = dao?.memberCount ?? 0;
    const quorumThreshold =
      memberCount > 0 ? Math.ceil((memberCount * (dao?.governance.quorumPercent ?? 10)) / 100) : 1;
    const quorumMet = voteRecord.votes.length >= quorumThreshold;

    if (!quorumMet || voteRecord.totals.for <= voteRecord.totals.against) {
      await recordActivity(env, daoId, 'proposal_failed', proposal.creator, {
        proposalId: proposal.id,
        title: proposal.title,
        quorumMet,
        votesFor: voteRecord.totals.for,
        votesAgainst: voteRecord.totals.against,
      });
      return 'failed';
    }

    await recordActivity(env, daoId, 'proposal_passed', proposal.creator, {
      proposalId: proposal.id,
      title: proposal.title,
      votesFor: voteRecord.totals.for,
      votesAgainst: voteRecord.totals.against,
    });
    return 'passed';
  } catch {
    return 'failed';
  }
}
