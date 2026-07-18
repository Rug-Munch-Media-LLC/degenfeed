import type { Metadata } from 'next';
import Link from 'next/link';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Platform Comparison — DegenFeed',
  description:
    'Compare DegenFeed to Twitter/X, Farcaster, Lens, and Bluesky. See how the open-source multi-protocol social aggregator stacks up.',
  alternates: { canonical: 'https://app.degenfeed.xyz/docs/comparison' },
  openGraph: {
    title: 'DegenFeed vs Other Platforms',
    description: 'Feature comparison: DegenFeed vs X (Twitter), Farcaster, Lens, and Bluesky.',
    url: 'https://app.degenfeed.xyz/docs/comparison',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Platform Comparison',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed vs Other Platforms',
    description: 'Feature comparison: DegenFeed vs X, Farcaster, Lens, and Bluesky.',
  },
};

function Check() {
  return <span className="text-degen-400">✓</span>;
}

function Dash() {
  return <span className="text-gray-600">—</span>;
}

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      {children}
    </section>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="group mt-14 mb-4 flex items-center gap-3 text-2xl font-bold text-[var(--color-fg)] scroll-mt-20"
    >
      {children}
      <a
        href={`#${id}`}
        className="text-gray-600 opacity-0 transition-opacity group-hover:opacity-100"
      >
        #
      </a>
    </h2>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-degen-500/20 bg-degen-500/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-degen-400">
      {children}
    </span>
  );
}

interface FeatureRow {
  feature: string;
  df: boolean | string;
  x: boolean | string;
  fc: boolean | string;
  lens: boolean | string;
  bsky: boolean | string;
}

const features: FeatureRow[] = [
  { feature: 'Multi-protocol feed', df: true, x: false, fc: false, lens: false, bsky: false },
  { feature: 'Cross-protocol posting', df: true, x: false, fc: false, lens: false, bsky: false },
  {
    feature: 'No account required to browse',
    df: true,
    x: false,
    fc: false,
    lens: false,
    bsky: false,
  },
  { feature: 'Open source', df: true, x: false, fc: true, lens: true, bsky: true },
  { feature: 'Self-hostable', df: true, x: false, fc: false, lens: false, bsky: false },
  { feature: 'No ads', df: true, x: false, fc: true, lens: true, bsky: true },
  { feature: 'Crypto tipping', df: true, x: false, fc: false, lens: 'Collects', bsky: false },
  {
    feature: 'AI-powered feed ranking',
    df: true,
    x: false,
    fc: false,
    lens: 'ML explore',
    bsky: false,
  },
  { feature: 'Custom feeds & filters', df: true, x: false, fc: false, lens: false, bsky: 'Feeds' },
  { feature: 'Post scheduling', df: true, x: 'Schedule', fc: false, lens: false, bsky: false },
  {
    feature: 'Communities',
    df: true,
    x: false,
    fc: 'Channels',
    lens: false,
    bsky: 'Starter packs',
  },
  { feature: 'Live audio Spaces', df: true, x: false, fc: false, lens: false, bsky: false },
  { feature: 'Cross-protocol DMs', df: true, x: false, fc: false, lens: false, bsky: false },
  { feature: 'Analytics dashboard', df: true, x: 'Premium', fc: false, lens: false, bsky: false },
  { feature: 'On-chain identity', df: true, x: false, fc: true, lens: true, bsky: 'DID' },
  { feature: 'Wallet sign-in', df: true, x: false, fc: true, lens: true, bsky: false },
  { feature: 'RSS / external feeds', df: true, x: false, fc: false, lens: false, bsky: false },
  { feature: 'ActivityPub federation', df: true, x: false, fc: false, lens: false, bsky: 'Bridge' },
  { feature: 'Transparent algorithm', df: true, x: false, fc: false, lens: false, bsky: false },
  {
    feature: 'PWA with push notifications',
    df: true,
    x: false,
    fc: false,
    lens: false,
    bsky: true,
  },
];

