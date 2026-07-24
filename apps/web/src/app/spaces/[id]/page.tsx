'use client';

import { SpaceRoom } from '@degenfeed/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { ANIM_STYLES } from '../_animations';
import type { SpaceItem } from '../_types';

/**
 * Individual space page — shows the SpaceRoom for a specific space.
 * Fetches space details from /api/spaces/all and joins automatically.
 */
export default function SpaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { ready, signedInProtocols } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const [space, setSpace] = useState<SpaceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const spaceId = useMemo(() => {
    let id = '';
    params.then((p) => { id = p.id; }).catch(() => {});
    return id;
  }, [params]);

  // Fetch space details
  useEffect(() => {
    let cancelled = false;

    async function fetchSpace() {
      const { id } = await params;
      if (!id) return;

      try {
        // Try direct lookup first
        const res = await fetch(`/api/spaces/${id}`);
        if (res.ok) {
          const data = (await res.json()) as { space: SpaceItem };
          if (!cancelled) setSpace(data.space);
        } else {
          // Fallback: search all live spaces
          const allRes = await fetch('/api/spaces/all');
          if (allRes.ok) {
            const allData = (await allRes.json()) as { spaces: SpaceItem[] };
            const found = allData.spaces.find((s) => s.id === id);
            if (found) {
              if (!cancelled) setSpace(found);
            } else {
              if (!cancelled) setError('Space not found');
            }
          }
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load space');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSpace();
    return () => { cancelled = true; };
  }, [params]);

  // Join the space on load
  useEffect(() => {
    if (space && space.status === 'live') {
      fetch(`/api/spaces/${space.id}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }).catch(() => {});
    }
  }, [space]);

  const handleLeave = useCallback(() => {
    if (space) {
      fetch(`/api/spaces/${space.id}/leave`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }).catch(() => {});
    }
    window.history.back();
  }, [space]);

  // Loading state
  if (loading) {
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
          <span className="text-4xl opacity-30" aria-hidden="true">🎙️</span>
          <p className="text-sm font-semibold text-[var(--color-fg)]">{error || 'Space not found'}</p>
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
        currentUserId={hasSignedIn ? 'current-user' : 'anonymous'}
        currentUserDisplayName={hasSignedIn ? 'User' : 'Guest'}
        onLeave={handleLeave}
      />
    </>
  );
}
