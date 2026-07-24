'use client';

import type { CustomFeed, FeedRecipe, UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, FeedList } from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';

const FeedBuilderModalDynamic = dynamic(
  () => import('@degenfeed/ui').then((m) => ({ default: m.FeedBuilderModal })),
  { ssr: false, loading: () => null },
);

// === Constants ================================================

const SOURCE_EMOJIS: Record<string, string> = {
  nostr: '⚡',
  farcaster: '🟣',
  lens: '🌿',
  bluesky: '🦋',
  mastodon: '🐘',
  threads: '🧵',
  reddit: '🔴',
  rss: '📰',
  lemmy: '🌲',
  peertube: '📺',
  youtube: '▶️',
};

const SOURCE_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  threads: 'Threads (Experimental)',
  reddit: 'Reddit',
  rss: 'RSS',
  lemmy: 'Lemmy',
  peertube: 'PeerTube',
  youtube: 'YouTube',
};

type SortMode = 'trending' | 'recent' | 'top';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'trending', label: 'Trending' },
  { value: 'recent', label: 'Recent' },
  { value: 'top', label: 'Top' },
];

function toast(kind: 'success' | 'error' | 'info', message: string) {
  window.dispatchEvent(new CustomEvent('df-toast', { detail: { kind, message } }));
}

// === Page =====================================================

