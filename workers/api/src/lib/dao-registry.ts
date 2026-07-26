/**
 * @degenfeed/api-worker — DAO Discovery & Cross-Platform Registry
 *
 * A unified registry that links DegenFeed DAOs with their counterparts
 * across Snapshot, Tally, Realms, and OpenZeppelin Defender.
 *
 * KV schema (NS: GOVERNANCE):
 *   dao:registry:list              → array of all DAO IDs (index)
 *   dao:registry:{daoId}           → DAORegistryEntry (persistent)
 *   dao:lookup:snapshot:{space}    → daoId (reverse lookup)
 *   dao:lookup:tally:{governor}    → daoId (reverse lookup)
 *   dao:lookup:realms:{realm}      → daoId (reverse lookup)
 *
 * Public API:
 *   GET /api/dao/registry                — list all registered DAOs
 *   GET /api/dao/registry?protocol=X     — filter by platform
 *   GET /api/dao/registry/:daoId         — get DAO across all platforms
 *   POST /api/dao/registry               — register a DAO
 *   POST /api/dao/registry/:daoId/link   — link an external platform
 */

import { badRequest, created, notFound, ok, serverError } from '../response-helpers';
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────

export type DAORegistryEntry = {};
