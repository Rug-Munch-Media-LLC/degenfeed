/**
 * @degenfeed/api-worker — Blink Action: Send Gift
 *
 * Solana Actions (Blinks) integration for the gift system.
 * Enables one-click gift sending from any Blink-compatible client
 * (Farcaster frames, X Feed, wallet browsers, etc.)
 *
 * GET  /api/blink/gift — Returns Blink metadata (GET)
 * POST /api/blink/gift — Builds and returns a Solana transaction
 *
 * Also handles:
 *   - NIP-57 zap receipts for Nostr viewers
 *   - Lightning Address payments for LN viewers
 *   - Creator Coin payments via Solana Program
 */

import { jsonResponse } from '../response-helpers';
import { sanitizeString } from '../sanitize';
import type { Env } from '../types';
import {
