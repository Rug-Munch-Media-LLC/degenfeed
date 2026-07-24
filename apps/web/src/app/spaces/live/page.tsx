'use client';

import { SpaceRoom } from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { ANIM_STYLES, LiveDot, SpacesIcon } from '../_animations';
import { EmptyState, LiveSkeleton, LiveSpaceCard, SectionHeader } from '../_components';
import type { SpaceItem } from '../_types';

const TipModal = dynamic(
  () => import('../../../components/TipModal').then((m) => ({ default: m.TipModal })),
  { ssr: false, loading: () => null },
);

// ─── Platform filter chips ─────────────────────────────────────────────

type PlatformFilter = 'all' | 'nostr' | 'peertube' | 'owncast' | 'livepeer';

const PLATFORM_CHIPS: { id: PlatformFilter; label: string; color: string }[] = [
  { id: 'all', label: 'All', color: '' },
  { id: 'nostr', label: 'Nostr', color: '#8b5cf6' },
  { id: 'peertube', label: 'PeerTube', color: '#f97316' },
  { id: 'owncast', label: 'Owncast', color: '#06b6d4' },
  { id: 'livepeer', label: 'LivePeer', color: '#10b981' },
];

export default function LiveSpacesPage() {
  const { ready, signedInProtocols, openSignIn } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const [spaces, setSpaces] = useState<SpaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [tipSpace, setTipSpace] = useState<SpaceItem | null>(null);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  const activeSpace = useMemo(
    () => spaces.find((s) => s.id === activeSpaceId) || null,
    [spaces, activeSpaceId],
  );

  // ─── Filtered spaces ────────────────────────────────────────────

  const filteredSpaces = useMemo(() => {
    if (platformFilter === 'all') return spaces;
    return spaces.filter((s) => s.platforms?.some((p) => p.platform === platformFilter));
  }, [spaces, platformFilter]);

  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = { all: spaces.length };
    for (const chip of PLATFORM_CHIPS) {
      if (chip.id !== 'all') {
        counts[chip.id] = spaces.filter((s) =>
          s.platforms?.some((p) => p.platform === chip.id),
        ).length;
      }
    }
    return counts;
  }, [spaces]);

  // ─── Fetch from ALL platforms ───────────────────────────────────

  const fetchLiveSpaces = useCallback(async () => {
    try {
      const res = await fetch('/api/spaces/all');
      if (res.ok) {
        const data = (await res.json()) as { spaces: SpaceItem[] };
        setSpaces(data.spaces);
      } else {
        // Fallback: try the legacy endpoint
        const legacyRes = await fetch('/api/spaces/live');
        if (legacyRes.ok) {
          const legacyData = (await legacyRes.json()) as { spaces: SpaceItem[] };
          setSpaces(legacyData.spaces);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load spaces');
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }, []);

  useEffect(() => {
    fetchLiveSpaces();
    pollRef.current = setInterval(fetchLiveSpaces, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchLiveSpaces]);

  // ─── Actions ────────────────────────────────────────────────────

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

  const refreshNow = useCallback(() => {
    setLoading(true);
    fetchLiveSpaces();
  }, [fetchLiveSpaces]);

  // ─── Live Space Room ────────────────────────────────────────────
  if (activeSpace) {
    return (
      <>
        <style>{ANIM_STYLES}</style>
        <SpaceRoom
          space={activeSpace}
          currentUserId={hasSignedIn ? 'current-user' : 'anonymous'}
          currentUserDisplayName={hasSignedIn ? 'User' : 'Guest'}
          onLeave={() => {
            setActiveSpaceId(null);
            // Refresh to get updated state
            fetchLiveSpaces();
          }}
        />
      </>
    );
  }

  // ─── Main View ──────────────────────────────────────────────────
  return (
    <>
      <style>{ANIM_STYLES}</style>
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-degen-500/20 bg-degen-500/10">
              <SpacesIcon />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[var(--color-fg)]">
                Live Spaces
              </h1>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Audio rooms across Nostr · PeerTube · Owncast · LivePeer
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Refresh button */}
            <button
              type="button"
              onClick={refreshNow}
              disabled={loading}
              className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2 text-xs font-medium text-[var(--color-muted)] transition-all hover:border-degen-500/30 hover:text-degen-400 disabled:opacity-50"
              aria-label="Refresh spaces"
            >
              <span className={`inline-block ${loading ? 'animate-spin' : ''}`}>↻</span>
              <span className="ml-1.5 hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        {/* Platform filter chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          {PLATFORM_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setPlatformFilter(chip.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                platformFilter === chip.id
                  ? 'border border-degen-500/40 bg-degen-500/10 text-degen-400'
                  : 'border border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              {chip.label}
              <span className="rounded-full bg-[var(--color-muted)]/15 px-1.5 py-0.5 text-[9px]">
                {platformCounts[chip.id] ?? 0}
              </span>
            </button>
          ))}
          <span className="ml-auto self-center text-[10px] text-[var(--color-muted)]">
            {lastRefresh ? `Updated ${timeAgo(lastRefresh)}` : ''}
          </span>
        </div>

        {/* Loading */}
        {loading && <SectionHeader icon={<LiveDot />} title="Loading live spaces..." />}
        {loading && (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
            {Array.from({ length: 4 }).map((_, i) => (
              <LiveSkeleton key={i} />
            ))}
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
                onClick={refreshNow}
                className="ml-auto rounded-lg border border-red-900/40 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/30"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Spaces grid */}
        {!loading && (
          <>
            {filteredSpaces.length === 0 ? (
              <EmptyState
                icon="🎙️"
                title={
                  platformFilter !== 'all'
                    ? `No live spaces on ${platformFilter}`
                    : 'No live spaces right now'
                }
                subtitle={
                  platformFilter !== 'all'
                    ? 'Try switching to All or check back later'
                    : 'Start one from the Spaces page or check back later'
                }
              />
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory">
                {filteredSpaces.map((space) => (
                  <LiveSpaceCard
                    key={space.id}
                    space={space}
                    onJoin={handleJoin}
                    onTip={setTipSpace}
                  />
                ))}
              </div>
            )}

            {/* Platform summary */}
            {!loading && spaces.length > 0 && (
              <div className="mt-6 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)]/30 px-5 py-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                  Platform Distribution
                </h3>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(platformCounts)
                    .filter(([k]) => k !== 'all')
                    .map(([platform, count]) => {
                      const chip = PLATFORM_CHIPS.find((c) => c.id === platform);
                      if (!chip || count === 0) return null;
                      return (
                        <div key={platform} className="flex items-center gap-2 text-xs">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: chip.color }}
                          />
                          <span className="text-[var(--color-fg)]">{chip.label}</span>
                          <span className="text-[var(--color-muted)]">{count} live</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Tip modal */}
        {tipSpace && (
          <TipModal
            open={!!tipSpace}
            onClose={() => setTipSpace(null)}
            recipientProtocol={tipSpace.platforms?.[0]?.platform ?? 'ethereum'}
            recipientAuthorId={tipSpace.hostId}
            recipientDisplayName={tipSpace.hostName}
          />
        )}

        <div className="h-20 lg:hidden" />
      </div>
    </>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
