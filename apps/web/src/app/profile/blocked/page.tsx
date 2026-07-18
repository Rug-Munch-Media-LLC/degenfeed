'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface BlockedEntry {
  targetId: string;
  targetHandle: string;
  protocol: string;
  blockedAt: number;
}

interface MutedEntry {
  targetId: string;
  targetHandle: string;
  mutedAt: number;
}

export default function BlockedUsersPage() {
  const [blocked, setBlocked] = useState<BlockedEntry[]>([]);
  const [muted, setMuted] = useState<MutedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const storage = await import('@degenfeed/storage');
      const [blockedUsers, mutedIdentities] = await Promise.all([
        storage.getBlockedUsers('self'),
        storage.getMutedIdentities('self'),
      ]);

      setBlocked(
        blockedUsers.map((b) => ({
          targetId: b.targetId,
          targetHandle: b.targetHandle,
          protocol: b.protocol,
          blockedAt: b.blockedAt,
        })),
      );
      setMuted(
        mutedIdentities.map((m) => ({
          targetId: m.targetId,
          targetHandle: m.targetHandle,
          mutedAt: m.mutedAt,
        })),
      );
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnblock = async (targetId: string) => {
    const { removeBlockedUser } = await import('@degenfeed/storage');
    await removeBlockedUser(targetId, 'self');
    setBlocked((prev) => prev.filter((b) => b.targetId !== targetId));
    window.dispatchEvent(
      new CustomEvent('df-toast', { detail: { kind: 'success', message: 'User unblocked' } }),
    );
  };

  const handleUnmute = async (targetId: string) => {
    const { unmuteIdentity } = await import('@degenfeed/storage');
    await unmuteIdentity(targetId, 'self');
    setMuted((prev) => prev.filter((m) => m.targetId !== targetId));
    window.dispatchEvent(
      new CustomEvent('df-toast', { detail: { kind: 'success', message: 'User unmuted' } }),
    );
  };

  const hasContent = blocked.length > 0 || muted.length > 0;

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <p className="font-mono text-xs tracking-widest text-degen-400 uppercase">Moderation</p>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Blocked &amp; Muted</h1>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse p-4">
              <div className="mb-2 h-4 w-48 rounded bg-[var(--color-muted)]" />
              <div className="h-3 w-32 rounded bg-[var(--color-muted)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs tracking-widest text-degen-400 uppercase">Moderation</p>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Blocked &amp; Muted</h1>
        </div>
        <Link
          href="/home"
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          &larr; Feed
        </Link>
      </div>

      {!hasContent && (
        <div className="card py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-muted)]">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="text-[var(--color-muted)]"
            >
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[var(--color-muted)]">You haven&apos;t blocked anyone</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Block or mute users from the three-dot menu on any post.
          </p>
          <Link href="/home" className="btn-primary mt-4 inline-block text-sm">
            Browse the feed
          </Link>
        </div>
      )}

      {hasContent && (
        <div className="space-y-6">
          {/* Blocked users */}
          {blocked.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-[var(--color-muted)] uppercase tracking-widest">
                Blocked Users
                <span className="ml-2 text-xs text-[var(--color-muted)]">({blocked.length})</span>
              </h2>
              <div className="space-y-2">
                {blocked.map((b) => (
                  <div key={b.targetId} className="card flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                        {b.targetHandle}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                        <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">
                          {b.protocol}
                        </span>
                        <span>Blocked {new Date(b.blockedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblock(b.targetId)}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/20 transition-colors"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Muted users */}
          {muted.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-[var(--color-muted)] uppercase tracking-widest">
                Muted Users
                <span className="ml-2 text-xs text-[var(--color-muted)]">({muted.length})</span>
              </h2>
              <div className="space-y-2">
                {muted.map((m) => (
                  <div key={m.targetId} className="card flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                        {m.targetHandle}
                      </p>
                      <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                        Muted {new Date(m.mutedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnmute(m.targetId)}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted)] transition-colors"
                    >
                      Unmute
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
