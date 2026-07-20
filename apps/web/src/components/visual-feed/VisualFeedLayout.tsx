'use client';

/**
 * VisualFeedLayout — Main page layout with filters, grid, and header.
 * Provides the unified visual browsing experience.
 */

import { useCallback, useState, useRef } from 'react';
import type { VisualPost } from '@degenfeed/types';
import { FilterBar } from './FilterBar';
import { VisualFeedGrid } from './VisualFeedGrid';
import { useVisualFeed } from './useVisualFeed';

export function VisualFeedLayout() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('newest');
  const [showTipModal, setShowTipModal] = useState<VisualPost | null>(null);
  const tipModalRef = useRef<HTMLDivElement>(null);

  const { posts, loading, error, hasMore, loadMore, refresh, meta } = useVisualFeed({
    filter: activeFilter as 'all' | 'photos' | 'nfts' | 'video' | 'bluesky',
    sort: activeSort as 'newest' | 'trending' | 'top',
    limit: 30,
  });

  const handleFilterChange = useCallback((filter: string) => {
    setActiveFilter(filter);
  }, []);

  const handleSortChange = useCallback((sort: string) => {
    setActiveSort(sort);
  }, []);

  const handleTip = useCallback((post: VisualPost) => {
    setShowTipModal(post);
  }, []);

  const handleMint = useCallback((post: VisualPost) => {
    if (post.mintUrl) {
      window.open(post.mintUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const handleCollect = useCallback((post: VisualPost) => {
    if (post.collectUrl) {
      window.open(post.collectUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const handleLike = useCallback(async (post: VisualPost) => {
    try {
      await fetch('/api/engage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: post.engagement?.viewerLiked ? 'unlike' : 'like',
          postId: post.id,
          protocol: post.protocol,
        }),
      });
    } catch {
      // Silent fail — optimistic UI already updated
    }
  }, []);

  const handleComment = useCallback((_post: VisualPost) => {
    // Open reply modal or navigate to post
  }, []);

  const handleRepost = useCallback(async (post: VisualPost) => {
    try {
      await fetch('/api/engage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: post.engagement?.viewerReposted ? 'unrepost' : 'repost',
          postId: post.id,
          protocol: post.protocol,
        }),
      });
    } catch {
      // Silent fail
    }
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="white" />
              <path d="M21 15l-5-5L5 21" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-fg)]">Visual Feed</h1>
            <p className="text-xs text-[var(--color-muted)]">
              Photos, videos, and NFTs from every platform
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-card-hover)]"
            aria-label="Refresh feed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Filter bar */}
        <FilterBar
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          activeSort={activeSort}
          onSortChange={handleSortChange}
          sourceCounts={meta?.perSource}
        />

        {/* Source breakdown */}
        {meta?.perSource && Object.keys(meta.perSource).length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {Object.entries(meta.perSource)
              .filter(([, count]) => count > 0)
              .map(([source, count]) => (
                <span
                  key={source}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: 'var(--color-overlay)',
                    color: 'var(--color-muted)',
                  }}
                >
                  <span className="capitalize">{source}</span>
                  <span className="tabular-nums">{count}</span>
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Visual feed grid */}
      <VisualFeedGrid
        posts={posts}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onTip={handleTip}
        onMint={handleMint}
        onCollect={handleCollect}
        onLike={handleLike}
        onComment={handleComment}
        onRepost={handleRepost}
      />

      {/* Tip Modal (simplified — real implementation uses the existing TipModal) */}
      {showTipModal && (
        <div
          ref={tipModalRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowTipModal(null)}
        >
          <div
            className="mx-4 w-full max-w-md rounded-2xl p-6"
            style={{
              backgroundColor: 'var(--color-card-bg)',
              border: '1px solid var(--color-glass-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--color-fg)]">
                Tip {showTipModal.author.displayName || 'Creator'}
              </h2>
              <button
                type="button"
                onClick={() => setShowTipModal(null)}
                className="rounded-lg p-1 text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Preview */}
            <div className="mb-4 flex items-center gap-3 rounded-lg p-3" style={{ backgroundColor: 'var(--color-overlay)' }}>
              <img
                src={showTipModal.imageUrl}
                alt=""
                className="h-12 w-12 rounded-lg object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                  {showTipModal.text || 'Visual post'}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {showTipModal.sourceBadge} {showTipModal.sourceLabel}
                </p>
              </div>
            </div>

            {/* Tip amount selector */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[0.01, 0.05, 0.1, 0.5, 1, 5].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-degen-500/10 hover:border-degen-500/30"
                >
                  {amount} SOL
                </button>
              ))}
            </div>

            <button
              type="button"
              className="w-full rounded-xl bg-degen-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-degen-400 active:scale-[0.98]"
            >
              Send Tip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
