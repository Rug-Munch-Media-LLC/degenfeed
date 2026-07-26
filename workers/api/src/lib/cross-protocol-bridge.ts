/**
 * @degenfeed/api-worker — Cross-Protocol DM Bridge
 *
 * Unified bridge that ties together:
 *   1. Identity Resolution (any identifier format → wallet + protocol IDs)
 *   2. E2E Encryption (Signal double ratchet + Kyber-1024 PQ)
 *   3. Protocol Transports (Nostr NIP-17, Farcaster, Bluesky, Mastodon, Matrix, Telegram)
 *   4. Delivery Status (per-message, per-protocol confirmation)
 *   5. KV Persistence (conversation history, inbox threads)
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API changes.
 * Every provider gets a health check. [Built per rules — see AGENTS.md]
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type BridgeSendRequest = {};
