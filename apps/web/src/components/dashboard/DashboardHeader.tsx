'use client';

/**
 * DashboardHeader — top section of the creator dashboard
 *
 * Shows the title "Creator Dashboard" with a time range selector
 * for filtering the data view.
 */

import { useAuth } from '../AuthProvider';

type TimeRange = '7d' | '30d' | '90d';

interface DashboardHeaderProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  onRefresh: () => void;
  lastUpdated: number | null;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export function DashboardHeader({
  timeRange,
  onTimeRangeChange,
  onRefresh,
  lastUpdated,
}: DashboardHeaderProps) {
  const { walletAddress } = useAuth();

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      {/* Title + wallet */}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-[var(--color-fg)] tracking-tight">
          Creator Dashboard
        </h1>
        {walletAddress && (
          <p className="text-xs text-[var(--color-muted)] mt-0.5 font-mono truncate max-w-[280px] sm:max-w-[400px]">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </p>
        )}
      </div>

      {/* Time range + refresh */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Time range tabs */}
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden bg-[var(--color-card)]">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              type="button"
              onClick={() => onTimeRangeChange(range.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                timeRange === range.value
                  ? 'bg-[var(--color-accent)] text-black'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
              title={`Show data for the last ${range.label}`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* Last updated */}
        {lastUpdated && (
          <span className="text-[10px] text-[var(--color-muted)] hidden sm:block">
            Updated {formatTime(lastUpdated)}
          </span>
        )}

        {/* Refresh button */}
        <button
          type="button"
          onClick={onRefresh}
          className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors"
          title="Refresh data"
          aria-label="Refresh dashboard data"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
