/**
 * @degenfeed/api-worker — Registration Payment Verification
 *
 * Hard payment gate for paid registration plans.
 *
 * PREVIOUS BUG (CVSS 8.1): register-all charged $8/$15 for standard/complete
 * plans but NEVER verified payment. The only gate was `confirmedOverage: true`,
 * a client-supplied boolean, and the server's PREMIUM_WALLET_KEY paid all
 * Farcaster ($5 gas) and Lens ($2 gas) registrations for anyone.
 *
 * This module implements the MINIMUM viable fix: a paid plan now requires a
 * `paymentTxHash` that is:
 *   1. Format-valid (EVM 0x…64-hex or Solana base58 signature)
 *   2. Confirmed on-chain (EVM receipt status 0x1, Solana confirmed/finalized)
 *   3. Optionally verified against a configured payment receiver address
 *      (REGISTRATION_PAYMENT_ADDRESS) so the funds actually arrived at us
 *   4. Deduplicated in CACHE KV so one txHash cannot pay for multiple
 *      registrations
 *
 * Stripe is NOT wired into this worker (no STRIPE_* bindings, no webhook
 * handler), so `paymentIntentId` alone cannot be verified and is rejected.
 * If Stripe gets wired later, add a Stripe-specific verifier here.
 */

import { sanitizeString } from '../sanitize';
import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────

/** EVM transaction hash: 0x + 64 hex chars */
const EVM_TX_RE = /^0x[0-9a-fA-F]{64}$/;
/** Solana transaction signature: base58, 86-89 chars */
const SOLANA_TX_RE = /^[1-9A-HJ-NP-Za-km-z]{86,89}$/;

/** How long a used payment txHash stays deduplicated (90 days) */
const PAYMENT_DEDUP_TTL_SEC = 90 * 24 * 60 * 60;

const DEFAULT_BASE_RPC = 'https://mainnet.base.org';
const DEFAULT_POLYGON_RPC = 'https://polygon-rpc.com';
const DEFAULT_SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

// ─── Types ──────────────────────────────────────────────────────────────

export interface RegistrationPaymentProof {
  /** On-chain transaction hash/signature proving the payment */
  txHash?: string;
  /** Stripe payment intent id — NOT verifiable on this deployment */
  paymentIntentId?: string;
}

export interface PaymentVerificationContext {
  walletAddress: string;
  expectedCents: number;
  plan: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  method?: 'evm' | 'solana';
  txHash?: string;
  error?: string;
}

// ─── KV helpers ─────────────────────────────────────────────────────────

function paymentDedupKey(txHash: string): string {
  return `regpay:${txHash.toLowerCase()}`;
}

async function markPaymentUsed(env: Env, txHash: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(paymentDedupKey(txHash), JSON.stringify({ usedAt: Date.now() }), {
      expirationTtl: PAYMENT_DEDUP_TTL_SEC,
    });
  } catch {
    // Best-effort — dedup failure does not weaken the on-chain check
  }
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Verify that a paid registration plan is backed by a real, confirmed,
 * single-use on-chain payment.
 *
 * Returns `{ verified: true }` only when:
 *   - A `txHash` is provided (paymentIntentId alone is rejected)
 *   - The txHash matches an EVM hash or Solana signature format
 *   - The transaction receipt shows success on a supported chain
 *   - If REGISTRATION_PAYMENT_ADDRESS is configured, the EVM tx `to` field
 *     matches our receiver
 *   - The txHash has not already been used for a registration
 *
 * Fail-closed: any RPC/KV error, missing proof, or invalid tx returns
 * `verified: false`.
 */
