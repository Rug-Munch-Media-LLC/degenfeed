'use client';

/**
 * Algorithm Settings — User-Controlled Feed Algorithm
 *
 * Users customize exactly how their feed is ranked:
 *   - Sliders for each scoring factor (recency, popularity, relevance, niche, protocol diversity)
 *   - Niche selection with "discover new" toggle
 *   - Per-protocol weighting with visual pie chart
 *   - Time-based algorithm mode presets
 *   - Reset to defaults
 *   - Live preview of feed impact
 */

import {
  ALL_NICHES,
  type AlgorithmMode,
  type AlgorithmWeights,
  DEFAULT_WEIGHTS,
  MODE_LABELS,
  NICHE_LABELS,
  type NicheSelection,
  type ProtocolWeights,
} from '@degenfeed/feed-core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../../components/ui/PageHeader';

// ─── Constants ──────────────────────────────────────────────────────────

const FACTOR_META: Record<
  keyof AlgorithmWeights,
  { label: string; icon: string; description: string; emoji: string }
> = {
  recency: {
    label: 'Recency',
    icon: '🕐',
    description: 'How much to boost new posts over older ones',
    emoji: '⏱️',
  },
  popularity: {
    label: 'Popularity',
    icon: '🔥',
    description: 'How much to boost posts with high engagement',
    emoji: '📈',
  },
  relevance: {
    label: 'Relevance',
    icon: '🎯',
    description: 'How much to match your interests and selected niches',
    emoji: '💡',
  },
  protocolDiversity: {
    label: 'Protocol Diversity',
    icon: '🔄',
    description: 'How much to mix different protocols in your feed',
    emoji: '🌐',
  },
  nicheFocus: {
    label: 'Niche Focus',
    icon: '🔍',
    description: 'How strongly to prioritize your selected niches',
    emoji: '🎯',
  },
};

const PROTOCOLS_FOR_WEIGHTING = [
  { id: 'nostr', label: 'Nostr', color: '#8e30eb' },
  { id: 'farcaster', label: 'Farcaster', color: '#8a63d2' },
  { id: 'lens', label: 'Lens', color: '#abfe2c' },
  { id: 'bluesky', label: 'Bluesky', color: '#1185fe' },
  { id: 'mastodon', label: 'Mastodon', color: '#6364ff' },
  { id: 'reddit', label: 'Reddit', color: '#ff4500' },
  { id: 'rss', label: 'RSS/News', color: '#ffa500' },
  { id: 'lemmy', label: 'Lemmy', color: '#22c55e' },
  { id: 'youtube', label: 'YouTube', color: '#ff0000' },
  { id: 'peertube', label: 'PeerTube', color: '#f1680d' },
] as const;

// ─── Helper: Slider ────────────────────────────────────────────────────

function Slider({
  label,
  icon,
  description,
  value,
  onChange,
  min = 0,
  max = 100,
}: {
  label: string;
  icon?: string;
  description?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-lg" aria-hidden="true">
              {icon}
            </span>
          )}
          <label className="text-sm font-medium text-[var(--color-fg)]">{label}</label>
        </div>
        <span className="text-sm font-bold tabular-nums text-degen-400 min-w-[3ch] text-right">
          {value}
        </span>
      </div>
      {description && <p className="text-xs text-[var(--color-muted)] -mt-1">{description}</p>}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-[var(--color-overlay)] accent-degen-500"
        style={{
          background: `linear-gradient(to right, #a855f7 ${value}%, var(--color-overlay) ${value}%)`,
        }}
        aria-label={label}
      />
      <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
        <span>Min</span>
        <span>Max</span>
      </div>
    </div>
  );
}

// ─── Helper: Niche Chip ────────────────────────────────────────────────

