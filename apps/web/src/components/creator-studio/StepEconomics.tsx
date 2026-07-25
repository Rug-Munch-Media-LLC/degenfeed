'use client';

import AllocationPieChart from './AllocationPieChart';
import BondingCurvePreview from './BondingCurvePreview';
import { BONDING_PHASES_DISPLAY, ECO_PRESETS } from './constants';
import type { CoinFormState, EcoPreset } from './types';

interface StepEconomicsProps {
  form: CoinFormState;
  update: <K extends keyof CoinFormState>(key: K, value: CoinFormState[K]) => void;
}

export default function StepEconomics({ form, update }: StepEconomicsProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Vesting Preset</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.entries(ECO_PRESETS) as [EcoPreset, (typeof ECO_PRESETS)['fast']][]).map(
            ([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => update('ecoPreset', key)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  form.ecoPreset === key
                    ? 'border-degen-500/30 bg-degen-500/10'
                    : 'border-[var(--color-glass-border)] hover:border-degen-500/20'
                }`}
              >
                <div className="mb-1 text-sm font-bold text-[var(--color-fg)]">{preset.label}</div>
                <div className="mb-2 text-[10px] leading-snug text-[var(--color-muted)]">
                  {preset.description}
                </div>
                <div className="space-y-0.5 text-[9px]">
                  <span className="text-degen-400">Unlock: {preset.initialUnlock}</span>
                  <br />
                  <span className="text-[var(--color-muted)]">Vesting: {preset.vestingPeriod}</span>
                  <br />
                  <span className="text-amber-400">{preset.risk}</span>
                </div>
              </button>
            ),
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--color-fg)]">Bonding Curve Preview</h2>
          <span className="text-[10px] text-[var(--color-muted)]">5 phases → DEX graduation</span>
        </div>
        <BondingCurvePreview className="w-full max-w-sm mx-auto" />
        <div className="mt-3 grid grid-cols-5 gap-1">
          {BONDING_PHASES_DISPLAY.map((phase) => (
            <div key={phase.name} className="text-center">
              <div className="h-1 w-full rounded-full" style={{ backgroundColor: phase.color }} />
              <div className="mt-1 text-[8px] font-medium text-[var(--color-muted)]">
                {phase.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Allocation</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
                <span>Treasury Allocation</span>
                <span className="text-degen-400">{form.treasuryAllocation}%</span>
              </span>
              <input
                type="range"
                min={5}
                max={15}
                step={1}
                value={form.treasuryAllocation}
                onChange={(e) => update('treasuryAllocation', Number(e.target.value))}
                className="w-full accent-degen-400"
              />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
                <span>Creator Allocation</span>
                <span className="text-degen-400">{form.creatorAllocation}%</span>
              </span>
              <input
                type="range"
                min={5}
                max={20}
                step={1}
                value={form.creatorAllocation}
                onChange={(e) => update('creatorAllocation', Number(e.target.value))}
                className="w-full accent-degen-400"
              />
            </label>
            <div className="rounded-lg bg-[var(--color-overlay)] p-3">
              <div className="text-[10px] font-medium text-[var(--color-muted)]">
                Price Estimate by Phase
              </div>
              <div className="mt-1 space-y-1">
                {BONDING_PHASES_DISPLAY.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between text-[9px]">
                    <span className="text-[var(--color-muted)]">{p.name}</span>
                    <span className="font-mono text-degen-400">
                      ~${(0.001 * 2 ** i).toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <AllocationPieChart
            treasuryPct={form.treasuryAllocation}
            creatorPct={form.creatorAllocation}
          />
        </div>
      </div>
    </div>
  );
}
