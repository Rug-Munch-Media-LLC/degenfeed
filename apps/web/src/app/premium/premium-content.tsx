'use client';

import { useCallback, useState } from 'react';
import { PremiumPaymentModal } from '../../components/PremiumPaymentModal';
import {
  ComparisonTable,
  PricingCard,
  getDefaultTiers,
  type PricingTier,
} from '../../components/pricing/PricingTable';
import { type PremiumTier, usePremium } from '../../hooks/usePremium';

/* === Free forever callback ===================================== */

function FreeForeverBanner() {
  return (
    <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-center text-sm text-green-400">
      <span className="font-semibold">✨ Free Forever:</span> Browse, read, search, and engage across
      all 15+ protocols. No account, no payment, no time limit.
    </div>
  );
}

/* === Pricing Page ============================================== */

export function PremiumContent() {
  const { tier, loading: statusLoading } = usePremium();
  const [showPayment, setShowPayment] = useState(false);

  const handleSubscribe = useCallback(
    async (_selectedTier: PremiumTier) => {
      setShowPayment(true);
    },
    [],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-[var(--color-fg)] sm:text-5xl">
          Premium Plans
        </h1>
        <p className="mx-auto max-w-2xl text-base text-[var(--color-muted)]">
          Start free. Upgrade when you need more. No hidden fees, no surprise charges — and{' '}
          <strong className="text-[var(--color-fg)]">never any platform fees on tips</strong>.
        </p>
      </div>

      {/* Free forever banner */}
      <div className="mb-12">
        <FreeForeverBanner />
      </div>

      {/* Pricing Cards */}
      <div className="mb-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {getDefaultTiers().map((t) => (
          <PricingCard
            key={t.name}
            tier={t}
            isCurrent={tier === t.name.toLowerCase()}
            onSelect={(name) => handleSubscribe(name as PremiumTier)}
          />
        ))}
      </div>

      {/* Comparison Table */}
      <div className="mb-16">
        <h2 className="mb-6 text-2xl font-bold text-[var(--color-fg)]">Detailed Comparison</h2>
        <ComparisonTable />
      </div>

      {/* FAQ */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-fg)]">
          Premium FAQ
        </h2>
        <dl className="space-y-4 text-sm text-[var(--color-muted)]">
          <div>
            <dt className="font-medium text-[var(--color-fg)]">Can I cancel anytime?</dt>
            <dd>Yes. Your plan stays active until the end of the billing period.</dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--color-fg)]">
              What payment methods are accepted?
            </dt>
            <dd>Credit/debit card, crypto (USDC, ETH, SOL), and Lightning Network.</dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--color-fg)]">
              Is there a free trial for paid plans?
            </dt>
            <dd>Yes — 14-day free trial on any paid plan. Cancel anytime.</dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--color-fg)]">
              Do you offer discounts for annual billing?
            </dt>
            <dd>
              Yes — save 20% with annual billing. That&apos;s $96/year for Premium ($8/mo) or
              $240/year for Creator ($20/mo).
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--color-fg)]">
              Can I switch between plans?
            </dt>
            <dd>
              Yes. Upgrade or downgrade anytime. Changes apply immediately; credits are prorated.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--color-fg)]">Is self-hosting free?</dt>
            <dd>
              Yes — the entire DegenFeed stack is open source (AGPL-3.0) and free to self-host.
              No license fees, no hidden costs.
            </dd>
          </div>
        </dl>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PremiumPaymentModal
          tier={tier ?? 'free'}
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}
