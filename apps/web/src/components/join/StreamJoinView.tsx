'use client';

/**
 * @components/join/StreamJoinView — Full stream join experience.
 *
 * Assembles the stream player, guest chat, and actions bar into a
 * cohesive layout for anonymous viewers arriving from external platforms.
 * No sign-in required — watch immediately, chat as a guest, tip via wallet.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { StreamPlayer } from '../stream/StreamPlayer';
import type { StreamExtended } from '../stream/types';
import { GuestChat } from './GuestChat';
import { GuestSignUp } from './GuestSignUp';
import { JoinActions } from './JoinActions';
import { type JoinStreamData, PLATFORM_CONFIG, type SourcePlatform } from './types';

/* === Props ====================================================== */

interface StreamJoinViewProps {
  streamId: string;
  sourcePlatform: SourcePlatform;
  sourceInstance?: string;
}

/* === Skeleton =================================================== */

function StreamJoinSkeleton() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col lg:flex-row gap-4 p-4">
      {/* Player skeleton */}
      <div className="flex-1">
        <div className="aspect-video w-full animate-pulse rounded-2xl bg-[var(--color-muted)]/10" />
        <div className="mt-4 space-y-2">
          <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--color-muted)]/10" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-muted)]/8" />
        </div>
      </div>
      {/* Chat skeleton */}
      <div className="w-full lg:w-80 xl:w-96">
        <div className="h-[500px] animate-pulse rounded-2xl bg-[var(--color-muted)]/10" />
      </div>
    </div>
  );
}

/* === Error ====================================================== */

function StreamJoinError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center rounded-2xl border border-red-900/40 bg-red-950/20 px-8 py-12 text-center backdrop-blur-sm">
        <span className="mb-4 text-4xl" aria-hidden="true">
          📡
        </span>
        <h2 className="mb-2 text-lg font-bold text-[var(--color-fg)]">Stream Not Found</h2>
        <p className="mb-6 text-sm text-[var(--color-muted)]">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl bg-degen-500 px-5 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400"
          >
            Try Again
          </button>
          <a
            href="/feed"
            className="rounded-xl border border-[var(--color-glass-border)] px-5 py-2.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Browse Feed
          </a>
        </div>
      </div>
    </div>
  );
}

/* === Main Component ============================================ */

