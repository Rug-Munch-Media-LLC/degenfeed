/**
 * @degenfeed/api-worker — Cross-Protocol Coin Announcer
 *
 * When a creator coin launches, announce it on EVERY protocol the creator
 * and/or platform has ownership in: Farcaster, Nostr, Bluesky, Lens,
 * Mastodon/GTS, Telegram, Discord, and ActivityPub.
 *
 * Each announcement is protocol-appropriate:
 *   - Farcaster: cast with embedded buy frame
 *   - Nostr: kind 1 note with NIP-57 zap target
 *   - Bluesky: post with link embed
 *   - Lens: publication with collect module
 *   - Mastodon/GTS: toot with buy link
 *   - Telegram: bot message in creator's group
 *   - Discord: webhook announcement
 *
 * Every announcer has independent error handling — one failure never
 * blocks the others. Each returns its own result entry.
 */

import { sanitizeString } from '../sanitize';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────

export type AnnouncementTarget = {}
