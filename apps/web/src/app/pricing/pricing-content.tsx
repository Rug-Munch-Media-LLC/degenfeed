'use client';

/**
 * Pricing Page — Four-tier pricing with comparison, FAQ, and CTA.
 *
 * Tiers: Free → Creator ($4.99) → Pro ($9.99) → Enterprise ($29.99)
 *
 * Features:
 * - Pricing cards with yearly/monthly toggle
 * - Feature comparison table
 * - FAQ section
 * - Enterprise contact CTA
 * - Revenue stream explainers
 */

import { type SubscriptionTier, TIER_CONFIGS } from '@degenfeed/monetization';
import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { usePremium } from '../../hooks/usePremium';

const PremiumPaymentModal = dynamic(
  () =>
    import('../../components/PremiumPaymentModal').then((m) => ({
      default: m.PremiumPaymentModal,
    })),
  { ssr: false, loading: () => null },
);

// ─── Icons ───────────────────────────────────────────────────────────────

function CheckIcon({ highlight }: { highlight?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${highlight ? 'text-degen-400' : 'text-degen-400/70'}`}
      aria-hidden="true"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function DashIcon() {
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 text-[var(--color-muted)]/30"
      aria-hidden="true"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </span>
  );
}

// ─── Hero Section ────────────────────────────────────────────────────────

function PricingHero() {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="text-center mb-12">
      <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)] sm:text-5xl mb-4">
        Simple, Transparent Pricing
      </h1>
      <p className="mx-auto max-w-2xl text-base text-[var(--color-muted)] mb-8">
        Start free. Upgrade when you need more power.{' '}
        <strong className="text-[var(--color-fg)]">No platform fees on tips.</strong> 14-day free
        trial on all paid plans.
      </p>

      {/* Yearly / Monthly toggle */}
      <div className="inline-flex items-center gap-3 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] p-1">
        <button
          type="button"
          onClick={() => setYearly(false)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
            !yearly
              ? 'bg-degen-500 text-black'
              : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setYearly(true)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
            yearly
              ? 'bg-degen-500 text-black'
              : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
          }`}
        >
          Yearly
          <span className="ml-1.5 text-[10px] font-bold text-amber-400">Save ~17%</span>
        </button>
      </div>
    </div>
  );
}

// ─── Pricing Card ────────────────────────────────────────────────────────

