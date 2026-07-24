'use client';

import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useMemo, useState } from 'react';
import { StreamCategoriesBar } from '../../components/stream/StreamCategories';
import type { StreamCategory } from '../../components/stream/types';
import { GoLiveModal } from '../../components/streams/GoLiveModal';
import { LiveHeader } from '../../components/streams/LiveHeader';
import { LiveStreamGrid } from '../../components/streams/LiveStreamGrid';
import { SpacesHub } from '../../components/streams/SpacesHub';
import { UpcomingStreams } from '../../components/streams/UpcomingStreams';
import {
  type LiveStream,
  type StreamType,
  useLiveStreams,
} from '../../components/streams/useLiveStreams';

/* === Count streams by type ==================================== */

function countByType(streams: LiveStream[]): Partial<Record<StreamType | 'all', number>> {
  const counts: Partial<Record<StreamType | 'all', number>> = { all: streams.length };
  for (const s of streams) {
    counts[s.streamType] = (counts[s.streamType] ?? 0) + 1;
  }
  return counts;
}

/* === Main Live Page =========================================== */

export default function LivePage() {
  const { streams, featured, total, isLoading, isValidating } = useLiveStreams();
  const [activeTab, setActiveTab] = useState<StreamType | 'all'>('all');
  const [activeCategory, setActiveCategory] = useState<StreamCategory | 'all'>('all');
  const [goLiveOpen, setGoLiveOpen] = useState(false);

  /* === Stream category mapping for filtering =================== */
  const streamCategoryMap: Record<string, StreamCategory> = {
    solo: 'tech',
    spaces: 'talk',
    collab: 'talk',
    launch: 'crypto',
  };

  const filtered = useMemo(() => {
    let result = activeTab === 'all' ? streams : streams.filter((s) => s.streamType === activeTab);
    if (activeCategory !== 'all') {
      result = result.filter((s) => (streamCategoryMap[s.streamType] ?? 'tech') === activeCategory);
    }
    return result;
  }, [streams, activeTab, activeCategory, streamCategoryMap]);

  const spaces = useMemo(() => streams.filter((s) => s.streamType === 'spaces'), [streams]);
  const counts = useMemo(() => countByType(streams), [streams]);

  const handleGoLive = useCallback(() => setGoLiveOpen(true), []);
  const handleStartStream = useCallback((_data: { title: string; streamType: StreamType }) => {
    // API call to start stream
  }, []);
  const handlePlay = useCallback((stream: LiveStream) => {
    window.location.href = `/live/${stream.id}`;
  }, []);

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-7xl px-4 py-6 animate-page-enter">
        {/* Header with live count + go live button */}
        <LiveHeader liveCount={total} onGoLive={handleGoLive} />

        {/* Syncing indicator */}
        {isValidating && !isLoading && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-degen-500/10 px-3 py-1.5 text-[11px] text-degen-400">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-degen-500" />
            Syncing live streams...
          </div>
        )}

        {/* == Categories Bar (TWITCH-STYLE) == */}
        <div className="mb-5">
          <StreamCategoriesBar
            activeCategory={activeCategory}
            onCategoryChange={(cat) => {
              setActiveCategory(cat);
              if (cat !== 'all') setActiveTab('all');
            }}
          />
        </div>

        {/* == Tabs: All / Coin Launches / Spaces / Solo / Collab == */}
        <LiveTabsNav activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

        <div className="space-y-8">
          {/* Featured hero carousel (only on "All" tab) */}
          {activeTab === 'all' && activeCategory === 'all' && (
            <HeroFeaturedSection streams={featured} isLoading={isLoading} onPlay={handlePlay} />
          )}

          {/* Active audio spaces (only on "All" tab) */}
          {activeTab === 'all' && activeCategory === 'all' && (
            <SpacesHub spaces={spaces} isLoading={isLoading} />
          )}

          {/* Recommended for you section */}
          {activeTab === 'all' && activeCategory === 'all' && (
            <section aria-label="Recommended for you">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-degen-500/20 to-emerald-500/10 text-sm">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="text-degen-400"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-base font-bold text-white">Recommended for You</h2>
                  <p className="text-[10px] text-white/40">Based on what you watch</p>
                </div>
              </div>
              <LiveStreamGrid
                streams={filtered.slice(0, 4)}
                isLoading={isLoading}
                onPlay={handlePlay}
              />
            </section>
          )}

          {/* Main stream grid */}
          <section aria-label="All live streams">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-white">
                {activeCategory !== 'all'
                  ? `${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Streams`
                  : activeTab !== 'all'
                    ? `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Streams`
                    : 'All Live Streams'}
              </h2>
              <span className="text-[10px] text-white/30 tabular-nums">
                {filtered.length} stream{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
            <LiveStreamGrid
              streams={filtered}
              isLoading={isLoading}
              onPlay={handlePlay}
              emptyMessage={
                activeTab === 'all'
                  ? 'No active streams in this category right now.'
                  : `No ${activeTab} streams active right now.`
              }
            />
          </section>

          {/* Upcoming streams (only on "All" tab) */}
          {activeTab === 'all' && <UpcomingStreams isLoading={isLoading} />}
        </div>

        {/* Go Live Modal */}
        <GoLiveModal
          isOpen={goLiveOpen}
          onClose={() => setGoLiveOpen(false)}
          onStart={handleStartStream}
        />
      </div>
    </ErrorBoundary>
  );
}

