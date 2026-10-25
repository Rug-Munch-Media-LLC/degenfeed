'use client';

/**
 * @degenfeed/ui — upcoming scheduled posts with cancel / publish-now actions.
 */

import type { ScheduledPostItem } from './types';

export interface ScheduledPostsPanelProps {
  posts: ScheduledPostItem[];
  onPublishNow?: (id: string) => void;
  onCancel?: (id: string) => void;
}

const formatScheduledItem = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString(
    'en-US',
    { hour: 'numeric', minute: '2-digit' },
  )}`;
};

export function ScheduledPostsPanel({ posts, onPublishNow, onCancel }: ScheduledPostsPanelProps) {
  if (posts.length === 0) return null;
  return (
    <section className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
      <h3 className="mb-2 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
        Upcoming Scheduled Posts
      </h3>
      <ul className="flex list-none flex-col gap-2 p-0">
        {posts.map((post) => (
          <li
            key={post.id}
            className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-[var(--color-fg)]">{post.text || '(empty)'}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                <time dateTime={post.scheduledAt}>{formatScheduledItem(post.scheduledAt)}</time>
                <span aria-hidden="true">·</span>
                <span>
                  {post.targets.length} network{post.targets.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-1">
              {onPublishNow && (
                <button
                  type="button"
                  onClick={() => onPublishNow(post.id)}
                  className="rounded px-2 py-1 text-[11px] font-medium text-[var(--color-success)] transition-colors hover:bg-[var(--color-card)]"
                >
                  Post now
                </button>
              )}
              {onCancel && (
                <button
                  type="button"
                  onClick={() => onCancel(post.id)}
                  className="rounded px-2 py-1 text-[11px] font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-danger)]"
                >
                  Cancel
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
