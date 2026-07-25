'use client';

import type { DataInventoryItem } from '../types';

export function DataInventoryRow({ item }: { item: DataInventoryItem }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
      <span className="text-lg mt-0.5">{item.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[var(--color-fg)]">{item.category}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
              item.stored
                ? 'bg-degen-500/15 text-degen-400'
                : 'bg-[var(--color-muted-bg)] text-[var(--color-muted)]'
            }`}
          >
            {item.stored ? 'Stored' : 'Not stored'}
          </span>
          {!item.canBeDeleted && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-medium text-amber-400">
              Compliance required
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">{item.description}</p>
        <p className="text-[10px] text-[var(--color-muted)] mt-1">
          Retained for {item.retentionDays} days
          {!item.canBeDeleted && ' (GDPR Article 30 — security/compliance)'}
        </p>
      </div>
    </div>
  );
}
