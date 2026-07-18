'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/* ─── Category-specific empty state presets ────────────────── */

export type EmptyCategory =
  | 'feed'
  | 'notifications'
  | 'messages'
  | 'bookmarks'
  | 'search'
  | 'generic';

interface EmptyStatePreset {
  icon: string;
  illustration: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

function FeedIllustration() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="empty-state-svg"
    >
      <rect
        x="4"
        y="8"
        width="40"
        height="8"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.2"
      />
      <rect
        x="4"
        y="20"
        width="40"
        height="8"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.15"
      />
      <rect
        x="4"
        y="32"
        width="40"
        height="8"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.1"
      />
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.4" />
      <circle cx="12" cy="24" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="12" cy="36" r="2" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

function NotificationsIllustration() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="empty-state-svg"
    >
      <path
        d="M24 6v2M14 18c0-6 4-10 10-10s10 4 10 10v4l3 6H11l3-6v-4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.25"
      />
      <path
        d="M18 34a6 6 0 0012 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.2"
      />
      <circle cx="24" cy="12" r="2" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

function MessagesIllustration() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="empty-state-svg"
    >
      <path
        d="M8 10a2 2 0 012-2h28a2 2 0 012 2v20a2 2 0 01-2 2H18l-6 6V12a2 2 0 00-4 0v26"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.25"
      />
      <circle cx="16" cy="20" r="2" fill="currentColor" opacity="0.4" />
      <circle cx="24" cy="20" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="32" cy="20" r="2" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

function BookmarksIllustration() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="empty-state-svg"
    >
      <path
        d="M14 6h20v36l-10-8-10 8V6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.25"
      />
      <path
        d="M20 14h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M20 20h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
      <circle cx="18" cy="14" r="1.5" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

function SearchIllustration() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="empty-state-svg"
    >
      <circle cx="20" cy="20" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <path
        d="M28 28l8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.2"
      />
      <circle cx="20" cy="20" r="2" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

function GenericIllustration() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="empty-state-svg"
    >
      <rect
        x="8"
        y="6"
        width="32"
        height="36"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.2"
      />
      <circle cx="24" cy="20" r="4" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <path
        d="M18 30c0-4 3-6 6-6s6 2 6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.2"
      />
    </svg>
  );
}

const presets: Record<EmptyCategory, EmptyStatePreset> = {
  feed: {
    icon: '📡',
    illustration: <FeedIllustration />,
    title: 'Your feed is empty',
    description:
      'Follow creators to get started. Discover people across Nostr, Farcaster, Lens, and more.',
    actionLabel: 'Discover Creators',
    actionHref: '/discover',
  },
  notifications: {
    icon: '🔔',
    illustration: <NotificationsIllustration />,
    title: 'No notifications yet',
    description:
      'Engage with posts to get notified. Reply, like, and follow to light up your inbox.',
    actionLabel: 'Explore Feed',
    actionHref: '/feed',
  },
  messages: {
    icon: '💬',
    illustration: <MessagesIllustration />,
    title: 'No messages yet',
    description: 'Find someone to chat with. Start a conversation from any profile.',
    actionLabel: 'Browse Communities',
    actionHref: '/c',
  },
  bookmarks: {
    icon: '🔖',
    illustration: <BookmarksIllustration />,
    title: 'No bookmarks yet',
    description: 'Bookmark posts to save them for later. Tap the bookmark icon on any post.',
    actionLabel: 'Browse Feed',
    actionHref: '/feed',
  },
  search: {
    icon: '🔍',
    illustration: <SearchIllustration />,
    title: 'No results found',
    description: 'Try different keywords or filters. Something simple often works best.',
  },
  generic: {
    icon: '📭',
    illustration: <GenericIllustration />,
    title: 'Nothing here yet',
    description:
      'This space is waiting for content. Check back soon or explore other parts of the app.',
    actionLabel: 'Go Home',
    actionHref: '/feed',
  },
};

/* ─── Component ────────────────────────────────────────────── */

interface EmptyStateProps {
  /** Category preset or custom emoji icon */
  category?: EmptyCategory;
  icon?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export function EmptyState({
  category,
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  size = 'md',
}: EmptyStateProps) {
  // Resolve preset
  const preset = category ? presets[category] : null;
  const resolvedIcon = icon ?? preset?.icon ?? '📭';
  const resolvedTitle = title ?? preset?.title ?? 'Nothing here yet';
  const resolvedDescription =
    description ?? preset?.description ?? 'This space is waiting for content.';
  const resolvedActionLabel = actionLabel ?? preset?.actionLabel;
  const resolvedActionHref = actionHref ?? preset?.actionHref;

  const sizeClasses = size === 'sm' ? 'py-12 px-4' : size === 'lg' ? 'py-28 px-4' : 'py-20 px-4';

  return (
    <div className={`mx-auto max-w-md text-center ${sizeClasses}`}>
      {/* Illustration (animated) */}
      <div className="empty-state-icon" aria-hidden="true">
        {preset?.illustration ?? <span className="text-[1.75rem]">{resolvedIcon}</span>}
      </div>

      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">{resolvedTitle}</h2>

      {resolvedDescription && (
        <p className="mb-6 text-sm text-[var(--color-muted)] leading-relaxed">
          {resolvedDescription}
        </p>
      )}

      {resolvedActionLabel && resolvedActionHref ? (
        <Link
          href={resolvedActionHref}
          className="inline-flex items-center gap-1.5 rounded-lg bg-degen-500/20 px-5 py-2.5 text-sm font-semibold text-degen-400 transition-all hover:bg-degen-500/30 hover:shadow-[0_0_16px_rgba(0,255,65,0.12)] active:scale-[0.97]"
        >
          {resolvedActionLabel}
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M6 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      ) : resolvedActionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1.5 rounded-lg bg-degen-500/20 px-5 py-2.5 text-sm font-semibold text-degen-400 transition-all hover:bg-degen-500/30 hover:shadow-[0_0_16px_rgba(0,255,65,0.12)] active:scale-[0.97]"
        >
          {resolvedActionLabel}
        </button>
      ) : null}
    </div>
  );
}
