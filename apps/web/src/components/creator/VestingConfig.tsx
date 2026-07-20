'use client';

import { useMemo, useState } from 'react';

/* ─── Types ──────────────────────────────────────────── */

interface VestingConfigValue {
  presetId: string;
  initialUnlockPercent: number;
  cliffDays: number;
  vestingDays: number;
  creatorAllocationPercent: number;
}

interface VestingConfigProps {
  value: VestingConfigValue;
  onChange: (value: VestingConfigValue) => void;
  reputationScore?: number;
  accountAgeDays?: number;
  totalSupply?: number;
}

interface PresetData {
  id: string;
  label: string;
  description: string;
  initialUnlockPercent: number;
  cliffDays: number;
  vestingDays: number;
  available: boolean;
  lockedReason?: string;
}

/* ─── Presets ────────────────────────────────────────── */

const PRESET_DEFINITIONS: Array<{
  id: string;
  label: string;
  description: string;
  initialUnlockPercent: number;
  cliffDays: number;
  vestingDays: number;
}> = [
  {
    id: 'QUICK',
    label: 'Quick Access',
    description: 'Get most of your tokens quickly. Best for established creators.',
    initialUnlockPercent: 20,
    cliffDays: 0,
    vestingDays: 30,
  },
  {
    id: 'STANDARD',
    label: 'Standard',
    description: 'Balanced approach. Good for most creators.',
    initialUnlockPercent: 10,
    cliffDays: 7,
    vestingDays: 90,
  },
  {
    id: 'CONSERVATIVE',
    label: 'Community Trust',
    description: 'Slow unlock builds community confidence. Shows long-term commitment.',
    initialUnlockPercent: 5,
    cliffDays: 30,
    vestingDays: 180,
  },
  {
    id: 'MAXIMUM_TRUST',
    label: 'Maximum Trust',
    description: 'Zero initial unlock. Full vesting over 2 years. Signals extreme commitment.',
    initialUnlockPercent: 0,
    cliffDays: 90,
    vestingDays: 730,
  },
];

/* ─── Helpers ────────────────────────────────────────── */

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* ─── Preset Card ────────────────────────────────────── */

