# Monetization Strategy & Premium Features

> **Last updated:** 2026-07-24
> **Status:** 🟢 Active — Implementation in progress

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Pricing Model](#2-pricing-model)
3. [Feature Matrix](#3-feature-matrix)
4. [Revenue Streams](#4-revenue-streams)
5. [Revenue Projections](#5-revenue-projections)
6. [Competitive Analysis](#6-competitive-analysis)
7. [Technical Architecture](#7-technical-architecture)
8. [Implementation Status](#8-implementation-status)
9. [Risk & Mitigation](#9-risk--mitigation)

---

## 1. Executive Summary

DegenFeed monetizes through a **four-tier subscription model** supplemented by **minimal platform fees** on creator coins and cross-protocol tips. The strategy prioritizes:

- **Free tier as growth engine** — zero friction to onboard, no time limit, generous feature set
- **Creator-first pricing** — the Creator plan ($4.99/mo) is priced below competitors' entry-level plans
- **No platform fees on subscriptions** — creators keep 100% of what their audience pays them
- **Minimal platform fees elsewhere** — 0.5% on creator coin trades, 1% on cross-protocol tips (vs. industry 5-10%)
- **Self-hosting as enterprise unlock** — open-source core with paid Enterprise self-hosting license

### Guiding Principles

| Principle | Application |
|-----------|-------------|
| **Free forever** | Browse, read, search, and engage across all protocols. No account, no payment. |
| **Pay for power** | Charge for publishing, analytics, API access, and customization — not for reading. |
| **Creator economy** | Minimal fees (0.5% coins, 1% tips). Creators keep 100% of subscriptions. |
| **Transparent pricing** | All prices in USD. No hidden fees. Annual discount clearly shown. |
| **Open source** | AGPL-3.0. Self-hosting is always free. Enterprise = license for commercial use. |

---

## 2. Pricing Model

### Tier Overview

| Tier | Price | Monthly | Yearly (Save ~17%) | Target Audience |
|------|-------|---------|-------------------|-----------------|
| **Free** | $0 | $0 | $0 | All users, browsers, casual readers |
| **Creator** | $4.99/mo | $4.99 | $49.99 ($4.17/mo) | Individual creators, artists, writers |
| **Pro** | $9.99/mo | $9.99 | $99.99 ($8.33/mo) | Power users, publishers, developers |
| **Enterprise** | $29.99/mo | $29.99 | $299.99 ($25.00/mo) | Organizations, brands, media companies |

### Annual Discount

All paid plans offer **~17% savings** with annual billing:
- Creator: $4.99/mo → $4.17/mo (annual)
- Pro: $9.99/mo → $8.33/mo (annual)
- Enterprise: $29.99/mo → $25.00/mo (annual)

### Free Trial

- **14-day free trial** on all paid plans
- No credit card required for trial
- Full feature access during trial
- Cancel anytime during trial at no cost
- Automatically downgrades to Free at trial end

### Payment Methods

| Method | Supported | Notes |
|--------|-----------|-------|
| Credit/Debit Card | ✅ | Via Stripe |
| USDC on Base | ✅ | On-chain payment |
| ETH on Base | ✅ | On-chain payment |
| SOL | ✅ | Solana native |
| Lightning Network | ✅ | Bitcoin LN |

### Billing Model

| Feature | Detail |
|---------|--------|
| Billing cycle | Monthly or yearly |
| Invoicing | Same-day, email receipt |
| Upgrades | Immediately effective, prorated credit |
| Downgrades | Immediately effective, prorated credit (if any) |
| Cancellation | End of billing period, no refunds for partial months |
| Tax handling | Automatic VAT/GST collection via Stripe Tax |

---

## 3. Feature Matrix

### Detailed Feature Comparison

| Feature | Free | Creator ($4.99) | Pro ($9.99) | Enterprise ($29.99) |
|---------|:----:|:---------------:|:-----------:|:-------------------:|
| **Core** | | | | |
| Browse all content | ✅ | ✅ | ✅ | ✅ |
| Verified checkmark | ✅ | ✅ | ✅ | ✅ |
| Tipping (same-protocol) | ✅ | ✅ | ✅ | ✅ |
| Basic profile | ✅ | ✅ | ✅ | ✅ |
| **Protocols** | | | | |
| Connected protocols | 5 | 10 | ∞ | ∞ |
| Cross-protocol posting | — | ✅ | ✅ | ✅ |
| Cross-platform publishing | — | — | ✅ | ✅ |
| Buffer-style scheduling | — | ✅ | ✅ | ✅ |
| **Creator Tools** | | | | |
| Creator coins | — | 3 coins | ∞ | ∞ |
| Subscriptions | — | ✅ | ✅ | ✅ |
| Analytics dashboard | — | ✅ | ✅ | ✅ |
| Custom algorithms | — | ✅ | ✅ | ✅ |
| Content token-gating | — | ✅ | ✅ | ✅ |
| **Advanced** | | | | |
| Advanced analytics | — | — | ✅ | ✅ |
| API access | — | — | ✅ | ✅ |
| Priority support | — | — | ✅ (Discord/Telegram) | ✅ (Dedicated) |
| **Enterprise** | | | | |
| Self-hosting | — | — | — | ✅ |
| White label | — | — | — | ✅ |
| Custom domain | — | — | — | ✅ |
| Team management | — | — | 5 members | ∞ |
| SSO / SAML | — | — | — | ✅ |
| Dedicated infrastructure | — | — | — | ✅ |
| SLA guarantee | — | — | — | ✅ |
| Custom integrations | — | — | — | ✅ |

### Tier Limits

| Resource | Free | Creator | Pro | Enterprise |
|----------|:----:|:-------:|:---:|:----------:|
| Connected protocols | 5 | 10 | ∞ | ∞ |
| Creator coins | 0 | 3 | ∞ | ∞ |
| Scheduled posts | 0 | 50 | ∞ | ∞ |
| Team members | 1 | 1 | 5 | ∞ |
| API rate limit | 10/min | 60/min | 300/min | 3,000/min |

### Feature Gate Keys

Each feature is identified by a `FeatureFlag` key for programmatic access:

```
cross_protocol_posting
cross_platform_publishing
analytics_dashboard
creator_coins
unlimited_protocols
self_hosting
white_label
custom_domain
priority_support
verified_checkmark
custom_algorithms
tipping
subscriptions
api_access
scheduled_posts
advanced_analytics
team_management
sso_saml
dedicated_infra
sla_guarantee
```

---

## 4. Revenue Streams

### 4.1 Subscription Revenue

Recurring revenue from monthly/yearly subscriptions.

| Tier | Monthly Price | Annual Price | Est. Margin |
|------|:------------:|:------------:|:-----------:|
| Creator | $4.99 | $49.99 | ~85% (after Stripe fees + infra) |
| Pro | $9.99 | $99.99 | ~88% |
| Enterprise | $29.99 | $299.99 | ~92% |

**Stripe fees:** 2.9% + $0.30 per transaction (standard)

### 4.2 Creator Coin Fees (0.5%)

A **0.5% platform fee** on every creator coin buy and sell transaction.

- Collected on-chain at trade time via the bonding curve contract
- Applies to both buy and sell operations
- Funds are collected into a platform treasury wallet
- Estimated yield: $0.50 on a $100 trade

**Comparison:** Industry standard is 1-5%. Our 0.5% is the lowest in market.

### 4.3 Cross-Protocol Tipping Fee (1%)

A **1% fee** on tips that cross protocol boundaries (e.g., tipping a Farcaster user from a Nostr wallet).

- Same-protocol tips: **0% fee** (always free)
- Cross-protocol tips: **1% fee**
- The lowest in market (competitors charge 5-10%)

### 4.4 Self-Hosting License

Included in the Enterprise plan ($29.99/mo). For larger deployments, custom pricing is available.

- Full white-label branding
- Custom domain
- Dedicated infrastructure
- Priority support + SLA

### 4.5 API Access

- **Free tier:** 10 requests/minute
- **Pro:** 300 requests/minute (included)
- **Enterprise:** 3,000 requests/minute (included)
- **Future:** Metered API billing for high-volume developers beyond included limits

### 4.6 Featured Placement

Promoted posts and featured placement in feeds.

- **$50/month** per featured placement campaign
- Non-intrusive, clearly labeled as "Promoted"
- Targetable by niche, protocol, or audience

### 4.7 Revenue Summary

| Stream | Fee/Price | Frequency | Collection Method |
|--------|-----------|-----------|-------------------|
| Creator subscription | $4.99/mo | Monthly/yearly | Stripe + Crypto |
| Pro subscription | $9.99/mo | Monthly/yearly | Stripe + Crypto |
| Enterprise subscription | $29.99/mo | Monthly/yearly | Stripe + Invoice |
| Creator coin fee | 0.5% | Per trade | On-chain (bonding curve) |
| Cross-protocol tip fee | 1% | Per tip | On-chain |
| Featured placement | $50/mo | Monthly | Invoice |
| Self-hosting (custom) | Custom | Monthly/yearly | Invoice |

---

## 5. Revenue Projections

### Year 1 Projection (Conservative)

| Month | Users | Free | Creator | Pro | Enterprise | Monthly Revenue |
|:-----:|:-----:|:----:|:-------:|:---:|:----------:|:--------------:|
| 1 | 5,000 | 4,800 | 100 | 80 | 20 | **$1,078** |
| 3 | 15,000 | 14,250 | 375 | 300 | 75 | **$4,042** |
| 6 | 40,000 | 37,600 | 1,200 | 960 | 240 | **$12,936** |
| 9 | 80,000 | 74,400 | 2,800 | 2,240 | 560 | **$30,184** |
| 12 | 150,000 | 138,000 | 6,000 | 4,800 | 1,200 | **$64,680** |

**Assumptions:**
- 4% conversion rate to paid (free → Creator)
- 3.2% conversion rate to Pro
- 0.8% conversion rate to Enterprise
- 20% month-over-month user growth (first 6 months)
- 15% MoM growth (months 7-12)

### Year 2 Projection (Moderate)

| Metric | Conservative | Moderate | Optimistic |
|--------|:------------:|:--------:|:----------:|
| Total users | 500K | 1M | 2M |
| Paid conversion | 6% | 8% | 12% |
| Creator subscribers | 15K | 30K | 72K |
| Pro subscribers | 12K | 40K | 120K |
| Enterprise subscribers | 3K | 10K | 40K |
| **Monthly subscription revenue** | **$143,850** | **$548,700** | **$1,677,600** |
| Creator coin fees (monthly) | $5,000 | $25,000 | $100,000 |
| Tipping fees (monthly) | $1,000 | $5,000 | $25,000 |
| Featured placements (monthly) | $2,500 | $10,000 | $25,000 |
| **Total monthly revenue** | **$152,350** | **$588,700** | **$1,827,600** |
| **Annual run rate** | **$1.83M** | **$7.06M** | **$21.93M** |

### Break-Even Analysis

| Cost Category | Monthly Estimate |
|---------------|:---------------:|
| Infrastructure (Cloudflare, servers, RPCs) | $3,500 |
| Developer salaries | $25,000 |
| Design & product | $8,000 |
| Marketing & growth | $5,000 |
| Legal & compliance | $2,000 |
| Payment processing (Stripe) | $1,500 |
| **Total monthly burn** | **$45,000** |

**Break-even point:** Month 8-9 at conservative trajectory (~500 paid users).

---

## 6. Competitive Analysis

### Pricing Comparison

| Platform | Entry Price | Creator Tier | Max Tier | Platform Fee | Notes |
|----------|:-----------:|:------------:|:--------:|:------------:|-------|
| **DegenFeed** | **$0** | **$4.99/mo** | **$29.99/mo** | **0.5-1%** | **Open source, no data selling** |
| Substack | $0 | — | — | 10% | Takes 10% of subscriptions |
| Patreon | $0 | — | — | 5-12% | Takes cut of pledges |
| Ko-fi | $0 | — | — | 0% (but charges for features) | Limited features |
| OnlyFans | $0 | — | — | 20% | Very high fee |
| Twitter/X Premium | $8/mo | — | $16/mo | N/A | Ad-based, limited creator tools |
| Medium | $0 | $5/mo | — | N/A | Limited to Medium platform |
| Ghost(Pro) | $0 | $9/mo | $25/mo | 0% | No built-in social aggregation |
| Buy Me a Coffee | $0 | — | — | 5% | Simple, limited features |
| Zora | $0 | — | — | ~2.5% | NFT focus, no subscriptions |

### Competitive Advantages

| Advantage | Detail |
|-----------|--------|
| **Lowest fees** | 0.5% coin fees, 1% cross-protocol tips — 5-40x lower than competitors |
| **Open source** | AGPL-3.0. Full transparency. Self-hostable. |
| **Multi-protocol** | Post to 15+ protocols from one interface (read from 44+) |
| **True ownership** | No platform lock-in. Your audience follows you across protocols. |
| **No data selling** | Revenue comes from subscriptions and fees, not user data |
| **Crypto-native** | Pay with credit card OR crypto. On-chain features built in. |
| **Creator-first** | $4.99 entry point is 37-50% cheaper than comparable creator tools |

### Competitive Weaknesses & Mitigation

| Weakness | Mitigation |
|----------|------------|
| Brand awareness | Focus on niche communities (Farcaster, Lens, Nostr) |
| Smaller feature set | Open source community contributions; rapid iteration |
| No mobile app (yet) | PWA + Capacitor mobile app in development |
| Protocol reliability | Redundant fetchers, cached fallbacks, self-hosted infra |
| Crypto volatility | All prices in USD; stablecoin payments preferred |

---

## 7. Technical Architecture

### Package Structure

```
packages/monetization/
├── src/
│   ├── index.ts              # Barrel exports
│   ├── types.ts              # All types, tier definitions, feature maps
│   ├── TierManager.ts        # Tier logic: access, limits, subscriptions
│   ├── FeatureGate.ts        # Feature gating (server + client components)
│   └── StripeIntegration.ts  # Stripe checkout, webhooks, portal
├── package.json
└── tsconfig.json
```

### Class Diagram

```
┌─────────────────────────────────────────────────┐
│                  TierManager                      │
│  ┌─────────────────────────────────────────────┐ │
│  │ canAccess(tier, feature)      → boolean      │ │
│  │ compareTiers(a, b)            → number       │ │
│  │ getLimits(tier)               → TierLimits   │ │
│  │ checkLimit(tier, key, value)  → CheckResult  │ │
│  │ getEffectiveTier(record)      → SubscriptionTier│
│  │ buildSubscription(...)        → SubscriptionRecord│
│  │ calculateProratedRefund(...)  → number        │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                 FeatureGate                       │
│  ┌─────────────────────────────────────────────┐ │
│  │ checkAccess(tier, feature)   → CheckResult   │ │
│  │ requireAll(tier, features)   → {allowed, ...}│ │
│  │ requireAny(tier, features)   → {allowed, ...}│ │
│  │ getAccessibleFeatures(tier)  → FeatureFlag[] │ │
│  │ getBlockedFeatures(tier)     → Map           │ │
│  │ <PremiumGate> component                       │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              StripeIntegration                    │
│  ┌─────────────────────────────────────────────┐ │
│  │ createCheckoutSession(params) → {url, id}   │ │
│  │ createPortalSession(customer) → {url}       │ │
│  │ verifyWebhookEvent(body, sig) → event|null  │ │
│  │ syncSubscriptionFromStripe(sub) → SyncResult │ │
│  │ findCustomerByEmail(email) → string|null    │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tiers` | GET | Get all tier definitions |
| `/api/tiers/me` | GET | Current user's tier + usage |
| `/api/tiers/upgrade` | POST | Initiate upgrade |
| `/api/billing/subscribe` | POST | Create subscription |
| `/api/billing/cancel` | POST | Cancel subscription |
| `/api/billing/my-status` | GET | Current subscription status |
| `/api/billing/checkout` | GET | Stripe/crypto checkout |
| `/api/billing/verify` | POST | Verify on-chain payment |
| `/api/billing/webhook` | POST | Stripe webhook receiver |

### Feature Gating Flow

```
User Request
    │
    ▼
┌──────────────────────────────┐
│   requireSession()           │ ← Auth check
│   (401 if unauthenticated)   │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│   checkPremiumStatus(wallet) │ ← KV lookup
│   Returns tier or null       │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│   hasTierAccess(user, req)   │ ← Tier comparison
│   Uses TIER_RANK map         │
└──────────┬───────────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
    OK         BLOCKED
     │           │
     │           ▼
     │   402 Payment Required
     │   X-Premium-Required header
     │   { upgrade: true, requiredTier }
     │
     ▼
  Handler executes
```

### Canary Deploy Strategy

1. **Phase 1 (Current):** Free + Creator + Pro + Enterprise tiers active
2. **Phase 2 (Q4 2026):** Stripe integration live, card payments
3. **Phase 3 (Q1 2027):** Metered API billing for developers
4. **Phase 4 (Q2 2027):** Featured placement marketplace

---

## 8. Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Tier types & config | ✅ | `packages/monetization/types.ts` |
| TierManager logic | ✅ | `packages/monetization/TierManager.ts` |
| FeatureGate (pure logic) | ✅ | `packages/monetization/FeatureGate.ts` |
| PremiumGate component | ✅ | `packages/monetization/FeatureGate.ts` |
| StripeIntegration | ✅ | `packages/monetization/StripeIntegration.ts` |
| Worker API: billing routes | ✅ | `workers/api/src/routes/billing.ts` |
| Worker API: tier routes | ✅ | `workers/api/src/routes/tiers.ts` |
| Worker API: tier gate middleware | ✅ | `workers/api/src/lib/tier-gate.ts` |
| Worker API: premium helpers | ✅ | `workers/api/src/premium.ts` |
| API: pricing/tier middleware | ✅ | 402 responses with X-Premium-Required |
| Frontend: usePremium hook | ✅ | `hooks/usePremium.ts` |
| Frontend: PremiumPaymentModal | ✅ | 5-step crypto/Stripe checkout |
| Frontend: PremiumGate component | ✅ | Feature gating wrapper |
| Frontend: /premium page | ✅ | Legacy — redirects to /pricing |
| Frontend: /pricing page | ✅ | NEW — Four-tier pricing with yearly toggle |
| Frontend: /settings/subscription | ✅ | NEW — Subscription management |
| Storage: subscription.ts | ✅ | IndexedDB subscription cache |
| Storage: monetization.ts | ✅ | Creator tipping preferences |
| Documentation: MONETIZATION.md | ✅ | This document |

### What's Next

- [ ] Stripe webhook handler in Workers API
- [ ] Actual on-chain subscription verification (smart contract)
- [ ] Revenue dashboard for admin
- [ ] Subscription proration logic for mid-cycle upgrades
- [ ] Annual billing implementation in billing routes
- [ ] Metered API usage tracking
- [ ] Featured placement auction system
- [ ] A/B testing for pricing optimization

---

## 9. Risk & Mitigation

### Market Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|------------|
| Low conversion rate | Medium | High | 14-day free trial, freemium model, feature-limited free tier |
| Competitor price war | Low | Medium | Focus on unique value (multi-protocol, open source, lowest fees) |
| Crypto market downturn | Medium | Medium | Card payments via Stripe, stablecoin preference, USD pricing |
| Regulatory changes | Low | High | Legal counsel, compliance team, jurisdiction-aware billing |

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|------------|
| Stripe integration issues | Low | Medium | Comprehensive webhook testing, fallback to crypto payments |
| Subscription state inconsistency | Medium | Medium | KV + IndexedDB dual storage, periodic reconciliation |
| Payment fraud | Low | High | Stripe Radar, 3D Secure, manual review for large transactions |
| On-chain payment failures | Medium | Low | Retry logic, confirmation polling, user-friendly error messages |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|------------|
| Dependency on Stripe | Low | Medium | Crypto payment fallback, multiple processor support |
| Scaling support costs | Medium | Medium | Self-service docs, community support, AI chatbot |
| Creator churn | Medium | High | Annual discount lock-in, feature velocity, community building |

---

## Appendix A: Stripe Setup

### Required Environment Variables

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_CREATOR_MONTHLY=price_...
STRIPE_PRICE_CREATOR_YEARLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_YEARLY=price_...
```

### Stripe Dashboard Setup

1. Create products for each tier (Creator, Pro, Enterprise)
2. Create monthly and yearly prices for each product
3. Configure webhook endpoint: `POST /api/billing/webhook`
4. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

## Appendix B: Usage Tracking

Usage limits are tracked in KV under the `usage:` key prefix:

```
usage:coin:deploy:{wallet_address}      → integer (creator coins deployed)
usage:communities:{wallet_address}      → integer (communities created)
usage:posts:{wallet_address}            → integer (posts this month)
```

## Appendix C: Fee Calculation Examples

### Creator Coin Trade (Buy $100 worth)

```
Buy amount:           $100.00
Platform fee (0.5%):  $0.50
Creator receives:     $99.50 (in bonding curve tokens)
```

### Cross-Protocol Tip ($10 tip)

```
Tip amount:           $10.00
Platform fee (1%):    $0.10
Recipient receives:   $9.90
```

### Monthly Subscription (Creator plan, Annual)

```
Monthly price:                   $4.99/mo
Annual price:                    $49.99/yr
Stripe fee (2.9% + $0.30):      $1.75
Platform net:                    $48.24/yr ($4.02/mo)
Creator net:                     $0 (creator keeps subscriptions they collect)
```
