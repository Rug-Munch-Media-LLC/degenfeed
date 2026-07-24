/**
 * @degenfeed/monetization — StripeIntegration
 *
 * Stripe payment processing for DegenFeed subscriptions.
 * Handles checkout sessions, webhooks, customer portal, and
 * subscription lifecycle management.
 *
 * Requires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` env vars.
 * Prices are defined in Stripe dashboard and referenced by price ID.
 *
 * Usage:
 *   const stripe = new StripeIntegration(stripeSecretKey, webhookSecret);
 *   const session = await stripe.createCheckoutSession({
 *     tier: 'pro',
 *     customerEmail: 'user@example.com',
 *     successUrl: 'https://app.degenfeed.xyz/settings/subscription',
 *   });
 */

import type { SubscriptionTier } from './types';

// ─── Types ───────────────────────────────────────────────────────────────

export interface CreateCheckoutParams {
  tier: SubscriptionTier;
  customerId?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  isYearly?: boolean;
  trialDays?: number;
  metadata?: Record<string, string>;
}

export interface CheckoutResult {
  sessionId: string;
  url: string | null;
}

export interface PortalResult {
  url: string;
}

export interface WebhookEvent {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

export interface SubscriptionSyncResult {
  tier: SubscriptionTier;
  status: 'active' | 'cancelled' | 'past_due';
  expiresAt: number;
  stripeSubscriptionId: string;
}

// ─── Stripe Price ID Mapping ─────────────────────────────────────────────

/**
 * Map internal tiers to Stripe Price IDs.
 * These must be created in the Stripe dashboard first.
 * Format: price_xxxxxxxxxxxxxx
 */
const STRIPE_PRICE_IDS: Record<SubscriptionTier, { monthly: string; yearly: string }> = {
  free: { monthly: '', yearly: '' },
  creator: {
    monthly: process.env.STRIPE_PRICE_CREATOR_MONTHLY ?? '',
    yearly: process.env.STRIPE_PRICE_CREATOR_YEARLY ?? '',
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? '',
  },
  enterprise: {
    monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? '',
    yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY ?? '',
  },
};

// ─── StripeIntegration ───────────────────────────────────────────────────

export class StripeIntegration {
  private stripe: import('stripe').Stripe | null = null;
  private webhookSecret: string;

  constructor(stripeSecretKey?: string, webhookSecret?: string) {
    // Lazily initialize Stripe — it may not be available in all environments
    const key = stripeSecretKey ?? process.env.STRIPE_SECRET_KEY;
    if (key) {
      // Dynamic import to avoid hard dependency when Stripe isn't configured
      this.initializeStripe(key);
    }
    this.webhookSecret = webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET ?? '';
  }

  private async initializeStripe(secretKey: string): Promise<void> {
    try {
      const { default: Stripe } = await import('stripe');
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-02-24.acacia',
        typescript: true,
      });
    } catch {
      console.warn('[StripeIntegration] Failed to initialize Stripe. Payments will not work.');
    }
  }

  // ─── Readiness ─────────────────────────────────────────────────────────

  get isReady(): boolean {
    return this.stripe !== null;
  }

  // ─── Checkout Session ──────────────────────────────────────────────────

  /**
   * Create a Stripe Checkout Session for a subscription.
   * Redirects the user to Stripe's hosted checkout page.
   */
  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized. Set STRIPE_SECRET_KEY.');
    }

    const priceId = params.isYearly
      ? STRIPE_PRICE_IDS[params.tier]?.yearly
      : STRIPE_PRICE_IDS[params.tier]?.monthly;

    if (!priceId) {
      throw new Error(`No Stripe price configured for tier: ${params.tier}`);
    }

    const sessionParams: import('stripe').Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: params.trialDays ?? 14,
        metadata: {
          tier: params.tier,
          ...params.metadata,
        },
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        tier: params.tier,
        ...params.metadata,
      },
    };

    if (params.customerId) {
      sessionParams.customer = params.customerId;
    } else if (params.customerEmail) {
      sessionParams.customer_email = params.customerEmail;
    }

    const session = await this.stripe.checkout.sessions.create(sessionParams);

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  // ─── Customer Portal ───────────────────────────────────────────────────

  /**
   * Create a Stripe Customer Portal session for managing subscriptions.
   */
  async createPortalSession(customerId: string, returnUrl: string): Promise<PortalResult> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized. Set STRIPE_SECRET_KEY.');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  // ─── Webhook Handling ──────────────────────────────────────────────────

  /**
   * Verify and parse a Stripe webhook event.
   * Returns null if the signature is invalid.
   */
  async verifyWebhookEvent(body: string, signature: string): Promise<WebhookEvent | null> {
    if (!this.stripe || !this.webhookSecret) {
      console.warn('[StripeIntegration] Webhook verification not configured');
      return null;
    }

    try {
      const event = await this.stripe.webhooks.constructEventAsync(
        body,
        signature,
        this.webhookSecret,
      );
      return {
        type: event.type,
        data: { object: event.data.object as Record<string, unknown> },
      };
    } catch (err) {
      console.error('[StripeIntegration] Webhook signature verification failed:', err);
      return null;
    }
  }

  /**
   * Sync a Stripe subscription event to our internal subscription record.
   * Call this from your webhook handler for:
   *   - checkout.session.completed
   *   - customer.subscription.updated
   *   - customer.subscription.deleted
   */
  syncSubscriptionFromStripe(subscription: Record<string, unknown>): SubscriptionSyncResult {
    const items = subscription.items as
      | { data?: Array<{ price?: { metadata?: Record<string, string> } }> }
      | undefined;
    const priceMetadata = items?.data?.[0]?.price?.metadata;
    const tier = (priceMetadata?.tier as SubscriptionTier) ?? 'pro';
    const status = subscription.status as string;
    const currentPeriodEnd = (subscription.current_period_end as number) * 1000; // Convert to ms

    const mappedStatus: 'active' | 'cancelled' | 'past_due' =
      status === 'active' || status === 'trialing'
        ? 'active'
        : status === 'canceled' || status === 'incomplete_expired'
          ? 'cancelled'
          : 'past_due';

    return {
      tier,
      status: mappedStatus,
      expiresAt: currentPeriodEnd,
      stripeSubscriptionId: subscription.id as string,
    };
  }

  // ─── Customer Lookup ───────────────────────────────────────────────────

  /**
   * Find a Stripe customer by email. Returns the customer ID or null.
   */
  async findCustomerByEmail(email: string): Promise<string | null> {
    if (!this.stripe) return null;

    try {
      const customers = await this.stripe.customers.list({ email, limit: 1 });
      return customers.data[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Create a new Stripe customer.
   */
  async createCustomer(email: string, metadata?: Record<string, string>): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    const customer = await this.stripe.customers.create({
      email,
      metadata,
    });
    return customer.id;
  }
}
