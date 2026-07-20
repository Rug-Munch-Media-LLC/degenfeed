'use client';

import { SpaceRoom } from '@degenfeed/ui';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────

interface SpaceSpeaker {
  id: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
  isHost: boolean;
  isCoHost: boolean;
  speaking: boolean;
  muted: boolean;
  joinedAt: number;
}

interface SpaceReaction {
  userId: string;
  emoji: string;
  createdAt: number;
}

interface SpaceItem {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  coHosts: string[];
  protocols: string[];
  status: 'live' | 'scheduled' | 'ended';
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  scheduledAt?: string;
  listeners: number;
  maxSpeakers: number;
  speakers: SpaceSpeaker[];
  reactions: SpaceReaction[];
  tipTokenAddress?: string;
  tippingEnabled: boolean;
  isRecorded: boolean;
  recording?: { url?: string; duration?: number };
  summary?: string;
  transcript?: string;
}

// ─── Loading State ────────────────────────────────────────────────

function RoomSkeleton() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col">
      {/* Header */}
      <div className="sticky top-16 z-30 border-b border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="h-8 w-16 animate-pulse rounded-lg bg-[var(--color-muted)]/20" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-48 animate-pulse rounded bg-[var(--color-muted)]/20" />
            <div className="h-3 w-32 animate-pulse rounded bg-[var(--color-muted)]/15" />
          </div>
        </div>
      </div>
      {/* Stage */}
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

// ─── Error State ─────────────────────────────────────────────────

function RoomError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center rounded-2xl border border-red-900/40 bg-red-950/20 px-8 py-12 text-center backdrop-blur-sm">
        <span className="mb-4 text-4xl" aria-hidden="true">
          🎙️
        </span>
        <h2 className="mb-2 text-lg font-bold text-[var(--color-fg)]">Space Not Found</h2>
        <p className="mb-6 text-sm text-[var(--color-muted)]">{error}</p>
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

// ─── Main Page ────────────────────────────────────────────────────

export default function SpaceRoomPage() {
  const params = useParams();
  const spaceId = params?.id as string;
  const { ready, signedInProtocols } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const [space, setSpace] = useState<SpaceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchSpace = useCallback(async () => {
    if (!spaceId) return;
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
      const data = (await res.json()) as { space: SpaceItem };
      setSpace(data.space);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load space');
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    fetchSpace();
    // Poll for live updates
    pollRef.current = setInterval(fetchSpace, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchSpace]);

  const handleLeave = useCallback(() => {
    if (space?.status === 'live') {
      fetch(`/api/spaces/${spaceId}/leave`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }).catch(() => {});
    }
    window.history.pushState(null, '', '/spaces');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [spaceId, space]);

  const handleTip = useCallback(
    (_spaceId: string, _speakerId?: string) => {
      // Tip integration
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: { kind: 'info', message: 'Tipping coming soon in Spaces' },
        }),
      );
    },
    [],
  );

  // ─── Loading ──
  if (loading) return <RoomSkeleton />;

  // ─── Error ──
  if (error) return <RoomError error={error} onRetry={fetchSpace} />;

  // ─── Not found ──
  if (!space) {
    return (
      <RoomError
        error="This space could not be found. It may have been removed or expired."
        onRetry={fetchSpace}
      />
    );
  }

  // ─── Ended state ──
  if (space.status === 'ended') {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col items-center justify-center px-4">
        <div className="flex max-w-md flex-col items-center rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-8 py-12 text-center">
          <span className="mb-4 text-5xl" aria-hidden="true">
            📼
          </span>
          <h2 className="mb-2 text-lg font-bold text-[var(--color-fg)]">Space Ended</h2>
          <p className="mb-1 text-sm font-medium text-[var(--color-fg)]">{space.title}</p>
          <p className="mb-6 text-xs text-[var(--color-muted)]">
            Hosted by {space.hostName}
            {space.endedAt && space.startedAt && (
              <>
                {' · '}
                {Math.floor((space.endedAt - space.startedAt) / 60000)} minutes
              </>
            )}
          </p>

          {space.recording?.url ? (
            <a
              href={space.recording.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-degen-500 px-5 py-3 text-sm font-bold text-black transition-all hover:bg-degen-400"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Play Recording
            </a>
          ) : (
            <p className="mb-3 text-xs text-[var(--color-muted)]">No recording available</p>
          )}

          <a
            href="/spaces"
            className="w-full rounded-xl border border-[var(--color-glass-border)] px-5 py-2.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Browse Live Spaces
          </a>

          {space.summary && (
            <div className="mt-6 w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)]/50 p-4 text-left">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Summary
              </h3>
              <p className="text-sm text-[var(--color-fg)]">{space.summary}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Live / Scheduled — use SpaceRoom ──
  return (
    <SpaceRoom
      space={{
        ...space,
        // Map speakers to the format SpaceRoom expects
        speakers: space.speakers.map((s) => ({
          id: s.id,
          displayName: s.displayName,
          avatarUrl: s.avatarUrl,
          handle: s.handle,
          isHost: s.isHost,
          isCoHost: s.isCoHost,
          speaking: s.speaking,
        })),
      }}
      currentUserId={hasSignedIn ? 'current-user' : 'anonymous'}
      currentUserDisplayName={hasSignedIn ? 'User' : 'Guest'}
      onLeave={handleLeave}
      onTip={handleTip}
    />
  );
}
