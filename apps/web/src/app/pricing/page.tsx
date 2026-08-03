'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */

type BillingPeriod = 'monthly' | 'annual';
type Tier = 'free' | 'creator' | 'pro' | 'enterprise';

interface Feature {
  name: string;
  free: boolean | string;
  creator: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
  category?: string;
}

/* ─── Data ────────────────────────────────────────────────────── */

const TIERS = [
  {
    id: 'free' as Tier,
    name: 'Free',
    monthly: '$0',
    annual: '$0',
    desc: 'Browse everything. Connect 1 protocol. Start exploring.',
    gradient: 'from-gray-500/10 to-transparent',
  },
  {
    id: 'pro' as Tier,
    name: 'Pro',
    monthly: '$5',
    annual: '$4',
    badge: 'BEST VALUE',
    desc: 'All protocol identities, cross-network messaging, verified badge.',
    gradient: 'from-blue-500/[0.07] to-transparent',
  },
  {
    id: 'creator' as Tier,
    name: 'Creator',
    monthly: '$10',
    annual: '$8',
    desc: 'Creator coins, unlimited scheduling, newsletters, full analytics.',
    gradient: 'from-amber-500/[0.07] to-transparent',
    popular: true,
  },
  {
    id: 'enterprise' as Tier,
    name: 'Enterprise',
    monthly: '$20',
    annual: '$16',
    desc: 'Self-host, white-label, API access, team accounts, priority support.',
    gradient: 'from-purple-500/[0.07] to-transparent',
  },
] as const;

const FEATURES: Feature[] = [
  {
    category: 'Core',
    name: 'Browse all public feeds',
    free: true,
    pro: true,
    creator: true,
    enterprise: true,
  },
  { name: 'Connect 1 protocol identity', free: true, pro: true, creator: true, enterprise: true },
  {
    name: 'Connect ALL protocol identities',
    free: false,
    pro: true,
    creator: true,
    enterprise: true,
  },
  { name: 'Verified badge', free: false, pro: true, creator: true, enterprise: true },
  { name: '0% platform fees on tips', free: true, pro: true, creator: true, enterprise: true },
  {
    category: 'Publishing',
    name: 'Basic posts on 3 protocols',
    free: true,
    pro: true,
    creator: true,
    enterprise: true,
  },
  { name: 'Cross-post to 10 protocols', free: false, pro: true, creator: true, enterprise: true },
  { name: 'Cross-post to ALL protocols', free: false, pro: false, creator: true, enterprise: true },
  { name: '10 scheduled posts', free: true, pro: true, creator: true, enterprise: true },
  { name: '100 scheduled posts', free: false, pro: true, creator: true, enterprise: true },
  {
    name: 'Unlimited scheduling + Buffer calendar',
    free: false,
    pro: false,
    creator: true,
    enterprise: true,
  },
  { name: 'AI-optimized posting times', free: false, pro: false, creator: true, enterprise: true },
  {
    name: 'External platforms (LinkedIn, FB, X)',
    free: false,
    pro: false,
    creator: false,
    enterprise: true,
  },
  {
    category: 'Monetization',
    name: 'Creator coin creation',
    free: false,
    pro: false,
    creator: true,
    enterprise: true,
  },
  { name: 'Newsletter creation', free: false, pro: false, creator: true, enterprise: true },
  { name: 'Newsletter monetization', free: false, pro: false, creator: true, enterprise: true },
  { name: 'Revenue tracking', free: false, pro: false, creator: true, enterprise: true },
  {
    category: 'Messaging',
    name: 'Cross-network messaging (DMs)',
    free: false,
    pro: true,
    creator: true,
    enterprise: true,
  },
  {
    category: 'Analytics',
    name: 'Basic analytics',
    free: true,
    pro: true,
    creator: true,
    enterprise: true,
  },
  { name: 'Full analytics suite', free: false, pro: false, creator: true, enterprise: true },
  { name: 'Creator dashboard + revenue', free: false, pro: false, creator: true, enterprise: true },
  {
    name: 'White-label analytics reports',
    free: false,
    pro: false,
    creator: false,
    enterprise: true,
  },
  {
    category: 'Enterprise',
    name: 'Self-hosted creator page (custom domain)',
    free: false,
    pro: false,
    creator: false,
    enterprise: true,
  },
  { name: 'API access', free: false, pro: false, creator: false, enterprise: true },
  { name: 'Team accounts (up to 5)', free: false, pro: false, creator: false, enterprise: true },
  {
    name: 'Priority support (4h response)',
    free: false,
    pro: false,
    creator: false,
    enterprise: true,
  },
  {
    name: 'Early access to new features',
    free: false,
    pro: false,
    creator: false,
    enterprise: true,
  },
];

