/**
 * @degenfeed/api-worker — Full Data Export
 *
 * Export ALL user data in multiple formats:
 *   GET /api/account/export/manifest       — export manifest (what data is available)
 *   GET /api/account/export/json           — full JSON export
 *   GET /api/account/export/csv            — CSV export (flat tables)
 *   GET /api/account/export/html           — browsable HTML archive
 *   GET /api/account/export/activitypub    — ActivityPub compatible export
 *   GET /api/account/export/mastodon       — Mastodon-compatible CSV
 *   GET /api/account/export/nostr          — Nostr events export
 *   GET /api/account/export/atproto        — AT Protocol CAR-style export
 *
 * Every endpoint requires a valid session cookie.
 * All exports are generated on-the-fly from KV data.
 */

import type { Env } from '../types';
import {
