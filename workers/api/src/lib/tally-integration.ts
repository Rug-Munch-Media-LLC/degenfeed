/**
 * @degenfeed/api-worker — Tally.xyz Compatibility Layer
 *
 * Tally is the leading governance UI for on-chain DAOs. This module
 * ensures DegenFeed Governor contracts are fully compatible with
 * Tally's expectations:
 *
 *   1. OpenZeppelin Governor interface compliance check
 *   2. Auto-registration helper for Tally
 *   3. Standard event emission verification
 *   4. Delegation system compatibility
 *
 * KEY REQUIREMENT: DegenFeedGovernor MUST implement the OpenZeppelin
 * Governor interface faithfully so Tally can read proposals and votes
 * without modification.
 *
 * @see https://docs.tally.xyz/
 * @see https://docs.openzeppelin.com/contracts/4.x/governance
 */

import { badRequest, notFound, ok, serverError } from '../response-helpers';
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────

export type GovernorContractConfig = {}
