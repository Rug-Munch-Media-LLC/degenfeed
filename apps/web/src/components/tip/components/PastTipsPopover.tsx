'use client';

import type { PastTip } from '../types';

export function PastTipsPopover({
  pastTips,
  totalTipsUsd,
  onClose,
}: {
  pastTips: PastTip[];
  totalTipsUsd: number;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-2xl backdrop-blur-xl"
      onMouseLeave={onClose}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[var(--color-fg)]">💰 Past Tips</h3>
        <span className="text-xs font-bold text-degen-400">${totalTipsUsd.toFixed(2)}</span>
      </div>

      <div className="max-h-40 space-y-1 overflow-y-auto">
        {pastTips.length === 0 ? (
          <p className="text-[10px] text-[var(--color-muted)]">No tips yet</p>
        ) : (
          pastTips.slice(0, 10).map((tip, i) => (
            <div
              key={`${tip.tipperName}-${tip.at}-${i}`}
              className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-[var(--color-card)] transition-colors"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {i === 0 && (
                  <span className="shrink-0" title="Top Tipper">
                    👑
                  </span>
                )}
                <span className="truncate text-[10px] text-[var(--color-fg)]">
                  {tip.tipperName}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-medium text-[var(--color-fg)]">
                  ${tip.amountUsd.toFixed(2)}
                </span>
                <span className="text-[8px] text-[var(--color-muted)]">{tip.method}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {pastTips.length > 0 && (
        <div className="mt-2 rounded-lg bg-amber-900/10 border border-amber-900/30 px-2 py-1.5">
          <p className="text-[9px] text-amber-400">
            👑 <strong>Top Tipper:</strong> {pastTips[0]!.tipperName} ($
            {pastTips[0]!.amountUsd.toFixed(2)})
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="mt-2 w-full rounded-lg bg-[var(--color-card)] px-2 py-1 text-[9px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
      >
        Close
      </button>
    </div>
  );
}