function VestingPresetCard({
  preset,
  selected,
  onClick,
}: {
  preset: PresetData;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!preset.available}
      className={`relative rounded-xl border p-4 text-left transition-all ${
        selected
          ? 'border-degen-500 bg-degen-500/10 shadow-[0_0_12px_rgba(0,255,65,0.15)]'
          : !preset.available
            ? 'border-[var(--color-border)] bg-[var(--color-overlay)]/50 opacity-50 cursor-not-allowed'
            : 'border-[var(--color-border)] bg-[var(--color-overlay)] hover:border-degen-500/30'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span
            className={`text-sm font-bold ${
              selected ? 'text-degen-400' : 'text-[var(--color-fg)]'
            }`}
          >
            {preset.label}
          </span>
          <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--color-muted)]">
            {preset.description}
          </p>
        </div>
        {selected && <span className="ml-2 text-degen-400 text-xs">&#10003;</span>}
      </div>

      {/* Quick stats */}
      <div className="mt-2 flex gap-3 text-[10px] text-[var(--color-muted)]">
        <span>{preset.initialUnlockPercent}% initial</span>
        <span>{preset.cliffDays > 0 ? `${preset.cliffDays}d cliff` : 'no cliff'}</span>
        <span>{preset.vestingDays}d vest</span>
      </div>

      {!preset.available && preset.lockedReason && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-yellow-400">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {preset.lockedReason}
        </div>
      )}
    </button>
  );
}

/* ─── Timeline Visualization ─────────────────────────── */

function VestingTimeline({
  initialUnlockPercent,
  cliffDays,
  vestingDays,
}: {
  initialUnlockPercent: number;
  cliffDays: number;
  vestingDays: number;
}) {
  const totalDays = cliffDays + vestingDays;

  // Calculate segment widths as percentages
  const cliffWidth = cliffDays > 0 ? (cliffDays / totalDays) * (100 - initialUnlockPercent) : 0;
  const vestWidth = 100 - initialUnlockPercent - cliffWidth;

  return (
    <div className="space-y-2">
      {/* Timeline bar */}
      <div className="relative flex h-8 overflow-hidden rounded-lg border border-[var(--color-border)]">
        {initialUnlockPercent > 0 && (
          <div
            className="flex items-center justify-center bg-degen-500 text-[9px] font-bold text-black"
            style={{ width: `${Math.max(initialUnlockPercent, 5)}%` }}
          >
            {initialUnlockPercent}%
          </div>
        )}
        {cliffWidth > 0 && (
          <div
            className="flex items-center justify-center bg-yellow-500/60 text-[9px] font-medium text-yellow-100"
            style={{ width: `${Math.max(cliffWidth, 5)}%` }}
          >
            {cliffDays}d cliff
          </div>
        )}
        {vestWidth > 0 && (
          <div
            className="flex items-center justify-center bg-blue-500/60 text-[9px] font-medium text-white"
            style={{ width: `${Math.max(vestWidth, 5)}%` }}
          >
            {vestingDays}d vest
          </div>
        )}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
        <span>Launch</span>
        {cliffDays > 0 && <span>Cliff (Day {cliffDays})</span>}
        <span>Fully Vested (Day {totalDays})</span>
      </div>

      {/* Detailed breakdown */}
      <div className="pt-1 text-center text-[10px] text-[var(--color-muted)]">
        <strong className="text-degen-400">{initialUnlockPercent}%</strong> at launch
        {cliffDays > 0 && (
          <>
            {' \u2192 '}nothing for <strong className="text-yellow-400">{cliffDays} days</strong>
          </>
        )}
        {' \u2192 '}linear vest over <strong className="text-blue-400">{vestingDays} days</strong>
      </div>
    </div>
  );
}

/* ─── Supply Allocation Slider ───────────────────────── */

function SupplyAllocationSlider({
  value,
  onChange,
  totalSupply,
}: {
  value: number;
  onChange: (pct: number) => void;
  totalSupply?: number;
}) {
  const creatorTokens = totalSupply ? Math.round((totalSupply * value) / 100) : 0;
  const communityTokens = totalSupply ? totalSupply - creatorTokens : 0;

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-[var(--color-fg)]">Supply Allocation</h4>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-muted)]">Creator (you) &mdash; vested</span>
          <span className="text-xs font-bold tabular-nums text-degen-400">{value}%</span>
        </div>

        <input
          type="range"
          min={5}
          max={15}
          step={0.5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-degen-500"
          aria-label="Creator allocation percentage"
        />

        <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
          <span>5% minimum</span>
          <span>15% maximum</span>
        </div>

        {/* Visual split bar */}
        {totalSupply && totalSupply > 0 && (
          <div className="flex h-4 overflow-hidden rounded-md border border-[var(--color-border)]">
            <div
              className="flex items-center justify-center bg-degen-500/70 text-[8px] font-bold text-black"
              style={{ width: `${value}%` }}
            >
              {formatCompact(creatorTokens)}
            </div>
            <div
              className="flex items-center justify-center bg-[var(--color-overlay)] text-[8px] text-[var(--color-muted)]"
              style={{ width: `${100 - value}%` }}
            >
              {formatCompact(communityTokens)}
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] leading-relaxed text-[var(--color-muted)]">
        Creator allocation range: <strong>5-15%</strong>. Higher allocation means more tokens for
        you but less for the community to trade. Most creators choose <strong>8-10%</strong> for a
        good balance.
      </p>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────── */

export default function VestingConfig({
  value,
  onChange,
  reputationScore = 0,
  accountAgeDays = 0,
  totalSupply = 0,
}: VestingConfigProps) {
  // Build presets with availability
  const presets: PresetData[] = useMemo(() => {
    return PRESET_DEFINITIONS.map((def) => {
      // Custom availability logic (in production, check with API)
      const available =
        reputationScore >= getRequiredRep(def.id) && accountAgeDays >= getRequiredAge(def.id);
      const lockedReason = !available
        ? reputationScore < getRequiredRep(def.id)
          ? `Requires reputation score \u2265 ${getRequiredRep(def.id)} (you have ${reputationScore})`
          : `Requires account age \u2265 ${getRequiredAge(def.id)} days (you have ${accountAgeDays} days)`
        : undefined;

      return {
        ...def,
        available,
        lockedReason,
      };
    });
  }, [reputationScore, accountAgeDays]);

  const [customMode, setCustomMode] = useState(() => value.presetId === 'CUSTOM');

  // Derived calculations
  const fullyVestedDate = useMemo(() => {
    const totalDays = value.cliffDays + value.vestingDays;
    return formatDate(Date.now() + totalDays * 86400000);
  }, [value.cliffDays, value.vestingDays]);

  const scheduleRows = useMemo(() => {
    const rows: Array<{ label: string; day: number; pct: number }> = [];

    // Day 0 — initial unlock
    rows.push({ label: 'Launch', day: 0, pct: value.initialUnlockPercent });

    // Cliff end
    if (value.cliffDays > 0) {
      rows.push({
        label: 'Cliff Ends',
        day: value.cliffDays,
        pct: value.initialUnlockPercent,
      });
    }

    // Vesting milestones
    const totalDays = value.cliffDays + value.vestingDays;
    const remainingPct = 100 - value.initialUnlockPercent;
    const milestones = [25, 50, 75];
    for (const milestone of milestones) {
      const day = Math.round(value.cliffDays + (value.vestingDays * milestone) / 100);
      if (day < totalDays) {
        rows.push({
          label: `${milestone}% Vested`,
          day,
          pct: value.initialUnlockPercent + (remainingPct * milestone) / 100,
        });
      }
    }

    // Fully vested
    rows.push({ label: '100% Vested', day: totalDays, pct: 100 });

    // Deduplicate by day
    const seen = new Set<number>();
    return rows.filter((r) => {
      if (seen.has(r.day)) return false;
      seen.add(r.day);
      return true;
    });
  }, [value]);

  // Handlers
  function selectPreset(preset: PresetData) {
    if (!preset.available) return;
    setCustomMode(false);
    onChange({
      ...value,
      presetId: preset.id,
      initialUnlockPercent: preset.initialUnlockPercent,
      cliffDays: preset.cliffDays,
      vestingDays: preset.vestingDays,
    });
  }

  function toggleCustom() {
    if (customMode) {
      // Switch back to STANDARD
      const standard = presets.find((p) => p.id === 'STANDARD');
      if (standard) selectPreset(standard);
    } else {
      setCustomMode(true);
      onChange({
        ...value,
        presetId: 'CUSTOM',
      });
    }
  }

  // ── Render ────────────────────────────────────────────

  return (
    <div className="vesting-config space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-[var(--color-fg)]">Vesting Schedule</h3>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
          Vesting determines when you receive your creator token allocation. Slower vesting builds
          more community trust. Faster vesting gives you quicker access. All parameters are{' '}
          <strong className="text-degen-400">on-chain and immutable</strong>.
        </p>
      </div>

      {/* Preset selector */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--color-fg)]">Choose Your Vesting Schedule</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {presets.map((preset) => (
            <VestingPresetCard
              key={preset.id}
              preset={preset}
              selected={value.presetId === preset.id && !customMode}
              onClick={() => selectPreset(preset)}
            />
          ))}
        </div>
      </div>

      {/* Custom toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleCustom}
          className={`text-[11px] underline transition-colors ${
            customMode ? 'text-degen-400' : 'text-[var(--color-muted)] hover:text-degen-400'
          }`}
        >
          {customMode ? '\u2190 Back to presets' : 'Custom configuration'}
        </button>
      </div>

      {/* Custom sliders */}
      {customMode && (
        <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-4">
          <p className="text-xs font-semibold text-[var(--color-fg)]">Custom Parameters</p>

          {/* Initial unlock */}
          <div>
            <div className="flex justify-between mb-1">
              <label htmlFor="vesting-initial-unlock" className="text-xs text-[var(--color-muted)]">
                Initial Unlock
              </label>
              <span className="text-xs font-bold tabular-nums text-[var(--color-fg)]">
                {value.initialUnlockPercent}%
              </span>
            </div>
            <input
              id="vesting-initial-unlock"
              type="range"
              min={0}
              max={30}
              step={1}
              value={value.initialUnlockPercent}
              onChange={(e) => onChange({ ...value, initialUnlockPercent: Number(e.target.value) })}
              className="w-full accent-degen-500"
            />
            <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
              <span>0% (maximum trust)</span>
              <span>30% max</span>
            </div>
          </div>

          {/* Cliff */}
          <div>
            <div className="flex justify-between mb-1">
              <label htmlFor="vesting-cliff-duration" className="text-xs text-[var(--color-muted)]">
                Cliff Duration
              </label>
              <span className="text-xs font-bold tabular-nums text-[var(--color-fg)]">
                {value.cliffDays === 0 ? 'No cliff' : `${value.cliffDays} days`}
              </span>
            </div>
            <input
              id="vesting-cliff-duration"
              type="range"
              min={0}
              max={365}
              step={1}
              value={value.cliffDays}
              onChange={(e) => onChange({ ...value, cliffDays: Number(e.target.value) })}
              className="w-full accent-degen-500"
            />
            <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
              <span>No cliff</span>
              <span>365 days max</span>
            </div>
          </div>

          {/* Vesting duration */}
          <div>
            <div className="flex justify-between mb-1">
              <label htmlFor="vesting-duration" className="text-xs text-[var(--color-muted)]">
                Vesting Duration
              </label>
              <span className="text-xs font-bold tabular-nums text-[var(--color-fg)]">
                {value.vestingDays} days
              </span>
            </div>
            <input
              id="vesting-duration"
              type="range"
              min={7}
              max={730}
              step={1}
              value={value.vestingDays}
              onChange={(e) => onChange({ ...value, vestingDays: Number(e.target.value) })}
              className="w-full accent-degen-500"
            />
            <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
              <span>7 days min</span>
              <span>2 years max</span>
            </div>
          </div>
        </div>
      )}

      {/* Visual timeline */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-4">
        <h4 className="mb-3 text-xs font-semibold text-[var(--color-fg)]">
          Your Token Unlock Schedule
        </h4>

        <VestingTimeline
          initialUnlockPercent={value.initialUnlockPercent}
          cliffDays={value.cliffDays}
          vestingDays={value.vestingDays}
        />

        {/* Schedule table */}
        {scheduleRows.length > 0 && (
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
                <span className="font-bold tabular-nums text-[var(--color-fg)]">
                  {row.pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Supply allocation */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-4">
        <SupplyAllocationSlider
          value={value.creatorAllocationPercent}
          onChange={(pct) => onChange({ ...value, creatorAllocationPercent: pct })}
          totalSupply={totalSupply}
        />
      </div>

      {/* What this means — clear explanation */}
      <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 p-4">
        <h4 className="text-xs font-bold text-degen-400">What this means:</h4>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-[var(--color-muted)]">
          <li>
            <strong className="text-[var(--color-fg)]">{value.initialUnlockPercent}%</strong> of
            your tokens are available immediately at launch
          </li>
          {value.cliffDays > 0 && (
            <li>
              Nothing unlocks for the first{' '}
              <strong className="text-[var(--color-fg)]">{value.cliffDays} days</strong> (cliff
              period)
            </li>
          )}
          <li>
            The remaining{' '}
            <strong className="text-[var(--color-fg)]">{100 - value.initialUnlockPercent}%</strong>{' '}
            unlocks linearly over{' '}
            <strong className="text-[var(--color-fg)]">{value.vestingDays} days</strong>
          </li>
          <li>
            You&apos;ll be fully vested on{' '}
            <strong className="text-[var(--color-fg)]">{fullyVestedDate}</strong>
          </li>
          <li>
            Your allocation:{' '}
            <strong className="text-degen-400">{value.creatorAllocationPercent}%</strong> of total
            supply
            {totalSupply > 0 && (
              <>
                {' '}
                ({formatCompact(Math.round((totalSupply * value.creatorAllocationPercent) / 100))}{' '}
                tokens)
              </>
            )}
          </li>
        </ul>
      </div>

      {/* Transparency notice */}
      <div className="rounded-lg border border-degen-500/20 bg-degen-500/5 p-3">
        <div className="flex items-start gap-2">
          <div>
            <p className="text-[11px] font-medium text-degen-400">
              Fully Transparent &amp; Immutable
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--color-muted)]">
              Your vesting schedule is written on-chain at deployment and can never be changed. No
              hidden bundles, no special terms. Community members can verify the exact parameters by
              reading the contract. DegenFeed charges a 0.50% platform fee on all tips and trades.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers (scoped) ──────────────────────────────────

function getRequiredRep(presetId: string): number {
  switch (presetId) {
    case 'QUICK':
      return 60;
    default:
      return 0;
  }
}

function getRequiredAge(presetId: string): number {
  switch (presetId) {
    case 'QUICK':
      return 30;
    default:
      return 0;
  }
}
