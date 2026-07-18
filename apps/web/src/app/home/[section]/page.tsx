'use client';

import { addBookmark, removeBookmark } from '@degenfeed/storage';
import type { EngagementAction } from '@degenfeed/types';
import { ErrorBoundary, FeedList, NotificationBell, type UnifiedPost } from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { FeedPollerBanner } from '../../../components/FeedPollerBanner';

const TipModal = dynamic(
  () => import('../../../components/TipModal').then((m) => ({ default: m.TipModal })),
  { ssr: false, loading: () => null },
);

import { useFeedPoller } from '../../../hooks/useFeedPoller';
import { useNotifications } from '../../../hooks/useNotifications';
import { SECTIONS } from '../sections';

interface Props {
  params: Promise<{ section: string }>;
}

function getProtocolColor(p: string): string {
  const colors: Record<string, string> = {
    nostr: '#8e30eb',
    farcaster: '#8a63d2',
    lens: '#abfe2c',
    bluesky: '#1185fe',
    threads: '#888',
    mastodon: '#6364ff',
    rss: '#ffa500',
  };
  return colors[p] ?? '#666';
}

function SectionNav({ current }: { current: string }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto pb-2">
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`/home/${s.id}`}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            s.id === current ? 'text-[var(--color-fg)]' : 'text-gray-500 hover:text-gray-300'
          }`}
          style={s.id === current ? { backgroundColor: `${s.color}22`, color: s.color } : {}}
        >
          {s.icon} {s.label}
        </a>
      ))}
    </div>
  );
}

interface SectionEmptyStateProps {
  section: string;
  state: 'loading' | 'loaded' | 'empty' | 'error';
  hasSignedIn: boolean;
  onSignIn: () => void;
  onRetry: () => void;
}

function SectionEmptyState({
  section,
  state,
  hasSignedIn,
  onSignIn,
  onRetry,
}: SectionEmptyStateProps) {
  if (state === 'loading') return null;
  if (state === 'error') {
    return (
      <div className="card mt-6 border-red-500/20 bg-red-500/5 py-8 text-center">
        <h3 className="mb-2 text-base font-bold text-red-400">Feed unavailable</h3>
        <p className="mb-4 text-sm text-gray-400">
          The {section} source failed to load. This is usually a network or rate-limit issue.
        </p>
        <button type="button" onClick={onRetry} className="btn-primary text-sm">
          Retry
        </button>
      </div>
    );
  }
  if (state !== 'empty') return null;

  const messages: Record<
    string,
    { title: string; body: string; cta?: { label: string; href: string } }
  > = {
    mastodon: {
      title: 'The fediverse is quiet',
      body: hasSignedIn
        ? 'No posts from the Mastodon/GotoSocial timeline right now. Try posting first.'
        : 'Create a free @degenfeed.xyz account to see posts from our own Mastodon instance.',
      cta: hasSignedIn
        ? undefined
        : { label: 'Create free account →', href: '/api/auth/gotosocial/register' },
    },
    nostr: {
      title: 'No Nostr notes found',
      body: 'Public relays returned no recent notes. This can happen when relays are slow or no one is posting on crypto hashtags.',
    },
    farcaster: {
      title: 'No Farcaster casts found',
      body: 'Farcaster hubs returned no recent casts. This may be a hub connectivity issue.',
    },
    lens: {
      title: 'No Lens posts found',
      body: 'Lens API returned no recent publications. This may be an API access issue.',
    },
    bluesky: {
      title: 'No Bluesky posts found',
      body: 'Bluesky search returned no recent posts. Try again later.',
    },
    threads: {
      title: 'No Threads posts found',
      body: 'Threads (Experimental) — public pages returned no posts. Scraping is fragile; this may improve.',
    },
    reddit: {
      title: 'No Reddit posts found',
      body: 'Reddit feeds returned no posts. Reddit frequently blocks automated access.',
    },
    'reddit-crypto': {
      title: 'r/CryptoCurrency is empty',
      body: 'Reddit returned no posts. This is usually a rate-limit or block from Reddit.',
    },
    'reddit-bitcoin': {
      title: 'r/Bitcoin is empty',
      body: 'Reddit returned no posts. This is usually a rate-limit or block from Reddit.',
    },
    'reddit-ethereum': {
      title: 'r/ethereum is empty',
      body: 'Reddit returned no posts. This is usually a rate-limit or block from Reddit.',
    },
  };

  const msg = messages[section] ?? {
    title: 'No posts found',
    body: 'This feed is empty right now. Try another section or sign in to see more.',
  };

  return (
    <div className="card mt-6 border-degen-500/20 bg-degen-500/5 py-8 text-center">
      <h3 className="mb-2 text-base font-bold text-degen-400">{msg.title}</h3>
      <p className="mb-4 text-sm text-gray-400">{msg.body}</p>
      <div className="flex justify-center gap-2">
        {msg.cta ? (
          <a href={msg.cta.href} className="btn-primary text-sm">
            {msg.cta.label}
          </a>
        ) : null}
        {!hasSignedIn && !msg.cta && (
          <button type="button" onClick={onSignIn} className="btn-primary text-sm">
            Sign in to connect {section}
          </button>
        )}
        <button type="button" onClick={onRetry} className="btn-secondary text-sm">
          Retry
        </button>
      </div>
    </div>
  );
}

interface FeedMeta {
  total?: number;
  limit?: number;
  perProtocol?: Record<string, number>;
  errors?: string[];
  notices?: string[];
  trending?: { topic: string; count: number; score: number }[];
  fetchedAt?: number;
  presetName?: string;
  presetLabel?: string;
}

const PRESET_NAMES = ['quality', 'balanced', 'everything'] as const;
const PRESET_LABELS: Record<string, string> = {
  quality: 'Quality',
  balanced: 'Balanced',
  everything: 'Everything',
};

function SectionContent({ section }: { section: string }) {
  const { signedInProtocols, engage, openSignIn, openCompose, openComposeReply } = useAuth();
  const router = useRouter();
  const meta = SECTIONS.find((s) => s.id === section);
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [tipPost, setTipPost] = useState<UnifiedPost | null>(null);
  const [feedMeta, setFeedMeta] = useState<FeedMeta>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [activePreset, setActivePreset] = useState<string>('balanced');
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);
  const { notifications, unreadCount, fetchNotifications, markRead } =
    useNotifications(hasSignedIn);

  // Derive protocol from section id for protocol-specific pages
  const PROTOCOL_SECTIONS = new Set([
    'nostr',
    'farcaster',
    'lens',
    'bluesky',
    'mastodon',
    'reddit',
  ]);
  const sectionProtocol = PROTOCOL_SECTIONS.has(section) ? section : null;

  // Stable fetch function shared by the main loader and the poller.
  // Returns the raw API response so the caller can destructure both posts
  // and metadata (notices, errors, trending, preset).
  const fetchFeed = useCallback(
    async (
      presetOverride?: string,
    ): Promise<{
      data: UnifiedPost[];
      meta?: FeedMeta;
    }> => {
      const currentMeta = SECTIONS.find((s) => s.id === section);
      const url = new URL(currentMeta?.endpoint || '/api/feed/home', window.location.origin);
      url.searchParams.set('limit', String(currentMeta?.limit || 25));
      if (currentMeta?.params) {
        for (const [k, v] of Object.entries(currentMeta.params)) url.searchParams.set(k, v);
      }
      // Pass the active preset (or override) to the API
      url.searchParams.set('preset', presetOverride ?? activePreset);
      let res = await fetch(url.toString(), {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      });
      let body = (await res.json()) as { data?: UnifiedPost[]; meta?: FeedMeta };
      // Sync preset from response meta
      if (body.meta?.presetName && !presetOverride) {
        setActivePreset(body.meta.presetName);
      }
      if (!body.data?.length && section === 'all') {
        const rssUrl = new URL('/api/feed/rss', window.location.origin);
        rssUrl.searchParams.set('source', 'reddit');
        rssUrl.searchParams.set('handle', 'CryptoCurrency');
        rssUrl.searchParams.set('limit', '25');
        res = await fetch(rssUrl.toString(), {
          credentials: 'include',
          cache: 'no-store',
          headers: { 'cache-control': 'no-store' },
        });
        body = (await res.json()) as { data?: UnifiedPost[]; meta?: FeedMeta };
      }
      return { data: body.data || [], meta: body.meta };
    },
    [section, activePreset],
  );

  // Poll for new posts in the background (only needs the data array)
  const { newPostCount, refresh: resetNewPosts } = useFeedPoller(
    async () => {
      const result = await fetchFeed();
      return result.data;
    },
    60_000,
    true,
  );

  useEffect(() => {
    void refreshKey;
    let cancelled = false;
    async function load() {
      setState('loading');
      try {
        const result = await fetchFeed();
        if (cancelled) return;
        setPosts(result.data);
        setFeedMeta(result.meta ?? {});
        setState(result.data.length ? 'loaded' : 'empty');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed');
          setState('error');
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fetchFeed, refreshKey]);

  const displayName = meta?.label ?? section;
  const color = meta?.color ?? '#666';
  const icon = meta?.icon ?? '●';

  const handleEngage = async (
    action: EngagementAction,
    postId: string,
    content?: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: 'Post not found' };

    if ((action === 'bookmark' || action === 'unbookmark') && post.protocol !== 'mastodon') {
      try {
        if (action === 'bookmark')
          await addBookmark(
            postId,
            post.dfUri ?? '',
            post.protocol,
            post.text.slice(0, 60),
            post.author.displayName || '',
          );
        else await removeBookmark(postId);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Bookmark failed' };
      }
    }

    return engage(action, postId, post.protocol, { content });
  };

  const handleRetry = () => {
    resetNewPosts();
    setRefreshKey((k) => k + 1);
  };

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-2xl px-4 py-4">
        <FeedPollerBanner count={newPostCount} onRefresh={handleRetry} />
        <SectionNav current={section} />

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl" style={{ color }}>
              {icon}
            </span>
            <div>
              <h1 className="text-lg font-bold text-[var(--color-fg)]">{displayName}</h1>
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${color}22`, color }}
            >
              {displayName}
            </span>
            {/* ── Preset selector ── */}
            <div className="relative flex items-center gap-1">
              <select
                value={activePreset}
                onChange={async (e) => {
                  const newPreset = e.target.value;
                  setActivePreset(newPreset);
                  // Save preset to KV if signed in
                  if (hasSignedIn) {
                    try {
                      await fetch('/api/presets', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                          presetName: newPreset,
                          protocol: sectionProtocol,
                        }),
                      });
                    } catch {
                      /* non-critical */
                    }
                  }
                  // Refetch with the new preset
                  const result = await fetchFeed(newPreset);
                  setPosts(result.data);
                  setFeedMeta(result.meta ?? {});
                  setState(result.data.length ? 'loaded' : 'empty');
                }}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-1 text-[11px] text-gray-400 focus:outline-none focus:ring-1 focus:ring-degen-500"
                aria-label="Quality preset"
              >
                {PRESET_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {PRESET_LABELS[name] ?? name}
                  </option>
                ))}
              </select>
              {activePreset !== 'balanced' && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-degen-400"
                  style={{ backgroundColor: '#22c55e22' }}
                >
                  {PRESET_LABELS[activePreset] ?? activePreset}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasSignedIn && (
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                onFetch={fetchNotifications}
                onMarkRead={markRead}
              />
            )}
            {hasSignedIn ? (
              <button type="button" className="btn-primary text-xs" onClick={openCompose}>
                Compose
              </button>
            ) : (
              <button type="button" className="btn-secondary text-xs" onClick={openSignIn}>
                Sign In
              </button>
            )}
          </div>
        </div>

        {feedMeta.notices && feedMeta.notices.length > 0 && (
          <div className="mb-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-400">
            {feedMeta.notices.map((n) => (
              <div key={n}>{n}</div>
            ))}
          </div>
        )}

        {feedMeta.errors && feedMeta.errors.length > 0 && (
          <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            {feedMeta.errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}

        {feedMeta.trending && feedMeta.trending.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {feedMeta.trending.map((t) => (
              <span
                key={t.topic}
                className="rounded-full border border-degen-500/30 bg-degen-500/10 px-2 py-0.5 text-xs text-degen-400"
              >
                {t.topic}
              </span>
            ))}
          </div>
        )}

        {hasSignedIn && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="text-degen-400">Signed in:</span>
            {Object.keys(signedInProtocols).map((p) => (
              <span
                key={p}
                className="rounded-full px-2 py-0.5 font-medium"
                style={{ backgroundColor: `${getProtocolColor(p)}22`, color: getProtocolColor(p) }}
              >
                {p}
              </span>
            ))}
            <a href="/profile" className="ml-auto text-degen-500 hover:underline">
              Profile
            </a>
          </div>
        )}

        <FeedList
          state={state}
          posts={posts}
          error={error}
          protocolLabel={displayName}
          onPostClick={(id) => router.push(`/post/${encodeURIComponent(id)}`)}
          onEngage={handleEngage}
          onTip={(post) => setTipPost(post)}
          onRetry={handleRetry}
          onCrossReplyOpen={(post) => {
            const nativeId = post.id.replace(
              /^(nostr:|farcaster:|lens:|bluesky:|mastodon:|reddit:|rss:|threads:)/,
              '',
            );
            openComposeReply({
              parentPostUri: post.dfUri ?? `df://${post.protocol}:${nativeId}`,
              parentProtocol: post.protocol,
              parentPreview: post.text.slice(0, 120),
            });
          }}
        />

        <SectionEmptyState
          section={section}
          state={state}
          hasSignedIn={hasSignedIn}
          onSignIn={openSignIn}
          onRetry={handleRetry}
        />

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

export default async function SectionPage({ params }: Props) {
  const section = (await params).section;
  return <SectionContent key={section} section={section} />;
}
