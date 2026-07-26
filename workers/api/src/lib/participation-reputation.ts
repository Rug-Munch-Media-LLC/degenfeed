/**
 * @degenfeed/api-worker — Participation Reputation Engine
 *
 * Assigns reputation scores (0–1000) based on DAO participation actions,
 * with decay over inactivity periods. Tied to the REPUTATION KV namespace.
 *
 * KV schema:
 *   reputation:{userId}                          → ReputationRecord
 *   reputation:{userId}:history                  → ReputationEvent[] (capped at 500)
 *   reputation:{userId}:daily:{date}             → DailyCounter (rate limits)
 *   dao:leaderboard:{daoId}:{period}             → LeaderboardEntry[]
 *   reputation:dao:{daoId}:most-active-week      → ActiveMember[]
 *
 * Periods: weekly, monthly, alltime
 */

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ReputationAction =
  | 'vote_cast'
  | 'proposal_created'
  | 'proposal_passed'
  | 'treasury_managed'
  | 'member_recruited'
  | 'discussion_participation'
  | 'delegation_trusted'
  | 'consistent_voter'
  | 'early_member'
  | 'consecutive_vote_bonus';

export type ReputationEvent = {}
