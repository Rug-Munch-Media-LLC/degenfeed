/**
 * @degenfeed/api-worker — Cross-Protocol Identity Attestation
 *
 * Cryptographic proofs of identity across protocols.
 *
 * Provides:
 *   1. W3C Verifiable Credentials — "wallet X owns identity Y on protocol Z"
 *   2. On-chain attestation — Store identity hash on supported chains (EAS on Ethereum, Solana)
 *   3. Cross-protocol proof — "This Nostr npub is the same person as this Farcaster FID"
 *   4. Timestamp proof — Prove when an identity was first established (OG status)
 *
 * KV key scheme:
 *   attest:{id}                   → AttestationRecord (credential)
 *   attest:wallet:{wallet}        → string[] of attestation IDs for a wallet
 *   attest:proof:{wallet}         → ProofRecord[] (cross-protocol proofs)
 *   attest:timestamp:{wallet}     → FirstSeenRecord (OG timestamp)
 *   attest:onchain:{wallet}:{chain} → OnChainAttestation (EAS/Solana tx hash)
 */

import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────

export type AttestationSubject = {};
