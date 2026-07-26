/**
 * @degenfeed/api-worker — Cross-Protocol Community API
 *
 * Create, read, and join communities that span Lemmy, Nostr, Farcaster,
 * Mastodon, and Bluesky. Community records live in KV under `community:{id}`.
 *
 * Endpoints:
 *   POST /api/community          — Create a community
 *   GET  /api/community/:name    — Get community details
 *   GET  /api/community/:name/feed — Get cross-protocol feed for a community
 *   POST /api/community/:name/join — Join a community
 *   GET  /api/communities        — List all communities
 */

import type { CrossProtocolCommunity } from '@degenfeed/utils';
import {
