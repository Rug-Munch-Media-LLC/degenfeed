/**
 * @degenfeed/web — MediaFeed
 *
 * Main orchestrator for the unified media hub.
 * Fetches from the media API, manages the filter state,
 * and renders the appropriate layout for each tab:
 *   - all/images: Masonry grid
 *   - videos: YouTube-style grid
 *   - live: Live stream cards
 *
 * Integrates with ProtocolFeed's data flow pattern.
 */

'use client';

import type { VisualFeedResponse, VisualPost } from '@degenfeed/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LiveCard } from './LiveCard';
import { MediaCard } from './MediaCard';
import { MediaFeedTabs } from './MediaFeedTabs';
import { MediaLightbox } from './MediaLightbox';
import { MediaMasonryGrid } from './MediaMasonryGrid';
import type { MediaFilter } from './MediaTypes';
import { VideoGridCard } from './VideoGridCard';

// ─── Constants ───────────────────────────────────────────────────

const POSTS_PER_PAGE = 30;
const API_ENDPOINT = '/api/feed/media';

// ─── MediaFeed ───────────────────────────────────────────────────

interface MediaFeedProps {
  /** Initial filter tab */
  defaultFilter?: MediaFilter;
  /** Hide the header description */
  hideHeader?: boolean;
  /** Custom class name */
  className?: string;
}

