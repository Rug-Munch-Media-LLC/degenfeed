/**
 * @degenfeed/api-worker — Native Protocol Tipping
 *
 * Native tipping on every protocol. Each tip records in our unified tip ledger
 * AND sends on the native protocol via its native mechanism.
 *
 * Supported protocols:
 *   1. Nostr     — NIP-57 Lightning zaps
 *   2. Farcaster — USDC tips via frames / direct transfer
 *   3. Bluesky   — AT Protocol custom extension
 *   4. Mastodon  — ActivityPub custom tip activity
 *   5. Lens      — Lens collect/open action
 *   6. PeerTube  — PeerTube tip plugin
 *   7. Owncast   — Owncast external action
 *   8. Reddit    — Community points / direct link
 *   9. GitHub    — GitHub Sponsors API
 *  10. Telegram  — Telegram Stars / bot payments
 */

import { recordUnifiedTip, type TipEntityType } from '../routes/unified-tip-core';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────

export type NativeTipProtocol =
  | 'nostr'
  | 'farcaster'
  | 'bluesky'
  | 'mastodon'
  | 'lens'
  | 'peertube'
  | 'owncast'
  | 'reddit'
  | 'github'
  | 'telegram';

export type NativeTipRequest = {};
