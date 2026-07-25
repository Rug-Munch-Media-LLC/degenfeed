'use client';

export function OptimizeSection({
  migrationCount,
  potentialSavings,
  onOptimize,
  optimizing,
}: {
  migrationCount: number;
  potentialSavings: number;
  onOptimize: () => void;
  optimizing: boolean;
}) {
  if (migrationCount === 0) {
    return (
      <div className="rounded-xl border border-green-500/10 bg-green-500/5 p-4 text-center">
        <span className="text-lg">✅</span>
        <p className="mt-1 text-[10px] text-green-400">
          Your storage is already optimally distributed.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-xs font-semibold text-degen-400">
            🚀 Storage Optimization Available
          </h4>
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">
            {migrationCount} file{migrationCount !== 1 ? 's' : ''} can be migrated to cheaper
            storage.
          </p>
          {potentialSavings > 0 && (
            <p className="text-[10px] text-green-400 tabular-nums mt-0.5">
              Potential savings: ~${potentialSavings.toFixed(4)}/mo
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onOptimize}
          disabled={optimizing}
          className="rounded-lg bg-degen-500/15 px-3 py-1.5 text-[10px] font-bold text-degen-400 hover:bg-degen-500/25 disabled:opacity-50 transition-all"
        >
          {optimizing ? 'Optimizing...' : 'Optimize Storage'}
        </button>
      </div>
    </div>
  );
}
