'use client';

import { addBookmark, getFollows, removeBookmark } from '@degenfeed/storage';
import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, FeedList, NotificationBell, PostCard } from '@degenfeed/ui';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { FeedComposer } from '../../components/FeedComposer';
import { FeedSidebar } from '../../components/FeedSidebar';
import { TipModal } from '../../components/TipModal';
import { useToast } from '../../components/Toast';
import { useNotifications } from '../../hooks/useNotifications';

type Tab = 'for-you' | 'following';

interface FeedMeta {
  total?: number;
  limit?: number;
  perProtocol?: Record<string, number>;
  errors?: string[];
  notices?: string[];
  trending?: { topic: string; count: number; score: number }[];
  topOfHour?: string | null;
  fetchedAt?: number;
}

interface ProtocolSummary {
  id: string;
  label: string;
  color: string;
  count: number;
}

const PROTOCOL_META: Record<string, { label: string; color: string; emoji: string }> = {
  nostr: { label: 'Nostr', color: '#8e30eb', emoji: '⚡' },
  farcaster: { label: 'Farcaster', color: '#8a63d2', emoji: '🟣' },
  lens: { label: 'Lens', color: '#abfe2c', emoji: '🌿' },
  bluesky: { label: 'Bluesky', color: '#1185fe', emoji: '🦋' },
  mastodon: { label: 'Mastodon', color: '#6364ff', emoji: '🐘' },
  threads: { label: 'Threads', color: '#888888', emoji: '🧵' },
  reddit: { label: 'Reddit', color: '#ff4500', emoji: '🔴' },
  rss: { label: 'News', color: '#ffa500', emoji: '📰' },
};

