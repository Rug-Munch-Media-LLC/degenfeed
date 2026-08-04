import type { Metadata } from 'next';
import { Badge } from '../_components/doc-badge';
import { DocBreadcrumbs } from '../_components/doc-breadcrumbs';
import { Callout } from '../_components/doc-callout';
import { CodeBlock } from '../_components/doc-code-block';
import { H2, H3 } from '../_components/doc-heading';
import { Step, StepList } from '../_components/doc-step';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Video Streaming Guide — DegenFeed',
  description:
    'Watch and stream video across YouTube, Twitch, PeerTube, Rumble, and more — all in one place. Learn how DegenFeed video aggregation, live streaming, and multi-protocol distribution work.',
  keywords: [
    'web3 video streaming',
    'decentralized video',
    'peertube streaming',
    'video aggregator',
    'live streaming web3',
    'degenfeed video guide',
    'multi-protocol video',
  ],
  alternates: { canonical: 'https://degenfeed.xyz/docs/video' },
  openGraph: {
    title: 'Video Streaming Guide — DegenFeed',
    description:
      'Watch and stream video across YouTube, Twitch, PeerTube, Rumble, and more — all in one place.',
    url: 'https://degenfeed.xyz/docs/video',
    siteName: 'DegenFeed',
    type: 'website',
    images: [
      {
        url: 'https://degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Video Streaming Guide',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Video Streaming Guide — DegenFeed',
    description:
      'Watch and stream video across YouTube, Twitch, PeerTube, Rumble, and more — all in one place.',
    images: ['https://degenfeed.xyz/og-image.png'],
  },
};

export default function VideoPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <DocBreadcrumbs items={[{ label: 'Docs', href: '/docs' }, { label: 'Video Streaming' }]} />
      {/* Hero */}
      <div className="mb-2 flex items-center gap-2">
        <Badge color="green">Video</Badge>
        <Badge>6 min read</Badge>
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)]">
        Video Streaming Guide
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-muted)]">
        DegenFeed&rsquo;s video hub aggregates YouTube (via Invidious), Twitch, Rumble, PeerTube,
        Zora, and more into one Netflix-style feed &mdash; with live streaming, multi-protocol
        distribution, and creator monetization built in.
      </p>

      <H2 id="watching">Watching Video</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Visit{' '}
        <a href="/video" className="text-degen-400 underline">
          /video
        </a>{' '}
        to browse the hub. You&rsquo;ll find a hero banner with a featured video, category tabs, a
        source filter bar, and themed rows (Trending Now, New Releases, per-category rows). Every
        video is labeled with its source &mdash; for example, YouTube (via Invidious) or Twitch
        &mdash; so you always know where content originates.
      </p>
      <Callout type="tip">
        The video hub works without an account. Watching is free forever and requires no wallet, no
        sign-up, and no tracking.
      </Callout>

      <H3 id="continue-watching">Continue Watching &amp; Watch Later</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        DegenFeed remembers your progress locally. The <strong>Continue Watching</strong> row
        resumes where you left off, and any video can be saved to <strong>Watch Later</strong> with
        one click.
      </p>

      <H2 id="live-streaming">Live Streaming</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Go live from the{' '}
        <a href="/live" className="text-degen-400 underline">
          /live
        </a>{' '}
        route. DegenFeed&rsquo;s live module lets you stream to multiple protocols at once and
        interact with your audience across every network.
      </p>

      <StepList>
        <Step number="1" label="Connect your streaming identity">
          Link the accounts you want to stream with — e.g., a Nostr identity, PeerTube account, or
          Mastodon-compatible fediverse handle.
        </Step>
        <Step number="2" label="Create a live room">
          Give your stream a title, description, and cover art. DegenFeed provisions a room that
          fans can discover from any protocol.
        </Step>
        <Step number="3" label="Push your video feed">
          Point your encoder (OBS, Streamlabs, etc.) at the provided RTMP/SRT ingest URL and key.
          DegenFeed relays the stream to each selected destination.
        </Step>
        <Step number="4" label="Distribute to all protocols">
          Your stream is announced on Nostr, Farcaster, Bluesky, Mastodon, and more simultaneously —
          no separate go-live per network.
        </Step>
        <Step number="5" label="Monetize while live">
          Enable tips (ETH/SOL/USDC/Lightning) and optional NFT minting so viewers can support you
          in real time.
        </Step>
      </StepList>

      <Callout type="info">
        Live distribution currently targets 5+ protocols per stream. Check the live room dashboard
        for per-destination status and retry any that fail.
      </Callout>

      <H2 id="supported-platforms">Supported Video Platforms</H2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ['YouTube (via Invidious)', 'Full catalog aggregation without tracking'],
          ['Twitch', 'Live and VOD content with creator presence'],
          ['Rumble', 'Independent video platform content'],
          ['PeerTube', 'Federated, self-hosted video (ActivityPub)'],
          ['Owncast', 'Self-hosted live streaming instances'],
          ['Odysee', 'LBRY-protocol video and livestreams'],
          ['Zora', 'On-chain media and creator content'],
          ['Loops', 'Short-form clips with cross-protocol sharing'],
        ].map(([name, desc]) => (
          <div
            key={name}
            className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-4"
          >
            <div className="text-sm font-semibold text-[var(--color-fg)]">{name}</div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{desc}</p>
          </div>
        ))}
      </div>

      <H2 id="protocol-guides">Protocol-Specific Video Guides</H2>
      <div className="mt-4 space-y-3">
        {[
          [
            'PeerTube',
            'Connect a PeerTube account to upload, then stream via RTMP. Your stream is federated to the ActivityPub network automatically.',
          ],
          [
            'YouTube',
            'No account needed to watch. Live streams and VODs are aggregated via Invidious instances so you can browse the catalog without tracking.',
          ],
          [
            'Owncast',
            'Self-host your own Owncast instance, register it in DegenFeed, and your live streams appear in the video hub alongside every other source.',
          ],
          [
            'Rumble',
            'Watch independent videos and livestreams aggregated from public pages. Rumble content appears in Trending and category rows.',
          ],
          [
            'Odysee',
            'LBRY-protocol content claims are resolved and indexed so you can watch channels and livestreams in the same unified feed.',
          ],
        ].map(([name, desc]) => (
          <div
            key={name}
            className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-4"
          >
            <div className="text-sm font-semibold text-[var(--color-fg)]">{name}</div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{desc}</p>
          </div>
        ))}
      </div>

      <H2 id="shorts">Short-Form Video</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        The{' '}
        <a href="/shorts" className="text-degen-400 underline">
          /shorts
        </a>{' '}
        route is a TikTok-style short-form feed. Clips can be stored via Blossom (nostr.build)
        free-tier short-clip storage with optional IPFS pinning, then shared across protocols from
        one interface.
      </p>

      <H2 id="api">Video via API</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Developers can query aggregated video from the same API powering the hub:
      </p>
      <CodeBlock lang="bash">{`# Fetch trending video across all sources
curl "https://degenfeed.xyz/api/video/trending?limit=25"

# Fetch live rooms currently streaming
curl "https://degenfeed.xyz/api/live/rooms?status=live"

# Fetch videos from a specific platform
curl "https://degenfeed.xyz/api/video?source=peertube&sort=new"`}</CodeBlock>

      <H2 id="troubleshooting">Troubleshooting</H2>
      <H3 id="video-not-playing">Video not playing?</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Some sources (like YouTube via Invidious) can be blocked by certain ISPs or regions. Try the
        alternate instance by clicking the source label, or check the platform directly. For live
        streams, confirm the ingest URL is active in your encoder.
      </p>
      <H3 id="stream-not-announced">Stream not announced to a protocol?</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Reconnect that protocol&rsquo;s account in <strong>Settings → Connected Accounts</strong>{' '}
        and start a new live room. Distribution announces are sent per-destination with automatic
        retry.
      </p>

      <div className="mt-12 border-t border-[var(--color-glass-border)] pt-6 text-center">
        <p className="text-xs text-[var(--color-muted)]">
          Next: read the{' '}
          <a href="/docs/cross-posting" className="text-degen-400 underline">
            Cross-Posting Guide
          </a>{' '}
          or the{' '}
          <a href="/docs/protocols" className="text-degen-400 underline">
            Protocol Integration Guide
          </a>
          .
        </p>
      </div>
    </div>
  );
}
