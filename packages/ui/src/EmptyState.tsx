/**
 * @degenfeed/ui — EmptyState
 *
 * Reusable empty-state view with icon, title, description, and optional CTA.
 * Premium visual design with glass-morphism card, gradient icon container,
 * and refined typography. Wraps content with `role="status"` for a11y.
 */

import { type FC, memo, type ReactNode } from 'react';

export interface EmptyStateProps {
  /** Emoji or icon element to display */
  icon?: string;
  /** Optional custom icon element (overrides `icon` string) */
  iconElement?: ReactNode;
  /** Primary heading */
  title: string;
  /** Supporting description */
  description?: string;
  /** Optional CTA button(s) rendered below the description */
  action?: ReactNode;
  /** Optional secondary action */
  secondaryAction?: ReactNode;
  /** Optional compact mode for inline empty states (less padding) */
  compact?: boolean;
}

export const EmptyState: FC<EmptyStateProps> = memo(function EmptyState({
  icon,
  iconElement,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'px-4 py-8' : 'px-6 py-16 sm:py-20'
      } ${compact ? '' : 'frosted-card mx-4 my-6'}`}
      role="status"
    >
      {iconElement ? (
        <div className="empty-state-icon" aria-hidden="true">
          {iconElement}
        </div>
      ) : icon ? (
        <div
          className="empty-state-icon"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(135deg, var(--color-accent-glow), rgba(139, 92, 246, 0.12))',
            boxShadow: '0 0 30px color-mix(in srgb, var(--color-accent) 10%, transparent)',
          }}
        >
          <span className="text-2xl">{icon}</span>
        </div>
      ) : null}
      <h3
        className="mb-2 text-base font-bold"
        style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}
      >
        {title}
      </h3>
      {description && (
        <p className="mx-auto mb-6 max-w-xs text-sm text-[var(--color-muted)] leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="flex flex-wrap items-center justify-center gap-3">{action}</div>}
      {secondaryAction && <div className="mt-3">{secondaryAction}</div>}
    </div>
  );
});

/* ─── Inline Empty Row ─────────────────────────────────────── */

export interface EmptyRowProps {
  colSpan?: number;
  message?: string;
}

export const EmptyRow: FC<EmptyRowProps> = memo(function EmptyRow({
  colSpan,
  message = 'No data',
}) {
  return (
    <tr>
      <td
        colSpan={colSpan ?? 1}
        className="px-4 py-8 text-center text-sm text-[var(--color-muted)]"
        role="status"
      >
        {message}
      </td>
    </tr>
  );
});
