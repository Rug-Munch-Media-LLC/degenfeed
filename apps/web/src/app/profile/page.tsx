'use client';

import type { StoredIdentity } from '@degenfeed/storage';
import type { ReputationBadgeProgress, ReputationBadgeScore } from '@degenfeed/ui';
import {
  CrossPlatformCard,
  CrossPlatformSetup,
  ErrorBoundary,
  type PlatformAccount,
  type RegisterPlatformStatusData,
  ReputationBadge,
} from '@degenfeed/ui';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import {
  CredentialCard,
  CredentialSecurityNote,
  CredentialsProgressBanner,
  registrationToCredential,
} from '../../components/CredentialsDisplay';
import { EditProfileModal } from '../../components/EditProfileModal';
import { IdentityLinker } from '../../components/IdentityLinker';
import { PremiumPaymentModal } from '../../components/PremiumPaymentModal';
import { useToast } from '../../components/Toast';
import { useWeb3 } from '../../components/Web3Provider';
import { useOnboarding } from '../../hooks/useOnboarding';
import { usePremium } from '../../hooks/usePremium';
import { type SubscriptionStatus, useSubscription } from '../../hooks/useSubscription';
import { GoLiveModal } from '../../components/streams/GoLiveModal';

export const dynamic = 'force-dynamic';

/* ─── Constants ──────────────────────────────────────────────── */

const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8b5cf6',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
  threads: '#888',
  ethereum: '#627eea',
  solana: '#9945ff',
};

const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  threads: 'Threads (Experimental)',
  ethereum: 'EVM',
  solana: 'Solana',
};

/* ─── Types ──────────────────────────────────────────────────── */

interface ResolvedIdentity {
  id: string;
  protocol: string;
  displayName?: string;
  handle?: string;
  avatarUrl?: string;
  address?: string;
  color: string;
  isPrimary: boolean;
  verified: boolean;
}

interface ProfileStats {
  posts: number;
  followers: number;
  following: number;
  tipsReceived: number;
}

type ProfileTab = 'posts' | 'replies' | 'media' | 'likes';

