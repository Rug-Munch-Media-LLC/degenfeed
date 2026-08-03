/**
 * @degenfeed/web — MastodonFeedClient
 *
 * Client component for the Mastodon/GTS feed page.
 * Shows two tabs: "Your GTS Feed" (local instance) and "Federated Feed" (all).
 * Supports content warnings, instance labels, and protocol-colored design.
 */

'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, FeedList } from '@degenfeed/ui';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';

// ─── Types ──────────────────────────────────────────────────────────────────

interface FeedMeta {
  total?: number;
  limit?: number;
  errors?: string[];
  notices?: string[];
  fetchedAt?: number;
}

type FeedTab = 'gts-local' | 'federated';

// ─── GTS Instance Info ──────────────────────────────────────────────────────

const GTS_INSTANCE = {
  host: 'social.degenfeed.xyz',
  label: 'GoToSocial',
  color: '#1d9bf0',
  icon: '◈',
  description: "DegenFeed's GoToSocial instance — web3 social on ActivityPub",
};

const FEDERATED_META = {
  label: 'Fediverse',
  color: '#6364ff',
  icon: '🐘',
  description: 'Posts from all federated ActivityPub instances',
};

// ─── Feed Tab Config ────────────────────────────────────────────────────────

const FEED_TABS: { id: FeedTab; label: string; icon: string }[] = [
  { id: 'gts-local', label: 'Your GTS Feed', icon: '◈' },
  { id: 'federated', label: 'Federated Feed', icon: '🌐' },
];

// ─── Content Warning Blur Component ─────────────────────────────────────────

function ContentWarningOverlay({ warning, onReveal }: { warning: string; onReveal: () => void }) {
  return (
    <div
      className="relative mb-3 overflow-hidden rounded-xl border transition-all cursor-pointer"
      style={{
        borderColor: 'rgba(29, 155, 240, 0.15)',
        background:
          'repeating-linear-gradient(45deg, rgba(10,10,10,0.95) 0px, rgba(10,10,10,0.95) 10px, rgba(0,0,0,0.8) 10px, rgba(0,0,0,0.8) 20px)',
      }}
      onClick={onReveal}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onReveal();
      }}
      role="button"
      tabIndex={0}
      aria-label={`Content warning: ${warning}. Click to reveal.`}
    >
      {/* Decorative blur lines */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 5-5m7 10l-5-5 5-5"
            fill="currentColor"
            opacity="0.2"
          />
        </svg>
      </div>
      <div className="relative px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 7v2h2v-2h-2zm0-4v3h2V9h-2z" />
            </svg>
            SENSITIVE CONTENT
          </span>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
          {warning}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
          Click or press enter to reveal
        </p>
      </div>
    </div>
  );
}

// ─── Instance Badge ──────────────────────────────────────────────────────────

function InstanceBadge({ host, label, color }: { host: string; label: string; color: string }) {
  const isLocal = host === GTS_INSTANCE.host;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
        isLocal ? 'border' : ''
      }`}
      style={{
        backgroundColor: isLocal ? `${color}18` : 'var(--color-overlay)',
        color: isLocal ? color : 'var(--color-muted)',
        borderColor: isLocal ? `${color}30` : 'transparent',
      }}
      title={`Instance: ${host}`}
    >
      {isLocal ? '◈' : '🐘'}
      <span>{label}</span>
    </span>
  );
}

// ─── GTS Feed Info Header ────────────────────────────────────────────────────

function GtsInstanceHeader() {
  return (
    <div
      className="relative mb-6 overflow-hidden rounded-xl border transition-all"
      style={{
        borderColor: `${GTS_INSTANCE.color}33`,
        background: `linear-gradient(145deg, ${GTS_INSTANCE.color}12 0%, ${GTS_INSTANCE.color}04 50%, transparent 100%)`,
      }}
    >
      {/* Decorative glow */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-15 blur-3xl"
        style={{ backgroundColor: GTS_INSTANCE.color }}
      />
      <div
        className="pointer-events-none absolute -bottom-8 -left-8 h-20 w-20 rounded-full opacity-10 blur-2xl"
        style={{ backgroundColor: GTS_INSTANCE.color }}
      />

      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl sm:h-16 sm:w-16 sm:text-3xl"
            style={{
              backgroundColor: `${GTS_INSTANCE.color}20`,
              color: GTS_INSTANCE.color,
              boxShadow: `0 0 24px ${GTS_INSTANCE.color}22`,
            }}
            aria-hidden="true"
          >
            {GTS_INSTANCE.icon}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1
                className="text-xl font-bold tracking-tight sm:text-2xl"
                style={{ color: 'var(--color-fg)' }}
              >
                {GTS_INSTANCE.label}
              </h1>
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                style={{ backgroundColor: `${GTS_INSTANCE.color}20`, color: GTS_INSTANCE.color }}
              >
                {GTS_INSTANCE.host}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium bg-degen-500/10 text-degen-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse bg-degen-400 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                Connected
              </span>
            </div>
            <p
              className="mt-1 max-w-lg text-sm leading-relaxed"
              style={{ color: 'var(--color-muted)' }}
            >
              {GTS_INSTANCE.description}
            </p>
            <div
              className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
              style={{ color: 'var(--color-muted)' }}
            >
              <span className="inline-flex items-center gap-1">
                <span style={{ color: GTS_INSTANCE.color }}>◈</span>
                Local timeline
              </span>
              <span className="inline-flex items-center gap-1">
                <span>🐘</span>
                Federated with 30k+ instances
              </span>
              <span className="inline-flex items-center gap-1">
                <span>🔗</span>
                ActivityPub
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`https://${GTS_INSTANCE.host}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all hover:translate-y-[-1px]"
            style={{
              backgroundColor: GTS_INSTANCE.color,
              color: '#000',
              boxShadow: `0 0 20px ${GTS_INSTANCE.color}30`,
            }}
          >
            Open Instance ↗
          </a>
          <a
            href={`https://${GTS_INSTANCE.host}/about`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all border"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-fg)',
            }}
          >
            About
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Loader ────────────────────────────────────────────────────────

