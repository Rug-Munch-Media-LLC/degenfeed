/**
 * @degenfeed/api-worker — Cross-Platform Data Migration
 *
 * Import from Twitter/X, Mastodon, Nostr, Bluesky, Farcaster.
 * Export to Mastodon, Nostr, Bluesky.
 *
 * Routes:
 *   POST /api/account/migrate/import/twitter    — Import from Twitter/X archive
 *   POST /api/account/migrate/import/mastodon   — Import from Mastodon CSV/JSON
 *   POST /api/account/migrate/import/nostr      — Import Nostr events
 *   POST /api/account/migrate/import/bluesky    — Import Bluesky AT Protocol data
 *   POST /api/account/migrate/import/farcaster  — Import Farcaster casts
 *   POST /api/account/migrate/export/mastodon   — Export to Mastodon
 *   POST /api/account/migrate/export/nostr      — Publish to Nostr relays
 *   POST /api/account/migrate/export/bluesky    — Push to Bluesky PDS
 *   GET  /api/account/migrate/status            — Check migration status
 *   GET  /api/account/migrate/jobs              — List recent migrations
 *
 * All endpoints require a valid session cookie.
 * Imports store data into the user's content library.
 * Exports publish to the target protocol.
 */

import { log } from '../../index';
import { badRequest, conflict, ok, serverError } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';

// ─── Types ────────────────────────────────────────────────────

export type MigrationDirection = 'import' | 'export';
export type MigrationPlatform = 'twitter' | 'mastodon' | 'nostr' | 'bluesky' | 'farcaster';

export interface MigrationJob {
  id: string;
  wallet: string;
  direction: MigrationDirection;
  platform: MigrationPlatform;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0–100
  totalItems: number;
  processedItems: number;
  errors: string[];
  startedAt: number;
  completedAt?: number;
  error?: string;
}
