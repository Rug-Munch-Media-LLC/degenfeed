/**
 * @degenfeed/web — <ProtocolFeed source="mastodon" />
 *
 * Reusable component that renders a feed of posts from a single protocol.
 * Fetches from the bridge API, shows protocol header, filter controls,
 * and handles loading/empty/error states.
 *
 * Now integrates with FeedAlgorithm for user-controlled feed ranking.
 * Each post gets a "Why am I seeing this?" ℹ️ button powered by
 * AlgorithmTransparency.
 */

'use client';

import { type AlgorithmContext, FeedAlgorithm, globalAuditLog } from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, FeedList } from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProtocolPostMeta } from '../../app/feed/[protocol]/components/ProtocolPostMeta';
import { useAuth } from '../AuthProvider';
import { ContentFilterBar, type ContentType } from '../ContentFilterBar';
import { type DensityMode, DensityToggle } from '../DensityToggle';
import { FeedPollerBanner } from '../FeedPollerBanner';
import { useAlgorithmTransparency } from './AlgorithmTransparency';
import { PROTOCOLS, type ProtocolConfig } from './feed-protocols';
import { type AlgorithmUserPreferences, loadAlgorithmPrefs } from './feed-tuner-types';

const TipModal = dynamic(() => import('../TipModal').then((m) => ({ default: m.TipModal })), {
  ssr: false,
  loading: () => null,
});

// ─── Helpers ──────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0,0,0';
  const r = Number.parseInt(result[1] ?? '00', 16);
  const g = Number.parseInt(result[2] ?? '00', 16);
  const b = Number.parseInt(result[3] ?? '00', 16);
  return `${r},${g},${b}`;
}

// ─── Types ────────────────────────────────────────────────────────────

interface FeedMeta {
  total?: number;
  limit?: number;
  hasMore?: boolean;
  perProtocol?: Record<string, number>;
  errors?: string[];
  notices?: string[];
  fetchedAt?: number;
}

export interface ProtocolFeedProps {
  source: string;
  limit?: number;
  showHeader?: boolean;
  showFilters?: boolean;
  className?: string;
  /** Enable custom algorithm ranking. Default true. */
  useAlgorithm?: boolean;
  /** Override algorithm preferences (uses saved prefs by default) */
  algorithmPrefs?: AlgorithmUserPreferences;
}

// ─── Component ────────────────────────────────────────────────────────