/* === Extended LiveTabs with Twitch-style design =============== */

function LiveTabsNav({
  activeTab,
  onTabChange,
  counts,
}: {
  activeTab: StreamType | 'all';
  onTabChange: (tab: StreamType | 'all') => void;
  counts?: Partial<Record<StreamType | 'all', number>>;
}) {
  const TABS = [
    { id: 'all' as const, label: 'All', icon: '📡' },
    { id: 'launch' as const, label: 'Coin Launches', icon: '🪙' },
    { id: 'spaces' as const, label: 'Spaces', icon: '🎙️' },
    { id: 'solo' as const, label: 'Solo', icon: '🎥' },
    { id: 'collab' as const, label: 'Collab', icon: '👥' },
  ];

  return (
    <div
      className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-1 scrollbar-none"
      role="tablist"
      aria-label="Stream categories"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = counts?.[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-all ${
              isActive
                ? 'bg-degen-500/15 text-degen-400 shadow-sm'
                : 'text-white/40 hover:bg-white/5 hover:text-white/70'
            }`}
          >
            <span className="text-sm" aria-hidden="true">
              {tab.icon}
            </span>
            <span>{tab.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums ${
                  isActive ? 'bg-degen-500/20 text-degen-400' : 'bg-white/5 text-white/30'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* === Hero Featured Section ==================================== */

function HeroFeaturedSection({
  streams,
  isLoading,
  onPlay,
}: {
  streams: LiveStream[];
  isLoading?: boolean;
  onPlay?: (stream: LiveStream) => void;
}) {
  if (isLoading) {
    return (
      <section aria-label="Featured stream" className="mb-8">
        <div className="aspect-video w-full rounded-2xl skeleton" />
      </section>
    );
  }
  if (streams.length === 0) return null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const featured = streams[currentIndex % streams.length]!;

  const handlePrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + streams.length) % streams.length);
  }, [streams.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % streams.length);
  }, [streams.length]);

  return (
    <section aria-label="Featured stream" className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-yellow-500/10 text-sm">
            ⭐
          </span>
          <div>
            <h2 className="text-base font-bold text-white">Featured</h2>
            <p className="text-[10px] text-white/40">Top stream right now</p>
          </div>
        </div>
        {streams.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white"
              aria-label="Previous featured"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white"
              aria-label="Next featured"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Hero card */}
      <button
        type="button"
        onClick={() => onPlay?.(featured)}
        className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-800/40 via-purple-700/20 to-degen-800/20 text-left transition-all hover:ring-2 hover:ring-degen-500/30"
      >
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
        {/* Noise */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              LIVE
            </span>
            <span className="rounded-md bg-black/50 px-2 py-1 text-[10px] text-white/70 backdrop-blur-sm">
              {featured.viewerCount.toLocaleString()} watching
            </span>
          </div>

          <h3 className="text-xl font-bold text-white sm:text-2xl line-clamp-2">
            {featured.title}
          </h3>

          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-[7px] font-bold text-degen-400">
                {featured.creatorAvatar ? (
                  <img
                    src={featured.creatorAvatar}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  featured.creatorHandle[0]?.toUpperCase() || '?'
                )}
              </div>
              <span className="text-xs font-medium text-white/80">@{featured.creatorHandle}</span>
            </div>
            <span className="text-[10px] text-white/40">
              {formatStreamDuration(featured.startedAt)}
            </span>
          </div>
        </div>

        {/* Play button overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-degen-500/90 text-black shadow-2xl transition-transform group-hover:scale-110">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </div>
        </div>

        {/* Pagination dots */}
        {streams.length > 1 && (
          <div className="absolute right-6 top-6 flex gap-1.5">
            {streams.slice(0, Math.min(streams.length, 5)).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(i);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'
                }`}
                aria-label={`Go to featured stream ${i + 1}`}
              />
            ))}
          </div>
        )}
      </button>
    </section>
  );
}

/* === Helper =================================================== */

function formatStreamDuration(startedAt: number): string {
  const minutes = Math.floor((Date.now() - startedAt) / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}
