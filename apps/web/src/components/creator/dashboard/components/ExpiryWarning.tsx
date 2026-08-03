'use client';

import { formatSize } from '../constants';
import type { ExpiringVideo } from '../types';

export function ExpiryWarning({
  items,
  onSave,
}: {
  items: ExpiringVideo[];
  onSave?: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-yellow-400 text-sm">⚠️</span>
        <h4 className="text-xs font-semibold text-yellow-400">
          {items.length} video{items.length !== 1 ? 's' : ''} expiring soon
        </h4>
      </div>
      <p className="mb-3 text-[10px] text-[var(--color-muted)]">
        VODs older than 30 days (unwatched) or 90 days (watched) will be cleaned up unless saved.
      </p>
      <div className="space-y-1.5">
        {items.slice(0, 5).map((item) => (
          <div
            key={item.contentId}
            className="flex items-center justify-between rounded-lg bg-yellow-500/5 px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-yellow-400">📄</span>
              <span className="text-[10px] text-[var(--color-fg)] truncate max-w-[160px]">
                {item.title ?? item.contentId}
              </span>
              {item.tier && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">
                  {item.tier}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] text-yellow-400 tabular-nums">
                {item.daysLeft}d left
              </span>
              {item.size && (
                <span className="text-[9px] text-[var(--color-muted)] tabular-nums">
                  {formatSize(item.size)}
                </span>
              )}
              {onSave && (
                <button
                  type="button"
                  onClick={() => onSave(item.contentId)}
                  className="rounded bg-yellow-500/15 px-2 py-0.5 text-[9px] font-medium text-yellow-400 hover:bg-yellow-500/25 transition-colors"
                >
                  Save
                </button>
              )}
            </div>
          </div>
        ))}
        {items.length > 5 && (
          <p className="text-[9px] text-[var(--color-muted)] text-center pt-1">
            +{items.length - 5} more
          </p>
        )}
      </div>
    </div>
  );
}
