'use client';

/**
 * @pages/shorts — Full-screen TikTok-style vertical video feed.
 *
 * Uses the modular shorts component system:
 *   - ShortsFeed: vertical swipe container with snap scrolling
 *   - useShorts: SWR-like fetch + infinite scroll hook
 *   - ShortVideoCard: full-featured video overlay card
 *
 * Design: Immersive dark cyberpunk with neon-green degen accents.
 */

import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useRef, useState } from 'react';
import { ShortVideoCard } from '../../components/ShortVideoCard';
import { useShorts } from '../../components/shorts/useShorts';
import { CreateShortModal } from '../../components/shorts/CreateShortModal';
import type { ShortVideoItem } from '../../components/shorts/useShorts';

// ─── Adapter: ShortVideoItem → UnifiedPost-like shape ──────────────────

function shortToUnifiedPost(video: ShortVideoItem, idx: number) {
  const id = `short:${video.source}:${video.id}`;
  return {
    id,
    protocol: video.source === 'youtube' ? 'youtube' : video.source === 'peertube' ? 'peertube' : 'rss',
    author: {
      id: `${video.source}:${video.authorName.replace(/[^a-zA-Z0-9]/g, '_')}`,
      primary: {
        protocol: (video.source === 'youtube' ? 'youtube' : video.source === 'peertube' ? 'peertube' : 'rss') as string,
        id: video.authorName,
      },
      handles: {} as Record<string, string | null>,
      displayName: video.authorName,
      bio: '',
      avatarUrl: video.authorAvatar ?? '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: video.title,
    html: undefined,
    embeds: [
      {
        kind: 'video' as const,
        url: video.videoUrl,
        meta: { thumbnail: video.thumbnailUrl, duration: video.duration },
      },
      { kind: 'link' as const, url: video.sourceUrl },
    ],
    createdAt: video.publishedAt,
    metrics: { likes: video.likes, reposts: 0, replies: 0, quotes: 0, views: video.views },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: video.likes, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: video,
    niches: video.topics,
    dfUri: `df://shorts/${video.source}/${idx}`,
    contentType: 'video',
    tipCount: 0,
  };
}

// ─── Page Component ─────────────────────────────────────────────────────

export default function ShortsPage() {
  const [topicFilter, setTopicFilter] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const params = new URLSearchParams(window.location.search);
    const topics = params.get('topics');
    return topics ? topics.split(',').filter(Boolean) : [];
  });

  const shortsFeed = useShorts({
    endpoint: '/api/shorts/feed',
    topics: topicFilter.length > 0 ? topicFilter : undefined,
  });

  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <ErrorBoundary>
      {/* Video feed */}
      <section
        className="fixed inset-0 z-40 overflow-y-scroll snap-y snap-mandatory overscroll-none"
        style={{ backgroundColor: '#000', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        aria-label="Shorts video feed"
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>

        {/* Loading */}
        {shortsFeed.loading && shortsFeed.videos.length === 0 && (
          <div className="flex h-screen w-full snap-start flex-col items-center justify-center bg-black">
            <div className="mb-6 flex items-center gap-2">
              <span className="text-lg text-degen-400">◆</span>
              <span className="text-sm font-bold tracking-wide text-white/40">Shorts</span>
            </div>
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-degen-500/30 border-t-degen-400" />
            <p className="text-xs text-[var(--color-muted)]">Loading shorts…</p>
          </div>
        )}

        {/* Error */}
        {!shortsFeed.loading && shortsFeed.error && shortsFeed.videos.length === 0 && (
          <div className="flex h-screen w-full snap-start flex-col items-center justify-center gap-4 bg-black px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 9v4M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-red-400"
                />
              </svg>
            </div>
            <p className="text-sm text-[var(--color-muted)]">Couldn&apos;t load shorts</p>
            <p className="max-w-xs text-center text-xs text-[var(--color-muted)]">{shortsFeed.error}</p>
            <button
              type="button"
              onClick={shortsFeed.refresh}
              className="rounded-lg bg-degen-500 px-5 py-2 text-xs font-semibold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_rgba(0,255,65,0.25)]"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!shortsFeed.loading && !shortsFeed.error && shortsFeed.videos.length === 0 && (
          <div className="flex h-screen w-full snap-start flex-col items-center justify-center gap-4 bg-black px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-degen-500/30 bg-degen-500/10">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-degen-400"
              >
                <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 9L16 12L10 15V9Z" fill="currentColor" />
              </svg>
            </div>
            <p className="text-sm text-[var(--color-muted)]">No shorts yet</p>
            <p className="max-w-xs text-center text-xs text-[var(--color-muted)]">
              No shorts available. Check back later — they appear here as they&apos;re discovered
              from YouTube, TikTok, Instagram, PeerTube, and other protocols.
            </p>
            <button
              type="button"
              onClick={shortsFeed.refresh}
              className="rounded-lg border border-white/10 bg-white/5 px-5 py-2 text-xs font-medium text-[var(--color-muted)] transition-colors hover:bg-white/10 hover:text-white"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Video cards */}
        {shortsFeed.videos.length > 0 &&
          shortsFeed.videos.map((video, idx) => {
            const post = shortToUnifiedPost(video, idx);
            return (
              <div
                key={video.id}
                className="relative h-screen w-full snap-start snap-always"
                aria-label={`Video by ${video.authorName}`}
              >
                <ShortVideoCard
                  post={post}
                  isActive={idx === 0}
                  onDoubleTap={() => {}}
                  onPlayStateChange={() => {}}
                />
              </div>
            );
          })}

        {/* Loading more */}
        {shortsFeed.loadingMore && (
          <div className="flex h-screen w-full snap-start items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-degen-500/30 border-t-degen-400" />
              <p className="text-xs text-[var(--color-muted)]">Loading more…</p>
            </div>
          </div>
        )}

        {/* End */}
        {!shortsFeed.hasMore && shortsFeed.videos.length > 0 && (
          <div className="flex h-screen w-full snap-start flex-col items-center justify-center gap-3 bg-black px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-degen-500/20 bg-degen-500/5">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-degen-400/60">
                <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 9L16 12L10 15V9Z" fill="currentColor" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--color-muted)]">You&apos;re all caught up</p>
            <p className="text-xs text-[var(--color-muted)]">More shorts coming soon</p>
            <button
              type="button"
              onClick={shortsFeed.refresh}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:bg-white/10 hover:text-white"
            >
              Refresh
            </button>
          </div>
        )}
      </section>

      {/* ── Persistent UI chrome ── */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 pt-4">
        <a
          href="/feed"
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] backdrop-blur-lg transition-all hover:border-degen-500/30 hover:text-degen-400"
          aria-label="Back to feed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hidden sm:inline">Feed</span>
        </a>

        <div className="pointer-events-auto flex items-center gap-2">
          <span className="text-[13px] font-bold tracking-wide text-white/70 drop-shadow-lg">
            <span className="text-degen-400">◆</span> Shorts
          </span>
          {Object.entries(shortsFeed.sourceCounts).map(([src, count]) => {
            if (count === 0) return null;
            return (
              <span
                key={src}
                className="hidden sm:inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                style={{
                  borderColor: `var(--source-${src}-color, rgba(255,255,255,0.1))`,
                  backgroundColor: `var(--source-${src}-bg, rgba(255,255,255,0.05))`,
                  color: `var(--source-${src}-text, rgba(255,255,255,0.6))`,
                }}
              >
                {src} {count}
              </span>
            );
          })}
        </div>

        {/* Create button */}
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="pointer-events-auto rounded-full border border-degen-500/30 bg-degen-500/10 px-3 py-1.5 text-xs font-medium text-degen-400 backdrop-blur-lg transition-all hover:bg-degen-500/20 hover:shadow-[0_0_12px_rgba(0,255,65,0.2)]"
          aria-label="Create short"
        >
          + Upload
        </button>
      </div>

      {/* ── Topic filter chips ── */}
      {shortsFeed.videos.length > 0 && (
        <ShortTopicsBar topics={topicFilter} onChange={setTopicFilter} />
      )}

      {/* ── Create short modal ── */}
      <CreateShortModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => {
          shortsFeed.refresh();
        }}
      />
    </ErrorBoundary>
  );
}

// ─── Topic Filter Chips ─────────────────────────────────────────────────

function ShortTopicsBar({
  topics,
  onChange,
}: {
  topics: string[];
  onChange: (t: string[]) => void;
}) {
  const topicOptions = ['defi', 'nft', 'trading', 'bitcoin', 'memecoin', 'ai'];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-14 z-50 flex items-center justify-center gap-1.5 px-4">
      <div className="pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto scrollbar-none">
        {topicOptions.map((topic) => {
          const active = topics.includes(topic);
          return (
            <button
              key={topic}
              type="button"
              onClick={() => {
                const next = active
                  ? topics.filter((t: string) => t !== topic)
                  : [...topics, topic];
                onChange(next);
                const u = new URL(window.location.href);
                if (next.length > 0) u.searchParams.set('topics', next.join(','));
                else u.searchParams.delete('topics');
                window.history.replaceState({}, '', u.toString());
              }}
              className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${
                active
                  ? 'border-degen-500/40 bg-degen-500/15 text-degen-400'
                  : 'border-white/10 bg-black/40 text-[var(--color-muted)] hover:border-white/20 hover:text-[var(--color-muted)]'
              }`}
            >
              {topic}
            </button>
          );
        })}
      </div>
    </div>
  );
}
