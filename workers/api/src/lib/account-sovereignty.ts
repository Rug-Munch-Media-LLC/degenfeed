/**
 * @degenfeed/api-worker — Account Sovereignty & Ownership Verification
 *
 * Every DegenFeed user gets:
 *   - Their own ActivityPub handle on OUR GoToSocial instance
 *   - Their own AT Protocol DID on OUR PDS
 *   - Their own Nostr keypair (THEY hold the nsec)
 *   - Their own PeerTube channel on OUR instance
 *   - Optional: Matrix account, Ghost blog, Owncast stream, WriteFreely blog
 *
 * We run the infrastructure. Users hold their keys.
 * If we ever go down, they take their keys and move to another server.
 * No lock-in. No de-platforming.
 *
 * Key principles:
 *   1. Users always control their private keys (nsec, signing keys)
 *   2. All data is exportable — no proprietary formats
 *   3. Every account has a documented migration path
 *   4. Users can leave anytime with their data and identity
 */

import type { SessionPayload } from '../session';
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────

export type ProtocolAccount = {}
