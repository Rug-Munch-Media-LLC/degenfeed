'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { renderMarkdown } from '../../lib/markdown';
import { sanitizeHtml } from '../../lib/sanitize';
import {
  ACTIVITY_CONFIG,
  CONTENT_TABS,
  formatCount,
  formatPriceChange,
  getProtocolIcon,
  PROTOCOL_COLORS,
  PROTOCOL_LABELS,
  shortenAddress,
  timeAgo,
} from './constants';
import type {
  ActivityItem,
  ContentPerformance,
  ContentSource,
  CreatorCoin,
  DAOMembership,
  DiscoveredProfile,
  ProfileStats,
  ResolvedIdentity,
  RevenueStats,
  TabContentItem,
} from './types';

// ─── Skeleton ──────────────────────────────────────────────────────────

export function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 animate-pulse">
      {/* Cover */}
      <div className="mb-4 h-40 skeleton rounded-2xl" />
      <div className="flex flex-col items-center -mt-14 mb-6">
        <div className="mb-2 h-28 w-28 rounded-full skeleton border-4 border-[var(--color-bg)]" />
        <div className="mb-2 h-7 w-48 skeleton rounded-lg" />
        <div className="mb-1 h-4 w-32 skeleton rounded-lg" />
        <div className="h-4 w-64 skeleton rounded-lg" />
      </div>
      {/* Stats */}
      <div className="mb-6 flex justify-center gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-16 w-24 skeleton rounded-xl" />
        ))}
      </div>
      {/* Badges */}
      <div className="mb-6 flex justify-center gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-8 w-8 skeleton rounded-full" />
        ))}
      </div>
      {/* Tabs */}
      <div className="mb-6 h-10 skeleton rounded-xl" />
      <div className="mb-6 flex justify-center gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 w-24 skeleton rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ─── Protocol Connectivity Ring ────────────────────────────────────────

export function ProtocolConnectivityRing({
  identities,
  size = 120,
}: {
  identities: ResolvedIdentity[];
  size?: number;
}) {
  if (identities.length === 0) return null;
  const connected = identities.filter(
    (id) => !id.protocol.startsWith('ethereum') && !id.protocol.startsWith('solana'),
  );
  const total = connected.length;
  const strokeWidth = 3;
  const radius = size / 2 - strokeWidth - 4;
  const segmentAngle = 360 / Math.max(total, 1);

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
    >
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-glass-border)"
        strokeWidth={strokeWidth}
        opacity={0.3}
      />
      {/* Protocol segments */}
      {connected.map((id, i) => {
        const angle = i * segmentAngle - 90;
        const startAngle = (angle * Math.PI) / 180;
        const endAngle = ((angle + segmentAngle * 0.85) * Math.PI) / 180;
        const x1 = size / 2 + radius * Math.cos(startAngle);
        const y1 = size / 2 + radius * Math.sin(startAngle);
        const x2 = size / 2 + radius * Math.cos(endAngle);
        const y2 = size / 2 + radius * Math.sin(endAngle);
        const largeArc = segmentAngle * 0.85 > 180 ? 1 : 0;
        return (
          <path
            key={id.id}
            d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none"
            stroke={id.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={0.9}
          />
        );
      })}
      {/* Center avatar area */}
      <clipPath id="avatarClip">
        <circle cx={size / 2} cy={size / 2} r={radius - strokeWidth - 4} />
      </clipPath>
    </svg>
  );
}

// ─── Unified Profile Header (Enhanced) ────────────────────────────────