/* ─── Helpers ────────────────────────────────────────────────── */

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function toResolved(identity: StoredIdentity): ResolvedIdentity {
  const isWallet = identity.protocol === 'ethereum' || identity.protocol === 'solana';
  return {
    id: identity.id,
    protocol: identity.protocol,
    displayName: identity.displayName,
    handle: identity.handle,
    avatarUrl: identity.avatarUrl,
    address: isWallet ? identity.publicId : undefined,
    color: PROTOCOL_COLORS[identity.protocol] ?? '#666',
    isPrimary: identity.isPrimary,
    verified: identity.verified ?? false,
  };
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* ─── Skeleton ───────────────────────────────────────────────── */

function ProfileSkeleton() {
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

/* ─── Stats Grid ─────────────────────────────────────────────── */

function StatsBar({ stats }: { stats: ProfileStats }) {
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

/* ─── Protocol Badges ────────────────────────────────────────── */

function ProtocolBadgesRow({ identities }: { identities: ResolvedIdentity[] }) {
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

/* ─── Achievement Badges ─────────────────────────────────────── */

const ACHIEVEMENTS = [
  { id: 'early', label: 'Early Adopter', icon: '🌅', color: 'from-amber-400 to-orange-500' },
  { id: 'streak', label: '7-Day Streak', icon: '🔥', color: 'from-red-400 to-rose-500' },
  { id: 'top-post', label: 'Top Post', icon: '🏆', color: 'from-yellow-400 to-amber-500' },
  { id: 'helper', label: 'Helping Hand', icon: '🤝', color: 'from-blue-400 to-indigo-500' },
  { id: 'creator', label: 'Creator', icon: '✨', color: 'from-purple-400 to-fuchsia-500' },
];

function AchievementBadges({ earned }: { earned: string[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {ACHIEVEMENTS.map((badge) => {
        const unlocked = earned.includes(badge.id);
        return (
          <div
            key={badge.id}
            className={`group relative flex flex-col items-center gap-1 transition-all ${
              unlocked ? 'opacity-100' : 'opacity-30 grayscale'
            }`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${badge.color} shadow-lg transition-transform group-hover:scale-110 ${
                unlocked ? '' : 'saturate-0'
              }`}
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

/* ─── Tabs ───────────────────────────────────────────────────── */

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

function ProfileTabs({
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
            className={`relative flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors
              ${
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

/* ─── Empty State for Tabs ───────────────────────────────────── */

function TabEmptyState({ tab }: { tab: ProfileTab }) {
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

/* ─── Main Profile Page ──────────────────────────────────────── */

export default function ProfilePage() {
  const {
    walletAddress,
    primaryIdentity,
    linkedIdentities,
    ready,
    openSignIn,
    setPrimaryIdentity: setPrimary,
    unlinkIdentity: unlink,
  } = useAuth();
  const [repScore, setRepScore] = useState<ReputationBadgeScore | null>(null);
  const [repProgress, setRepProgress] = useState<ReputationBadgeProgress | null>(null);
  const [repLoading, setRepLoading] = useState(false);
  const { isConnected } = useWeb3();
  const { cancelSubscription } = useSubscription();
  const { reset: resetOnboarding, open: openOnboarding } = useOnboarding();

  const [subscriptions, setSubscriptions] = useState<SubscriptionStatus[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState<string | null>(null);
  const [showCrossPlatformSetup, setShowCrossPlatformSetup] = useState(false);
  const [crossPlatformKey, setCrossPlatformKey] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const { showToast } = useToast();
  const { refresh: refreshPremium } = usePremium();

  const PLATFORM_LABELS: Record<string, string> = useMemo(
    () => ({
      farcaster: 'Farcaster',
      lens: 'Lens',
      bluesky: 'Bluesky',
      mastodon: 'Mastodon',
      nostr: 'Nostr',
    }),
    [],
  );

  const handleRegistered = useCallback(
    (result: PlatformAccount) => {
      const label = PLATFORM_LABELS[result.platform] || result.platform;
      const atUsername = result.username ? `@${result.username}` : '';
      showToast('success', `✓ Created ${atUsername} on ${label}`);
      // Increment key to force CrossPlatformCard/Settings to refetch status
      setCrossPlatformKey((k) => k + 1);
    },
    [PLATFORM_LABELS, showToast],
  );

  const handleOpenSetup = useCallback(() => {
    setShowCrossPlatformSetup(true);
  }, []);

  const identities = useMemo(() => {
    const list: ResolvedIdentity[] = [];
    if (primaryIdentity) list.push(toResolved(primaryIdentity));
    for (const identity of linkedIdentities) list.push(toResolved(identity));
    return list;
  }, [primaryIdentity, linkedIdentities]);

  const hasSignedIn = identities.length > 0 || isConnected;
  const primaryIsWallet =
    primaryIdentity?.protocol === 'ethereum' || primaryIdentity?.protocol === 'solana';

  // Fake stats for now — wire to real API later
  const profileStats: ProfileStats = {
    posts: identities.length * 12 + 3,
    followers: identities.length * 45 + 120,
    following: identities.length * 8 + 30,
    tipsReceived: identities.length * 3 + 1,
  };

  const earnedAchievements = ['early', 'streak'];

  /* ─── Data loading ────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    async function loadSubscriptions() {
      try {
        setSubsLoading(true);
        const res = await fetch('/api/subscription/my', { credentials: 'include' });
        if (res.ok) {
          const data = (await res.json()) as {
            subscriptions: Array<{
              creator: string;
              tier: string;
              amount: string;
              startDate: number;
              expiryDate: number;
              daysRemaining: number;
            }>;
          };
          if (!cancelled) {
            setSubscriptions(
              data.subscriptions.map((s) => ({
                active: true,
                creator: s.creator,
                daysRemaining: s.daysRemaining,
                subscription: {
                  tier: s.tier,
                  amount: s.amount,
                  method: 'ethereum' as const,
                  startDate: s.startDate,
                  expiryDate: s.expiryDate,
                },
              })),
            );
          }
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setSubsLoading(false);
    }
    loadSubscriptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const userId = primaryIdentity?.publicId ?? walletAddress;
    if (!userId) return;
    let cancelled = false;
    async function loadReputation() {
      try {
        setRepLoading(true);
        const res = await fetch(`/api/reputation/${encodeURIComponent(userId ?? '')}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = (await res.json()) as ReputationBadgeScore & {
            progress: ReputationBadgeProgress;
          };
          if (!cancelled) {
            setRepScore({
              total: data.total,
              earned: data.earned,
              staked: data.staked,
              slashed: data.slashed,
              level: data.level,
            });
            if (data.progress) setRepProgress(data.progress);
          }
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setRepLoading(false);
    }
    loadReputation();
    return () => {
      cancelled = true;
    };
  }, [primaryIdentity, walletAddress]);

  const handleCancelSubscription = useCallback(
    async (creator: string) => {
      const result = await cancelSubscription(creator);
      if (result.success) {
        setSubscriptions((prev) => prev.filter((s) => s.creator !== creator));
      }
    },
    [cancelSubscription],
  );

  const handleUnlink = useCallback(
    async (id: string) => {
      await unlink(id);
      setShowUnlinkConfirm(null);
    },
    [unlink],
  );

  if (!ready) return <ProfileSkeleton />;

  const displayName = primaryIdentity?.displayName ?? 'DegenFeed User';
  const handle = primaryIdentity?.handle ?? '';
  const avatarUrl = primaryIdentity?.avatarUrl;
  const joinDate = primaryIdentity?.linkedAt
    ? new Date(primaryIdentity.linkedAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter">
        {!hasSignedIn ? (
          <>
            {/* ── Hero ── */}
            <div className="mb-8 flex flex-col items-center py-12">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/30 via-purple-500/20 to-fuchsia-500/30 shadow-[0_0_40px_rgba(34,197,94,0.15)]">
                <span className="text-4xl font-bold text-[var(--color-fg)]">?</span>
              </div>
              <h1 className="mb-2 text-2xl font-bold text-[var(--color-fg)]">
                Welcome to DegenFeed
              </h1>
              <p className="mb-6 text-sm text-[var(--color-muted)]">
                Connect accounts to build your unified identity
              </p>
              <button onClick={openSignIn} className="btn-primary" type="button">
                Connect an account
              </button>
            </div>

            {/* ── How it works ── */}
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: '🔗',
                  title: 'Link Protocols',
                  desc: 'Connect Nostr, Farcaster, Lens, Bluesky, and more',
                },
                {
                  icon: '🆔',
                  title: 'Unified Identity',
                  desc: 'One profile that spans all your networks',
                },
                { icon: '📡', title: 'Cross-Post', desc: 'Post once, share everywhere' },
              ].map((step) => (
                <div key={step.title} className="card text-center">
                  <div className="mb-2 text-2xl">{step.icon}</div>
                  <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
                    {step.title}
                  </h3>
                  <p className="text-xs text-[var(--color-muted)]">{step.desc}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* ════════════════════════════════════════════════════
               PROFILE HEADER
            ════════════════════════════════════════════════════ */}
            <div className="mb-8">
              {/* Cover / Banner area */}
              <div className="relative mb-16 h-32 overflow-hidden rounded-2xl bg-gradient-to-r from-degen-500/20 via-purple-500/10 to-fuchsia-500/20 sm:h-40">
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-transparent to-transparent opacity-50" />
              </div>

              {/* Avatar */}
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

              {/* Name + handle */}
              <div className="text-center">
                <h1 className="text-2xl font-bold text-[var(--color-fg)]">{displayName}</h1>
                {handle && <p className="mt-0.5 text-sm text-[var(--color-muted)]">@{handle}</p>}
                {joinDate && (
                  <p className="mt-1 text-xs text-[var(--color-muted)]">Joined {joinDate}</p>
                )}
                {primaryIdentity?.bio && (
                  <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted)]">
                    {primaryIdentity.bio}
                  </p>
                )}
              </div>

              {/* Reputation Level Badge */}
              {repScore && !repLoading && (
                <div className="mt-3 flex justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-degen-500/20 bg-degen-500/10 px-4 py-1.5">
                    <ReputationBadge
                      score={repScore}
                      progress={repProgress}
                      size="sm"
                      showIcon={true}
                      showLabel={true}
                      showTooltip={false}
                      showProgress={false}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ════════════════════════════════════════════════════
               STATS BAR
            ════════════════════════════════════════════════════ */}
            <div className="mb-6">
              <StatsBar stats={profileStats} />
            </div>

            {/* ════════════════════════════════════════════════════
                PROTOCOL BADGES
            ════════════════════════════════════════════════════ */}
            <div className="mb-6">
              <ProtocolBadgesRow identities={identities} />
            </div>

            {/* ════════════════════════════════════════════════════
                CROSS-PLATFORM SETUP (Full)
            ════════════════════════════════════════════════════ */}
            {showCrossPlatformSetup && (
              <div className="mb-6" id="cross-platform-setup">
                <CrossPlatformSetup
                  key={crossPlatformKey}
                  walletAddress={walletAddress ?? ''}
                  onRegistered={handleRegistered}
                  onUpgrade={() => setShowUpgradeModal(true)}
                />
              </div>
            )}

            {/* ════════════════════════════════════════════════════
                ACTION BUTTONS
            ════════════════════════════════════════════════════ */}
            <div className="mb-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="btn-primary text-sm"
              >
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => setShowGoLiveModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-degen-500 to-emerald-500 px-4 py-2 text-sm font-bold text-black shadow-lg shadow-degen-500/20 transition-all hover:from-degen-400 hover:to-emerald-400 active:scale-[0.97]"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-black" />
                </span>
                Go Live
              </button>
              <button type="button" onClick={openSignIn} className="btn-secondary text-sm">
                Link Account
              </button>
            </div>

            {/* Go Live Modal */}
            <GoLiveModal
              isOpen={showGoLiveModal}
              onClose={() => setShowGoLiveModal(false)}
              defaultSurfaces={['profile', 'visual-feed', 'discover']}
            />

            {/* ════════════════════════════════════════════════════
               ACHIEVEMENT BADGES
            ════════════════════════════════════════════════════ */}
            <div className="mb-8">
              <AchievementBadges earned={earnedAchievements} />
            </div>

            {/* ════════════════════════════════════════════════════
               TABS
            ════════════════════════════════════════════════════ */}
            <ProfileTabs active={activeTab} onTabChange={setActiveTab} />

            <div className="py-4">
              <TabEmptyState tab={activeTab} />
            </div>

            {/* ════════════════════════════════════════════════════
               REPUTATION SECTION
            ════════════════════════════════════════════════════ */}
            <div className="mb-8">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
                Reputation
              </h2>
              <div className="card border-degen-500/20 bg-gradient-to-br from-degen-500/[0.03] to-transparent">
                {repLoading ? (
                  <div className="flex items-center gap-3 py-2">
                    <div className="h-3 w-24 skeleton rounded" />
                  </div>
                ) : repScore ? (
                  <div className="space-y-3">
                    <ReputationBadge
                      score={repScore}
                      progress={repProgress}
                      size="md"
                      showIcon={true}
                      showLabel={true}
                      showTooltip={true}
                      showProgress={true}
                    />
                    {repProgress && (
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-[var(--color-muted)]">
                          <span>{repScore.total.toLocaleString()} pts</span>
                          <span className="text-degen-400">
                            {repProgress.currentMin.toLocaleString()} →{' '}
                            {repProgress.next
                              ? `${repProgress.nextMin.toLocaleString()} to ${repProgress.next}`
                              : 'Max level'}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]/30">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.round((repProgress.progress || 0) * 100)}%`,
                              background: 'linear-gradient(90deg, var(--color-accent), #22c55e, #4ade80)',
                            }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-[var(--color-muted)]">
                      <span>
                        Earned:{' '}
                        <strong className="text-green-400">
                          +{repScore.earned.toLocaleString()}
                        </strong>
                      </span>
                      <span>
                        Staked:{' '}
                        <strong className="text-blue-400">
                          {repScore.staked.toLocaleString()}
                        </strong>
                      </span>
                      <span>
                        Slashed:{' '}
                        <strong className="text-red-400">
                          -{repScore.slashed.toLocaleString()}
                        </strong>
                      </span>
                    </div>
                    <a
                      href="/reputation"
                      className="inline-block rounded-lg bg-degen-500/20 px-3 py-1.5 text-xs font-medium text-degen-400 hover:bg-degen-500/30 transition-colors"
                    >
                      View history →
                    </a>
                  </div>
                ) : (
                  <div className="py-2 text-center">
                    <p className="text-xs text-[var(--color-muted)]">
                      Start posting to earn reputation points and unlock higher tiers.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ════════════════════════════════════════════════════
               CONNECTED IDENTITIES + LINKER
            ════════════════════════════════════════════════════ */}
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
                  Connected Identities
                </h2>
                <span className="rounded-full bg-[var(--color-muted)]/20 px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
                  {identities.length}
                </span>
              </div>
              <div className="space-y-2">
                {identities.map((id) => (
                  <div key={id.id} className="card-hover flex items-center gap-4">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base"
                      style={{ backgroundColor: `${id.color}22`, color: id.color }}
                    >
                      {id.avatarUrl ? (
                        <Image
                          src={id.avatarUrl}
                          alt={`${PROTOCOL_LABELS[id.protocol] || id.protocol} avatar`}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-base font-bold">
                          {PROTOCOL_LABELS[id.protocol]?.charAt(0) || '?'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--color-fg)] truncate">
                          {id.displayName || PROTOCOL_LABELS[id.protocol] || id.protocol}
                        </span>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: `${id.color}22`, color: id.color }}
                        >
                          {PROTOCOL_LABELS[id.protocol] || id.protocol}
                        </span>
                        {id.verified && (
                          <span className="shrink-0 text-degen-400" title="Verified">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                            </svg>
                          </span>
                        )}
                        {id.isPrimary && (
                          <span className="shrink-0 rounded-full bg-degen-500/20 px-2 py-0.5 text-[10px] font-medium text-degen-400">
                            Primary
                          </span>
                        )}
                      </div>
                      {id.address ? (
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-[var(--color-muted)] font-mono">
                            {shortenAddress(id.address)}
                          </code>
                          <button
                            onClick={() => navigator.clipboard.writeText(id.address ?? '')}
                            className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                            type="button"
                            aria-label="Copy address"
                          >
                            copy
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-[var(--color-muted)] truncate">
                          {id.handle || ''}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!id.isPrimary && (
                        <>
                          {(!primaryIsWallet ||
                            id.protocol === 'ethereum' ||
                            id.protocol === 'solana') && (
                            <button
                              onClick={() => setPrimary(id.id)}
                              className="rounded-lg bg-[var(--color-muted)]/20 px-2 py-1 text-[11px] text-[var(--color-muted)] hover:bg-[var(--color-muted)]/40 hover:text-[var(--color-fg)] transition-colors"
                              type="button"
                            >
                              Set primary
                            </button>
                          )}
                          {showUnlinkConfirm === id.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleUnlink(id.id)}
                                className="rounded-lg bg-red-500/20 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/30 transition-colors"
                                type="button"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setShowUnlinkConfirm(null)}
                                className="rounded-lg bg-[var(--color-muted)]/20 px-2 py-1 text-[11px] text-[var(--color-muted)] hover:bg-[var(--color-muted)]/40 transition-colors"
                                type="button"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowUnlinkConfirm(id.id)}
                              className="rounded-lg bg-red-500/10 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/20 transition-colors"
                              type="button"
                            >
                              Unlink
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <IdentityLinker />
              </div>
            </div>

            {/* ════════════════════════════════════════════════════
                CROSS-PLATFORM CARD (Compact Summary)
            ════════════════════════════════════════════════════ */}
            <div className="mb-8">
              <CrossPlatformCard
                key={crossPlatformKey}
                walletAddress={walletAddress ?? ''}
                onOpenSetup={handleOpenSetup}
                onUpgrade={() => setShowUpgradeModal(true)}
              />
            </div>

            {/* ════════════════════════════════════════════════════
                PORTABLE CREDENTIALS
            ════════════════════════════════════════════════════ */}
            <ProfileCredentialsSection walletAddress={walletAddress} />

            {/* ════════════════════════════════════════════════════
                LINKS
            ════════════════════════════════════════════════════ */}
            <div className="grid gap-3 sm:grid-cols-2">
              <a href="/profile/bookmarks" className="card-hover flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10 text-purple-400">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--color-fg)]">Bookmarks</div>
                  <div className="text-xs text-[var(--color-muted)]">
                    Posts saved across all protocols
                  </div>
                </div>
                <span className="ml-auto text-xs text-[var(--color-muted)]">→</span>
              </a>
              <a href="/profile/achievements" className="card-hover flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-400">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="M12 15l-2 5 2-1 2 1-2-5z" />
                    <circle cx="12" cy="8" r="6" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--color-fg)]">Achievements</div>
                  <div className="text-xs text-[var(--color-muted)]">
                    Track your badges and progress
                  </div>
                </div>
                <span className="ml-auto text-xs text-[var(--color-muted)]">→</span>
              </a>
              <a href="/settings" className="card-hover flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-overlay)] text-[var(--color-muted)]">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--color-fg)]">Settings</div>
                  <div className="text-xs text-[var(--color-muted)]">
                    Preferences, notifications, privacy
                  </div>
                </div>
                <span className="ml-auto text-xs text-[var(--color-muted)]">→</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  resetOnboarding();
                  openOnboarding();
                }}
                className="card-hover flex items-center gap-3 text-left"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-degen-500/10 text-degen-400">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--color-fg)]">
                    Onboarding Tour
                  </div>
                  <div className="text-xs text-[var(--color-muted)]">Re-take the tour</div>
                </div>
                <span className="ml-auto text-sm text-[var(--color-muted)]">🔄</span>
              </button>
            </div>

            {/* ════════════════════════════════════════════════════
               SUBSCRIPTIONS
            ════════════════════════════════════════════════════ */}
            {subscriptions.length > 0 && (
              <div className="mb-8">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
                    Your Subscriptions
                  </h2>
                  <a
                    href="/profile/subscriptions"
                    className="rounded-lg bg-[var(--color-muted)]/20 px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted)]/40 transition-colors"
                  >
                    View all
                  </a>
                </div>
                <div className="card border-degen-500/20 bg-degen-500/[0.03] space-y-3">
                  {subsLoading ? (
                    <div className="flex items-center gap-3 py-2">
                      <div className="h-3 w-24 skeleton rounded" />
                    </div>
                  ) : (
                    subscriptions.map((sub) => (
                      <div
                        key={sub.creator}
                        className="card-hover flex items-center justify-between !bg-[var(--color-card)]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
                              {shortenAddress(sub.creator)}
                            </span>
                            <span className="shrink-0 rounded-full bg-degen-500/20 px-2 py-0.5 text-[10px] font-medium text-degen-400">
                              {sub.subscription?.tier ?? 'Active'}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-[var(--color-muted)]">
                            Expires:{' '}
                            {sub.subscription?.expiryDate
                              ? new Date(sub.subscription.expiryDate).toLocaleDateString()
                              : 'N/A'}
                            {' · '}
                            <span className={sub.active ? 'text-green-400' : 'text-red-400'}>
                              {sub.active ? 'Active' : 'Expired'}
                            </span>
                          </div>
                        </div>
                        {sub.active && (
                          <button
                            onClick={() => handleCancelSubscription(sub.creator)}
                            className="shrink-0 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                            type="button"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Edit Profile Modal ── */}
        <EditProfileModal open={showEditModal} onClose={() => setShowEditModal(false)} />

        {/* ── Premium Upgrade Modal ── */}
        <PremiumPaymentModal
          open={showUpgradeModal}
          onClose={() => {
            setShowUpgradeModal(false);
            refreshPremium();
          }}
          onSuccess={refreshPremium}
        />
      </div>
    </ErrorBoundary>
  );
}

// ─── Portable Credentials Section for Profile ─────────────────────────────

function ProfileCredentialsSection({ walletAddress }: { walletAddress?: string }) {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }
    fetch('/api/register-platform/status', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { data: RegisterPlatformStatusData }) => {
        setAccounts(d.data.accounts ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [walletAddress]);

  if (loading) return null;

  const createdAccounts = accounts.filter((a) => a.status === 'created');
  if (createdAccounts.length === 0) return null;

  const credentialCards = createdAccounts
    .map((a) => registrationToCredential(a as Parameters<typeof registrationToCredential>[0]))
    .filter(Boolean) as NonNullable<ReturnType<typeof registrationToCredential>>[];

  if (credentialCards.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
        Portable Credentials
      </h2>
      <p className="mb-3 text-xs text-[var(--color-muted)]">
        Use these credentials to login on any Mastodon/Lemmy/PeerTube app. You own this account.
      </p>
      <CredentialsProgressBanner connectedCount={createdAccounts.length} totalPlatforms={5} />
      <div className="mt-3 space-y-3">
        {credentialCards.map((card) => (
          <CredentialCard key={card.platform} credential={card} />
        ))}
      </div>
      <div className="mt-3">
        <CredentialSecurityNote />
      </div>
    </div>
  );
}
