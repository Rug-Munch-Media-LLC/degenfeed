/**
 * @degenfeed/api-worker — Quadratic Voting Engine
 *
 * Quadratic voting (QV) enables members to express preference intensity by
 * allocating multiple votes to a single option, where the cost grows quadratically.
 *
 * Core formula:
 *   votingPower = floor(sqrt(tokenBalance))
 *   cost(votes) = votes² × creditsPerToken
 *
 * KV schema:
 *   quadratic:{daoId}:{userId}         → QuadraticVoterState
 *   quadratic:tally:{proposalId}       → QuadraticTally
 *   quadratic:results:{proposalId}     → QuadraticResults
 */

import type { Env } from '../index';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface QuadraticVoterState {
  userId: string;
  daoId: string;
  /** Token balance used for power calculation */
  tokenBalance: number;
  /** Total voting power = floor(sqrt(balance)) */
  votingPower: number;
  /** Credits remaining for the current proposal period */
  creditsRemaining: number;
  /** Credits per token (default 1) */
  creditsPerToken: number;
  /** When the state was last refreshed */
  updatedAt: number;
}

export interface QuadraticVoteAllocation {
  optionId: string;
  votes: number;
  cost: number;
}

export interface QuadraticTally {
  proposalId: string;
  daoId: string;
  /** Total voters who participated */
  totalVoters: number;
  /** Total credits spent */
  totalCreditsSpent: number;
  /** Results: optionId → total votes (sqrt sum) */
  results: Record<string, number>;
  /** Raw votes cast per option */
  rawVotes: Record<string, number>;
  /** Detailed per-voter allocation */
  allocations: Array<{
    voterId: string;
    optionId: string;
    votes: number;
    weight: number;
    cost?: number;
  }>;
  /** When the tally was last computed */
  updatedAt: number;
  /** Whether the proposal is active or finalized */
  finalized: boolean;
}

export interface QuadraticResults {
  proposalId: string;
  daoId: string;
  /** Ranked options by sqrt(tally) */
  ranked: Array<{
    optionId: string;
    totalVotes: number;
    totalWeight: number;
    percentage: number;
    isWinner: boolean;
  }>;
  /** Participation stats */
  participation: {
    totalVoters: number;
    totalVotingPower: number;
    voterTurnout: number;
  };
  updatedAt: number;
}

// ─── Core Math ─────────────────────────────────────────────────────────────

/**
 * Calculate quadratic voting power from token balance.
 * votingPower = floor(sqrt(tokenBalance))
 *
 * @param tokenBalance - The user's token balance (in smallest units or normalized)
 * @returns The user's voting power (integer)
 */
export function calculateQuadraticVotingPower(tokenBalance: number, _totalSupply?: number): number {
  if (tokenBalance <= 0) return 0;
  // If totalSupply is provided, use sqrt(balance/totalSupply * 1000) for relative power
  if (_totalSupply && _totalSupply > 0) {
    const relative = (tokenBalance / _totalSupply) * 10000;
    return Math.max(1, Math.floor(Math.sqrt(relative)));
  }
  return Math.max(1, Math.floor(Math.sqrt(tokenBalance)));
}

/**
 * Calculate the cost in voting credits for casting a given number of votes.
 * cost = votes² × creditsPerToken
 *
 * @param votesToCast - Number of votes to allocate
 * @param creditPerToken - Credits required per token (default 1)
 * @returns The cost in credits
 */
export function calculateQuadraticVoteCost(votesToCast: number, creditPerToken = 1): number {
  if (votesToCast <= 0) return 0;
  return votesToCast * votesToCast * creditPerToken;
}

/**
 * Calculate the maximum number of votes a user can cast given their credits.
 * Solves: credits >= votes² × creditPerToken
 *         votes <= sqrt(credits / creditPerToken)
 *
 * @param credits - Total voting credits available
 * @param creditPerToken - Credits required per token (default 1)
 * @returns Maximum votes the user can cast (integer)
 */
export function maxVotesForCredits(credits: number, creditPerToken = 1): number {
  if (credits <= 0 || creditPerToken <= 0) return 0;
  return Math.floor(Math.sqrt(credits / creditPerToken));
}

/**
 * Allocate quadratic votes across multiple options to maximize impact.
 * Distributes credits proportionally based on preference weights.
 *
 * @param credits - Total voting credits available
 * @param options - Array of options with preference weights
 * @param creditPerToken - Credits per token (default 1)
 * @returns Array of allocations with votes and costs
 */
export interface VoteOption {
  id: string;
  /** Preference weight (0-100). Higher = more votes allocated. */
  preferenceWeight: number;
}

