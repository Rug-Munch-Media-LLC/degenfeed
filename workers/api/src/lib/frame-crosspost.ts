/**
 * @degenfeed/api-worker — Frame Cross-Posting Engine
 *
 * Share Farcaster Frames to Nostr, Bluesky, and Mastodon.
 * Each frame cast includes the Frame URL as an embed so it renders inline.
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API changes.
 */

import type { Env } from '../types';
import { publishCastToFarcaster } from './hubble-publisher';

// ─── Types ─────────────────────────────────────────────────────────────────

export type CrossPostProtocol = 'farcaster' | 'nostr' | 'bluesky' | 'mastodon';

export type CrossPostResult = {}
