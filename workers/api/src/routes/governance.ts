/**
 * @degenfeed/api-worker — Governance / DAO Proposal Routes
 *
 * Proposal types:
 *   - text:        Simple text proposal (temperature check)
 *   - rule_change: Change community rules
 *   - mod_action:  Ban/unban a user (future)
 *   - treasury:    Spend community tips (future)
 *
 * Voting: 1 wallet = 1 vote (token-weighted in future).
 * Voting period: 3 days default (configurable 1d, 3d, 7d).
 * Quorum: 10% of members must vote.
 *
 * KV schema:
 *   gov:proposal:{community}:{id}  → Proposal data
 *   gov:vote:{proposalId}          → Vote tally
 *   gov:idx:{community}            → Array of proposal IDs (index)
 */

import { communityKey, communityMembersKey, slugifyCommunity } from '@degenfeed/utils';
import type { Env } from '../index';
import { jsonResponse } from '../index';
import type { SessionPayload } from '../session';
import { parseSessionCookie, verifySessionCookie } from '../session';

// ─── Types ───────────────────────────────────────────────────────────

export type ProposalType = 'text' | 'rule_change' | 'mod_action' | 'treasury';
export type ProposalStatus = 'active' | 'passed' | 'rejected' | 'cancelled';
export type VoteChoice = 'for' | 'against' | 'abstain';

export interface Proposal {
  id: string;
  community: string;
  title: string;
  type: ProposalType;
  description: string;
  creator: string;
  createdAt: number;
  votingPeriod: number; // ms
  endsAt: number;
  status: ProposalStatus;
  /** For mod_action: target user address */
  targetUser?: string;
}

export interface VoteRecord {
  votes: Array<{
    voter: string;
    choice: VoteChoice;
    timestamp: number;
  }>;
  totals: {
    for: number;
    against: number;
    abstain: number;
  };
}

// ─── KV Helpers ──────────────────────────────────────────────────────

function proposalKey(community: string, id: string): string {
  return `gov:proposal:${community}:${id}`;
}

function voteKey(proposalId: string): string {
  return `gov:vote:${proposalId}`;
}

function idxKey(community: string): string {
  return `gov:idx:${community}`;
}

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += bytes[i].toString(36).padStart(2, '0');
  }
  return `prop_${id.slice(0, 16)}`;
}

const VOTING_PERIODS: Record<string, number> = {
  '1d': 86_400_000,
  '3d': 259_200_000,
  '7d': 604_800_000,
};

// ─── Session Helper ──────────────────────────────────────────────────

async function getSession(request: Request, env: Env): Promise<SessionPayload | null> {
  const secret = env.AUTH_SECRET;
  if (!secret) return null;
  const cookieValue = parseSessionCookie(request.headers.get('cookie'));
  if (!cookieValue) return null;
  try {
    return await verifySessionCookie(cookieValue, secret);
  } catch {
    return null;
  }
}

