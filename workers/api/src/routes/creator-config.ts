/**
 * /api/creator/config — Creator Coin Configuration & Cross-Chain Registry
 *
 * Creators control EVERY parameter of their coin:
 * - Vesting schedule (initial unlock, cliff, duration)
 * - Fee configuration (platform, creator, referral)
 * - Revenue recipients (splits)
 * - Cross-chain token registration (Base ↔ Solana ↔ Farcaster ↔ Lens)
 *
 * GET  /api/creator/config              — Get creator's full configuration
 * PUT  /api/creator/config/vesting      — Update vesting (before coin launch only)
 * PUT  /api/creator/config/fees         — Update fee configuration
 * POST /api/creator/config/cross-chain  — Register a cross-chain token mapping
 * GET  /api/creator/:id/tokens          — Get all creator tokens across chains
 * POST /api/creator/coin/farcaster      — Deploy a Farcaster creator coin
 * POST /api/creator/coin/lens           — Deploy a Lens creator coin
 */

import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

type VestingConfig = {}
