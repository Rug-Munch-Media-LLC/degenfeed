'use client';

import { useCallback, useState } from 'react';
import { PremiumPaymentModal } from '../../components/PremiumPaymentModal';
import {
  ComparisonTable,
  PricingCard,
  getDefaultTiers,
  type PricingTier,
} from '../../components/pricing/PricingTable';
import { type PremiumTier, TIERS, usePremium } from '../../hooks/usePremium';

/* ─── Free forever callout ───────────────────────────────────── */

function FreeForeverBanner() {
  return (
    <div className="rounded-2xl border border-degen-500/10 bg-gradient-to-r from-degen-500/[0.03] to-transparent p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-degen-500/10">
          <span className="text-base" aria-hidden="true">🎁</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--color-fg)]">
            Browsing DegenFeed Is Always Free
          </h3>
          <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed max-w-xl">
            Every feature marked Free below — browsing all protocols, joining communities, tipping
            across platforms, and creating your GoToSocial, Bluesky, Nostr, and RSS accounts —
            <strong> costs you nothing, forever.</strong> Premium unlocks creator tools and
            cross-protocol publishing power.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Token generation fee explainer ────────────────────────── */

function TokenGenerationFeeExplainer() {
  return (
    <div className="rounded-2xl border border-amber-500/10 bg-gradient-to-r from-amber-500/[0.03] to-transparent p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
          <span className="text-base" aria-hidden="true">🪙</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--color-fg)]">
            Creator Coin Token Generation Fee
          </h3>
          <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
            Pro plans get <strong>1 free creator coin</strong>. Each additional coin requires a
            one-time <strong>$20 fee</strong> that covers smart contract deployment gas on Base + Solana
            and platform infrastructure. Platinum and Enterprise subscribers get{' '}
            <strong>unlimited coins at no extra cost</strong>.
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-overlay)]">
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Plan
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Free Coins
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Additional Coins
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Limit
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            <tr>
              <td className="px-4 py-2.5 text-sm text-[var(--color-fg)]">Basic</td>
              <td className="px-4 py-2.5 text-center text-sm text-[var(--color-muted)]">—</td>
              <td className="px-4 py-2.5 text-center text-sm text-[var(--color-muted)]">—</td>
              <td className="px-4 py-2.5 text-center text-sm text-[var(--color-muted)]">0</td>
            </tr>
            <tr className="bg-degen-500/[0.02]">
              <td className="px-4 py-2.5 text-sm font-medium text-degen-400">Pro</td>
              <td className="px-4 py-2.5 text-center text-sm text-degen-400">1 included</td>
              <td className="px-4 py-2.5 text-center text-sm text-[var(--color-fg)]">$20 each</td>
              <td className="px-4 py-2.5 text-center text-sm text-[var(--color-muted)]">Unlimited</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 text-sm text-[var(--color-fg)]">Platinum</td>
              <td className="px-4 py-2.5 text-center text-sm text-degen-400" colSpan={2}>
                Unlimited — no additional fees
              </td>
              <td className="px-4 py-2.5 text-center text-sm text-[var(--color-muted)]">∞</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 text-sm text-[var(--color-fg)]">Enterprise</td>
              <td className="px-4 py-2.5 text-center text-sm text-degen-400" colSpan={2}>
                Unlimited — no additional fees
              </td>
              <td className="px-4 py-2.5 text-center text-sm text-[var(--color-muted)]">∞</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Enterprise contact section ────────────────────────────── */