async function getMemberCount(env: Env, slug: string): Promise<number> {
  try {
    const communityRaw = await env.COMMUNITIES?.get(communityKey(slug)).catch(() => null);
    if (communityRaw) {
      const community = JSON.parse(communityRaw) as { memberCount: number };
      return community.memberCount ?? 0;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

async function getProposalOr404(
  env: Env,
  slug: string,
  proposalId: string,
): Promise<Proposal | Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);
  const raw = await kv.get(proposalKey(slug, proposalId)).catch(() => null);
  if (!raw) return jsonResponse({ error: 'Proposal not found' }, 404);
  return JSON.parse(raw) as Proposal;
}

async function checkCommunityExists(env: Env, slug: string): Promise<Response | null> {
  const raw = await env.COMMUNITIES?.get(communityKey(slug)).catch(() => null);
  if (!raw) return jsonResponse({ error: 'Community not found' }, 404);
  return null;
}

async function checkMembership(env: Env, slug: string, wallet: string): Promise<Response | null> {
  const membersRaw = await env.COMMUNITIES?.get(communityMembersKey(slug)).catch(() => null);
  const members: string[] = membersRaw ? JSON.parse(membersRaw) : [];
  if (!members.includes(wallet)) {
    return jsonResponse({ error: 'Must be a community member' }, 403);
  }
  return null;
}

// ─── GET /api/community/:name/proposals — List proposals ────────────

export async function handleProposalsList(
  _request: Request,
  env: Env,
  name: string,
): Promise<Response> {
  const slug = slugifyCommunity(name);
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const notFound = await checkCommunityExists(env, slug);
  if (notFound) return notFound;

  // Fetch proposal index
  const idxRaw = await kv.get(idxKey(slug)).catch(() => null);
  const ids: string[] = idxRaw ? JSON.parse(idxRaw) : [];

  // Fetch all proposals in parallel
  const proposals: Proposal[] = [];
  if (ids.length > 0) {
    const raws = await Promise.all(
      ids.map((id) => kv.get(proposalKey(slug, id)).catch(() => null)),
    );
    for (const raw of raws) {
      if (raw) {
        try {
          const p = JSON.parse(raw) as Proposal;
          // Auto-resolve expired active proposals
          if (p.status === 'active' && p.endsAt < Date.now()) {
            p.status = await computeFinalStatus(env, p, slug);
            await kv.put(proposalKey(slug, p.id), JSON.stringify(p));
          }
          proposals.push(p);
        } catch {
          /* skip corrupt */
        }
      }
    }
  }

  proposals.sort((a, b) => b.createdAt - a.createdAt);

  return jsonResponse({ data: proposals, meta: { total: proposals.length, community: slug } });
}

// ─── POST /api/community/:name/proposals — Create a proposal ────────

export async function handleProposalCreate(
  request: Request,
  env: Env,
  name: string,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonResponse({ error: 'Unauthorized' }, 401);

  const slug = slugifyCommunity(name);
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const notFound = await checkCommunityExists(env, slug);
  if (notFound) return notFound;

  const membershipError = await checkMembership(env, slug, session.address.toLowerCase());
  if (membershipError) return membershipError;

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const type = typeof body.type === 'string' ? body.type : 'text';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const periodKey = typeof body.votingPeriod === 'string' ? body.votingPeriod : '3d';
  const targetUser = typeof body.targetUser === 'string' ? body.targetUser.trim() : undefined;

  if (!title || title.length < 4) {
    return jsonResponse({ error: 'Title must be at least 4 characters' }, 400);
  }
  if (title.length > 200) {
    return jsonResponse({ error: 'Title must be 200 characters or fewer' }, 400);
  }
  if (!['text', 'rule_change', 'mod_action', 'treasury'].includes(type)) {
    return jsonResponse({ error: 'Invalid proposal type' }, 400);
  }
  if (!description || description.length < 20) {
    return jsonResponse({ error: 'Description must be at least 20 characters' }, 400);
  }
  if (description.length > 10_000) {
    return jsonResponse({ error: 'Description must be 10,000 characters or fewer' }, 400);
  }
  if (type === 'mod_action' && !targetUser) {
    return jsonResponse({ error: 'targetUser required for mod_action proposals' }, 400);
  }

  const votingPeriod = VOTING_PERIODS[periodKey] ?? VOTING_PERIODS['3d'];
  const now = Date.now();
  const wallet = session.address.toLowerCase();

  const proposal: Proposal = {
    id: generateId(),
    community: slug,
    title,
    type: type as ProposalType,
    description,
    creator: wallet,
    createdAt: now,
    votingPeriod,
    endsAt: now + votingPeriod,
    status: 'active',
    targetUser,
  };

  // Persist to KV: write proposal + update index
  const pk = proposalKey(slug, proposal.id);
  await kv.put(pk, JSON.stringify(proposal));

  // Update index (read-then-write for Cloudflare KV)
  const idxRaw = await kv.get(idxKey(slug)).catch(() => null);
  const idx: string[] = idxRaw ? JSON.parse(idxRaw) : [];
  idx.push(proposal.id);
  await kv.put(idxKey(slug), JSON.stringify(idx));

  return jsonResponse({ success: true, proposal }, 201);
}

// ─── POST /api/community/:name/proposals/:id/vote — Vote ─────────────

export async function handleProposalVote(
  request: Request,
  env: Env,
  name: string,
  proposalId: string,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonResponse({ error: 'Unauthorized' }, 401);

  const slug = slugifyCommunity(name);
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const notFound = await checkCommunityExists(env, slug);
  if (notFound) return notFound;

  const wallet = session.address.toLowerCase();
  const membershipError = await checkMembership(env, slug, wallet);
  if (membershipError) return membershipError;

  // Fetch proposal
  const proposalResult = await getProposalOr404(env, slug, proposalId);
  if (proposalResult instanceof Response) return proposalResult;
  const proposal = proposalResult as Proposal;

  if (proposal.status !== 'active') {
    return jsonResponse({ error: 'Proposal is not active' }, 400);
  }
  if (proposal.endsAt < Date.now()) {
    // Auto-resolve expired proposal
    proposal.status = await computeFinalStatus(env, proposal, slug);
    await kv.put(proposalKey(slug, proposalId), JSON.stringify(proposal));
    return jsonResponse({ error: 'Voting period has ended' }, 400);
  }

  // Parse body
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

  // Load or create vote record
  const vKey = voteKey(proposalId);
  const voteRaw = await kv.get(vKey).catch(() => null);
  const voteRecord: VoteRecord = voteRaw
    ? JSON.parse(voteRaw)
    : { votes: [], totals: { for: 0, against: 0, abstain: 0 } };

  // Check for existing vote — allow changing vote
  const existingIdx = voteRecord.votes.findIndex((v) => v.voter === wallet);
  if (existingIdx !== -1) {
    const oldChoice = voteRecord.votes[existingIdx].choice;
    voteRecord.totals[oldChoice] = Math.max(0, voteRecord.totals[oldChoice] - 1);
    voteRecord.votes.splice(existingIdx, 1);
  }

  // Record new vote
  voteRecord.votes.push({
    voter: wallet,
    choice: choice as VoteChoice,
    timestamp: Date.now(),
  });
  voteRecord.totals[choice as VoteChoice] += 1;

  await kv.put(vKey, JSON.stringify(voteRecord));

  return jsonResponse({
    success: true,
    totals: voteRecord.totals,
    yourVote: choice,
  });
}

// ─── GET /api/community/:name/proposals/:id/results — Get results ────

export async function handleProposalResults(
  _request: Request,
  env: Env,
  name: string,
  proposalId: string,
): Promise<Response> {
  const slug = slugifyCommunity(name);
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  // Fetch proposal
  const proposalResult = await getProposalOr404(env, slug, proposalId);
  if (proposalResult instanceof Response) return proposalResult;
  const proposal = proposalResult as Proposal;

  // Auto-resolve if expired
  if (proposal.status === 'active' && proposal.endsAt < Date.now()) {
    proposal.status = await computeFinalStatus(env, proposal, slug);
    await kv.put(proposalKey(slug, proposalId), JSON.stringify(proposal));
  }

  // Fetch vote record
  const vKey = voteKey(proposalId);
  const voteRaw = await kv.get(vKey).catch(() => null);
  const voteRecord: VoteRecord = voteRaw
    ? JSON.parse(voteRaw)
    : { votes: [], totals: { for: 0, against: 0, abstain: 0 } };

  const memberCount = await getMemberCount(env, slug);
  const totalVotes = voteRecord.votes.length;
  const quorumPct = memberCount > 0 ? (totalVotes / memberCount) * 100 : 0;
  const quorumMet = quorumPct >= 10;

  // Compute winner for resolved proposals
  let winner: VoteChoice | 'none' = 'none';
  if (totalVotes > 0 && proposal.status !== 'active') {
    if (voteRecord.totals.for > voteRecord.totals.against && quorumMet) {
      winner = 'for';
    } else if (voteRecord.totals.against > voteRecord.totals.for && quorumMet) {
      winner = 'against';
    }
  }

  return jsonResponse({
    proposal,
    results: voteRecord,
    meta: {
      totalVotes,
      memberCount,
      quorumPct: Math.round(quorumPct * 10) / 10,
      quorumMet,
      winner,
      endsAt: proposal.endsAt,
      timeRemaining: Math.max(0, proposal.endsAt - Date.now()),
    },
  });
}

// ─── Internal: compute final status based on vote results ────────────

async function computeFinalStatus(
  env: Env,
  proposal: Proposal,
  communitySlug: string,
): Promise<ProposalStatus> {
  if (proposal.status !== 'active') return proposal.status;

  try {
    const kv = env.GOVERNANCE;
    if (!kv) return 'rejected';
    const vKey = voteKey(proposal.id);
    const voteRaw = await kv.get(vKey).catch(() => null);
    const voteRecord: VoteRecord = voteRaw
      ? JSON.parse(voteRaw)
      : { votes: [], totals: { for: 0, against: 0, abstain: 0 } };

    const memberCount = await getMemberCount(env, communitySlug);
    const totalVotes = voteRecord.votes.length;
    const quorumMet = memberCount > 0 ? totalVotes / memberCount >= 0.1 : totalVotes > 0;

    if (!quorumMet || voteRecord.totals.for <= voteRecord.totals.against) {
      return 'rejected';
    }
    return 'passed';
  } catch {
    return 'rejected';
  }
}
