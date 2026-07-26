/**
 * @degenfeed/api-worker — Cross-Platform Profile Sync
 *
 * One profile, everywhere. Update avatar/bio on DegenFeed → syncs to ALL
 * connected protocols automatically. Unified profile management with
 * per-protocol visibility settings.
 *
 * Routes:
 *   POST /api/accounts/profile/sync     — Sync profile to all protocols
 *   POST /api/accounts/profile/sync/:protocol — Sync to specific protocol
 *   GET  /api/accounts/profile/status   — Get profile sync status per protocol
 *   PUT  /api/accounts/profile/update   — Update profile + sync everywhere
 *   PUT  /api/accounts/profile/visibility — Set per-protocol visibility
 *
 * Profile fields synced:
 *   - displayName
 *   - bio/description
 *   - avatar (image URL)
 *   - banner/header (image URL)
 *   - website/links
 *   - location
 *
 * Protocols supporting profile sync:
 *   Bluesky, Mastodon/GTS, Farcaster, Lens, PeerTube, Pixelfed,
 *   WriteFreely, BookWyrm, Funkwhale, Mobilizon, Owncast, Castopod
 */

import { log } from '../logger';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

type ProfileData = {}
