'use client';

export function MenuTrigger({
  isOpen,
  hasPastTips,
  pastTipsLabel,
  totalTipsUsd,
  compact,
  authorDisplayName,
  onToggle,
  onShowPastTips,
  showPastTips,
}: {
  isOpen: boolean;
  hasPastTips: boolean;
  pastTipsLabel: string | null;
  totalTipsUsd: number;
  compact: boolean;
  authorDisplayName: string;
  onToggle: () => void;
  onShowPastTips: () => void;
  showPastTips: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-all ${
          compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'
        } ${
          isOpen
            ? 'bg-degen-500/15 text-degen-400'
            : 'text-[var(--color-muted)] hover:bg-degen-500/10 hover:text-degen-400'
        }`}
        aria-label={`Tip ${authorDisplayName}`}
        aria-expanded={isOpen}
      >
        <svg
          width={compact ? '12' : '14'}
          height={compact ? '12' : '14'}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
          <path d="M8.5 8.5v.01" />
          <path d="M16 15a4 4 0 0 0-8 0" />
        </svg>
        <span>{compact ? '' : 'Tip'}</span>
      </button>

      {hasPastTips && (
        <button
          type="button"
          onClick={onShowPastTips}
          onMouseEnter={() => !showPastTips && onShowPastTips()}
          onMouseLeave={() => showPastTips && onShowPastTips()}
          className="rounded-md px-1.5 py-0.5 text-[9px] text-[var(--color-muted)] hover:text-degen-400 transition-colors"
          title={pastTipsLabel ?? undefined}
        >
          ${totalTipsUsd.toFixed(0)}
        </button>
      )}
    </div>
  );
}
