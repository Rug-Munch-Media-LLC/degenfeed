/**
 * @degenfeed/api-worker — Cross-Platform Gift Receivers
 *
 * Receives gifts from external platforms and records them in the
 * DegenFeed gift system. Gifts work regardless of which platform
 * the viewer is watching from:
 *
 *   - Farcaster viewer → Farcaster frame action → gift recorded
 *   - Nostr viewer     → NIP-57 zap → gift animation → creator earns
 *   - Bluesky viewer   → Bluesky tip → gift → creator earns
 *   - Lens viewer      → Lens tip → gift
 *
 * All unified in the same gift state and creator earnings dashboard.
 */

import { jsonResponse } from '../response-helpers';
import { sanitizeString } from '../sanitize';
import type { Env } from '../types';
import { type GiftTypeId, isValidGiftTypeId } from './live-gifts-core';
import { recordGift } from './live-gifts-handlers';

// ─── NIP-57 Zap Receipt Handler (Nostr) ─────────────────────────────────

/**
 * POST /api/live/gifts/nostr-zap
 *
 * Called when a Nostr zap (NIP-57) receipt is received for a stream.
 * Parses the zap amount, maps it to the closest gift type, and records it.
 *
 * The zap sender sees the gift animation and chat notification
 * just like a native DegenFeed gift sender.
 */
export async function handleNostrZapGift(request: Request, env: Env): Promise<Response> {
