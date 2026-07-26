/**
 * @degenfeed/api-worker — On-Chain Coin Data Service
 *
 * Queries live data from deployed DegenFeedCoinV2 contracts on Base,
 * and from TokenState accounts on Solana.
 *
 * Used by the creator dashboard API to replace mock data with real on-chain values.
 */

import { type Address, createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import type { Env } from '../types';

// ─── DegenFeedCoinV2 ABI fragments for read functions ──────────────────────

const COIN_ABI = [
  {
