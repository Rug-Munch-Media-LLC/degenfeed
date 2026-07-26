/**
 * @degenfeed/api-worker — Cross-Chain Tip Routing
 *
 * Real cross-chain tip routing with:
 *   - DEX aggregator quotes (0x, Jupiter, 1inch)
 *   - Bridge quotes (Wormhole, Across)
 *   - Smart chain selection
 *   - Unified ledger recording
 *
 * Flow: Tip in ETH on Ethereum → auto-swap to SOL on Solana via DEX aggregator + bridge
 */

import { jsonResponse } from '../response-helpers';
import { validateBodySize } from '../sanitize';
import type { Env } from '../types';
import {
