'use client';

import Link from 'next/link';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

/**
 * Reusable empty state component for pages with no data.
 */
export function EmptyState({
  icon = '📭',
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <span className="mb-4 inline-block text-4xl opacity-40" aria-hidden="true">
        {icon}
      </span>
      <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">{title}</h2>
      {description && (
        <p className="mb-6 text-sm text-[var(--color-muted)]">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-block rounded-lg bg-degen-500/20 px-5 py-2.5 text-sm font-semibold text-degen-400 transition-colors hover:bg-degen-500/30"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <button
          type="button"
          onClick={onAction}
          className="rounded-lg bg-degen-500/20 px-5 py-2.5 text-sm font-semibold text-degen-400 transition-colors hover:bg-degen-500/30"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
