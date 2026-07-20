'use client';

import { useCallback, useState } from 'react';
import { PremiumPaymentModal } from '../../components/PremiumPaymentModal';
import { type PremiumTier, TIERS, usePremium } from '../../hooks/usePremium';

/* ─── Feature comparison helpers ───────────────────────────── */

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
  const isPro = tier.popular;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 ${
        isPro
          ? 'border-degen-500/60 bg-gradient-to-b from-degen-500/10 to-transparent shadow-[0_0_40px_-8px_rgba(0,255,65,0.18)] hover:shadow-[0_0_50px_-6px_rgba(0,255,65,0.28)]'
          : 'border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-border)]'
      }`}
    >
      {/* RECOMMENDED badge */}
      {tier.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-degen-500 px-4 py-0.5 text-xs font-bold text-black shadow-lg shadow-degen-500/30">
          {tier.badge}
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[var(--color-fg)]">{tier.name}</h2>
        <div className="mt-2 flex items-baseline gap-2">
          {tier.firstMonthPrice ? (
            <>
              <span className="text-3xl font-bold text-degen-400">{tier.firstMonthPrice}</span>
              <span className="text-xs text-[var(--color-muted)]">first month</span>
            </>
          ) : (
            <span className="text-3xl font-bold text-[var(--color-fg)]">{tier.price}</span>
          )}
        </div>
        {tier.firstMonthPrice && (
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            then <span className="text-[var(--color-fg)] font-semibold">{tier.price}</span>
          </p>
        )}
        <p className="mt-2 text-sm text-[var(--color-muted)]">{tier.description}</p>
      </div>

      {/* Features */}
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
          className={`w-full rounded-xl py-3 text-sm font-bold transition-all duration-200 ${
            isPro
              ? 'bg-degen-500 text-black hover:bg-degen-400 hover:shadow-[0_0_24px_rgba(0,255,65,0.35)]'
              : 'border-2 border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-fg)] hover:border-degen-500/30'
          }`}
        >
          Subscribe
        </button>
      )}

      {/* First-month promo tooltip for Pro */}
      {tier.firstMonthPrice && (
        <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <p className="text-[11px] text-amber-400 leading-relaxed">
            <strong>$10/month</strong> covers the Farcaster ($5) registration fee + all platform features. No hidden costs.
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
  { feature: 'Unlimited custom feeds', free: false, pro: true, creator: true },
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
            <th className="px-4 py-3 text-center text-xs font-medium text-[var(--color-muted)]">
              Free
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-degen-400">Pro</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-[var(--color-muted)]">
              Creator
            </th>
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

/* ─── FAQ data ─────────────────────────────────────────────── */

const FAQS = [
  {
    q: 'How do payments work?',
    a: 'Payments are processed on-chain via Base (ETH/USDC) or Solana. Connect your wallet, sign a transaction, and you are upgraded instantly. No credit cards, no KYC.',
  },
  {
    q: 'What does the first-month fee cover?',
    a: 'For Pro ($10/mo), the price covers Farcaster on-chain registration (your own Farcaster ID on OP Mainnet), Fediverse hosting, and platform fees. No hidden costs.',
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
];

/* ─── Page ─────────────────────────────────────────────────── */

export default function PremiumPage() {
  const { tier: currentTier, loading, refresh: refreshPremium } = usePremium();
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
      <div className="mb-10 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-degen-500/10 border border-degen-500/20 px-4 py-1.5">
          <span className="text-sm">⚡</span>
          <span className="text-xs font-medium text-degen-400">
            Powered by crypto — no fiat, no KYC
          </span>
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-fg)] sm:text-4xl tracking-tight">
          Choose Your Plan
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

      {/* ── 4-Tier Grid ── */}
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
              The first month of Pro includes the{' '}
              <strong>Farcaster on-chain registration fee ($5)</strong> plus the 30% platform fee
              (~$3). After that, <strong>$10/month</strong> with no additional
              registration costs. You get a fully registered Farcaster account with your own
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

      {/* ── Subscriber Badge Preview ── */}
      <div className="mb-12 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Your Badge Preview</h2>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          Your subscriber badge shows next to your name across the platform.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/50 px-4 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-degen-500/20 text-xs font-bold text-degen-400">
              D
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-[var(--color-fg)]">degen_user</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-degen-500/15 px-2 py-0.5 text-[9px] font-medium text-degen-400">
                  ★ Fan
                </span>
              </div>
              <span className="text-[10px] text-[var(--color-muted)]">ethereum</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/50 px-4 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-400">
              D
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-[var(--color-fg)]">creator_name</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[9px] font-medium text-purple-400">
                  ★★ Supporter
                </span>
              </div>
              <span className="text-[10px] text-[var(--color-muted)]">farcaster</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/50 px-4 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">
              D
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-[var(--color-fg)]">whale_trader</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-medium text-amber-400">
                  ★★★ Patron
                </span>
              </div>
              <span className="text-[10px] text-[var(--color-muted)]">solana</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Testimonials ── */}
      <div className="mb-12">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">What creators say</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              name: 'CryptoNomad',
              handle: '@cryptonomad',
              tier: 'Creator',
              quote:
                'The cross-protocol scheduling alone is worth it. I post to Farcaster, Lens, and Bluesky at once. Analytics actually help me understand where my audience is.',
            },
            {
              name: 'DeFi_Degen',
              handle: '@defi_degen',
              tier: 'Pro',
              quote:
                'Unlimited custom feeds changed how I track alpha. No more jumping between apps. The x402 paywall also lets me monetize my deep dives.',
            },
            {
              name: 'NFTCollector',
              handle: '@nftcollector',
              tier: 'Creator',
              quote:
                "Token-gated content is exactly what I needed for my exclusive drops. My subscribers get early mint access and it's all on-chain.",
            },
          ].map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-all hover:border-degen-500/20"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-degen-500/20 text-xs font-bold text-degen-400">
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--color-fg)]">{t.name}</p>
                  <p className="text-[10px] text-[var(--color-muted)]">{t.handle}</p>
                </div>
                <span className="ml-auto rounded-full bg-degen-500/10 px-2 py-0.5 text-[9px] font-medium text-degen-400">
                  {t.tier}
                </span>
              </div>
              <p className="flex-1 text-xs leading-relaxed text-[var(--color-muted)]">
                &ldquo;{t.quote}&rdquo;
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="mb-12">
        <h2 className="mb-4 text-lg font-bold text-[var(--color-fg)]">Frequently asked</h2>
        <div className="space-y-3">
          {FAQS.map((faq) => (
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
                  className="shrink-0 text-[var(--color-muted)] transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
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
          <a
            href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
            target="_blank"
            rel="noopener noreferrer"
            className="text-degen-400 hover:underline"
          >
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
          refreshPremium();
        }}
        onSuccess={refreshPremium}
        initialTier={subscribeTier ?? undefined}
      />
    </div>
  );
}
