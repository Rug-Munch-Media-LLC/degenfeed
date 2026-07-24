/**
 * @degenfeed/monetization — Core types
 *
 * Tier definitions, feature flags, pricing, and subscription records
 * for the DegenFeed monetization system.
 *
 * All monetary values in USD cents internally.
 */

// ─── Tier Definitions ───────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'creator' | 'pro' | 'enterprise';

/** Tier rank — higher number = more access */
export const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  creator: 1,
  pro: 2,
  enterprise: 3,
};

/** Human-readable tier names */
export const TIER_NAMES: Record<SubscriptionTier, string> = {
  free: 'Free',
  creator: 'Creator',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

/** Monthly prices in USD cents */
export const TIER_PRICES_CENTS: Record<SubscriptionTier, number> = {
  free: 0,
  creator: 499, // $4.99/mo
  pro: 999, // $9.99/mo
  enterprise: 2999, // $29.99/mo
};

/** Annual prices in USD cents (2 months free) */
export const TIER_PRICES_CENTS_YEARLY: Record<SubscriptionTier, number> = {
  free: 0,
  creator: 4999, // $49.99/yr ($4.17/mo)
  pro: 9999, // $99.99/yr ($8.33/mo)
  enterprise: 29999, // $299.99/yr ($25.00/mo)
};

// ─── Feature Flags ──────────────────────────────────────────────────────

export type FeatureFlag =
  | 'cross_protocol_posting'
  | 'cross_platform_publishing'
  | 'analytics_dashboard'
  | 'creator_coins'
  | 'unlimited_protocols'
  | 'self_hosting'
  | 'white_label'
  | 'custom_domain'
  | 'priority_support'
  | 'verified_checkmark'
  | 'custom_algorithms'
  | 'tipping'
  | 'subscriptions'
  | 'api_access'
  | 'scheduled_posts'
  | 'advanced_analytics'
  | 'team_management'
  | 'sso_saml'
  | 'dedicated_infra'
  | 'sla_guarantee';

/** Feature-to-minimum-tier mapping */
export const FEATURE_TIER_MAP: Record<FeatureFlag, SubscriptionTier> = {
  // Free features
  verified_checkmark: 'free',
  tipping: 'free',

  // Creator features ($4.99)
  creator_coins: 'creator',
  subscriptions: 'creator',
  analytics_dashboard: 'creator',
  scheduled_posts: 'creator',
  custom_algorithms: 'creator',

  // Pro features ($9.99)
  cross_protocol_posting: 'pro',
  cross_platform_publishing: 'pro',
  unlimited_protocols: 'pro',
  advanced_analytics: 'pro',
  api_access: 'pro',
  priority_support: 'pro',

  // Enterprise features ($29.99)
  self_hosting: 'enterprise',
  white_label: 'enterprise',
  custom_domain: 'enterprise',
  team_management: 'enterprise',
  sso_saml: 'enterprise',
  dedicated_infra: 'enterprise',
  sla_guarantee: 'enterprise',
};

/** Human-readable feature labels */
export const FEATURE_LABELS: Record<FeatureFlag, string> = {
  cross_protocol_posting: 'Cross-Protocol Posting',
  cross_platform_publishing: 'Cross-Platform Publishing',
  analytics_dashboard: 'Analytics Dashboard',
  creator_coins: 'Creator Coins',
  unlimited_protocols: 'Unlimited Protocols',
  self_hosting: 'Self-Hosting',
  white_label: 'White Label',
  custom_domain: 'Custom Domain',
  priority_support: 'Priority Support',
  verified_checkmark: 'Verified Checkmark',
  custom_algorithms: 'Custom Algorithms',
  tipping: 'Tipping',
  subscriptions: 'Subscriptions',
  api_access: 'API Access',
  scheduled_posts: 'Scheduled Posts',
  advanced_analytics: 'Advanced Analytics',
  team_management: 'Team Management',
  sso_saml: 'SSO / SAML',
  dedicated_infra: 'Dedicated Infrastructure',
  sla_guarantee: 'SLA Guarantee',
};

// ─── Tier Limits ────────────────────────────────────────────────────────

export interface TierLimits {
  connectedProtocols: number;
  creatorCoins: number;
  scheduledPosts: number;
  teamMembers: number;
  apiRateLimit: number; // requests/minute
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    connectedProtocols: 5,
    creatorCoins: 0,
    scheduledPosts: 0,
    teamMembers: 1,
    apiRateLimit: 10,
  },
  creator: {
    connectedProtocols: 10,
    creatorCoins: 3,
    scheduledPosts: 50,
    teamMembers: 1,
    apiRateLimit: 60,
  },
  pro: {
    connectedProtocols: 999,
    creatorCoins: 999,
    scheduledPosts: 999,
    teamMembers: 5,
    apiRateLimit: 300,
  },
  enterprise: {
    connectedProtocols: 999,
    creatorCoins: 999,
    scheduledPosts: 999,
    teamMembers: 999,
    apiRateLimit: 3000,
  },
};

