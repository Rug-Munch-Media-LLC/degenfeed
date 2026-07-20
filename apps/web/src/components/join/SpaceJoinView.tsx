'use client';

/**
 * @components/join/SpaceJoinView — Full space join experience.
 *
 * Renders the space stage (speaker avatars), listener grid, reactions,
 * and actions for anonymous viewers arriving from external platforms.
 * Listeners can join without an account; speaking requires sign-up.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SpaceStage } from '../spaces/SpaceStage';
import { SpaceListeners } from '../spaces/SpaceListeners';
import { SpaceReactions } from '../spaces/SpaceReactions';
import { PLATFORM_CONFIG, type JoinSpaceData, type SourcePlatform } from './types';
import { JoinActions } from './JoinActions';
import { GuestSignUp } from './GuestSignUp';

/* ─── Props ────────────────────────────────────────────────────── */

interface SpaceJoinViewProps {
  spaceId: string;
  sourcePlatform: SourcePlatform;
  sourceInstance?: string;
}

/* ─── Skeleton ─────────────────────────────────────────────────── */

function SpaceJoinSkeleton() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col p-4">
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-wrap justify-center gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="h-20 w-20 animate-pulse rounded-full bg-[var(--color-muted)]/20" />
                <div className="h-3 w-16 animate-pulse rounded bg-[var(--color-muted)]/15" />
              </div>
            ))}
          </div>
          <div className="h-4 w-48 animate-pulse rounded bg-[var(--color-muted)]/10" />
        </div>
      </div>
    </div>
  );
}

/* ─── Error ────────────────────────────────────────────────────── */

function SpaceJoinError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg flex-col items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center rounded-2xl border border-red-900/40 bg-red-950/20 px-8 py-12 text-center backdrop-blur-sm">
        <span className="mb-4 text-4xl" aria-hidden="true">
          🎙️
        </span>
        <h2 className="mb-2 text-lg font-bold text-[var(--color-fg)]">Space Not Found</h2>
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
            href="/spaces"
            className="rounded-xl border border-[var(--color-glass-border)] px-5 py-2.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Browse Spaces
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────── */