export default function FeedPage() {
  const { signedInProtocols, engage, openSignIn, publish, ready, signOut, nostrPublicId } =
    useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('for-you');
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [tipPost, setTipPost] = useState<UnifiedPost | null>(null);
  const [feedMeta, setFeedMeta] = useState<FeedMeta>({});
  const [hideLowQuality, setHideLowQuality] = useState(false);
  const [hideThreshold, setHideThreshold] = useState(1.0);
  const [allowNonCrypto, setAllowNonCrypto] = useState(false);
  const [recencyWeight, setRecencyWeight] = useState(1.0);
  const [engagementWeight, setEngagementWeight] = useState(1.0);
  const [protocolFilter, setProtocolFilter] = useState<string | null>(null);
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const { notifications, unreadCount, fetchNotifications, markRead } =
    useNotifications(hasSignedIn);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/preferences', { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          hideLowQuality?: boolean;
          hideLowQualityThreshold?: number;
          allowNonCrypto?: boolean;
          recencyWeight?: number;
          engagementWeight?: number;
        };
        if (typeof data.hideLowQuality === 'boolean') setHideLowQuality(data.hideLowQuality);
        if (typeof data.hideLowQualityThreshold === 'number') {
          setHideThreshold(data.hideLowQualityThreshold);
        }
        if (typeof data.allowNonCrypto === 'boolean') setAllowNonCrypto(data.allowNonCrypto);
        if (typeof data.recencyWeight === 'number') setRecencyWeight(data.recencyWeight);
        if (typeof data.engagementWeight === 'number') setEngagementWeight(data.engagementWeight);
      } catch {
        /* ignore — user has no session yet */
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistPrefs = useCallback((patch: Record<string, unknown>) => {
    void fetch('/api/preferences', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }, []);

  const setHideThresholdAndPersist = useCallback(
    (next: number) => {
      setHideThreshold(next);
      persistPrefs({ hideLowQualityThreshold: next });
    },
    [persistPrefs],
  );

  const setAllowNonCryptoAndPersist = useCallback(
    (next: boolean) => {
      setAllowNonCrypto(next);
      persistPrefs({ allowNonCrypto: next });
    },
    [persistPrefs],
  );

  const toggleHideLowQuality = useCallback(() => {
    setHideLowQuality((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('degenfeed_hide_low_quality', String(next));
      } catch {
        /* ignore */
      }
      persistPrefs({ hideLowQuality: next });
      return next;
    });
  }, [persistPrefs]);

  const [newAvailable, setNewAvailable] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPostIdRef = useRef<string | null>(null);
  const [loadedLimit, setLoadedLimit] = useState(50);
  const hasMore = loadedLimit < 200;

  const loadMore = useCallback(() => {
    setLoadedLimit((prev) => Math.min(prev + 25, 200));
  }, []);

  const fetchFeed = useCallback(
    async (checkOnly = false) => {
      if (!checkOnly) setState('loading');
      try {
        const url = new URL('/api/feed/home', window.location.origin);
        url.searchParams.set('limit', String(loadedLimit));
        const protocolsToFetch = protocolFilter
          ? [protocolFilter]
          : ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'threads', 'reddit', 'rss'];
        url.searchParams.set('protocols', protocolsToFetch.join(','));
        if (activeTab === 'following') {
          url.searchParams.set('filter', 'following');
        }
        if (hideLowQuality) {
          url.searchParams.set('hideLowQuality', 'true');
          url.searchParams.set('hideLowQualityThreshold', String(hideThreshold));
        }
        if (allowNonCrypto) {
          url.searchParams.set('allowNonCrypto', 'true');
        }
        if (recencyWeight !== 1) url.searchParams.set('recencyWeight', String(recencyWeight));
        if (engagementWeight !== 1)
          url.searchParams.set('engagementWeight', String(engagementWeight));
        const res = await fetch(url.toString(), {
          credentials: 'include',
          cache: 'no-store',
          headers: { 'cache-control': 'no-store' },
        });
        if (!res.ok) throw new Error(`Feed returned ${res.status}`);
        const data = (await res.json()) as { data?: UnifiedPost[]; meta?: FeedMeta };
        let feed = data.data ?? [];

        if (activeTab === 'following') {
          try {
            const follows = await getFollows('self');
            const ids = new Set(follows.map((f) => f.targetId));
            feed = feed.filter((p) => ids.has(p.author.id));
          } catch {
            /* ignore IndexedDB errors in private mode */
          }
        }

        if (checkOnly && feed.length > 0 && feed[0]?.id !== lastPostIdRef.current) {
          setNewAvailable(true);
          return;
        }

        if (feed.length > 0) {
          lastPostIdRef.current = feed[0]?.id ?? '';
        }
        setPosts(feed);
        setFeedMeta(data.meta || {});
        setState(feed.length ? 'loaded' : 'empty');
      } catch (err) {
        if (!checkOnly) {
          setError(err instanceof Error ? err.message : 'Failed');
          setState('error');
        }
      }
    },
    [
      activeTab,
      loadedLimit,
      hideLowQuality,
      hideThreshold,
      allowNonCrypto,
      recencyWeight,
      engagementWeight,
      protocolFilter,
    ],
  );

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchFeed(true), 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchFeed]);

  const refreshNow = useCallback(() => {
    setNewAvailable(false);
    fetchFeed(false);
  }, [fetchFeed]);

  const handleEngage = async (
    action: EngagementAction,
    postId: string,
    content?: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: 'Post not found' };

    if ((action === 'bookmark' || action === 'unbookmark') && post.protocol !== 'mastodon') {
      try {
        if (action === 'bookmark') await addBookmark(postId);
        else await removeBookmark(postId);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Bookmark failed' };
      }
    }

    return engage(action, postId, post.protocol, { content });
  };

  const handleTip = useCallback(
    (post: UnifiedPost) => {
      if (!hasSignedIn) {
        openSignIn();
        return;
      }
      setTipPost(post);
    },
    [hasSignedIn, openSignIn],
  );

  const { showToast } = useToast();
  const router = useRouter();
  const handlePostClick = useCallback(
    (id: string) => {
      router.push(`/post/${encodeURIComponent(id)}`);
    },
    [router],
  );

  const handleReport = useCallback(
    (_postId: string) => {
      showToast('success', 'Report submitted. Thank you for helping keep DegenFeed safe.');
    },
    [showToast],
  );

  const protocolSummaries: ProtocolSummary[] = useMemo(() => {
    const perProtocol = feedMeta.perProtocol ?? {};
    return Object.entries(PROTOCOL_META)
      .map(([id, meta]) => ({
        id,
        label: meta.label,
        color: meta.color,
        count: perProtocol[id] ?? 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [feedMeta.perProtocol]);

  const handleProtocolFilter = useCallback((id: string) => {
    setProtocolFilter((current) => (current === id ? null : id));
  }, []);

  return (
    <ErrorBoundary>
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-4 px-3 py-3 sm:px-4 lg:grid-cols-12">
        {/* Left rail — desktop only quick nav */}
        <aside className="hidden xl:col-span-3 xl:block">
          <div className="sticky top-20 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-gray-950/60 p-4 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2">
                <Image
                  src="/icon.svg"
                  alt="DegenFeed"
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-xl shadow-[0_0_18px_rgba(0,255,65,0.25)]"
                />
                <div>
                  <p className="text-sm font-semibold text-white">DegenFeed</p>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">
                    Open social graph
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                One window. Every protocol. Zero accounts to browse.
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {Object.entries(PROTOCOL_META).map(([id, m]) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: `${m.color}22`, color: m.color }}
                    title={`${m.label} live`}
                  >
                    {m.emoji} {m.label}
                  </span>
                ))}
              </div>
            </div>

            {!hasSignedIn && (
              <div className="rounded-2xl border border-degen-500/30 bg-degen-500/5 p-4 backdrop-blur-xl">
                <p className="mb-1 text-sm font-semibold text-white">Sign in to post & engage</p>
                <p className="mb-3 text-xs text-gray-400">
                  Browse without an account. Sign in with one click to like, reply, and cross-post.
                </p>
                <button type="button" onClick={openSignIn} className="btn-primary w-full text-sm">
                  Connect Wallet
                </button>
                <p className="mt-2 text-center text-[10px] text-gray-600">
                  ETH · SOL · or your existing social handle
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Main timeline */}
        <main className="lg:col-span-8 xl:col-span-6">
          <div className="sticky top-16 z-30 border-b border-white/10 bg-black/85 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-3">
                <Image
                  src="/icon.svg"
                  alt="DegenFeed"
                  width={32}
                  height={32}
                  className="h-9 w-9 rounded-xl logo-glow shadow-[0_0_14px_rgba(0,255,65,0.3)]"
                />
                <div>
                  <h1 className="text-lg font-bold text-white leading-none">DegenFeed</h1>
                  <p className="text-[10px] text-gray-500">
                    {activeTab === 'for-you' ? 'Your unified timeline' : 'Posts you follow'}
                  </p>
                </div>
              </div>
              {hasSignedIn && (
                <div className="flex items-center gap-2">
                  <NotificationBell
                    notifications={notifications}
                    unreadCount={unreadCount}
                    onFetch={fetchNotifications}
                    onMarkRead={markRead}
                  />
                  <button
                    type="button"
                    onClick={signOut}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex">
              <button
                type="button"
                onClick={() => setActiveTab('for-you')}
                className={`relative flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'for-you' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                For You
                {activeTab === 'for-you' && (
                  <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-degen-500" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('following')}
                className={`relative flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'following' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Following
                {activeTab === 'following' && (
                  <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-degen-500" />
                )}
              </button>
            </div>

            {/* Protocol pills + filter */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-white/5 px-4 py-2">
              <button
                type="button"
                onClick={() => setProtocolFilter(null)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  protocolFilter === null
                    ? 'bg-degen-500/15 text-degen-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                All
              </button>
              {protocolSummaries.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProtocolFilter(p.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    protocolFilter === p.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                  style={
                    protocolFilter === p.id
                      ? { backgroundColor: `${p.color}22`, color: p.color }
                      : undefined
                  }
                >
                  <span>{p.label}</span>
                  <span
                    className={`text-[10px] ${protocolFilter === p.id ? 'opacity-90' : 'text-gray-600'}`}
                  >
                    {p.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Quality controls */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 px-4 py-2 text-[11px] text-gray-400">
              <button
                type="button"
                onClick={toggleHideLowQuality}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors ${
                  hideLowQuality
                    ? 'bg-degen-500/15 text-degen-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                title="Hide posts with low ranking scores"
                aria-pressed={hideLowQuality}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {hideLowQuality ? 'Hiding low-quality' : 'Show all'}
              </button>
              {hideLowQuality && (
                <label className="flex items-center gap-1.5">
                  <span>Threshold</span>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={hideThreshold}
                    onChange={(e) => setHideThresholdAndPersist(Number(e.target.value))}
                    className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                    aria-label="Hide threshold"
                  />
                  <span className="font-mono text-[10px] text-gray-500">
                    {hideThreshold.toFixed(1)}
                  </span>
                </label>
              )}
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={allowNonCrypto}
                  onChange={(e) => setAllowNonCryptoAndPersist(e.target.checked)}
                  className="h-3 w-3 rounded border-white/20 bg-gray-900 text-degen-500 focus:ring-degen-500"
                />
                <span>Non-crypto</span>
              </label>
              <label className="flex items-center gap-1.5">
                <span>Recency</span>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={recencyWeight}
                  onChange={(e) => {
                    setRecencyWeight(Number(e.target.value));
                    persistPrefs({ recencyWeight: Number(e.target.value) });
                  }}
                  className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                  aria-label="Recency weight"
                />
                <span className="font-mono text-[10px] text-gray-500">
                  {recencyWeight.toFixed(1)}
                </span>
              </label>
              <label className="flex items-center gap-1.5">
                <span>Engage</span>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={engagementWeight}
                  onChange={(e) => {
                    setEngagementWeight(Number(e.target.value));
                    persistPrefs({ engagementWeight: Number(e.target.value) });
                  }}
                  className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                  aria-label="Engagement weight"
                />
                <span className="font-mono text-[10px] text-gray-500">
                  {engagementWeight.toFixed(1)}
                </span>
              </label>
              <span className="ml-auto hidden text-[10px] text-gray-600 sm:inline">
                Hover ★ on any post for ranking breakdown
              </span>
            </div>
          </div>

          {/* Composer / sign-in CTA */}
          {hasSignedIn ? (
            <FeedComposer
              onPost={publish}
              signedInProtocols={signedInProtocols}
              nostrPublicId={nostrPublicId}
              onRequestSignIn={openSignIn}
            />
          ) : (
            <div className="border-b border-white/10 px-4 py-4">
              <div className="flex items-start gap-3">
                <Image
                  src="/icon.svg"
                  alt="DegenFeed"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full"
                />
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => openSignIn()}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-base text-gray-400 transition-colors hover:border-degen-500/30 hover:bg-white/5"
                  >
                    What is happening across web3?
                  </button>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Sign in to like, reply, and cross-post everywhere.
                    </p>
                    <button type="button" onClick={openSignIn} className="btn-primary text-sm">
                      Connect Wallet
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New posts pill */}
          {newAvailable && (
            <button
              type="button"
              onClick={refreshNow}
              className="sticky top-[152px] z-20 mx-4 my-2 flex w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-full border border-degen-500/40 bg-degen-500/90 py-2 text-sm font-semibold text-black shadow-[0_0_24px_rgba(0,255,65,0.35)] backdrop-blur-xl transition-transform hover:bg-degen-400"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-black" />
              New posts available — click to refresh
            </button>
          )}

          {/* Notices */}
          {feedMeta.notices && feedMeta.notices.length > 0 && (
            <div className="mx-4 mt-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-2.5 text-xs text-yellow-400">
              {feedMeta.notices.map((n) => (
                <div key={n}>{n}</div>
              ))}
            </div>
          )}

          {/* Top of Hour — highest engagement post in the last 60 min */}
          {feedMeta.topOfHour &&
            state === 'loaded' &&
            (() => {
              const pinnedPost = posts.find((p) => p.id === feedMeta.topOfHour);
              if (!pinnedPost) return null;
              return (
                <div className="mx-4 mb-2 rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-transparent p-3">
                  <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-yellow-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
                    Top of the Hour
                  </div>
                  <PostCard
                    post={pinnedPost}
                    onClick={handlePostClick}
                    onEngage={handleEngage}
                    onTip={handleTip}
                  />
                </div>
              );
            })()}

          {/* Feed */}
          <FeedList
            state={state}
            posts={posts}
            error={error}
            onPostClick={handlePostClick}
            onEngage={handleEngage}
            onTip={handleTip}
            onRetry={fetchFeed}
            onSignIn={openSignIn}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onReport={handleReport}
          />

          {activeTab === 'following' && state === 'empty' && (
            <div className="border-b border-white/5 px-4 py-10 text-center">
              <p className="text-gray-400">You are not following anyone yet.</p>
              <p className="mt-1 text-xs text-gray-600">
                Tap the Follow button on any post to build your timeline.
              </p>
            </div>
          )}

          {/* Bottom CTA — repeat sign-in pitch */}
          {!hasSignedIn && state === 'loaded' && (
            <div className="m-4 rounded-2xl border border-degen-500/30 bg-gradient-to-br from-degen-500/10 to-transparent p-5 text-center">
              <p className="mb-1 text-sm font-semibold text-white">Liking what you see?</p>
              <p className="mb-4 text-xs text-gray-400">
                Sign in once to post, like, and reply across all 8 networks.
              </p>
              <button type="button" onClick={openSignIn} className="btn-primary text-sm">
                Connect Wallet to Post
              </button>
            </div>
          )}
        </main>

        {/* Right sidebar */}
        <aside className="hidden lg:col-span-4 lg:block xl:col-span-3">
          <div className="sticky top-20">
            <FeedSidebar
              trending={feedMeta.trending ?? []}
              protocolSummaries={protocolSummaries}
              activeProtocolFilter={protocolFilter}
              onProtocolClick={handleProtocolFilter}
            />
          </div>
        </aside>

        {tipPost && (
          <TipModal
            open={!!tipPost}
            onClose={() => setTipPost(null)}
            recipientProtocol={tipPost.protocol}
            recipientAuthorId={tipPost.author.id}
            recipientDisplayName={tipPost.author.displayName}
            publicationId={
              tipPost.protocol === 'lens' ? (tipPost.raw as { id?: string })?.id : undefined
            }
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
