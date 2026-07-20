'use client';

interface FeeConfigPanelProps {
  /** Fee in basis points (1 bp = 0.01%) */
  feeBps: number;
  onFeeChange: (bps: number) => void;
  error?: string;
  className?: string;
}

const FEE_PRESETS = [
  { bps: 0, label: '0%', desc: 'No fee' },
  { bps: 50, label: '0.5%', desc: 'Low' },
  { bps: 100, label: '1%', desc: 'Standard' },
  { bps: 250, label: '2.5%', desc: 'Premium' },
  { bps: 500, label: '5%', desc: 'High' },
];

const FEE_LIMITS = {
  min: 0,
  max: 1000, // 10% max
};

export default function FeeConfigPanel({
  feeBps,
  onFeeChange,
  error,
  className = '',
}: FeeConfigPanelProps) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 ${className}`}
    >
      <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">Creator Fee</h3>
      <p className="mb-4 text-xs text-[var(--color-muted)]">
        Set a fee on trades during the prebonding period. This goes to you (and any revenue splits
        you configure).
      </p>

      {/* Preset buttons — responsive grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {FEE_PRESETS.map((preset) => (
          <button
            key={preset.bps}
            type="button"
            onClick={() => onFeeChange(preset.bps)}
            className={`rounded-lg border px-2 py-2.5 text-center transition-all touch-target ${
              feeBps === preset.bps
                ? 'border-degen-500/40 bg-degen-500/15 text-degen-400'
                : 'border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-muted)] hover:border-degen-500/20 hover:text-[var(--color-fg)]'
            }`}
            aria-pressed={feeBps === preset.bps}
          >
            <div className="text-sm font-bold tabular-nums">{preset.label}</div>
            <div className="text-[8px] sm:text-[9px] text-[var(--color-muted)]">{preset.desc}</div>
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div className="mt-4">
        <label className="mb-1.5 block text-[11px] font-medium text-[var(--color-muted)]">
          Custom fee (basis points)
        </label>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
          <input
            type="number"
            value={feeBps}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(val)) {
                onFeeChange(Math.max(FEE_LIMITS.min, Math.min(FEE_LIMITS.max, val)));
              }
            }}
            min={FEE_LIMITS.min}
            max={FEE_LIMITS.max}
            className="input w-full sm:w-28 tabular-nums"
            aria-label="Fee in basis points"
          />
          <span className="text-xs text-[var(--color-muted)]">
            = {(feeBps / 100).toFixed(2)}% · Max {FEE_LIMITS.max / 100}%
          </span>
        </div>
        {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
      </div>

      {/* Info box */}
      <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
        <p className="text-[10px] text-blue-400">
          💡 Fees are only charged on trades during the prebonding phase. Once graduated, normal DEX
          trading fees apply. Revenue splits can distribute this fee to multiple recipients.
        </p>
      </div>
    </div>
  );
}
