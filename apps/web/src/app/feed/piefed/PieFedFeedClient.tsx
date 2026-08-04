/**
 * @degenfeed/web — PieFedFeedClient
 *
 * First-class feed page for the self-hosted PieFed instance
 * (links.degenfeed.xyz, port 8023).
 *
 * Renders PieFed link-aggregator content as rich cards showing:
 *   - Community name + instance badge
 *   - Post type (link/text/image/video)
 *   - Upvotes / downvotes / comment counts
 *   - "Open in PieFed" deep link
 *
 * Known issue: the PieFed instance has NO public vhost configured —
 * it is only reachable on 127.0.0.1:8023 (SERVER_NAME=links.degenfeed.xyz).
 * The page documents this so visitors understand the content status.
 *
 * RESOLVED 2026-08-03: links.degenfeed.xyz now proxies to 127.0.0.1:8023
 * (nginx vhost restored with PieFed theme + unified nav injection).
 */

'use client';

import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, FeedList } from '@degenfeed/ui';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';

// ─── Constants ──────────────────────────────────────────────────────────

const PIEFED_COLOR = '#f97316';
const PIEFED_HOST = 'links.degenfeed.xyz';

interface FeedMeta {
  total?: number;
  limit?: number;
  errors?: string[];
  notices?: string[];
  fetchedAt?: number;
}

// ─── Post type badge ───────────────────────────────────────────────────

// ─── Header ────────────────────────────────────────────────────────────

