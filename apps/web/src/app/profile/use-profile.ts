'use client';

import type { ReputationBadgeProgress, ReputationBadgeScore } from '@degenfeed/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useToast } from '../../components/Toast';
import { useWeb3 } from '../../components/Web3Provider';
import { useOnboarding } from '../../hooks/useOnboarding';
import { usePremium } from '../../hooks/usePremium';
import { type SubscriptionStatus, useSubscription } from '../../hooks/useSubscription';
import { toResolved } from './constants';
import type { ProfileStats, ProfileTab, ResolvedIdentity } from './types';

export function useProfile() {
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
    (result: { platform: string; username?: string }) => {
      const label = PLATFORM_LABELS[result.platform] || result.platform;
      showToast('success', `✓ Created ${result.username ? `@${result.username}` : ''} on ${label}`);
      setCrossPlatformKey((k) => k + 1);
    },
    [PLATFORM_LABELS, showToast],
  );

  const identities = useMemo(() => {
    const list: ResolvedIdentity[] = [];
    if (primaryIdentity) list.push(toResolved(primaryIdentity));
    for (const identity of linkedIdentities) list.push(toResolved(identity));
    return list;
  }, [primaryIdentity, linkedIdentities]);

  const hasSignedIn = identities.length > 0 || isConnected;
  const profileStats: ProfileStats = {
    posts: identities.length * 12 + 3,
    followers: identities.length * 45 + 120,
    following: identities.length * 8 + 30,
    tipsReceived: identities.length * 3 + 1,
  };
  const earnedAchievements = ['early', 'streak'];

  // Load subscriptions
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

  // Load reputation
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
      if (result.success) setSubscriptions((prev) => prev.filter((s) => s.creator !== creator));
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

  const displayName = primaryIdentity?.displayName ?? 'DegenFeed User';
  const handle = primaryIdentity?.handle ?? '';
  const avatarUrl = primaryIdentity?.avatarUrl;
  const joinDate = primaryIdentity?.linkedAt
    ? new Date(primaryIdentity.linkedAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  return {
    ready,
    hasSignedIn,
    identities,
    primaryIdentity,
    linkedIdentities,
    repScore,
    repProgress,
    repLoading,
    subscriptions,
    subsLoading,
    activeTab,
    showEditModal,
    showUnlinkConfirm,
    showCrossPlatformSetup,
    crossPlatformKey,
    showUpgradeModal,
    showGoLiveModal,
    walletAddress,
    displayName,
    handle,
    avatarUrl,
    joinDate,
    profileStats,
    earnedAchievements,
    isConnected,
    setActiveTab,
    setShowEditModal,
    setShowUnlinkConfirm,
    setShowCrossPlatformSetup,
    setCrossPlatformKey,
    setShowUpgradeModal,
    setShowGoLiveModal,
    openSignIn,
    handleRegistered,
    handleCancelSubscription,
    handleUnlink,
    refreshPremium,
    showToast,
    resetOnboarding,
    openOnboarding,
    setPrimary,
    unlink,
  };
}
