/**
 * @degenfeed/api-worker — Transaction Monitor
 *
 * Tracks pending on-chain transactions and escalates when they
 * get stuck. Supports EVM and Solana chains.
 *
 * Lifecycle:
 *   PENDING → CONFIRMED (success)
 *          → FAILED (reverted / error)
 *          → STUCK (no confirmation after timeout) → ESCALATE
 *
 * Architecture:
 *   - Each tracked transaction is stored in KV with TTL
 *   - A polling mechanism (via cron) checks pending txs
 *   - EVM: poll via eth_getTransactionReceipt
 *   - Solana: poll via getSignatureStatuses
 *   - Stuck transactions trigger alerts and user notifications
 *   - Nonce-gapped transactions are auto-cancelled with a 0-value replacement
 *
 * Integration:
 *   - Used by coin launch, tip, and DeFi interaction flows
 *   - Feeds into the error-recovery system
 *   - Exposes status endpoint for the health dashboard
 */

import { logError } from '../error-logger';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ChainType = 'evm' | 'solana';
export type TxStatus = 'pending' | 'confirmed' | 'failed' | 'stuck' | 'replaced';

export type TransactionRecord = {}
