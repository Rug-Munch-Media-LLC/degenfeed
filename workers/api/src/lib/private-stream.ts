/**
 * @degenfeed/api-worker — Private / Token-Gated Stream Service
 *
 * Enables token-gated private live streams:
 *   1. Stream is encrypted at the source with a derived key
 *   2. Only holders of a specific token (ERC-20, ERC-721, ERC-1155, SPL) can decrypt
 *   3. Token verification on stream join via wallet signature
 *   4. Creator-only streams — no bandwidth cost if using P2P routing
 *
 * Flow:
 *   Creator starts stream → sets token gate → generates encryption key
 *   Viewer joins → must sign message proving token ownership → receives decryption key
 *   Video is encrypted at source, decrypted in browser via Web Crypto API
 *
 * Supported token standards:
 *   - ERC-20 (Ethereum/Base/Optimism/Polygon)
 *   - ERC-721 (NFT gating)
 *   - ERC-1155 (Multi-token gating)
 *   - SPL Token (Solana)
 *   - Creator coin (DegenFeed native)
 *   - Wallet balance (any address with balance > 0)
 */

import { log } from '../logger';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────

export type TokenStandard =
  | 'erc20'
  | 'erc721'
  | 'erc1155'
  | 'spl'
  | 'creator_coin'
  | 'wallet_balance';

export type TokenGateConfig = {}
