/**
 * @degenfeed/api-worker — Publish Orchestrator
 *
 * Routes content to one or more protocols by calling the actual SDKs
 * with real API calls — no stubs, no placeholders.
 *
 * Each protocol handler:
 *   1. Accepts text + optional media + auth tokens
 *   2. Formats content using the format-translator
 *   3. Calls the protocol SDK
 *   4. Returns publish result with nativeId
 *
 * Supports: ActivityPub (Mastodon/GtS), AT Protocol (Bluesky),
 * Nostr, Farcaster, Lens, Telegram, RSS
 */

import type { BlobRef } from '@degenfeed/bluesky-sdk';
import type { Protocol } from '@degenfeed/types';
import type { Env } from '../types';
import { recordBridgeOperation, withReliability } from './bridge-reliability';
import type { MediaAttachment } from './format-translator';
import { formatForActivityPub, formatForTelegram } from './format-translator';
import { createEvent } from './realtime-sync';

// ─── Reliability Helper ────────────────────────────────────────────────────

/**
 * Execute a protocol publish operation with reliability (retry + circuit breaker).
 * Records outcome for stats and alerting.
 */
async function reliablePublish<T>(
  protocol: string,
  operation: () => Promise<T>,
  env: Env,
): Promise<T> {