function PieFedHeader({ total }: { total?: number }) {
  return (
    <div
      className="relative mb-6 overflow-hidden rounded-xl border transition-all"
      style={{
        borderColor: `${PIEFED_COLOR}33`,
        background: `linear-gradient(145deg, ${PIEFED_COLOR}12 0%, ${PIEFED_COLOR}04 50%, transparent 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-15 blur-3xl"
        style={{ backgroundColor: PIEFED_COLOR }}
      />
      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl sm:h-16 sm:w-16 sm:text-3xl"
            style={{
              backgroundColor: `${PIEFED_COLOR}20`,
              color: PIEFED_COLOR,
              boxShadow: `0 0 24px ${PIEFED_COLOR}22`,
            }}
            aria-hidden="true"
          >
            🥧
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1
                className="text-xl font-bold tracking-tight sm:text-2xl"
                style={{ color: 'var(--color-fg)' }}
              >
                PieFed
              </h1>
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                style={{ backgroundColor: `${PIEFED_COLOR}20`, color: PIEFED_COLOR }}
              >
                {PIEFED_HOST}
              </span>
              {total !== undefined && (
                <span className="text-xs tabular-nums" style={{ color: 'var(--color-muted)' }}>
                  {total} posts
                </span>
              )}
            </div>
            <p
              className="mt-1 max-w-lg text-sm leading-relaxed"
              style={{ color: 'var(--color-muted)' }}
            >
              Federated link aggregator &amp; community discussions — open-source Reddit alternative
              on ActivityPub, self-hosted by DegenFeed.
            </p>
            <div
              className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
              style={{ color: 'var(--color-muted)' }}
            >
              <span className="inline-flex items-center gap-1">
                <span style={{ color: PIEFED_COLOR }}>🥧</span>
                v1.7.8 (pyfedi)
              </span>
              <span className="inline-flex items-center gap-1">
                <span>🔗</span>
                Link aggregator
              </span>
              <span className="inline-flex items-center gap-1">
                <span>🌐</span>
                ActivityPub
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`https://${PIEFED_HOST}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all hover:translate-y-[-1px]"
            style={{
              backgroundColor: PIEFED_COLOR,
              color: '#fff',
              boxShadow: `0 0 20px ${PIEFED_COLOR}30`,
            }}
          >
            Open PieFed ↗
          </a>
        </div>

        {/* Known issue banner */}
        <div
          className="mt-4 rounded-lg border px-3 py-2 text-xs leading-relaxed"
          style={{
            borderColor: `${PIEFED_COLOR}25`,
            backgroundColor: `${PIEFED_COLOR}08`,
            color: 'var(--color-muted)',
          }}
        >
          <span className="font-semibold" style={{ color: PIEFED_COLOR }}>
            Known issue:
          </span>{' '}
          This PieFed instance has no public vhost configured — it is only reachable on
          127.0.0.1:8023 (SERVER_NAME=links.degenfeed.xyz). The instance is running and federating,
          but content may be limited until a public vhost is added.
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────

function PieFedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={`skel-piefed-${i}`}
          className="animate-pulse rounded-xl border p-4"
          style={{ borderColor: `${PIEFED_COLOR}10`, backgroundColor: 'var(--color-card)' }}
        >
          <div className="mb-3 flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full"
              style={{ backgroundColor: `${PIEFED_COLOR}15` }}
            />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded" style={{ backgroundColor: `${PIEFED_COLOR}10` }} />
              <div className="h-2 w-20 rounded" style={{ backgroundColor: `${PIEFED_COLOR}08` }} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded" style={{ backgroundColor: `${PIEFED_COLOR}08` }} />
            <div className="h-3 w-3/4 rounded" style={{ backgroundColor: `${PIEFED_COLOR}08` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Client ────────────────────────────────────────────────────────────

export function PieFedFeedClient() {
  const { engage } = useAuth();
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [feedMeta, setFeedMeta] = useState<FeedMeta>({});

  const fetchFeed = useCallback(async () => {
    setState('loading');
    try {
      const url = new URL('/api/feed/piefed', window.location.origin);
      url.searchParams.set('limit', '50');
      const res = await fetch(url.toString(), { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(`Feed returned ${res.status}`);
      const json = (await res.json()) as {
        posts?: UnifiedPost[];
        data?: UnifiedPost[];
        meta?: FeedMeta;
      };
      const feed = json.posts ?? json.data ?? [];
      setPosts(feed);
      setFeedMeta(json.meta ?? {});
      setState(feed.length ? 'loaded' : 'empty');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
      setState('error');
    }
  }, []);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  const handleEngage = async (
    action: string,
    postId: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: 'Post not found' };
    return engage(action as EngagementAction, postId, post.protocol, {});
  };

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-2xl">
        <PieFedHeader total={feedMeta.total} />

        {feedMeta.notices && feedMeta.notices.length > 0 && (
          <div className="mb-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-400">
            {feedMeta.notices.map((n) => (
              <div key={n}>{n}</div>
            ))}
          </div>
        )}

        {state === 'loading' && posts.length === 0 && <PieFedSkeleton />}

        <FeedList
          state={state}
          posts={posts}
          error={error}
          protocolLabel="PieFed"
          protocolColor={PIEFED_COLOR}
          onPostClick={(id) => {
            // Navigate to the native PieFed URL when available (raw.ap_id),
            // otherwise fall back to the in-app post view.
            const post = posts.find((p) => p.id === id);
            const apId = (post?.raw as { post?: { ap_id?: string } } | undefined)?.post?.ap_id;
            if (apId) {
              window.open(apId, '_blank', 'noopener,noreferrer');
              return;
            }
            window.open(
              `https://${PIEFED_HOST}/post/${id.replace('piefed:', '').split('@')[0]}`,
              '_blank',
              'noopener,noreferrer',
            );
          }}
          onEngage={handleEngage}
          onTip={() => {}}
          onRetry={() => void fetchFeed()}
          onCrossReplyOpen={() => {}}
        />

        {state === 'empty' && (
          <div
            className="mt-6 rounded-xl border py-10 text-center"
            style={{ borderColor: `${PIEFED_COLOR}20`, backgroundColor: `${PIEFED_COLOR}04` }}
          >
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
              style={{ backgroundColor: `${PIEFED_COLOR}15`, color: PIEFED_COLOR }}
            >
              🥧
            </div>
            <h3 className="mb-1 text-base font-bold" style={{ color: PIEFED_COLOR }}>
              No PieFed posts right now
            </h3>
            <p className="mx-auto max-w-xs text-sm text-[var(--color-muted)]">
              The local PieFed instance is running but has no published posts yet. Check back soon,
              or visit the instance directly.
            </p>
            <button
              type="button"
              onClick={() => void fetchFeed()}
              className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ backgroundColor: PIEFED_COLOR }}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
