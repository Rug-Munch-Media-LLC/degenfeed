import type { Metadata } from 'next';
import { Badge } from '../_components/doc-badge';
import { DocBreadcrumbs } from '../_components/doc-breadcrumbs';
import { Callout } from '../_components/doc-callout';
import { CodeBlock } from '../_components/doc-code-block';
import { H2, H3 } from '../_components/doc-heading';
import { Step, StepList } from '../_components/doc-step';
import { DocTable } from '../_components/doc-table';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Cross-Posting Guide — DegenFeed',
  description:
    'Publish one post to Nostr, Farcaster, Bluesky, Mastodon, Threads, and more at the same time. Learn how DegenFeed cross-posting works, protocol limits, scheduling, and engagement aggregation.',
  keywords: [
    'cross-protocol posting',
    'multi-protocol social',
    'nostr farcaster bluesky cross post',
    'one post all protocols',
    'degenfeed cross posting guide',
    'web3 social publishing',
  ],
  alternates: { canonical: 'https://degenfeed.xyz/docs/cross-posting' },
  openGraph: {
    title: 'Cross-Posting Guide — DegenFeed',
    description:
      'Publish one post to Nostr, Farcaster, Bluesky, Mastodon, and more at once. Free, decentralized, no vendor lock-in.',
    url: 'https://degenfeed.xyz/docs/cross-posting',
    siteName: 'DegenFeed',
    type: 'website',
    images: [
      {
        url: 'https://degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Cross-Posting Guide',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cross-Posting Guide — DegenFeed',
    description: 'Publish one post to Nostr, Farcaster, Bluesky, Mastodon, and more at once.',
    images: ['https://degenfeed.xyz/og-image.png'],
  },
};

export default function CrossPostingPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <DocBreadcrumbs items={[{ label: 'Docs', href: '/docs' }, { label: 'Cross-Posting' }]} />
      {/* Hero */}
      <div className="mb-2 flex items-center gap-2">
        <Badge color="green">Cross-Posting</Badge>
        <Badge>6 min read</Badge>
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)]">
        Cross-Posting Guide
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-muted)]">
        Write once, publish everywhere. DegenFeed&rsquo;s composer sends your content to every
        network you select using each protocol&rsquo;s native API &mdash; Nostr events, Farcaster
        casts, Bluesky records, Mastodon toots, and more &mdash; from a single interface.
      </p>

      <Callout type="tip">
        Cross-posting is available on the free tier. All signed-in users can publish to every
        connected protocol at once. No extra fees per post.
      </Callout>

      <H2 id="how-it-works">How Cross-Posting Works</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        When you hit <strong>Post</strong> in the DegenFeed composer, the platform:
      </p>
      <ol className="mt-4 space-y-3">
        {[
          [
            'Adapts your content',
            'Each protocol receives content in its native format — plain text for Nostr, casts for Farcaster, XRPC records for Bluesky, REST toots for Mastodon.',
          ],
          [
            'Signs client-side',
            'Your keys never leave the browser. Nostr events are signed with your nsec, Farcaster with your signer, and the rest via OAuth/app tokens you connected.',
          ],
          [
            'Fan-outs in parallel',
            'Posts are sent to all selected networks simultaneously. Partial failures are retried in the background — you are never left with a half-published thread.',
          ],
          [
            'Aggregates engagement',
            'Every post gets a canonical DegenFeed ID, so likes, replies, and reposts from all protocols flow back into one unified view.',
          ],
        ].map(([title, desc], i) => (
          <li key={title} className="flex gap-3 text-sm leading-relaxed text-[var(--color-muted)]">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-degen-500/10 text-xs font-bold text-degen-400">
              {i + 1}
            </span>
            <div>
              <strong className="text-[var(--color-muted)]">{title}</strong>
              <p className="mt-0.5 text-[var(--color-muted)]">{desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <H2 id="how-to-cross-post">How to Cross-Post</H2>
      <StepList>
        <Step number="1" label="Connect accounts">
          Go to <strong>Settings → Connected Accounts</strong> and link every protocol identity you
          want to publish to. Nostr (nsec), Farcaster (signer), Bluesky (app password), Mastodon
          (OAuth), Threads, and more.
        </Step>
        <Step number="2" label="Open the composer">
          Click the <strong>Compose</strong> button in the header. Write your text, add media,
          links, mentions, or hashtags.
        </Step>
        <Step number="3" label="Select protocols">
          Tick the checkboxes for each destination network. DegenFeed shows each protocol&rsquo;s
          character limit and will warn you before truncation.
        </Step>
        <Step number="4" label="Hit Post">
          Your content is sent to every selected protocol at once. Engagement flows back into a
          single canonical post view.
        </Step>
      </StepList>

      <H2 id="protocol-limits">Protocol Limits &amp; Differences</H2>
      <DocTable
        columns={[
          { header: 'Protocol', key: 'protocol' },
          { header: 'Character Limit', key: 'limit' },
          { header: 'Media', key: 'media' },
          { header: 'Notes', key: 'notes' },
        ]}
        data={[
          {
            protocol: 'Nostr',
            limit: '~64 KB (relay dependent)',
            media: 'Images, video links',
            notes: 'Some relays cap notes at ~500 chars; signed with nsec client-side.',
          },
          {
            protocol: 'Farcaster',
            limit: '320 chars',
            media: 'Images, embeds',
            notes: 'Posts are called casts; embeds supported via URLs.',
          },
          {
            protocol: 'Bluesky',
            limit: '300 chars',
            media: 'Images, video',
            notes: 'Uses AT Protocol XRPC; app password required.',
          },
          {
            protocol: 'Mastodon',
            limit: '500 chars (instance dependent)',
            media: 'Images, video',
            notes: 'Works with any ActivityPub instance, including social.degenfeed.xyz.',
          },
          {
            protocol: 'Threads',
            limit: '500 chars',
            media: 'Images, video',
            notes: 'Threads API posting requires a linked Instagram account.',
          },
          {
            protocol: 'Lens',
            limit: '5,000 chars (publication)',
            media: 'Images, video, audio',
            notes: 'Publications are signed on Polygon; supported via Lens API.',
          },
          {
            protocol: 'Threads',
            limit: '500 chars',
            media: 'Images, video',
            notes: 'Threads API posting requires a linked Instagram account.',
          },
          {
            protocol: 'Reddit',
            limit: '40,000 chars (post body)',
            media: 'Images, links',
            notes: 'Cross-posting to Reddit requires a Reddit API credential.',
          },
          {
            protocol: 'RSS / Atom',
            limit: 'Source-dependent',
            media: 'Text, media enclosures',
            notes: 'Publishing via RSS requires a compatible publishing endpoint.',
          },
        ]}
      />

      <Callout type="info">
        Protocol availability for cross-posting depends on your plan. Free accounts can post to up
        to 3 protocols; <strong>Pro</strong> unlocks 10+; <strong>Creator+</strong> posts to every
        supported network. See the{' '}
        <a href="/docs/protocols" className="text-degen-400 underline">
          Protocol Guide
        </a>{' '}
        for full details on each network.
      </Callout>

      <H2 id="scheduling">Scheduling Cross-Posts</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Creator tier users can schedule posts to publish at a future time. Click the clock icon in
        the composer, choose your time and timezone, and select target protocols. Scheduled posts
        appear in <strong>Creator Studio</strong> where you can edit, reschedule, or cancel them
        before they go live.
      </p>

      <H2 id="best-practices">Best Practices</H2>
      <ul className="mt-4 space-y-2 text-sm text-[var(--color-muted)]">
        <li className="flex gap-2">
          <span className="text-degen-400">✓</span> Keep posts under 300 characters so they fit
          every protocol (Bluesky is the tightest common denominator).
        </li>
        <li className="flex gap-2">
          <span className="text-degen-400">✓</span> Use hashtags sparingly — Nostr and Mastodon
          index them differently than Farcaster.
        </li>
        <li className="flex gap-2">
          <span className="text-degen-400">✓</span> Attach media that every network supports
          (JPEG/PNG images, standard MP4/WebM video).
        </li>
        <li className="flex gap-2">
          <span className="text-degen-400">✓</span> Reply to engagement across protocols from the
          canonical post view — DegenFeed routes the reply to the correct network.
        </li>
      </ul>

      <H2 id="api">Cross-Posting via API</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Developers can publish programmatically through the DegenFeed API:
      </p>
      <CodeBlock lang="bash">{`# Publish to Nostr + Farcaster + Bluesky at once
curl -X POST https://degenfeed.xyz/api/publish \\
  -H "Authorization: Bearer $DEGENFEED_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Hello from the DegenFeed API 👋",
    "protocols": ["nostr", "farcaster", "bluesky"]
  }'`}</CodeBlock>
      <Callout type="info">
        The publish endpoint returns per-protocol status so you can retry only the networks that
        failed. See the{' '}
        <a href="/docs/api" className="text-degen-400 underline">
          API Reference
        </a>{' '}
        for full payload documentation.
      </Callout>

      <H2 id="troubleshooting">Troubleshooting</H2>
      <H3 id="post-failed-on-one-protocol">Post failed on one protocol?</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Check the per-protocol status in the composer after posting. Common causes: expired
        OAuth/app password, character limit exceeded, or a relay/instance that rejected the event.
        Reconnect the account in <strong>Settings → Connected Accounts</strong> and retry.
      </p>

      <div className="mt-12 border-t border-[var(--color-glass-border)] pt-6 text-center">
        <p className="text-xs text-[var(--color-muted)]">
          Next: read the{' '}
          <a href="/docs/video" className="text-degen-400 underline">
            Video Streaming Guide
          </a>{' '}
          or the{' '}
          <a href="/docs/user-guide" className="text-degen-400 underline">
            User Guide
          </a>
          .
        </p>
      </div>
    </div>
  );
}
