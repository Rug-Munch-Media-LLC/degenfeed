/**
 * @degenfeed/api-worker — Bluesky Feed Generator Route
 *
 * Serves the DegenFeed Live feed generator endpoint that Bluesky
 * calls to get the skeleton feed of live streams and audio spaces.
 *
 * Also provides a management route to register/update the feed
 * generator record on the Bluesky PDS.
 *
 * Routes:
 *   GET  /api/bluesky/feed/describe  — Describe the feed generator
 *   GET  /api/bluesky/feed/skeleton  — Get the feed skeleton (called by Bluesky)
 *   POST /api/bluesky/feed/register  — Register/update the feed generator on PDS
 *   GET  /api/bluesky/feed/streams   — List live streams for the feed
 */

import {
