'use client';

import type { CommunityMember, MemberRole } from './types';

const ROLE_BADGES: Record<MemberRole, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'text-amber-400 bg-amber-500/15' },
  moderator: { label: 'Mod', color: 'text-blue-400 bg-blue-500/15' },
  contributor: { label: 'Contributor', color: 'text-green-400 bg-green-500/15' },
  vip: { label: 'VIP', color: 'text-purple-400 bg-purple-500/15' },
  og: { label: 'OG', color: 'text-orange-400 bg-orange-500/15' },
  member: { label: '', color: '' },
};

function shortenWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function MemberRow({
  member,
  isViewer,
  viewerCanManage,
  onPromote,
  onDemote,
  onBan,
}: {
  member: CommunityMember;
  isViewer: boolean;
  viewerCanManage: boolean;
  onPromote: (wallet: string) => void;
  onDemote: (wallet: string) => void;
  onBan: (wallet: string) => void;
}) {
  const badge = ROLE_BADGES[member.role];

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 transition-all hover:border-[var(--color-border)]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-xs font-bold text-degen-400">
        {member.displayName
          ? member.displayName.charAt(0).toUpperCase()
          : member.wallet.charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
            {member.displayName || shortenWallet(member.wallet)}
          </span>
          {isViewer && (
            <span className="rounded-full bg-degen-500/10 px-1.5 py-0.5 text-[9px] font-medium text-degen-400">
              You
            </span>
          )}
          {badge.label && (
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badge.color}`}>
              {badge.label}
            </span>
          )}
        </div>
        <p className="truncate text-[10px] text-[var(--color-muted)] font-mono">
          {shortenWallet(member.wallet)}
        </p>
      </div>

      <div className="text-[10px] text-[var(--color-muted)]">
        {new Date(member.joinedAt).toLocaleDateString()}
      </div>

      {/* Admin actions */}
      {viewerCanManage && member.role !== 'owner' && (
        <div className="flex shrink-0 gap-1">
          {member.role === 'member' ? (
            <button
              type="button"
              onClick={() => onPromote(member.wallet)}
              className="rounded-lg bg-blue-500/10 px-2 py-1 text-[9px] font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
              title="Promote to moderator"
            >
              Promote
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onDemote(member.wallet)}
              className="rounded-lg bg-amber-500/10 px-2 py-1 text-[9px] font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
              title="Demote to member"
            >
              Demote
            </button>
          )}
          <button
            type="button"
            onClick={() => onBan(member.wallet)}
            className="rounded-lg bg-red-500/10 px-2 py-1 text-[9px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
            title="Ban member"
          >
            Ban
          </button>
        </div>
      )}
    </div>
  );
}

export function CommunityMemberList({
  members,
  viewerWallet,
  viewerRole,
  communityId,
  onUpdate,
}: {
  members: CommunityMember[];
  viewerWallet?: string | null;
  viewerRole: MemberRole | null;
  communityId: string;
  onUpdate: () => void;
}) {
  const viewerCanManage = viewerRole === 'owner' || viewerRole === 'moderator';

  const handleAction = async (wallet: string, action: 'promote' | 'demote' | 'ban') => {
    try {
      if (action === 'ban') {
        const res = await fetch(`/api/feddy/${communityId}/ban`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ wallet }),
        });
        if (res.ok) onUpdate();
      } else {
        const res = await fetch(`/api/feddy/${communityId}/mod`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            wallet,
            action: action === 'promote' ? 'add' : 'remove',
          }),
        });
        if (res.ok) onUpdate();
      }
    } catch {
      // Silently fail
    }
  };

  // Sort: owners first, then mods, then members
  const sorted = [...members].sort((a, b) => {
    const rank: Record<MemberRole, number> = { owner: 0, moderator: 1, contributor: 2, vip: 2, og: 2, member: 3 };
    return (rank[a.role] ?? 3) - (rank[b.role] ?? 3);
  });

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <span className="mb-2 text-3xl">👥</span>
        <p className="text-sm text-[var(--color-muted)]">No members yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((member) => (
        <MemberRow
          key={member.wallet}
          member={member}
          isViewer={member.wallet === viewerWallet}
          viewerCanManage={viewerCanManage}
          onPromote={(w) => handleAction(w, 'promote')}
          onDemote={(w) => handleAction(w, 'demote')}
          onBan={(w) => handleAction(w, 'ban')}
        />
      ))}
    </div>
  );
}
