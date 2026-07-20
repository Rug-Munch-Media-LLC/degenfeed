'use client';

/**
 * PricingTable — Three-tier feature comparison table
 *
 * Shows Free / Premium / Creator with checkmarks and highlights.
 * Fully responsive: horizontal scroll on mobile, full table on desktop.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PricingTier {
  name: string;
  price: string;
  priceYearly: string;
  features: { name: string; included: boolean; highlight?: boolean }[];
  cta: string;
  popular?: boolean;
  description: string;
  badge?: string;
}

// ─── Icons ─────────────────────────────────────────────────────────────────

function CheckIcon({ highlight }: { highlight?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${
        highlight ? 'text-degen-400' : 'text-degen-400/70'
      }`}
      aria-hidden="true"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function DashIcon() {
  return (
    <span className="inline-flex items-center justify-center shrink-0 text-[var(--color-muted)]/30" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </span>
  );
}

// ─── Tier Badge ────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: PricingTier }) {
  if (tier.name === 'Free') {
    return (
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1">
        <span className="text-xs font-semibold text-[var(--color-fg)]">{tier.name}</span>
      </div>
    );
  }

  const isPopular = tier.popular;
  return (
    <div
      className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
        isPopular
          ? 'bg-degen-500/15 border border-degen-500/30'
          : 'border border-[var(--color-border)] bg-[var(--color-card)]'
      }`}
    >
      <span
        className={`text-xs font-semibold ${
          isPopular ? 'text-degen-400' : 'text-[var(--color-fg)]'
        }`}
      >
        {tier.name}
      </span>
      {isPopular && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-degen-500">
          Best Value
        </span>
      )}
    </div>
  );
}

// ─── Pricing Card ──────────────────────────────────────────────────────────

function PricingCard({
  tier,
  isCurrent,
  onSelect,
}: {
  tier: PricingTier;
  isCurrent: boolean;
  onSelect: (name: string) => void;
}) {
  const isPopular = tier.popular;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-5 transition-all duration-300 ${
        isPopular
          ? 'border-degen-500/50 bg-gradient-to-b from-degen-500/[0.06] to-transparent shadow-[0_0_40px_-8px_rgba(0,255,65,0.15)] hover:shadow-[0_0_50px_-6px_rgba(0,255,65,0.25)]'
          : 'border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-border)]'
      }`}
    >
      {/* Popular badge */}
      {tier.badge && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-degen-500 px-3 py-0.5 text-[10px] font-bold text-black shadow-lg shadow-degen-500/25">
          {tier.badge}
        </div>
      )}

      <TierBadge tier={tier} />

      {/* Price */}
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className={`text-3xl font-bold tracking-tight ${
            isPopular ? 'text-degen-400' : 'text-[var(--color-fg)]'
          }`}
        >
          {tier.price}
        </span>
        {tier.price !== 'Free forever' && tier.price !== '$0' && (
          <span className="text-xs text-[var(--color-muted)]">/month</span>
        )}
      </div>
      {tier.price !== 'Free forever' && tier.price !== '$0' && (
        <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
          {tier.priceYearly}
        </p>
      )}
      <p className="mt-2 text-xs text-[var(--color-muted)] leading-relaxed">{tier.description}</p>

      {/* CTA */}
      <div className="mt-4 mb-5">
        {tier.name === 'Free' ? (
          <div
            className={`w-full rounded-xl py-2.5 text-center text-sm font-semibold ${
              isCurrent
                ? 'border border-degen-500/30 bg-degen-500/10 text-degen-400'
                : 'border border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-muted)]'
            }`}
          >
            {isCurrent ? '✓ Current Plan' : tier.cta}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(tier.name)}
            className={`w-full rounded-xl py-2.5 text-sm font-bold transition-all duration-200 ${
              isPopular
                ? 'bg-degen-500 text-black hover:bg-degen-400 hover:shadow-[0_0_24px_rgba(0,255,65,0.35)]'
                : 'border-2 border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-fg)] hover:border-degen-500/30'
            }`}
          >
            {tier.cta}
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="mb-4 border-t border-[var(--color-border)]" />

      {/* Features */}
      <ul className="flex-1 space-y-2.5">
        {tier.features.map((f) => (
          <li
            key={f.name}
            className={`flex items-start gap-2 text-sm ${
              f.included
                ? 'text-[var(--color-fg)]'
                : 'text-[var(--color-muted)]'
            } ${f.highlight ? 'font-medium' : ''}`}
          >
            {f.included ? (
              <CheckIcon highlight={f.highlight} />
            ) : (
              <DashIcon />
            )}
            <span className={!f.included ? 'line-through opacity-40' : ''}>
              {f.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Full Comparison Table ────────────────────────────────────────────────

interface ComparisonRow {
  category?: string;
  feature: string;
  free: boolean;
  premium: boolean;
  creator: boolean;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  { category: 'Browsing & Social', feature: 'Browse all feeds', free: true, premium: true, creator: true },
  { feature: 'Public likes, replies, reposts', free: true, premium: true, creator: true },
  { feature: 'Cross-protocol tipping', free: true, premium: true, creator: true },
  { feature: 'Join Feddy Communities', free: true, premium: true, creator: true },
  { feature: 'Comment everywhere', free: true, premium: true, creator: true },
  { feature: 'Tip widget embedding', free: true, premium: true, creator: true },
  { feature: 'Read-only creator coin access', free: true, premium: true, creator: true },
  { category: 'Identity & Accounts', feature: 'GoToSocial (Fediverse) account', free: true, premium: true, creator: true },
  { feature: 'AT Protocol / Bluesky account', free: true, premium: true, creator: true },
  { feature: 'Nostr keypair', free: true, premium: true, creator: true },
  { feature: 'RSS feed', free: true, premium: true, creator: true },
  { feature: 'Post to 3 protocols', free: true, premium: true, creator: true },
  { feature: 'Post to ALL 12 protocols', free: false, premium: true, creator: true },
  { feature: 'Create Feddy Communities', free: false, premium: true, creator: true },
  { feature: 'Custom Lens handle', free: false, premium: false, creator: false },
  { category: 'Creator Tools', feature: 'Launch Creator Coins (Base + Solana)', free: false, premium: true, creator: true },
  { feature: 'Customizable vesting schedules', free: false, premium: true, creator: true },
  { feature: 'Revenue sharing (multi-recipient)', free: false, premium: true, creator: true },
  { feature: 'PeerTube livestreaming', free: false, premium: true, creator: true },
  { feature: 'Community analytics', free: false, premium: true, creator: true },
  { feature: 'Scheduled posts', free: false, premium: true, creator: true },
  { feature: 'NFT gallery on profile', free: false, premium: true, creator: true },
  { feature: 'Ad-free experience', free: false, premium: true, creator: true },
  { feature: 'Priority support', free: false, premium: true, creator: true },
  { category: 'Creator Tier', feature: 'Custom community domain (degenfeed.xyz)', free: false, premium: false, creator: true },
  { feature: 'Advanced analytics dashboard', free: false, premium: false, creator: true },
  { feature: 'API access (bots/apps)', free: false, premium: false, creator: true },
  { feature: 'Multi-community creation (up to 10)', free: false, premium: false, creator: true },
  { feature: 'Custom branding on community page', free: false, premium: false, creator: true },
  { feature: 'Team management (moderators)', free: false, premium: false, creator: true },
  { feature: 'Data export (GDPR-ready)', free: false, premium: false, creator: true },
  { feature: 'Early access to new protocols', free: false, premium: false, creator: true },
];

function ComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
      <table className="w-full min-w-[500px] text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Feature
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-[var(--color-muted)]">
              Free
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-degen-400">
              Premium
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-[var(--color-muted)]">
              Creator
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row, i) => (
            <tr
              key={`${row.feature}-${i}`}
              className={`border-b border-[var(--color-border)] last:border-0 ${
                row.category ? 'bg-[var(--color-overlay)]' : ''
              }`}
            >
              {row.category ? (
                <td
                  colSpan={4}
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]"
                >
                  {row.category}
                </td>
              ) : (
                <>
                  <td className="px-4 py-2.5 text-sm text-[var(--color-fg)]">{row.feature}</td>
                  <td className="px-4 py-2.5 text-center">{row.free ? <CheckIcon /> : <DashIcon />}</td>
                  <td className="px-4 py-2.5 text-center">
                    {row.premium ? <CheckIcon highlight /> : <DashIcon />}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {row.creator ? <CheckIcon /> : <DashIcon />}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Exports ───────────────────────────────────────────────────────────────

export const getDefaultTiers = (): PricingTier[] => [
  {
    name: 'Free',
    price: '$0',
    priceYearly: 'Free forever',
    description: 'Browse everything, join communities, and tip across protocols.',
    features: [
      { name: 'Browse all protocols', included: true },
      { name: 'Post to 3 protocols', included: true },
      { name: 'Join Feddy Communities', included: true },
      { name: 'Comment, like, repost everywhere', included: true },
      { name: 'Cross-protocol tipping', included: true },
      { name: 'GoToSocial (Fediverse) account', included: true },
      { name: 'AT Protocol / Bluesky account', included: true },
      { name: 'Nostr keypair', included: true },
      { name: 'RSS feed', included: true },
      { name: 'Read-only creator coin access', included: true },
      { name: 'Tip widget embedding', included: true },
      { name: 'Post to all 12 protocols', included: false },
      { name: 'Creator coins & livestreaming', included: false },
      { name: 'Ad-free experience', included: false },
    ],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    name: 'Premium',
    price: '$10',
    priceYearly: '$100/year (save 17%)',
    description: 'Full cross-protocol power. Post everywhere, launch coins, livestream.',
    badge: 'MOST POPULAR',
    popular: true,
    features: [
      { name: 'Everything in Free', included: true },
      { name: 'Post to ALL 12 protocols', included: true, highlight: true },
      { name: 'Launch Creator Coins (Base + Solana)', included: true, highlight: true },
      { name: 'Create Feddy Communities', included: true, highlight: true },
      { name: 'Customizable vesting schedules', included: true },
      { name: 'Revenue sharing (multi-recipient)', included: true },
      { name: 'PeerTube livestreaming', included: true },
      { name: 'Community analytics', included: true },
      { name: 'Scheduled posts', included: true },
      { name: 'NFT gallery on profile', included: true },
      { name: 'Ad-free experience', included: true },
      { name: 'Priority support', included: true },
      { name: 'Custom community domain', included: false },
      { name: 'API access', included: false },
    ],
    cta: 'Upgrade to Premium',
  },
  {
    name: 'Creator',
    price: '$25',
    priceYearly: '$250/year (save 17%)',
    description: 'Build your brand. Custom domains, analytics, API access, and team tools.',
    features: [
      { name: 'Everything in Premium', included: true },
      { name: 'Custom community domain (degenfeed.xyz)', included: true, highlight: true },
      { name: 'Advanced analytics dashboard', included: true, highlight: true },
      { name: 'API access (bots & apps)', included: true },
      { name: 'Up to 10 communities', included: true },
      { name: 'Custom branding on community page', included: true },
      { name: 'Team management (add moderators)', included: true },
      { name: 'Data export (GDPR-ready)', included: true },
      { name: 'Early access to new protocols', included: true },
    ],
    cta: 'Go Creator',
    popular: false,
  },
];

export { PricingCard, ComparisonTable, type ComparisonRow };
