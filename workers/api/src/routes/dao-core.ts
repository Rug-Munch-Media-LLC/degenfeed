/**
 * @degenfeed/api-worker — DAO Core: CRUD + KV helpers
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
 */

import { log } from '../logger';
import { jsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';
import type { ActivityType, Dao, DaoVisibility, Delegation, Proposal } from './dao-types';

// ─── KV Key Patterns ─────────────────────────────────────────────

export const KV = {
