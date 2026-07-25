'use client';

/**
 * VibeScore — Full vibe score breakdown display.
 *
 * Shows the 8 dimensions of Vine vibe scoring:
 *   - Total vibe score (0-100)
 *   - Humor, Creativity, Originality, Replay Value
 *   - Production Quality, Engagement Velocity, Viral Potential
 *
 * Each dimension has a progress bar with emoji indicator.
 */
import type { VibeScores } from './useVineFeed';

// ─── Props ────────────────────────────────────────────────────────────────

export interface VibeScoreProps {
  score: VibeScores;
  onClose?: () => void;
}

export type { VibeScores as VibeScoreData };

// ─── Dimension Config ─────────────────────────────────────────────────────

interface DimensionConfig {
  key: keyof VibeScores;
  label: string;
  emoji: string;
  description: string;
  color: string;
}

const DIMENSIONS: DimensionConfig[] = [
  { key: 'humor', label: 'Humor', emoji: '😂', description: 'How funny is this?', color: '#FF6B35' },
  { key: 'creativity', label: 'Creativity', emoji: '🎨', description: 'Creative execution', color: '#9C27B0' },
  { key: 'originality', label: 'Originality', emoji: '💡', description: 'Fresh & unique', color: '#00BCD4' },
  { key: 'replayValue', label: 'Replay Value', emoji: '🔄', description: 'Watch again & again', color: '#4CAF50' },
  { key: 'productionQuality', label: 'Production', emoji: '🎬', description: 'Production quality', color: '#FF9800' },
  { key: 'engagementVelocity', label: 'Engagement', emoji: '📈', description: 'Engagement velocity', color: '#E91E63' },
  { key: 'viralPotential', label: 'Viral Potential', emoji: '🔥', description: 'Could this blow up?', color: '#F44336' },
];

// ─── VibeScore Component ──────────────────────────────────────────────────

export function VibeScore({ score, onClose }: VibeScoreProps) {
  // Exclude 'total' from dimensions display
  const displayDims = DIMENSIONS.filter((d) => d.key !== 'total');

  // Determine vibe tier
  const getVibeTier = (total: number): { label: string; emoji: string; color: string } => {
    if (total >= 90) return { label: 'Legendary', emoji: '🏆', color: '#FFD700' };
    if (total >= 70) return { label: 'Viral', emoji: '🔥', color: '#FF6B35' };
    if (total >= 50) return { label: 'Solid', emoji: '👍', color: '#4CAF50' };
    if (total >= 30) return { label: 'Meh', emoji: '😐', color: '#FF9800' };
    return { label: 'Needs Work', emoji: '💪', color: '#F44336' };
  };

  const tier = getVibeTier(score.total);

  return (
    <div
      className="w-56 rounded-xl border border-white/10 bg-black/80 p-3 backdrop-blur-xl shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{tier.emoji}</span>
          <div>
            <span className="text-sm font-bold text-white">{score.total}</span>
            <span className="text-[10px] text-white/40 ml-1">/ 100</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-medium" style={{ color: tier.color }}>{tier.label}</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] text-white/50 hover:bg-white/20"
            aria-label="Close vibe scores"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dimensions */}
      <div className="flex flex-col gap-1.5">
        {displayDims.map((dim) => {
          const value = score[dim.key] as number;
          const fillPercent = Math.min(value, 100);

          return (
            <div key={dim.key} className="group relative">
              <div className="flex items-center justify-between mb-0.5">
                <span className="flex items-center gap-1">
                  <span className="text-[10px]">{dim.emoji}</span>
                  <span className="text-[9px] font-medium text-white/60">{dim.label}</span>
                </span>
                <span className="text-[9px] font-mono text-white/40">{value}</span>
              </div>
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${fillPercent}%`,
                    backgroundColor: dim.color,
                    boxShadow: `0 0 6px ${dim.color}40`,
                  }}
                />
              </div>
              {/* Tooltip */}
              <div className="pointer-events-none absolute -top-6 left-0 whitespace-nowrap rounded bg-black/90 px-1.5 py-0.5 text-[8px] text-white/60 opacity-0 transition-opacity group-hover:opacity-100">
                {dim.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total score ring */}
      <div className="mt-3 flex items-center justify-center gap-2 border-t border-white/5 pt-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold"
          style={{
            backgroundColor: `${tier.color}20`,
            color: tier.color,
            border: `2px solid ${tier.color}40`,
          }}
        >
          {score.total}
        </div>
        <span className="text-[9px] text-white/40">
          {score.total >= 70
            ? 'This vine is on fire! 🔥'
            : score.total >= 50
              ? 'Pretty good vibes 👍'
              : score.total >= 30
                ? 'Decent, could be better'
                : 'Keep creating!'}
        </span>
      </div>
    </div>
  );
}
