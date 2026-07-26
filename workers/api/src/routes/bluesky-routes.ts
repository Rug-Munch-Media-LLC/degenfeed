/**
 * @degenfeed/api-worker — Bluesky / AT Protocol Routes
 *
 * Full AT Protocol integration suite:
 * 1. PDS Registration — sign up for Bluesky via our PDS, access ALL AT Protocol apps
 * 2. AT Protocol App Directory — discover all AT Protocol apps, one-click login
 * 3. AT Protocol Content Discovery — cross-app content from the firehose
 * 4. PDS Account Portability — export, import, migrate, recovery keys, app passwords
 * 5. AT Protocol Feed Integration — DegenFeed custom feeds on AT Protocol
 *
 * Routes:
 *   POST  /api/bluesky/register              — PDS Registration + AT Protocol ecosystem
 *   POST  /api/bluesky/login                  — Login to existing account
 *   GET   /api/bluesky/apps                   — AT Protocol App Directory
 *   GET   /api/atproto/discover               — Cross-app content discovery
 *   GET   /api/atproto/discover/:app          — Content from specific AT Protocol app
 *   POST  /api/atproto/discover/firehose      — Subscribe to firehose events
 *   GET   /api/atproto/feed/degenfeed         — DegenFeed crypto feed
 *   GET   /api/atproto/feed/degenfeed/trending  — DegenFeed trending
 *   GET   /api/atproto/feed/degenfeed/cross     — Cross-protocol feed
 *   GET   /api/accounts/bluesky/export        — Export CAR file + DID
 *   POST  /api/accounts/bluesky/import        — Import from another PDS
 *   GET   /api/accounts/bluesky/recovery-key  — Get recovery key info
 *   POST  /api/accounts/bluesky/recovery-key  — Generate new recovery key
 *   POST  /api/accounts/bluesky/recover       — Recover account with recovery key
 *   GET   /api/accounts/bluesky/app-passwords — List app passwords
 *   POST  /api/accounts/bluesky/app-passwords — Create app password
 *   DELETE /api/accounts/bluesky/app-passwords/:id — Revoke app password
 *   GET   /api/accounts/bluesky/migration/status — Migration status
 *   POST  /api/accounts/bluesky/migration/start  — Start PDS migration
 */

import type { AtProtocolAppCategory } from '@degenfeed/bluesky-sdk/atproto-directory';
import { buildAppDirectoryResponse, getAppByKey } from '@degenfeed/bluesky-sdk/atproto-directory';
import type { DegenFeedType } from '@degenfeed/bluesky-sdk/atproto-feeds';
import { generateDegenFeed } from '@degenfeed/bluesky-sdk/atproto-feeds';
import {