export function SpaceJoinView({
  spaceId,
  sourcePlatform,
  sourceInstance: _sourceInstance,
}: SpaceJoinViewProps) {
  const [space, setSpace] = useState<JoinSpaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [requestsToSpeak, setRequestsToSpeak] = useState(false);

  const isDegenFeed = sourcePlatform === 'degenfeed';
  const platformCfg = PLATFORM_CONFIG[sourcePlatform];

  // Fetch space data
  const fetchSpace = useCallback(async () => {
    if (!spaceId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/spaces/${spaceId}`);

      if (!res.ok) {
        if (res.status === 404) {
          setError('This space does not exist or has expired.');
        } else {
          setError(`Failed to load space (${res.status})`);
        }
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { space: JoinSpaceData };
      setSpace(data.space);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load space');
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    fetchSpace();
  }, [fetchSpace]);

  // Track analytics view
  useEffect(() => {
    if (!space || loading) return;

    const referrer = typeof document !== 'undefined' ? document.referrer : '';
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

    fetch('/api/analytics/stream-view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        streamId: spaceId,
        sourcePlatform,
        referrer: referrer.slice(0, 512),
        userAgent: userAgent.slice(0, 256),
        timestamp: Date.now(),
      }),
      keepalive: true,
    }).catch(() => {
      // Analytics fire-and-forget
    });
  }, [space, loading, spaceId, sourcePlatform]);

  // Join as listener (no account needed)
  const handleJoinAsListener = useCallback(async () => {
    setHasJoined(true);

    try {
      await fetch(`/api/spaces/${spaceId}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ asSpeaker: false }),
      });
    } catch {
      // Silent — still show as joined
    }
  }, [spaceId]);

  // Request to speak (requires at least guest identity)
  const handleRequestToSpeak = useCallback(async () => {
    if (!isDegenFeed) {
      // Need to sign up first for speaking
      setRequestsToSpeak(true);
      return;
    }

    try {
      await fetch(`/api/spaces/${spaceId}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ asSpeaker: true }),
      });
      setRequestsToSpeak(true);
    } catch {
      // Silent
    }
  }, [spaceId, isDegenFeed]);

  // Handle reaction
  const handleSendReaction = useCallback(
    async (emoji: string) => {
      try {
        await fetch(`/api/spaces/${spaceId}/react`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ emoji }),
        });
      } catch {
        // Silent
      }
    },
    [spaceId],
  );

  const handleTip = useCallback(
    (_spaceId: string, _speakerId?: string) => {
      // Tip is handled by JoinActions via the TipModal
    },
    [],
  );

  // Guest identity for reactions
  const guestUserId = useMemo(
    () =>
      typeof window !== 'undefined'
        ? `guest-${Date.now().toString(36)}`
        : 'guest-anonymous',
    [],
  );

  if (loading) return <SpaceJoinSkeleton />;
  if (error || !space) {
    return <SpaceJoinError message={error ?? 'Space not found'} onRetry={fetchSpace} />;
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col pb-20 sm:pb-4">
      {/* Sticky header */}
      <div className="sticky top-16 z-30 border-b border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="rounded-md bg-degen-500/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-degen-400">
              <span className="relative flex h-1.5 w-1.5 items-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-degen-400" />
              </span>
              {' LIVE'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold text-[var(--color-fg)]">{space.title}</h1>
            <p className="truncate text-[11px] text-[var(--color-muted)]">
              Hosted by {space.hostName} &middot; {space.listeners} listening
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-6 p-4">
        {/* Space Stage */}
        <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6">
          <SpaceStage
            speakers={space.speakers}
            currentUserId={guestUserId}
            onTip={handleTip}
            tippingEnabled={space.tippingEnabled}
          />
        </div>

        {/* Listeners */}
        <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
          <SpaceListeners
            speakers={space.speakers}
            listenerCount={space.listeners}
            handRaised={[]}
            isHost={false}
            currentUserId={guestUserId}
          />
        </div>

        {/* Join controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {!hasJoined ? (
            <button
              type="button"
              onClick={handleJoinAsListener}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-degen-500/30 bg-degen-500/10 px-6 py-3 text-sm font-semibold text-degen-400 transition-all hover:bg-degen-500/20 active:scale-[0.98]"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Listen (no account needed)
            </button>
          ) : (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-degen-500/20 bg-degen-500/5 px-6 py-3 text-sm font-medium text-degen-400">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              You&apos;re listening
            </div>
          )}

          {!requestsToSpeak && (
            <button
              type="button"
              onClick={handleRequestToSpeak}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-6 py-3 text-sm font-medium text-[var(--color-fg)] transition-all hover:border-[var(--color-border)] active:scale-[0.98]"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              {isDegenFeed ? 'Request to Speak' : 'Request to Speak (free sign-up)'}
            </button>
          )}

          {requestsToSpeak && (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-6 py-3 text-sm font-medium text-amber-400">
              <span className="animate-pulse" aria-hidden="true">
                ✋
              </span>
              Request sent — waiting for host
            </div>
          )}
        </div>

        {/* Sign-up prompt for speaking (anonymous users) */}
        {requestsToSpeak && !isDegenFeed && (
          <div className="rounded-2xl border border-amber-500/10 bg-amber-500/[0.03] p-4">
            <p className="mb-3 text-sm font-medium text-[var(--color-fg)]">
              Create a free account to speak in this space
            </p>
            <GuestSignUp
              sourcePlatform={sourcePlatform}
              compact
              onComplete={() => {
                setRequestsToSpeak(false);
                handleJoinAsListener();
              }}
            />
          </div>
        )}

        {/* Reactions */}
        {hasJoined && (
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Reactions
            </h3>
            <SpaceReactions
              spaceId={spaceId}
              reactions={space.reactions}
              currentUserId={guestUserId}
              onSendReaction={handleSendReaction}
            />
          </div>
        )}

        {/* Actions */}
        <JoinActions
          creatorName={space.hostName}
          creatorProtocol="degenfeed"
          creatorAuthorId={space.hostId}
          sourcePlatform={sourcePlatform}
          entityId={spaceId}
          entityType="space"
          tipEnabled={space.tippingEnabled}
        />

        {/* Sign-up CTA for anonymous */}
        {!isDegenFeed && (
          <div className="mt-2">
            <GuestSignUp sourcePlatform={sourcePlatform} />
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-[var(--color-glass-border)] py-4">
          <p className="text-center text-[11px] text-[var(--color-muted)]">
            Listening via{' '}
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
            to host your own spaces.
          </p>
        </footer>
      </div>
    </div>
  );
}
