import { bytesToHex } from '@noble/hashes/utils';
/**
 * Lightning zap support via LNURL-pay (NIP-57).
 *
 * Flow:
 *   1. Given a Nostr pubkey, resolve their LNURL from kind 0 metadata
 *   2. Call LNURL-pay endpoint to get payment request
 *   3. Return invoice + QR data
 */

export type ZapInvoice = {};
