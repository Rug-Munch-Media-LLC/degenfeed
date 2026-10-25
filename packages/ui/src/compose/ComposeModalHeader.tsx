'use client';

/**
 * @degenfeed/ui — composer dialog header.
 *
 * Title, parent-protocol badge, scheduled-posts toggle, keyboard hint, close.
 */

import { getProtocolColor, getProtocolIcon, getProtocolLabel } from '../ProtocolBadge';
import type { ReplyContext } from './types';

export interface ComposeModalHeaderProps {
  titleId: string;
  replyContext?: ReplyContext;
  scheduledCount: number;
  showScheduledView: boolean;
  onToggleScheduled: () => void;
  hasSchedule: boolean;
  onClose: () => void;
}

export function ComposeModalHeader({
  titleId,
  replyContext,
  scheduledCount,
  showScheduledView,
  onToggleScheduled,
  hasSchedule,
  onClose,
}: ComposeModalHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <h2 id={titleId} className="text-sm font-semibold text-[var(--color-fg)]">
          {replyContext ? 'Reply' : 'Compose'}
        </h2>
        {replyContext && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: `${getProtocolColor(replyContext.parentProtocol)}22`,
              color: getProtocolColor(replyContext.parentProtocol),
            }}
            title={`Parent post is on ${getProtocolLabel(replyContext.parentProtocol)}`}
          >
            <span className="text-[0.7em]" aria-hidden="true">
              {getProtocolIcon(replyContext.parentProtocol)}
            </span>
            {getProtocolLabel(replyContext.parentProtocol)}
          </span>
        )}
        {scheduledCount > 0 && (
          <button
            type="button"
            onClick={onToggleScheduled}
            aria-expanded={showScheduledView}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              showScheduledView
                ? 'bg-[var(--color-accent)] text-[var(--color-bg)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            Scheduled ({scheduledCount})
          </button>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <span className="hidden text-xs text-[var(--color-muted)] sm:inline">
          {hasSchedule ? 'Ctrl+Enter to schedule' : 'Ctrl+Enter to post'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-card)] hover:text-[var(--color-fg)]"
          aria-label="Close composer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" role="img" aria-label="Close">
            <title>Close</title>
            <path
              d="M12 4L4 12M4 4l8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
