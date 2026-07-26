/**
 * @degenfeed/api-worker — Data Portability Hub
 *
 * Export ALL user data from ALL protocols in one click.
 * Users can download their full data from every connected network.
 *
 * Routes:
 *   POST /api/accounts/export-all        — One-click: export everything
 *   GET  /api/accounts/export-all/status  — Check export job status
 *   GET  /api/accounts/export-all/manifest — What data is available for export
 *   GET  /api/accounts/export-all/download — Download completed export
 *
 * Export formats:
 *   - Bluesky: CAR-format repo export
 *   - Mastodon: ActivityPub JSON
 *   - Farcaster: Casts + follows (JSON)
 *   - Lens: Publications + profile (JSON)
 *   - PeerTube: Videos metadata
 *   - Pixelfed: Posts JSON
 *   - Nostr: Events NDJSON
 *   - All others: JSON metadata
 *
 * Combined: ZIP archive with per-protocol directories
 */

import { log } from '../logger';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

type ExportManifest = {};