// ─── Platform Fees ──────────────────────────────────────────────────────

export const PLATFORM_FEES = {
  /** Creator coin buy/sell fee (percentage) */
  creatorCoinFee: 0.005, // 0.5%
  /** Cross-protocol tipping fee (percentage) */
  tippingFee: 0.01, // 1%
  /** Featured/promoted post placement (USD cents/month) */
  featuredPlacementCents: 5000, // $50/mo
  /** Self-hosting license (USD cents/month, Enterprise) */
  selfHostingLicenseCents: 2999, // included in Enterprise
} as const;

// ─── Tier Configuration ────────────────────────────────────────────────

export interface TierConfig {
  id: SubscriptionTier;
  name: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  priceCents: number;
  priceCentsYearly: number;
  popular: boolean;
  features: { name: string; key: FeatureFlag; included: boolean; highlight?: boolean }[];
  limits: TierLimits;
  cta: string;
  badge?: string;
}

export const TIER_CONFIGS: TierConfig[] = [
  {
    id: 'free',
    name: 'Free',
    description:
      'Basic access to the DegenFeed network. Browse, tip, and connect up to 5 protocols.',
    priceMonthly: '$0',
    priceYearly: '$0',
    priceCents: 0,
    priceCentsYearly: 0,
    popular: false,
    features: [
      { name: 'Browse all content', key: 'verified_checkmark', included: true },
      { name: 'Tip creators', key: 'tipping', included: true },
      { name: 'Up to 5 connected protocols', key: 'unlimited_protocols', included: false },
      { name: 'Cross-protocol posting', key: 'cross_protocol_posting', included: false },
      { name: 'Creator coins', key: 'creator_coins', included: false },
      { name: 'Analytics dashboard', key: 'analytics_dashboard', included: false },
      { name: 'Scheduled posts', key: 'scheduled_posts', included: false },
      { name: 'API access', key: 'api_access', included: false },
      { name: 'Priority support', key: 'priority_support', included: false },
    ],
    limits: TIER_LIMITS.free,
    cta: 'Get Started Free',
  },
  {
    id: 'creator',
    name: 'Creator',
    description: 'Creator tools, tipping, subscriptions, and analytics to grow your audience.',
    priceMonthly: '$4.99',
    priceYearly: '$49.99',
    priceCents: 499,
    priceCentsYearly: 4999,
    popular: false,
    features: [
      { name: 'Everything in Free', key: 'verified_checkmark', included: true },
      { name: 'Creator coins (up to 3)', key: 'creator_coins', included: true, highlight: true },
      { name: 'Subscriptions & tipping', key: 'subscriptions', included: true, highlight: true },
      { name: 'Analytics dashboard', key: 'analytics_dashboard', included: true, highlight: true },
      { name: 'Scheduled posts', key: 'scheduled_posts', included: true },
      { name: 'Custom algorithms', key: 'custom_algorithms', included: true },
      { name: 'Up to 10 protocols', key: 'unlimited_protocols', included: true },
      { name: 'Cross-platform publishing', key: 'cross_platform_publishing', included: false },
      { name: 'API access', key: 'api_access', included: false },
      { name: 'Priority support', key: 'priority_support', included: false },
    ],
    limits: TIER_LIMITS.creator,
    cta: 'Start Creator',
    badge: 'BEST FOR CREATORS',
  },
  {
    id: 'pro',
    name: 'Pro',
    description:
      'Unlimited everything. Cross-publish to Twitter, LinkedIn, Facebook. Full API access.',
    priceMonthly: '$9.99',
    priceYearly: '$99.99',
    priceCents: 999,
    priceCentsYearly: 9999,
    popular: true,
    features: [
      { name: 'Everything in Creator', key: 'creator_coins', included: true },
      { name: 'Unlimited protocols', key: 'unlimited_protocols', included: true, highlight: true },
      {
        name: 'Cross-platform publishing',
        key: 'cross_platform_publishing',
        included: true,
        highlight: true,
      },
      { name: 'Advanced analytics', key: 'advanced_analytics', included: true, highlight: true },
      { name: 'Buffer-style scheduling', key: 'scheduled_posts', included: true },
      { name: 'API access', key: 'api_access', included: true },
      { name: 'Priority Discord/Telegram support', key: 'priority_support', included: true },
      { name: 'Unlimited creator coins', key: 'creator_coins', included: true },
      { name: 'Self-hosting', key: 'self_hosting', included: false },
      { name: 'White label', key: 'white_label', included: false },
    ],
    limits: TIER_LIMITS.pro,
    cta: 'Upgrade to Pro',
    badge: 'MOST POPULAR',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description:
      'Self-host, white-label, custom domain, dedicated infrastructure for organizations.',
    priceMonthly: '$29.99',
    priceYearly: '$299.99',
    priceCents: 2999,
    priceCentsYearly: 29999,
    popular: false,
    features: [
      { name: 'Everything in Pro', key: 'unlimited_protocols', included: true },
      { name: 'Self-hosting', key: 'self_hosting', included: true, highlight: true },
      {
        name: 'White label / custom branding',
        key: 'white_label',
        included: true,
        highlight: true,
      },
      { name: 'Custom domain', key: 'custom_domain', included: true, highlight: true },
      { name: 'Team management', key: 'team_management', included: true },
      { name: 'SSO / SAML', key: 'sso_saml', included: true },
      { name: 'Dedicated infrastructure', key: 'dedicated_infra', included: true },
      { name: 'SLA guarantee', key: 'sla_guarantee', included: true },
      { name: 'Dedicated support', key: 'priority_support', included: true },
      { name: 'Custom contract & pricing', key: 'api_access', included: true },
    ],
    limits: TIER_LIMITS.enterprise,
    cta: 'Contact Sales',
  },
];

// ─── Subscription Record ────────────────────────────────────────────────

export interface SubscriptionRecord {
  identityId: string;
  tier: SubscriptionTier;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  startedAt: number;
  expiresAt: number;
  canceledAt?: number;
  trialEndsAt?: number;
  /** Stripe subscription ID (if applicable) */
  stripeSubscriptionId?: string;
  /** Stripe customer ID (if applicable) */
  stripeCustomerId?: string;
  /** On-chain tx hash (if paid via crypto) */
  txHash?: string;
  /** Payment method used */
  paymentMethod?: 'card' | 'crypto' | 'invoice';
  /** Annual billing discount applied */
  isYearly: boolean;
  /** Next billing amount in USD cents */
  nextBillingAmount: number;
}

// ─── Revenue Tracking ──────────────────────────────────────────────────

export interface RevenueEvent {
  id: string;
  type:
    | 'subscription'
    | 'creator_coin_fee'
    | 'tipping_fee'
    | 'featured_placement'
    | 'api_access'
    | 'self_hosting_license';
  amountCents: number;
  currency: 'usd';
  tier: SubscriptionTier;
  userId: string;
  timestamp: number;
  description: string;
}
