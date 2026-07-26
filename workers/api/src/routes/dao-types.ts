/**
 * @degenfeed/api-worker — DAO Types
 *
 * Shared types extracted from the monolithic dao.ts.
 */

// ─── Enums / Union Types ─────────────────────────────────────────────

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

// ─── DAO Entity ──────────────────────────────────────────────────────

export type Dao = {};
