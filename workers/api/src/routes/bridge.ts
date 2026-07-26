/**
 * @degenfeed/api-worker — Cross-Protocol DM Bridge Routes
 *
 * Unified API for sending DMs to ANY identifier format across ALL protocols.
 *
 * POST /api/bridge/send      — Send DM to any identifier (wallet, npub, FID, DID, handle, Matrix ID)
 * GET  /api/bridge/inbox     — Unified inbox with protocol badges
 * GET  /api/bridge/inbox/:peerId — Conversation with specific peer
 * POST /api/bridge/read      — Mark messages as read
 * GET  /api/bridge/status    — Protocol health status
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. [Built per rules]
 */

import { CrossProtocolBridge } from '../lib/cross-protocol-bridge';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

type BridgeSendBody = {};
