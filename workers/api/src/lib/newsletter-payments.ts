/**
 * @degenfeed/api-worker — Newsletter Payment Processing
 *
 * Handles subscription payments, one-time purchases, creator coin discounts,
 * revenue splitting (90/10), and weekly payouts.
 *
 * Payment methods:
 *   1. One-time purchase — Pay for a single premium issue
 *   2. Monthly subscription — Auto-charge via wallet signature
 *   3. Creator coin discount — Hold $TICKER → discount on subscription
 *   4. Revenue split — Creator 90%, platform 10%
 *   5. Weekly payout — Send accumulated earnings to creator wallet
 *
 * KV keys:
 *   nlp:payment:{paymentId}           → PaymentRecord
 *   nlp:invoice:{invoiceId}           → PaymentInvoice
 *   nlp:subscription:{subscriberId}   → SubscriptionAgreement
 *   nlp:payout:{payoutId}             → PayoutRecord
 *   nlp:payout:queue:{creatorWallet}  → Pending PayoutRecord[]
 *   nlp:discount:{newsletterId}       → DiscountConfig
 */

import { log } from '../logger';
import type { SubscriptionTier } from '../routes/newsletter-subscriptions';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────

export type PaymentMethod = 'evm' | 'solana' | 'lightning';
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'refunded';

export type PaymentInvoice = {};
