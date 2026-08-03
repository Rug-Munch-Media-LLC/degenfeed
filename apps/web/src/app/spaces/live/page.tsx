'use client';

import { SpaceRoom } from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { ANIM_STYLES, LiveDot, SpacesIcon } from '../_animations';
import {
  ContentTypeBadge,
  EmptyState,
  LiveSkeleton,
  LiveSpaceCard,
  SectionHeader,
} from '../_components';
import type { SpaceContentType, SpaceItem, SpacePlatform } from '../_types';

const TipModal = dynamic(
  () => import('../../../components/TipModal').then((m) => ({ default: m.TipModal })),
  { ssr: false, loading: () => null },
);

// ─── Platform filter chips (ALL platforms) ────────────────────────────

type PlatformFilter = 'all' | SpacePlatform;

const PLATFORM_CHIPS: { id: PlatformFilter; label: string; color: string; group: string }[] = [
  // Audio
  { id: 'all', label: 'All', color: '', group: '' },
  { id: 'nostr', label: 'Nostr', color: '#8b5cf6', group: 'audio' },
  { id: 'peertube', label: 'PeerTube', color: '#f97316', group: 'audio' },
  { id: 'owncast', label: 'Owncast', color: '#06b6d4', group: 'audio' },
  { id: 'livepeer', label: 'LivePeer', color: '#10b981', group: 'audio' },
  // Video
  { id: 'youtube', label: 'YouTube', color: '#ff0000', group: 'video' },
  { id: 'twitch', label: 'Twitch', color: '#9146ff', group: 'video' },
  { id: 'kick', label: 'Kick', color: '#53fc18', group: 'video' },
  // Photos
  { id: 'nostr-pictures', label: 'Nostr Pic', color: '#8b5cf6', group: 'photos' },
  { id: 'bluesky-photos', label: 'Bsky Pic', color: '#1185fe', group: 'photos' },
  { id: 'pixelfed', label: 'Pixelfed', color: '#ff0066', group: 'photos' },
];

// ─── Content type tabs ────────────────────────────────────────────────

type ContentTypeFilter = 'all' | SpaceContentType;

const CONTENT_TYPE_TABS: { id: ContentTypeFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'All Live', icon: '🔴' },
  { id: 'audio', label: 'Audio Spaces', icon: '🎙️' },
  { id: 'video', label: 'Video Streams', icon: '📺' },
  { id: 'photos', label: 'Live Photos', icon: '📸' },
];

// ─── Main Component ───────────────────────────────────────────────────