function EnterpriseSection() {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-r from-degen-500/[0.02] to-transparent p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-degen-500/10 border border-degen-500/20 px-3 py-1 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-degen-400">
              Enterprise
            </span>
          </div>
          <h3 className="text-xl font-bold text-[var(--color-fg)]">
            Need something custom?
          </h3>
          <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed max-w-lg">
            Self-hosted, white-label, dedicated infrastructure, custom protocol integrations,
            team management, SSO/SAML, and SLA guarantees. We work with organizations of all sizes.
          </p>
          <ul className="mt-4 space-y-2">
            {[
              'Self-host option — run DegenFeed on your own infrastructure',
              'White-label — brand it as your own',
              'Custom protocol integrations — connect any network',
              'Dedicated infrastructure with SLA guarantee',
              'Team management with SSO / SAML',
              'Custom contract & pricing',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                <span className="mt-0.5 text-degen-400 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="shrink-0 w-full sm:w-64">
          <a
            href="mailto:biz@degenfeed.xyz"
            className="flex flex-col items-center justify-center rounded-xl border-2 border-degen-500/30 bg-degen-500/[0.04] px-6 py-6 text-center transition-all hover:bg-degen-500/[0.08] hover:border-degen-500/50 group"
          >
            <span className="text-2xl font-bold text-degen-400 group-hover:scale-105 transition-transform">
              Contact Us
            </span>
            <span className="mt-1 text-xs text-[var(--color-muted)]">
              biz@degenfeed.xyz
            </span>
            <span className="mt-3 text-[10px] text-[var(--color-muted)]">
              Usually responds within 24 hours
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─── FAQ ────────────────────────────────────────────────────── */

const FAQS = [
  {
    q: 'Can I use DegenFeed for free?',
    a: 'Absolutely. The Basic tier costs $0 forever and includes a verified badge, posting to 3 protocols, browsing all content, joining communities, free tipping, and a basic profile. No credit card required.',
  },
  {
    q: 'What does the Pro tier give me?',
    a: 'Pro ($10/mo) unlocks posting to all 12+ protocols, creator coins (1 free, $20 each additional), live streaming solo and spaces, basic analytics, scheduled posts, Feddy Community creation (up to 3), token-gated content, and a custom profile.',
  },
  {
    q: 'How is Platinum different from Pro?',
    a: 'Platinum ($25/mo) gives you everything in Pro plus UNLIMITED creator coins, multi-creator collab streams, an advanced analytics dashboard, cross-network posting to X/YouTube/Reddit, Buffer-style scheduling with queue and calendar, Telegram/Discord community integration, UNLIMITED Feddy Communities, custom community domain, priority support, API access, and early access to new protocols.',
  },
  {
    q: 'What is the $20 token generation fee?',
    a: 'Pro subscribers get 1 free creator coin deployment. Each additional coin costs a one-time $20 fee that covers smart contract deployment on Base and Solana (gas costs) plus platform infrastructure. Platinum and Enterprise get unlimited coins at no additional cost. This fee creates a quality gate and ensures coins are launched by serious creators.',
  },
  {
    q: 'Can I cancel my subscription?',
    a: 'Yes. Cancel anytime from Settings. Your premium features stay active until the end of the current billing period. No questions asked, no lock-in.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept ETH on Base, USDC on Base, and SOL on Solana. All payments are processed on-chain — no credit cards, no KYC. Connect your wallet, sign a transaction, and you\'re upgraded instantly.',
  },
  {
    q: 'How does the yearly billing discount work?',
    a: 'Yearly billing gives you 17% off the monthly rate. Pro is $100/year (vs $120/year monthly) and Platinum is $250/year (vs $300/year monthly). You save two months every year.',
  },
  {
    q: 'What if I only need one specific feature?',
    a: 'Some features are available à la carte — for example, custom Lens handles and ENS domains can be purchased as one-time add-ons without a subscription. However, protocol registration (Farcaster, Lens), creator coins, and advanced features require a Pro or higher subscription.',
  },
  {
    q: 'Is my data portable?',
    a: 'Yes. All paid features are open source and available in our self-hosted build. Enterprise tier includes GDPR-ready data export. Your identity on each protocol is always yours — we just help you manage it.',
  },
  {
    q: 'How do I contact Enterprise sales?',
    a: 'Email us at biz@degenfeed.xyz. We typically respond within 24 hours. Tell us about your use case and we\'ll put together a custom proposal including self-host, white-label, dedicated infrastructure, and SLA options.',
  },
];

/* ─── Testimonials ───────────────────────────────────────────── */

const TESTIMONIALS = [
  {
    name: 'CryptoNomad',
    handle: '@cryptonomad',
    tier: 'Pro',
    quote:
      'The cross-protocol scheduling alone is worth it. I post to Farcaster, Lens, and Bluesky at once. Analytics actually help me understand where my audience is.',
  },
  {
    name: 'DeFi_Degen',
    handle: '@defi_degen',
    tier: 'Platinum',
    quote:
      'Unlimited creator coins changed everything. I launched 3 community coins in one week. The collab streaming feature is incredible for cross-promotion with other creators.',
  },
  {
    name: 'NFTCollector',
    handle: '@nftcollector',
    tier: 'Platinum',
    quote:
      'The transparent pricing is what sold me. I know exactly what I\'m paying for — and unlimited coins with no per-token fee means I can experiment freely.',
  },
];

/* ─── Page ───────────────────────────────────────────────────── */

const TIER_ID_MAP: Record<string, PremiumTier> = {
  Basic: 'basic',
  Pro: 'pro',
  Platinum: 'platinum',
  Enterprise: 'enterprise',
};

export default function PremiumPage() {
  const { tier: currentTier, loading, refresh: refreshPremium } = usePremium();
  const [showModal, setShowModal] = useState(false);
  const [subscribeTier, setSubscribeTier] = useState<PremiumTier | null>(null);
  const [annualBilling, setAnnualBilling] = useState(false);

  const pricingTiers = getDefaultTiers();

  const handleSelect = useCallback((tierName: string) => {
    const mapped = TIER_ID_MAP[tierName];
    if (!mapped || mapped === 'basic') return;
    setSubscribeTier(mapped);
    setShowModal(true);
  }, []);

  const getCurrentPlanName = (): string => {
    if (loading) return 'Basic';
    const tier = TIERS.find((t) => t.id === currentTier);
    return tier?.displayName ?? 'Basic';
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12 animate-page-enter">
      {/* ── Hero ── */}
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-degen-500/10 border border-degen-500/20 px-4 py-1.5">
          <span className="text-sm" aria-hidden="true">🪄</span>
          <span className="text-xs font-medium text-degen-400">
            Transparent pricing. No hidden fees. No KYC.
          </span>
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-fg)] sm:text-4xl tracking-tight">
          Choose Your Plan
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--color-muted)] leading-relaxed">
          DegenFeed connects you to the decentralized social web — across protocols, blockchains,
          and communities. Every price is transparent. Every fee is pass-through.
          <strong className="text-[var(--color-fg)]"> Upgrade anytime.</strong>
        </p>
        {!loading && currentTier !== 'basic' && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-degen-500/15 px-4 py-1.5">
            <span className="text-degen-400 text-sm" aria-hidden="true">✓</span>
            <span className="text-sm font-medium text-[var(--color-fg)]">
              You&apos;re on the <span className="text-degen-400">{getCurrentPlanName()}</span> plan
            </span>
          </div>
        )}
      </div>

      {/* ── Billing toggle ── */}
      <div className="mb-8 flex items-center justify-center gap-3">
        <span className={`text-sm font-medium ${!annualBilling ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}>
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annualBilling}
          aria-label="Toggle yearly billing"
          onClick={() => setAnnualBilling(!annualBilling)}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            annualBilling ? 'bg-degen-500' : 'bg-[var(--color-muted)]/30'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              annualBilling ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        <span className={`text-sm font-medium ${annualBilling ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}>
          Yearly
          <span className="ml-1 rounded-full bg-degen-500/15 px-1.5 py-0.5 text-[10px] font-bold text-degen-400">
            Save 17%
          </span>
        </span>
      </div>

      {/* ── Free Forever Banner ── */}
      <div className="mb-8">
        <FreeForeverBanner />
      </div>

      {/* ── Four-Tier Grid ── */}
      <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {pricingTiers.map((tier) => (
          <PricingCard
            key={tier.name}
            tier={tier}
            isCurrent={getCurrentPlanName() === tier.name}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* ── Pricing summary callout ── */}
      <div className="mb-12 rounded-2xl border border-degen-500/10 bg-gradient-to-r from-degen-500/[0.03] to-transparent p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-[var(--color-fg)]">
              Everything included. Nothing hidden.
            </h3>
            <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
              Your subscription covers all platform features and priority support. The only extra
              costs are optional — additional creator coins ($20/ea on Pro, free on Platinum+) and
              custom on-chain handles — and those are <strong>pass-through fees</strong> at exactly
              what the blockchain charges us.
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3 text-center">
            <div className="text-lg font-bold text-degen-400">From $10</div>
            <div className="text-[10px] text-[var(--color-muted)]">/month · cancel anytime</div>
          </div>
        </div>
      </div>

      {/* ── Token Generation Fee Explainer ── */}
      <div className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Creator Coin Pricing</h2>
          <div className="flex-1 border-t border-[var(--color-border)]" />
        </div>
        <TokenGenerationFeeExplainer />
      </div>

      {/* ── Full Comparison Table ── */}
      <div className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Compare All Features</h2>
          <div className="flex-1 border-t border-[var(--color-border)]" />
        </div>
        <ComparisonTable />
      </div>

      {/* ── Enterprise Section ── */}
      <div className="mb-12">
        <EnterpriseSection />
      </div>

      {/* ── Profit Transparency ── */}
      <div className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--color-fg)]">How We Make Money</h2>
          <div className="flex-1 border-t border-[var(--color-border)]" />
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <p className="mb-4 text-xs text-[var(--color-muted)] leading-relaxed">
            We&apos;re transparent about our pricing. Here&apos;s exactly how we stay profitable while keeping
            things fair for you.
          </p>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-degen-500/20 text-[10px] text-degen-400 font-bold">$</span>
              <div>
                <span className="text-sm font-medium text-[var(--color-fg)]">Subscription revenue</span>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  Pro ($10/mo) and Platinum ($25/mo) subscriptions cover platform infrastructure,
                  development, and support. No hidden fees.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-degen-500/20 text-[10px] text-degen-400 font-bold">🪙</span>
              <div>
                <span className="text-sm font-medium text-[var(--color-fg)]">Token generation fees</span>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  $20 per additional creator coin on Pro tier. Covers smart contract deployment gas
                  and platform costs. Platinum and Enterprise get unlimited coins included.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-degen-500/20 text-[10px] text-degen-400 font-bold">⛽</span>
              <div>
                <span className="text-sm font-medium text-[var(--color-fg)]">Gas costs — pass-through</span>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  Blockchain transaction fees (gas) are passed through at exact network rates.
                  We don&apos;t mark up gas. Standard handles (9+ chars) always included.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-degen-500/20 text-[10px] text-degen-400 font-bold">🛡️</span>
              <div>
                <span className="text-sm font-medium text-[var(--color-fg)]">Gas spike protection</span>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  If gas exceeds our plan budget, we ask before proceeding. We{' '}
                  <strong>never</strong> lose money on a registration. Your approval is required
                  before any overage charge.
                </p>
              </div>
            </li>
          </ul>
          <div className="mt-4 rounded-lg bg-degen-500/[0.04] border border-degen-500/10 px-4 py-3">
            <p className="text-xs text-[var(--color-muted)] text-center">
              We never lose money on a registration. Every paid plan has a built-in gas budget and
              a guaranteed minimum profit. If gas spikes, you decide whether to proceed.
            </p>
          </div>
        </div>
      </div>

      {/* ── Testimonials ── */}
      <div className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--color-fg)]">What Creators Say</h2>
          <div className="flex-1 border-t border-[var(--color-border)]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
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
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Frequently Asked Questions</h2>
          <div className="flex-1 border-t border-[var(--color-border)]" />
        </div>
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

      {/* ── Footer ── */}
      <div className="text-center space-y-2">
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
        <p className="text-[10px] text-[var(--color-muted)]">
          * All on-chain fees (gas) are passed through at cost. We do not profit on protocol
          registration or domain setup fees. Prices may vary slightly due to network gas prices.
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
