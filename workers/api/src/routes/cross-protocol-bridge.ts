/**
 * @degenfeed/api-worker — Cross-Protocol Bridge Routes
 *
 * Bridges content between any two protocols, including wrapping
 * content from Solana / Nostr / Farcaster into Zora creator coins.
 *
 * Routes:
 *   POST /api/cross-protocol-bridge/wrap  — Bridge content from protocol A → B
 *   POST /api/cross-protocol-bridge/zora  — Wrap source content into Zora creator coin
 *   POST /api/cross-protocol-bridge/sync  — Sync edit from one protocol to all siblings
 *   GET  /api/cross-protocol-bridge/status — Get bridge health and status for a post
 */

import type { Protocol } from '@degenfeed/types';
import type { PublishInput } from '../lib/publish-orchestrator';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { ALLOWED_PROTOCOLS, hasSuspiciousPayload, sanitizeString } from '../sanitize';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

type WrapRequest = {}