function MastodonSkeleton({ accentColor = '#6364ff' }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={`skel-masto-${i}`}
          className="animate-pulse rounded-xl border p-4"
          style={{
            borderColor: `${accentColor}10`,
            backgroundColor: 'var(--color-card)',
          }}
        >
          <div className="mb-3 flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full"
              style={{ backgroundColor: `${accentColor}15` }}
            />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded" style={{ backgroundColor: `${accentColor}10` }} />
              <div className="h-2 w-20 rounded" style={{ backgroundColor: `${accentColor}08` }} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded" style={{ backgroundColor: `${accentColor}08` }} />
            <div className="h-3 w-3/4 rounded" style={{ backgroundColor: `${accentColor}08` }} />
            <div className="h-3 w-1/2 rounded" style={{ backgroundColor: `${accentColor}06` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function MastodonEmptyState({
  tab,
  accentColor,
  onRetry,
}: {
  tab: FeedTab;
  accentColor: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="mt-6 rounded-xl border py-10 text-center"
      style={{ borderColor: `${accentColor}20`, backgroundColor: `${accentColor}04` }}
    >
      <div
        className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
        style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
      >
        {tab === 'gts-local' ? '◈' : '🌐'}
      </div>
      <h3 className="mb-1 text-base font-bold" style={{ color: accentColor }}>
        {tab === 'gts-local' ? 'No local posts yet' : 'No federated posts yet'}
      </h3>
      <p className="mx-auto max-w-xs text-sm" style={{ color: 'var(--color-muted)' }}>
        {tab === 'gts-local'
          ? "Be the first to post on DegenFeed's GoToSocial instance!"
          : 'Federated content from the wider fediverse will appear here.'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
        style={{ backgroundColor: accentColor }}
      >
        Retry
      </button>
    </div>
  );
}

// ─── Post Content Warning Wrapper ───────────────────────────────────────────

function PostWithContentWarning({
  post,
  children,
}: {
  post: UnifiedPost;
  children: React.ReactNode;
}) {
  const [revealed, setRevealed] = useState(false);

  // Check if post has a content warning / spoiler
  const cw =
    post.meta?.contentWarning ||
    ((post as unknown as Record<string, unknown>).spoiler_text as string | undefined);

  if (cw && !revealed) {
    return <ContentWarningOverlay warning={cw} onReveal={() => setRevealed(true)} />;
  }

  return <>{children}</>;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function MastodonFeedClient() {
  const [activeTab, setActiveTab] = useState<FeedTab>('gts-local');
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [feedMeta, setFeedMeta] = useState<FeedMeta>({});
  const { engage } = useAuth();

  const activeConfig =
    activeTab === 'gts-local'
      ? { ...GTS_INSTANCE, endpoint: '/api/feed/mastodon/local' }
      : { ...FEDERATED_META, endpoint: '/api/feed/mastodon/federated' };

  // Fetch feed
  const fetchFeed = useCallback(async () => {
    setState('loading');
    try {
      const endpoint = activeConfig.endpoint;
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set('limit', '50');

      const res = await fetch(url.toString(), {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      });

      if (!res.ok) {
        // Fallback to generic mastodon endpoint
        const fallbackUrl = new URL('/api/feed/mastodon', window.location.origin);
        fallbackUrl.searchParams.set('limit', '50');
        if (activeTab === 'gts-local') {
          fallbackUrl.searchParams.set('instance', 'social.degenfeed.xyz');
        }
        const fallbackRes = await fetch(fallbackUrl.toString(), {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!fallbackRes.ok) throw new Error(`Feed returned ${fallbackRes.status}`);
        const fallbackJson = (await fallbackRes.json()) as {
          data?: UnifiedPost[];
          meta?: FeedMeta;
        };
        setPosts(fallbackJson.data ?? []);
        setFeedMeta(fallbackJson.meta ?? {});
        setState(fallbackJson.data?.length ? 'loaded' : 'empty');
        return;
      }

      const json = (await res.json()) as { data?: UnifiedPost[]; meta?: FeedMeta };
      setPosts(json.data ?? []);
      setFeedMeta(json.meta ?? {});
      setState(json.data?.length ? 'loaded' : 'empty');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
      setState('error');
    }
  }, [activeTab, activeConfig.endpoint]);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  const handleEngage = async (
    action: string,
    postId: string,
    content?: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: 'Post not found' };
    if (action === 'like' || action === 'repost' || action === 'reply' || action === 'bookmark') {
      return engage(action, postId, post.protocol, { content });
    }
    return { ok: false, error: 'Unknown action' };
  };

  const accentColor = activeTab === 'gts-local' ? GTS_INSTANCE.color : FEDERATED_META.color;

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-2xl">
        {/* GTS Instance Info Header */}
        <GtsInstanceHeader />

        {/* Tab Bar */}
        <div
          className="mb-4 flex items-center border-b"
          style={{ borderColor: 'var(--border)' }}
          role="tablist"
          aria-label="Feed source"
        >
          {FEED_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-[var(--color-fg)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {isActive && (
                  <span
                    className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: accentColor }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Notices */}
        {feedMeta.notices && feedMeta.notices.length > 0 && (
          <div
            className="mb-3 rounded-lg border p-3 text-xs"
            style={{
              borderColor: `${accentColor}30`,
              backgroundColor: `${accentColor}08`,
              color: accentColor,
            }}
          >
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

        {/* Feed content */}
        {state === 'loading' && posts.length === 0 && (
          <MastodonSkeleton accentColor={accentColor} />
        )}

        {state === 'empty' && (
          <MastodonEmptyState
            tab={activeTab}
            accentColor={accentColor}
            onRetry={() => fetchFeed()}
          />
        )}

        {state === 'error' && (
          <div className="flex flex-col items-center py-20">
            <p className="mb-2 text-sm font-medium text-red-400">Failed to load feed</p>
            <p className="mb-4 text-xs" style={{ color: 'var(--color-muted)' }}>
              {error}
            </p>
            <button
              type="button"
              onClick={() => fetchFeed()}
              className="rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: accentColor }}
            >
              Retry
            </button>
          </div>
        )}

        {state === 'loaded' && (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostWithContentWarning key={post.id} post={post}>
                <div className="space-y-2">
                  {/* Instance badge */}
                  {activeTab === 'federated' && (
                    <div className="flex items-center gap-2">
                      <InstanceBadge
                        host={(post.meta?.instanceHost as string) || 'unknown.social'}
                        label={(post.meta?.instanceLabel as string) || post.source || 'Fediverse'}
                        color={accentColor}
                      />
                    </div>
                  )}

                  {/* Protocol badge for cross-protocol posts */}
                  {post.protocol && post.protocol !== 'mastodon' && (
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                        style={{
                          backgroundColor: `${accentColor}18`,
                          color: accentColor,
                        }}
                      >
                        {post.protocol}
                      </span>
                    </div>
                  )}

                  <FeedList
                    state="loaded"
                    posts={[post]}
                    error={undefined}
                    protocolLabel={activeTab === 'gts-local' ? GTS_INSTANCE.host : 'Fediverse'}
                    protocolColor={accentColor}
                    onPostClick={(id) =>
                      window.open(
                        `https://app.degenfeed.xyz/post/${encodeURIComponent(id)}`,
                        '_blank',
                      )
                    }
                    onEngage={handleEngage}
                    onTip={() => {}}
                    onRetry={() => fetchFeed()}
                    onCrossReplyOpen={() => {}}
                  />
                </div>
              </PostWithContentWarning>
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
