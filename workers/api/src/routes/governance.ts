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
import { jsonResponse } from '../response-helpers';
import type { SessionPayload } from '../session';
import { parseSessionCookie, verifySessionCookie } from '../session';
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────────────

export type ProposalType = 'text' | 'rule_change' | 'mod_action' | 'treasury';
export type ProposalStatus = 'active' | 'passed' | 'rejected' | 'cancelled';
export type VoteChoice = 'for' | 'against' | 'abstain';

export type Proposal = {}