export function allocateQuadraticVotes(
  credits: number,
  options: VoteOption[],
  creditPerToken = 1,
): QuadraticVoteAllocation[] {
  if (options.length === 0) return [];
  if (credits <= 0) return options.map((o) => ({ optionId: o.id, votes: 0, cost: 0 }));

  // Normalize preference weights
  const totalWeight = options.reduce((sum, o) => sum + Math.max(0, o.preferenceWeight), 0);
  if (totalWeight === 0) {
    return options.map((o) => ({ optionId: o.id, votes: 0, cost: 0 }));
  }

  // Distribute credits proportionally, then compute votes per option
  const allocations: QuadraticVoteAllocation[] = [];

  // First pass: proportional allocation (bounded by quadratic cost)
  let remainingCredits = credits;

  for (let i = 0; i < options.length; i++) {
    const option = options[i]!;
    const proportion = Math.max(0, option.preferenceWeight) / totalWeight;

    // Credits assigned to this option
    const optionCredits = Math.floor(credits * proportion);

    // Maximum votes achievable with those credits
    const maxVote = maxVotesForCredits(optionCredits, creditPerToken);

    // But we may not have enough credits left
    const actualCost = calculateQuadraticVoteCost(maxVote, creditPerToken);

    if (actualCost <= remainingCredits) {
      allocations.push({
        optionId: option.id,
        votes: maxVote,
        cost: actualCost,
      });
      remainingCredits -= actualCost;
    } else {
      // Reduce votes to fit remaining credits
      const reducedVotes = maxVotesForCredits(remainingCredits, creditPerToken);
      const reducedCost = calculateQuadraticVoteCost(reducedVotes, creditPerToken);
      allocations.push({
        optionId: option.id,
        votes: reducedVotes,
        cost: reducedCost,
      });
      remainingCredits -= reducedCost;
    }
  }

  // Second pass: distribute leftover credits to the highest-weighted option
  if (remainingCredits > 0) {
    const topOption = options.reduce((best, o) =>
      o.preferenceWeight > best.preferenceWeight ? o : best,
    );
    const existing = allocations.find((a) => a.optionId === topOption.id);
    if (existing) {
      const extraVotes = maxVotesForCredits(remainingCredits + existing.cost, creditPerToken);
      if (extraVotes > existing.votes) {
        const extraCost = calculateQuadraticVoteCost(extraVotes, creditPerToken);
        existing.votes = extraVotes;
        existing.cost = extraCost;
      }
    }
  }

  return allocations;
}

/**
 * Tally quadratic votes for a proposal.
 * Final score per option = floor(sqrt(sum of votes))
 *
 * @param votes - Array of vote allocations (per voter)
 * @returns The tally with sqrt-weighted results
 */
export function tallyQuadraticVotes(votes: QuadraticTally['allocations']): {
  results: Record<string, number>;
  rawVotes: Record<string, number>;
  ranked: QuadraticResults['ranked'];
} {
  const rawVotes: Record<string, number> = {};
  const voteCounts: Record<string, number> = {};

  for (const v of votes) {
    rawVotes[v.optionId] = (rawVotes[v.optionId] ?? 0) + v.votes;
    voteCounts[v.optionId] = (voteCounts[v.optionId] ?? 0) + v.weight;
  }

  const results: Record<string, number> = {};
  for (const [optionId, totalWeight] of Object.entries(voteCounts)) {
    results[optionId] = Math.floor(Math.sqrt(totalWeight));
  }

  // Rank
  const totalWeightAll = Object.values(results).reduce((s, w) => s + w, 0);
  const sorted = Object.entries(results)
    .sort(([, a], [, b]) => b - a)
    .map(([optionId, totalWeight], i) => ({
      optionId,
      totalVotes: rawVotes[optionId] ?? 0,
      totalWeight,
      percentage: totalWeightAll > 0 ? Math.round((totalWeight / totalWeightAll) * 100) : 0,
      isWinner: i === 0 && totalWeight > 0,
    }));

  return { results, rawVotes, ranked: sorted };
}

// ─── KV helpers ────────────────────────────────────────────────────────────

function voterKey(daoId: string, userId: string): string {
  return `quadratic:${daoId}:${userId}`;
}

function tallyKey(proposalId: string): string {
  return `quadratic:tally:${proposalId}`;
}

function resultsKey(proposalId: string): string {
  return `quadratic:results:${proposalId}`;
}

async function kvGet<T>(env: Env, key: string): Promise<T | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function kvPut(env: Env, key: string, value: unknown, ttl = 0): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(key, JSON.stringify(value), ttl > 0 ? { expirationTtl: ttl } : undefined);
  } catch {
    /* non-critical */
  }
}

// ─── Engine API ────────────────────────────────────────────────────────────

/**
 * Initialize or refresh a voter's quadratic state for a DAO.
 */
export async function initVoterState(
  env: Env,
  userId: string,
  daoId: string,
  tokenBalance: number,
  creditsPerToken = 1,
): Promise<QuadraticVoterState> {
  const votingPower = calculateQuadraticVotingPower(tokenBalance);
  const state: QuadraticVoterState = {
    userId,
    daoId,
    tokenBalance,
    votingPower,
    creditsRemaining: votingPower,
    creditsPerToken,
    updatedAt: Date.now(),
  };
  await kvPut(env, voterKey(daoId, userId), state);
  return state;
}

