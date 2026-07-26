/**
 * @degenfeed/api-worker — Protocol Account Creation Routes
 *
 * Creates accounts on each self-hosted protocol instance and links them
 * to the user's wallet.
 *
 * Routes:
 *   POST /api/protocol/mastodon/register    — GoToSocial account
 *   POST /api/protocol/peertube/register    — PeerTube account
 *   POST /api/protocol/lemmy/register       — Lemmy account
 *   POST /api/protocol/pixelfed/register    — Pixelfed account
 *   POST /api/protocol/writefreely/register — WriteFreely account
 *   POST /api/protocol/bookwyrm/register    — BookWyrm account
 *   POST /api/protocol/mobilizon/register   — Mobilizon account
 *   POST /api/protocol/funkwhale/register   — Funkwhale account
 *   GET  /api/protocol/status               — Get all protocol accounts
 *   POST /api/protocol/join-all             — Create all accounts at once
 *
 * Each route:
 *   1. Validates the session
 *   2. Validates the desired username
 *   3. Creates the account via the self-hosted instance API
 *   4. Stores encrypted credentials in PLATFORM_ACCOUNTS KV
 *   5. Auto-links the identity in IDENTITIES KV
 *   6. Returns the new account info
 */

import {
