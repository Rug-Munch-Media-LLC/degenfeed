/**
 * @degenfeed/api-worker — Self-Hosted Infrastructure Health Dashboard
 *
 * Monitors the health of every self-hosted protocol service:
 *   social.degenfeed.xyz   → GoToSocial (ActivityPub)
 *   pds.degenfeed.xyz      → AT Protocol PDS (Bluesky)
 *   relay.degenfeed.xyz    → Nostr Relay
 *   video.degenfeed.xyz    → PeerTube (ActivityPub video)
 *   matrix.degenfeed.xyz   → Synapse (Matrix)
 *   articles.degenfeed.xyz → Ghost CMS (Blog)
 *   live.degenfeed.xyz     → Owncast (Live streaming)
 *   blog.degenfeed.xyz     → WriteFreely (ActivityPub blog)
 *   events.degenfeed.xyz   → Mobilizon (ActivityPub events)
 *
 * Routes:
 *   GET /api/infra/health       — Health status of ALL self-hosted services
 *   GET /api/infra/health/:service — Individual service health
 *   GET /api/infra/status       — Overall infrastructure status
 *
 * This is separate from /api/health (external protocol status) because
 * self-hosted infrastructure requires different monitoring — disk usage,
 * database connections, certificate expiry, etc.
 */

import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────

export type ServiceHealth = {}
