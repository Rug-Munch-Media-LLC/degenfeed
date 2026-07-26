/**
 * @degenfeed/api-worker — Self-Hosted Identity Server
 *
 * Every DegenFeed user gets a self-sovereign, portable identity.
 *
 * Provides:
 *   1. DID generation — `did:key` and `did:web` DIDs for every user
 *   2. DID Document hosting — serve DID Docs at `/.well-known/did.json`
 *   3. Self-sovereign recovery — key ceremony that lets users rotate keys
 *   4. Portable identity — DID Document that points to ALL protocol handles
 *      so users can move between Bluesky/Nostr/Farcaster/Mastodon freely
 *
 * Key principles:
 *   - Users ALWAYS hold their own keys (we never see nsec, never hold signing keys)
 *   - DIDs are generated deterministically from wallet address
 *   - Identity is portable: verify on any server, not just ours
 *   - Recovery is permissionless: no admin, no support ticket
 *
 * KV key scheme:
 *   did:{wallet}                → DidRecord (DID + DID Document)
 *   did:recovery:{wallet}       → RecoveryCeremony[]
 *   did:portable:{wallet}       → PortableIdentityBundle
 *   did:well-known:{wallet}     → Cached DID Document (for .well-known serving)
 */

import type { SessionPayload } from '../session';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────

export type DidMethod = 'key' | 'web';

export type DidRecord = {}
