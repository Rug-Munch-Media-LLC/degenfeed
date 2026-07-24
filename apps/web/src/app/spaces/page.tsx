'use client';

import { HostSpaceModal, SpaceRoom } from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { ANIM_STYLES, LiveDot, SpacesIcon } from './_animations';
import {
  ContentTypeBadge,
  EmptyState,
  GridSkeleton,
  LiveSkeleton,
  LiveSpaceCard,
  PastSpaceCard,
  SectionHeader,
  UpcomingSpaceCard,
} from './_components';
import type { SpaceContentType, SpaceItem } from './_types';

const TipModal = dynamic(
  () => import('../../components/TipModal').then((m) => ({ default: m.TipModal })),
  { ssr: false, loading: () => null },
);

export default function SpacesPage() {
  const { ready, signedInProtocols, openSignIn } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const [liveSpaces, setLiveSpaces] = useState<SpaceItem[]>([]);
  const [upcomingSpaces, setUpcomingSpaces] = useState<SpaceItem[]>([]);
  const [pastSpaces, setPastSpaces] = useState<SpaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHostModal, setShowHostModal] = useState(false);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [tipSpace, setTipSpace] = useState<SpaceItem | null>(null);
  const [contentTypeFilter, setContentTypeFilter] = useState<SpaceContentType | 'all'>('all');
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  const activeSpace = useMemo(
    () => liveSpaces.find((s) => s.id === activeSpaceId) || null,
    [liveSpaces, activeSpaceId],
  );

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
      const pastRes = await fetch('/api/spaces/past').catch(() => null);
      if (pastRes?.ok) {
        const pastData = (await pastRes.json()) as { spaces: SpaceItem[] };
        setPastSpaces(pastData.spaces);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load spaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpaces();
    pollRef.current = setInterval(fetchSpaces, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchSpaces]);

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

  const handleReminder = useCallback((_id: string) => {
    // Could integrate with calendar/notification system
  }, []);

  const handleSpaceCreated = useCallback(
    (space: { id: string; title: string; protocols: string[]; status: 'live' | 'scheduled' }) => {
      if (space.status === 'live') setActiveSpaceId(space.id);
      fetchSpaces();
    },
    [fetchSpaces],
  );

  const handleBroadcast = useCallback(async (text: string, protocols: string[]) => {
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

  // Filter live spaces by content type
  const filteredLiveSpaces = useMemo(() => {
    if (contentTypeFilter === 'all') return liveSpaces;
    return liveSpaces.filter((s) => s.contentType === contentTypeFilter);
  }, [liveSpaces, contentTypeFilter]);

  // Live Space Room
  if (activeSpace) {
    return (
      <>
        <style>{ANIM_STYLES}</style>
        <SpaceRoom
          space={activeSpace}
          currentUserId={hasSignedIn ? 'current-user' : 'anonymous'}
          currentUserDisplayName={hasSignedIn ? 'User' : 'Guest'}
          onLeave={() => setActiveSpaceId(null)}
        />
      </>
    );
  }

  return (
    <>
      <style>{ANIM_STYLES}</style>
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-degen-500/20 bg-degen-500/10">
              <SpacesIcon />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[var(--color-fg)]">
                Audio Spaces
              </h1>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Live audio, video & photos across the open social graph
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (hasSignedIn) setShowHostModal(true);
                else openSignIn();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-degen-500 px-5 py-2.5 text-sm font-bold text-black transition-all duration-200 hover:bg-degen-400 hover:shadow-[0_0_20px_rgba(0,255,65,0.3)] active:scale-[0.97]"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {hasSignedIn ? 'Go Live' : 'Connect to Host'}
            </button>
            <a
              href="/spaces/live"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] transition-all hover:border-degen-500/30 hover:text-degen-400"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              All Live
            </a>
          </div>
        </header>

        {/* Loading */}
        {loading && (
          <div className="space-y-8">
            <section>
              <SectionHeader icon={<LiveDot />} title="Live Now" />
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                {Array.from({ length: 4 }).map((_, i) => (
                  <LiveSkeleton key={i} />
                ))}
              </div>
            </section>
            <section>
              <SectionHeader icon={<span className="text-sm">📅</span>} title="Upcoming" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <GridSkeleton key={i} />
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="mb-6 rounded-2xl border border-red-900/40 bg-red-950/20 px-5 py-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="text-lg text-red-400" aria-hidden="true">
                ⚠
              </span>
              <p className="text-sm text-red-400">{error}</p>
              <button
                type="button"
                onClick={fetchSpaces}
                className="ml-auto rounded-lg border border-red-900/40 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/30"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && (
          <div className="space-y-10">
            {/* Live Now */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <LiveDot />
                <h2 className="text-sm font-bold tracking-tight text-[var(--color-fg)]">
                  Live Now
                </h2>
                {filteredLiveSpaces.length > 0 && (
                  <>
                    <span className="rounded-full bg-[var(--color-muted)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
                      {filteredLiveSpaces.length}
                    </span>
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-degen-500">
                      LIVE
                    </span>
                  </>
                )}
              </div>

              {/* Content type filter for live */}
              <div className="mb-4 flex flex-wrap gap-2">
                {(['all', 'audio', 'video', 'photos'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setContentTypeFilter(type)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                      contentTypeFilter === type
                        ? 'border border-degen-500/40 bg-degen-500/10 text-degen-400'
                        : 'border border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                    }`}
                  >
                    {type === 'all'
                      ? '🔴 All'
                      : type === 'audio'
                        ? '🎙️ Audio'
                        : type === 'video'
                          ? '📺 Video'
                          : '📸 Photos'}
                  </button>
                ))}
              </div>

              {filteredLiveSpaces.length === 0 ? (
                <EmptyState
                  icon="🎙️"
                  title={
                    contentTypeFilter !== 'all'
                      ? `No live ${contentTypeFilter} right now`
                      : 'No live content right now'
                  }
                  subtitle={
                    contentTypeFilter !== 'all'
                      ? 'Try switching to All or check back later'
                      : 'Start a space, go live on video, or share a live photo!'
                  }
                  action={
                    hasSignedIn
                      ? { label: 'Go Live', onClick: () => setShowHostModal(true) }
                      : undefined
                  }
                />
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory">
                  {filteredLiveSpaces.map((space) => (
                    <LiveSpaceCard
                      key={space.id}
                      space={space}
                      onJoin={handleJoin}
                      onTip={setTipSpace}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Upcoming */}
            <section>
              <SectionHeader
                icon={
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                    className="text-cyan-400"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                }
                title="Upcoming"
                count={upcomingSpaces.length}
              />
              {upcomingSpaces.length === 0 ? (
                <EmptyState
                  icon="🗓️"
                  title="No upcoming content"
                  subtitle="Schedule something to get started."
                  action={
                    hasSignedIn
                      ? { label: 'Schedule', onClick: () => setShowHostModal(true) }
                      : undefined
                  }
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {upcomingSpaces.map((space) => (
                    <UpcomingSpaceCard
                      key={space.id}
                      space={space}
                      onReminder={handleReminder}
                      onTip={setTipSpace}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Recent */}
            <section>
              <SectionHeader
                icon={
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                    className="text-[var(--color-muted)]"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                }
                title="Recent"
                count={pastSpaces.length}
              />
              {pastSpaces.length === 0 ? (
                <EmptyState
                  icon="📼"
                  title="No past content yet"
                  subtitle="Recording playback will appear here once content ends."
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pastSpaces.map((space) => (
                    <PastSpaceCard key={space.id} space={space} />
                  ))}
                </div>
              )}
            </section>
          </div>
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

        {/* Tip modal */}
        {tipSpace && (
          <TipModal
            open={!!tipSpace}
            onClose={() => setTipSpace(null)}
            recipientProtocol={tipSpace.protocols?.[0] ?? 'ethereum'}
            recipientAuthorId={tipSpace.hostId}
            recipientDisplayName={tipSpace.hostName}
          />
        )}

        <div className="h-20 lg:hidden" />
      </div>
    </>
  );
}
