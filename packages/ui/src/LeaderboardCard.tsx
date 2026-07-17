/**
 * @degenfeed/ui — LeaderboardCard
 *
 * Reusable leaderboard entry card showing rank, avatar, name, platform badges,
 * stats, and change indicator. Top 3 get gold/silver/bronze styling.
 */

'use client';

import { ProtocolBadge, getProtocolLabel } from './ProtocolBadge';

// ─── Types ────────────────────────────────────────────────────────────────

export interface LeaderboardCardEntry {
  id: string;
  rank: number;
  name: string;
  handle: string;
  avatarUrl: string;
  platform: string;
  platforms: string[];
  tipsReceived: number;
  tipsSent: number;
  followerCount: number;
  postCount: number;
  change: number;
}

export interface LeaderboardCardProps {
  entry: LeaderboardCardEntry;
  variant?: 'creators' | 'tippers';
  showStats?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const RANK_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: {
    bg: 'from-yellow-400/20 to-yellow-600/10 border-yellow-500/40',
    text: 'text-yellow-400',
    label: '🥇',
  },
  2: {
    bg: 'from-gray-300/20 to-gray-400/10 border-gray-400/40',
    text: 'text-gray-300',
    label: '🥈',
  },
  3: {
    bg: 'from-amber-600/20 to-amber-700/10 border-amber-600/40',
    text: 'text-amber-500',
    label: '🥉',
  },
};

function getRankStyle(rank: number): { className: string; label: string } {
  const color = RANK_COLORS[rank];
  if (color) {
    return {
      className: `bg-gradient-to-br ${color.bg} border ${color.text}`,
      label: color.label,
    };
  }
  return {
    className: 'bg-[var(--color-overlay)] text-[var(--color-muted)]',
    label: `#${rank}`,
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function ChangeIndicator({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-degen-400">
        <span aria-hidden="true">↑</span>
        <span>{change}</span>
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-400">
        <span aria-hidden="true">↓</span>
        <span>{Math.abs(change)}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--color-muted)]">
      <span aria-hidden="true">–</span>
      <span>0</span>
    </span>
  );
}

function AvatarFallback({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-12 w-12 text-sm' : 'h-10 w-10 text-xs';
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-degen-500/20 font-bold text-degen-400 ${sizeClass}`}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────

export function LeaderboardCard({ entry, variant = 'creators', showStats = true }: LeaderboardCardProps) {
  const rankStyle = getRankStyle(entry.rank);
  const isPodium = entry.rank <= 3;
  const statValue = variant === 'creators' ? entry.tipsReceived : entry.tipsSent;

  return (
    <div
      className={`group relative flex items-center gap-3 rounded-2xl border p-3 sm:p-4 transition-all duration-200 hover:shadow-[0_0_20px_-8px] ${
        isPodium ? rankStyle.className : 'border-[var(--color-border)] bg-[var(--color-card)] hover:border-white/20'
      }`}
    >
      {/* Rank badge */}
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
          isPodium ? rankStyle.className : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
        }`}
        aria-label={`Rank ${entry.rank}`}
      >
        {isPodium ? rankStyle.label : `#${entry.rank}`}
      </div>

      {/* Avatar */}
      <div className="shrink-0">
        {entry.avatarUrl ? (
          <img
            src={entry.avatarUrl}
            alt={`${entry.name}'s avatar`}
            className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10"
            loading="lazy"
          />
        ) : (
          <AvatarFallback name={entry.name} size="md" />
        )}
      </div>

      {/* Name + handle + platforms */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
            {entry.name}
          </span>
          <ChangeIndicator change={entry.change} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          <span className="truncate">{entry.handle}</span>
          <span aria-hidden="true">·</span>
          <div className="flex shrink-0 items-center gap-1">
            {(entry.platforms ?? [entry.platform]).slice(0, 3).map((p) => (
              <ProtocolBadge key={p} protocol={p} />
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="shrink-0 text-right">
        <div className="text-sm font-bold text-degen-400">
          {formatNumber(statValue)}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          {variant === 'creators' ? 'Received' : 'Sent'}
        </div>
      </div>

      {/* Extra stats row (shown on hover/desktop) */}
      {showStats && (
        <div className="absolute -bottom-1 left-0 right-0 hidden translate-y-full px-3 group-hover:block sm:block sm:relative sm:translate-y-0 sm:mt-0 sm:px-0">
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
            <span>{formatNumber(entry.followerCount)} followers</span>
            <span aria-hidden="true">·</span>
            <span>{formatNumber(entry.postCount)} posts</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mini Leaderboard Widget ──────────────────────────────────────────────

// Small widget showing top 3 creators — suitable for sidebars
export function MiniLeaderboard({ entries, title = '🏆 Top Creators' }: {
  entries: LeaderboardCardEntry[];
  title?: string;
}) {
  const top3 = entries.slice(0, 3);

  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[var(--color-fg)]">{title}</h2>
        <a
          href="/leaderboard"
          className="text-[10px] font-medium text-degen-400 hover:text-degen-300 transition-colors"
        >
          View all →
        </a>
      </div>
      {top3.length === 0 ? (
        <p className="text-xs text-gray-500">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {top3.map((entry) => {
            const rankStyle = getRankStyle(entry.rank);
            return (
              <a
                key={entry.id}
                href={`/profile/${encodeURIComponent(entry.handle)}`}
                className="flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-white/5"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    entry.rank <= 3
                      ? rankStyle.className
                      : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
                  }`}
                >
                  {entry.rank <= 3 ? rankStyle.label : `#${entry.rank}`}
                </span>
                {entry.avatarUrl ? (
                  <img
                    src={entry.avatarUrl}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <AvatarFallback name={entry.name} size="sm" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-[var(--color-fg)]">
                    {entry.name}
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    {formatNumber(entry.tipsReceived)} tips
                  </div>
                </div>
                <ChangeIndicator change={entry.change} />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
