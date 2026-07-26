/**
 * @degenfeed/api-worker — Reputation routes
 *
 * Non-transferable reputation token system with KV storage.
 *
 * KV keys:
 *   rep:score:{userId}        → ReputationScore (JSON)
 *   rep:history:{userId}       → ReputationEvent[] (JSON, newest first)
 *   rep:leaderboard            → LeaderboardEntry[] (sorted by total desc)
 *
 * Endpoints:
 *   GET /api/reputation/:userId        — Get user's reputation score
 *   GET /api/reputation/:userId/history — Reputation change history
 *   GET /api/reputation/leaderboard    — Top users by reputation
 *   POST /api/reputation/earn          — Record an earn event
 *   POST /api/reputation/slash         — Record a slash event
 *   POST /api/reputation/stake         — Stake reputation on a post
 *   POST /api/reputation/stake/resolve — Resolve a stake
 */

import {
