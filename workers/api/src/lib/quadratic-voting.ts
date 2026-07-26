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

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type QuadraticVoterState = {};
