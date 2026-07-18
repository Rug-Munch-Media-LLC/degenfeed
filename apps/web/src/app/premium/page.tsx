'use client';

import { useCallback, useState } from 'react';
import { PremiumPaymentModal } from '../../components/PremiumPaymentModal';
import { usePremium, TIERS, type PremiumTier } from '../../hooks/usePremium';

/* ─── Feature comparison row ───────────────────────────────── */

function Check() {
  return <span className="text-degen-400 font-bold">✓</span>;
}

function Dash() {
  return <span className="text-[var(--color-muted)]/40">—</span>;
}

/* ─── Tier card ────────────────────────────────────────────── */

function TierCard({
  tier,
  isCurrent,
  onSubscribe,
}: {
  tier: (typeof TIERS)[number];
  isCurrent: boolean;
  onSubscribe: (tierId: PremiumTier) => void;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
        tier.popular
          ? 'border-degen-500/50 bg-gradient-to-b from-degen-500/10 to-transparent shadow-[0_0_30px_-6px_rgba(0,255,65,0.08)]'
          : 'border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-border)]'
      }`}
    >
      {tier.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-degen-500 px-4 py-0.5 text-xs font-bold text-black shadow-lg">
          {tier.badge}
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-lg font-bold text-[var(--color-fg)]">{tier.name}</h2>
        <div className="mt-2 flex items-baseline gap-2">
          {tier.firstMonthPrice ? (
            <>
              <span className="text-3xl font-bold text-degen-400">{tier.firstMonthPrice}</span>
              <span className="text-xs text-[var(--color-muted)]">first month</span>
            </>
          ) : (
            <span className="text-3xl font-bold text-degen-400">{tier.price}</span>
          )}
        </div>
        {tier.firstMonthPrice && (
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            then <span className="text-[var(--color-fg)] font-semibold">{tier.price}</span> after
          </p>
        )}
        <p className="mt-2 text-sm text-[var(--color-muted)]">{tier.description}</p>
      </div>

      {/* Features list */}
      <ul className="mb-6 flex-1 space-y-2.5">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-[var(--color-fg)]/80">
            <Check />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {tier.id === 'free' ? (
        <div className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] py-3 text-center text-sm font-semibold text-[var(--color-muted)] cursor-default">
          {isCurrent ? 'Current plan' : tier.cta}
        </div>
      ) : tier.id === 'enterprise' ? (
        <a
          href="mailto:premium@degenfeed.xyz"
          className="block w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-card)] py-3 text-center text-sm font-bold text-[var(--color-fg)] hover:border-degen-500/30 transition-colors"
        >
          {tier.cta}
        </a>
      ) : (
        <button
          type="button"
          onClick={() => onSubscribe(tier.id)}
          className={`w-full rounded-xl py-3 text-sm font-bold transition-all ${
            tier.popular
              ? 'bg-degen-500 text-black hover:bg-degen-400 hover:shadow-[0_0_20px_rgba(0,255,65,0.3)]'
              : 'border-2 border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-fg)] hover:border-degen-500/30'
          }`}
        >
          {tier.cta}
        </button>
      )}

      {/* First-month promo tooltip for Pro */}
      {tier.firstMonthPrice && (
        <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <p className="text-[11px] text-amber-400 leading-relaxed">
            💡 <strong>$10 first month</strong> covers the Farcaster ($5) registration fee + 30%
            platform fee. Standard <strong>{tier.price}</strong> after.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Feature comparison table ─────────────────────────────── */

const COMPARISON_ROWS: Array<{ feature: string; free: boolean; pro: boolean; creator: boolean }> = [
  { feature: 'Browse all feeds', free: true, pro: true, creator: true },
  { feature: 'Public likes & replies', free: true, pro: true, creator: true },
  { feature: 'Basic search', free: true, pro: true, creator: true },
  { feature: 'Wallet sign-in (ETH + SOL)', free: true, pro: true, creator: true },
  { feature: 'Basic tipping', free: true, pro: true, creator: true },
  { feature: 'Custom feeds', free: false, pro: true, creator: true },
  { feature: 'Custom feeds (unlimited)', free: false, pro: true, creator: true },
  { feature: 'Cross-platform registration', free: false, pro: true, creator: true },
  { feature: 'Analytics dashboard', free: false, pro: true, creator: true },
  { feature: 'Post scheduling', free: false, pro: true, creator: true },
  { feature: 'Bookmark sync', free: false, pro: true, creator: true },
  { feature: 'Priority support', free: false, pro: true, creator: true },
  { feature: 'Paywalled posts (x402)', free: false, pro: false, creator: true },
  { feature: 'Token-gated content', free: false, pro: false, creator: true },
  { feature: 'Custom domain', free: false, pro: false, creator: true },
  { feature: 'Verified creator badge', free: false, pro: false, creator: true },
  { feature: 'Early access', free: false, pro: false, creator: true },
];

function ComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Feature
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-[var(--color-muted)]">Free</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-degen-400">Pro</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-[var(--color-muted)]">Creator</th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row) => (
            <tr key={row.feature} className="border-b border-[var(--color-border)] last:border-0">
              <td className="px-4 py-2.5 text-sm text-[var(--color-fg)]">{row.feature}</td>
              <td className="px-4 py-2.5 text-center">{row.free ? <Check /> : <Dash />}</td>
              <td className="px-4 py-2.5 text-center">{row.pro ? <Check /> : <Dash />}</td>
              <td className="px-4 py-2.5 text-center">{row.creator ? <Check /> : <Dash />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────── */

export default function PremiumPage() {
  const { tier: currentTier, loading } = usePremium();
  const [showModal, setShowModal] = useState(false);
  const [subscribeTier, setSubscribeTier] = useState<PremiumTier | null>(null);

  const handleSubscribe = useCallback((tierId: PremiumTier) => {
    if (tierId === 'enterprise') {
      window.location.href = 'mailto:premium@degenfeed.xyz';
      return;
    }
    setSubscribeTier(tierId);
    setShowModal(true);
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12 animate-page-enter">
      {/* ── Header ── */}
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-degen-500/10 border border-degen-500/20 px-4 py-1.5">
          <span className="text-sm">⚡</span>
          <span className="text-xs font-medium text-degen-400">Powered by crypto — no fiat, no KYC</span>
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-fg)] sm:text-4xl tracking-tight">
          Support the open social graph
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--color-muted)]">
          Upgrade with ETH, USDC, or SOL. Your subscription directly funds development of the
          decentralized social web. Cancel anytime.
        </p>
        {!loading && currentTier !== 'free' && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-degen-500/15 px-4 py-1.5">
            <span className="text-degen-400 text-sm">✓</span>
            <span className="text-sm font-medium text-[var(--color-fg)]">
              You&apos;re on the <span className="text-degen-400">{currentTier}</span> plan
            </span>
          </div>
        )}
      </div>

      {/* ── Tiers Grid ── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-12">
        {TIERS.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            isCurrent={currentTier === tier.id}
            onSubscribe={handleSubscribe}
          />
        ))}
      </div>

      {/* ── First month breakdown ── */}
      <div className="mb-12 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-transparent p-5">
        <div className="flex items-start gap-3">
          <span className="text-xl mt-0.5">💡</span>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-fg)]">
              Why is the first month $10?
            </h3>
            <p className="mt-1 text-sm text-[var(--color-muted)] leading-relaxed">
              The first month of Pro includes the <strong>Farcaster on-chain registration fee ($5)</strong>{' '}
              plus the 30% platform fee (~$3). After that it drops to <strong>$5/month</strong> with no
              additional registration costs. You get a fully registered Farcaster account with your own
              on-chain identity.
            </p>
          </div>
        </div>
      </div>

      {/* ── Comparison Table ── */}
      <div className="mb-12">
        <h2 className="mb-4 text-lg font-bold text-[var(--color-fg)]">Compare plans</h2>
        <ComparisonTable />
      </div>

      {/* ── FAQ ── */}
      <div className="mb-12">
        <h2 className="mb-4 text-lg font-bold text-[var(--color-fg)]">Frequently asked</h2>
        <div className="space-y-3">
          {[
            {
              q: 'How do payments work?',
              a: 'Payments are processed on-chain via Base (ETH/USDC) or Solana. Connect your wallet, sign a transaction, and you are upgraded instantly. No credit cards, no KYC.',
            },
            {
              q: 'What does the first-month fee cover?',
              a: 'For Pro ($10 first month), $5 covers the Farcaster on-chain registration (your own Farcaster ID on OP Mainnet). The rest covers platform fees and your first month. After month 1, it is $5/mo with no additional registration costs.',
            },
            {
              q: 'Can I cancel anytime?',
              a: 'Yes. Cancel from your Settings page. Your subscription stays active until the current billing period ends. No questions asked.',
            },
            {
              q: 'Do I need premium to browse?',
              a: 'No. Browsing DegenFeed is free forever. Premium unlocks power-user and creator tools while directly funding open-source development of the decentralized social web.',
            },
            {
              q: 'What is x402 paywall?',
              a: 'x402 is an open protocol for HTTP 402 Payment Required. Creator-tier users can paywall individual posts — readers pay per-view in USDC. Learn more at x402.org.',
            },
          ].map((faq) => (
            <details
              key={faq.q}
              className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] transition-all open:border-degen-500/20"
            >
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-[var(--color-fg)] list-none">
                {faq.q}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="shrink-0 text-[var(--color-muted)] transition-transform group-open:rotate-180"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <div className="border-t border-[var(--color-border)] px-4 py-3">
                <p className="text-sm text-[var(--color-muted)] leading-relaxed">{faq.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* ── Footer note ── */}
      <div className="text-center">
        <p className="text-xs text-[var(--color-muted)]">
          All paid features are open source and available in our{' '}
          <a href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web" target="_blank" rel="noopener noreferrer" className="text-degen-400 hover:underline">
            self-hosted build
          </a>
          . No lock-in. Your data is always yours.
        </p>
      </div>

      {/* ── Payment Modal ── */}
      <PremiumPaymentModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setSubscribeTier(null);
        }}
        initialTier={subscribeTier ?? undefined}
      />
    </div>
  );
}