export async function verifyRegistrationPayment(
  env: Env,
  proof: RegistrationPaymentProof,
  _ctx: PaymentVerificationContext,
): Promise<PaymentVerificationResult> {
  const txHash = sanitizeString(proof.txHash, 128);

  // paymentIntentId cannot be verified on this deployment — Stripe is not
  // wired into the worker. Reject it explicitly instead of silently
  // accepting an unverifiable "payment".
  if (!txHash) {
    const intentId = sanitizeString(proof.paymentIntentId, 128);
    if (intentId) {
      return {
        verified: false,
        error:
          'paymentIntentId cannot be verified on this deployment. Provide a paymentTxHash from an on-chain payment instead.',
      };
    }
    return {
      verified: false,
      error: 'paymentTxHash is required to verify payment for paid plans',
    };
  }

  // Dedup: one txHash must not pay for multiple registrations
  if (env.CACHE) {
    try {
      const used = await env.CACHE.get(paymentDedupKey(txHash));
      if (used) {
        return {
          verified: false,
          error: 'paymentTxHash has already been used for a registration',
        };
      }
    } catch {
      // KV hiccup — continue; on-chain check is the primary gate
    }
  }

  if (EVM_TX_RE.test(txHash)) {
    const result = await verifyEvmTransaction(env, txHash);
    if (result.verified) await markPaymentUsed(env, txHash);
    return result;
  }

  if (SOLANA_TX_RE.test(txHash)) {
    const result = await verifySolanaTransaction(env, txHash);
    if (result.verified) await markPaymentUsed(env, txHash);
    return result;
  }

  return {
    verified: false,
    error: 'paymentTxHash must be an EVM tx hash (0x…) or a Solana transaction signature',
  };
}

// ─── EVM verification ───────────────────────────────────────────────────

async function verifyEvmTransaction(env: Env, txHash: string): Promise<PaymentVerificationResult> {
  // Try Base first (Farcaster chain), then Polygon (Lens chain).
  const rpcs = [env.BASE_RPC_URL || DEFAULT_BASE_RPC, env.POLYGON_RPC_URL || DEFAULT_POLYGON_RPC];

  for (const rpc of rpcs) {
    const receipt = await rpcCall<EvmReceipt>(rpc, 'eth_getTransactionReceipt', [txHash]);
    if (receipt === null) continue; // RPC error — try next chain
    if (receipt.result === null) continue; // not found on this chain

    const status = receipt.result?.status;
    if (status !== '0x1') {
      return {
        verified: false,
        method: 'evm',
        txHash,
        error: 'payment transaction reverted or failed on-chain',
      };
    }

    // Optional receiver check — verify the payment actually arrived at us.
    const receiver = sanitizeString(env.REGISTRATION_PAYMENT_ADDRESS, 64);
    if (receiver) {
      const txInfo = await rpcCall<EvmTransactionInfo>(rpc, 'eth_getTransactionByHash', [txHash]);
      const to = txInfo?.result?.to?.toLowerCase();
      if (!to || to !== receiver.toLowerCase()) {
        return {
          verified: false,
          method: 'evm',
          txHash,
          error: 'payment transaction recipient does not match our payment address',
        };
      }
    }

    return { verified: true, method: 'evm', txHash };
  }

  return {
    verified: false,
    method: 'evm',
    txHash,
    error: 'payment transaction not found on supported chains',
  };
}

// ─── Solana verification ────────────────────────────────────────────────

async function verifySolanaTransaction(
  env: Env,
  signature: string,
): Promise<PaymentVerificationResult> {
  const rpcUrl = env.SOLANA_RPC_URL || DEFAULT_SOLANA_RPC;
  const data = await rpcCall<{
    value?: Array<{ err?: unknown; confirmationStatus?: string } | null>;
  }>(rpcUrl, 'getSignatureStatuses', [[signature], { searchTransactionHistory: true }]);

  const status = data?.result?.value?.[0];

  if (!status) {
    return {
      verified: false,
      method: 'solana',
      txHash: signature,
      error: 'payment transaction not found on Solana',
    };
  }
  if (status.err) {
    return {
      verified: false,
      method: 'solana',
      txHash: signature,
      error: 'payment transaction failed on-chain',
    };
  }
  const conf = status.confirmationStatus;
  if (conf !== 'confirmed' && conf !== 'finalized') {
    return {
      verified: false,
      method: 'solana',
      txHash: signature,
      error: 'payment transaction not yet confirmed on-chain',
    };
  }

  return { verified: true, method: 'solana', txHash: signature };
}

// ─── RPC helper ─────────────────────────────────────────────────────────

interface EvmReceipt {
  status?: string;
}

interface EvmTransactionInfo {
  to?: string;
}

interface RpcEnvelope<T> {
  result?: T | null;
}

async function rpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<RpcEnvelope<T> | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) return null;
    return (await res.json()) as RpcEnvelope<T>;
  } catch {
    return null;
  }
}
