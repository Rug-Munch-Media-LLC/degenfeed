/**
 * @degenfeed/api-worker — Creator Coin Deployer Service
 *
 * Real contract deployment service for creator coins.
 * Supports Base (EVM via viem) and Solana (via @solana/web3.js + Anchor IDL).
 *
 * Delegates to the @degenfeed/creator-coin SDK for chain-specific logic.
 * Adds production safety: gas estimation, transaction simulation,
 * feature-flag gating, and KV deployment tracking.
 *
 * NOTE: Solana deployer requires optional deps:
 *   @solana/web3.js, @solana/spl-token, @coral-xyz/anchor, @degenfeed/creator-coin
 * These are dynamically imported and only needed when deploying to Solana.
 *
 * Feature flag: ENABLE_REAL_DEPLOYMENTS=false → returns "coming soon" message
 * Feature flag: ENABLE_REAL_DEPLOYMENTS=true  → deploys real contracts
 */

import {