export function ProtocolFeed({
  source,
  limit = 25,
  showHeader = true,
  showFilters = true,
  className = '',
  useAlgorithm = true,
  algorithmPrefs: externalPrefs,
}: ProtocolFeedProps) {
  const config: ProtocolConfig | undefined = PROTOCOLS[source];
  const router = useRouter();
  const { engage, openComposeReply } = useAuth();

  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [feedMeta, setFeedMeta] = useState<FeedMeta>({});
  const [contentType, setContentType] = useState<ContentType>('all');
  const [density, setDensity] = useState<DensityMode>('comfortable');
  const [newPostCount, setNewPostCount] = useState(0);
  const [tipPost, setTipPost] = useState<UnifiedPost | null>(null);
  // Infinite scroll pagination state.
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastPostIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Algorithm integration ────────────────────────────────────────
  const algorithmRef = useRef<FeedAlgorithm>(new FeedAlgorithm());
  const [algoPrefs, setAlgoPrefs] = useState<AlgorithmUserPreferences>(
    () => externalPrefs ?? loadAlgorithmPrefs(),
  );
  const { TransparencyOverlay } = useAlgorithmTransparency();

  // Initialize algorithm with saved preferences
  useEffect(() => {
    const prefs = externalPrefs ?? loadAlgorithmPrefs();
    setAlgoPrefs(prefs);
    algorithmRef.current.setPreferences({
      weights: prefs.weights,
      niches: prefs.niches,
      protocolWeights: prefs.protocolWeights,
      mode: prefs.mode,
    });
  }, [externalPrefs]);

  const reorderWithAlgorithm = useCallback(
    (rawPosts: UnifiedPost[]): UnifiedPost[] => {
      if (!useAlgorithm) return rawPosts;

      const algo = algorithmRef.current;
      const ctx: AlgorithmContext = {
        viewer: null,
        followed: new Set(),
        now: Date.now(),
      };

      try {
        // Use the algorithm to annotate & reorder posts
        const annotated = algo.annotatePosts(rawPosts, ctx);

        // Record audit entries for transparency
        for (let i = 0; i < Math.min(annotated.length, 20); i++) {
          const post = annotated[i];
          if (!post) continue;
          const entry = algo.createAuditEntry(post, ctx, i + 1);
          globalAuditLog.record(entry);
        }

        return annotated;
      } catch {
        // Fallback: return original order
        return rawPosts;
      }
    },
    [useAlgorithm],
  );

  // Set protocol accent color
  useEffect(() => {
    if (config) {
      document.documentElement.style.setProperty('--protocol-feed-accent', config.color);
      document.documentElement.style.setProperty(
        '--protocol-feed-accent-rgb',
        hexToRgb(config.color),
      );
    }
  }, [config]);

  const fetchFeed = useCallback(
    async (append = false, pageNum = 1) => {
      if (!append) setState('loading');
      try {
        const endpoint = config?.endpoint ?? `/api/feed/${source}`;
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('page', String(pageNum));

        const res = await fetch(url.toString(), {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Feed returned ${res.status}`);

        const json = (await res.json()) as { posts?: UnifiedPost[]; meta?: FeedMeta };
        const data = json as { data?: UnifiedPost[]; meta?: FeedMeta };
        const feed = json.posts ?? data.data ?? [];

        if (feed.length > 0) {
          lastPostIdRef.current = feed[0]?.id ?? '';
        }

        // Apply algorithm reordering (only re-rank the newly appended page so
        // previously loaded posts keep their scroll position).
        const reordered = reorderWithAlgorithm(feed);

        setPosts((prev) => {
          if (!append) return reordered;
          if (reordered.length === 0) return prev;
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...reordered.filter((p) => !seen.has(p.id))];
        });
        setFeedMeta(data.meta ?? {});
        setHasMore(data.meta?.hasMore ?? feed.length >= limit);
        if (feed.length > 0) setState('loaded');
        else if (!append) setState('empty');
        setLoadingMore(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load feed');
        if (!append) setState('error');
        setLoadingMore(false);
      }
    },
    [config, source, limit, reorderWithAlgorithm],
  );

  // Initial fetch + poll for new posts
  useEffect(() => {
    void fetchFeed();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const endpoint = config?.endpoint ?? `/api/feed/${source}`;
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set('limit', '1');
        const res = await fetch(url.toString(), { credentials: 'include' });
        if (!res.ok) return;
        const pollJson = (await res.json()) as { posts?: UnifiedPost[]; data?: UnifiedPost[] };
        const first = (pollJson.posts ?? pollJson.data ?? [])[0];
        if (first && first.id !== lastPostIdRef.current) {
          setNewPostCount((c) => c + 1);
        }
      } catch {
        // ignore
      }
    }, 60_000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchFeed, config, source]);

  const handleRefresh = useCallback(() => {
    setNewPostCount(0);
    setPage(1);
    setHasMore(true);
    void fetchFeed(false, 1);
  }, [fetchFeed]);

  const handleRetry = useCallback(() => {
    setPage(1);
    setHasMore(true);
    void fetchFeed(false, 1);
  }, [fetchFeed]);

  /** Fetch the next page and append it (infinite scroll). */
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || state !== 'loaded') return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    void fetchFeed(true, next);
  }, [loadingMore, hasMore, state, page, fetchFeed]);

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

  const handleCrossReplyOpen = useCallback(
    (post: UnifiedPost) => {
      const nativeId = post.id.replace(
        /^(nostr:|farcaster:|lens:|bluesky:|mastodon:|reddit:|rss:|threads:)/,
        '',
      );
      openComposeReply({
        parentPostUri: post.dfUri ?? `df://${post.protocol}:${nativeId}`,
        parentProtocol: post.protocol,
        parentPreview: post.text.slice(0, 120),
      });
    },
    [openComposeReply],
  );

  // Render posts with "Why am I seeing this?" button
  const renderedPosts = useMemo(() => {
    return posts.map((post) => ({
      ...post,
      // The score.breakdown is already populated by the algorithm for transparency
    }));
  }, [posts]);

  // Protocol not found
  if (!config) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <p className="text-sm font-medium text-red-400">Unknown protocol: &quot;{source}&quot;</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Available protocols: {Object.keys(PROTOCOLS).join(', ')}
        </p>
      </div>
    );
  }

  const accentColor = config.color;

  return (
    <ErrorBoundary>
      <div className={`space-y-4 ${className}`}>
        {/* ── Protocol header ── */}
        {showHeader && (
          <div
            className="overflow-hidden rounded-xl border"
            style={{
              borderColor: `${accentColor}33`,
              background: `linear-gradient(135deg, ${accentColor}15 0%, ${accentColor}05 100%)`,
            }}
          >
            <div className="flex items-center gap-4 p-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                style={{ backgroundColor: `${accentColor}20` }}
              >
                {config.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[var(--color-fg)]">{config.label}</h2>
                  <span
                    className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full"
                    style={{ backgroundColor: accentColor }}
                    title="Live"
                  />
                </div>
                <p className="text-xs text-[var(--color-muted)]">{config.description}</p>
              </div>
              <div className="hidden gap-3 sm:flex">
                {config.stats.map((stat) => (
                  <div key={stat.label} className="text-right">
                    <p
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: accentColor }}
                    >
                      {stat.value}
                    </p>
                    <p className="text-[10px] text-[var(--color-muted)]">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile stats row */}
            <div
              className="flex gap-4 border-t px-4 py-2 sm:hidden"
              style={{ borderColor: `${accentColor}15` }}
            >
              {config.stats.slice(0, 2).map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-xs font-semibold tabular-nums" style={{ color: accentColor }}>
                    {stat.value}
                  </p>
                  <p className="text-[10px] text-[var(--color-muted)]">{stat.label}</p>
                </div>
              ))}
              {feedMeta.total !== undefined && (
                <div className="text-center">
                  <p className="text-xs font-semibold tabular-nums" style={{ color: accentColor }}>
                    {feedMeta.total}
                  </p>
                  <p className="text-[10px] text-[var(--color-muted)]">posts</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Algorithm indicator ── */}
        {useAlgorithm && (
          <div className="flex items-center justify-between rounded-lg border border-degen-500/20 bg-degen-500/5 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-degen-400">
              <span>⚙️</span>
              <span>
                Custom algorithm active
                {algoPrefs.mode !== 'standard' && ` · ${algoPrefs.mode.replace('-', ' ')} mode`}
              </span>
            </div>
            <a href="/settings/algorithm" className="text-[10px] underline hover:text-degen-300">
              Adjust
            </a>
          </div>
        )}

        {/* ── Feed controls ── */}
        <div className="flex items-center justify-between gap-2">
          {showFilters ? (
            <div className="flex-1">
              <ContentFilterBar
                active={contentType}
                onChange={setContentType}
                color={accentColor}
              />
            </div>
          ) : (
            <div />
          )}
          <DensityToggle value={density} onChange={setDensity} />
        </div>

        {/* ── New posts banner ── */}
        <FeedPollerBanner count={newPostCount} onRefresh={handleRefresh} />

        {/* ── Notices ── */}
        {feedMeta.notices && feedMeta.notices.length > 0 && (
          <div
            className="rounded-lg border p-3 text-xs"
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

        {/* ── Feed list ── */}
        <div
          style={
            {
              '--protocol-color': accentColor,
              '--protocol-color-rgb': hexToRgb(accentColor),
            } as React.CSSProperties
          }
        >
          <FeedList
            state={state}
            posts={renderedPosts}
            error={error}
            protocolLabel={config.label}
            protocolColor={accentColor}
            hasMore={hasMore && !loadingMore}
            onLoadMore={loadMore}
            onPostClick={(id) => router.push(`/post/${encodeURIComponent(id)}`)}
            onEngage={handleEngage}
            onTip={(post) => setTipPost(post)}
            onRetry={handleRetry}
            onCrossReplyOpen={handleCrossReplyOpen}
            postMetaSlot={(post) => (
              <ProtocolPostMeta
                post={post}
                onEngage={handleEngage}
                onReply={(p) => handleCrossReplyOpen(p)}
              />
            )}
          />
        </div>

        {/* ── Empty state ── */}
        {state === 'empty' && (
          <div
            className="rounded-xl border py-10 text-center"
            style={{ borderColor: `${accentColor}22`, backgroundColor: `${accentColor}05` }}
          >
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
              style={{ backgroundColor: `${accentColor}18` }}
            >
              {config.icon}
            </div>
            <h3 className="mb-1 text-base font-bold" style={{ color: accentColor }}>
              No {config.postNoun}s right now
            </h3>
            <p className="mx-auto max-w-xs text-sm text-[var(--color-muted)]">
              {source === 'nostr' ||
              source === 'farcaster' ||
              source === 'lens' ||
              source === 'pixelfed'
                ? `The ${config.label} connector is warming up. Check back soon!`
                : `There are no ${config.postNoun}s from ${config.label} at the moment.`}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ backgroundColor: accentColor }}
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Tip modal ── */}
        {tipPost && (
          <TipModal
            open={!!tipPost}
            onClose={() => setTipPost(null)}
            recipientProtocol={tipPost.protocol}
            recipientAuthorId={tipPost.author.id}
            recipientDisplayName={tipPost.author.displayName}
          />
        )}

        {/* ── Loading state inline ── */}
        {state === 'loading' && posts.length === 0 && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={`skeleton-${source}-${i}`}
                className="animate-pulse rounded-xl border p-4"
                style={{ borderColor: `${accentColor}10`, backgroundColor: 'var(--color-card)' }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full"
                    style={{ backgroundColor: `${accentColor}15` }}
                  />
                  <div className="flex-1 space-y-2">
                    <div
                      className="h-3 w-32 rounded"
                      style={{ backgroundColor: `${accentColor}10` }}
                    />
                    <div
                      className="h-2 w-20 rounded"
                      style={{ backgroundColor: `${accentColor}08` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div
                    className="h-3 w-full rounded"
                    style={{ backgroundColor: `${accentColor}08` }}
                  />
                  <div
                    className="h-3 w-3/4 rounded"
                    style={{ backgroundColor: `${accentColor}08` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Algorithm Transparency Overlay ── */}
        {TransparencyOverlay}
      </div>
    </ErrorBoundary>
  );
}
