'use client';

/**
 * @degenfeed/web — VideoSourceFilter
 *
 * Platform source filter bar with per-platform counts.
 * Shows available platforms with toggle buttons and video counts.
 * Aggregator-aware: displays YouTube (via Invidious), Twitch, Rumble,
 * PeerTube, Zora, and DegenFeed Creator content.
 */

import { useCallback } from 'react';
import type { AggregatorSourceCount } from './useVideoHub';

// === Platform config (order determines display order) ====================

export interface VideoSourceFilterOption {
  id: string;
  label: string;
  count: number;
  color: string;
}

export type { AggregatorSourceCount };

interface VideoSourceFilterProps {
  sources: VideoSourceFilterOption[];
  activeSource: string;
  onSourceChange: (source: string) => void;
  loading?: boolean;
  className?: string;
}

export function VideoSourceFilter({
  sources,
  activeSource,
  onSourceChange,
  loading = false,
  className = '',
}: VideoSourceFilterProps) {
  const totalCount = sources.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {/* All toggle */}
      <SourceToggle
        id="all"
        label="All"
        count={totalCount}
        isActive={activeSource === 'all'}
        color=""
        onClick={onSourceChange}
        loading={loading}
      />

      {/* Per-platform toggles in defined order */}
      {sources.map((src) => (
        <SourceToggle
          key={src.id}
          id={src.id}
          label={src.label}
          count={src.count}
          isActive={activeSource === src.id}
          color={src.color}
          onClick={onSourceChange}
          loading={loading}
        />
      ))}
    </div>
  );
}

// === Individual toggle button ============================================

interface SourceToggleProps {
  id: string;
  label: string;
  count: number;
  isActive: boolean;
  color: string;
  onClick: (id: string) => void;
  loading?: boolean;
}

function SourceToggle({
  id,
  label,
  count,
  isActive,
  color,
  onClick,
  loading,
}: SourceToggleProps) {
  const handleClick = useCallback(() => onClick(id), [id, onClick]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
        isActive
          ? 'bg-[var(--color-card)] text-[var(--color-fg)] border-[var(--color-border)] shadow-sm'
          : 'text-[var(--color-muted)] border-transparent hover:text-[var(--color-fg)] hover:border-[var(--color-glass-border)]'
      } disabled:opacity-50`}
      style={
        isActive && color
          ? { borderColor: `${color}40`, backgroundColor: `${color}10` }
          : undefined
      }
      aria-pressed={isActive}
    >
      {/* Platform SVG icon (non-All) */}
      {id !== 'all' && <PlatformIcon platform={id} color={color} />}

      {/* Label */}
      <span>{label}</span>

      {/* Count badge */}
      {count > 0 && (
        <span
          className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
            isActive
              ? 'bg-[var(--color-bg)] text-[var(--color-muted)]'
              : 'bg-[var(--color-card)] text-[var(--color-muted)]'
          }`}
        >
          {count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count}
        </span>
      )}

      {/* Loading shimmer for active */}
      {isActive && loading && (
        <span className="absolute inset-0 animate-pulse rounded-full bg-white/5" />
      )}
    </button>
  );
}

// === Platform SVG icons (inline, no dangerouslySetInnerHTML) ============

const PLATFORM_SVGS: Record<string, React.ReactNode> = {
  youtube: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  twitch: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  ),
  rumble: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-12.5v7l6-3.5-6-3.5z" />
    </svg>
  ),
  peertube: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 6L2 18h20L12 6zm0 4.5L17.5 16H6.5L12 10.5z" />
    </svg>
  ),
  zora: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8M12 8v8" />
    </svg>
  ),
  creator: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  ),
};

function PlatformIcon({ platform, color }: { platform: string; color?: string }) {
  const svg = PLATFORM_SVGS[platform];
  if (!svg) return null;
  return (
    <span className="h-3.5 w-3.5" style={color ? { color } : undefined}>
      {svg}
    </span>
  );
}
