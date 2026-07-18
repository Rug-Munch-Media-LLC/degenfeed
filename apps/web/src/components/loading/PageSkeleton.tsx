/**
 * @components/loading/PageSkeleton — Reusable skeleton primitives for loading.tsx pages.
 *
 * Each page's loading.tsx composes these primitives to match its layout.
 * Uses the app's existing `animate-pulse` + `bg-[var(--color-muted)]` pattern.
 */

import type { ReactNode } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className || ''}`}
      style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
    />
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────

export function Line({ width = 'w-full', height = 'h-4' }: { width?: string; height?: string }) {
  return <SkeletonBlock className={`${width} ${height}`} />;
}

export function Avatar({ size = 'h-10 w-10' }: { size?: string }) {
  return <SkeletonBlock className={`${size} rounded-full shrink-0`} />;
}

export function Badge({ width = 'w-16' }: { width?: string }) {
  return <SkeletonBlock className={`${width} h-6 rounded-full`} />;
}

export function AspectRatio({ className }: { className?: string }) {
  return <SkeletonBlock className={`w-full aspect-video ${className || ''}`} />;
}

// ─── Composed Patterns ────────────────────────────────────────────────────

export function CardSkeleton({ children }: { children?: ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{ borderColor: 'var(--color-glass-border)' }}
    >
      {children || (
        <>
          <AspectRatio />
          <Line width="w-3/4" />
          <Line width="w-1/2" height="h-3" />
        </>
      )}
    </div>
  );
}

export function RowSkeleton({ avatar = true }: { avatar?: boolean }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-4"
      style={{ borderColor: 'var(--color-glass-border)' }}
    >
      {avatar && <Avatar />}
      <div className="flex-1 space-y-2">
        <Line width="w-2/5" height="h-4" />
        <Line width="w-3/4" height="h-3" />
      </div>
      <SkeletonBlock className="h-8 w-16 rounded-lg" />
    </div>
  );
}

export function FormFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Line width="w-24" height="h-3" />
      <SkeletonBlock className="h-10 w-full rounded-xl" />
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: 'var(--color-glass-border)' }}
    >
      <Line width="w-20" height="h-3" />
      <div className="mt-2 flex items-baseline gap-2">
        <SkeletonBlock className="h-8 w-16 rounded-lg" />
        <Line width="w-12" height="h-3" />
      </div>
    </div>
  );
}

// ─── Grid helpers ─────────────────────────────────────────────────────────

export function GridSkeleton({
  cols = 'sm:grid-cols-2 lg:grid-cols-3',
  count = 6,
}: {
  cols?: string;
  count?: number;
}) {
  return (
    <div className={`grid gap-4 ${cols}`}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <RowSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── Header skeleton (title + subtitle) ───────────────────────────────────

export function HeaderSkeleton({
  titleWidth = 'w-48',
  subtitleWidth = 'w-72',
}: {
  titleWidth?: string;
  subtitleWidth?: string;
}) {
  return (
    <div className="mb-8">
      <Line width={titleWidth} height="h-8" />
      <div className="mt-2">
        <Line width={subtitleWidth} height="h-4" />
      </div>
    </div>
  );
}

// ─── Sidebar + main layout ───────────────────────────────────────────────

export function ContentShellSkeleton({
  sidebar,
  children,
}: {
  sidebar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-12">
      <div className="lg:col-span-8 xl:col-span-9">{children}</div>
      {sidebar && <aside className="hidden space-y-4 lg:col-span-4 xl:col-span-3 lg:block">{sidebar}</aside>}
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-4">
      <CardSkeleton>
        <Line width="w-3/4" />
        <Line width="w-full" height="h-3" />
        <Line width="w-1/2" height="h-3" />
      </CardSkeleton>
      <CardSkeleton>
        <Line width="w-1/2" />
        {Array.from({ length: 5 }, (_, i) => (
          <Line key={i} width="w-full" height="h-3" />
        ))}
      </CardSkeleton>
      <SkeletonBlock className="h-32 w-full rounded-2xl" />
    </div>
  );
}
