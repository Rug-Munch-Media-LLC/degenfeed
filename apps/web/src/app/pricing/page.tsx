'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */

type BillingPeriod = 'monthly' | 'annual';
type Tier = 'free' | 'pro' | 'creatorPlus';

interface TierCard {
  id: Tier;
  name: string;
  price: number; // monthly price in USD
  desc: string;
  badge?: string;
  gradient: string;
  popular?: boolean;
  cta: string;
  href: string;
}

interface Feature {
  name: string;
  free: boolean | string;
  pro: boolean | string;
  creatorPlus: boolean | string;
  category?: string;
}

interface ChecklistItem {
  name: string;
  free: boolean;
  pro: boolean;
  creatorPlus: boolean;
}

/* ─── Pricing helpers ────────────────────────────────────────── */

const MONTHS_PER_YEAR = 12;
const FREE_MONTHS = 2; // annual billing = 2 months free

/** format a USD price, stripping trailing zeros: 9.99 → "$9.99", 8.33 → "$8.33", 0 → "$0" */
function fmtPrice(n: number): string {
  if (n === 0) return '$0';
  return `$${n.toFixed(2).replace(/\.?0+$/, '')}`;
}

function annualTotal(monthly: number): number {
  return Math.round(monthly * (MONTHS_PER_YEAR - FREE_MONTHS) * 100) / 100;
}

function annualPerMonth(monthly: number): number {
  return annualTotal(monthly) / MONTHS_PER_YEAR;
}

/* ─── Data ────────────────────────────────────────────────────── */

const TIERS: TierCard[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    desc: 'Everything you need to start streaming and browsing the unified feed.',
    gradient: 'from-gray-500/10 to-transparent',
    cta: 'Start Free',
    href: '/feed',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    badge: 'BEST VALUE',
    desc: 'Unlimited destinations, AI auto-clips, and full analytics for serious streamers.',
    gradient: 'from-degen-500/[0.08] to-transparent',
    cta: 'Go Pro',
    href: '/premium',
  },
  {
    id: 'creatorPlus',
    name: 'Creator+',
    price: 24.99,
    desc: 'The web3 premium tier: token-gated streams, cross-chain tips, and full ownership.',
    gradient: 'from-amber-500/[0.08] to-transparent',
    popular: true,
    cta: 'Become a Creator+',
    href: '/premium',
  },
] as const;

const FEATURES: Feature[] = [
  {
    category: 'Live Streaming',
    name: 'Unified feed (all protocols)',
    free: true,
    pro: true,
    creatorPlus: true,
  },
  { name: 'Live destinations', free: '2-3', pro: 'Unlimited', creatorPlus: 'Unlimited' },
  { name: 'Vertical 9:16 dual output', free: true, pro: true, creatorPlus: true },
  { name: 'Live chat aggregation', free: true, pro: true, creatorPlus: true },
  { name: 'Custom overlays & branding', free: false, pro: true, creatorPlus: true },
  { name: 'No watermark', free: false, pro: true, creatorPlus: true },
  {
    name: 'Private / encrypted streams',
    free: false,
    pro: false,
    creatorPlus: true,
  },
  {
    category: 'Archive & AI',
    name: 'VOD archive',
    free: '30 days',
    pro: '90 days',
    creatorPlus: 'Unlimited',
  },
  { name: 'AI auto-clips (vertical, captioned)', free: false, pro: true, creatorPlus: true },
  { name: 'Auto-post clips to TikTok/Reels/Shorts', free: false, pro: true, creatorPlus: true },
  {
    category: 'Monetization',
    name: '0% platform fees on tips',
    free: true,
    pro: true,
    creatorPlus: true,
  },
  { name: 'Token / NFT-gated streams', free: false, pro: false, creatorPlus: true },
  { name: 'Cross-chain tipping (zaps, USDC, MATIC)', free: false, pro: false, creatorPlus: true },
  { name: 'Theta NFT-DRM ticketed events (PPV)', free: false, pro: false, creatorPlus: true },
  {
    category: 'Analytics',
    name: 'Basic analytics',
    free: true,
    pro: true,
    creatorPlus: true,
  },
  {
    name: 'Stream analytics (viewers, per-dest, engagement)',
    free: false,
    pro: true,
    creatorPlus: true,
  },
  { name: 'Revenue tracking', free: false, pro: true, creatorPlus: true },
  {
    category: 'Distribution',
    name: 'Browse all protocols',
    free: true,
    pro: true,
    creatorPlus: true,
  },
  { name: 'Federated posts (ActivityPub)', free: true, pro: true, creatorPlus: true },
  { name: 'Farcaster Frames live embed', free: false, pro: false, creatorPlus: true },
  { name: 'Nostr NIP-53 live listing', free: false, pro: false, creatorPlus: true },
  {
    category: 'Newsletter & Domain',
    name: 'Headless Ghost newsletter',
    free: false,
    pro: false,
    creatorPlus: true,
  },
  { name: 'Custom domain', free: false, pro: false, creatorPlus: true },
  {
    category: 'News & Signals',
    name: 'Basic news coverage',
    free: true,
    pro: true,
    creatorPlus: true,
  },
  { name: 'WIF signal coverage', free: true, pro: true, creatorPlus: true },
  {
    category: 'Team & Support',
    name: 'Team seats',
    free: '1',
    pro: '1',
    creatorPlus: '3',
  },
  { name: 'Priority support', free: false, pro: true, creatorPlus: true },
  { name: 'API / webhook access', free: false, pro: false, creatorPlus: true },
];

