import type { Metadata } from 'next';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'About — DegenFeed',
  description:
    'DegenFeed is an open-source multi-protocol social aggregator for web3. See posts from Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS in one unified feed.',
  openGraph: {
    title: 'About DegenFeed',
    description:
      'The open-source multi-protocol social aggregator. One feed for Nostr, Farcaster, Lens, Bluesky, Mastodon, and more.',
    url: 'https://app.degenfeed.xyz/about',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'About DegenFeed',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About DegenFeed',
    description: 'The open-source multi-protocol social aggregator.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/about' },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-gray-300">
      <h1 className="mb-6 text-2xl font-bold text-[var(--color-fg)]">About DegenFeed</h1>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">1. What is DegenFeed?</h2>
      <p className="mb-4">
        DegenFeed is a multi-protocol social aggregator for web3. See posts from Nostr, Farcaster,
        Lens, Bluesky, Mastodon, Threads, Reddit, and RSS — all in one unified feed. Browse the
        pulse of crypto social without jumping between platforms. No account needed.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">2. Mission</h2>
      <p className="mb-4">
        Make web3 social accessible to everyone. Aggregation without lock-in — read from any
        protocol, post to any protocol, own your identity. We believe in open protocols, not walled
        gardens. The future of social media is decentralized, and DegenFeed is your window into it.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">3. Who Built This</h2>
      <p className="mb-4">
        DegenFeed is a product of <strong className="text-[var(--color-fg)]">Rug Munch Media LLC</strong>, a
        Wyoming limited liability company. Built by crypto native engineers who live and breathe
        on-chain. This is not a VC- backed startup — it is an independent, self-funded project by
        people who actually use the protocols they build for.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">4. Open Source</h2>
      <p className="mb-4">
        DegenFeed is licensed under the{' '}
        <strong className="text-[var(--color-fg)]">GNU Affero General Public License v3.0 (AGPL-3.0)</strong>.
        Source code is available at{' '}
        <a
          href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
          className="text-degen-400 underline"
        >
          git.rugmunch.io/RugMunchMedia/degenfeed-web
        </a>{' '}
        and mirrored at{' '}
        <a href="https://codeberg.org/degenfeed/degenfeed-web" className="text-degen-400 underline">
          codeberg.org/degenfeed/degenfeed-web
        </a>
        . Contributions are welcome — submit pull requests, report bugs, or suggest features.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">5. Infrastructure</h2>
      <p className="mb-4">
        DegenFeed is hosted on Cloudflare (Pages + Workers) for global edge performance. The social
        instance (social.degenfeed.xyz) runs GotoSocial on dedicated hardware. We support 8 protocol
        providers with zero tracking and no ads. Fast, clean, and private by design.
      </p>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">6. Contact</h2>
      <ul className="mb-4 list-inside list-disc space-y-1">
        <li>
          General:{' '}
          <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
            admin@rugmunch.io
          </a>
        </li>
        <li>
          Legal:{' '}
          <a href="mailto:legal@rugmunch.io" className="text-degen-400 underline">
            legal@rugmunch.io
          </a>
        </li>
        <li>
          DMCA:{' '}
          <a href="mailto:dmca@degenfeed.xyz" className="text-degen-400 underline">
            dmca@degenfeed.xyz
          </a>
        </li>
      </ul>
    </div>
  );
}
