'use client';

import { useMemo, useState } from 'react';

/* === Types ============================================ */

interface VestingConfig {
  initialUnlockBps: number;
  cliffDuration: number;
  vestingDuration: number;
}

interface VestingPreset {
  id: string;
  label: string;
  description: string;
  config: VestingConfig;
  locked: boolean;
  lockReason?: string;
}

interface VestingConfigPanelProps {
  config: VestingConfig;
  onChange: (config: VestingConfig) => void;
  creatorAllocation: number;
  supply: number;
}

/* === Presets ========================================== */

const PRESETS: VestingPreset[] = [
  {
    id: 'trustless',
    label: 'Trustless',
    description: '0% initial, 30d cliff, 90d vest — most anti-rug',
    config: { initialUnlockBps: 0, cliffDuration: 2_592_000, vestingDuration: 7_776_000 },
    locked: false,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: '5% initial, 7d cliff, 60d vest',
    config: { initialUnlockBps: 500, cliffDuration: 604_800, vestingDuration: 5_184_000 },
    locked: false,
  },
  {
    id: 'community',
    label: 'Community',
    description: '10% initial, no cliff, 30d vest — for trusted creators',
    config: { initialUnlockBps: 1_000, cliffDuration: 0, vestingDuration: 2_592_000 },
    locked: false,
  },
  {
    id: 'fast',
    label: 'Fast',
    description: '20% initial, no cliff, 7d vest — reputation-gated (90+ rep)',
    config: { initialUnlockBps: 2_000, cliffDuration: 0, vestingDuration: 604_800 },
    locked: true,
    lockReason: 'Requires reputation score ≥ 90',
  },
];

/* === Vesting Timeline Visualization =================== */

