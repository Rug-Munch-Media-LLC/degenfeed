'use client';

import type { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  accent?: string;
  trend?: { direction: 'up' | 'down' | 'neutral'; value: string };
  className?: string;
}

export default function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
  trend,
  className = '',
}: StatCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-all duration-200 hover:shadow-md ${className}`}
    >
      {accent && (
        <div
          className="absolute right-0 top-0 h-16 w-16 translate-x-4 -translate-y-4 rounded-full opacity-10"
          style={{ background: accent }}
        />
      )}

      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            {label}
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-[var(--color-fg)]">{value}</span>
            {trend && (
              <span
                className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
                  trend.direction === 'up'
                    ? 'text-degen-400'
                    : trend.direction === 'down'
                      ? 'text-red-400'
                      : 'text-[var(--color-muted)]'
                }`}
              >
                {trend.direction === 'up' && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path
                      d="M5 1v8M1 5l4-4 4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {trend.direction === 'down' && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path
                      d="M5 9V1M1 5l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {trend.value}
              </span>
            )}
          </div>
          {sub && <span className="mt-0.5 block text-[10px] text-[var(--color-muted)]">{sub}</span>}
        </div>
        {icon && (
          <div className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-overlay)]">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export { StatCard };