function FeatureTable() {
  const cols = [
    { key: 'df', label: 'DegenFeed' },
    { key: 'x', label: 'X (Twitter)' },
    { key: 'fc', label: 'Farcaster' },
    { key: 'lens', label: 'Lens' },
    { key: 'bsky', label: 'Bluesky' },
  ] as const;

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-glass-border)]">
            <th className="sticky left-0 z-10 bg-[var(--color-bg)] py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Feature
            </th>
            {cols.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-3 text-xs font-semibold uppercase tracking-wider ${
                  c.key === 'df' ? 'text-degen-400' : 'text-gray-500'
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((row) => {
            const cells = cols.map((c) => {
              const val = row[c.key];
              return typeof val === 'boolean' ? (
                val ? (
                  <Check />
                ) : (
                  <Dash />
                )
              ) : (
                <span className="text-xs text-gray-400">{val}</span>
              );
            });
            return (
              <tr
                key={row.feature}
                className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]"
              >
                <td className="sticky left-0 z-10 bg-[var(--color-bg)] py-2.5 pr-4 text-xs font-medium text-[var(--color-fg)]">
                  {row.feature}
                </td>
                {cells.map((cell, i) => (
                  <td key={i} className="px-3 py-2.5 text-xs">
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ComparisonPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <div className="mb-2 flex items-center gap-2">
        <Badge>Platform Comparison</Badge>
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)]">
        DegenFeed vs Other Platforms
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-400">
        See how DegenFeed compares to the alternatives. We believe social media should be open,
        multi-protocol, and user-owned — not a walled garden.
      </p>

      {/* Feature table */}
      <H2 id="feature-table">Full Feature Comparison</H2>
      <p className="text-sm leading-relaxed text-gray-400">
        A feature-level comparison across all major platforms. DegenFeed is the only platform that
        aggregates and publishes to multiple protocols from one interface.
      </p>
      <FeatureTable />

      {/* ═══════════════════════════════════════════════════════
          VS X
      ═══════════════════════════════════════════════════════ */}
      <Section id="vs-x">
        <H2 id="vs-x-heading">DegenFeed vs X (Twitter)</H2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5">
            <h3 className="mb-1 font-semibold text-[var(--color-fg)]">Why DegenFeed wins</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">Multi-protocol, not single-platform.</strong>{' '}
                  One app to read and post across Nostr, Farcaster, Lens, Bluesky, Mastodon, and
                  more.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">Web3-native.</strong> Wallet sign-in, crypto
                  tipping, on-chain identity. No credit card required.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">No ads.</strong> DegenFeed is
                  subscription-funded. Your attention is not the product.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">Open source.</strong> AGPL-3.0 licensed.
                  Self-host your own instance.
                </span>
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5">
            <h3 className="mb-1 font-semibold text-[var(--color-fg)]">What X still does better</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-gray-600">○</span>
                <span>Largest user base — harder to find DegenFeed users at scale</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-gray-600">○</span>
                <span>Multimedia infrastructure (native video player, Spaces recording)</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-gray-600">○</span>
                <span>Established verification system (blue check)</span>
              </li>
            </ul>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════
          VS FARCASTER
      ═══════════════════════════════════════════════════════ */}
      <Section id="vs-farcaster">
        <H2 id="vs-farcaster-heading">DegenFeed vs Farcaster</H2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5">
            <h3 className="mb-1 font-semibold text-[var(--color-fg)]">Why DegenFeed wins</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">Multi-chain, not just Optimism.</strong>{' '}
                  DegenFeed works with Solana, EVM chains, and more.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">AI-powered ranking.</strong> Transparent
                  7-factor scoring vs Farcaster&apos;s chronological or simple trending.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">Own your infrastructure.</strong> Self-host
                  DegenFeed. Farcaster requires running a Hub or relying on public Hubs.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">More protocols.</strong> DegenFeed reads 10
                  protocols including RSS, Reddit, and Threads — not just Farcaster.
                </span>
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5">
            <h3 className="mb-1 font-semibold text-[var(--color-fg)]">
              What Farcaster still does better
            </h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-gray-600">○</span>
                <span>Frames — interactive mini-apps embedded in posts</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-gray-600">○</span>
                <span>Dedicated mobile app (Warpcast) with polished UX</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-gray-600">○</span>
                <span>Growing developer ecosystem around Frames and actions</span>
              </li>
            </ul>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════
          VS LENS
      ═══════════════════════════════════════════════════════ */}
      <Section id="vs-lens">
        <H2 id="vs-lens-heading">DegenFeed vs Lens</H2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5">
            <h3 className="mb-1 font-semibold text-[var(--color-fg)]">Why DegenFeed wins</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">Cross-protocol bridging.</strong> Post to Lens
                  AND Nostr AND Farcaster simultaneously. Lens is protocol-locked.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">YouTube/PeerTube integration.</strong> DegenFeed
                  pulls video from RSS and YouTube channels into your feed.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">No gas fees for basic actions.</strong> Lens
                  requires MATIC for some on-chain operations.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">Better discovery.</strong> AI-ranked feed with
                  trending categories vs Lens&apos;s timeline.
                </span>
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5">
            <h3 className="mb-1 font-semibold text-[var(--color-fg)]">
              What Lens still does better
            </h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-gray-600">○</span>
                <span>Fully on-chain social graph — portability across Lens apps</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-gray-600">○</span>
                <span>Collects — mint posts as NFTs natively</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-gray-600">○</span>
                <span>Open Actions — third-party integrations within posts</span>
              </li>
            </ul>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════
          VS BLUESKY
      ═══════════════════════════════════════════════════════ */}
      <Section id="vs-bluesky">
        <H2 id="vs-bluesky-heading">DegenFeed vs Bluesky</H2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5">
            <h3 className="mb-1 font-semibold text-[var(--color-fg)]">Why DegenFeed wins</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">More protocols.</strong> DegenFeed supports 10
                  protocols. Bluesky is one protocol (AT Protocol) with bridges.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">Crypto tipping.</strong> Send ETH, SOL, or USDC
                  with on-chain transactions. Bluesky has no native payments.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">Communities & DAOs.</strong> Create communities
                  with governance features. Bluesky has Starter Packs but no group spaces.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-degen-400">◆</span>
                <span>
                  <strong className="text-gray-300">Fediverse integration.</strong> Full ActivityPub
                  federation via GotoSocial. Bluesky bridges are one-directional.
                </span>
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5">
            <h3 className="mb-1 font-semibold text-[var(--color-fg)]">
              What Bluesky still does better
            </h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-gray-600">○</span>
                <span>Custom feeds — user-created algorithmic feeds (already popular)</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-gray-600">○</span>
                <span>Larger active user base with mainstream crypto/non-crypto crossover</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-gray-600">○</span>
                <span>AT Protocol federation — users choose their PDS provider</span>
              </li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Footer */}
      <div className="mt-16 border-t border-[var(--color-glass-border)] pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-4 text-sm">
            <Link href="/faq" className="text-degen-400 underline">
              FAQ
            </Link>
            <Link href="/docs/user-guide" className="text-degen-400 underline">
              User Guide
            </Link>
            <Link href="/docs/troubleshooting" className="text-degen-400 underline">
              Troubleshooting
            </Link>
          </div>
          <p className="text-xs text-gray-600">
            Last updated July 2026. Feature sets change — check each platform for current status.
          </p>
        </div>
      </div>
    </div>
  );
}
