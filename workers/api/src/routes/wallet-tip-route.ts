/**
 * @degenfeed/api-worker — Wallet-Based Tip Routing
 *
 * TASK 2: Wallet-Based Tip Routing
 * Routes tips intelligently based on what we know about the recipient:
 *   1. Known recipient wallet → tip directly on-chain (cheapest route)
 *   2. Unknown wallet but known protocol identity → resolve identity → find wallet → tip
 *   3. Only protocol identity known → use protocol-native tipping
 *   4. Neither known → generate tip link/QR code
 *
 * @see ../lib/intelligent-tips.ts — Context-aware tip routing
 * @see ../lib/identity-discovery.ts — Cross-protocol identity resolution
 */

import { identityKey } from '@degenfeed/utils';
import { getProtocolCapability } from '../lib/intelligent-tips';
import { jsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, isValidAmount, sanitizeString, validateBodySize } from '../sanitize';
import type { Env } from '../types';
import type { SupportedChain } from './unified-tip-core';
import { recordUnifiedTip, type TipEntityType } from './unified-tip-core';

// ─── Types ───────────────────────────────────────────────────────────────

export type WalletKnowledge =
  /** We have a known wallet address for the recipient */
  | 'known_wallet'
  /** We know the protocol identity but not the wallet */
  | 'known_protocol_identity'
  /** We only know who they are on a protocol (no wallet linked) */
  | 'protocol_identity_only'
  /** We don't know anything about this recipient */
  | 'unknown';

export type WalletRouteRequest = {};
