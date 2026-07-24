'use client';

import type { Section } from './types';
import { SECTION_LABELS } from './types';

export function SettingsSection({
  section,
  isOpen,
  onToggle,
  children,
}: {
  section: Section;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const meta = SECTION_LABELS[section];
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] transition-all">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--color-overlay)]"
        aria-expanded={isOpen}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-degen-500/10 text-degen-400">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={meta.icon} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--color-fg)]">{meta.label}</div>
          <div className="text-xs text-[var(--color-muted)] truncate">{meta.desc}</div>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={`shrink-0 text-[var(--color-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div className="border-t border-[var(--color-glass-border)] px-5 py-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}
