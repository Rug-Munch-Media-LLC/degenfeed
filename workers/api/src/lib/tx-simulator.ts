/**
 * @degenfeed/api-worker — Transaction Simulation & MEV Protection
 *
 * Simulates on-chain transactions before submission to detect:
 *   1. Transaction failure (gas estimation, revert reasons)
 *   2. MEV attacks (sandwich, frontrun)
 *   3. Slippage tolerance exceeded
 *   4. Unexpected state changes
 *
 * Supports EVM chains (via eth_call / trace_call) and Solana (via simulateTransaction).
 */

import type { Env } from '../types';

/* ─── Types ─────────────────────────────────────────────────────────── */

export type ChainType = 'ethereum' | 'solana' | 'polygon' | 'base';

export type SimulatedTransaction = {};