export function UnifiedProfileHeader({
  displayName,
  handle,
  joinDate,
  avatarUrl,
  coverUrl,
  bio,
  identities,
  stats,
  creatorCoin,
  daoMemberships,
  isOwnProfile,
  onEdit,
  onFollow,
  onSubscribe,
  onTip,
  onMessage,
  onShare,
}: {
  displayName: string;
  handle?: string;
  joinDate?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio?: string;
  identities: ResolvedIdentity[];
  stats: ProfileStats;
  creatorCoin?: CreatorCoin | null;
  daoMemberships?: DAOMembership[];
  isOwnProfile?: boolean;
  onEdit?: () => void;
  onFollow?: () => void;
  onSubscribe?: () => void;
  onTip?: () => void;
  onMessage?: () => void;
  onShare?: () => void;
}) {
  const [showAllDaos, setShowAllDaos] = useState(false);
  const displayedDaos = showAllDaos ? daoMemberships : daoMemberships?.slice(0, 5);

  return (
    <div className="relative">
      {/* Cover Image */}
      <div
        className="relative h-36 sm:h-48 overflow-hidden rounded-2xl bg-gradient-to-r from-degen-500/20 via-purple-500/10 to-fuchsia-500/20"
        style={
          coverUrl
            ? {
                backgroundImage: `url(${coverUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-transparent to-transparent opacity-60" />
      </div>

      {/* Avatar + Connectivity Ring */}
      <div className="relative mx-auto -mt-16 mb-2 flex w-fit items-center justify-center sm:-mt-20">
        {/* Connectivity ring behind avatar */}
        {identities.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <ProtocolConnectivityRing identities={identities} size={140} />
          </div>
        )}
        <div className="relative z-10 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-degen-500 via-purple-500 to-fuchsia-500 p-0.5 sm:h-32 sm:w-32 shadow-lg shadow-degen-500/20">
          <div className="h-full w-full rounded-full bg-[var(--color-bg)]" />
          <div className="absolute inset-0.5 flex items-center justify-center overflow-hidden rounded-full border-4 border-[var(--color-bg)]">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={128}
                height={128}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-degen-500/30 via-purple-500/20 to-fuchsia-500/30 text-3xl font-bold text-[var(--color-fg)]">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Name + Handle */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">{displayName}</h1>
        {handle && <p className="mt-0.5 text-sm text-[var(--color-muted)]">@{handle}</p>}
        {joinDate && <p className="mt-1 text-xs text-[var(--color-muted)]">Joined {joinDate}</p>}
        {bio && (
          <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--color-muted)] leading-relaxed">
            {bio}
          </p>
        )}
      </div>

      {/* Stats Row — total followers across ALL protocols, total posts, total tips */}
      <div className="mt-4">
        <EnhancedStatsRow stats={stats} identities={identities} />
      </div>

      {/* Protocol Badges Row */}
      <div className="mt-4">
        <ProtocolBadgesRow identities={identities} />
      </div>

      {/* Creator Coin Ticker */}
      {creatorCoin && <CreatorCoinTicker coin={creatorCoin} />}

      {/* DAO Memberships */}
      {daoMemberships && daoMemberships.length > 0 && (
        <div className="mt-4">
          <DAOMemberships
            memberships={displayedDaos ?? []}
            totalCount={daoMemberships.length}
            onToggleShowAll={() => setShowAllDaos(!showAllDaos)}
            showAll={showAllDaos}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4">
        <ProfileActionButtons
          isOwnProfile={!!isOwnProfile}
          onEdit={onEdit}
          onFollow={onFollow}
          onSubscribe={onSubscribe}
          onTip={onTip}
          onMessage={onMessage}
          onShare={onShare}
          hasTip={!!onTip}
          hasSubscribe={!!onSubscribe}
        />
      </div>
    </div>
  );
}

// ─── Enhanced Stats Row ────────────────────────────────────────────────

export function EnhancedStatsRow({
  stats,
  identities,
}: {
  stats: ProfileStats;
  identities: ResolvedIdentity[];
}) {
  const items: Array<{
    label: string;
    value: number;
    icon: string;
    sublabel?: string;
  }> = [
    {
      label: 'Total Followers',
      value: stats.followers,
      icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2M19 7a4 4 0 01-4 4',
      sublabel: stats.followersByProtocol
        ? `Across ${Object.keys(stats.followersByProtocol).length} networks`
        : undefined,
    },
    {
      label: 'Posts',
      value: stats.posts,
      icon: 'M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z',
      sublabel: stats.postsByProtocol
        ? `${Object.keys(stats.postsByProtocol).length} sources`
        : undefined,
    },
    {
      label: 'Following',
      value: stats.following,
      icon: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6',
    },
    {
      label: 'Tips Earned',
      value: stats.tipsReceived,
      icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    },
    {
      label: 'Networks',
      value: identities.filter(
        (id) => !id.protocol.startsWith('ethereum') && !id.protocol.startsWith('solana'),
      ).length,
      icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z',
    },
    {
      label: 'Verified',
      value: identities.filter((id) => id.verified).length,
      icon: 'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z',
    },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-2 py-2.5 transition-colors hover:border-degen-500/20"
        >
          <span className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
            {formatCount(item.value)}
          </span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)] text-center leading-tight">
            {item.label}
          </span>
          {item.sublabel && (
            <span className="mt-0.5 text-[8px] text-degen-400/70">{item.sublabel}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Protocol Badges Row (Enhanced) ────────────────────────────────────

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
          title={`${PROTOCOL_LABELS[id.protocol] || id.protocol}${id.followerCount ? ` — ${formatCount(id.followerCount)} followers` : ''}`}
        >
          <span className="text-xs">{getProtocolIcon(id.protocol)}</span>
          <span className="hidden sm:inline">{PROTOCOL_LABELS[id.protocol] || id.protocol}</span>
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
            <span className="ml-0.5 font-mono text-[10px] opacity-60 hidden sm:inline">
              {shortenAddress(id.address)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Markdown Bio ──────────────────────────────────────────────────────

/**
 * MarkdownBio — renders a bio as a safe Markdown subset.
 * Output is sanitized with DOMPurify before injection.
 */
export function MarkdownBio({ bio, className }: { bio?: string; className?: string }) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    setHtml(sanitizeHtml(renderMarkdown(bio ?? '')));
  }, [bio]);

  if (!bio) return null;

  return (
    <p
      className={
        className ??
        'mx-auto mt-2 max-w-lg text-sm text-[var(--color-muted)] leading-relaxed [&_a]:text-degen-400 [&_a]:underline [&_code]:rounded [&_code]:bg-[var(--color-overlay)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[11px]'
      }
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized with DOMPurify
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ─── Platform Follower Breakdown ───────────────────────────────────────

/**
 * PlatformFollowerBreakdown — per-platform follower/following counts shown as
 * a compact row of chips on the profile header.
 */
export function PlatformFollowerBreakdown({
  followersByProtocol,
  followingByProtocol,
  identities,
}: {
  followersByProtocol?: Record<string, number>;
  followingByProtocol?: Record<string, number>;
  identities: ResolvedIdentity[];
}) {
  const counts = new Map<string, { followers?: number; following?: number }>();
  for (const id of identities) {
    if (id.protocol.startsWith('ethereum') || id.protocol.startsWith('solana')) continue;
    counts.set(id.protocol, {
      followers: followersByProtocol?.[id.protocol],
      following: followingByProtocol?.[id.protocol],
    });
  }
  if (counts.size === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
      {[...counts.entries()].map(([protocol, countsFor]) => (
        <div
          key={protocol}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] px-2.5 py-1"
          title={`${PROTOCOL_LABELS[protocol] ?? protocol} follower/following counts`}
        >
          <span className="text-[10px]">{getProtocolIcon(protocol)}</span>
          <span className="text-[10px] font-medium" style={{ color: PROTOCOL_COLORS[protocol] ?? '#666' }}>
            {PROTOCOL_LABELS[protocol] ?? protocol}
          </span>
          <span className="text-[10px] text-[var(--color-muted)]">
            {countsFor.followers != null ? `${formatCount(countsFor.followers)} fol` : ''}
            {countsFor.following != null
              ? `${countsFor.followers != null ? ' · ' : ''}${formatCount(countsFor.following)} folg`
              : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Creator Coin Ticker ───────────────────────────────────────────────

export function CreatorCoinTicker({ coin }: { coin: CreatorCoin }) {
  const isPositive = coin.priceChange24h >= 0;
  return (
    <div className="mt-4 flex items-center justify-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/30 to-orange-500/30">
        <span className="text-lg">🪙</span>
      </div>
      <div className="text-center">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--color-fg)]">${coin.ticker}</span>
          <span className="text-xs text-[var(--color-muted)]">{coin.name}</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="font-semibold text-[var(--color-fg)] tabular-nums">
            ${coin.price.toFixed(coin.price < 1 ? 6 : 4)}
          </span>
          <span
            className={`text-xs font-medium tabular-nums ${isPositive ? 'text-green-400' : 'text-red-400'}`}
          >
            {formatPriceChange(coin.priceChange24h)}
          </span>
          <span className="text-[10px] text-[var(--color-muted)]">24h</span>
        </div>
      </div>
    </div>
  );
}

// ─── DAO Memberships ───────────────────────────────────────────────────

export function DAOMemberships({
  memberships,
  totalCount,
  onToggleShowAll,
  showAll,
}: {
  memberships: DAOMembership[];
  totalCount: number;
  onToggleShowAll: () => void;
  showAll: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-xs text-[var(--color-muted)] mr-1">DAO&nbsp;Memberships:</span>
      {memberships.map((dao) => (
        <div
          key={dao.id}
          className="inline-flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1"
          title={`${dao.name} on ${dao.chain}${dao.votingPower ? ` · ${dao.votingPower} VP` : ''}`}
        >
          <span className="text-xs">🛡️</span>
          <span className="text-[10px] font-medium text-purple-400">{dao.name}</span>
        </div>
      ))}
      {totalCount > 5 && (
        <button
          type="button"
          onClick={onToggleShowAll}
          className="text-[10px] text-degen-400 hover:text-degen-300 transition-colors"
        >
          {showAll ? 'Show less' : `+${totalCount - 5} more`}
        </button>
      )}
    </div>
  );
}

// ─── Profile Action Buttons ────────────────────────────────────────────

export function ProfileActionButtons({
  isOwnProfile,
  onEdit,
  onFollow,
  onSubscribe,
  onTip,
  onMessage,
  onShare,
  hasTip,
  hasSubscribe,
}: {
  isOwnProfile: boolean;
  onEdit?: () => void;
  onFollow?: () => void;
  onSubscribe?: () => void;
  onTip?: () => void;
  onMessage?: () => void;
  onShare?: () => void;
  hasTip?: boolean;
  hasSubscribe?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {isOwnProfile && onEdit && (
        <button type="button" onClick={onEdit} className="btn-secondary text-xs">
          Edit Profile
        </button>
      )}
      {!isOwnProfile && onFollow && (
        <button
          type="button"
          onClick={onFollow}
          className="rounded-lg bg-degen-500 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-degen-400"
        >
          Follow
        </button>
      )}
      {!isOwnProfile && hasSubscribe && onSubscribe && (
        <button
          type="button"
          onClick={onSubscribe}
          className="rounded-lg border border-degen-500/30 px-4 py-2 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/10"
        >
          Subscribe
        </button>
      )}
      {hasTip && onTip && (
        <button
          type="button"
          onClick={onTip}
          className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          Tip
        </button>
      )}
      {!isOwnProfile && onMessage && (
        <button
          type="button"
          onClick={onMessage}
          className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          Message
        </button>
      )}
      {onShare && (
        <button
          type="button"
          onClick={onShare}
          className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          aria-label="Share profile"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Profile Content Tabs (17 tabs) ────────────────────────────────────

export function ProfileContentTabs({
  active,
  onTabChange,
}: {
  active: ContentSource;
  onTabChange: (tab: ContentSource) => void;
}) {
  // Group: main social, content types, web3
  const mainTabs = CONTENT_TABS.filter((t) =>
    ['all', 'nostr', 'farcaster', 'bluesky', 'mastodon', 'lens'].includes(t.id),
  );
  const contentTabs = CONTENT_TABS.filter((t) =>
    [
      'lemmy',
      'peertube',
      'pixelfed',
      'writefreely',
      'podcasts',
      'music',
      'events',
      'books',
    ].includes(t.id),
  );
  const web3Tabs = CONTENT_TABS.filter((t) => ['media', 'coins', 'daos', 'tips'].includes(t.id));

  const renderTab = (tab: (typeof CONTENT_TABS)[0]) => (
    <button
      key={tab.id}
      type="button"
      role="tab"
      aria-selected={active === tab.id}
      onClick={() => onTabChange(tab.id)}
      className={`relative flex shrink-0 items-center gap-1 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
        active === tab.id
          ? 'text-[var(--color-fg)]'
          : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
      }`}
    >
      {active === tab.id && (
        <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-degen-500" />
      )}
      <span>{tab.label}</span>
    </button>
  );

  return (
    <div
      className="border-b border-[var(--color-glass-border)]"
      role="tablist"
      aria-label="Profile content by protocol"
    >
      {/* Main social tabs */}
      <div className="flex overflow-x-auto -mb-px scrollbar-none gap-0">
        {mainTabs.map(renderTab)}
      </div>
      {/* Content type tabs */}
      <div className="flex overflow-x-auto -mb-px scrollbar-none gap-0 border-t border-[var(--color-glass-border)]/50">
        {contentTabs.map(renderTab)}
      </div>
      {/* Web3 tabs */}
      <div className="flex overflow-x-auto scrollbar-none gap-0 border-t border-[var(--color-glass-border)]/50">
        {web3Tabs.map(renderTab)}
      </div>
    </div>
  );
}

// ─── Tab Empty State ───────────────────────────────────────────────────

export function TabEmptyState({ tab }: { tab: string }) {
  const def = CONTENT_TABS.find((t) => t.id === tab);
  const msg = def?.emptyMessage ?? 'No content yet.';
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-card)] border border-[var(--color-glass-border)]">
        <span className="text-2xl">📭</span>
      </div>
      <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
        {def?.label ?? tab} — No content yet
      </h3>
      <p className="max-w-xs text-xs text-[var(--color-muted)]">{msg}</p>
    </div>
  );
}

// ─── Tab Content Renderer ──────────────────────────────────────────────

/** AudioPlayer — inline mini player for podcast/music content */
function AudioPlayer({
  isPlaying,
  onToggle,
}: {
  audioUrl: string;
  title?: string;
  isPlaying: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-black transition-all hover:brightness-110"
      aria-label={isPlaying ? 'Pause' : 'Play'}
    >
      <span className="text-sm">{isPlaying ? '⏸' : '▶'}</span>
    </button>
  );
}

export function TabContent({
  tab,
  items,
  posts,
  loading,
}: {
  tab: string;
  items?: TabContentItem[];
  posts?: Array<{ id: string; content?: string }>;
  loading?: boolean;
}) {
  // Backward compat: accept both `items` (new) and `posts` (old)
  const displayItems = items ?? (posts as unknown as TabContentItem[]) ?? [];
  const isAudioTab = tab === 'podcasts' || tab === 'music';
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayToggle = (item: TabContentItem) => {
    if (playingId === item.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (item.audioUrl) {
      const audio = new Audio(item.audioUrl);
      audioRef.current = audio;
      audio.addEventListener('ended', () => setPlayingId(null));
      audio.play().catch(() => {});
      setPlayingId(item.id);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--color-glass-border)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-5 skeleton rounded-full" />
              <div className="h-3 w-20 skeleton rounded" />
            </div>
            <div className="h-4 w-3/4 skeleton rounded mb-2" />
            <div className="h-3 w-1/2 skeleton rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (displayItems.length === 0) {
    return <TabEmptyState tab={tab} />;
  }

  return (
    <div className="space-y-2">
      {displayItems.map((item) => {
        const hasAudio = Boolean(item.audioUrl);

        return (
          <div
            key={item.id}
            className={`rounded-xl border bg-[var(--color-card)] p-3 transition-colors hover:border-degen-500/20 ${
              playingId === item.id
                ? 'border-[var(--color-accent)]'
                : 'border-[var(--color-glass-border)]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs">{getProtocolIcon(item.protocol)}</span>
              <span
                className="text-[10px] font-medium"
                style={{ color: PROTOCOL_COLORS[item.protocol] ?? '#666' }}
              >
                {PROTOCOL_LABELS[item.protocol] || item.protocol}
              </span>
              <span className="text-[10px] text-[var(--color-muted)]">
                {timeAgo(item.createdAt)}
              </span>
              {hasAudio && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                  🎧 Audio
                </span>
              )}
            </div>

            {/* Audio tab: horizontal layout with play button */}
            {isAudioTab && hasAudio ? (
              <div className="flex items-center gap-3">
                <AudioPlayer
                  audioUrl={item.audioUrl!}
                  title={item.title}
                  isPlaying={playingId === item.id}
                  onToggle={() => handlePlayToggle(item)}
                />

                {item.imageUrl && (
                  <div
                    className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-cover bg-center"
                    style={{ backgroundImage: `url(${item.imageUrl})` }}
                  />
                )}

                <div className="min-w-0 flex-1">
                  {item.title && (
                    <p
                      className={`truncate text-sm font-semibold ${playingId === item.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg)]'}`}
                    >
                      {item.title}
                    </p>
                  )}
                  {item.text && (
                    <p className="truncate text-xs text-[var(--color-muted)]">{item.text}</p>
                  )}
                </div>

                {item.engagement && (
                  <div className="flex shrink-0 items-center gap-2 text-[10px] text-[var(--color-muted)]">
                    <span>🎧 {item.engagement.likes}</span>
                    <span>💜 {item.engagement.tips}</span>
                  </div>
                )}
              </div>
            ) : (
              <>
                {item.title && (
                  <h4 className="text-sm font-semibold text-[var(--color-fg)] mb-0.5">
                    {item.title}
                  </h4>
                )}
                {item.text && (
                  <p className="text-sm text-[var(--color-fg)] line-clamp-3">{item.text}</p>
                )}
                {item.imageUrl && (
                  <div className="mt-2 rounded-lg overflow-hidden">
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={640}
                      height={360}
                      className="w-full h-48 object-cover rounded-lg"
                      loading="lazy"
                    />
                  </div>
                )}
                {item.audioUrl && !isAudioTab && (
                  <div className="mt-2 flex items-center gap-2">
                    <AudioPlayer
                      audioUrl={item.audioUrl}
                      isPlaying={playingId === item.id}
                      onToggle={() => handlePlayToggle(item)}
                    />
                    <span className="text-xs text-[var(--color-muted)]">Click to play</span>
                  </div>
                )}
              </>
            )}

            {item.engagement && (
              <div
                className={`flex items-center gap-3 text-[10px] text-[var(--color-muted)] ${
                  isAudioTab && hasAudio ? 'mt-2' : 'mt-2'
                }`}
              >
                <span>❤️ {item.engagement.likes}</span>
                <span>🔄 {item.engagement.shares}</span>
                <span>💬 {item.engagement.comments}</span>
                {item.engagement.tips > 0 && <span>💜 {item.engagement.tips}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Cross-Protocol Activity Feed ──────────────────────────────────────

export function CrossProtocolActivityFeed({
  activities,
  loading,
}: {
  activities: ActivityItem[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2 p-2">
            <div className="h-6 w-6 skeleton rounded-full" />
            <div className="flex-1">
              <div className="h-3 w-3/4 skeleton rounded" />
              <div className="mt-1 h-2 w-1/3 skeleton rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center">
        <p className="text-xs text-[var(--color-muted)]">No recent activity across protocols</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-glass-border)]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
          Cross-Protocol Activity
        </h3>
      </div>
      <div className="divide-y divide-[var(--color-glass-border)]">
        {activities.map((activity) => {
          const cfg = ACTIVITY_CONFIG[activity.type];
          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${cfg?.color ?? '#666'}15` }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={cfg?.color ?? '#666'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={cfg?.icon ?? ''} />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--color-fg)] leading-relaxed">
                  <span
                    className="font-medium"
                    style={{ color: PROTOCOL_COLORS[activity.protocol] ?? '#666' }}
                  >
                    {getProtocolIcon(activity.protocol)}
                  </span>{' '}
                  {activity.message}
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                  {timeAgo(activity.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Creator Tools ─────────────────────────────────────────────────────

export function CreatorToolsQuickActions({
  onCompose,
  onGoLive,
  onCreatePodcast,
  onLaunchCoin,
}: {
  onCompose: () => void;
  onGoLive: () => void;
  onCreatePodcast: () => void;
  onLaunchCoin: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
        Creator Tools
      </h4>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onCompose}
          className="inline-flex items-center gap-1 rounded-lg bg-degen-500/15 px-3 py-1.5 text-[11px] font-medium text-degen-400 transition-colors hover:bg-degen-500/25"
        >
          ✍️ Compose
        </button>
        <button
          type="button"
          onClick={onGoLive}
          className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
        >
          📡 Go Live
        </button>
        <button
          type="button"
          onClick={onCreatePodcast}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-glass-border)] px-3 py-1.5 text-[11px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          🎙️ Podcast
        </button>
        <button
          type="button"
          onClick={onLaunchCoin}
          className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-3 py-1.5 text-[11px] font-medium text-purple-400 transition-colors hover:from-purple-600/30 hover:to-pink-600/30"
        >
          🪙 Launch Coin
        </button>
      </div>
    </div>
  );
}

export function ContentPerformanceWidget({
  performance,
  loading,
}: {
  performance?: ContentPerformance | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
        <div className="h-3 w-24 skeleton rounded mb-3" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 skeleton rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!performance) return null;

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
          Content Performance
        </h4>
        <span className="text-[9px] text-[var(--color-muted)]">{performance.period}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="text-center">
          <div className="text-sm font-bold tabular-nums text-[var(--color-fg)]">
            {formatCount(performance.totalViews)}
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">Views</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold tabular-nums text-[var(--color-fg)]">
            {formatCount(performance.totalLikes)}
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">Likes</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold tabular-nums text-[var(--color-fg)]">
            {formatCount(performance.totalShares)}
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">Shares</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold tabular-nums text-[var(--color-fg)]">
            {performance.engagementRate.toFixed(1)}%
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">Eng. Rate</div>
        </div>
      </div>
      {performance.topPost && (
        <div className="rounded-lg bg-[var(--color-overlay)] px-2.5 py-2">
          <p className="text-[10px] text-[var(--color-muted)] truncate">
            Top: {performance.topPost.text}
          </p>
          <p className="text-[9px] text-degen-400">
            {formatCount(performance.topPost.engagement)} engagements
          </p>
        </div>
      )}
    </div>
  );
}

export function RevenueWidget({
  revenue,
  loading,
}: {
  revenue?: RevenueStats | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
        <div className="h-3 w-20 skeleton rounded mb-3" />
        <div className="h-10 skeleton rounded mb-2" />
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 skeleton rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!revenue) return null;

  const sourceLabels: Record<string, string> = {
    tips: 'Tips',
    subscriptions: 'Subscriptions',
    coinRevenue: 'Coins',
  };

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
          Revenue
        </h4>
        <span className="text-[9px] text-[var(--color-muted)]">{revenue.period}</span>
      </div>
      <div className="text-center mb-3">
        <div className="text-lg font-bold tabular-nums text-green-400">
          ${revenue.totalRevenue.toFixed(2)}
        </div>
        <div className="text-[9px] text-[var(--color-muted)]">Total Revenue</div>
      </div>
      <div className="space-y-1">
        {Object.entries(revenue.revenueBySource).map(([key, amount]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--color-muted)]">
              {sourceLabels[key] ?? key}
            </span>
            <span className="text-[10px] font-medium tabular-nums text-[var(--color-fg)]">
              ${amount.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-[var(--color-glass-border)]">
        <button
          type="button"
          className="w-full text-[10px] text-degen-400 hover:text-degen-300 transition-colors"
        >
          Manage integrations →
        </button>
      </div>
    </div>
  );
}

// ─── Profile Discovery ─────────────────────────────────────────────────

export function ProfileSearchBar({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="relative">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by wallet, npub, FID, DID, handle..."
        className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] py-2.5 pl-10 pr-8 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none transition-all focus:border-degen-500/30"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function ProfileSearchResults({
  results,
  loading,
  onSelect,
}: {
  results: DiscoveredProfile[];
  loading?: boolean;
  onSelect: (profile: DiscoveredProfile) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2 p-2">
            <div className="h-8 w-8 rounded-full skeleton" />
            <div className="flex-1">
              <div className="h-3 w-24 skeleton rounded" />
              <div className="mt-1 h-2 w-16 skeleton rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (results.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
      {results.map((profile) => (
        <button
          key={profile.id}
          type="button"
          onClick={() => onSelect(profile)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5"
        >
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt=""
                width={32}
                height={32}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <span className="text-[8px] font-bold text-degen-400">
                {profile.displayName[0]?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-[var(--color-fg)] truncate">
              {profile.displayName}
            </div>
            {profile.handle && (
              <div className="text-[10px] text-[var(--color-muted)] truncate">
                @{profile.handle}
              </div>
            )}
            {profile.protocols && profile.protocols.length > 0 && (
              <div className="flex gap-1 mt-0.5">
                {profile.protocols.slice(0, 3).map((p) => (
                  <span
                    key={p}
                    className="inline-block text-[8px] font-medium"
                    style={{ color: PROTOCOL_COLORS[p] ?? '#666' }}
                  >
                    {getProtocolIcon(p)}
                  </span>
                ))}
                {profile.protocols.length > 3 && (
                  <span className="text-[8px] text-[var(--color-muted)]">
                    +{profile.protocols.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
          {profile.reason && (
            <span className="shrink-0 text-[9px] text-degen-400">{profile.reason}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function WhoToFollow({
  profiles,
  loading,
}: {
  profiles: DiscoveredProfile[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
        <div className="h-3 w-20 skeleton rounded mb-3" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 skeleton rounded-full" />
            <div className="flex-1">
              <div className="h-3 w-20 skeleton rounded" />
              <div className="mt-0.5 h-2 w-12 skeleton rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (profiles.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
      <h4 className="mb-2 text-xs font-bold text-[var(--color-fg)]">Who to Follow</h4>
      <div className="space-y-2">
        {profiles.map((profile) => (
          <div key={profile.id} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30">
                {profile.avatarUrl ? (
                  <Image
                    src={profile.avatarUrl}
                    alt=""
                    width={28}
                    height={28}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-[7px] font-bold text-degen-400">
                    {profile.displayName[0]?.toUpperCase() || '?'}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-[var(--color-fg)] truncate">
                  {profile.displayName}
                </div>
                {profile.handle && (
                  <div className="text-[9px] text-[var(--color-muted)] truncate">
                    @{profile.handle}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg bg-degen-500/15 px-2.5 py-1 text-[9px] font-semibold text-degen-400 transition-colors hover:bg-degen-500/25"
            >
              + Follow
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendingCreators({
  profiles,
  loading,
}: {
  profiles: DiscoveredProfile[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
        <div className="h-3 w-24 skeleton rounded mb-3" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 skeleton rounded-full" />
            <div className="flex-1">
              <div className="h-3 w-20 skeleton rounded" />
              <div className="mt-0.5 h-2 w-16 skeleton rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (profiles.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-[var(--color-fg)]">Trending Creators</h4>
        <span className="text-[9px] text-degen-400">🔥</span>
      </div>
      <div className="space-y-2">
        {profiles.map((profile, i) => (
          <div key={profile.id} className="flex items-center gap-2">
            <span className="w-4 text-[9px] font-bold text-[var(--color-muted)] tabular-nums">
              {i + 1}
            </span>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30">
              {profile.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-[7px] font-bold text-degen-400">
                  {profile.displayName[0]?.toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-[var(--color-fg)] truncate">
                {profile.displayName}
              </div>
              {profile.followerCount != null && (
                <div className="text-[9px] text-[var(--color-muted)]">
                  {formatCount(profile.followerCount)} followers
                </div>
              )}
            </div>
            {profile.protocols && (
              <div className="flex gap-0.5">
                {profile.protocols.slice(0, 2).map((p) => (
                  <span key={p} className="text-[9px]" style={{ color: PROTOCOL_COLORS[p] }}>
                    {getProtocolIcon(p)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stats Bar (Original) ──────────────────────────────────────────────

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

// ─── Achievement Badges ────────────────────────────────────────────────

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

// ─── Profile Search Input (Original) ───────────────────────────────────

export function ProfileSearchInput({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="relative">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search profiles..."
        className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] py-2.5 pl-10 pr-8 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none transition-all focus:border-degen-500/30"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Search Results (Original) ─────────────────────────────────────────

export function SearchResults({
  results,
  loading,
  onSelect,
}: {
  results: Array<{ id: string; walletAddress?: string; displayName: string; handle?: string }>;
  loading?: boolean;
  onSelect: (result: {
    id: string;
    walletAddress?: string;
    displayName: string;
    handle?: string;
  }) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2 p-2">
            <div className="h-8 w-8 rounded-full skeleton" />
            <div className="flex-1">
              <div className="h-3 w-24 skeleton rounded" />
              <div className="mt-1 h-2 w-16 skeleton rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (results.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
      {results.map((result) => (
        <button
          key={result.id}
          type="button"
          onClick={() => onSelect(result)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-[8px] font-bold text-degen-400">
            {result.displayName[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <div className="text-xs font-medium text-[var(--color-fg)]">{result.displayName}</div>
            {result.handle && (
              <div className="text-[10px] text-[var(--color-muted)]">@{result.handle}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Suggested Follows (Original) ──────────────────────────────────────

export function SuggestedFollows({
  profiles,
}: {
  profiles: Array<{ id: string; displayName: string; handle?: string; reason?: string }>;
}) {
  if (profiles.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
      <h4 className="mb-2 text-xs font-bold text-[var(--color-fg)]">Suggested Follows</h4>
      <div className="space-y-2">
        {profiles.map((profile) => (
          <div key={profile.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-[7px] font-bold text-degen-400">
                {profile.displayName[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div className="text-xs font-medium text-[var(--color-fg)]">
                  {profile.displayName}
                </div>
                {profile.handle && (
                  <div className="text-[9px] text-[var(--color-muted)]">@{profile.handle}</div>
                )}
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg bg-degen-500/15 px-2.5 py-1 text-[9px] font-semibold text-degen-400 transition-colors hover:bg-degen-500/25"
            >
              + Follow
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ProfileTabs (Original — backward compat for [handle] page) ────────

export function ProfileTabs({
  active,
  onTabChange,
}: {
  active: string;
  onTabChange: (tab: string) => void;
}) {
  const oldTabs = [
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
  return (
    <div
      className="border-b border-[var(--color-glass-border)]"
      role="tablist"
      aria-label="Profile content"
    >
      <div className="flex -mb-px">
        {oldTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
              active === tab.id
                ? 'text-[var(--color-fg)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
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

// ─── ProfileHeader (Original — backward compat for [handle] page) ─────

export function ProfileHeader({
  profile,
  onEdit,
  onFollow,
  onUnfollow,
  onMessage,
  onTip,
}: {
  profile: Record<string, unknown>;
  onEdit?: () => void;
  onFollow?: () => void;
  onUnfollow?: () => void;
  onMessage?: () => void;
  onTip?: () => void;
}) {
  const displayName = (profile.displayName as string) ?? 'User';
  const handle = profile.handle as string | undefined;
  const avatarUrl = profile.avatarUrl as string | undefined;
  const bio = profile.bio as string | undefined;
  const isOwnProfile = profile.isOwnProfile as boolean | undefined;

  return (
    <div className="relative mb-16">
      <div className="relative h-32 overflow-hidden rounded-2xl bg-gradient-to-r from-degen-500/20 via-purple-500/10 to-fuchsia-500/20 sm:h-40">
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-transparent to-transparent opacity-50" />
      </div>
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
        {bio && <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted)]">{bio}</p>}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {isOwnProfile && onEdit && (
            <button type="button" onClick={onEdit} className="btn-secondary text-xs">
              Edit Profile
            </button>
          )}
          {!isOwnProfile && onFollow && (
            <button
              type="button"
              onClick={onFollow}
              className="rounded-lg bg-degen-500 px-4 py-2 text-xs font-bold text-white hover:bg-degen-400"
            >
              Follow
            </button>
          )}
          {!isOwnProfile && onUnfollow && (
            <button
              type="button"
              onClick={onUnfollow}
              className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-xs text-[var(--color-muted)]"
            >
              Unfollow
            </button>
          )}
          {onMessage && (
            <button
              type="button"
              onClick={onMessage}
              className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-xs text-[var(--color-muted)]"
            >
              Message
            </button>
          )}
          {onTip && (
            <button
              type="button"
              onClick={onTip}
              className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-xs text-[var(--color-muted)]"
            >
              Tip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Creator Tools Panel (Original) ────────────────────────────────────

export function CreatorToolsPanel({
  tools,
  loading,
  onLaunchCoin,
  onManageCoin,
  onGoLive,
  onCreatePost,
  onCreatePodcast,
  onNewsletter,
}: {
  tools?: {
    coinDashboardUrl?: string;
    totalCoins?: number;
    totalStreams?: number;
    totalPosts?: number;
  } | null;
  loading?: boolean;
  onLaunchCoin: () => void;
  onManageCoin: () => void;
  onGoLive: () => void;
  onCreatePost: () => void;
  onCreatePodcast: () => void;
  onNewsletter: () => void;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <div className="h-5 w-32 skeleton rounded mb-3" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 skeleton rounded-lg" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <h3 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Creator Tools</h3>
      {tools?.totalCoins !== undefined && (
        <div className="mb-2 flex gap-4 text-xs text-[var(--color-muted)]">
          <span>{tools.totalCoins} coins</span>
          <span>{tools.totalStreams ?? 0} streams</span>
          <span>{tools.totalPosts ?? 0} posts</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onLaunchCoin}
          className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-2 text-xs font-bold text-white transition-all hover:from-purple-500 hover:to-pink-500"
        >
          🪙 Launch Coin
        </button>
        <button
          type="button"
          onClick={onManageCoin}
          className="rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          Manage Coins
        </button>
        <button
          type="button"
          onClick={onGoLive}
          className="rounded-lg border border-degen-500/30 px-3 py-2 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/10"
        >
          📡 Go Live
        </button>
        <button
          type="button"
          onClick={onCreatePost}
          className="rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          ✍️ New Post
        </button>
        <button
          type="button"
          onClick={onCreatePodcast}
          className="rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          🎙️ Podcast
        </button>
        <button
          type="button"
          onClick={onNewsletter}
          className="rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          📬 Newsletter
        </button>
      </div>
    </div>
  );
}