const FAQS = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Your plan stays active until the end of the billing period. No cancellation fees or penalties.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'Credit/debit cards, crypto (USDC, ETH, SOL), and Lightning Network payments.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes — 14-day free trial on any paid plan. Cancel during the trial at no cost.',
  },
  {
    q: 'Annual discount?',
    a: "Yes — save ~20% with annual billing. That's $48/year for Creator or $96/year for Pro.",
  },
  {
    q: 'Can I switch between plans?',
    a: 'Upgrade or downgrade anytime. Changes apply immediately with prorated credits.',
  },
  {
    q: 'Is self-hosting free?',
    a: 'The entire DegenFeed stack is open source (AGPL-3.0). The Enterprise plan includes managed self-host.',
  },
];

/* ─── Sub components ──────────────────────────────────────────── */

function CheckIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={filled ? 'text-degen-400' : 'text-degen-400/60'}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="text-[var(--color-muted)]/30"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ValueCell({ val, tier }: { val: boolean | string; tier: Tier }) {
  if (val === true) return <CheckIcon filled={tier === 'pro' || tier === 'enterprise'} />;
  if (val === false) return <DashIcon />;
  return (
    <span
      className={`text-[10px] font-semibold ${tier === 'pro' || tier === 'enterprise' ? 'text-degen-400' : 'text-[var(--color-muted)]'}`}
    >
      {val}
    </span>
  );
}

/* ─── Pricing Card ────────────────────────────────────────────── */