/** Short checklist rendered inside each pricing card (✓ / ✗) */
const CARD_CHECKLIST: ChecklistItem[] = [
  { name: 'Unified feed (all protocols)', free: true, pro: true, creatorPlus: true },
  { name: '2-3 live destinations', free: true, pro: true, creatorPlus: true },
  { name: 'Unlimited live destinations', free: false, pro: true, creatorPlus: true },
  { name: 'AI auto-clips', free: false, pro: true, creatorPlus: true },
  { name: 'Stream analytics dashboard', free: false, pro: true, creatorPlus: true },
  { name: 'No watermark + custom overlays', free: false, pro: true, creatorPlus: true },
  { name: '90-day VOD archive', free: false, pro: true, creatorPlus: true },
  { name: 'Token / NFT-gated streams', free: false, pro: false, creatorPlus: true },
  { name: 'Cross-chain tipping', free: false, pro: false, creatorPlus: true },
  { name: 'Private streams', free: false, pro: false, creatorPlus: true },
  { name: 'Headless Ghost newsletter', free: false, pro: false, creatorPlus: true },
  { name: 'Custom domain', free: false, pro: false, creatorPlus: true },
  { name: 'Farcaster Frames + Nostr NIP-53', free: false, pro: false, creatorPlus: true },
  { name: '3 team seats', free: false, pro: false, creatorPlus: true },
];

const TESTIMONIALS = [
  {
    quote:
      'DegenFeed Pro paid for itself the first week. I restream to five platforms at once and the AI clips turn every stream into a week of TikToks.',
    name: 'Maya Chen',
    handle: '@maya_chen',
    role: 'Full-time streamer, 120k followers',
    tier: 'Pro',
    initials: 'MC',
  },
  {
    quote:
      'Token-gating changed everything. My $CREATOR holders get the stream, everyone else gets a preview. No other tool on the market does this.',
    name: 'Dev Nakamura',
    handle: '@devnak',
    role: 'Web3 creator, DAO founder',
    tier: 'Creator+',
    initials: 'DN',
  },
  {
    quote:
      'The unified feed alone is worth it — I catch narratives across Lens, Farcaster, and Nostr without tab-hopping. Cross-chain tips hit my wallet in minutes.',
    name: 'Sofia Reyes',
    handle: '@sofiareyes',
    role: 'Indie music artist + newsletter writer',
    tier: 'Creator+',
    initials: 'SR',
  },
];

const FAQS = [
  {
    q: "What's token-gating?",
    a: 'Token-gating lets you restrict who can watch a stream to holders of a specific token or NFT. Fans verify their wallet, and only holders of your ERC-20, ERC-721, or ERC-1155 assets get the private stream link. It is the on-chain replacement for pay-per-view ticketing — and it is exclusive to Creator+.',
  },
  {
    q: 'Can I use my own domain?',
    a: 'Yes. Creator+ includes a custom domain for your stream page, clips, and newsletter. Point your DNS to us and your audience gets a branded destination like stream.yourname.com instead of a degenfeed.xyz subdomain.',
  },
  {
    q: 'How does cross-chain tipping work?',
    a: 'Creator+ fans can tip in Lightning zaps, USDC, ETH, or MATIC — all from one tip button. We handle the wallet plumbing and settle each tip to your connected wallet. There are zero platform fees on tips, always.',
  },
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
    a: "Yes — annual billing gets you 2 months free. That's 10 months billed for 12 months of access, on every paid tier.",
  },
  {
    q: 'Can I switch between plans?',
    a: 'Upgrade or downgrade anytime. Changes apply immediately with prorated credits.',
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
  if (val === true) return <CheckIcon filled={tier === 'pro' || tier === 'creatorPlus'} />;
  if (val === false) return <DashIcon />;
  return (
    <span
      className={`text-[10px] font-semibold ${tier === 'pro' || tier === 'creatorPlus' ? 'text-degen-400' : 'text-[var(--color-muted)]'}`}
    >
      {val}
    </span>
  );
}