function VestingTimeline({
  config,
  allocationPct,
}: {
  config: VestingConfig;
  allocationPct: number;
}) {
  const totalDays = Math.ceil((config.cliffDuration + config.vestingDuration) / 86400);
  const daysToShow = Math.min(totalDays, 180); // cap visual at 180 days
  const segments: Array<{ label: string; pct: number; color: string }> = [];

  if (config.initialUnlockBps > 0) {
    segments.push({
      label: `${(config.initialUnlockBps / 100).toFixed(0)}% today`,
      pct: config.initialUnlockBps / 100,
      color: 'bg-degen-500',
    });
  }

  if (config.cliffDuration > 0) {
    const cliffDays = Math.ceil(config.cliffDuration / 86400);
    const cliffPct = Math.min(cliffDays / daysToShow, 1);
    segments.push({
      label: `${cliffDays}d cliff`,
      pct: cliffPct * (1 - config.initialUnlockBps / 10000),
      color: 'bg-yellow-500/60',
    });
  }

  if (config.vestingDuration > 0) {
    const vestPct =
      config.initialUnlockBps > 0 || config.cliffDuration > 0
        ? 100 - segments.reduce((s, seg) => s + seg.pct, 0)
        : 100;
    segments.push({
      label: `${Math.ceil(config.vestingDuration / 86400)}d vest`,
      pct: vestPct / 100,
      color: 'bg-blue-500/60',
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex h-5 overflow-hidden rounded-lg border border-[var(--color-border)]">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`${seg.color} flex-shrink-0 ${i === 0 ? 'rounded-l-lg' : ''} ${i === segments.length - 1 ? 'rounded-r-lg' : ''}`}
            style={{ width: `${Math.max(seg.pct * 100, 5)}%` }}
            title={seg.label}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
        {segments.map((seg, i) => (
          <span key={i}>{seg.label}</span>
        ))}
      </div>
      <div className="pt-1 text-center text-[10px] text-[var(--color-muted)]">
        {config.initialUnlockBps > 0 ? `${(config.initialUnlockBps / 100).toFixed(0)}%` : '0%'} at
        launch
        {' → '}
        {config.cliffDuration > 0
          ? `${Math.ceil(config.cliffDuration / 86400)}d cliff`
          : 'no cliff'}
        {' → '}
        {Math.ceil(config.vestingDuration / 86400)}d to 100%
      </div>
    </div>
  );
}

/* === Main Component =================================== */

export default function VestingConfigPanel({
  config,
  onChange,
  creatorAllocation,
  supply,
}: VestingConfigPanelProps) {
  const [activePreset, setActivePreset] = useState<string | null>(() => {
    const match = PRESETS.find(
      (p) =>
        p.config.initialUnlockBps === config.initialUnlockBps &&
        p.config.cliffDuration === config.cliffDuration &&
        p.config.vestingDuration === config.vestingDuration,
    );
    return match?.id ?? null;
  });

  const [customMode, setCustomMode] = useState(activePreset === null);

  // == Calculations ======================================

  const totalAllocation = (supply * creatorAllocation) / 100;
  const initialUnlockTokens = (totalAllocation * config.initialUnlockBps) / 10000;
  const postCliffTokens = totalAllocation - initialUnlockTokens;

  const scheduleRows = useMemo(() => {
    const rows: Array<{ label: string; day: number; pct: number }> = [];

    // Day 0
    rows.push({ label: 'Launch', day: 0, pct: config.initialUnlockBps / 100 });

    // Cliff end
    if (config.cliffDuration > 0) {
      const cliffDay = Math.ceil(config.cliffDuration / 86400);
      rows.push({ label: 'Cliff End', day: cliffDay, pct: config.initialUnlockBps / 100 });
    }

    // Milestones during vesting
    const totalDays = Math.ceil((config.cliffDuration + config.vestingDuration) / 86400);
    const milestones = [25, 50, 75, 100];
    for (const pct of milestones) {
      const vestDay = Math.ceil(
        config.cliffDuration / 86400 + (config.vestingDuration * pct) / 100 / 86400,
      );
      if (vestDay <= totalDays) {
        const vestedPct =
          config.initialUnlockBps / 100 + ((100 - config.initialUnlockBps / 100) * pct) / 100;
        rows.push({ label: `${pct}% Vested`, day: vestDay, pct: vestedPct });
      }
    }

    // Full vest
    rows.push({ label: '100% Vested', day: totalDays, pct: 100 });

    // De-duplicate by day
    const seen = new Set<number>();
    return rows.filter((r) => {
      if (seen.has(r.day)) return false;
      seen.add(r.day);
      return true;
    });
  }, [config]);

  // == Handlers ==========================================

  function selectPreset(preset: VestingPreset) {
    if (preset.locked) return;
    setActivePreset(preset.id);
    setCustomMode(false);
    onChange(preset.config);
  }

  function toggleCustom() {
    if (customMode) {
      // Switch back to trustless
      selectPreset(PRESETS[0]!);
    } else {
      setCustomMode(true);
      setActivePreset(null);
    }
  }

  // == Render ============================================

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[var(--color-fg)]">Vesting Schedule</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Configure how your creator allocation unlocks. All parameters are{' '}
          <strong className="text-degen-400">on-chain and immutable</strong> — no hidden bundles, no
          special backroom deals.
        </p>
      </div>

      {/* Allocation context */}
      <div className="rounded-lg border border-degen-500/20 bg-degen-500/5 p-3">
        <p className="text-[11px] text-[var(--color-muted)]">
          Your allocation: <strong className="text-[var(--color-fg)]">{creatorAllocation}%</strong>
          {' · '}
          <strong className="tabular-nums text-[var(--color-fg)]">
            {totalAllocation.toLocaleString()}
          </strong>{' '}
          tokens out of{' '}
          <strong className="tabular-nums text-[var(--color-fg)]">{supply.toLocaleString()}</strong>{' '}
          total supply
        </p>
      </div>

      {/* Presets */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--color-fg)]">Quick Select</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => selectPreset(preset)}
              disabled={preset.locked}
              className={`relative rounded-xl border p-3 sm:p-3 text-left transition-all touch-target ${
                activePreset === preset.id
                  ? 'border-degen-500 bg-degen-500/10 shadow-[0_0_12px_rgba(0,255,65,0.15)]'
                  : preset.locked
                    ? 'border-[var(--color-border)] bg-[var(--color-overlay)]/50 opacity-50 cursor-not-allowed'
                    : 'border-[var(--color-border)] bg-[var(--color-overlay)] hover:border-degen-500/30'
              }`}
              style={{ minHeight: 48 }}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`text-sm font-bold ${
                    activePreset === preset.id ? 'text-degen-400' : 'text-[var(--color-fg)]'
                  }`}
                >
                  {preset.label}
                </span>
                {activePreset === preset.id && <span className="text-degen-400 text-xs">✓</span>}
              </div>
              <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">{preset.description}</p>
              {preset.locked && preset.lockReason && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-yellow-400">
                  <svg
                    aria-hidden="true"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  {preset.lockReason}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Custom config link */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleCustom}
          className={`text-[11px] underline transition-colors ${
            customMode ? 'text-degen-400' : 'text-[var(--color-muted)] hover:text-degen-400'
          }`}
        >
          {customMode ? '← Back to presets' : 'Custom configuration'}
        </button>
      </div>

      {/* Custom sliders (only when custom mode is active) */}
      {customMode && (
        <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-4">
          <p className="text-xs font-medium text-[var(--color-fg)]">Custom Parameters</p>

          {/* Initial unlock */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-[var(--color-muted)]">Initial Unlock</span>
              <span className="text-xs font-medium tabular-nums text-[var(--color-fg)]">
                {(config.initialUnlockBps / 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={3000}
              step={100}
              value={config.initialUnlockBps}
              onChange={(e) => onChange({ ...config, initialUnlockBps: Number(e.target.value) })}
              className="w-full accent-degen-500"
            />
            <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
              <span>0%</span>
              <span>30% max</span>
            </div>
          </div>

          {/* Cliff */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-[var(--color-muted)]">Cliff Duration</span>
              <span className="text-xs font-medium tabular-nums text-[var(--color-fg)]">
                {config.cliffDuration === 0
                  ? 'None'
                  : `${Math.round(config.cliffDuration / 86400)} days`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={90}
              step={1}
              value={Math.round(config.cliffDuration / 86400)}
              onChange={(e) => {
                const days = Number(e.target.value);
                onChange({ ...config, cliffDuration: days * 86400 });
              }}
              className="w-full accent-degen-500"
            />
            <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
              <span>No cliff</span>
              <span>90 days max</span>
            </div>
          </div>

          {/* Vesting duration */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-[var(--color-muted)]">Vesting Duration</span>
              <span className="text-xs font-medium tabular-nums text-[var(--color-fg)]">
                {Math.round(config.vestingDuration / 86400)} days
              </span>
            </div>
            <input
              type="range"
              min={7}
              max={730}
              step={1}
              value={Math.round(config.vestingDuration / 86400)}
              onChange={(e) => {
                const days = Number(e.target.value);
                onChange({ ...config, vestingDuration: days * 86400 });
              }}
              className="w-full accent-degen-500"
            />
            <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
              <span>7 days min</span>
              <span>2 years max</span>
            </div>
          </div>
        </div>
      )}

      {/* Visual Timeline */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-4">
        <p className="mb-2 text-xs font-semibold text-[var(--color-fg)]">Vesting Timeline</p>
        <VestingTimeline config={config} allocationPct={creatorAllocation} />

        {/* Schedule table */}
        <div className="mt-4 space-y-1">
          {scheduleRows.map((row) => (
            <div
              key={row.day}
              className="flex justify-between rounded px-2 py-1 text-[11px] hover:bg-[var(--color-overlay)]"
            >
              <span className="text-[var(--color-muted)]">
                {row.label}
                {row.day > 0 && (
                  <span className="text-[10px] text-[var(--color-muted)]"> (Day {row.day})</span>
                )}
              </span>
              <span className="font-medium tabular-nums text-[var(--color-fg)]">
                {row.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Token breakdown */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Initial Unlock
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-degen-400">
            {initialUnlockTokens.toLocaleString()}
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">
            {(config.initialUnlockBps / 100).toFixed(1)}% of your allocation
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Vested Remaining
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-fg)]">
            {postCliffTokens.toLocaleString()}
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">
            {config.cliffDuration > 0
              ? `Locked for ${Math.round(config.cliffDuration / 86400)} days`
              : 'Vesting starts immediately'}
          </p>
        </div>
      </div>

      {/* Transparency notice */}
      <div className="rounded-lg border border-degen-500/20 bg-degen-500/5 p-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-degen-400 text-xs">🔒</span>
          <div>
            <p className="text-[11px] font-medium text-degen-400">Fully Transparent & Immutable</p>
            <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
              Your vesting schedule is written on-chain at deployment and can never be changed. No
              hidden bundles, no special terms — what you see here is what gets deployed. Community
              members can verify the exact parameters by reading the contract.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