function PricingCard({ tier, billing }: { tier: (typeof TIERS)[0]; billing: BillingPeriod }) {
  const price = billing === 'monthly' ? tier.monthly : tier.annual;
  const isPopular = tier.popular;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 ${isPopular ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/[0.06] to-transparent shadow-[0_0_40px_-8px_rgba(245,158,11,0.12)] hover:shadow-[0_0_50px_-6px_rgba(245,158,11,0.2)]' : 'border-[var(--color-glass-border)] bg-[var(--color-card)] hover:border-amber-500/20'}`}
    >
      {tier.badge && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-0.5 text-[10px] font-bold text-black shadow-lg">
          {tier.badge}
        </div>
      )}

      <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
        {tier.name}
      </div>

      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={`text-4xl font-black tracking-tight ${isPopular ? 'text-amber-400' : 'text-[var(--color-fg)]'}`}
        >
          {price}
        </span>
        {tier.id !== 'free' && <span className="text-xs text-[var(--color-muted)]">/mo</span>}
        {tier.id === 'free' && (
          <span className="text-xs text-degen-400 ml-1 font-medium">Forever</span>
        )}
      </div>

      {billing === 'annual' && tier.id !== 'free' && (
        <div className="mt-1 flex items-center gap-1.5">
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
            Save ~20%
          </span>
          {tier.monthly !== tier.annual && (
            <span className="text-[10px] text-[var(--color-muted)] line-through">
              {tier.monthly}/mo
            </span>
          )}
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted)]">{tier.desc}</p>

      <div className="mt-5 mb-5">
        {tier.id === 'enterprise' ? (
          <a
            href="mailto:biz@degenfeed.xyz"
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[var(--color-glass-border)] bg-[var(--color-card)] py-2.5 text-sm font-bold text-[var(--color-fg)] transition-all hover:border-amber-500/30"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Contact Sales
          </a>
        ) : tier.id === 'free' ? (
          <Link
            href="/feed"
            className="flex w-full items-center justify-center rounded-xl border-2 border-[var(--color-glass-border)] bg-[var(--color-card)] py-2.5 text-sm font-bold text-[var(--color-fg)] transition-all hover:border-amber-500/30"
          >
            Get Started Free
          </Link>
        ) : (
          <button
            type="button"
            className={`w-full rounded-xl py-2.5 text-sm font-bold transition-all ${isPopular ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black hover:shadow-[0_0_24px_rgba(245,158,11,0.35)]' : 'border-2 border-[var(--color-glass-border)] bg-[var(--color-card)] text-[var(--color-fg)] hover:border-amber-500/30'}`}
          >
            Start Free Trial
          </button>
        )}
      </div>

      <div className="mb-4 border-t border-[var(--color-glass-border)]" />
      <ul className="flex-1 space-y-2.5">
        {FEATURES.filter((f) => !f.category)
          .slice(0, 5)
          .map((f) => {
            const val = f[tier.id];
            return (
              <li key={f.name} className="flex items-start gap-2 text-xs">
                {val ? <CheckIcon filled={isPopular} /> : <DashIcon />}
                <span
                  className={
                    val
                      ? 'text-[var(--color-fg)]'
                      : 'text-[var(--color-muted)] line-through opacity-40'
                  }
                >
                  {f.name}
                </span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

/* ─── Comparison Table ────────────────────────────────────────── */

function ComparisonTable({ billing }: { billing: BillingPeriod }) {
  const groups = useMemo(() => {
    const g: { category: string; features: Feature[] }[] = [];
    let current: Feature[] = [];
    let cat = '';
    for (const f of FEATURES) {
      if (f.category) {
        if (current.length && cat) g.push({ category: cat, features: current });
        cat = f.category;
        current = [];
      }
      current.push(f);
    }
    if (current.length && cat) g.push({ category: cat, features: current });
    return g;
  }, []);

  const tiers: Tier[] = ['free', 'pro', 'creator', 'enterprise'];

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-glass-border)]">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-[var(--color-glass-border)]">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Feature
            </th>
            {['Free', 'Pro', 'Creator', 'Enterprise'].map((l, i) => (
              <th
                key={l}
                className={`px-4 py-3 text-center text-xs font-semibold ${i === 2 ? 'text-degen-400' : 'text-[var(--color-muted)]'}`}
              >
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups
            .map((group) => (
              <tr key={group.category} className="bg-[var(--color-overlay)]">
                <td
                  colSpan={5}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]"
                >
                  {group.category}
                </td>
              </tr>
            ))
            .concat(
              groups.flatMap((group) =>
                group.features.map((f) => (
                  <tr
                    key={f.name}
                    className="border-b border-[var(--color-glass-border)] last:border-0"
                  >
                    <td className="px-4 py-2.5 text-xs text-[var(--color-fg)]">{f.name}</td>
                    {tiers.map((tier) => (
                      <td key={tier} className="px-4 py-2.5 text-center">
                        <ValueCell val={f[tier]} tier={tier} />
                      </td>
                    ))}
                  </tr>
                )),
              ),
            )}
        </tbody>
      </table>
    </div>
  );
}

/* ─── FAQ ─────────────────────────────────────────────────────── */

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="mx-auto max-w-2xl">
      <h2
        className="mb-6 text-center text-2xl font-bold text-[var(--color-fg)]"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        FAQ
      </h2>
      <div className="space-y-2">
        {FAQS.map((faq, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)]"
          >
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
              aria-expanded={open === i}
            >
              <span>{faq.q}</span>
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className={`shrink-0 text-[var(--color-muted)] transition-transform ${open === i ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {open === i && (
              <div className="border-t border-[var(--color-glass-border)] px-5 py-3.5">
                <p className="text-xs leading-relaxed text-[var(--color-muted)]">{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────── */

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingPeriod>('monthly');

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16 animate-page-enter">
      {/* Header */}
      <div className="mb-4 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[11px] font-semibold text-amber-400">
            Free forever — no credit card required
          </span>
        </div>
        <h1
          className="mb-4 text-5xl font-black tracking-tight sm:text-6xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          <span className="gradient-text-green">Simple pricing.</span>
          <br />
          <span className="text-[var(--color-fg)]">No hidden fees.</span>
        </h1>
        <p className="mx-auto max-w-xl text-base text-[var(--color-muted)]">
          Start free. Upgrade when you grow.{' '}
          <strong className="text-[var(--color-fg)]">Zero platform fees on tips</strong> — always.
        </p>
      </div>

      {/* Billing Toggle */}
      <div className="mb-10 flex items-center justify-center gap-3">
        <span
          className={`text-sm font-medium ${billing === 'monthly' ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}
        >
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={billing === 'annual'}
          onClick={() => setBilling((b) => (b === 'monthly' ? 'annual' : 'monthly'))}
          className="toggle-track"
        >
          <span className={`toggle-thumb ${billing === 'annual' ? 'translate-x-5' : ''}`} />
        </button>
        <span
          className={`text-sm font-medium ${billing === 'annual' ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}
        >
          Annual{' '}
          <span className="ml-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
            Save ~20%
          </span>
        </span>
      </div>

      {/* Pricing Cards */}
      <div className="mb-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => (
          <PricingCard key={tier.id} tier={tier} billing={billing} />
        ))}
      </div>

      {/* Comparison */}
      <div className="mb-16">
        <div className="mb-6 text-center">
          <h2
            className="text-2xl font-bold text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Compare Plans
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Everything you get, across every tier.
          </p>
        </div>
        <ComparisonTable billing={billing} />
      </div>

      {/* Followed Creators Notification */}
      <div className="mb-16 rounded-2xl border border-degen-500/20 bg-gradient-to-r from-degen-500/[0.04] via-transparent to-purple-500/[0.04] p-5 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-degen-500/15 text-degen-400">
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
          </span>
          <p className="text-sm text-[var(--color-muted)]">
            <strong className="text-[var(--color-fg)]">Your followed creators are live.</strong> Get
            notified when your favorite creators go live. Upgrade to Pro for notifications.
          </p>
          <Link href="/feed" className="btn-primary text-xs whitespace-nowrap">
            Browse Feed
          </Link>
        </div>
      </div>

      {/* FAQ */}
      <FAQSection />

      {/* Bottom CTA */}
      <div className="mt-16 text-center">
        <h2
          className="mb-3 text-2xl font-bold text-[var(--color-fg)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Still have questions?
        </h2>
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          We&apos;re here to help. Reach out anytime.
        </p>
        <a
          href="mailto:biz@degenfeed.xyz"
          className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--color-glass-border)] bg-[var(--color-card)] px-6 py-3 text-sm font-bold text-[var(--color-fg)] transition-all hover:border-amber-500/30"
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          Contact Sales
        </a>
      </div>
    </div>
  );
}
