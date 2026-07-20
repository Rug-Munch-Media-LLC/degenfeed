'use client';

/**
 * PricingTable — Four-tier feature comparison table
 *
 * Shows Basic / Pro / Platinum / Enterprise with checkmarks and highlights.
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
  if (tier.name === 'Basic') {
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
        {tier.price !== 'Free forever' && tier.price !== '$0' && tier.price !== 'Custom' && (
          <span className="text-xs text-[var(--color-muted)]">/month</span>
        )}
      </div>
      {tier.price !== 'Free forever' && tier.price !== '$0' && tier.price !== 'Custom' && (
        <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
          {tier.priceYearly}
        </p>
      )}
      <p className="mt-2 text-xs text-[var(--color-muted)] leading-relaxed">{tier.description}</p>

      {/* CTA */}
      <div className="mt-4 mb-5">
        {tier.name === 'Basic' ? (
          <div
            className={`w-full rounded-xl py-2.5 text-center text-sm font-semibold ${
              isCurrent
                ? 'border border-degen-500/30 bg-degen-500/10 text-degen-400'
                : 'border border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-muted)]'
            }`}
          >
            {isCurrent ? '✓ Current Plan' : tier.cta}
          </div>
        ) : tier.name === 'Enterprise' ? (
          <a
            href="mailto:biz@degenfeed.xyz"
            className="block w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-card)] py-2.5 text-center text-sm font-bold text-[var(--color-fg)] transition-all duration-200 hover:border-degen-500/30"
          >
            {tier.cta}
          </a>
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
  basic: boolean;
  pro: boolean;
  platinum: boolean;
  enterprise: boolean;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    category: 'Core Features',
    feature: 'Verified badge',
    basic: true, pro: true, platinum: true, enterprise: true,
  },
  {
    feature: 'Browse all content & feeds',
    basic: true, pro: true, platinum: true, enterprise: true,
  },
  {
    feature: 'Join communities',
    basic: true, pro: true, platinum: true, enterprise: true,
  },
  {
    feature: 'Tip creators (free)',
    basic: true, pro: true, platinum: true, enterprise: true,
  },
  {
    feature: 'Basic profile',
    basic: true, pro: true, platinum: true, enterprise: true,
  },
  {
    category: 'Publishing',
    feature: 'Post to 3 protocols',
    basic: true, pro: true, platinum: true, enterprise: true,
  },
  {
    feature: 'Post to ALL 12+ protocols',
    basic: false, pro: true, platinum: true, enterprise: true,
  },
  {
    feature: 'Scheduled posts',
    basic: false, pro: true, platinum: true, enterprise: true,
  },
  {
    feature: 'Cross-network posting (X, YouTube, Reddit)',
    basic: false, pro: false, platinum: true, enterprise: true,
  },
  {
    feature: 'Buffer-style scheduling (queue, calendar)',
    basic: false, pro: false, platinum: true, enterprise: true,
  },
  {
    category: 'Monetization',
    feature: 'Creator coins',
    basic: false, pro: true, platinum: true, enterprise: true,
  },
  {
    feature: 'UNLIMITED creator coins',
    basic: false, pro: false, platinum: true, enterprise: true,
  },
  {
    category: 'Live Streaming',
    feature: 'Live streaming (solo, spaces)',
    basic: false, pro: true, platinum: true, enterprise: true,
  },
  {
    feature: 'Multi-creator collab streams',
    basic: false, pro: false, platinum: true, enterprise: true,
  },
  {
    category: 'Communities',
    feature: 'Create Feddy Communities',
    basic: false, pro: true, platinum: true, enterprise: true,
  },
  {
    feature: 'UNLIMITED Feddy Communities',
    basic: false, pro: false, platinum: true, enterprise: true,
  },
  {
    feature: 'Telegram/Discord integration',
    basic: false, pro: false, platinum: true, enterprise: true,
  },
  {
    feature: 'Custom community domain',
    basic: false, pro: false, platinum: true, enterprise: true,
  },
  {
    category: 'Analytics',
    feature: 'Basic analytics',
    basic: false, pro: true, platinum: true, enterprise: true,
  },
  {
    feature: 'Advanced analytics dashboard',
    basic: false, pro: false, platinum: true, enterprise: true,
  },
  {
    category: 'Profile & Content',
    feature: 'Custom profile',
    basic: false, pro: true, platinum: true, enterprise: true,
  },
  {
    feature: 'Token-gated content',
    basic: false, pro: true, platinum: true, enterprise: true,
  },
  {
    category: 'Support & Access',
    feature: 'Priority support',
    basic: false, pro: false, platinum: true, enterprise: true,
  },
  {
    feature: 'API access',
    basic: false, pro: false, platinum: true, enterprise: true,
  },
  {
    feature: 'Early protocol access',
    basic: false, pro: false, platinum: true, enterprise: true,
  },
  {
    category: 'Enterprise',
    feature: 'Self-host option',
    basic: false, pro: false, platinum: false, enterprise: true,
  },
  {
    feature: 'White-label',
    basic: false, pro: false, platinum: false, enterprise: true,
  },
  {
    feature: 'Custom protocol integrations',
    basic: false, pro: false, platinum: false, enterprise: true,
  },
  {
    feature: 'Dedicated infrastructure',
    basic: false, pro: false, platinum: false, enterprise: true,
  },
  {
    feature: 'SLA guarantee',
    basic: false, pro: false, platinum: false, enterprise: true,
  },
  {
    feature: 'Team management',
    basic: false, pro: false, platinum: false, enterprise: true,
  },
  {
    feature: 'SSO / SAML',
    basic: false, pro: false, platinum: false, enterprise: true,
  },
  {
    feature: 'Custom contract & pricing',
    basic: false, pro: false, platinum: false, enterprise: true,
  },
];

function ComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Feature
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-[var(--color-muted)]">
              Basic
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-degen-400">
              Pro
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-[var(--color-muted)]">
              Platinum
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-[var(--color-muted)]">
              Enterprise
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
                  colSpan={5}
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]"
                >
                  {row.category}
                </td>
              ) : (
                <>
                  <td className="px-4 py-2.5 text-sm text-[var(--color-fg)]">{row.feature}</td>
                  <td className="px-4 py-2.5 text-center">{row.basic ? <CheckIcon /> : <DashIcon />}</td>
                  <td className="px-4 py-2.5 text-center">
                    {row.pro ? <CheckIcon highlight /> : <DashIcon />}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {row.platinum ? <CheckIcon /> : <DashIcon />}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {row.enterprise ? <CheckIcon /> : <DashIcon />}
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
    name: 'Basic',
    price: '$0',
    priceYearly: 'Free forever',
    description: 'Browse everything, join communities, and tip across protocols.',
    features: [
      { name: 'Verified badge', included: true },
      { name: 'Browse all content', included: true },
      { name: 'Post to 3 protocols', included: true },
      { name: 'Join communities', included: true },
      { name: 'Tip creators (free)', included: true },
      { name: 'Basic profile', included: true },
      { name: 'Creator coins', included: false },
      { name: 'Live streaming', included: false },
      { name: 'Analytics', included: false },
    ],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$10',
    priceYearly: '$100/year (save 17%)',
    description: 'Full creator toolkit. Post everywhere, launch coins, livestream.',
    badge: 'MOST POPULAR',
    popular: true,
    features: [
      { name: 'Everything in Basic', included: true },
      { name: 'Post to ALL 12+ protocols', included: true, highlight: true },
      { name: 'Creator coins (1 free, $20/ea)', included: true, highlight: true },
      { name: 'Live streaming (solo, spaces)', included: true, highlight: true },
      { name: 'Basic analytics', included: true },
      { name: 'Scheduled posts', included: true },
      { name: 'Create Feddy Communities (3)', included: true },
      { name: 'Token-gated content', included: true },
      { name: 'Custom profile', included: true },
      { name: 'Advanced analytics', included: false },
      { name: 'API access', included: false },
    ],
    cta: 'Upgrade to Pro',
  },
  {
    name: 'Platinum',
    price: '$25',
    priceYearly: '$250/year (save 17%)',
    description: 'Power user. Unlimited coins, advanced analytics, cross-network scheduling.',
    features: [
      { name: 'Everything in Pro', included: true },
      { name: 'UNLIMITED creator coins', included: true, highlight: true },
      { name: 'Multi-creator collab streams', included: true, highlight: true },
      { name: 'Advanced analytics dashboard', included: true, highlight: true },
      { name: 'Cross-network posting (X, YouTube, Reddit)', included: true },
      { name: 'Buffer-style scheduling', included: true },
      { name: 'Telegram/Discord integration', included: true },
      { name: 'UNLIMITED communities', included: true },
      { name: 'Custom community domain', included: true },
      { name: 'Priority support', included: true },
      { name: 'API access', included: true },
    ],
    cta: 'Go Platinum',
    popular: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    priceYearly: 'Contact biz@degenfeed.xyz',
    description: 'Self-host, white-label, dedicated infrastructure for organizations.',
    features: [
      { name: 'Everything in Platinum', included: true },
      { name: 'Self-host option', included: true, highlight: true },
      { name: 'White-label', included: true, highlight: true },
      { name: 'Custom protocol integrations', included: true },
      { name: 'Dedicated infrastructure', included: true },
      { name: 'SLA guarantee', included: true },
      { name: 'Team management', included: true },
      { name: 'SSO / SAML', included: true },
    ],
    cta: 'Contact us',
    popular: false,
  },
];

export { PricingCard, ComparisonTable, type ComparisonRow };