/* ─── Pricing Card ────────────────────────────────────────────── */

function PricingCard({ tier, billing }: { tier: TierCard; billing: BillingPeriod }) {
  const isPopular = tier.popular;
  const isAnnual = billing === 'annual' && tier.price > 0;
  const displayPrice = isAnnual ? annualPerMonth(tier.price) : tier.price;
  const billedTotal = isAnnual ? annualTotal(tier.price) : tier.price * MONTHS_PER_YEAR;

  const checklist = CARD_CHECKLIST.map((item) => ({
    name: item.name,
    included: item[tier.id],
  })).filter((item) => {
    // Show included items, plus a couple of "not included" rows to frame the upgrade.
    if (item.included) return true;
    return tier.id === 'free' || tier.id === 'pro';
  });

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
          {fmtPrice(displayPrice)}
        </span>
        {tier.price > 0 && <span className="text-xs text-[var(--color-muted)]">/mo</span>}
        {tier.price === 0 && (
          <span className="ml-1 text-xs font-medium text-degen-400">Forever</span>
        )}
      </div>

      {isAnnual && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
            2 months free
          </span>
          <span className="text-[10px] text-[var(--color-muted)]">
            {fmtPrice(billedTotal)}/yr · <s>{fmtPrice(tier.price)}/mo</s>
          </span>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted)]">{tier.desc}</p>

      <div className="mt-5 mb-5">
        {tier.price === 0 ? (
          <Link
            href={tier.href}
            className="flex w-full items-center justify-center rounded-xl border-2 border-[var(--color-glass-border)] bg-[var(--color-card)] py-2.5 text-sm font-bold text-[var(--color-fg)] transition-all hover:border-amber-500/30"
          >
            {tier.cta}
          </Link>
        ) : (
          <Link
            href={tier.href}
            className={`flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-bold transition-all ${isPopular ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black hover:shadow-[0_0_24px_rgba(245,158,11,0.35)]' : 'border-2 border-[var(--color-glass-border)] bg-[var(--color-card)] text-[var(--color-fg)] hover:border-amber-500/30'}`}
          >
            {tier.cta}
          </Link>
        )}
      </div>

      <div className="mb-4 border-t border-[var(--color-glass-border)]" />
      <ul className="flex-1 space-y-2.5">
        {checklist.map((item) => (
          <li key={item.name} className="flex items-start gap-2 text-xs">
            {item.included ? <CheckIcon filled={isPopular} /> : <DashIcon />}
            <span
              className={
                item.included
                  ? 'text-[var(--color-fg)]'
                  : 'text-[var(--color-muted)] line-through opacity-40'
              }
            >
              {item.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Testimonials ────────────────────────────────────────────── */

function Testimonials() {
  return (
    <div className="mb-16">
      <h2
        className="mb-2 text-center text-2xl font-bold text-[var(--color-fg)]"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        Loved by creators going everywhere
      </h2>
      <p className="mb-8 text-center text-sm text-[var(--color-muted)]">
        Streamers, artists, and DAOs shipping live every day on DegenFeed.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.handle}
            className="flex flex-col rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5"
          >
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="mb-3 text-amber-500/40"
            >
              <path d="M9.6 4C5.4 6.6 3 10.2 3 15c0 3 1.8 5 4.2 5 2.2 0 3.9-1.6 3.9-3.8 0-2-1.5-3.5-3.5-3.5-.4 0-.8.1-1 .2.3-2.5 2.3-5 4.5-6.4L9.6 4zm9 0c-4.2 2.6-6.6 6.2-6.6 11 0 3 1.8 5 4.2 5 2.2 0 3.9-1.6 3.9-3.8 0-2-1.5-3.5-3.5-3.5-.4 0-.8.1-1 .2.3-2.5 2.3-5 4.5-6.4L18.6 4z" />
            </svg>
            <blockquote className="flex-1 text-sm leading-relaxed text-[var(--color-fg-secondary)]">
              {t.quote}
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3 border-t border-[var(--color-glass-border)] pt-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-degen-500/15 text-xs font-bold text-degen-400">
                {t.initials}
              </span>
              <span className="flex-1">
                <span className="block text-xs font-bold text-[var(--color-fg)]">{t.name}</span>
                <span className="block text-[10px] text-[var(--color-muted)]">
                  {t.handle} · {t.role}
                </span>
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.tier === 'Creator+' ? 'bg-amber-500/15 text-amber-400' : 'bg-degen-500/15 text-degen-400'}`}
              >
                {t.tier}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

/* ─── Comparison Table (sticky first column, horizontal scroll) ─ */

function ComparisonTable() {
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

  const tiers: Tier[] = ['free', 'pro', 'creatorPlus'];

  return (
    <div className="overflow-x-auto scrollbar-thin rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-bg-secondary)]">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-[var(--color-glass-border)]">
            <th className="sticky left-0 z-20 bg-[var(--color-bg-tertiary)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Feature
            </th>
            {['Free', 'Pro', 'Creator+'].map((l, i) => (
              <th
                key={l}
                className={`px-4 py-3 text-center text-xs font-semibold ${i === 2 ? 'text-amber-400' : 'text-[var(--color-muted)]'}`}
              >
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupRow key={group.category} group={group} tiers={tiers} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRow({
  group,
  tiers,
}: {
  group: { category: string; features: Feature[] };
  tiers: Tier[];
}) {
  return (
    <>
      <tr className="bg-[var(--color-card)]">
        <td
          colSpan={4}
          className="sticky left-0 z-10 bg-[var(--color-card)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]"
        >
          {group.category}
        </td>
      </tr>
      {group.features.map((f) => (
        <tr key={f.name} className="border-b border-[var(--color-glass-border)] last:border-0">
          <td className="sticky left-0 z-10 bg-[var(--color-bg-secondary)] px-4 py-2.5 text-xs text-[var(--color-fg)]">
            {f.name}
          </td>
          {tiers.map((tier) => (
            <td key={tier} className="px-4 py-2.5 text-center">
              <ValueCell val={f[tier]} tier={tier} />
            </td>
          ))}
        </tr>
      ))}
    </>
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
              className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-overlay)]"
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
  const [showCompare, setShowCompare] = useState(false);

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
          <span className="gradient-text-green">Go live everywhere.</span>
          <br />
          <span className="text-[var(--color-fg)]">Get paid in any chain.</span>
        </h1>
        <p className="mx-auto max-w-xl text-base text-[var(--color-muted)]">
          Restream to every platform, gate your audience with tokens, and tip across chains.{' '}
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
            2 months free
          </span>
        </span>
      </div>

      {/* Pricing Cards — stack on mobile, 3 columns on desktop */}
      <div className="mb-16 grid gap-5 sm:grid-cols-1 lg:grid-cols-3">
        {TIERS.map((tier) => (
          <PricingCard key={tier.id} tier={tier} billing={billing} />
        ))}
      </div>

      {/* Testimonials */}
      <Testimonials />

      {/* Compare All Features */}
      <div className="mb-16">
        <div className="mb-6 text-center">
          <h2
            className="text-2xl font-bold text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Compare All Features
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Everything you get, across every tier. Swipe on mobile for the full table.
          </p>
        </div>

        <div className="mb-4 text-center">
          <button
            type="button"
            onClick={() => setShowCompare((v) => !v)}
            aria-expanded={showCompare}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--color-glass-border)] bg-[var(--color-card)] px-6 py-2.5 text-sm font-bold text-[var(--color-fg)] transition-all hover:border-amber-500/30"
          >
            {showCompare ? 'Hide Comparison' : 'Compare All Features'}
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className={`transition-transform ${showCompare ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        {showCompare && <ComparisonTable />}
      </div>

      {/* Enterprise Callout */}
      <div className="mb-16 overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-gradient-to-r from-purple-500/[0.06] via-transparent to-degen-500/[0.06] p-6 sm:p-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <h2
              className="text-xl font-bold text-[var(--color-fg)]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Need more? Let&apos;s build your plan.
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              White-label OTT, multi-tenant streaming, SLA, dedicated support, and custom
              integrations for teams and platforms.
            </p>
          </div>
          <a
            href="mailto:biz@degenfeed.xyz"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-degen-500 px-6 py-3 text-sm font-bold text-white transition-all hover:shadow-[0_0_24px_rgba(139,92,246,0.35)]"
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
