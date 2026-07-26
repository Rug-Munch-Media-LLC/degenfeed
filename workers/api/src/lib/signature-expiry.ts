/**
 * @degenfeed/api-worker — Signature Expiry and Replay Protection
 *
 * Prevents replay attacks on signed requests by enforcing:
 *   1. Timestamp-based expiry (signed messages expire after N seconds)
 *   2. Nonce consumption (each nonce can only be used once)
 *   3. Message format binding (message must match expected format)
 */

import { bytesToHex } from '@noble/hashes/utils';
import type { Env } from '../types';

/* ─── Types ─────────────────────────────────────────────────────────── */

export type SignedRequest = {};
