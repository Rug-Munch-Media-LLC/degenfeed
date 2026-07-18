import type { Metadata } from 'next';
import { Badge } from '../_components/doc-badge';
import { Callout } from '../_components/doc-callout';
import { CodeBlock } from '../_components/doc-code-block';
import { H2, H3 } from '../_components/doc-heading';
import { Step } from '../_components/doc-step';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: '5-Minute Quickstart — DegenFeed',
  description:
    'Get started with DegenFeed in 5 minutes. Connect your wallet, link protocols, browse your feed, make your first post, and tip a creator.',
  alternates: { canonical: 'https://app.degenfeed.xyz/docs/quickstart' },
  openGraph: {
    title: 'DegenFeed Quickstart',
    description: 'Get up and running with DegenFeed in 5 minutes.',
  },
};

export default function QuickstartPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      {/* Hero */}
      <div className="mb-2 flex items-center gap-2">
        <Badge color="green">Quickstart</Badge>
        <Badge>5 min read</Badge>
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)]">
        5-Minute Quickstart
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-muted)]">
        Get up and running with DegenFeed in five minutes. By the end, you&rsquo;ll have your wallet
        connected, a protocol linked, and you&rsquo;ll have made your first cross-protocol post and
        tip.
      </p>

      {/* Step 1 */}
      <H2 id="connect-wallet">Step 1: Connect Your Wallet</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        You don&rsquo;t need a wallet to <em>browse</em> DegenFeed, but connecting one unlocks
        posting, tipping, and identity features. DegenFeed supports both Solana and EVM wallets.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-fg)]">Solana</h3>
          <ul className="space-y-1.5 text-sm text-[var(--color-muted)]">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              Phantom
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              Backpack
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Solflare
            </li>
          </ul>
        </div>
        <div className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-fg)]">EVM</h3>
          <ul className="space-y-1.5 text-sm text-[var(--color-muted)]">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              MetaMask
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full text-blue-500">
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <rect x="2" y="2" width="20" height="20" rx="4" />
                </svg>
              </span>
              Rainbow
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              WalletConnect
            </li>
          </ul>
        </div>
      </div>

      <Callout type="tip">
        You can connect both a Solana and an EVM wallet simultaneously. This lets you tip across
        chains and use protocol-specific features like Lens on Polygon and Farcaster on Optimism.
      </Callout>

      <div className="my-4 rounded-lg border border-dashed border-[var(--color-muted)] bg-white/[0.01] p-6 text-center">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Screenshot
        </div>
        <div className="mt-2 text-sm text-[var(--color-muted)]">
          The Connect Wallet button appears in the top-right corner of the header. Click it and
          approve the connection in your wallet extension.
        </div>
      </div>

      {/* Step 2 */}
      <H2 id="link-protocol">Step 2: Link Your First Protocol</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        After connecting a wallet, link your social accounts to post and engage across protocols. Go
        to <strong>Settings → Connected Accounts</strong> to get started.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Step number="1" label="Nostr">
          Use a browser extension (Alby, nos2x) or paste your nsec/npub. Your key never leaves your
          device — all signing happens client-side with Schnorr signatures.
        </Step>
        <Step number="2" label="Farcaster">
          Sign with the wallet that owns your Farcaster ID. The Hub API confirms your identity via
          Ed25519 signature verification.
        </Step>
        <Step number="3" label="Lens">
          Authenticate via your Lens profile on Polygon. Uses challenge-response signing with your
          connected wallet.
        </Step>
        <Step number="4" label="Bluesky">
          Enter your Bluesky handle and create an app password in Bluesky Settings → App Passwords.
          Your main password won&rsquo;t work with third-party apps.
        </Step>
        <Step number="5" label="Mastodon">
          Enter any Mastodon-compatible instance URL and authorize via OAuth. Works with
          social.degenfeed.xyz and any public instance.
        </Step>
      </div>

      <Callout type="info">
        You can link multiple protocols. Each additional connection expands your feed and unlocks
        cross-protocol posting. Most connections take less than 30 seconds.
      </Callout>

      {/* Step 3 */}
      <H2 id="browse-feed">Step 3: Browse Your Feed</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Once you&rsquo;ve linked at least one protocol, your feed will populate with posts from that
        network. Visit the home page to see your aggregated timeline.
      </p>

      <H3 id="sort-modes">Sort Modes</H3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[
          {
            mode: 'Scored',
            desc: 'Balanced ranking across all 7 factors. Default and recommended.',
          },
          {
            mode: 'Hot',
            desc: 'Trending posts with recent engagement velocity. Best for real-time.',
          },
          { mode: 'New', desc: 'Chronological, most recent first. No ranking applied.' },
          { mode: 'Top', desc: 'Highest raw engagement across all time windows.' },
        ].map((s) => (
          <div
            key={s.mode}
            className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-3"
          >
            <span className="font-mono text-xs font-bold text-degen-400">{s.mode}</span>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{s.desc}</p>
          </div>
        ))}
      </div>

      <H3 id="filters">Filters</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Narrow your feed with filters available in the sidebar or as URL parameters:
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-glass-border)]">
              <th className="py-2 pr-4 font-medium text-[var(--color-muted)]">Parameter</th>
              <th className="py-2 pr-4 font-medium text-[var(--color-muted)]">Example</th>
              <th className="py-2 font-medium text-[var(--color-muted)]">Description</th>
            </tr>
          </thead>
          <tbody className="text-[var(--color-muted)]">
            {[
              ['protocols', 'nostr,farcaster', 'Comma-separated protocol filter'],
              ['category', 'defi', 'Niche: defi, ai, bitcoin, ethereum, solana, security'],
              ['sort', 'hot', 'scored | hot | new | top'],
              ['type', 'video', 'Content type: video, article, image, thread, link'],
              ['trending', '1', 'Trending window in hours: 1 | 6 | 24'],
              ['limit', '50', 'Posts per page: 1-200'],
            ].map(([p, e, d]) => (
              <tr key={p} className="border-b border-white/[0.02]">
                <td className="py-2 pr-4 font-mono text-degen-400 text-xs">{p}</td>
                <td className="py-2 pr-4 font-mono text-xs">{e}</td>
                <td className="py-2 text-xs">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CodeBlock lang="bash">{`# Browse all protocols, hot sort, DeFi category
curl "https://degenfeed.xyz/api/feed/home?sort=hot&category=defi&limit=25"

# Just Nostr and Farcaster, newest first
curl "https://degenfeed.xyz/api/feed/home?protocols=nostr,farcaster&sort=new"`}</CodeBlock>

      {/* Step 4 */}
      <H2 id="first-post">Step 4: Make Your First Post</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Ready to publish to the multiverse? Here&rsquo;s how to make your first cross-protocol post:
      </p>

      <ol className="mt-4 space-y-3">
        {[
          ['Click the Compose button', 'Located in the header bar. A pencil or + icon.'],
          [
            'Write your content',
            'Include text, images, links, and mentions. Up to protocol limits.',
          ],
          [
            'Select target protocols',
            'Check which protocols to publish to. You can post to multiple at once.',
          ],
          ['Click Post', 'Your content is sent to each selected protocol simultaneously.'],
        ].map(([step, desc], i) => (
          <li key={step} className="flex gap-3 text-sm leading-relaxed text-[var(--color-muted)]">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-degen-500/10 text-xs font-bold text-degen-400">
              {i + 1}
            </span>
            <div>
              <strong className="text-[var(--color-muted)]">{step}</strong>
              <p className="mt-0.5 text-[var(--color-muted)]">{desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <Callout type="warning">
        Protocol-specific limits apply. Nostr supports large posts (~64KB) but some relays limit to
        ~500 chars. Bluesky has a 300 character limit. DegenFeed will warn you if your post exceeds
        a protocol&rsquo;s limit before publishing.
      </Callout>

      <div className="mt-4 rounded-lg border border-dashed border-[var(--color-muted)] bg-white/[0.01] p-6 text-center">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Screenshot
        </div>
        <div className="mt-2 text-sm text-[var(--color-muted)]">
          The compose dialog shows protocol selector checkboxes, text area, and media upload.
        </div>
      </div>

      {/* Step 5 */}
      <H2 id="tip-creator">Step 5: Tip a Creator</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Show appreciation for content you love by sending a crypto tip. DegenFeed supports tips in
        ETH, SOL, USDC, and Lightning Network zaps.
      </p>

      <ol className="mt-4 space-y-3">
        {[
          ['Find a post you like', 'Scroll your feed and find content worth tipping.'],
          ['Click the tip button', 'Look for the tip icon on any post. It opens the tip dialog.'],
          [
            'Choose your currency',
            'Select ETH, SOL, or USDC. For Nostr posts, you can also zap via Lightning Network.',
          ],
          [
            'Enter the amount',
            'Type the amount in your chosen currency. DegenFeed shows the USD equivalent.',
          ],
          [
            'Confirm in your wallet',
            'Approve the transaction. The tip goes directly to the creator on-chain.',
          ],
        ].map(([step, desc], i) => (
          <li key={step} className="flex gap-3 text-sm leading-relaxed text-[var(--color-muted)]">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-degen-500/10 text-xs font-bold text-degen-400">
              {i + 1}
            </span>
            <div>
              <strong className="text-[var(--color-muted)]">{step}</strong>
              <p className="mt-0.5 text-[var(--color-muted)]">{desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <Callout type="info">
        DegenFeed never intermediates tips. All transactions go directly from your wallet to the
        creator on-chain. You can verify every tip on the respective block explorer.
      </Callout>

      <H2 id="next-steps">Next Steps</H2>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: '/docs/user-guide', title: 'User Guide', desc: 'Deep dive into all features' },
          { href: '/docs/api', title: 'API Reference', desc: 'Build on DegenFeed' },
          { href: '/docs/protocols', title: 'Protocols', desc: 'Integration details' },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-4 text-center transition-all hover:border-degen-500/30 hover:bg-degen-500/[0.03]"
          >
            <div className="text-sm font-medium text-[var(--color-fg)]">{link.title}</div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{link.desc}</p>
          </a>
        ))}
      </div>

      <div className="mt-12 border-t border-[var(--color-glass-border)] pt-6 text-center">
        <p className="text-xs text-[var(--color-muted)]">
          Questions?{' '}
          <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
            admin@rugmunch.io
          </a>
        </p>
      </div>
    </div>
  );
}
