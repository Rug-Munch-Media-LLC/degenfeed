'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Topic configuration ──────────────────────────────────────────
export interface TopicDef {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export const TOPICS: TopicDef[] = [
  { id: 'crypto', label: 'Crypto', icon: '₿', color: '#f59e0b' },
  { id: 'defi', label: 'DeFi', icon: 'D', color: '#6366f1' },
  { id: 'nft', label: 'NFT', icon: 'N', color: '#ec4899' },
  { id: 'ai', label: 'AI', icon: 'AI', color: '#06b6d4' },
  { id: 'regulation', label: 'Regulation', icon: '⚖', color: '#ef4444' },
  { id: 'security', label: 'Security', icon: '🔒', color: '#dc2626' },
  { id: 'macro', label: 'Macro', icon: '📈', color: '#10b981' },
  { id: 'memecoin', label: 'Memecoin', icon: '🐸', color: '#f97316' },
  { id: 'layer2', label: 'Layer 2', icon: '⧫', color: '#8b5cf6' },
  { id: 'stablecoin', label: 'Stablecoin', icon: '💲', color: '#22d3ee' },
  { id: 'etf', label: 'ETF', icon: '🏛', color: '#e879f9' },
  { id: 'onchain', label: 'Onchain', icon: 'O', color: '#34d399' },
  { id: 'gaming', label: 'Gaming', icon: '🎮', color: '#f43f5e' },
  { id: 'privacy', label: 'Privacy', icon: '🛡', color: '#a78bfa' },
  { id: 'mining', label: 'Mining', icon: '⛏', color: '#fb923c' },
];

export const DEFAULT_WEIGHT = 50;

export function getDefaultWeights(): Record<string, number> {
  const w: Record<string, number> = {};
  for (const t of TOPICS) w[t.id] = DEFAULT_WEIGHT;
  return w;
}

/** Number of topics with weight !== 50 */
export function countTunedTopics(weights: Record<string, number>): number {
  return Object.values(weights).filter((v) => v !== DEFAULT_WEIGHT).length;
}

/** Build the topic_weights query-string value: `defi:75,nft:30,ai:80` */
export function encodeTopicWeights(weights: Record<string, number>): string {
  return Object.entries(weights)
    .filter(([, v]) => v !== DEFAULT_WEIGHT)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
}

// ─── Color helpers ─────────────────────────────────────────────────
function sliderGradient(weight: number): string {
  if (weight < 50) {
    // Low end: transparent → red
    const pct = Math.abs(weight - 50) / 50;
    return `linear-gradient(to right, transparent, rgba(239, 68, 68, ${pct * 0.7}))`;
  }
  if (weight > 50) {
    // High end: transparent → green
    const pct = (weight - 50) / 50;
    return `linear-gradient(to right, transparent, rgba(34, 197, 94, ${pct * 0.7}))`;
  }
  return `linear-gradient(to right, transparent, rgba(107, 114, 128, 0.4))`;
}

function thumbColor(weight: number): string {
  if (weight < 30) return '#ef4444'; // red
  if (weight <= 70) return '#6b7280'; // gray
  return '#22c55e'; // green
}

/** Returns the label text for the tuned state */
function weightLabel(weight: number): string {
  if (weight <= 20) return 'Show much less';
  if (weight <= 40) return 'Show less';
  if (weight <= 60) return 'Default';
  if (weight <= 80) return 'Show more';
  return 'Show much more';
}

// ─── FeedTuner component ──────────────────────────────────────────
interface FeedTunerProps {
  /** Current topic weights (keyed by topic id) */
  weights: Record<string, number>;
  /** Called whenever a slider changes (debounced externally) */
  onWeightsChange: (weights: Record<string, number>) => void;
  /** Called when "Apply" is clicked */
  onApply: (weights: Record<string, number>) => void;
  /** Called when "Reset to defaults" is clicked */
  onReset: () => void;
  /** Close handler */
  onClose: () => void;
}

export function FeedTuner({
  weights,
  onWeightsChange,
  onApply,
  onReset,
  onClose,
}: FeedTunerProps) {
  const [localWeights, setLocalWeights] = useState<Record<string, number>>(weights);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync from parent when weights prop changes (e.g. after apply)
  useEffect(() => {
    setLocalWeights(weights);
  }, [weights]);

  const handleSlider = useCallback(
    (topicId: string, value: number) => {
      const next = { ...localWeights, [topicId]: value };
      setLocalWeights(next);

      // Debounce: fire change upstream so preview can update
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onWeightsChange(next);
      }, 200);
    },
    [localWeights, onWeightsChange],
  );

  const tunedCount = countTunedTopics(localWeights);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div
        className="flex w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Tune your feed"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-[var(--color-fg)]">
              🎚️ Tune Your Feed
            </h2>
            <p className="text-xs text-gray-500">
              Slide to control what you see more or less of
              {tunedCount > 0 && (
                <span className="ml-1.5 text-degen-400">· {tunedCount} topics tuned</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            aria-label="Close tuner"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Sliders ── */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
          {TOPICS.map((topic) => {
            const w = localWeights[topic.id] ?? DEFAULT_WEIGHT;
            return (
              <div key={topic.id} className="topic-slider-group py-2">
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor={`tuner-${topic.id}`}
                    className="flex items-center gap-2 text-sm font-medium text-[var(--color-fg)]"
                  >
                    <span style={{ color: topic.color }}>{topic.icon}</span>
                    <span>{topic.label}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-mono tabular-nums"
                      style={{ color: thumbColor(w) }}
                    >
                      {w}
                    </span>
                    <span className="text-[10px] text-gray-500 w-20 text-right">
                      {weightLabel(w)}
                    </span>
                  </div>
                </div>
                <div className="relative">
                  {/* Gradient track background */}
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: sliderGradient(w) }}
                  />
                  <input
                    id={`tuner-${topic.id}`}
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={w}
                    onChange={(e) => handleSlider(topic.id, Number(e.target.value))}
                    className="tuner-slider relative w-full h-1.5 appearance-none rounded-full bg-gray-700 cursor-pointer accent-degen-500"
                    aria-label={`${topic.label} weight`}
                    style={
                      {
                        '--slider-thumb-color': thumbColor(w),
                        accentColor: thumbColor(w),
                      } as React.CSSProperties
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-5 py-4">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-medium text-gray-400 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            Reset to defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-gray-400 hover:text-[var(--color-fg)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onApply(localWeights)}
              className="btn-primary text-sm"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
