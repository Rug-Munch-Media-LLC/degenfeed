/**
 * cross-platform-dedup — Cross-protocol post mapping engine.
 *
 * Maps the same post across protocols:
 *   - Nostr note ↔ Farcaster cast (same author, same time, similar text)
 *   - Bluesky post ↔ Mastodon toot (cross-posted)
 *   - RSS article ↔ Reddit post (same URL)
 *   - YouTube video ↔ PeerTube mirror (same content)
 *   - Lens post ↔ any ActivityPub
 *
 * Uses content fingerprinting, cross-poster detection, and identity
 * resolution to connect the same content across protocols.
 *
 * This module integrates with GlobalDedupRegistry for storage,
 * but adds higher-level cross-platform inference logic.
 */

import type { UnifiedPost } from '@degenfeed/types';
import type { GlobalDedupRegistry } from './global-dedup';

// ─── Types ────────────────────────────────────────────────────────────────

export type CrossPlatformLink = {}
