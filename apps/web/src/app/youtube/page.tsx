'use client';

/**
 * @degenfeed/web — /youtube
 *
 * Dedicated YouTube content section on DegenFeed.
 *
 * CLEARLY LABELED: "YouTube on DegenFeed" — not pretending to be PeerTube.
 * The value is algorithmic curation + cross-platform DegenFeed actions.
 *
 * Sections:
 *   - Hero: Featured video (large card)
 *   - Category bar: Horizontal scrollable pills
 *   - "Trending on YouTube" — video grid (4 cols desktop)
 *   - "YouTube Shorts" — horizontal scrollable Shorts feed
 *   - "Recommended for You" — personalized grid
 *   - "Crypto & Blockchain" — category-specific section
 *
 * Each video card: thumbnail, title, channel, views, duration badge
 * Source badge: "YouTube" in red, distinct from PeerTube's purple
 * Cross-platform actions: Tip, Share, Save, Cross-post
 */

import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useState } from 'react';
import {
  YouTubeVideoGrid,
} from '../../components/youtube/YouTubeVideoGrid';
import {
  YouTubeShortsFeed,
} from '../../components/youtube/YouTubeShortsFeed';
import {
  YouTubeCategoryBar,
} from '../../components/youtube/YouTubeCategoryBar';
import {
  YouTubeSearchBar,
  YouTubeSearchResults,
} from '../../components/youtube/YouTubeSearchResults';
import { YouTubeSourceBadge } from '../../components/youtube/YouTubeSourceBadge';
import {
  useYouTubeTrending,
  useYouTubeRecommended,
  useYouTubeShorts,
  useYouTubeCategories,
} from '../../components/youtube/useYouTube';
import type { EnrichedYouTubeVideo, YouTubeShort } from '../../components/youtube/useYouTube';

// === Constants ===========================================================

const TRENDING_LIMIT = 24;
const RECOMMENDED_LIMIT = 12;
const SHORTS_LIMIT = 18;

// === Skeleton Loading ====================================================

function YouTubePageSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Hero skeleton */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
        <div className="aspect-video lg:aspect-[21/9] bg-[var(--color-muted)]" />
        <div className="p-4 space-y-3">
          <div className="h-6 w-3/4 rounded bg-[var(--color-muted)]" />
          <div className="h-4 w-1/2 rounded bg-[var(--color-muted)]" />
          <div className="h-4 w-1/3 rounded bg-[var(--color-muted)]" />
        </div>
      </div>

      {/* Category bar skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`cat-skel-${i}`} className="h-8 w-20 rounded-full bg-[var(--color-card)] border border-[var(--color-glass-border)]" />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="space-y-3">
        <div className="h-6 w-48 rounded bg-[var(--color-muted)]" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`grid-skel-${i}`} className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
              <div className="aspect-video bg-[var(--color-muted)]" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 rounded bg-[var(--color-muted)]" />
                <div className="h-3 w-1/2 rounded bg-[var(--color-muted)]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shorts skeleton */}
      <div className="space-y-3">
        <div className="h-6 w-36 rounded bg-[var(--color-muted)]" />
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`shorts-skel-${i}`} className="w-44 md:w-52 aspect-[9/16] rounded-xl bg-[var(--color-card)] border border-[var(--color-glass-border)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

// === Error State =========================================================

function YouTubePageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-950/30 border border-red-900/30">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-red-500">
          <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 9L16 12L10 15V9Z" fill="currentColor" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-[var(--color-fg)] mb-2">YouTube Content Unavailable</h2>
      <p className="text-sm text-[var(--color-muted)] max-w-md mb-6">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/40"
      >
        Try Again
      </button>
      <p className="mt-4 text-xs text-[var(--color-muted)]">
        YouTube content is sourced via RSS feeds and may be temporarily delayed.
      </p>
    </div>
  );
}

// === Main Page ===========================================================

