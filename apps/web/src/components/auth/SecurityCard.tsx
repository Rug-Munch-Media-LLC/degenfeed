'use client';

import { type ReactNode, useState } from 'react';

/* ─── Status Badge ──────────────────────────────────────────── */

function StatusBadge({ status }: { status: 'active' | 'inactive' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
        status === 'active'
          ? 'bg-degen-500/15 text-degen-400 border border-degen-500/30'
          : 'bg-[var(--color-overlay)] text-[var(--color-muted)] border border-[var(--color-glass-border)]'
      }`}
    >
      {status === 'active' ? <span className="flex h-1.5 w-1.5 rounded-full bg-degen-400" /> : null}
      {status === 'active' ? 'Active' : 'Off'}
    </span>
  );
}

/* ─── Security Icon ─────────────────────────────────────────── */

function SecurityIcon({ icon }: { icon: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-overlay)] text-lg">
      {icon}
    </div>
  );
}

/* ─── Security Card ─────────────────────────────────────────── */

export interface SecurityCardProps {
  icon: string;
  title: string;
  description: string;
  status: 'active' | 'inactive';
  setupComponent: ReactNode;
  /** Optional action label override. Defaults to "Manage" when active, "Setup" when inactive. */
  actionLabel?: string;
  /** Optional hint text shown below the description when inactive */
  hint?: string;
}

export function SecurityCard({
  icon,
  title,
  description,
  status,
  setupComponent,
  actionLabel,
  hint,
}: SecurityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const btnLabel = actionLabel ?? (status === 'active' ? 'Manage' : 'Setup');

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] transition-all">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--color-overlay)]"
        aria-expanded={expanded}
      >
        <SecurityIcon icon={icon} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--color-fg)]">{title}</span>
            <span className="text-[10px] font-medium text-degen-400">
              {status === 'active' ? 'Recommended' : ''}
            </span>
          </div>
          <p className="text-xs text-[var(--color-muted)] line-clamp-1">{description}</p>
          {hint && status === 'inactive' && (
            <p className="mt-0.5 text-[11px] text-[var(--color-muted)] opacity-70">{hint}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <StatusBadge status={status} />
          <span className="text-xs font-medium text-degen-400 transition-colors hover:text-degen-300">
            {expanded ? 'Close' : btnLabel}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={`shrink-0 text-[var(--color-muted)] transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-glass-border)] px-5 py-4">
          {setupComponent}
        </div>
      )}
    </div>
  );
}