export default function LiveSpacesPage() {
  const { ready, signedInProtocols, openSignIn } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const [spaces, setSpaces] = useState<SpaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [tipSpace, setTipSpace] = useState<SpaceItem | null>(null);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>('all');
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  const activeSpace = useMemo(
    () => spaces.find((s) => s.id === activeSpaceId) || null,
    [spaces, activeSpaceId],
  );

  // ─── Filters ─────────────────────────────────────────────────────

  const filteredSpaces = useMemo(() => {
    let result = spaces;

    // Content type filter
    if (contentTypeFilter !== 'all') {
      result = result.filter((s) => s.contentType === contentTypeFilter);
    }

    // Platform filter
    if (platformFilter !== 'all') {
      result = result.filter((s) => s.platforms?.some((p) => p.platform === platformFilter));
    }

    return result;
  }, [spaces, platformFilter, contentTypeFilter]);

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

  const contentTypeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: spaces.length };
    for (const tab of CONTENT_TYPE_TABS) {
      if (tab.id !== 'all') {
        counts[tab.id] = spaces.filter((s) => s.contentType === tab.id).length;
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
        const legacyRes = await fetch('/api/spaces/live');
        if (legacyRes.ok) {
          const legacyData = (await legacyRes.json()) as { spaces: SpaceItem[] };
          setSpaces(legacyData.spaces);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
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
            fetchLiveSpaces();
          }}
        />
      </>
    );
  }

  // ─── Main View: Unified Live Hub ─────────────────────────────────
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
              <h1 className="text-lg font-bold tracking-tight text-[var(--color-fg)]">Live Hub</h1>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Audio · Video · Photos — across{' '}
                <span className="font-medium text-[var(--color-fg)]">all platforms</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Go Live button */}
            <button
              type="button"
              onClick={() => {
                if (hasSignedIn) window.location.href = '/spaces';
                else openSignIn();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-degen-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_16px_rgba(0,255,65,0.2)] active:scale-[0.97]"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Go Live
            </button>
            {/* Refresh */}
            <button
              type="button"
              onClick={refreshNow}
              disabled={loading}
              className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2 text-xs font-medium text-[var(--color-muted)] transition-all hover:border-degen-500/30 hover:text-degen-400 disabled:opacity-50"
              aria-label="Refresh"
            >
              <span className={`inline-block ${loading ? 'animate-spin' : ''}`}>↻</span>
            </button>
          </div>
        </header>

        {/* Content Type Tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {CONTENT_TYPE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setContentTypeFilter(tab.id);
                setPlatformFilter('all');
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                contentTypeFilter === tab.id
                  ? 'border border-degen-500/40 bg-degen-500/10 text-degen-400'
                  : 'border border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              <span className="rounded-full bg-[var(--color-muted)]/15 px-1.5 py-0.5 text-[9px]">
                {contentTypeCounts[tab.id] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Platform filter chips (grouped) */}
        <div className="mb-6">
          {/* Audio platforms */}
          {contentTypeFilter === 'all' || contentTypeFilter === 'audio' ? (
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="self-center text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Audio
              </span>
              {PLATFORM_CHIPS.filter((c) => c.group === 'audio').map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setPlatformFilter(chip.id === platformFilter ? 'all' : chip.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium transition-all ${
                    platformFilter === chip.id
                      ? 'border opacity-100'
                      : 'border border-[var(--color-glass-border)] opacity-50 hover:opacity-80'
                  }`}
                  style={{
                    borderColor: platformFilter === chip.id ? chip.color : undefined,
                    color: platformFilter === chip.id ? chip.color : 'var(--color-muted)',
                    backgroundColor: platformFilter === chip.id ? `${chip.color}15` : 'transparent',
                  }}
                >
                  {chip.label}
                  <span className="rounded-full bg-[var(--color-muted)]/15 px-1.5 py-0.5 text-[8px]">
                    {platformCounts[chip.id] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {/* Video platforms */}
          {contentTypeFilter === 'all' || contentTypeFilter === 'video' ? (
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="self-center text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Video
              </span>
              {PLATFORM_CHIPS.filter((c) => c.group === 'video').map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setPlatformFilter(chip.id === platformFilter ? 'all' : chip.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium transition-all ${
                    platformFilter === chip.id
                      ? 'border opacity-100'
                      : 'border border-[var(--color-glass-border)] opacity-50 hover:opacity-80'
                  }`}
                  style={{
                    borderColor: platformFilter === chip.id ? chip.color : undefined,
                    color: platformFilter === chip.id ? chip.color : 'var(--color-muted)',
                    backgroundColor: platformFilter === chip.id ? `${chip.color}15` : 'transparent',
                  }}
                >
                  {chip.label}
                  <span className="rounded-full bg-[var(--color-muted)]/15 px-1.5 py-0.5 text-[8px]">
                    {platformCounts[chip.id] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {/* Photo platforms */}
          {contentTypeFilter === 'all' || contentTypeFilter === 'photos' ? (
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="self-center text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Photos
              </span>
              {PLATFORM_CHIPS.filter((c) => c.group === 'photos').map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setPlatformFilter(chip.id === platformFilter ? 'all' : chip.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium transition-all ${
                    platformFilter === chip.id
                      ? 'border opacity-100'
                      : 'border border-[var(--color-glass-border)] opacity-50 hover:opacity-80'
                  }`}
                  style={{
                    borderColor: platformFilter === chip.id ? chip.color : undefined,
                    color: platformFilter === chip.id ? chip.color : 'var(--color-muted)',
                    backgroundColor: platformFilter === chip.id ? `${chip.color}15` : 'transparent',
                  }}
                >
                  {chip.label}
                  <span className="rounded-full bg-[var(--color-muted)]/15 px-1.5 py-0.5 text-[8px]">
                    {platformCounts[chip.id] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--color-muted)]">
              {contentTypeFilter !== 'all'
                ? `Filtering: ${CONTENT_TYPE_TABS.find((t) => t.id === contentTypeFilter)?.label}`
                : 'Showing all live content'}
            </span>
            <span className="text-[10px] text-[var(--color-muted)]">·</span>
            <span className="text-[10px] text-[var(--color-muted)]">
              Updated {formatTimeAgo(lastRefresh)}
            </span>
            {filteredSpaces.length > 0 && (
              <>
                <span className="text-[10px] text-[var(--color-muted)]">·</span>
                <span className="text-[10px] font-medium text-degen-400">
                  {filteredSpaces.length} live
                </span>
              </>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && <SectionHeader icon={<LiveDot />} title="Loading live content..." />}
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

        {/* Content grid */}
        {!loading && (
          <>
            {filteredSpaces.length === 0 ? (
              <EmptyState
                icon="🎙️"
                title={
                  platformFilter !== 'all'
                    ? `No live content on ${platformFilter}`
                    : contentTypeFilter !== 'all'
                      ? `No ${contentTypeFilter} content right now`
                      : 'No live content right now'
                }
                subtitle={
                  platformFilter !== 'all'
                    ? 'Try switching to All or check back later'
                    : 'Start a space, go live on video, or share a live photo!'
                }
                action={
                  hasSignedIn
                    ? {
                        label: 'Go Live',
                        onClick: () => {
                          window.location.href = '/spaces';
                        },
                      }
                    : undefined
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

            {/* Platform distribution */}
            {!loading && spaces.length > 0 && (
              <div className="mt-6 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)]/30 px-5 py-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                  Platform Distribution
                </h3>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(platformCounts)
                    .filter(([k]) => k !== 'all')
                    .filter(([, count]) => count > 0)
                    .map(([platform, count]) => {
                      const chip = PLATFORM_CHIPS.find((c) => c.id === platform);
                      if (!chip) return null;
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

                {/* Content type breakdown */}
                <div className="mt-3 flex flex-wrap gap-4">
                  {(['audio', 'video', 'photos'] as SpaceContentType[]).map((type) => {
                    const count = spaces.filter((s) => s.contentType === type).length;
                    if (count === 0) return null;
                    return <ContentTypeBadge key={type} type={type} />;
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

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
