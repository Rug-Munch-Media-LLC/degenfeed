/**
 * @degenfeed/api-worker — Cross-Platform Stream Announcement System
 *
 * When a creator goes live, announce it to ALL their linked protocols.
 * Each protocol runs independently — one failure never blocks others.
 *
 * Supports: ActivityPub (Mastodon/GoToSocial), AT Protocol (Bluesky),
 * Nostr (Kind 30311 live events via NostrLiveBridge), Farcaster,
 * Lens, Telegram, RSS, Threads (via GoToSocial ActivityPub federation).
 *
 * Threads integration works through our GoToSocial instance:
 * Threads users who follow @degenfeed@social.degenfeed.xyz see our
 * stream announcements in their Threads feed with plain-text URLs.
 *
 * Uses the existing @degenfeed/* SDKs for real API calls.
 */

import { IdentityHub } from '@degenfeed/auth';
import type { Protocol } from '@degenfeed/types';
import type { Env } from '../types';
import { recordBridgeOperation, withReliability } from './bridge-reliability';

// ─── Reliability Helper ────────────────────────────────────────────────────

/**
 * Execute a stream announcement with reliability (retry + circuit breaker).
 */
async function reliableAnnounce<T>(
  protocol: string,
  operation: () => Promise<T>,
  env: Env,
): Promise<T> {
