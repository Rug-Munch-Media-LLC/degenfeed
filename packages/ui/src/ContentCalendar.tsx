'use client';

import { useCallback, useMemo, useState } from 'react';

/* ─── Types ─── */

export interface CalendarPost {
  id: string;
  text: string;
  scheduledAt: string; // ISO 8601
  targets: string[];
  protocol?: string;
  status?: 'scheduled' | 'published' | 'draft' | 'failed';
}

export interface ContentCalendarProps {
  posts: CalendarPost[];
  onReschedule?: (postId: string, newDate: Date) => void;
  onEdit?: (post: CalendarPost) => void;
  onDelete?: (postId: string) => void;
  onPublishNow?: (postId: string) => void;
}

/* ─── Protocol colors (matching app) ─── */

const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
  threads: '#888888',
  ethereum: '#627eea',
  solana: '#9945ff',
  reddit: '#ff4500',
  telegram: '#26a5e4',
  discord: '#5865f2',
  medium: '#12100e',
  linkedin: '#0a66c2',
};

const PROTOCOL_ICONS: Record<string, string> = {
  nostr: '☰',
  farcaster: '◈',
  lens: '◎',
  bluesky: '☁',
  mastodon: '🐘',
  threads: '⊞',
  ethereum: '◆',
  solana: '◎',
  reddit: '🔴',
  telegram: '✈',
  discord: '💬',
  medium: 'M',
  linkedin: 'in',
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#00ff41',
  published: '#627eea',
  draft: '#71767b',
  failed: '#f4212e',
};

/* ─── Helpers ─── */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/* ─── Post Chip ─── */

function PostChip({
  post,
  onEdit,
  onDelete,
  onPublishNow,
  compact,
}: {
  post: CalendarPost;
  onEdit?: (post: CalendarPost) => void;
  onDelete?: (postId: string) => void;
  onPublishNow?: (postId: string) => void;
  compact?: boolean;
}) {
  const primaryProtocol = post.protocol || post.targets[0] || 'unknown';
  const color = PROTOCOL_COLORS[primaryProtocol] || '#666';
  const icon = PROTOCOL_ICONS[primaryProtocol] || '📝';
  const statusColor = STATUS_COLORS[post.status || 'scheduled'];

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onEdit?.(post)}
        title={`${post.text.slice(0, 60)} — ${formatTime(post.scheduledAt)}`}
        className="group relative w-full rounded px-1 py-0.5 text-[10px] font-medium text-left truncate transition-opacity hover:opacity-80"
        style={{ backgroundColor: `${color}18`, color }}
      >
        {icon} {post.text.slice(0, 20)}
      </button>
    );
  }

  return (
    <div
      className="group relative rounded-xl border bg-[var(--color-card)] p-3 text-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
      style={{ borderColor: `${color}33` }}
    >
      {/* Protocol bar */}
      <div
        className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
        style={{ backgroundColor: color }}
      />

      <div className="mt-1">
        {/* Header with status */}
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-xs" aria-hidden="true">
            {icon}
          </span>
          <span className="text-[11px] font-medium text-[var(--color-muted)]">
            {primaryProtocol}
          </span>
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
            style={{ backgroundColor: `${statusColor}18`, color: statusColor }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
            {post.status || 'scheduled'}
          </span>
        </div>

        {/* Content */}
        <p className="mb-2 text-xs leading-relaxed text-[var(--color-fg)] line-clamp-2">
          {post.text}
        </p>

        {/* Targets */}
        {post.targets.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {post.targets.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium"
                style={{
                  backgroundColor: `${PROTOCOL_COLORS[t] || '#666'}18`,
                  color: PROTOCOL_COLORS[t] || '#666',
                }}
              >
                {PROTOCOL_ICONS[t] || '?'} {t}
              </span>
            ))}
          </div>
        )}

        {/* Time & Actions */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2">
          <span className="text-[10px] tabular-nums text-[var(--color-muted)]">
            {formatTime(post.scheduledAt)}
          </span>
          <div className="flex gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(post);
                }}
                className="rounded px-1.5 py-0.5 text-[10px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
                aria-label="Edit post"
              >
                Edit
              </button>
            )}
            {onPublishNow && post.status === 'scheduled' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPublishNow(post.id);
                }}
                className="rounded px-1.5 py-0.5 text-[10px] text-degen-400 transition-colors hover:bg-degen-500/10"
                aria-label="Publish now"
              >
                Publish
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(post.id);
                }}
                className="rounded px-1.5 py-0.5 text-[10px] text-red-400 transition-colors hover:bg-red-500/10"
                aria-label="Delete post"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Week View ─── */

