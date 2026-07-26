/**
 * @degenfeed/api-worker — Zora Video NFT Integration
 *
 * Mints short videos as Zora ERC-1155 editions with video metadata.
 * Each short becomes a tradeable, tippable NFT visible on zora.co.
 *
 * Key capabilities:
 *   - Mint video as 1/1 or open edition
 *   - Tip creator by buying an edition
 *   - Cross-protocol announcement (post about the NFT everywhere)
 *
 * Uses raw JSON-RPC calls (no viem bundle) for Worker compatibility.
 * Delegates on-chain transactions to a relayer service by default.
 *
 * @see zora-wrapper.ts for the lower-level content wrapping
 */

import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export type MintVideoNFTOptions = {}
