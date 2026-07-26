/**
 * @degenfeed/api-worker — Identity Discovery Service
 *
 * Given a wallet address or existing identity, discovers ALL linked
 * protocol identities across the decentralized web.
 *
 * Discovery methods:
 *   1. ENS reverse resolution → text records
 *   2. Farcaster verified address matching
 *   3. Lens API profile lookup
 *   4. Nostr relay search (kind 0 profiles)
 *   5. Bluesky PLC DID resolution
 *   6. Cross-reference chaining
 *
 * Results are cached for 1 hour (identity:discovery:{wallet}).
 * Last discovery timestamp stored at: identity:discovery:ts:{wallet}
 */

import type { CrossProtocolIdentity } from '@degenfeed/utils';
import { identityKey } from '@degenfeed/utils';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────

export type DiscoveredIdentity = {};
