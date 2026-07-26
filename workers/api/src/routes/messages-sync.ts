/**
 * /api/messages/sync — Cross-Device Message Sync
 *
 * POST /api/messages/sync — Fetch missed messages since last sync
 * POST /api/messages/sync/read — Update last read position
 * GET /api/messages/sync/status — Get sync status for current user
 */

import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── KV Prefixes ──────────────────────────────────────────────────────────

const SYNC_STATE_PREFIX = 'chat:sync:';
const LAST_READ_PREFIX = 'chat:lastread:';
const DEVICE_REGISTRY_PREFIX = 'chat:devices:';
const MESSAGE_INDEX_PREFIX = 'chat:msg:index:';

// ─── Types ────────────────────────────────────────────────────────────────

type SyncRequest = {}
