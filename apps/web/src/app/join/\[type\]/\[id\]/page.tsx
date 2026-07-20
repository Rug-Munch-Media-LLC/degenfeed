/**
 * @app/join/[type]/[id] — Unified cross-network stream/space join page.
 *
 * This is the landing page for anyone clicking a DegenFeed link from:
 *   Mastodon, Bluesky, Farcaster, Nostr, Threads, Lens, or anywhere else.
 *
 * Features:
 *   - Platform detection via referrer + URL params
 *   - Platform-appropriate greeting with dismiss
 *   - Anonymous viewing (no sign-in required)
 *   - Guest chat with platform-aware labeling
 *   - Tip creator via wallet connect (no account needed)
 *   - One-click sign-up from the source platform
 *   - Cross-platform share back to any protocol
 *
 * Routes:
 *   /join/stream/:id  →  Stream join view
 *   /join/space/:id   →  Space join view
 *   /join/coin/:id    →  Coin launch join view (future)
 */

import { type Metadata, type OpenGraph } from 'next';
import { JoinPageClient } from './client';

/* ─── Generate metadata based on join type ─────────────────────── */

interface JoinPageParams {
  type: string;
  id: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<JoinPageParams>;
}): Promise<Metadata> {
  const { type: joinType, id } = await params;

  const typeLabel = joinType === 'stream' ? 'Stream' : joinType === 'space' ? 'Space' : 'Page';
  const title = `Join ${typeLabel} — DegenFeed`;
  const description =
    joinType === 'stream'
      ? 'Watch the stream live on DegenFeed. No account required — chat as a guest and tip the creator.'
      : joinType === 'space'
        ? 'Join the audio space on DegenFeed. Listen without an account, react, and tip the host.'
        : `Join this ${joinType} on DegenFeed.`;

  const metadata: Metadata = {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://app.degenfeed.xyz/join/${joinType}/${id}`,
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };

  return metadata;
}

/* ─── Server page shell ─────────────────────────────────────────── */

export default async function JoinPage({
  params,
}: {
  params: Promise<JoinPageParams>;
}) {
  const { type: joinType, id } = await params;

  // Validate type
  if (joinType !== 'stream' && joinType !== 'space' && joinType !== 'coin') {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-8 py-12 text-center">
          <span className="mb-4 text-4xl" aria-hidden="true">
            🔗
          </span>
          <h1 className="mb-2 text-lg font-bold text-[var(--color-fg)]">Invalid Link</h1>
          <p className="mb-6 text-sm text-[var(--color-muted)]">
            This join link type is not recognized. Please check the URL and try again.
          </p>
          <a
            href="/"
            className="rounded-xl bg-degen-500 px-5 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  return <JoinPageClient type={joinType as 'stream' | 'space' | 'coin'} id={id} />;
}
