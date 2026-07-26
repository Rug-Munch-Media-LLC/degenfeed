/**
 * @degenfeed/api-worker — DAO Activity Feed
 *
 * Provides a unified activity feed for DAOs and per-user activity across DAOs.
 *
 * KV schema:
 *   dao:activity:{daoId}:{eventId}   → Activity event
 *   dao:activity:idx:{daoId}         → Array of event IDs for a DAO
 *   dao:activity:mine:{wallet}       → Array of "daoId:eventId" references
 */

import { jsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────

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

export type ActivityEvent = {};
