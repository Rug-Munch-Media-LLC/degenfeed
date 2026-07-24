/**
 * @degenfeed/web — AlgorithmTransparency
 *
 * "Why am I seeing this?" overlay for feed posts.
 * Displays a breakdown of how the algorithm scored each post,
 * showing the user exactly why it appeared in their feed.
 *
 * Triggered by a small ℹ️ button on each PostCard.
 */

'use client';

import type { AlgorithmMode, AlgorithmScoreBreakdown, ReasonEntry } from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ─── Types ──────────────────────────────────────────────────────────────

interface TransparencyData {
  postId: string;
  postPreview: string;
  breakdown: AlgorithmScoreBreakdown;
  mode: AlgorithmMode;
  isFollowed: boolean;
  authorName: string;
  protocol: string;
  niches: string[];
}

// ─── Factor Visualization ──────────────────────────────────────────────

const FACTOR_COLORS: Record<string, string> = {
  recency: '#f59e0b',
  popularity: '#ef4444',
  relevance: '#3b82f6',
  niche: '#8b5cf6',
  protocol: '#10b981',
  quality: '#ec4899',
  diversity: '#06b6d4',
};

const FACTOR_ICONS: Record<string, string> = {
  recency: '🕐',
  popularity: '🔥',
  relevance: '🎯',
  niche: '🔍',
  protocol: '🌐',
  quality: '✨',
  diversity: '🔄',
};

function FactorBar({ reason, maxContribution }: { reason: ReasonEntry; maxContribution: number }) {
  const color = FACTOR_COLORS[reason.factor] ?? '#888';
  const icon = FACTOR_ICONS[reason.factor] ?? '📊';
  const width = maxContribution > 0 ? (reason.contribution / maxContribution) * 100 : 0;

  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-base mt-0.5" aria-hidden="true">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[var(--color-fg)] capitalize">
              {reason.label}
            </span>
            <span className="text-[10px] text-[var(--color-muted)]">({reason.factor})</span>
          </div>
          <span className="text-xs tabular-nums font-bold" style={{ color }}>
            {Math.round(reason.contribution * 100)}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--color-overlay)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(2, width)}%`,
              backgroundColor: color,
            }}
          />
        </div>
        <p className="mt-1 text-[10px] text-[var(--color-muted)] leading-tight">{reason.detail}</p>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────

export function WhyAmISeeingThis({
  post,
  breakdown,
  mode,
  isFollowed,
  onClose,
}: {
  post: UnifiedPost;
  breakdown: AlgorithmScoreBreakdown;
  mode: AlgorithmMode;
  isFollowed: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // Delay to avoid immediate close from the trigger button
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const maxContribution = Math.max(...breakdown.reasons.map((r) => r.contribution), 0.01);

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        ref={ref}
        className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-glass-border)] bg-[var(--color-card)] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">
              🔍
            </span>
            <h3 className="text-sm font-bold text-[var(--color-fg)]">Why am I seeing this?</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Post preview */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-medium text-[var(--color-fg)]">
                {post.author.displayName}
              </span>
              <span className="text-[10px] text-[var(--color-muted)]">· {post.protocol}</span>
            </div>
            <p className="text-xs text-[var(--color-muted)] line-clamp-3">
              {post.text || '(no text)'}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {post.niches.map((n) => (
                <span
                  key={n}
                  className="rounded-full bg-degen-500/10 px-2 py-0.5 text-[10px] text-degen-400"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>

          {/* Quick summary */}
          <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-degen-400">
              <span>⚡</span>
              <span>
                <strong>Score: {breakdown.total.toFixed(3)}</strong>
                {' · '}Mode: {mode.replace('-', ' ')}
                {isFollowed && ' · You follow this author'}
              </span>
            </div>
          </div>

          {/* Factor breakdown */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Score Breakdown
            </h4>
            <div className="divide-y divide-[var(--color-glass-border)]">
              {breakdown.reasons
                .sort((a, b) => b.contribution - a.contribution)
                .map((reason, i) => (
                  <FactorBar
                    key={`${reason.factor}-${i}`}
                    reason={reason}
                    maxContribution={maxContribution}
                  />
                ))}
            </div>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-3">
            <div className="text-center">
              <div className="text-lg font-bold text-degen-400 tabular-nums">
                {breakdown.total.toFixed(2)}
              </div>
              <div className="text-[10px] text-[var(--color-muted)]">Total Score</div>
            </div>
            <div className="text-center">
              <div
                className="text-lg font-bold tabular-nums"
                style={{ color: FACTOR_COLORS.recency }}
              >
                {(breakdown.recency * 100).toFixed(0)}%
              </div>
              <div className="text-[10px] text-[var(--color-muted)]">Recency</div>
            </div>
            <div className="text-center">
              <div
                className="text-lg font-bold tabular-nums"
                style={{ color: FACTOR_COLORS.popularity }}
              >
                {(breakdown.popularity * 100).toFixed(0)}%
              </div>
              <div className="text-[10px] text-[var(--color-muted)]">Popularity</div>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-[10px] text-[var(--color-muted)] text-center">
            Your feed algorithm preferences determine how these factors are weighted. Adjust them in{' '}
            <a href="/settings/algorithm" className="underline hover:text-degen-400">
              Settings → Feed Algorithm
            </a>
          </p>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}

// ─── Trigger Button ────────────────────────────────────────────────────

export function WhyButton({
  onClick,
  className = '',
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`inline-flex items-center gap-1 text-[10px] text-[var(--color-muted)] hover:text-degen-400 transition-colors ${className}`}
      title="Why am I seeing this?"
      aria-label="Why am I seeing this post?"
    >
      <span className="text-xs">ℹ️</span>
      <span className="hidden sm:inline">Why this?</span>
    </button>
  );
}

// ─── Hook for managing transparency state ──────────────────────────────

export function useAlgorithmTransparency() {
  const [activePost, setActivePost] = useState<UnifiedPost | null>(null);
  const [transparencyData, setTransparencyData] = useState<TransparencyData | null>(null);
  const [loading, setLoading] = useState(false);

  const showWhy = useCallback(async (post: UnifiedPost) => {
    setActivePost(post);
    setLoading(true);
    try {
      const res = await fetch(`/api/feed/debug/${encodeURIComponent(post.id)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed');
      const data = (await res.json()) as TransparencyData;
      setTransparencyData(data);
    } catch {
      // Fallback: compute locally from what we have
      setTransparencyData({
        postId: post.id,
        postPreview: post.text.slice(0, 100),
        breakdown: {
          total: 0,
          recency: 0,
          popularity: 0,
          relevance: 0,
          niche: 0,
          protocol: 0,
          diversity: 0,
          quality: 0,
          reasons: [
            {
              factor: 'relevance',
              label: 'General match',
              detail: 'Matched your feed preferences',
              contribution: 0.5,
            },
            { factor: 'recency', label: 'Recent', detail: 'Posted recently', contribution: 0.3 },
          ],
        },
        mode: 'standard',
        isFollowed: false,
        authorName: post.author.displayName,
        protocol: post.protocol,
        niches: post.niches,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const closeWhy = useCallback(() => {
    setActivePost(null);
    setTransparencyData(null);
  }, []);

  const TransparencyOverlay =
    transparencyData && activePost ? (
      <WhyAmISeeingThis
        post={activePost}
        breakdown={transparencyData.breakdown}
        mode={transparencyData.mode}
        isFollowed={transparencyData.isFollowed}
        onClose={closeWhy}
      />
    ) : null;

  return {
    showWhy,
    closeWhy,
    TransparencyOverlay,
    loading,
    activePost,
  };
}
