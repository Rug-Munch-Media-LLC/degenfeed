'use client';

import { SpaceRoom } from '@degenfeed/ui';
import { useCallback, useEffect, useState } from 'react';
import { ANIM_STYLES } from '../_animations';
import type { SpaceItem } from '../_types';

/**
 * Individual space page — shows the SpaceRoom for a specific space.
 * Fetches space details from the spaces API and joins automatically.
 */
export default function SpaceDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const [params, setParams] = useState<{ id: string } | null>(null);

  // Resolve the async params
  useEffect(() => {
    paramsPromise.then(setParams).catch(() => {});
  }, [paramsPromise]);

  const [space, setSpace] = useState<SpaceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);

  const id = params?.id;

  // Fetch space details
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function fetchSpace() {
      try {
        const res = await fetch(`/api/spaces/${encodeURIComponent(id ?? '')}`);
        if (res.ok) {
          const data = (await res.json()) as { space: SpaceItem };
          if (!cancelled) setSpace(data.space);
        } else {
          // Fallback: search all live spaces
          const allRes = await fetch('/api/spaces/all');
          if (allRes.ok) {
            const allData = (await allRes.json()) as { spaces: SpaceItem[] };
            const found = allData.spaces.find((s) => s.id === id || s.id.endsWith(`:${id}`));
            if (found) {
              if (!cancelled) setSpace(found);
            } else {
              if (!cancelled) setError('Space not found');
            }
          }
        }
      } catch {
        if (!cancelled) setError('Failed to load space');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSpace();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Join the space on load
  useEffect(() => {
    if (space && space.status === 'live' && !isJoined) {
      setIsJoined(true);
      fetch(`/api/spaces/${encodeURIComponent(space.id)}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }).catch(() => {});
    }
  }, [space, isJoined]);

  const handleLeave = useCallback(() => {
    if (space) {
      fetch(`/api/spaces/${encodeURIComponent(space.id)}/leave`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }).catch(() => {});
    }
    window.history.back();
  }, [space]);

  // Loading state
  if (loading || !params) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-[var(--color-muted)]">
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          <p className="text-sm">Loading space...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !space) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-4xl opacity-30" aria-hidden="true">
            🎙️
          </span>
          <p className="text-sm font-semibold text-[var(--color-fg)]">
            {error || 'Space not found'}
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            This space may have ended or doesn&apos;t exist.
          </p>
          <a
            href="/spaces"
            className="rounded-xl bg-degen-500 px-5 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400"
          >
            Browse Spaces
          </a>
        </div>
      </div>
    );
  }

  // Live room
  return (
    <>
      <style>{ANIM_STYLES}</style>
      <SpaceRoom
        space={space}
        currentUserId="anonymous"
        currentUserDisplayName="Guest"
        onLeave={handleLeave}
      />
    </>
  );
}
