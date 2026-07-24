'use client';

/**
 * NewPostsBanner — Animated pill that appears when new posts are available.
 * Slides in from the top with a satisfying bounce and glow.
 */

interface NewPostsBannerProps {
  count: number;
  onClick: () => void;
}

export function NewPostsBanner({ count, onClick }: NewPostsBannerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="new-posts-banner"
      aria-label={`Load ${count} new posts`}
    >
      <span className="notif-dot" />
      <span>
        {count} new {count === 1 ? 'post' : 'posts'} — tap to load
      </span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    </button>
  );
}
