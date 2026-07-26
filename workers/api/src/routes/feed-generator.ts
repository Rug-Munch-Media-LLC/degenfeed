/**
 * @degenfeed/api-worker — Bluesky Feed Generator Endpoint
 *
 * Implements the AT Protocol feed generator endpoints needed for
 * the "DegenFeed Live" custom feed (did:web:live.degenfeed.xyz).
 *
 * Routes:
 *   GET  /.well-known/did.json                        — Feed generator DID document
 *   GET  /api/bsky-feed/xrpc/app.bsky.feed.describeFeedGenerator  — Feed metadata
 *   GET  /api/bsky-feed/xrpc/app.bsky.feed.getFeedSkeleton       — Live feed data
 *
 * AT Protocol Spec:
 *   https://atproto.com/guides/feed-generators
 *
 * The feed generator must be registered with Bluesky via:
 *   https://bsky.app/feed
 *   or programmatically via com.atproto.repo.putRecord
 */

import {
