/**
 * @degenfeed/api-worker — Multi-Platform Simulcast Engine
 *
 * Enterprise-grade simulcast streaming. Creator streams to Loops (Owncast)
 * RTMP ingest; this engine restreams to YouTube Live, TikTok Live, Twitch,
 * Kick, and announces on all protocols (Farcaster, Nostr, Bluesky, Mastodon,
 * PeerTube, Owncast ActivityPub).
 *
 * Tier gate: Enterprise ($20/mo) — feature MULTI_PLATFORM_SIMULCAST
 *
 * Architecture:
 *   Creator OBS/Streamlabs → RTMP → Loops (Owncast)
 *                                   → Simulcast Engine
 *                                     → Postiz (YouTube, TikTok, Twitch, Kick)
 *                                     → Native (Farcaster, Nostr, Bluesky,
 *                                        Mastodon, PeerTube, Owncast AP)
 *
 * @see /srv/work/repos/degenfeed-web/workers/api/src/lib/postiz-bridge.ts
 * @see /srv/work/repos/degenfeed-web/workers/api/src/feed/live-aggregator.ts
 */

import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';

// ─── Constants ───────────────────────────────────────────────────────────────

export const SIMULCAST_PLATFORMS = [
  'youtube',
  'tiktok',
  'twitch',
  'kick',
] as const;

export const SIMULCAST_PROTOCOLS = [
  'farcaster',
  'nostr',
  'bluesky',
  'mastodon',
  'peertube',
  'owncast',
] as const;

export type SimulcastPlatform = (typeof SIMULCAST_PLATFORMS)[number];
export type SimulcastProtocol = (typeof SIMULCAST_PROTOCOLS)[number];

export const SIMULCAST_ALL = [
  ...SIMULCAST_PLATFORMS,
  ...SIMULCAST_PROTOCOLS,
] as const;

export type SimulcastTarget = SimulcastPlatform | SimulcastProtocol;

/** Max concurrent simulcast streams per creator */
export const MAX_SIMULCASTS_PER_CREATOR = 3;

/** KV key helpers */
function simulcastKey(id: string): string {