function WeekView({
  weekDates,
  posts,
  onEdit,
  onDelete,
  onPublishNow,
}: {
  weekDates: Date[];
  posts: CalendarPost[];
  onEdit?: (post: CalendarPost) => void;
  onDelete?: (postId: string) => void;
  onPublishNow?: (postId: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)]">
      {DAYS.map((day) => (
        <div
          key={day}
          className="bg-[var(--color-card)] px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]"
        >
          {day}
        </div>
      ))}
      {weekDates.map((date) => {
        const dateStr = date.toISOString().split('T')[0] ?? '';
        const isToday = date.getTime() === today.getTime();
        const dayPosts = posts.filter((p) => p.scheduledAt.startsWith(dateStr));

        return (
          <div
            key={dateStr}
            className={`min-h-[100px] bg-[var(--color-card)] p-1.5 transition-colors ${
              isToday ? 'bg-degen-500/5' : ''
            }`}
          >
            <span
              className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                isToday ? 'bg-degen-500 text-black' : 'text-[var(--color-muted)]'
              }`}
            >
              {date.getDate()}
            </span>
            <div className="space-y-0.5">
              {dayPosts.map((post) => (
                <PostChip
                  key={post.id}
                  post={post}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onPublishNow={onPublishNow}
                  compact
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Month View ─── */

function MonthView({
  year,
  month,
  posts,
  onEdit,
  onDelete,
  onPublishNow,
}: {
  year: number;
  month: number;
  posts: CalendarPost[];
  onEdit?: (post: CalendarPost) => void;
  onDelete?: (postId: string) => void;
  onPublishNow?: (postId: string) => void;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)]">
      {DAYS.map((day) => (
        <div
          key={day}
          className="bg-[var(--color-card)] px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]"
        >
          {day}
        </div>
      ))}
      {cells.map((day, idx) => {
        if (day === null) {
          return <div key={`empty-${idx}`} className="bg-[var(--color-card)] min-h-[80px]" />;
        }
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0] ?? '';
        const isToday = date.getTime() === today.getTime();
        const dayPosts = posts.filter((p) => p.scheduledAt.startsWith(dateStr));
        const maxVisible = 3;
        const hidden = dayPosts.length - maxVisible;

        return (
          <div
            key={dateStr}
            className={`min-h-[80px] bg-[var(--color-card)] p-1 transition-colors ${
              isToday ? 'bg-degen-500/5' : ''
            }`}
          >
            <span
              className={`mb-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                isToday ? 'bg-degen-500 text-black' : 'text-[var(--color-muted)]'
              }`}
            >
              {day}
            </span>
            <div className="space-y-0.5">
              {dayPosts.slice(0, maxVisible).map((post) => (
                <PostChip
                  key={post.id}
                  post={post}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onPublishNow={onPublishNow}
                  compact
                />
              ))}
              {hidden > 0 && (
                <span className="block text-[9px] font-medium text-[var(--color-muted)] px-1">
                  +{hidden} more
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Drag-and-drop hook ─── */

function useDragAndDrop(
  posts: CalendarPost[],
  onReschedule?: (postId: string, newDate: Date) => void,
) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const handleDragStart = useCallback((postId: string) => {
    setDraggedId(postId);
  }, []);

  const handleDragOver = useCallback((dateStr: string) => {
    setDropTarget(dateStr);
  }, []);

  const handleDrop = useCallback(
    (dateStr: string) => {
      if (!draggedId || !onReschedule) return;
      const post = posts.find((p) => p.id === draggedId);
      if (!post) return;
      // Preserve the time from original schedule, apply new date
      const original = new Date(post.scheduledAt);
      const [hours, minutes] = [original.getHours(), original.getMinutes()];
      const newDate = new Date(
        `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`,
      );
      onReschedule(draggedId, newDate);
      setDraggedId(null);
      setDropTarget(null);
    },
    [draggedId, posts, onReschedule],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDropTarget(null);
  }, []);

  return { draggedId, dropTarget, handleDragStart, handleDragOver, handleDrop, handleDragEnd };
}

/* ─── Main Component ─── */

export default function ContentCalendar({
  posts,
  onReschedule,
  onEdit,
  onDelete,
  onPublishNow,
}: ContentCalendarProps) {
  const now = new Date();
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { draggedId, dropTarget, handleDrop } = useDragAndDrop(posts, onReschedule);

  // Get the current week dates for week view
  const weekDates = useMemo(() => {
    const startOfMonth = new Date(year, month, 1);
    const dayOfWeek = startOfMonth.getDay();
    const weekStart = new Date(startOfMonth);
    weekStart.setDate(weekStart.getDate() - dayOfWeek);

    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [year, month]);

  const sortedPosts = useMemo(
    () =>
      [...posts].sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      ),
    [posts],
  );

  const upcomingPosts = useMemo(
    () => sortedPosts.filter((p) => new Date(p.scheduledAt) > now).slice(0, 5),
    [sortedPosts, now],
  );

  const handlePrevMonth = useCallback(() => {
    setCurrentDate(new Date(year, month - 1, 1));
  }, [year, month]);

  const handleNextMonth = useCallback(() => {
    setCurrentDate(new Date(year, month + 1, 1));
  }, [year, month]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }, [now]);

  /* ─── Drag-and-drop on calendar cells ─── */

  const renderCalendar = () => {
    if (viewMode === 'week') {
      return (
        <div
          role="application"
          aria-label="Calendar week view"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dropTarget) handleDrop(dropTarget);
          }}
        >
          <WeekView
            weekDates={weekDates}
            posts={sortedPosts}
            onEdit={onEdit}
            onDelete={onDelete}
            onPublishNow={onPublishNow}
          />
        </div>
      );
    }

    return (
      <div
        role="application"
        aria-label="Calendar month view"
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          if (dropTarget) handleDrop(dropTarget);
        }}
      >
        <MonthView
          year={year}
          month={month}
          posts={sortedPosts}
          onEdit={onEdit}
          onDelete={onDelete}
          onPublishNow={onPublishNow}
        />
      </div>
    );
  };

  const postCount = posts.length;
  const publishedCount = posts.filter((p) => p.status === 'published').length;
  const scheduledCount = posts.filter((p) => p.status === 'scheduled').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Content Calendar</h2>
          <p className="text-sm text-[var(--color-muted)]">
            {postCount} post{postCount !== 1 ? 's' : ''} · {publishedCount} published ·{' '}
            {scheduledCount} scheduled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex rounded-lg border border-[var(--color-border)] p-0.5"
            role="tablist"
            aria-label="Calendar view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'month'}
              onClick={() => setViewMode('month')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'week'}
              onClick={() => setViewMode('week')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="btn-ghost inline-flex h-8 w-8 items-center justify-center rounded-lg p-0"
            aria-label="Previous month"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M9 3L5 7l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">
            {MONTHS[month]} {year}
          </h3>
          <button
            type="button"
            onClick={handleNextMonth}
            className="btn-ghost inline-flex h-8 w-8 items-center justify-center rounded-lg p-0"
            aria-label="Next month"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M5 3l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <button type="button" onClick={handleToday} className="btn-secondary text-[11px] px-3 py-1">
          Today
        </button>
      </div>

      {/* Calendar */}
      {renderCalendar()}

      {/* Drag-and-drop hint */}
      {onReschedule && (
        <p className="text-center text-[10px] text-[var(--color-muted)]">
          {draggedId ? 'Drop on a date to reschedule' : 'Drag posts to reschedule'}
        </p>
      )}

      {/* Upcoming posts list */}
      {upcomingPosts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">Upcoming</h3>
          <div className="space-y-2">
            {upcomingPosts.map((post) => (
              <PostChip
                key={post.id}
                post={post}
                onEdit={onEdit}
                onDelete={onDelete}
                onPublishNow={onPublishNow}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {posts.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-overlay)] text-lg text-[var(--color-muted)]">
            📅
          </div>
          <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">No scheduled posts</h3>
          <p className="text-xs text-[var(--color-muted)]">
            Schedule your first post from the composer to see it here.
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[10px] text-[var(--color-muted)]">
        <span className="flex items-center gap-1">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: STATUS_COLORS.scheduled }}
          />
          Scheduled
        </span>
        <span className="flex items-center gap-1">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: STATUS_COLORS.published }}
          />
          Published
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.draft }} />
          Draft
        </span>
        <span className="flex items-center gap-1">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: STATUS_COLORS.failed }}
          />
          Failed
        </span>
      </div>
    </div>
  );
}

export { ContentCalendar };
