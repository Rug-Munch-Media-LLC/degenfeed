/**
 * @degenfeed/web — BlueskyMediaView
 *
 * Instagram-style media gallery for Bluesky content.
 * Features:
 *  - Tabbed: Images | Videos | Trending
 *  - Responsive grid (3/2/1 columns)
 *  - Lightbox for full-size images
 *  - Video player for external/video embeds + inline playback
 *  - Infinite scroll pagination
 *  - Pull-to-refresh on mobile
 *  - Loading skeletons with staggered entrance
 */

'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Lightbox } from './bluesky-lightbox';
import { EmptyState, ImageCard, TrendingTextCard, VideoCard } from './bluesky-media-card';
import { extractMedia, formatCount, isVideoPost } from './bluesky-media-helpers';
import { usePullToRefresh } from './bluesky-media-hooks';
import type { TabId } from './bluesky-media-types';
import { BLUESKY_BLUE, POSTS_PER_PAGE, TABS } from './bluesky-media-types';
import { PullIndicator, SkeletonGrid, TabBar } from './bluesky-tab-bar';

// ─── Main Component ─────────────────────────────────────────────

export function BlueskyMediaView() {
  const [activeTab, setActiveTab] = useState<TabId>('images');
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'error' | 'empty'>('loading');
  const [error, setError] = useState<string>();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Lightbox state
  const [lightboxPost, setLightboxPost] = useState<UnifiedPost | null>(null);
  const [_lightboxMediaIndex, setLightboxMediaIndex] = useState(0);

  // Pull-to-refresh
  const { containerRef, pullState, pullDistance } = usePullToRefresh(async () => {
    setPage(1);
    setState('loading');
    await fetchPosts(1, true);
  });

  const activeConfig = TABS.find((t) => t.id === activeTab)!;

  const fetchPosts = useCallback(
    async (pageNum: number, replace = false) => {
      try {
        const endpoint = activeConfig.endpoint;
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set('limit', String(POSTS_PER_PAGE));
        if (pageNum > 1) url.searchParams.set('page', String(pageNum));

        const res = await fetch(url.toString(), {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`API returned ${res.status}`);

        const data = (await res.json()) as { data?: UnifiedPost[]; meta?: { total?: number } };
        const feed = data.data ?? [];

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
    [activeConfig.endpoint],
  );

  // Initial fetch when tab changes
  useEffect(() => {
    setPage(1);
    setPosts([]);
    setState('loading');
    setHasMore(true);
    void fetchPosts(1, true);
  }, [fetchPosts]);

  // Infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && state === 'loaded') {
          setLoadingMore(true);
          const nextPage = page + 1;
          setPage(nextPage);
          await fetchPosts(nextPage, false);
          setLoadingMore(false);
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, state, page, fetchPosts]);

  // Get all media items from current posts
  const getAllMediaPosts = useCallback(() => {
    if (activeTab === 'videos') return [];
    return posts.flatMap((p) => {
      const media = extractMedia(p);
      return media.length > 0 ? [{ post: p, media: media[0]! }] : [];
    });
  }, [posts, activeTab]);

  const mediaPosts = getAllMediaPosts();

  // Lightbox navigation
  const currentLightboxIndex = lightboxPost
    ? mediaPosts.findIndex((mp) => mp.post.id === lightboxPost.id)
    : -1;

  const openLightbox = (post: UnifiedPost) => {
    setLightboxPost(post);
    setLightboxMediaIndex(0);
  };

  const closeLightbox = () => {
    setLightboxPost(null);
    setLightboxMediaIndex(0);
  };

  const goToPrev = () => {
    if (currentLightboxIndex > 0) {
      const prev = mediaPosts[currentLightboxIndex - 1];
      if (prev) openLightbox(prev.post);
    }
  };

  const goToNext = () => {
    if (currentLightboxIndex < mediaPosts.length - 1) {
      const next = mediaPosts[currentLightboxIndex + 1];
      if (next) openLightbox(next.post);
    }
  };

  // ── Render ──

  return (
    <div ref={containerRef} className="min-h-screen pb-12">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
            Bluesky Media
          </h1>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            Photos, videos, and trending content from the AT Protocol
          </p>
        </div>
        <div
          className="hidden h-10 w-10 items-center justify-center rounded-full sm:flex"
          style={{ backgroundColor: BLUESKY_BLUE }}
        >
          <span className="text-lg">🦋</span>
        </div>
      </div>

      <PullIndicator state={pullState} distance={pullDistance} />

      {/* Tabs */}
      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      {state === 'loading' && <SkeletonGrid count={12} />}

      {state === 'error' && (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="mb-2 text-sm font-medium text-red-400">Failed to load content</p>
          <p className="mb-4 text-xs" style={{ color: 'var(--color-muted)' }}>
            {error}
          </p>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setState('loading');
              void fetchPosts(1, true);
            }}
            className="rounded-lg px-4 py-2 text-xs font-medium text-white"
            style={{ backgroundColor: BLUESKY_BLUE }}
          >
            Retry
          </button>
        </div>
      )}

      {state === 'empty' && (
        <EmptyState
          tabLabel={activeConfig.label}
          onRetry={() => {
            setPage(1);
            setState('loading');
            void fetchPosts(1, true);
          }}
        />
      )}

      {state === 'loaded' && activeTab === 'images' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const mediaList = extractMedia(post);
            if (mediaList.length === 0) return null;
            return (
              <ImageCard
                key={post.id}
                post={post}
                media={mediaList[0]!}
                onImageClick={openLightbox}
              />
            );
          })}
        </div>
      )}

      {state === 'loaded' && activeTab === 'videos' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {posts.filter(isVideoPost).map((post) => (
            <VideoCard key={post.id} post={post} />
          ))}
          {posts
            .filter((p) => !isVideoPost(p))
            .map((post) => (
              <VideoCard key={post.id} post={post} />
            ))}
        </div>
      )}

      {state === 'loaded' && activeTab === 'trending' && (
        <div className="flex flex-col gap-2">
          {posts.map((post) => (
            <TrendingTextCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {loadingMore && (
        <div className="flex justify-center py-6">
          <div className="flex items-center gap-2 text-xs" style={{ color: BLUESKY_BLUE }}>
            <svg
              aria-hidden="true"
              className="animate-spin"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
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

      {/* Lightbox */}
      {lightboxPost && currentLightboxIndex >= 0 && mediaPosts[currentLightboxIndex] && (
        <Lightbox
          post={mediaPosts[currentLightboxIndex]!.post}
          media={mediaPosts[currentLightboxIndex]!.media}
          onClose={closeLightbox}
          onPrev={currentLightboxIndex > 0 ? goToPrev : undefined}
          onNext={currentLightboxIndex < mediaPosts.length - 1 ? goToNext : undefined}
          hasPrev={currentLightboxIndex > 0}
          hasNext={currentLightboxIndex < mediaPosts.length - 1}
        />
      )}
    </div>
  );
}