export default function YouTubePage() {
  // == State ==
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);

  // == Data ==
  const {
    videos: trending,
    isLoading: trendingLoading,
    isError: trendingError,
    error: trendingErr,
    mutate: retryTrending,
  } = useYouTubeTrending(activeCategory, TRENDING_LIMIT);

  const {
    videos: recommended,
    isLoading: recommendedLoading,
  } = useYouTubeRecommended(RECOMMENDED_LIMIT);

  const {
    shorts,
    isLoading: shortsLoading,
  } = useYouTubeShorts('crypto', SHORTS_LIMIT);

  const {
    categories,
    isLoading: categoriesLoading,
  } = useYouTubeCategories();

  // == Callbacks ==

  const handlePlay = useCallback((video: EnrichedYouTubeVideo) => {
    window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank', 'noopener noreferrer');
  }, []);

  const handleShortPlay = useCallback((short: YouTubeShort) => {
    window.open(short.videoUrl, '_blank', 'noopener noreferrer');
  }, []);

  const handleTip = useCallback((_video: EnrichedYouTubeVideo) => {
    // TODO: Open tip modal with creator coin
    console.log('Tip video:', _video.id);
  }, []);

  const handleShare = useCallback((video: EnrichedYouTubeVideo) => {
    const url = `https://www.youtube.com/watch?v=${video.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
  }, []);

  const handleSave = useCallback((_video: EnrichedYouTubeVideo) => {
    // TODO: Save to bookmarks/watch later
    console.log('Save video:', _video.id);
  }, []);

  const handleCrossPost = useCallback((_video: EnrichedYouTubeVideo) => {
    // TODO: Open cross-post modal (Nostr, Farcaster, Bluesky, Mastodon)
    console.log('Cross-post video:', _video.id);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setSearchActive(true);
  }, []);

  const handleCategoryChange = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    setSearchActive(false);
  }, []);

  // == Featured video (first trending item) ==
  const featuredVideo = trending.length > 0 ? trending[0] : null;

  // == Render ==

  const isError = trendingError && !trendingLoading;

  return (
    <ErrorBoundary>
      <main className="mx-auto max-w-7xl px-4 py-6 md:py-8">
        {/* ══ Page Header ══ */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-fg)] flex items-center gap-2">
              <span className="text-red-500">{'\u25B6'}</span>
              YouTube on DegenFeed
            </h1>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Curated YouTube content with algorithmic discovery and cross-platform actions.
            </p>
          </div>
          <div className="flex-shrink-0">
            <YouTubeSourceBadge source="youtube" size="lg" />
          </div>
        </div>

        {/* ══ Search Bar ══ */}
        <div className="mb-6">
          <YouTubeSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
            placeholder="Search YouTube videos..."
          />
        </div>

        {/* ══ Category Bar ══ */}
        {!categoriesLoading && (
          <div className="mb-6">
            <YouTubeCategoryBar
              categories={categories}
              activeCategory={searchActive ? '__search__' : activeCategory}
              onCategoryChange={handleCategoryChange}
              showAll
            />
          </div>
        )}

        {/* ══ Search Results ══ */}
        {searchActive && searchQuery ? (
          <div className="mt-4">
            <YouTubeSearchResults query={searchQuery} />
          </div>
        ) : (
          <>
            {/* ══ Error State ══ */}
            {isError && (
              <YouTubePageError
                message={trendingErr instanceof Error ? trendingErr.message : 'Failed to load YouTube content.'}
                onRetry={() => retryTrending()}
              />
            )}

            {/* ══ Loading State ══ */}
            {trendingLoading && trending.length === 0 && <YouTubePageSkeleton />}

            {/* ══ Content ══ */}
            {!isError && (trending.length > 0 || !trendingLoading) && (
              <div className="space-y-10">
                {/* ══ Hero: Featured Video ══ */}
                {featuredVideo && (
                  <section aria-label="Featured video">
                    <YouTubeVideoGrid
                      videos={[featuredVideo]}
                      title="Featured"
                      onPlay={handlePlay}
                      onTip={handleTip}
                      onShare={handleShare}
                      onSave={handleSave}
                      onCrossPost={handleCrossPost}
                    />
                  </section>
                )}

                {/* ══ Trending on YouTube ══ */}
                <section aria-label="Trending on YouTube">
                  <YouTubeVideoGrid
                    videos={trending}
                    loading={trendingLoading}
                    title="Trending on YouTube"
                    onPlay={handlePlay}
                    onTip={handleTip}
                    onShare={handleShare}
                    onSave={handleSave}
                    onCrossPost={handleCrossPost}
                    emptyMessage={
                      activeCategory !== 'all'
                        ? `No trending YouTube videos in this category. Try a different category.`
                        : 'No trending YouTube videos right now. Check back later.'
                    }
                  />
                </section>

                {/* ══ YouTube Shorts ══ */}
                <section aria-label="YouTube Shorts">
                  <YouTubeShortsFeed
                    shorts={shorts}
                    loading={shortsLoading}
                    title="YouTube Shorts"
                    onPlay={handleShortPlay}
                  />
                </section>

                {/* ══ Recommended for You ══ */}
                {recommended.length > 0 && (
                  <section aria-label="Recommended for you">
                    <YouTubeVideoGrid
                      videos={recommended}
                      loading={recommendedLoading}
                      title="Recommended for You"
                      onPlay={handlePlay}
                      onTip={handleTip}
                      onShare={handleShare}
                      onSave={handleSave}
                      onCrossPost={handleCrossPost}
                    />
                  </section>
                )}

                {/* ══ Crypto & Blockchain section (when viewing all) ══ */}
                {activeCategory === 'all' && (
                  <section aria-label="Crypto & Blockchain">
                    <YouTubeVideoGrid
                      videos={trending.filter((v) =>
                        ['crypto', 'tech'].includes(v.category) ||
                        v.tags.some((t) => ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'defi'].includes(t)),
                      ).slice(0, 8)}
                      title="Crypto & Blockchain"
                      onPlay={handlePlay}
                      onTip={handleTip}
                      onShare={handleShare}
                      onSave={handleSave}
                      onCrossPost={handleCrossPost}
                    />
                  </section>
                )}

                {/* ══ Source transparency note ══ */}
                <footer className="border-t border-[var(--color-glass-border)] pt-6 pb-4">
                  <div className="flex flex-col items-center text-center gap-2">
                    <p className="text-xs text-[var(--color-muted)] max-w-lg">
                      <YouTubeSourceBadge source="youtube" size="sm" /> Content is sourced from YouTube and
                      curated algorithmically for your interests. We clearly label all content by its original source.
                      YouTube is a trademark of Google LLC. This project is not affiliated with or endorsed by YouTube.
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
                      <span>{'\u25B6'} YouTube = Red badge</span>
                      <span>{'\uD83D\uDCF9'} PeerTube = Purple badge</span>
                      <span>{'\uD83D\uDCBF'} Shorts = Pink badge</span>
                      <span>{'\uD83E\uDE99'} DegenFeed = Green badge</span>
                    </div>
                  </div>
                </footer>
              </div>
            )}
          </>
        )}
      </main>
    </ErrorBoundary>
  );
}
