'use client';

import { getProtocolColor, getProtocolIcon, HostSpaceModal, SpaceRoom } from '@degenfeed/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────

interface SpaceSpeaker {
  id: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
  isHost: boolean;
  isCoHost: boolean;
  speaking: boolean;
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
  scheduledAt?: string;
  listeners: number;
  speakers: SpaceSpeaker[];
  reactions: SpaceReaction[];
  tipTokenAddress?: string;
  tippingEnabled: boolean;
}

// ─── Loading Skeleton ─────────────────────────────────────────────

function SpaceCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--color-muted)]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--color-muted)]" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--color-muted)]" />
          <div className="flex gap-2">
            <div className="h-5 w-14 animate-pulse rounded-full bg-[var(--color-muted)]" />
            <div className="h-5 w-14 animate-pulse rounded-full bg-[var(--color-muted)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <span className="mb-4 text-4xl opacity-30" aria-hidden="true">
        {icon}
      </span>
      <p className="text-base font-medium text-[var(--color-muted)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>
    </div>
  );
}

// ─── Time helpers ────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatScheduledDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ─── SpaceCard ────────────────────────────────────────────────────

function LiveSpaceCard({ space, onJoin }: { space: SpaceItem; onJoin: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-all hover:border-degen-500/30 hover:shadow-[0_0_16px_rgba(34,197,94,0.08)]">
      <div className="flex items-start gap-3">
        {/* Host avatar */}
        {space.hostAvatarUrl ? (
          <img
            src={space.hostAvatarUrl}
            alt={space.hostName}
            className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-sm font-bold text-[var(--color-fg)]">
            {space.hostName[0]?.toUpperCase() || '?'}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-fg)] truncate">{space.title}</h3>
            <span className="flex-shrink-0 flex items-center gap-1 rounded-full bg-degen-500/20 px-2 py-0.5 text-[10px] font-bold text-degen-400">
              <span className="h-1.5 w-1.5 rounded-full bg-degen-500 animate-pulse" />
              LIVE
            </span>
          </div>

          <p className="mt-0.5 text-xs text-gray-500">
            hosted by <span className="font-medium text-[var(--color-fg)]">{space.hostName}</span>
          </p>

          {/* Metrics */}
          <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500">
            <span>
              {space.speakers.length} speaker{space.speakers.length !== 1 ? 's' : ''}
            </span>
            <span>·</span>
            <span>
              {space.listeners} listener{space.listeners !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Protocol badges */}
          {space.protocols.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {space.protocols.map((protocol) => (
                <span
                  key={protocol}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
                  style={{
                    backgroundColor: `${getProtocolColor(protocol)}18`,
                    color: getProtocolColor(protocol),
                  }}
                >
                  <span className="text-[0.6em]">{getProtocolIcon(protocol)}</span>
                  {protocol}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onJoin(space.id)}
          className="flex-shrink-0 rounded-lg bg-degen-500/20 px-4 py-2 text-xs font-semibold text-degen-400 hover:bg-degen-500/30 transition-colors"
        >
          Join
        </button>
      </div>
    </div>
  );
}

function UpcomingSpaceCard({ space, onRSVP }: { space: SpaceItem; onRSVP: (id: string) => void }) {
  const [rsvped, setRsvped] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-start gap-3">
        {space.hostAvatarUrl ? (
          <img
            src={space.hostAvatarUrl}
            alt={space.hostName}
            className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-sm font-bold text-[var(--color-fg)]">
            {space.hostName[0]?.toUpperCase() || '?'}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--color-fg)] truncate">{space.title}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            hosted by <span className="font-medium text-[var(--color-fg)]">{space.hostName}</span>
          </p>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-cyan-400 font-medium">
              {space.scheduledAt ? formatScheduledDate(space.scheduledAt) : 'TBD'}
            </span>
          </div>

          {space.protocols.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {space.protocols.map((protocol) => (
                <span
                  key={protocol}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
                  style={{
                    backgroundColor: `${getProtocolColor(protocol)}18`,
                    color: getProtocolColor(protocol),
                  }}
                >
                  <span className="text-[0.6em]">{getProtocolIcon(protocol)}</span>
                  {protocol}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setRsvped(true);
            onRSVP(space.id);
          }}
          disabled={rsvped}
          className={`flex-shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
            rsvped
              ? 'bg-degen-500/20 text-degen-400 border border-degen-500/30'
              : 'bg-[var(--color-muted)] text-[var(--color-fg)] hover:bg-[var(--color-overlay)] border border-[var(--color-border)]'
          }`}
        >
          {rsvped ? "✓ RSVP'd" : 'RSVP'}
        </button>
      </div>
    </div>
  );
}

function _PastSpaceCard({ space }: { space: SpaceItem }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 opacity-60">
      <div className="flex items-start gap-3">
        {space.hostAvatarUrl ? (
          <img
            src={space.hostAvatarUrl}
            alt={space.hostName}
            className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-sm font-bold">
            {space.hostName[0]?.toUpperCase() || '?'}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--color-fg)] truncate">{space.title}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            hosted by {space.hostName} · {timeAgo(space.createdAt)}
          </p>
        </div>

        <span className="flex-shrink-0 rounded-full border border-[var(--color-border)] px-3 py-1 text-[10px] font-medium text-gray-500">
          Recording
        </span>
      </div>
      <p className="mt-2 text-[11px] text-gray-500 italic">Recording playback coming soon</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

export default function SpacesPage() {
  const { ready, signedInProtocols, openSignIn } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const [liveSpaces, setLiveSpaces] = useState<SpaceItem[]>([]);
  const [upcomingSpaces, setUpcomingSpaces] = useState<SpaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHostModal, setShowHostModal] = useState(false);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  // Active space data
  const activeSpace = useMemo(
    () => liveSpaces.find((s) => s.id === activeSpaceId) || null,
    [liveSpaces, activeSpaceId],
  );

  // Fetch spaces
  const fetchSpaces = useCallback(async () => {
    try {
      const [liveRes, upcomingRes] = await Promise.all([
        fetch('/api/spaces/live'),
        fetch('/api/spaces/upcoming'),
      ]);

      if (liveRes.ok) {
        const liveData = (await liveRes.json()) as { spaces: SpaceItem[] };
        setLiveSpaces(liveData.spaces);
      }
      if (upcomingRes.ok) {
        const upcomingData = (await upcomingRes.json()) as { spaces: SpaceItem[] };
        setUpcomingSpaces(upcomingData.spaces);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load spaces');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchSpaces();
    pollRef.current = setInterval(fetchSpaces, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchSpaces]);

  // Join a space
  const handleJoin = useCallback(async (id: string) => {
    try {
      await fetch(`/api/spaces/${id}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
    } catch {
      /* non-critical */
    }
    setActiveSpaceId(id);
  }, []);

  // RSVP handler (placeholder — could store in KV/user prefs)
  const handleRSVP = useCallback((_id: string) => {
    // Placeholder: could notify host, add to user calendar, etc.
  }, []);

  // Space created handler
  const handleSpaceCreated = useCallback(
    (space: { id: string; title: string; protocols: string[]; status: 'live' | 'scheduled' }) => {
      if (space.status === 'live') {
        setActiveSpaceId(space.id);
      }
      fetchSpaces();
    },
    [fetchSpaces],
  );

  // Broadcast handler
  const handleBroadcast = useCallback(async (text: string, protocols: string[]) => {
    // Reuse the publish API endpoint
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, targets: protocols }),
    });
    if (!res.ok) {
      const errData = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(errData?.error || 'Broadcast failed');
    }
  }, []);

  // If we're in a live space room
  if (activeSpace) {
    return (
      <SpaceRoom
        space={activeSpace}
        currentUserId={hasSignedIn ? 'current-user' : 'anonymous'}
        currentUserDisplayName={hasSignedIn ? 'User' : 'Guest'}
        onLeave={() => setActiveSpaceId(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-4 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-fg)]">
            <span className="mr-2">🔊</span>
            Spaces
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Live audio rooms for the open social graph</p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (hasSignedIn) {
              setShowHostModal(true);
            } else {
              openSignIn();
            }
          }}
          className="rounded-xl bg-degen-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-degen-400 transition-colors"
        >
          {hasSignedIn ? 'Start a Space' : 'Connect to Host'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SpaceCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="mb-6 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3">
          <p className="text-xs text-red-400">{error}</p>
          <button
            type="button"
            onClick={fetchSpaces}
            className="mt-2 text-xs text-red-400 underline hover:text-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {/* Live spaces */}
      {!loading && (
        <>
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-degen-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">Live Now</h2>
              {liveSpaces.length > 0 && (
                <span className="text-xs text-gray-500">({liveSpaces.length})</span>
              )}
            </div>

            {liveSpaces.length === 0 ? (
              <EmptyState
                icon="🎙️"
                title="No live spaces right now"
                subtitle="Start one or check back later"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {liveSpaces.map((space) => (
                  <LiveSpaceCard key={space.id} space={space} onJoin={handleJoin} />
                ))}
              </div>
            )}
          </section>

          {/* Upcoming spaces */}
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm">📅</span>
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">Upcoming</h2>
              {upcomingSpaces.length > 0 && (
                <span className="text-xs text-gray-500">({upcomingSpaces.length})</span>
              )}
            </div>

            {upcomingSpaces.length === 0 ? (
              <EmptyState
                icon="🗓️"
                title="No upcoming spaces"
                subtitle="Schedule one to get started"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingSpaces.map((space) => (
                  <UpcomingSpaceCard key={space.id} space={space} onRSVP={handleRSVP} />
                ))}
              </div>
            )}
          </section>

          {/* Past spaces — placeholder section */}
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm">📼</span>
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">Past Spaces</h2>
            </div>

            <EmptyState
              icon="📼"
              title="No past spaces yet"
              subtitle="Recording playback is coming soon"
            />
          </section>
        </>
      )}

      {/* Host modal */}
      {hasSignedIn && (
        <HostSpaceModal
          open={showHostModal}
          onClose={() => setShowHostModal(false)}
          signedInProtocols={signedInProtocols}
          hostId={hasSignedIn ? 'current-user' : ''}
          hostName="User"
          onSpaceCreated={handleSpaceCreated}
          onBroadcast={handleBroadcast}
        />
      )}

      {/* Bottom spacing for mobile nav */}
      <div className="h-16 lg:hidden" />
    </div>
  );
}