export function StreamJoinView({ streamId, sourcePlatform, sourceInstance }: StreamJoinViewProps) {
  const [stream, setStream] = useState<JoinStreamData | null>(null);
  const [streamExt, setStreamExt] = useState<StreamExtended | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theaterMode, setTheaterMode] = useState(false);

  const isDegenFeed = sourcePlatform === 'degenfeed';
  const platformCfg = PLATFORM_CONFIG[sourcePlatform];

  const fetchStream = useCallback(async () => {
    if (!streamId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/streams/${streamId}`);

      if (!res.ok) {
        if (res.status === 404) {
          setError('This stream does not exist or has ended.');
        } else {
          setError(`Failed to load stream (${res.status})`);
        }
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { stream: JoinStreamData; extended?: StreamExtended };
      setStream(data.stream);
      if (data.extended) setStreamExt(data.extended);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stream');
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => {
    fetchStream();
  }, [fetchStream]);

  // Track analytics view
  useEffect(() => {
    if (!stream || loading) return;

    const referrer = typeof document !== 'undefined' ? document.referrer : '';
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

    fetch('/api/analytics/stream-view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        streamId,
        sourcePlatform,
        sourceInstance,
        referrer: referrer.slice(0, 512),
        userAgent: userAgent.slice(0, 256),
        timestamp: Date.now(),
      }),
      keepalive: true,
    }).catch(() => {
      // Analytics fire-and-forget
    });
  }, [stream, loading, streamId, sourcePlatform, sourceInstance]);

  // Build extended stream data from JoinStreamData if not provided by API
  const extendedStream = useMemo<StreamExtended | null>(() => {
    if (streamExt) return streamExt;
    if (!stream) return null;

    return {
      id: stream.id,
      title: stream.title,
      creatorId: stream.creatorId,
      creatorHandle: stream.creatorHandle,
      creatorDisplayName: stream.creatorDisplayName,
      creatorAvatar: stream.creatorAvatar,
      creatorBanner: undefined,
      category: stream.category as StreamExtended['category'],
      tags: [],
      viewerCount: stream.viewerCount,
      thumbnailUrl: stream.thumbnailUrl,
      isLive: stream.isLive,
      startedAt: Date.now(),
      description: stream.description ?? '',
      stats: {
        followers: 0,
        subscribers: 0,
        totalViews: 0,
        totalStreams: 0,
        averageViewers: 0,
        peakViewers: stream.viewerCount,
        streamingSince: new Date().toISOString(),
      },
      isFollowing: false,
      isSubscribed: false,
      latency: 'normal',
    };
  }, [stream, streamExt]);

  if (loading) return <StreamJoinSkeleton />;
  if (error || !stream) {
    return <StreamJoinError message={error ?? 'Stream not found'} onRetry={fetchStream} />;
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col">
      {/* Player + Chat row */}
      <div className={`flex flex-col ${theaterMode ? '' : 'lg:flex-row'} gap-4 p-4 pb-20 sm:pb-4`}>
        {/* Player */}
        <div className={`flex-1 ${theaterMode ? '' : 'min-w-0'}`}>
          {extendedStream && (
            <StreamPlayer
              stream={extendedStream}
              onTheaterToggle={() => setTheaterMode((v) => !v)}
              isTheater={theaterMode}
            />
          )}

          {/* Stream info bar */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold text-[var(--color-fg)] sm:text-lg truncate">
                {stream.title}
              </h1>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-fg)]/80">
                  {stream.creatorAvatar && (
                    <img
                      src={stream.creatorAvatar}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  )}
                  {stream.creatorDisplayName}
                </span>
                <span className="text-[10px] text-[var(--color-muted)]">
                  @{stream.creatorHandle}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-degen-500/15 px-2 py-0.5 text-[10px] font-medium text-degen-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-degen-400" />
                  </span>
                  {stream.viewerCount.toLocaleString()} watching
                </span>
              </div>
            </div>

            {/* Actions (desktop) */}
            <div className="hidden sm:flex shrink-0">
              <JoinActions
                creatorName={stream.creatorDisplayName}
                creatorProtocol="degenfeed"
                creatorAuthorId={stream.creatorId}
                sourcePlatform={sourcePlatform}
                entityId={streamId}
                entityType="stream"
              />
            </div>
          </div>

          {/* Guest sign-up (for anonymous viewers) */}
          {!isDegenFeed && (
            <div className="mt-4">
              <GuestSignUp sourcePlatform={sourcePlatform} compact />
            </div>
          )}

          {/* "Powered by" footer */}
          <footer className="mt-6 border-t border-[var(--color-glass-border)] py-4">
            <p className="text-center text-[11px] text-[var(--color-muted)]">
              Watching via{' '}
              <span
                className="font-medium"
                style={platformCfg ? { color: platformCfg.color } : undefined}
              >
                {platformCfg?.label ?? 'direct link'}
              </span>
              .{' '}
              <a
                href={`/register?ref=${sourcePlatform}`}
                className="font-medium text-degen-400 hover:underline"
              >
                Create your DegenFeed account
              </a>{' '}
              to go live yourself.
            </p>
          </footer>
        </div>

        {/* Chat sidebar */}
        <div className={`${theaterMode ? 'w-full' : 'w-full lg:w-80 xl:w-96'} shrink-0`}>
          <GuestChat
            streamId={streamId}
            sourcePlatform={sourcePlatform}
            sourceInstance={sourceInstance}
            compact={theaterMode}
          />
        </div>
      </div>

      {/* Mobile actions bar (fixed bottom) */}
      <div className="sm:hidden">
        <JoinActions
          creatorName={stream.creatorDisplayName}
          creatorProtocol="degenfeed"
          creatorAuthorId={stream.creatorId}
          sourcePlatform={sourcePlatform}
          entityId={streamId}
          entityType="stream"
        />
      </div>
    </div>
  );
}