export function MediaFeed({
  defaultFilter = 'all',
  hideHeader = false,
  className = '',
}: MediaFeedProps) {
  const [activeFilter, setActiveFilter] = useState<MediaFilter>(defaultFilter);
  const [posts, setPosts] = useState<VisualPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Lightbox state
  const [lightboxPost, setLightboxPost] = useState<VisualPost | null>(null);

  // Load more ref to avoid stale closures
  const loadingRef = useRef(false);

  // ── Fetch posts ──
  const fetchPosts = useCallback(
    async (pageNum: number, replace = false) => {
      try {
        const url = new URL(API_ENDPOINT, window.location.origin);
        url.searchParams.set('limit', String(POSTS_PER_PAGE));
        if (activeFilter !== 'all') {
          url.searchParams.set('type', activeFilter);
        }
        if (pageNum > 1) {
          url.searchParams.set('page', String(pageNum));
        }

        const res = await fetch(url.toString(), {
          credentials: 'include',
          cache: 'no-store',
        });

        if (!res.ok) throw new Error(`API returned ${res.status}`);

        const json = (await res.json()) as VisualFeedResponse;
        const feed = json.data ?? [];

        if (replace) {
          setPosts(feed);
        } else {
          setPosts((prev) => [...prev, ...feed]);
        }

        setHasMore(feed.length >= POSTS_PER_PAGE);
        setState(feed.length > 0 || pageNum > 1 ? 'loaded' : 'empty');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
        setState('error');
      }
    },
    [activeFilter],
  );

  // ── Initial fetch on filter change ──
  useEffect(() => {
    setPage(1);
    setPosts([]);
    setState('loading');
    setHasMore(true);
    loadingRef.current = false;
    void fetchPosts(1, true);
  }, [fetchPosts]);

  // ── Load more ──
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore || state !== 'loaded') return;
    setLoadingMore(true);
    loadingRef.current = true;
    const nextPage = page + 1;
    setPage(nextPage);
    void fetchPosts(nextPage, false).finally(() => {
      setLoadingMore(false);
      loadingRef.current = false;
    });
  }, [loadingMore, hasMore, state, page, fetchPosts]);

  // ── Retry ──
  const handleRetry = useCallback(() => {
    setPage(1);
    setState('loading');
    void fetchPosts(1, true);
  }, [fetchPosts]);

  // ── Lightbox navigation ──
  const currentLightboxIndex = useMemo(
    () => (lightboxPost ? posts.findIndex((p) => p.id === lightboxPost.id) : -1),
    [lightboxPost, posts],
  );

  const openLightbox = useCallback((post: VisualPost) => {
    setLightboxPost(post);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxPost(null);
  }, []);

  const goToPrev = useCallback(() => {
    if (currentLightboxIndex > 0) {
      setLightboxPost(posts[currentLightboxIndex - 1] ?? null);
    }
  }, [currentLightboxIndex, posts]);

  const goToNext = useCallback(() => {
    if (currentLightboxIndex < posts.length - 1) {
      setLightboxPost(posts[currentLightboxIndex + 1] ?? null);
    }
  }, [currentLightboxIndex, posts]);

  // ── Compute counts per filter for tab badges ──
  const filterCounts = useMemo(() => {
    const counts: Partial<Record<MediaFilter, number>> = {};
    counts.images = posts.filter(
      (p) => p.mediaType === 'image' || p.mediaType === 'nft_image' || p.mediaType === 'gif',
    ).length;
    counts.videos = posts.filter(
      (p) => p.mediaType === 'video' || p.mediaType === 'nft_video',
    ).length;
    counts.live = posts.filter((p) => p.mediaType === 'video' && p.meta?.isLive).length;
    return counts;
  }, [posts]);

  // ── Filtered posts based on active tab ──
  const filteredPosts = useMemo(() => {
    if (activeFilter === 'all') return posts;
    if (activeFilter === 'images') {
      return posts.filter(
        (p) => p.mediaType === 'image' || p.mediaType === 'nft_image' || p.mediaType === 'gif',
      );
    }
    if (activeFilter === 'videos') {
      return posts.filter((p) => p.mediaType === 'video' || p.mediaType === 'nft_video');
    }
    if (activeFilter === 'live') {
      return posts.filter((p) => p.mediaType === 'video' && p.meta?.isLive);
    }
    return posts;
  }, [posts, activeFilter]);

  // ── Render helpers ──

  const renderMediaCard = useCallback(
    (post: VisualPost) => <MediaCard post={post} onClick={openLightbox} />,
    [openLightbox],
  );

  const renderVideoCard = useCallback(
    (post: VisualPost) => <VideoGridCard post={post} onClick={openLightbox} />,
    [openLightbox],
  );

  const renderLiveCard = useCallback(
    (post: VisualPost) => <LiveCard post={post} onClick={openLightbox} />,
    [openLightbox],
  );

  // ── Render ──
  return (
    <div className={`space-y-6 ${className}`}>
      {/* ── Header ── */}
      {!hideHeader && (
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>
            Media Hub
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
            Images, videos, and live streams from every protocol
          </p>
        </div>
      )}

      {/* ── Filter tabs ── */}
      <MediaFeedTabs activeTab={activeFilter} onTabChange={setActiveFilter} counts={filterCounts} />

      {/* ── Content area ── */}
      <div key={activeFilter} className="animate-fadeIn">
        {/* All / Images: Masonry grid */}
        {(activeFilter === 'all' || activeFilter === 'images') && (
          <MediaMasonryGrid
            posts={filteredPosts}
            state={state}
            error={error}
            filter={activeFilter}
            onPostClick={openLightbox}
            onRetry={handleRetry}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            loadingMore={loadingMore}
            renderCard={renderMediaCard}
          />
        )}

        {/* Videos: YouTube-style grid */}
        {activeFilter === 'videos' && (
          <div>
            {state === 'loading' && filteredPosts.length === 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-xl"
                    style={{ backgroundColor: 'var(--color-card)' }}
                  >
                    <div
                      className="w-full skeleton-shimmer"
                      style={{ aspectRatio: '16/9', borderRadius: '0.75rem 0.75rem 0 0' }}
                    />
                    <div className="flex gap-3 p-3">
                      <div className="h-8 w-8 rounded-full bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-full rounded bg-white/10" />
                        <div className="h-2 w-20 rounded bg-white/10" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {state === 'empty' && (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="mb-1 text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
                  No videos yet
                </p>
                <p className="mb-4 text-xs" style={{ color: 'var(--color-muted)' }}>
                  Videos from PeerTube, YouTube, and other sources will appear here
                </p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  Try again
                </button>
              </div>
            )}

            {state === 'error' && (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="mb-2 text-sm font-medium text-red-400">Failed to load videos</p>
                <p className="mb-4 text-xs" style={{ color: 'var(--color-muted)' }}>
                  {error}
                </p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  Retry
                </button>
              </div>
            )}

            {state === 'loaded' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredPosts.map((post) => (
                    <div key={post.id}>{renderVideoCard(post)}</div>
                  ))}
                </div>

                {loadingMore && (
                  <div className="flex justify-center py-6">
                    <div
                      className="flex items-center gap-2 text-xs"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      <svg
                        aria-hidden="true"
                        className="animate-spin"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3"
                          opacity="0.3"
                        />
                        <path
                          d="M12 2a10 10 0 0110 10"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                      Loading more...
                    </div>
                  </div>
                )}

                {!hasMore && filteredPosts.length > 0 && (
                  <p className="py-6 text-center text-xs" style={{ color: 'var(--color-muted)' }}>
                    You&apos;ve reached the end
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Live: Stream cards */}
        {activeFilter === 'live' && (
          <div>
            {state === 'loading' && filteredPosts.length === 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-xl"
                    style={{ backgroundColor: 'var(--color-card)' }}
                  >
                    <div
                      className="w-full skeleton-shimmer"
                      style={{ aspectRatio: '16/9', borderRadius: '0.75rem 0.75rem 0 0' }}
                    />
                    <div className="flex gap-3 p-3">
                      <div className="h-8 w-8 rounded-full bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-full rounded bg-white/10" />
                        <div className="h-2 w-16 rounded bg-white/10" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {state === 'empty' && (
              <div className="flex flex-col items-center justify-center py-20">
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-full text-2xl"
                  style={{
                    backgroundColor: 'var(--color-overlay)',
                    color: 'var(--color-muted)',
                  }}
                >
                  ●
                </div>
                <p className="mb-1 text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
                  No live streams right now
                </p>
                <p
                  className="mb-4 max-w-xs text-center text-xs"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Live streams from Owncast, PeerTube Live, YouTube Live, and Twitch will appear
                  here when they are active.
                </p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  Check again
                </button>
              </div>
            )}

            {state === 'error' && (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="mb-2 text-sm font-medium text-red-400">Failed to load streams</p>
                <p className="mb-4 text-xs" style={{ color: 'var(--color-muted)' }}>
                  {error}
                </p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  Retry
                </button>
              </div>
            )}

            {state === 'loaded' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPosts.map((post) => (
                    <div key={post.id}>{renderLiveCard(post)}</div>
                  ))}
                </div>

                {loadingMore && (
                  <div className="flex justify-center py-6">
                    <div
                      className="flex items-center gap-2 text-xs"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      <svg
                        aria-hidden="true"
                        className="animate-spin"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3"
                          opacity="0.3"
                        />
                        <path
                          d="M12 2a10 10 0 0110 10"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                      Loading more...
                    </div>
                  </div>
                )}

                {!hasMore && filteredPosts.length > 0 && (
                  <p className="py-6 text-center text-xs" style={{ color: 'var(--color-muted)' }}>
                    No more live streams
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightboxPost && currentLightboxIndex >= 0 && (
        <MediaLightbox
          post={lightboxPost}
          onClose={closeLightbox}
          onPrev={currentLightboxIndex > 0 ? goToPrev : undefined}
          onNext={currentLightboxIndex < posts.length - 1 ? goToNext : undefined}
          hasPrev={currentLightboxIndex > 0}
          hasNext={currentLightboxIndex < posts.length - 1}
        />
      )}
    </div>
  );
}
