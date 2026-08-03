'use client';

import type { CommunityStats, FeddyCommunity, MemberRole } from './types';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function CommunitySidebar({
  community,
  stats,
}: {
  community: FeddyCommunity;
  stats: CommunityStats | null;
  viewerRole: MemberRole | null;
}) {
  return (
    <div className="space-y-4">
      {/* Stats card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h4 className="mb-3 text-xs font-bold text-[var(--color-fg)] uppercase tracking-wider">
          Stats
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-lg font-bold text-[var(--color-fg)]">
              {formatCount(community.memberCount)}
            </p>
            <p className="text-[10px] text-[var(--color-muted)]">Members</p>
          </div>
          <div>
            <p className="text-lg font-bold text-[var(--color-fg)]">
              {formatCount(community.totalPosts)}
            </p>
            <p className="text-[10px] text-[var(--color-muted)]">Posts</p>
          </div>
          {stats && (
            <>
              <div>
                <p className="text-lg font-bold text-degen-400">
                  {formatCount(stats.postsLast24h)}
                </p>
                <p className="text-[10px] text-[var(--color-muted)]">Posts 24h</p>
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--color-fg)]">{stats.activeMembers}</p>
                <p className="text-[10px] text-[var(--color-muted)]">Active</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Owner card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h4 className="mb-2 text-xs font-bold text-[var(--color-fg)] uppercase tracking-wider">
          Owner
        </h4>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">
            {community.owner.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-mono text-[var(--color-fg)]">
              {community.owner.slice(0, 6)}...{community.owner.slice(-4)}
            </p>
          </div>
        </div>
      </div>

      {/* Federated handle card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h4 className="mb-2 text-xs font-bold text-[var(--color-fg)] uppercase tracking-wider">
          Federation
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-lg">🌐</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-xs text-degen-400">{community.gtsHandle}</p>
            <p className="text-[10px] text-[var(--color-muted)]">
              Visible on Mastodon, Pixelfed, Lemmy
            </p>
          </div>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h4 className="mb-2 text-xs font-bold text-[var(--color-fg)] uppercase tracking-wider">
          Info
        </h4>
        <div className="space-y-1.5 text-xs text-[var(--color-muted)]">
          <p>
            <span className="text-[var(--color-fg)]">Privacy:</span>{' '}
            {community.isPrivate ? 'Private' : 'Public'}
          </p>
          <p>
            <span className="text-[var(--color-fg)]">Created:</span>{' '}
            {new Date(community.createdAt).toLocaleDateString()}
          </p>
          {community.linkedCoin && (
            <p>
              <span className="text-[var(--color-fg)]">Coin:</span>{' '}
              <span className="font-mono text-amber-400">
                {community.linkedCoin.slice(0, 10)}...
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
