/**
 * @degenfeed/api-worker — Cross-Protocol Creator Coin Announcements
 *
 * Announce coin launches across Farcaster, Nostr, Bluesky, Lens, Threads, Mastodon.
 */

import { hexToBytes } from '@noble/hashes/utils';
import type { Env } from '../../types';

// ─── Dispatch ──────────────────────────────────────────────────────────────

/**
 * Announce a coin launch on the creator's native protocol.
 */
export async function announceCoinLaunch(opts: {
