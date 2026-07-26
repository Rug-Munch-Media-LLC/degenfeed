/**
 * @degenfeed/api-worker — Protocol-specific feed sections.
 *
 * GET /api/feed/protocol-sections?protocol=<farcaster|lens|bluesky|nostr|mastodon>
 *
 * Returns two curated sections per protocol for the protocol pages:
 *   Farcaster: Trending Channels + Popular Frames
 *   Lens:      Top Collectors + Hot Mirrors
 *   Bluesky:   Popular Custom Feeds + Trending Labels
 *   Nostr:     Active Relays + Most Zapped
 *   Mastodon:  Trending Hashtags + Popular Instances
 *
 * Aggregates from the (already cached) home feed via loopback fetch,
 * plus protocol-native public APIs where available. Cached 5 min in KV.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export type SectionItem = {};
