/**
 * @degenfeed/api-worker — Source Health, Trending & Stale Detection
 *
 * Extends the source-discovery system with ongoing health monitoring,
 * trending detection, and stale source flagging for the auto-discovery v2.
 *
 * KV keys:
 *   discovered:sources:health:{sourceId}     — SourceHealth JSON
 *   discovered:sources:health:index          — JSON array of sourceIds with tracking
 *   discovered:sources:trending:cached       — TrendingSource[] cache (1h TTL)
 *   discovered:sources:new-week-cache        — DiscoveredSource[] for new this week
 *   discovered:sources:culled                — JSON array of culled source IDs
 *   discovered:sources:last-health-check     — ISO timestamp
 */

import {