function NicheChip({
  id,
  selected,
  onToggle,
}: {
  id: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const meta = NICHE_LABELS[id] ?? { label: id, icon: '📌', color: '#888' };
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium
        transition-all border
        ${
          selected
            ? 'border-degen-500/40 bg-degen-500/15 text-degen-400 shadow-sm'
            : 'border-[var(--color-glass-border)] bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-degen-500/20'
        }
      `}
      style={
        selected
          ? {
              borderColor: `${meta.color}50`,
              backgroundColor: `${meta.color}15`,
              color: meta.color,
            }
          : undefined
      }
    >
      <span aria-hidden="true">{meta.icon}</span>
      <span>{meta.label}</span>
    </button>
  );
}

// ─── Helper: Protocol Weight Slider ────────────────────────────────────

function ProtocolWeightRow({
  id,
  label,
  color,
  weight,
  onChange,
}: {
  id: string;
  label: string;
  color: string;
  weight: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
        style={{ backgroundColor: `${color}20` }}
        aria-hidden="true"
      >
        <span className="font-bold" style={{ color }}>
          {label[0]}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
          <span className="text-xs tabular-nums font-bold" style={{ color }}>
            {weight}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={weight}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[var(--color-overlay)] mt-1"
          style={{
            background: `linear-gradient(to right, ${color} ${weight}%, var(--color-overlay) ${weight}%)`,
          }}
          aria-label={`${label} weight`}
        />
      </div>
    </div>
  );
}

// ─── Helper: Protocol Pie Chart ────────────────────────────────────────

function ProtocolPieChart({ weights }: { weights: ProtocolWeights }) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const segments = PROTOCOLS_FOR_WEIGHTING.map((p) => ({
    ...p,
    percentage: ((weights[p.id] ?? 50) / total) * 100,
  })).filter((s) => s.percentage > 0);

  // SVG pie chart
  const cx = 80;
  const cy = 80;
  const r = 70;
  let cumulativeAngle = -90;

  const piePaths = segments.map((seg) => {
    const angle = (seg.percentage / 100) * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    return (
      <path
        key={seg.id}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={seg.color}
        opacity={0.85}
        stroke="var(--color-card)"
        strokeWidth="1.5"
      >
        <title>
          {seg.label}: {Math.round(seg.percentage)}%
        </title>
      </path>
    );
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
        {piePaths}
        <circle cx={cx} cy={cy} r={30} fill="var(--color-card)" />
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {segments.map((seg) => (
          <div
            key={seg.id}
            className="flex items-center gap-1.5 text-[10px] text-[var(--color-muted)]"
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span>
              {seg.label}: {Math.round(seg.percentage)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helper: Live Preview ──────────────────────────────────────────────

function LivePreview({ weights }: { weights: AlgorithmWeights }) {
  const dominant = useMemo(() => {
    const entries = Object.entries(weights) as [keyof AlgorithmWeights, number][];
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    if (!top || top[1] === 0) return null;
    return FACTOR_META[top[0]];
  }, [weights]);

  const descriptions: string[] = [];
  if (weights.recency > 70) descriptions.push('Fresh content will dominate your feed');
  else if (weights.recency < 30) descriptions.push('Older posts get a fair chance');

  if (weights.popularity > 70)
    descriptions.push('Viral and trending posts will surface prominently');
  else if (weights.popularity < 30) descriptions.push('Engagement numbers matter less');

  if (weights.relevance > 70) descriptions.push('Your niche interests drive the feed');
  else if (weights.relevance < 30)
    descriptions.push("You'll see more diverse content outside your niches");

  if (weights.protocolDiversity > 70) descriptions.push('Protocols are heavily mixed in your feed');
  else if (weights.protocolDiversity < 30)
    descriptions.push('Your preferred protocols will dominate');

  if (weights.nicheFocus > 70) descriptions.push('Niche-specific content is heavily prioritized');
  else if (weights.nicheFocus < 30) descriptions.push("You'll see more content across all niches");

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-4 space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        ⚡ Feed Impact Preview
      </h4>
      {dominant && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg" aria-hidden="true">
            {dominant.emoji}
          </span>
          <span className="text-[var(--color-fg)] font-medium">
            Dominant factor: <span className="text-degen-400">{dominant.label}</span>
          </span>
        </div>
      )}
      <ul className="space-y-1">
        {descriptions.map((d, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
            <span className="mt-0.5 text-degen-400">◆</span>
            <span>{d}</span>
          </li>
        ))}
      </ul>
      {descriptions.length === 0 && (
        <p className="text-xs text-[var(--color-muted)]">
          Your weights are balanced — feed will show a standard mix of content.
        </p>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function AlgorithmSettingsPage() {
  // State
  const [weights, setWeights] = useState<AlgorithmWeights>(DEFAULT_WEIGHTS);
  const [mode, setMode] = useState<AlgorithmMode>('standard');
  const [nicheSelection, setNicheSelection] = useState<NicheSelection>({
    active: ['crypto', 'bitcoin', 'ethereum', 'defi', 'ai', 'tech'],
    discoverNew: true,
  });
  const [protocolWeights, setProtocolWeights] = useState<ProtocolWeights>(() => {
    const pw: ProtocolWeights = {};
    for (const p of PROTOCOLS_FOR_WEIGHTING) pw[p.id] = 50;
    return pw;
  });
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/preferences/algorithm', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          weights?: AlgorithmWeights;
          mode?: AlgorithmMode;
          niches?: NicheSelection;
          protocolWeights?: ProtocolWeights;
        };
        if (data.weights) setWeights(data.weights);
        if (data.mode) setMode(data.mode);
        if (data.niches) setNicheSelection(data.niches);
        if (data.protocolWeights) setProtocolWeights(data.protocolWeights);
      } catch {
        /* ignore */
      }
    }
    load();
  }, []);

  // Mark changes
  const markChanged = useCallback(() => setHasChanges(true), []);

  // Niche toggle
  const toggleNiche = useCallback(
    (id: string) => {
      setNicheSelection((prev) => {
        const active = prev.active.includes(id)
          ? prev.active.filter((n) => n !== id)
          : [...prev.active, id];
        return { ...prev, active };
      });
      markChanged();
    },
    [markChanged],
  );

  // Reset to defaults
  const handleReset = useCallback(() => {
    setWeights(DEFAULT_WEIGHTS);
    setMode('standard');
    setNicheSelection({
      active: ['crypto', 'bitcoin', 'ethereum', 'defi', 'ai', 'tech'],
      discoverNew: true,
    });
    const pw: ProtocolWeights = {};
    for (const p of PROTOCOLS_FOR_WEIGHTING) pw[p.id] = 50;
    setProtocolWeights(pw);
    setHasChanges(true);
  }, []);

  // Save
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const body = { weights, mode, niches: nicheSelection, protocolWeights };
      const res = await fetch('/api/preferences/algorithm', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Save failed');
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save algorithm preferences:', err);
    } finally {
      setSaving(false);
    }
  }, [weights, mode, nicheSelection, protocolWeights]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter pb-24 sm:pb-6">
      <PageHeader
        title="Feed Algorithm"
        description="Control exactly how your feed is ranked and what content you see."
      />

      {/* ── Time-Based Algorithm Modes ── */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">Algorithm Mode</h2>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          Choose a preset that changes how the algorithm behaves throughout the day.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {(
            Object.entries(MODE_LABELS) as [AlgorithmMode, (typeof MODE_LABELS)[AlgorithmMode]][]
          ).map(([id, meta]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMode(id);
                markChanged();
              }}
              className={`
                  flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all
                  ${
                    mode === id
                      ? 'border-degen-500 bg-degen-500/10'
                      : 'border-[var(--color-glass-border)] bg-[var(--color-overlay)] hover:border-degen-500/30'
                  }
                `}
              aria-pressed={mode === id}
            >
              <span className="text-2xl" aria-hidden="true">
                {meta.icon}
              </span>
              <span className="text-xs font-medium text-[var(--color-fg)]">{meta.label}</span>
              <span className="text-[10px] text-[var(--color-muted)] leading-tight">
                {meta.description}
              </span>
            </button>
          ))}
        </div>
        {mode !== 'standard' && (
          <div className="mt-3 rounded-lg border border-degen-500/20 bg-degen-500/5 px-3 py-2">
            <p className="text-xs text-degen-400">
              <span className="font-semibold">{MODE_LABELS[mode].label}</span> mode active —{' '}
              {MODE_LABELS[mode].description.toLowerCase()}. The weights below will be adjusted
              automatically for this mode.
            </p>
          </div>
        )}
      </section>

      {/* ── Factor Sliders ── */}
      <section className="mb-8 space-y-6">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">Factor Weights</h2>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          Adjust how much each factor influences your feed. Higher values = more influence.
        </p>
        {(
          Object.entries(FACTOR_META) as [
            keyof AlgorithmWeights,
            (typeof FACTOR_META)[keyof AlgorithmWeights],
          ][]
        ).map(([key, meta]) => (
          <Slider
            key={key}
            label={meta.label}
            icon={meta.icon}
            description={meta.description}
            value={weights[key]}
            onChange={(v) => {
              setWeights((prev) => ({ ...prev, [key]: v }));
              markChanged();
            }}
          />
        ))}

        <LivePreview weights={weights} />
      </section>

      {/* ── Niche Selection ── */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">Your Niches</h2>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          Select which topics you want to prioritize in your feed. Selected niches get boosted by
          the Niche Focus factor.
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_NICHES.map((niche) => (
            <NicheChip
              key={niche}
              id={niche}
              selected={nicheSelection.active.includes(niche)}
              onToggle={() => toggleNiche(niche)}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
          <div>
            <div className="text-sm font-medium text-[var(--color-fg)]">Discover New Niches</div>
            <p className="text-xs text-[var(--color-muted)]">
              Occasionally show content from niches you haven&apos;t selected to help you discover
              new interests.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={nicheSelection.discoverNew}
            data-checked={nicheSelection.discoverNew}
            onClick={() => {
              setNicheSelection((prev) => ({ ...prev, discoverNew: !prev.discoverNew }));
              markChanged();
            }}
            className="toggle-track shrink-0"
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </section>

      {/* ── Protocol Weighting ── */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-fg])">Protocol Mix</h2>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          Control how much content you see from each protocol. Increase a protocol&apos;s weight to
          see more from it, decrease to see less.
        </p>

        <div className="mb-6">
          <ProtocolPieChart weights={protocolWeights} />
        </div>

        <div className="space-y-3">
          {PROTOCOLS_FOR_WEIGHTING.map((p) => (
            <ProtocolWeightRow
              key={p.id}
              id={p.id}
              label={p.label}
              color={p.color}
              weight={protocolWeights[p.id] ?? 50}
              onChange={(v) => {
                setProtocolWeights((prev) => ({ ...prev, [p.id]: v }));
                markChanged();
              }}
            />
          ))}
        </div>
      </section>

      {/* ── Action Buttons ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-2 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          Reset to Defaults
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="btn-primary text-sm"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        {!hasChanges && <span className="text-[10px] text-[var(--color-muted)]">No changes</span>}
      </div>
    </div>
  );
}
