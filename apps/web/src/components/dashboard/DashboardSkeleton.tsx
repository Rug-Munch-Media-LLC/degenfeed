'use client';

/**
 * DashboardSkeleton — full-page loading skeleton
 *
 * Renders a placeholder layout that matches the dashboard structure
 * while analytics data is being fetched.
 */

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-7 w-48 rounded-lg bg-[var(--color-muted)]/20 mb-1" />
          <div className="h-3 w-36 rounded bg-[var(--color-muted)]/10" />
        </div>
        <div className="h-8 w-32 rounded-lg bg-[var(--color-muted)]/10" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
          >
            <div className="h-3 w-20 rounded bg-[var(--color-muted)]/20 mb-2" />
            <div className="h-7 w-28 rounded bg-[var(--color-muted)]/20 mb-1" />
            <div className="h-3 w-16 rounded bg-[var(--color-muted)]/10" />
          </div>
        ))}
      </div>

      {/* Two-column layout skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div className="h-4 w-32 rounded bg-[var(--color-muted)]/20 mb-4" />
            <div className="h-48 rounded bg-[var(--color-muted)]/10" />
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div className="h-4 w-28 rounded bg-[var(--color-muted)]/20 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 rounded bg-[var(--color-muted)]/10" />
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div className="h-4 w-24 rounded bg-[var(--color-muted)]/20 mb-4" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-3 w-full rounded bg-[var(--color-muted)]/10" />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div className="h-4 w-28 rounded bg-[var(--color-muted)]/20 mb-4" />
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 rounded-full bg-[var(--color-muted)]/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-full rounded bg-[var(--color-muted)]/10" />
                <div className="h-3 w-3/4 rounded bg-[var(--color-muted)]/10" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
