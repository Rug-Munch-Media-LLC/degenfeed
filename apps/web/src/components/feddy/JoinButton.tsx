'use client';

import { useCallback, useState } from 'react';

export function JoinButton({
  communityId,
  communityName,
  isMember,
  isOwner,
  onJoined,
  onLeft,
}: {
  communityId: string;
  communityName: string;
  isMember: boolean;
  isOwner: boolean;
  onJoined: () => void;
  onLeft: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/feddy/${encodeURIComponent(communityName)}/join`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as Record<string, string>).error || 'Failed to join');
      }

      onJoined();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setLoading(false);
    }
  }, [communityName, onJoined]);

  const handleLeave = useCallback(async () => {
    if (isOwner) {
      setError("You're the owner. Transfer ownership or delete the community to leave.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/feddy/${encodeURIComponent(communityName)}/leave`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as Record<string, string>).error || 'Failed to leave');
      }

      onLeft();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave');
    } finally {
      setLoading(false);
    }
  }, [communityName, isOwner, onLeft]);

  if (isOwner) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
        <p className="text-xs font-medium text-amber-400">You own this community</p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={isMember ? handleLeave : handleJoin}
        disabled={loading}
        className={`w-full rounded-xl py-2.5 text-sm font-bold transition-all ${
          isMember
            ? 'border-2 border-red-500/30 text-red-400 hover:bg-red-500/10'
            : 'bg-degen-500 text-black hover:bg-degen-400 hover:shadow-[0_0_24px_rgba(0,255,65,0.35)]'
        } disabled:opacity-50`}
      >
        {loading ? '...' : isMember ? 'Leave Community' : 'Join Community'}
      </button>

      {error && (
        <p className="mt-2 text-[10px] text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