function PricingCard({
  tier,
  isCurrent,
  yearly,
  onSelect,
}: {
  tier: (typeof TIER_CONFIGS)[0];
  isCurrent: boolean;
  yearly: boolean;
  onSelect: (tier: SubscriptionTier) => void;
}) {
  const displayPrice = yearly ? tier.priceYearly : tier.priceMonthly;
  const periodLabel = yearly ? '/year' : '/month';

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-5 transition-all duration-300 ${
        tier.popular
          ? 'border-degen-500/50 bg-gradient-to-b from-degen-500/[0.06] to-transparent shadow-[0_0_40px_-8px_rgba(0,255,65,0.15)]'
          : 'border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-border)]'
      }`}
    >
      {/* Badge */}
      {tier.badge && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-degen-500 px-3 py-0.5 text-[10px] font-bold text-black shadow-lg shadow-degen-500/25">
          {tier.badge}
        </div>
      )}

      {/* Tier name */}
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1 self-start">
        <span className="text-xs font-semibold text-[var(--color-fg)]">{tier.name}</span>
      </div>

      {/* Price */}
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className={`text-3xl font-bold tracking-tight ${tier.popular ? 'text-degen-400' : 'text-[var(--color-fg)]'}`}
        >
          {displayPrice}
        </span>
        {tier.priceCents > 0 && (
          <span className="text-xs text-[var(--color-muted)]">{periodLabel}</span>
        )}
      </div>
      {tier.priceCents > 0 && yearly && (
        <p className="mt-0.5 text-[11px] text-degen-400/70">
          {tier.priceMonthly}/mo billed annually
        </p>
      )}
      <p className="mt-2 text-xs text-[var(--color-muted)] leading-relaxed">{tier.description}</p>

      {/* CTA */}
      <div className="mt-4 mb-5">
        {tier.id === 'free' ? (
          <div
            className={`w-full rounded-xl py-2.5 text-center text-sm font-semibold ${
              isCurrent
                ? 'border border-degen-500/30 bg-degen-500/10 text-degen-400'
                : 'border border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-muted)]'
            }`}
          >
            {isCurrent ? '✓ Current Plan' : tier.cta}
          </div>
        ) : tier.id === 'enterprise' ? (
          <a
            href="mailto:biz@degenfeed.xyz"
            className="block w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-card)] py-2.5 text-center text-sm font-bold text-[var(--color-fg)] transition-all duration-200 hover:border-degen-500/30"
          >
            {tier.cta}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(tier.id)}
            className={`w-full rounded-xl py-2.5 text-sm font-bold transition-all duration-200 ${
              tier.popular
                ? 'bg-degen-500 text-black hover:bg-degen-400 hover:shadow-[0_0_24px_rgba(0,255,65,0.35)]'
                : 'border-2 border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-fg)] hover:border-degen-500/30'
            }`}
          >
            {tier.cta}
          </button>
        )}
      </div>

      <div className="mb-4 border-t border-[var(--color-border)]" />

      {/* Features */}
      <ul className="flex-1 space-y-2.5">
        {tier.features.map((f) => (
          <li
            key={f.key}
            className={`flex items-start gap-2 text-sm ${f.included ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]'} ${f.highlight ? 'font-medium' : ''}`}
          >
            {f.included ? <CheckIcon highlight={f.highlight} /> : <DashIcon />}
            <span className={!f.included ? 'line-through opacity-40' : ''}>{f.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────

function PricingFAQ() {
  const faqs = [
    {
      q: 'Can I cancel anytime?',
      a: 'Yes. Your plan stays active until the end of the billing period. No cancellation fees.',
    },
    {
      q: 'What payment methods are accepted?',
      a: 'Credit/debit card (Stripe), crypto (USDC, ETH, SOL), and Lightning Network.',
    },
    {
      q: 'Is there a free trial?',
      a: 'Yes — 14-day free trial on any paid plan. Cancel anytime during the trial at no cost.',
    },
    {
      q: 'Do you offer annual discounts?',
      a: 'Yes — save approximately 17% with annual billing. Creator: $49.99/yr ($4.17/mo). Pro: $99.99/yr ($8.33/mo). Enterprise: $299.99/yr ($25/mo).',
    },
    {
      q: 'Can I switch between plans?',
      a: 'Yes. Upgrade or downgrade anytime. Changes apply immediately; credits are prorated.',
    },
    {
      q: 'What are platform fees?',
      a: 'We charge 0.5% on creator coin trades and 1% on cross-protocol tips. No platform fees on subscriptions you collect from your audience.',
    },
    {
      q: 'Is self-hosting free?',
      a: 'The entire DegenFeed stack is open source (AGPL-3.0). Self-hosting is included with the Enterprise plan. DIY self-hosting is always free.',
    },
    {
      q: 'What is the Creator plan?',
      a: 'Designed for individual creators who want analytics, tipping, subscriptions, and up to 3 creator coins. Everything you need to grow and monetize.',
    },
  ];

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-6">
      <h2 className="mb-4 text-lg font-semibold text-[var(--color-fg)]">
        Frequently Asked Questions
      </h2>
      <dl className="space-y-4 text-sm text-[var(--color-muted)]">
        {faqs.map((faq) => (
          <div key={faq.q}>
            <dt className="font-medium text-[var(--color-fg)]">{faq.q}</dt>
            <dd>{faq.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Revenue Streams Explainer ───────────────────────────────────────────

function RevenueStreams() {
  const streams = [
    {
      icon: '💳',
      title: 'Subscriptions',
      description:
        'Recurring monthly/yearly revenue from Creator, Pro, and Enterprise plans. The foundation of our business model.',
      details: 'Creator $4.99/mo · Pro $9.99/mo · Enterprise $29.99/mo',
    },
    {
      icon: '🪙',
      title: 'Creator Coin Fees (0.5%)',
      description:
        'A 0.5% platform fee on every creator coin buy and sell transaction. As creator coins gain adoption, this becomes a significant revenue stream.',
      details: 'Collected on-chain at trade time via the bonding curve contract.',
    },
    {
      icon: '💸',
      title: 'Cross-Protocol Tipping Fee (1%)',
      description:
        'A 1% fee on tips sent across different protocols (e.g., tipping a Farcaster user from a Nostr wallet). Same-protocol tips remain free.',
      details: 'The lowest fee in the market. Competitors charge 5-10%.',
    },
    {
      icon: '🏢',
      title: 'Self-Hosting License',
      description:
        'Enterprise plan includes a self-hosting license. For organizations that need dedicated infrastructure, white-label branding, and custom domains.',
      details: 'Included in Enterprise ($29.99/mo). Custom pricing for large deployments.',
    },
    {
      icon: '🔌',
      title: 'API Access',
      description:
        'Pro and Enterprise plans include full API access. Future: metered API billing for high-volume developers.',
      details: 'Free tier: 10 req/min. Pro: 300 req/min. Enterprise: 3000 req/min.',
    },
    {
      icon: '📌',
      title: 'Featured Placement',
      description:
        'Promoted posts and featured placement in feeds. A non-intrusive advertising model that respects user experience.',
      details: '$50/mo per featured placement campaign.',
    },
  ];

  return (
    <div className="mb-16">
      <h2 className="mb-6 text-2xl font-bold text-[var(--color-fg)]">Revenue Streams</h2>
      <p className="text-sm text-[var(--color-muted)] mb-6">
        DegenFeed is built to be sustainable. We monetize through subscriptions and minimal platform
        fees — not by selling your data.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {streams.map((s) => (
          <div
            key={s.title}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
          >
            <div className="text-2xl mb-2">{s.icon}</div>
            <h3 className="text-sm font-bold text-[var(--color-fg)] mb-1">{s.title}</h3>
            <p className="text-xs text-[var(--color-muted)] leading-relaxed mb-2">
              {s.description}
            </p>
            <p className="text-[10px] text-degen-400/70 font-mono">{s.details}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Enterprise CTA ──────────────────────────────────────────────────────

function EnterpriseCTA() {
  return (
    <div className="rounded-2xl border border-degen-500/20 bg-gradient-to-r from-degen-500/[0.04] to-transparent p-8 text-center">
      <h2 className="text-2xl font-bold text-[var(--color-fg)] mb-2">Need something custom?</h2>
      <p className="text-sm text-[var(--color-muted)] mb-4 max-w-lg mx-auto">
        Enterprise plan too small? Self-hosting hundreds of thousands of users? We offer custom
        contracts, dedicated infrastructure, and white-glove onboarding.
      </p>
      <a
        href="mailto:biz@degenfeed.xyz?subject=Enterprise%20Inquiry"
        className="inline-flex items-center gap-2 rounded-xl bg-degen-500 px-6 py-3 text-sm font-bold text-black hover:bg-degen-400 transition-colors"
      >
        Contact Sales →
      </a>
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────

export function PricingPageContent() {
  const { tier: currentTier, loading } = usePremium();
  const [yearly, setYearly] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);

  const handleSubscribe = useCallback((tier: SubscriptionTier) => {
    setSelectedTier(tier);
    setShowPayment(true);
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-[var(--color-muted)]/20 rounded mx-auto" />
          <div className="h-4 w-96 bg-[var(--color-muted)]/20 rounded mx-auto" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mt-12">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-96 bg-[var(--color-muted)]/10 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      {/* Hero + Yearly toggle */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)] sm:text-5xl mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="mx-auto max-w-2xl text-base text-[var(--color-muted)] mb-8">
          Start free. Upgrade when you need more power.{' '}
          <strong className="text-[var(--color-fg)]">No platform fees on tips.</strong> 14-day free
          trial on all paid plans.
        </p>
        <div className="inline-flex items-center gap-3 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] p-1">
          <button
            type="button"
            onClick={() => setYearly(false)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              !yearly
                ? 'bg-degen-500 text-black'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setYearly(true)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              yearly
                ? 'bg-degen-500 text-black'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            Yearly
            <span className="ml-1.5 text-[10px] font-bold text-amber-400">Save ~17%</span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="mb-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {TIER_CONFIGS.map((t) => (
          <PricingCard
            key={t.id}
            tier={t}
            isCurrent={currentTier === t.id}
            yearly={yearly}
            onSelect={handleSubscribe}
          />
        ))}
      </div>

      {/* Revenue Streams */}
      <RevenueStreams />

      {/* FAQ */}
      <div className="mb-16">
        <PricingFAQ />
      </div>

      {/* Enterprise CTA */}
      <EnterpriseCTA />

      {/* Payment Modal */}
      {showPayment && selectedTier && (
        <PremiumPaymentModal
          open={showPayment}
          initialTier={selectedTier as any}
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}
