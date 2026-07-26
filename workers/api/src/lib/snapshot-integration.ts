/**
 * @degenfeed/api-worker — Snapshot.org Integration
 *
 * Integrates DegenFeed DAOs with Snapshot.org — the most widely used
 * off-chain voting platform in Web3.
 *
 * Capabilities:
 *   - Strategy JSON generation for token-weighted voting
 *   - Snapshot space configuration export
 *   - Bidirectional proposal sync (DegenFeed → Snapshot)
 *   - Vote import (Snapshot → DegenFeed analytics)
 *   - Delegation state sync via Snapshot Delegate Registry
 *
 * KV schema (NS: GOVERNANCE):
 *   snapshot:linked:{daoId}              → SnapshotSpaceLink (persistent)
 *   snapshot:sync:{daoId}:{proposalId}   → last sync timestamp
 *   snapshot:delegation:{daoId}:{voter}  → delegated amount
 *   snapshot:strategy:{daoId}            → cached strategy JSON
 *
 * @see https://docs.snapshot.org/
 */

import { badRequest, created, ok, serverError } from '../response-helpers';
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────

export type SnapshotSpaceConfig = {}
