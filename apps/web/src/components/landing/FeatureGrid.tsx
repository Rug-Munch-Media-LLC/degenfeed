'use client';

/**
 * FeatureGrid — 6 feature cards in responsive grid (3-col desktop, 1-col mobile).
 * Highlights DegenFeed's core value propositions.
 */

const FEATURES = [
  {
    icon: '🔗',
    title: 'Cross-Protocol Identity',
    description:
      'One wallet. Every identity. Link your Nostr npub, Farcaster FID, Bluesky DID, Mastodon handle, and Lens profile — all owned by you.',
    gradient: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(0,255,65,0.05))',
    border: 'rgba(139,92,246,0.2)',
    accent: 'var(--color-protocol-nostr)',
  },
  {
    icon: '📡',
    title: 'Unified Feed',
    description:
      'No more checking 44 silos. See every post from every protocol in one timeline. 15-layer smart deduplication means zero repeats.',
    gradient: 'linear-gradient(135deg, rgba(0,255,65,0.15), rgba(17,133,254,0.05))',
    border: 'rgba(0,255,65,0.2)',
    accent: 'var(--color-accent)',
  },
  {
    icon: '💰',
    title: 'Creator Coins',
    description:
      'Launch your own token across Base and Solana. Let fans tip you from ANY protocol. Vesting schedules, bonding curves, anti-exploit protection.',
    gradient: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(0,255,65,0.05))',
    border: 'rgba(245,158,11,0.2)',
    accent: 'var(--color-accent-tertiary)',
  },
  {
    icon: '🔒',
    title: 'Data Sovereignty',
    description:
      'We self-host 42 nodes: Farcaster Hubble, Nostr relays, PeerTube, GoToSocial, and more. Your data lives on your terms with our infrastructure.',
    gradient: 'linear-gradient(135deg, rgba(0,186,124,0.15), rgba(139,92,246,0.05))',
    border: 'rgba(0,186,124,0.2)',
    accent: 'var(--color-repost-active)',
  },
  {
    icon: '🌉',
    title: 'Protocol Bridging',
    description:
      'Post once, publish everywhere with 12 protocol adapters. Reply to a Farcaster cast from Nostr. DM a Bluesky user from Matrix. The bridges work.',
    gradient: 'linear-gradient(135deg, rgba(99,100,255,0.15), rgba(0,255,65,0.05))',
    border: 'rgba(99,100,255,0.2)',
    accent: 'var(--color-protocol-mastodon)',
  },
  {
    icon: '🎨',
    title: 'Beautiful & Fast',
    description:
      'Designed like the best social apps. Dark mode by default. Sub-100ms feed loads. Mobile-first with native-feel gestures.',
    gradient: 'linear-gradient(135deg, rgba(249,24,128,0.15), rgba(139,92,246,0.05))',
    border: 'rgba(249,24,128,0.2)',
    accent: 'var(--color-like-active)',
  },
] as const;

export function FeatureGrid() {
  return (
    <section className="relative px-4 py-16 md:py-24" id="features">
      {/* Section heading */}
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <h2
          className="mb-3 text-3xl font-black md:text-4xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          The Unified <span className="gradient-text">Social Layer</span>
        </h2>
        <p
          className="mx-auto max-w-xl text-sm leading-relaxed"
          style={{ color: 'var(--color-fg-secondary)' }}
        >
          One protocol is limiting. Forty-four is liberation. Every network, every identity, every
          post — in one place.
        </p>
      </div>

      {/* Feature grid */}
      <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <article
            key={feature.title}
            className="feature-card group relative overflow-hidden rounded-2xl border p-6 transition-all duration-300"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-card)',
              animationDelay: `${i * 80}ms`,
            }}
          >
            {/* Hover gradient overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: feature.gradient }}
            />

            <div className="relative z-10">
              {/* Icon */}
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-lg transition-transform duration-300 group-hover:scale-110"
                style={{
                  background: `${feature.accent}15`,
                  border: `1px solid ${feature.accent}30`,
                }}
                aria-hidden="true"
              >
                {feature.icon}
              </div>

              {/* Title */}
              <h3
                className="mb-2 text-base font-bold md:text-lg"
                style={{ color: 'var(--color-fg)' }}
              >
                {feature.title}
              </h3>

              {/* Description */}
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                {feature.description}
              </p>
            </div>

            {/* Corner accent */}
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-30"
              style={{ background: feature.accent }}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
