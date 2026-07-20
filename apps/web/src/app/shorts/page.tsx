'use client';

/**
 * @pages/shorts — Full-screen TikTok-style vertical video feed.
 *
 * Fetches from the unified multi-protocol shorts API aggregating content
 * from ALL protocols: ActivityPub (Loops), AT Protocol (Flashes), Nostr,
 * Farcaster, Lens, Zora (NFT), PeerTube, and DegenFeed.
 *
 * Features:
 *   - SourceBar showing protocol breakdown at top
 *   - Vertical swipe, snap-scroll, auto-play
 *   - Source badge on every short
 *   - Zora NFT mint badge (with mint price / edition progress)
 *   - Cross-platform tip buttons (ETH Base, SOL Solana, Lightning)
 *   - Infinite scroll with cursor-based pagination
 *
 * Design: Immersive dark cyberpunk with neon-green degen accents.
 */

import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useState } from 'react';
import { ShortVideoCard } from '../../components/ShortVideoCard';
import { CreateShortModal } from '../../components/shorts/CreateShortModal';
import { sourceBadgeData } from '../../components/shorts/ShortsSourceBadge';
import { ShortsSourceBar } from '../../components/shorts/ShortsSourceBar';
import type { ShortSource, UnifiedShortItem } from '../../hooks/useUnifiedShorts';
import { useUnifiedShorts } from '../../hooks/useUnifiedShorts';

// === Adapter: UnifiedShortItem → ShortVideoCard post shape ==============

/**
 * Map unified source names (used by the API) to the Protocol union
 * accepted by UnifiedPost (from @degenfeed/types).
 */
function mapSourceToProtocol(source: string): string {
  const map: Record<string, string> = {
    activitypub: 'peertube',
    atprotocol: 'atproto',
    loops: 'peertube',
    flashes: 'atproto',
    degenfeed: 'rss',
    direct: 'rss',
  };
  return map[source] ?? source;
}

