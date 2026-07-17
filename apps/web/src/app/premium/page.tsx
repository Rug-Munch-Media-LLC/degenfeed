'use client';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    description: 'Read all feeds and engage publicly.',
    features: [
      'Read all ranked feeds',
      'Public likes/replies where supported',
      'Basic tipping',
      'Wallet sign-in (ETH + SOL)',
    ],
    cta: 'Get started',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$5/mo',
    description: 'Support the network and unlock power-user tools.',
    features: [
      'Cross-post to all connected platforms',
      'Advanced algorithm controls (recency/engagement/diversity)',
      'Follow authors and mute across the open social graph',
      'Bookmark sync across devices',
      'Priority support',
    ],
    cta: 'Upgrade to Pro',
    popular: true,
  },
  {
    id: 'creator',
    name: 'Creator',
    price: '$15/mo',
    description: 'Monetize with paywalls and premium content.',
    features: [
      'Everything in Pro',
      'Paywalled premium posts (x402 protocol)',
      'Tip jar + monetization settings',
      'Verified creator badge',
    ],
    cta: 'Become a Creator',
    popular: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    description: 'White-label, API access, and custom integrations.',
    features: [
      'Everything in Creator',
      'White-label embeddable feed',
      'API access with SLA',
      'Custom domains and branding',
      'Dedicated support channel',
    ],
    cta: 'Contact us',
    popular: false,
  },
];

export const dynamic = 'force-dynamic';

function handleSubscribe(tier: string) {
  // Open the billing checkout in a new tab. The endpoint returns JSON
  // with a payment URL; for now we open a direct link to the endpoint
  // and the user can follow the payment flow from there.
  window.open(`/api/billing/checkout?tier=${tier}`, '_blank');
}

export default function PremiumPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-[var(--color-fg)]">Support DegenFeed</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
          Upgrade with crypto to support the network and unlock pro tools for power users and
          creators.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {TIERS.map((tier) => (
          <div
            key={tier.id}
            className={`card relative flex flex-col ${
              tier.popular ? 'border-degen-500/50 bg-degen-500/10' : 'border-[var(--color-border)]'
            }`}
          >
            {tier.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-degen-500 px-3 py-0.5 text-xs font-semibold text-black">
                Most popular
              </div>
            )}
            <h2 className="text-xl font-bold text-[var(--color-fg)]">{tier.name}</h2>
            <div className="my-2 text-2xl font-bold text-degen-400">{tier.price}</div>
            <p className="mb-4 text-sm text-gray-500">{tier.description}</p>
            <ul className="mb-6 flex-1 space-y-2 text-sm text-gray-400">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-degen-500">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => tier.id !== 'free' && handleSubscribe(tier.id)}
              className={`w-full rounded-lg py-2 text-sm font-semibold ${
                tier.popular
                  ? 'bg-degen-500 text-black hover:bg-degen-400'
                  : 'bg-[var(--color-muted)] text-[var(--color-fg)] hover:bg-gray-700'
              }`}
            >
              {tier.cta}
            </button>
          </div>
        ))}
      </div>

      <div className="card mt-8 border-degen-500/20 bg-degen-500/5 py-6 text-center">
        <p className="text-sm text-gray-400">
          Payments are processed on Solana via Blinks. No fiat. No KYC. Cancel anytime.
        </p>
        <p className="mt-2 text-xs text-gray-600">
          All paid features are open source and available in our self-hosted build.
        </p>
      </div>

      <div className="mt-12 grid gap-8 md:grid-cols-3">
        <div className="card">
          <h3 className="text-lg font-semibold text-[var(--color-fg)]">Open Source</h3>
          <p className="mt-2 text-sm text-gray-400">
            All code is AGPL-licensed on Forgejo, GitLab, and Codeberg. Self-host if you prefer.
          </p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-[var(--color-fg)]">No Lock-In</h3>
          <p className="mt-2 text-sm text-gray-400">
            Cancel anytime. Your data is always yours — export it with one click.
          </p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-[var(--color-fg)]">Privacy First</h3>
          <p className="mt-2 text-sm text-gray-400">
            No tracking, no ads, no data sales. Premium funds development directly.
          </p>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="mb-6 text-xl font-bold text-[var(--color-fg)]">FAQ</h2>
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-[var(--color-fg)]">How do payments work?</h3>
            <p className="mt-1 text-sm text-gray-400">
              Payments are processed on-chain via Solana Blinks. Connect your wallet, sign a
              transaction, and you are upgraded instantly. No credit cards, no KYC.
            </p>
          </div>
          <div className="card">
            <h3 className="font-semibold text-[var(--color-fg)]">Can I cancel anytime?</h3>
            <p className="mt-1 text-sm text-gray-400">
              Yes. Cancel from your profile settings. Your subscription ends at the current billing
              period. No questions asked.
            </p>
          </div>
          <div className="card">
            <h3 className="font-semibold text-[var(--color-fg)]">What is x402 paywall?</h3>
            <p className="mt-1 text-sm text-gray-400">
              x402 is an open protocol for HTTP 402 Payment Required. Creator-tier users can paywall
              individual posts — readers pay per-view in USDC. Learn more at x402.org.
            </p>
          </div>
          <div className="card">
            <h3 className="font-semibold text-[var(--color-fg)]">Do I need premium to browse?</h3>
            <p className="mt-1 text-sm text-gray-400">
              No. Browsing DegenFeed is free forever. Premium unlocks power-user and creator tools
              while directly funding open-source development.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
