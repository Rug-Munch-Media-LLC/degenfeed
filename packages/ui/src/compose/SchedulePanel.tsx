'use client';

/**
 * @degenfeed/ui — schedule picker and active-schedule badge.
 */

export interface SchedulePanelProps {
  scheduledAt: Date | null;
  showPicker: boolean;
  minPickerStr: string;
  onPick: (at: Date) => void;
  onClear: () => void;
}

const CalendarIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    className="flex-shrink-0 text-[var(--color-accent)]"
  >
    <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M1.5 6h13" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export function SchedulePanel({
  scheduledAt,
  showPicker,
  minPickerStr,
  onPick,
  onClear,
}: SchedulePanelProps) {
  if (showPicker) {
    return (
      <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
        <label
          htmlFor="compose-schedule-at"
          className="flex items-center gap-2 text-sm font-medium text-[var(--color-fg)]"
        >
          <CalendarIcon />
          Schedule for
        </label>
        <input
          id="compose-schedule-at"
          type="datetime-local"
          min={minPickerStr}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) return;
            const picked = new Date(val);
            if (picked.getTime() <= Date.now() + 5 * 60 * 1000) return;
            onPick(picked);
          }}
          className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
        />
        <p className="mt-1.5 text-[11px] text-[var(--color-muted)]">
          Must be at least 5 minutes from now
        </p>
      </div>
    );
  }

  if (!scheduledAt) return null;

  return (
    <div
      className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2"
      role="status"
    >
      <CalendarIcon />
      <span className="text-xs text-[var(--color-fg)]">
        Scheduled for{' '}
        <time dateTime={scheduledAt.toISOString()}>
          {scheduledAt.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </time>
      </span>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto rounded p-0.5 text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        aria-label="Clear schedule"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M12 4L4 12M4 4l8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
