/**
 * @degenfeed/api-worker — Tier-Gated Protocol Registration Routes
 *
 * Individual protocol registration routes gated by membership tier.
 * Each route checks the user's tier before allowing registration.
 *
 * Routes:
 *   POST /api/gts/register            — Free (ActivityPub)
 *   POST /api/nostr/register          — Pro+
 *   POST /api/bluesky/register        — Creator+
 *   POST /api/lemmy/register          — Creator+
 *   POST /api/farcaster/register      — Enterprise
 *   POST /api/lens/register           — Enterprise
 *   POST /api/zora/mint               — Enterprise
 *
 * Each handler:
 *   1. Validates the session
 *   2. Checks tier access + returns upgrade CTA if locked
 *   3. Delegates to @degenfeed/crossplatform-register for actual creation
 *   4. Auto-links identity in IDENTITIES KV
 */

import {
