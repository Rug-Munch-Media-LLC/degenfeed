'use client';

import { useMemo } from 'react';
import type { AlgorithmWeights, WeightPreset } from './types';
import { WEIGHT_LABELS, PRESETS } from './types';

/* ─── Toggle Switch ─────────────────────────────────────────── */

export function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="toggle-track"
    >
      <span className="toggle-thumb" />
    </button>
  );
}

/* ─── Weight Slider ─────────────────────────────────────────── */

function WeightSlider({
  weightKey,
  value,
  onChange,
}: {
  weightKey: keyof AlgorithmWeights;
  value: number;
  onChange: (key: keyof AlgorithmWeights, v: number) => void;
}) {
  const meta = WEIGHT_LABELS[weightKey];
  return (
    <div className="group">
      <div className="mb-1.5 flex items-center justify-between">
        <label
          htmlFor={`weight-${weightKey}`}
          className="flex items-center gap-2 text-xs font-medium"
          style={{ color: 'var(--color-fg)' }}
        >
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--color-muted)]">{meta.desc}</span>
          <span
            className="w-8 text-right text-xs font-mono font-bold tabular-nums"
            style={{ color: 'var(--color-accent)' }}
          >
            {value}%
          </span>
        </div>
      </div>
      <input
        id={`weight-${weightKey}`}
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(weightKey, Number(e.target.value))}
        className="tune-slider w-full"
        aria-label={`${meta.label} weight: ${value}%`}
      />
    </div>
  );
}

/* ─── Preset Card ──────────────────────────────────────────── */

export function PresetCard({
  preset,
  active,
  onApply,
  onShare,
}: {
  preset: WeightPreset;
  active: boolean;
  onApply: () => void;
  onShare: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onApply}
      className={`relative rounded-xl border p-4 text-left transition-all ${
        active
          ? 'border-degen-500/40 bg-degen-500/[0.06] shadow-[0_0_20px_rgba(0,255,65,0.08)]'
          : 'border-[var(--color-glass-border)] bg-[var(--color-card)] hover:border-degen-500/20 hover:bg-degen-500/[0.02]'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-2xl" aria-hidden="true">
          {preset.icon}
        </span>
        {active && (
          <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[9px] font-semibold text-degen-400">
            Active
          </span>
        )}
      </div>
      <h3 className="mb-1 text-sm font-bold" style={{ color: 'var(--color-fg)' }}>
        {preset.name}
      </h3>
      <p className="mb-3 text-[11px]" style={{ color: 'var(--color-muted)' }}>
        {preset.description}
      </p>
      <div className="space-y-1">
        {(Object.keys(preset.weights) as Array<keyof AlgorithmWeights>).slice(0, 4).map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-16 text-[9px]" style={{ color: 'var(--color-muted)' }}>
              {WEIGHT_LABELS[k].label}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
              <div
                className="h-full rounded-full bg-degen-500/60 transition-all"
                style={{ width: `${preset.weights[k]}%` }}
              />
            </div>
            <span className="w-6 text-right text-[9px] font-mono text-[var(--color-muted)]">
              {preset.weights[k]}%
            </span>
          </div>
        ))}
      </div>
    </button>
  );
}

/* ─── Preview Panel ─────────────────────────────────────────── */

export function PreviewPanel({
  currentWeights,
  proposedWeights,
}: {
  currentWeights: AlgorithmWeights;
  proposedWeights: AlgorithmWeights;
}) {
  const diffs = useMemo(() => {
    const result: Array<{
      key: keyof AlgorithmWeights;
      label: string;
      icon: string;
      current: number;
      proposed: number;
      diff: number;
    }> = [];
    for (const key of Object.keys(currentWeights) as Array<keyof AlgorithmWeights>) {
      const diff = proposedWeights[key] - currentWeights[key];
      if (diff !== 0 || proposedWeights[key] !== 50) {
        result.push({
          key,
          label: WEIGHT_LABELS[key].label,
          icon: WEIGHT_LABELS[key].icon,
          current: currentWeights[key],
          proposed: proposedWeights[key],
          diff,
        });
      }
    }
    return result.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [currentWeights, proposedWeights]);

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-card)' }}
    >
      <h3
        className="mb-3 flex items-center gap-2 text-sm font-semibold"
        style={{ color: 'var(--color-fg)' }}
      >
        <span>📊</span> Feed Preview
      </h3>
      <p className="mb-3 text-[11px]" style={{ color: 'var(--color-muted)' }}>
        How your feed would change with these weights:
      </p>
      {diffs.length === 0 ? (
        <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
          No changes yet. Adjust some weights above to see a preview.
        </p>
      ) : (
        <div className="space-y-2">
          {diffs.slice(0, 6).map((d) => {
            const isPositive = d.diff > 0;
            const isNeutral = d.diff === 0;
            return (
              <div key={d.key} className="flex items-center gap-2">
                <span className="text-sm shrink-0">{d.icon}</span>
                <span className="flex-1 text-xs" style={{ color: 'var(--color-fg)' }}>
                  {d.label}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.abs(d.proposed)}%`,
                        backgroundColor: isPositive
                          ? 'var(--color-accent)'
                          : isNeutral
                            ? 'var(--color-muted)'
                            : '#ef4444',
                      }}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-mono font-medium ${
                      isPositive
                        ? 'text-degen-400'
                        : isNeutral
                          ? 'text-[var(--color-muted)]'
                          : 'text-red-400'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {d.diff}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {diffs.length > 0 && (
        <p className="mt-3 text-[10px]" style={{ color: 'var(--color-muted)' }}>
          {diffs.filter((d) => d.diff > 0).length > 0
            ? `🟢 More weight on: ${diffs.filter((d) => d.diff > 0).map((d) => d.label).join(', ')}`
            : ''}
          {diffs.filter((d) => d.diff > 0).length > 0 && diffs.filter((d) => d.diff < 0).length > 0
            ? ' | '
            : ''}
          {diffs.filter((d) => d.diff < 0).length > 0
            ? `🔴 Less weight on: ${diffs.filter((d) => d.diff < 0).map((d) => d.label).join(', ')}`
            : ''}
        </p>
      )}
    </div>
  );
}

/* ─── Sliders Section ───────────────────────────────────────── */

export function WeightSlidersSection({
  weights,
  onWeightChange,
}: {
  weights: AlgorithmWeights;
  onWeightChange: (key: keyof AlgorithmWeights, v: number) => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">🎛️</span>
        <h2
          className="text-lg font-bold"
          style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}
        >
          Manual Weights
        </h2>
      </div>
      <p className="mb-4 text-xs" style={{ color: 'var(--color-muted)' }}>
        Fine-tune each factor individually. Higher weight = more influence on your feed.
      </p>
      <div
        className="rounded-xl border p-5"
        style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-card)' }}
      >
        <div className="space-y-5">
          {(Object.keys(WEIGHT_LABELS) as Array<keyof AlgorithmWeights>).map((key) => (
            <WeightSlider key={key} weightKey={key} value={weights[key]} onChange={onWeightChange} />
          ))}
        </div>
      </div>
    </section>
  );
}
