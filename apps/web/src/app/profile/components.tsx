'use client';

import type { ReputationBadgeProgress, ReputationBadgeScore } from '@degenfeed/ui';
import { ReputationBadge } from '@degenfeed/ui';
import Image from 'next/image';
import { formatCount, PROTOCOL_LABELS, shortenAddress } from './constants';
import type { ProfileStats, ProfileTab, ResolvedIdentity } from './types';

export function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 animate-pulse">
      <div className="mb-6 flex flex-col items-center">
        <div className="mb-4 h-24 w-24 rounded-full skeleton" />
        <div className="mb-2 h-7 w-48 skeleton rounded-lg" />
        <div className="mb-1 h-4 w-32 skeleton rounded-lg" />
        <div className="h-4 w-64 skeleton rounded-lg" />
      </div>
      <div className="mb-6 flex justify-center gap-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 w-20 skeleton rounded-xl" />
        ))}
      </div>
      <div className="mb-6 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-8 skeleton rounded-full" />
        ))}
      </div>
      <div className="mb-6 h-10 skeleton rounded-xl" />
      <div className="mb-6 flex justify-center gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 w-20 skeleton rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function StatsBar({ stats }: { stats: ProfileStats }) {
  const items: Array<{ label: string; value: number; icon: string }> = [
    {
      label: 'Posts',
      value: stats.posts,
      icon: 'M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z',
    },
    {
      label: 'Followers',
      value: stats.followers,
      icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2M19 7a4 4 0 01-4 4',
    },
    {
      label: 'Following',
      value: stats.following,
      icon: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6',
    },
    {
      label: 'Tips',
      value: stats.tipsReceived,
      icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-3 transition-colors hover:border-degen-500/20"
        >
          <span className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
            {formatCount(item.value)}
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ProtocolBadgesRow({ identities }: { identities: ResolvedIdentity[] }) {
  if (identities.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {identities.map((id) => (
        <div
          key={id.id}
          className="group relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:scale-105"
          style={{
            borderColor: `${id.color}44`,
            backgroundColor: `${id.color}11`,
            color: id.color,
          }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: id.color, boxShadow: `0 0 6px ${id.color}66` }}
          />
          <span>{PROTOCOL_LABELS[id.protocol] || id.protocol}</span>
          {id.verified && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-degen-400"
              aria-label="Verified"
            >
              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
            </svg>
          )}
          {id.address && (
            <span className="ml-0.5 font-mono text-[10px] opacity-60">
              {shortenAddress(id.address)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export const ACHIEVEMENTS = [
  { id: 'early', label: 'Early Adopter', icon: '🌅', color: 'from-amber-400 to-orange-500' },
  { id: 'streak', label: '7-Day Streak', icon: '🔥', color: 'from-red-400 to-rose-500' },
  { id: 'top-post', label: 'Top Post', icon: '🏆', color: 'from-yellow-400 to-amber-500' },
  { id: 'helper', label: 'Helping Hand', icon: '🤝', color: 'from-blue-400 to-indigo-500' },
  { id: 'creator', label: 'Creator', icon: '✨', color: 'from-purple-400 to-fuchsia-500' },
];

export function AchievementBadges({ earned }: { earned: string[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {ACHIEVEMENTS.map((badge) => {
        const unlocked = earned.includes(badge.id);
        return (
          <div
            key={badge.id}
            className={`group relative flex flex-col items-center gap-1 transition-all ${unlocked ? 'opacity-100' : 'opacity-30 grayscale'}`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${badge.color} shadow-lg transition-transform group-hover:scale-110 ${unlocked ? '' : 'saturate-0'}`}
            >
              <span className="text-lg" role="img" aria-label={badge.label}>
                {badge.icon}
              </span>
            </div>
            <span className="text-[9px] font-medium whitespace-nowrap text-[var(--color-muted)]">
              {badge.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const TABS: Array<{ id: ProfileTab; label: string; icon: string }> = [
  {
    id: 'posts',
    label: 'Posts',
    icon: 'M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z',
  },
  {
    id: 'replies',
    label: 'Replies',
    icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  },
  {
    id: 'media',
    label: 'Media',
    icon: 'M15 8h.01M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z',
  },
  {
    id: 'likes',
    label: 'Likes',
    icon: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  },
];

export function ProfileTabs({
  active,
  onTabChange,
}: {
  active: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
}) {
  return (
    <div
      className="border-b border-[var(--color-glass-border)]"
      role="tablist"
      aria-label="Profile content"
    >
      <div className="flex -mb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${active === tab.id ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="hidden sm:block"
            >
              <path d={tab.icon} />
            </svg>
            <span>{tab.label}</span>
            {active === tab.id && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-degen-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TabEmptyState({ tab }: { tab: ProfileTab }) {
  const messages: Record<ProfileTab, { title: string; desc: string }> = {
    posts: {
      title: 'No posts yet',
      desc: "When you post across your linked protocols, they'll appear here.",
    },
    replies: {
      title: 'No replies yet',
      desc: 'Replies to posts from any protocol will show up here.',
    },
    media: { title: 'No media yet', desc: 'Images and videos you share will be collected here.' },
    likes: { title: 'No likes yet', desc: 'Posts you like across all protocols will appear here.' },
  };
  const m = messages[tab];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="empty-state-icon">
        <span>📭</span>
      </div>
      <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">{m.title}</h3>
      <p className="max-w-xs text-xs text-[var(--color-muted)]">{m.desc}</p>
    </div>
  );
}

export function ProfileHeader({
  displayName,
  handle,
  joinDate,
  avatarUrl,
  bio,
}: {
  displayName: string;
  handle?: string;
  joinDate?: string | null;
  avatarUrl?: string | null;
  bio?: string;
}) {
  return (
    <div className="relative mb-16 h-32 overflow-hidden rounded-2xl bg-gradient-to-r from-degen-500/20 via-purple-500/10 to-fuchsia-500/20 sm:h-40">
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-transparent to-transparent opacity-50" />
      <div className="relative mx-auto -mt-20 mb-4 flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-degen-500 via-purple-500 to-fuchsia-500 p-0.5">
          <div className="h-full w-full rounded-full bg-[var(--color-bg)]" />
        </div>
        <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-[var(--color-bg)] sm:h-28 sm:w-28">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={112}
              height={112}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-degen-500/30 via-purple-500/20 to-fuchsia-500/30 text-3xl font-bold text-[var(--color-fg)]">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
      <div className="text-center -mt-10">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">{displayName}</h1>
        {handle && <p className="mt-0.5 text-sm text-[var(--color-muted)]">@{handle}</p>}
        {joinDate && <p className="mt-1 text-xs text-[var(--color-muted)]">Joined {joinDate}</p>}
        {bio && <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted)]">{bio}</p>}
      </div>
    </div>
  );
}