/**
 * Get a voter's current quadratic state.
 */
export async function getVoterState(
  env: Env,
  userId: string,
  daoId: string,
): Promise<QuadraticVoterState | null> {
  return kvGet<QuadraticVoterState>(env, voterKey(daoId, userId));
}

/**
 * Cast quadratic votes on a proposal.
 *
 * @returns The updated tally, or null if the voter doesn't have enough credits.
 */
export async function castQuadraticVotes(
  env: Env,
  proposalId: string,
  daoId: string,
  voterId: string,
  allocations: QuadraticVoteAllocation[],
): Promise<QuadraticTally | null> {
  // 1. Validate voter state
  const state = await getVoterState(env, voterId, daoId);
  if (!state) return null;

  // 2. Calculate total cost
  const totalCost = allocations.reduce((s, a) => s + a.cost, 0);
  if (totalCost > state.creditsRemaining) return null;

  // 3. Deduct credits
  state.creditsRemaining -= totalCost;
  state.updatedAt = Date.now();
  await kvPut(env, voterKey(daoId, voterId), state);

  // 4. Record votes in tally
  const tallyKey_ = tallyKey(proposalId);
  const tally = (await kvGet<QuadraticTally>(env, tallyKey_)) ?? {
    proposalId,
    daoId,
    totalVoters: 0,
    totalCreditsSpent: 0,
    results: {},
    rawVotes: {},
    allocations: [],
    updatedAt: Date.now(),
    finalized: false,
  };

  // Track unique voters
  const existingVoter = tally.allocations.find((a) => a.voterId === voterId);
  if (!existingVoter) {
    tally.totalVoters += 1;
  }

  for (const alloc of allocations) {
    if (alloc.votes <= 0) continue;

    // Remove previous allocation for this voter+option if exists
    const prevIdx = tally.allocations.findIndex(
      (a) => a.voterId === voterId && a.optionId === alloc.optionId,
    );
    if (prevIdx >= 0) {
      tally.totalCreditsSpent -= tally.allocations[prevIdx]!.cost ?? 0;
      tally.allocations.splice(prevIdx, 1);
    }

    tally.allocations.push({
      voterId,
      optionId: alloc.optionId,
      votes: alloc.votes,
      weight: alloc.votes, // weight = votes in QV
      cost: alloc.cost,
    });
    tally.totalCreditsSpent += alloc.cost;
  }

  tally.updatedAt = Date.now();
  await kvPut(env, tallyKey_, tally);

  return tally;
}

/**
 * Finalize a quadratic vote tally: compute sqrt-weighted results.
 */
export async function finalizeQuadraticTally(
  env: Env,
  proposalId: string,
): Promise<QuadraticResults | null> {
  const tallyKey_ = tallyKey(proposalId);
  const tally = await kvGet<QuadraticTally>(env, tallyKey_);
  if (!tally) return null;

  tally.finalized = true;
  tally.updatedAt = Date.now();

  const { results, rawVotes, ranked } = tallyQuadraticVotes(tally.allocations);
  tally.results = results;
  tally.rawVotes = rawVotes;

  await kvPut(env, tallyKey_, tally);

  // Compute voter turnout stats
  const totalVotingPower = tally.allocations.reduce((s, a) => s + a.weight, 0);

  const qResults: QuadraticResults = {
    proposalId,
    daoId: tally.daoId,
    ranked,
    participation: {
      totalVoters: tally.totalVoters,
      totalVotingPower,
      voterTurnout:
        tally.totalVoters > 0
          ? Math.round((tally.totalVoters / Math.max(1, tally.totalVoters)) * 100)
          : 0,
    },
    updatedAt: Date.now(),
  };

  await kvPut(env, resultsKey(proposalId), qResults);

  return qResults;
}

/**
 * Get the tally for a proposal.
 */
export async function getTally(env: Env, proposalId: string): Promise<QuadraticTally | null> {
  return kvGet<QuadraticTally>(env, tallyKey(proposalId));
}

/**
 * Get finalized results for a proposal.
 */
export async function getResults(env: Env, proposalId: string): Promise<QuadraticResults | null> {
  return kvGet<QuadraticResults>(env, resultsKey(proposalId));
}

/**
 * Preview vote distribution before submitting.
 * Shows estimated outcomes without recording.
 */
export function previewVoteDistribution(
  credits: number,
  options: VoteOption[],
  creditPerToken = 1,
): {
  allocations: QuadraticVoteAllocation[];
  totalCost: number;
  remainingCredits: number;
} {
  const allocations = allocateQuadraticVotes(credits, options, creditPerToken);
  const totalCost = allocations.reduce((s, a) => s + a.cost, 0);
  return {
    allocations,
    totalCost,
    remainingCredits: credits - totalCost,
  };
}
