'use client';

import { useCallback, useState } from 'react';
import { PremiumPaymentModal } from '../../components/PremiumPaymentModal';
import {
  AddOnsSection,
} from '../../components/pricing/AddOnCard';
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

/* ─── Upfront costs explainer ───────────────────────────────── */

function UpfrontCostExplainer() {
  return (
    <div className="rounded-2xl border border-amber-500/10 bg-gradient-to-r from-amber-500/[0.03] to-transparent p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
          <span className="text-base" aria-hidden="true">⛽</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--color-fg)]">
            Here&apos;s What It Actually Costs to Register Your Identity
          </h3>
          <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
            Registering on protocols like Farcaster and Lens requires on-chain transaction fees
            (gas). We pass these costs through at exactly what they cost us — <strong>we don&apos;t
            profit on gas</strong>. Premium membership covers the initial Farcaster ($5) and Lens
            ($2) registration fees. After that, your subscription is just{' '}
            <strong>$10/month</strong> with no hidden costs.
          </p>
        </div>
      </div>

      {/* Cost breakdown table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-overlay)]">
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Service
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Cost
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Coverage
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            <CostRow service="GoToSocial (Fediverse)" cost="Free" coverage="✓ Included" highlight />
            <CostRow service="AT Protocol (Bluesky)" cost="Free" coverage="✓ Included" highlight />
            <CostRow service="Nostr" cost="Free" coverage="✓ Included" highlight />
            <CostRow service="RSS Feed" cost="Free" coverage="✓ Included" highlight />
            <CostRow service="Farcaster Registration" cost="$5 gas" coverage="Covered by Premium" />
            <CostRow service="Lens Protocol Registration" cost="$2 gas" coverage="Covered by Premium" />
            <CostRow service="Custom Lens Handle (9+ chars)" cost="Included" coverage="All plans" highlight />
            <CostRow service="Custom Lens Handle (7-8 chars)" cost="+$5–8 gas" coverage="Complete plan + add-on" />
            <CostRow service="Custom Lens Handle (5-6 chars)" cost="+$15–25 gas" coverage="À la carte add-on" />
            <CostRow service="Custom Lens Handle (3-4 chars)" cost="+$50–200 gas" coverage="À la carte add-on" />
            <CostRow service="Custom Farcaster Username" cost="$5 one-time" coverage="Optional add-on" />
            <CostRow service="ENS Domain" cost="$10 one-time" coverage="Optional add-on" />
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg bg-degen-500/[0.04] border border-degen-500/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-[var(--color-fg)]">Total upfront costs</span>
            <p className="text-xs text-[var(--color-muted)]">with Premium subscription</p>
          </div>
          <div className="text-right">
            <span className="text-xl font-bold text-degen-400">$0</span>
            <p className="text-[10px] text-[var(--color-muted)]">
              Premium is $10/month — Farcaster + Lens covered
            </p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-[var(--color-muted)] text-center">
        💡 You can also register these yourself directly on-chain if you prefer to manage your own keys.
      </p>
    </div>
  );
}

function CostRow({
  service,
  cost,
  coverage,
  highlight,
}: {
  service: string;
  cost: string;
  coverage: string;
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? 'bg-degen-500/[0.02]' : ''}>
      <td className="px-4 py-2.5 text-sm text-[var(--color-fg)]">{service}</td>
      <td className={`px-4 py-2.5 text-center text-sm font-semibold ${
        cost === 'Free' ? 'text-degen-400' : 'text-[var(--color-fg)]'
      }`}>
        {cost}
      </td>
      <td className={`px-4 py-2.5 text-center text-xs ${
        highlight ? 'text-degen-400' : 'text-[var(--color-muted)]'
      }`}>
        {coverage}
      </td>
    </tr>
  );
}

/* ─── Handle tier row ───────────────────────────────────────── */

function HandleTierRow({
  lengthLabel,
  price,
  color,
}: {
  lengthLabel: string;
  price: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
}) {
  const colorStyles = {
    green: 'border-degen-500/20 bg-degen-500/[0.03]',
    yellow: 'border-yellow-500/20 bg-yellow-500/[0.03]',
    orange: 'border-orange-500/20 bg-orange-500/[0.03]',
    red: 'border-red-500/20 bg-red-500/[0.03]',
  };
  const dotStyles = {
    green: 'bg-degen-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
  };
  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${colorStyles[color]}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotStyles[color]}`} />
        <span className="text-xs text-[var(--color-fg)]">{lengthLabel}</span>
      </div>
      <span className="text-xs font-semibold text-[var(--color-fg)]">{price}</span>
    </div>
  );
}

/* ─── FAQ ────────────────────────────────────────────────────── */

const FAQS = [
  {
    q: 'What does Premium actually cover?',
    a: 'Premium ($10/month) unlocks posting to all 12 supported protocols, creator coin launch, Feddy Community creation, PeerTube livestreaming, scheduled posts, community analytics, NFT gallery, ad-free browsing, and priority support. Your subscription also covers the Farcaster ($5) and Lens ($2) on-chain registration fees.',
  },
  {
    q: 'Why do some services have one-time fees?',
    a: 'One-time fees are pass-through costs for on-chain transactions — gas fees for registering a custom Lens handle on Polygon, a Farcaster username on Base, or an ENS domain on Ethereum. We charge exactly what the network charges. You can also register these yourself directly on-chain.',
  },
  {
    q: 'Can I cancel my subscription?',
    a: 'Yes. Cancel anytime from Settings. Your premium features stay active until the end of the current billing period. No questions asked, no lock-in.',
  },
  {
    q: 'Is browsing DegenFeed really free?',
    a: 'Absolutely. Browsing all protocols, joining communities, cross-protocol tipping, and creating your GoToSocial, Bluesky, Nostr, and RSS accounts cost $0. Free users can also post to 3 protocols of their choice.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept ETH on Base, USDC on Base, and SOL on Solana. All payments are processed on-chain — no credit cards, no KYC. Connect your wallet, sign a transaction, and you\'re upgraded instantly.',
  },
  {
    q: 'How does the yearly billing discount work?',
    a: 'Yearly billing gives you 17% off the monthly rate. Premium is $100/year (vs $120/year monthly) and Creator is $250/year (vs $300/year monthly). You save two months every year.',
  },
  {
    q: 'What if I only need one specific add-on?',
    a: 'Add-ons are available a la carte on any tier, including Free. If you want a custom Lens handle or ENS domain without subscribing to Premium, you can purchase just the add-on. However, protocol registration (Farcaster, Lens) requires a Premium subscription.',
  },
  {
    q: 'Is my data portable?',
    a: 'Yes. All paid features are open source and available in our self-hosted build. Creator tier includes GDPR-ready data export. Your identity on each protocol is always yours — we just help you manage it.',
  },
];

/* ─── Testimonials ───────────────────────────────────────────── */

const TESTIMONIALS = [
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
    tier: 'Premium',
    quote:
      'Posting to all 12 protocols from one place changed my workflow. The creator coins let me monetize directly — no middleman, no platform risk.',
  },
  {
    name: 'NFTCollector',
    handle: '@nftcollector',
    tier: 'Creator',
    quote:
      'The transparent pricing is what sold me. I know exactly what I\'m paying for — gas fees, DNS, nothing hidden. And my community domain looks professional.',
  },
];

/* ─── Page ───────────────────────────────────────────────────── */

const TIER_ID_MAP: Record<string, PremiumTier> = {
  Free: 'free',
  Premium: 'pro',
  Creator: 'creator',
};

export default function PremiumPage() {
  const { tier: currentTier, loading, refresh: refreshPremium } = usePremium();
  const [showModal, setShowModal] = useState(false);
  const [subscribeTier, setSubscribeTier] = useState<PremiumTier | null>(null);
  const [annualBilling, setAnnualBilling] = useState(false);

  const pricingTiers = getDefaultTiers();

  const handleSelect = useCallback((tierName: string) => {
    const mapped = TIER_ID_MAP[tierName];
    if (!mapped || mapped === 'free') return;
    setSubscribeTier(mapped);
    setShowModal(true);
  }, []);

  const getCurrentPlanName = (): string => {
    if (loading) return 'Free';
    const tier = TIERS.find((t) => t.id === currentTier);
    return tier?.displayName ?? 'Free';
  };

  const priceDisplay = annualBilling ? 'yearly' : 'monthly';

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
          Own Your Social Network
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--color-muted)] leading-relaxed">
          DegenFeed connects you to the decentralized social web — across protocols, blockchains,
          and communities. Every price is transparent. Every fee is pass-through.
          <strong className="text-[var(--color-fg)]"> You own your identity.</strong>
        </p>
        {!loading && currentTier !== 'free' && (
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

      {/* ── Three-Tier Grid ── */}
      <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {pricingTiers.map((tier) => (
          <PricingCard
            key={tier.name}
            tier={tier}
            isCurrent={getCurrentPlanName() === tier.name}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* ── Pricing callout ── */}
      <div className="mb-12 rounded-2xl border border-degen-500/10 bg-gradient-to-r from-degen-500/[0.03] to-transparent p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-[var(--color-fg)]">
              Everything included. Nothing hidden.
            </h3>
            <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
              Your Premium subscription covers protocol registration, platform features, and
              priority support. The only extra costs are optional — custom handles, extra domains,
              and additional creator coins — and those are <strong>pass-through fees</strong> at
              exactly what the blockchain charges us.
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-degen-400">$10</div>
            <div className="text-[10px] text-[var(--color-muted)]">/month · everything included</div>
          </div>
        </div>
      </div>

      {/* ── What&apos;s Included — Full Comparison Table ── */}
      <div className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--color-fg)]">What&apos;s Included</h2>
          <div className="flex-1 border-t border-[var(--color-border)]" />
        </div>
        <ComparisonTable />
      </div>

      {/* ── Upfront Costs Explainer ── */}
      <div className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Upfront Costs Explained</h2>
          <div className="flex-1 border-t border-[var(--color-border)]" />
        </div>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          Here&apos;s exactly what it costs us to register your identity on each protocol. We pass
          these on at cost — <strong>zero markup on gas fees</strong>.
        </p>
        <UpfrontCostExplainer />
      </div>

      {/* ── Lens Handle Cost Estimator ── */}
      <div className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Custom Lens Handle Pricing</h2>
          <div className="flex-1 border-t border-[var(--color-border)]" />
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <p className="mb-4 text-xs text-[var(--color-muted)]">
            Lens handles are priced by length — shorter handles cost more gas on Polygon.
            Type your desired handle below to see the cost. We pass through the exact gas cost.
          </p>

          <div className="mb-5 flex items-center gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
            <span className="text-sm font-medium text-[var(--color-muted)]">@</span>
            <input
              type="text"
              placeholder="yourname"
              className="flex-1 bg-transparent text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none"
              maxLength={20}
              id="handle-estimator-input"
            />
            <span className="text-sm font-medium text-[var(--color-muted)]">.lens</span>
          </div>

          <div className="space-y-2">
            <HandleTierRow lengthLabel="9+ characters" price="Included free" color="green" />
            <HandleTierRow lengthLabel="7–8 characters" price="+$5–8 gas" color="yellow" />
            <HandleTierRow lengthLabel="5–6 characters" price="+$15–25 gas" color="orange" />
            <HandleTierRow lengthLabel="3–4 characters" price="+$50–200 gas" color="red" />
          </div>

          <p className="mt-4 text-[11px] text-[var(--color-muted)] leading-relaxed">
            These are Polygon gas costs for Lens profile creation.{' '}
            <strong>We don&apos;t mark these up</strong> — you pay what the blockchain charges.
            Standard handles (9+ chars) are always included free in all registration plans.
            Premium subscribers get all handle lengths covered.
          </p>
        </div>
      </div>

      {/* ── Add-Ons Section ── */}
      <div className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Optional Add-Ons</h2>
          <div className="flex-1 border-t border-[var(--color-border)]" />
        </div>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          One-time purchases for custom handles, extra domains, and additional coins.
          Available on any tier. <strong>We pass through the exact gas cost.</strong>
        </p>
        <AddOnsSection />
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
