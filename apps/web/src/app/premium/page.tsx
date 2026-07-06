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
      'Wallet sign-in',
    ],
    cta: 'Get started',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$5/mo',
    description: 'Cross-post and control your algorithm.',
    features: [
      'Cross-post to all connected platforms',
      'Advanced algorithm controls',
      'Custom feeds and saved searches',
      'Priority support',
      'Analytics dashboard',
      'Boosted profile in discovery',
      'Bookmark sync across devices',
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
      'Paywalled premium posts (x402)',
      'Subscriber-only threads/newsletters',
      'Tip jar + monetization dashboard',
      'Verified creator badge',
      'Early access to new platforms',
    ],
    cta: 'Become a Creator',
    popular: false,
  },
];

export const dynamic = 'force-dynamic';

function handleSubscribe(tier: string) {
  window.location.href = `/api/billing/checkout?tier=${tier}`;
}

export default function PremiumPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white">Unlock the full DegenFeed experience</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
          Upgrade with crypto to support the network and unlock pro tools for power users and
          creators.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {TIERS.map((tier) => (
          <div
            key={tier.id}
            className={`card relative flex flex-col ${
              tier.popular ? 'border-degen-500/50 bg-degen-500/10' : 'border-gray-800'
            }`}
          >
            {tier.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-degen-500 px-3 py-0.5 text-xs font-semibold text-black">
                Most popular
              </div>
            )}
            <h2 className="text-xl font-bold text-white">{tier.name}</h2>
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
                  : 'bg-gray-800 text-white hover:bg-gray-700'
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
      </div>
    </div>
  );
}
