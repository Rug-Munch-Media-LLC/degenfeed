/**
 * @degenfeed/api-worker — Zora Cross-Protocol Content Wrapper
 *
 * Wraps content from any source protocol (Solana, Nostr, Farcaster, etc.)
 * into Zora creator coins / NFT mints using raw JSON-RPC calls.
 *
 * Uses the @degenfeed/zora-sdk for bonding curve math and cross-chain
 * registry, but makes RPC calls via raw fetch for Worker compatibility
 * (no viem bundle size overhead).
 *
 * Flow:
 *   1. Content arrives from any protocol → content hash + metadata
 *   2. A new creator coin is spawned (or an existing one is used)
 *   3. The content is minted as an NFT / coin purchase
 *   4. The resulting on-chain reference is returned for cross-protocol linking
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export type ZoraContentInput = {}
