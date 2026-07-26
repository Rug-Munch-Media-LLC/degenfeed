/**
 * @degenfeed/api-worker — Cross-Protocol Holder Identity System
 *
 * ONE identity across ALL protocols. A holder on Nostr, Farcaster, Bluesky,
 * Lens, Mastodon — all resolve to the same wallet, same identity.
 *
 * Features:
 *   - Multi-protocol holder merge: same wallet across protocols
 *   - Cross-protocol leaderboard: top holders across all platforms
 *   - Holder badges: shows which protocols a holder is active on
 *   - Protocol verification: verify a holder's identity on any protocol
 */

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────

export type ProtocolIdentity = {};