function unifiedShortToPost(short: UnifiedShortItem, idx: number) {
  const _badge = sourceBadgeData(short.source);
  const protocol = mapSourceToProtocol(short.source) as import('@degenfeed/types').Protocol;
  return {
    id: `short:${short.source}:${short.id}`,
    protocol,
    author: {
      id: `${short.source}:${short.authorHandle}`,
      primary: { protocol, id: short.authorHandle },
      handles: {} as Record<string, string | null>,
      displayName: short.authorName,
      bio: '',
      avatarUrl: short.authorAvatar ?? '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: short.caption || short.title,
    html: undefined,
    embeds: [
      {
        kind: 'video' as const,
        url: short.videoUrl,
        meta: { thumbnail: short.thumbnailUrl, duration: short.duration },
      },
      { kind: 'link' as const, url: short.sourceUrl },
    ],
    createdAt: short.publishedAt,
    metrics: { likes: short.likes, reposts: 0, replies: 0, quotes: 0, views: short.views },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: short.likes, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: short,
    niches: short.topics,
    dfUri: `df://shorts/${short.source}/${idx}`,
    contentType: 'video' as const,
    tipCount: 0,
  };
}

// === Page Component =====================================================

export default function ShortsPage() {
  const [topicFilter, setTopicFilter] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const params = new URLSearchParams(window.location.search);
    const topics = params.get('topics');
    return topics ? topics.split(',').filter(Boolean) : [];
  });

  const [sourceFilter, setSourceFilter] = useState<ShortSource | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const unifiedFeed = useUnifiedShorts({
    source: sourceFilter ?? undefined,
    category: topicFilter.length > 0 ? topicFilter[0] : undefined,
  });

  const handleSourceClick = useCallback((source: ShortSource | null) => {
    setSourceFilter(source);
  }, []);

  const handleRefresh = useCallback(() => {
    unifiedFeed.refresh();
  }, [unifiedFeed]);

  return (
    <ErrorBoundary>
      {/* == Video feed container == */}
      <section
        className="fixed inset-0 z-40 overflow-y-scroll snap-y snap-mandatory overscroll-none"
        style={{ backgroundColor: '#000', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        aria-label="Shorts unified video feed"
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>

        {/* Loading */}
        {unifiedFeed.isLoading && unifiedFeed.shorts.length === 0 && (
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
        {!unifiedFeed.isLoading && unifiedFeed.error && unifiedFeed.shorts.length === 0 && (
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
            <p className="max-w-xs text-center text-xs text-[var(--color-muted)]">
              {unifiedFeed.error.message}
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-lg bg-degen-500 px-5 py-2 text-xs font-semibold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_rgba(0,255,65,0.25)]"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {unifiedFeed.isEmpty && (
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
                <rect
                  x="4"
                  y="4"
                  width="16"
                  height="16"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path d="M10 9L16 12L10 15V9Z" fill="currentColor" />
              </svg>
            </div>
            <p className="text-sm text-[var(--color-muted)]">No shorts yet</p>
            <p className="max-w-xs text-center text-xs text-[var(--color-muted)]">
              {sourceFilter
                ? `No shorts from ${sourceFilter}. Try a different source.`
                : 'No shorts available. Check back later — they appear here as they&apos;re discovered from ActivityPub, AT Protocol, Nostr, Farcaster, Lens, Zora, PeerTube, and more.'}
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-lg border border-white/10 bg-white/5 px-5 py-2 text-xs font-medium text-[var(--color-muted)] transition-colors hover:bg-white/10 hover:text-white"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Video cards */}
        {unifiedFeed.shorts.length > 0 &&
          unifiedFeed.shorts.map((short, idx) => {
            const post = unifiedShortToPost(short, idx);
            return (
              <section
                key={short.id}
                className="relative h-screen w-full snap-start snap-always"
                aria-label={`Video by ${short.authorName}`}
              >
                <ShortVideoCard
                  post={post}
                  isActive={idx === 0}
                  onDoubleTap={() => {}}
                  onPlayStateChange={() => {}}
                />
              </section>
            );
          })}

        {/* Loading more */}
        {unifiedFeed.isLoadingMore && unifiedFeed.shorts.length > 0 && (
          <div className="flex h-screen w-full snap-start items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-degen-500/30 border-t-degen-400" />
              <p className="text-xs text-[var(--color-muted)]">Loading more…</p>
            </div>
          </div>
        )}

        {/* End */}
        {!unifiedFeed.hasMore && unifiedFeed.shorts.length > 0 && (
          <div className="flex h-screen w-full snap-start flex-col items-center justify-center gap-3 bg-black px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-degen-500/20 bg-degen-500/5">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-degen-400/60"
              >
                <rect
                  x="4"
                  y="4"
                  width="16"
                  height="16"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path d="M10 9L16 12L10 15V9Z" fill="currentColor" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--color-muted)]">
              You&apos;re all caught up
            </p>
            <p className="text-xs text-[var(--color-muted)]">More shorts coming soon</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:bg-white/10 hover:text-white"
            >
              Refresh
            </button>
          </div>
        )}
      </section>

      {/* == Persistent UI chrome == */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col gap-1.5 px-4 pt-3">
        {/* Top bar */}
        <div className="pointer-events-auto flex items-center justify-between">
          <a
            href="/feed"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] backdrop-blur-lg transition-all hover:border-degen-500/30 hover:text-degen-400"
            aria-label="Back to feed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">Feed</span>
          </a>

          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold tracking-wide text-white/70 drop-shadow-lg">
              <span className="text-degen-400">◆</span> Shorts
            </span>
            {/* Source badge count in header */}
            {unifiedFeed.sources && !sourceFilter && (
              <span className="hidden rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white/50 backdrop-blur-sm sm:inline-flex items-center gap-1 sm:inline-flex">
                {Object.values(unifiedFeed.sources).reduce((a, b) => a + b, 0)} videos
              </span>
            )}
            {sourceFilter && (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm"
                style={{
                  backgroundColor: `${sourceBadgeData(sourceFilter).color}18`,
                  borderColor: `${sourceBadgeData(sourceFilter).color}40`,
                  color: sourceBadgeData(sourceFilter).color,
                }}
              >
                {sourceBadgeData(sourceFilter).label}
              </span>
            )}
          </div>

          {/* Go Live button */}
          <a
            href="/live-shorts"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 to-red-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg transition-all hover:from-red-500 hover:to-red-400 hover:shadow-[0_0_12px_rgba(255,0,0,0.3)]"
            aria-label="Go live"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            Go Live
          </a>

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

        {/* == Source bar — protocol breakdown == */}
        {unifiedFeed.sources && unifiedFeed.shorts.length > 0 && (
          <div className="pointer-events-auto overflow-x-auto">
            <ShortsSourceBar
              sources={unifiedFeed.sources}
              activeSource={sourceFilter}
              onSourceClick={handleSourceClick}
            />
          </div>
        )}
      </div>

      {/* == Topic filter chips == */}
      {unifiedFeed.shorts.length > 0 && (
        <ShortTopicsBar topics={topicFilter} onChange={setTopicFilter} />
      )}

      {/* == Create short modal == */}
      <CreateShortModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => {
          handleRefresh();
        }}
      />
    </ErrorBoundary>
  );
}

// === Topic Filter Chips =================================================

function ShortTopicsBar({
  topics,
  onChange,
}: {
  topics: string[];
  onChange: (t: string[]) => void;
}) {
  const topicOptions = ['defi', 'nft', 'trading', 'bitcoin', 'memecoin', 'ai'];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[5.5rem] z-50 flex items-center justify-center gap-1.5 px-4">
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
