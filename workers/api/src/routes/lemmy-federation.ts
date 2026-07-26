/**
 * @degenfeed/api-worker — Lemmy Federation Management
 *
 * Admin tools for managing federation: connected instances, allowlist,
 * blocklist, and federation health monitoring.
 *
 * These endpoints require admin session (wallet in ADMIN_WALLETS list).
 *
 * Endpoints:
 *   GET  /api/lemmy/federation/status         — Overall federation health
 *   GET  /api/lemmy/federation/instances      — Connected instances list
 *   GET  /api/lemmy/federation/allowlist      — Get federation allowlist
 *   POST /api/lemmy/federation/allowlist/add  — Add instance to allowlist
 *   POST /api/lemmy/federation/allowlist/remove — Remove from allowlist
 *   GET  /api/lemmy/federation/blocklist      — Get blocked instances
 *   POST /api/lemmy/federation/blocklist/add  — Block an instance
 *   POST /api/lemmy/federation/blocklist/remove — Unblock an instance
 *   GET  /api/lemmy/federation/stats          — Federation stats (incoming/outgoing)
 *   GET  /api/lemmy/federation/health         — Detailed health per instance
 */

import { requireAdminFromSession } from '../lib/admin-guard';
import { log } from '../logger';
import { jsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Constants ─────────────────────────────────────────────────────────

const LEMMY_INSTANCE_URL = 'https://community.degenfeed.xyz';
const LEMMY_API = `${LEMMY_INSTANCE_URL}/api/v3`;
const USER_AGENT = 'DegenFeed/0.1';

// Known healthy federated instances
const FEDERATED_INSTANCES = [
  { hostname: 'lemmy.ml', software: 'lemmy', version: '0.19+', status: 'connected' as const },
  { hostname: 'lemmy.world', software: 'lemmy', version: '0.19+', status: 'connected' as const },
  { hostname: 'beehaw.org', software: 'lemmy', version: '0.19+', status: 'connected' as const },
  {
