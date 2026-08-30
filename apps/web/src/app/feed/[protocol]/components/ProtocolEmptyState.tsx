'use client';

/**
 * @degenfeed/web — ProtocolEmptyState
 *
 * Protocol-specific empty states with CTAs for the /feed/[protocol] pages.
 * Every empty feed offers:
 *  - "No posts yet" headline with honest, protocol-flavored copy
 *  - a "Try refreshing" button
 *  - a "Browse popular instead" link to /feed/{protocol}/popular
 */

import Link from 'next/link';
import { getProtocolInfo } from './protocolMeta';

interface ProtocolEmptyStateProps {
  protocol: string;
  sort?: string;
  onRetry?: () => void;
}

interface EmptyCopy {
  icon: string;
  title: string;
  body: string;
  cta?: { label: string; href: string; external?: boolean };
}

const EMPTY_COPY: Record<string, EmptyCopy> = {
  nostr: {
    icon: '⚡',
    title: 'No Nostr notes yet',
    body: 'No notes from connected relays right now. Follow some npubs or connect your nsec to see your feed.',
    cta: { label: 'Connect Nostr', href: '/settings?tab=nostr' },
  },
  farcaster: {
    icon: '◈',
    title: 'No Farcaster casts yet',
    body: 'The Farcaster feed is quiet while Hubble syncs. Link your FID to see your feed.',
    cta: { label: 'Link your FID', href: '/settings?tab=farcaster' },
  },
  bluesky: {
    icon: '☁',
    title: 'No Bluesky posts yet',
    body: 'Nothing from the AT Protocol right now. Follow some handles or connect your Bluesky account.',
    cta: { label: 'Connect Bluesky', href: '/settings?tab=bluesky' },
  },
  lens: {
    icon: '◎',
    title: 'No Lens publications yet',
    body: 'The Lens graph is quiet here. Follow profiles or connect your Lens profile to see publications.',
    cta: { label: 'Connect Lens', href: '/settings?tab=lens' },
  },
  mastodon: {
    icon: '🐘',
    title: 'The fediverse is quiet here',
    body: 'No toots from connected instances right now. Discover Mastodon communities and follow some accounts.',
    cta: { label: 'Discover communities', href: '/discover' },
  },
  lemmy: {
    icon: '🗣',
    title: 'No Lemmy posts yet',
    body: 'No posts from connected Lemmy instances. Browse communities to find discussions.',
    cta: { label: 'Browse communities', href: '/communities' },
  },
  reddit: {
    icon: '🔴',
    title: 'No Reddit posts yet',
    body: 'Reddit data is currently unavailable — the Redlib instance may be down or rate-limited. Try again in a moment.',
    cta: { label: 'Retry', href: '' },
  },
  rss: {
    icon: '📰',
    title: 'No articles yet',
    body: 'No RSS articles from your sources at the moment. New stories arrive every hour — this feed fills up fast.',
  },
};

export function ProtocolEmptyState({ protocol, sort, onRetry }: ProtocolEmptyStateProps) {
  const info = getProtocolInfo(protocol);
  const copy = EMPTY_COPY[protocol] ?? {
    icon: info.icon,
    title: `No ${info.label} posts yet`,
    body: `No ${sort === 'videos' ? 'media' : ''} posts from this protocol right now. Try a different sort order or check back later.`,
    cta: { label: 'Retry', href: '' },
  };

  return (
    <div
      className="mt-6 rounded-xl border py-10 text-center"
      role="status"
      style={{ borderColor: `${info.color}20`, backgroundColor: `${info.color}04` }}
    >
      <div
        className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
        style={{ backgroundColor: `${info.color}15`, color: info.color }}
        aria-hidden="true"
      >
        {copy.icon}
      </div>
      <h3 className="mb-1 text-base font-bold" style={{ color: info.color }}>
        {copy.title}
      </h3>
      <p className="mx-auto max-w-xs text-sm leading-relaxed text-[var(--color-muted)]">
        {copy.body}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {copy.cta?.href ? (
          <Link
            href={copy.cta.href}
            target={copy.cta.external ? '_blank' : undefined}
            rel={copy.cta.external ? 'noopener noreferrer' : undefined}
            className="inline-flex min-h-[44px] items-center rounded-lg px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ backgroundColor: info.color }}
          >
            {copy.cta.label}
          </Link>
        ) : (
          onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-[44px] items-center rounded-lg px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ backgroundColor: info.color }}
            >
              Retry
            </button>
          )
        )}

        {/* Try refreshing */}
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8a5 5 0 019.9-1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M13 3v4H9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Try refreshing
        </button>
      </div>

      {/* Browse popular instead */}
      <p className="mt-5 text-xs text-[var(--color-muted)]">
        <Link
          href={`/feed/${encodeURIComponent(protocol)}/popular`}
          className="font-semibold transition-colors hover:underline"
          style={{ color: info.color }}
        >
          Browse popular {info.label} posts instead
        </Link>{' '}
        — the most engaged posts from this network.
      </p>
    </div>
  );
}
