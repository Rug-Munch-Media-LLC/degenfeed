// Server-safe empty state — no React hooks, no "use client" directive.

export interface PostCardEmptyProps {
  /** Primary heading text */
  title?: string;
  /** Supporting description */
  description?: string;
  /** Optional action label (renders a button) */
  actionLabel?: string;
  /** Called when action button is clicked */
  onAction?: () => void;
  /** Optional icon/emoji */
  icon?: string;
}

/**
 * Empty state for a single post card slot.
 * Shown when a post slot has no content to display (e.g. filtered out,
 * blocked, or removed).
 * Server-safe: no hooks, no "use client" dependency.
 */
export function PostCardEmpty({
  title = 'No post to show',
  description = 'This post may have been removed or is no longer available.',
  actionLabel,
  onAction,
  icon = '○',
}: PostCardEmptyProps) {
  return (
    <div
      className="post-card border-b border-[var(--color-border)] px-4 py-8 text-center"
      role="status"
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-muted)]/20">
        <span className="text-lg text-[var(--color-muted)]" aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className="mb-1 text-sm font-medium text-[var(--color-fg)]">{title}</p>
      {description && (
        <p className="mx-auto mb-4 max-w-xs text-xs text-[var(--color-muted)]">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
