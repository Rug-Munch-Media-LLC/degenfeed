/**
 * @degenfeed/api-worker — Integration Health Checks
 *
 * Comprehensive health check for EVERY external integration.
 * Returns structured status with latency and error info.
 *
 * Used by the `/api/health/full` endpoint to provide a complete
 * picture of all system dependencies.
 *
 * Integrations checked:
 *   - ActivityPub (GoToSocial API)
 *   - AT Protocol (Bluesky PDS + Relay)
 *   - Nostr (multiple relays)
 *   - Farcaster (Hub)
 *   - Lens Protocol (GraphQL API)
 *   - Telegram (Bot API)
 *   - Zora (API)
 *   - Wormhole (RPC)
 *   - PeerTube (Instance)
 *   - RPC endpoints (EVM chains)
 *   - Solana RPC
 */

import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────

export type IntegrationStatus = 'ok' | 'degraded' | 'down';

export type IntegrationHealth = {};