export default function FeedDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { walletAddress, ready, openSignIn } = useAuth();

  // Feed metadata
  const [feed, setFeed] = useState<CustomFeed | null>(null);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Feed posts
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [feedState, setFeedState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [feedError, setFeedError] = useState<string>();
  const [sort, setSort] = useState<SortMode>('trending');
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  // Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const deleteConfirmRef = useRef(false);

  const hasSignedIn = ready && !!walletAddress;
  const isCreator = hasSignedIn && feed?.creator.toLowerCase() === walletAddress?.toLowerCase();

  // Fetch feed details (with preview)
  const fetchFeed = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/custom-feeds/${id}?preview=true`, { credentials: 'include' });
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to load feed');
      const data = (await res.json()) as {
        feed: CustomFeed;
        subscriberCount?: number;
        preview?: UnifiedPost[];
      };
      setFeed(data.feed);
      setSubscriberCount(data.subscriberCount ?? 0);
      // Use preview posts as initial display while execute loads
      if (data.preview && data.preview.length > 0) {
        setPosts(data.preview);
        setFeedState('loaded');
        setHasMore(data.preview.length >= 5);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Execute feed with recipe filters via the dedicated endpoint
  const executeFeed = useCallback(
    async (mode: SortMode, pageCursor?: string, replace = false) => {
      if (!id) return;
      setFeedState('loading');
      try {
        const params = new URLSearchParams();
        params.set('sort', mode);
        params.set('limit', '50');
        if (pageCursor) params.set('cursor', pageCursor);

        const res = await fetch(`/api/custom-feeds/${id}/execute?${params.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error || `Feed returned ${res.status}`);
        }
        const data = (await res.json()) as {
          data?: UnifiedPost[];
          meta?: { total?: number; nextCursor?: string };
        };

        const newPosts = data.data ?? [];
        if (replace) {
          setPosts(newPosts);
        } else {
          setPosts((prev) => [...prev, ...newPosts]);
        }
        setCursor(data.meta?.nextCursor);
        setHasMore(!!data.meta?.nextCursor && newPosts.length > 0);
        setFeedState(newPosts.length ? 'loaded' : 'empty');
      } catch (err) {
        setFeedError(err instanceof Error ? err.message : 'Failed to load feed');
        setFeedState('error');
      }
    },
    [id],
  );

  // Load feed metadata on mount
  useEffect(() => {
    if (id) void fetchFeed();
  }, [id, fetchFeed]);

  // Execute feed when sort changes (replace posts)
  useEffect(() => {
    if (feed) void executeFeed(sort, undefined, true);
  }, [feed, sort, executeFeed]);

  const handleSortChange = useCallback((newSort: SortMode) => {
    setSort(newSort);
    setCursor(undefined);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (cursor) void executeFeed(sort, cursor, false);
  }, [cursor, sort, executeFeed]);

  const handleRetry = useCallback(() => {
    void executeFeed(sort, undefined, true);
  }, [sort, executeFeed]);

  // Edit handlers
  const handleEdit = useCallback(() => {
    setModalOpen(true);
  }, []);

  const handleSave = useCallback(
    async (updates: {
      name: string;
      description: string;
      isPublic: boolean;
      config: FeedRecipe;
    }) => {
      if (!feed) return { ok: false, error: 'No feed' };
      const res = await fetch(`/api/custom-feeds/${feed.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = (await res.json()) as { ok?: boolean; feed?: CustomFeed; error?: string };
      if (data.ok && data.feed) {
        setFeed(data.feed);
        toast('success', 'Feed updated');
        void executeFeed(sort, undefined, true);
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Failed to update' };
    },
    [feed, executeFeed, sort],
  );

  const handleDelete = useCallback(async () => {
    if (!feed) return;
    if (!deleteConfirmRef.current) {
      deleteConfirmRef.current = true;
      toast('info', 'Click delete again to confirm');
      setTimeout(() => {
        deleteConfirmRef.current = false;
      }, 3000);
      return;
    }
    try {
      const res = await fetch(`/api/custom-feeds/${feed.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed');
      toast('success', 'Feed deleted');
      router.push('/feeds');
    } catch {
      toast('error', 'Failed to delete feed');
    }
  }, [feed, router]);

  const handleSubscribe = useCallback(async () => {
    if (!hasSignedIn) {
      openSignIn();
      return;
    }
    if (!feed) return;
    try {
      const res = await fetch(`/api/custom-feeds/${feed.id}/subscribe`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        if (res.status === 409) {
          toast('info', 'Already subscribed');
          return;
        }
        toast('error', data.error || 'Failed');
        return;
      }
      const data = (await res.json()) as { subscribers?: number };
      toast('success', 'Subscribed!');
      if (data.subscribers !== undefined) setSubscriberCount(data.subscribers);
    } catch {
      toast('error', 'Failed to subscribe');
    }
  }, [hasSignedIn, feed, openSignIn]);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast('success', 'Link copied to clipboard');
    } catch {
      toast('error', 'Failed to copy link');
    }
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  // === Render states =========================================

  if (loading) {
    return (
      <div className="mx-auto max-w-[720px] px-3 py-6 sm:px-4">
        <div className="skeleton h-12 w-3/4 rounded-2xl mb-4" />
        <div className="skeleton h-48 rounded-2xl mb-4" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (notFound || !feed) {
    return (
      <div className="mx-auto max-w-[720px] px-3 py-6 sm:px-4">
        <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-8 text-center backdrop-blur-xl">
          <p className="text-3xl mb-3">🔍</p>
          <h1 className="text-lg font-bold text-[var(--color-fg)] mb-1">Feed not found</h1>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            This custom feed doesn&apos;t exist or has been deleted.
          </p>
          <Link href="/feeds" className="btn-primary text-sm inline-block">
            Back to Feeds
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-[720px] px-3 py-6 sm:px-4">
        {/* Back link */}
        <Link
          href="/feeds"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-muted)] transition-colors mb-4"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 12L6 8l4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Feeds
        </Link>

        {/* Feed header */}
        <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-5 backdrop-blur-xl mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-[var(--color-fg)]">{feed.name}</h1>
              {feed.description && (
                <p className="mt-1 text-sm text-[var(--color-muted)]">{feed.description}</p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-muted)]">
                <span>
                  by {feed.creator.slice(0, 6)}...{feed.creator.slice(-4)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${feed.isPublic ? 'bg-degen-500/10 text-degen-400' : 'bg-white/10 text-[var(--color-muted)]'}`}
                >
                  {feed.isPublic ? '🌍 Public' : '🔒 Private'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M1 8s2-4 7-4 7 4 7 4-2 4-7 4-7-4-7-4z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                  {subscriberCount} subscriber{subscriberCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {isCreator ? (
                <>
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Delete
                  </button>
                </>
              ) : (
                feed.isPublic && (
                  <button
                    type="button"
                    onClick={handleSubscribe}
                    className="rounded-full bg-degen-500 px-4 py-2 text-xs font-medium text-black hover:bg-degen-400 transition-colors"
                  >
                    Subscribe
                  </button>
                )
              )}
              <button
                type="button"
                onClick={handleShare}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
              >
                Share
              </button>
            </div>
          </div>

          {/* Recipe details */}
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
            {/* Sources */}
            <div>
              <p className="text-xs font-medium text-[var(--color-muted)] mb-1.5">Sources</p>
              <div className="flex flex-wrap gap-1.5">
                {feed.config.sources.map((src) => (
                  <span
                    key={src}
                    className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs text-[var(--color-muted)]"
                  >
                    {SOURCE_EMOJIS[src] || '🌐'} {SOURCE_LABELS[src] || src}
                  </span>
                ))}
              </div>
            </div>

            {/* Boosted topics */}
            {Object.entries(feed.config.topics).filter(([, w]) => w > 0).length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--color-muted)] mb-1.5">
                  Boosted Topics
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(feed.config.topics)
                    .filter(([, w]) => w > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([t, w]) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full bg-degen-500/10 px-2.5 py-1 text-xs text-degen-400"
                      >
                        {t} <span className="text-[var(--color-muted)]">({w})</span>
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Filters summary */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
              <span>Content: {feed.config.contentTypes.join(', ') || 'all'}</span>
              {feed.config.minEngagement > 0 && (
                <span>Min engagement: {feed.config.minEngagement}</span>
              )}
              {feed.config.language && <span>Language: {feed.config.language}</span>}
              {feed.config.excludeWords.length > 0 && (
                <span>
                  Excluded: {feed.config.excludeWords.slice(0, 2).join(', ')}
                  {feed.config.excludeWords.length > 2 ? '...' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-fg)] mr-2">Feed</h2>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSortChange(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                sort === opt.value
                  ? 'bg-degen-500/15 text-degen-400'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Feed posts */}
        <div>
          <FeedList
            state={feedState}
            posts={posts}
            error={feedError}
            onRetry={handleRetry}
            onPostClick={(postId: string) => router.push(`/post/${encodeURIComponent(postId)}`)}
            onEngage={async () => ({ ok: true })}
            onSignIn={openSignIn}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
          />

          {/* Empty state */}
          {feedState === 'empty' && (
            <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm text-[var(--color-muted)]">
                No posts match this feed&apos;s criteria. Try broadening your filters.
              </p>
            </div>
          )}
        </div>

        {modalOpen && (
          <FeedBuilderModalDynamic
            open={modalOpen}
            onClose={closeModal}
            onSave={handleSave}
            initial={{
              name: feed.name,
              description: feed.description,
              isPublic: feed.isPublic,
              config: feed.config,
            }}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
