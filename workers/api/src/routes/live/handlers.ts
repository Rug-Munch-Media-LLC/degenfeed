/**
 * @degenfeed/api-worker — Live Route Handlers
 *
 * Live/streaming route handlers. All endpoints are wired to the live
 * aggregator which fetches from Owncast, PeerTube, YouTube, Twitch, Kick,
 * Spaces, Farcaster, and Nostr in parallel.
 *
 * Rules:
 *   - Every provider integration has: error handling, rate limit tracking,
 *     response validation, fallback
 *   - No silent failures. No unhandled API changes.
 *   - All provider responses validated before passing to scanners
 */

import {
