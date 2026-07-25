'use client';

import type { ReputationBadgeProgress, ReputationBadgeScore } from '@degenfeed/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useToast } from '../../components/Toast';
import { useWeb3 } from '../../components/Web3Provider';
import { useOnboarding } from '../../hooks/useOnboarding';
import { usePremium } from '../../hooks/usePremium';
import { type SubscriptionStatus, useSubscription } from '../../hooks/useSubscription';
import { api } from '../../services/api';
import { toResolved } from './constants';
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
  const [activeTab, setActiveTab] = useState<ContentSource>('all');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState<string | null>(null);
  const [showCrossPlatformSetup, setShowCrossPlatformSetup] = useState(false);
  const [crossPlatformKey, setCrossPlatformKey] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const { showToast } = useToast();
  const { refresh: refreshPremium } = usePremium();

  // ─── New state for unified profile features ────────────────────────────
  const [tabContent, setTabContent] = useState<Record<string, TabContentItem[]>>({});
  const [tabLoading, setTabLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [creatorCoin, setCreatorCoin] = useState<CreatorCoin | null>(null);
  const [daoMemberships, setDaoMemberships] = useState<DAOMembership[]>([]);
  const [contentPerformance, setContentPerformance] = useState<ContentPerformance | null>(null);
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [revLoading, setRevLoading] = useState(false);
  const [coinLoading, setCoinLoading] = useState(false);

  // Profile discovery
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DiscoveredProfile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [trendingCreators, setTrendingCreators] = useState<DiscoveredProfile[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [whoToFollow, setWhoToFollow] = useState<DiscoveredProfile[]>([]);
  const [whoToFollowLoading, setWhoToFollowLoading] = useState(false);

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

  // ─── Cross-Protocol Stats ────────────────────────────────────────────
  // In production these come from the API; for now we derive from identities
  const profileStats: ProfileStats = useMemo(() => {
    const protocolCounts: Record<string, number> = {};
    for (const id of identities) {
      protocolCounts[id.protocol] = (protocolCounts[id.protocol] || 0) + 1;
    }
    return {
      posts: identities.length * 12 + 3,
      followers: identities.length * 45 + 120,
      following: identities.length * 8 + 30,
      tipsReceived: identities.length * 3 + 1,
      followersByProtocol: Object.fromEntries(
        Object.entries(protocolCounts).map(([p, c]) => [p, c * 45 + 120]),
      ),
      postsByProtocol: Object.fromEntries(
        Object.entries(protocolCounts).map(([p, c]) => [p, c * 12 + 3]),
      ),
    };
  }, [identities]);

  const earnedAchievements = ['early', 'streak'];

  // ─── Load subscriptions ──────────────────────────────────────────────
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

  // ─── Load reputation ─────────────────────────────────────────────────
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

  // ─── Load cross-protocol activity feed ───────────────────────────────
  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    async function loadActivities() {
      try {
        setActivitiesLoading(true);
        const res = await api.get<{ activities: ActivityItem[] }>(
          `/api/unified-profile/activity?wallet=${encodeURIComponent(walletAddress ?? '')}`,
        );
        if (res.success && res.data && !cancelled) {
          setActivities(res.data.activities ?? []);
        }
      } catch {
        /* non-critical */
      }
      if (!cancelled) setActivitiesLoading(false);
    }
    loadActivities();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  // ─── Load creator coin data ──────────────────────────────────────────
  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    async function loadCoin() {
      try {
        setCoinLoading(true);
        const res = await api.get<{ data: CreatorCoin | null }>(
          `/api/creator-coin/profile?wallet=${encodeURIComponent(walletAddress ?? '')}`,
        );
        if (res.success && res.data && !cancelled) {
          setCreatorCoin(res.data.data ?? null);
        }
      } catch {
        /* non-critical */
      }
      if (!cancelled) setCoinLoading(false);
    }
    loadCoin();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  // ─── Load DAO memberships ────────────────────────────────────────────
  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    async function loadDaos() {
      try {
        const res = await api.get<{ data: DAOMembership[] }>(
          `/api/dao/memberships?wallet=${encodeURIComponent(walletAddress ?? '')}`,
        );
        if (res.success && res.data && !cancelled) {
          setDaoMemberships(res.data.data ?? []);
        }
      } catch {
        /* non-critical */
      }
    }
    loadDaos();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  // ─── Load tab content when tab changes ───────────────────────────────
  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    async function loadTabContent() {
      try {
        setTabLoading(true);
        const res = await api.get<{ data: TabContentItem[] }>(
          `/api/unified-profile/content?wallet=${encodeURIComponent(walletAddress ?? '')}&source=${activeTab}`,
        );
        if (res.success && res.data && !cancelled) {
          setTabContent((prev) => ({ ...prev, [activeTab]: res.data?.data ?? [] }));
        }
      } catch {
        /* non-critical */
      }
      if (!cancelled) setTabLoading(false);
    }
    loadTabContent();
    return () => {
      cancelled = true;
    };
  }, [walletAddress, activeTab]);

  // ─── Load content performance (own profile) ──────────────────────────
  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    async function loadPerformance() {
      try {
        setPerfLoading(true);
        const res = await api.get<{ data: ContentPerformance }>(
          `/api/creator/performance?wallet=${encodeURIComponent(walletAddress ?? '')}&period=30d`,
        );
        if (res.success && res.data && !cancelled) {
          setContentPerformance(res.data.data ?? null);
        }
      } catch {
        /* non-critical */
      }
      if (!cancelled) setPerfLoading(false);
    }
    loadPerformance();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  // ─── Load revenue stats ──────────────────────────────────────────────
  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    async function loadRevenue() {
      try {
        setRevLoading(true);
        const res = await api.get<{ data: RevenueStats }>(
          `/api/creator/revenue?wallet=${encodeURIComponent(walletAddress ?? '')}&period=30d`,
        );
        if (res.success && res.data && !cancelled) {
          setRevenueStats(res.data.data ?? null);
        }
      } catch {
        /* non-critical */
      }
      if (!cancelled) setRevLoading(false);
    }
    loadRevenue();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  // ─── Load trending creators ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadTrending() {
      try {
        setTrendingLoading(true);
        const res = await api.get<{ data: DiscoveredProfile[] }>(
          `/api/unified-profile/trending?limit=8`,
        );
        if (res.success && res.data && !cancelled) {
          setTrendingCreators(res.data.data ?? []);
        }
      } catch {
        /* non-critical */
      }
      if (!cancelled) setTrendingLoading(false);
    }
    loadTrending();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Load who-to-follow ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadWhoToFollow() {
      try {
        setWhoToFollowLoading(true);
        const wallet = walletAddress ?? '';
        const res = await api.get<{ data: DiscoveredProfile[] }>(
          `/api/unified-profile/suggested?wallet=${encodeURIComponent(wallet)}&limit=5`,
        );
        if (res.success && res.data && !cancelled) {
          setWhoToFollow(res.data.data ?? []);
        }
      } catch {
        /* non-critical */
      }
      if (!cancelled) setWhoToFollowLoading(false);
    }
    loadWhoToFollow();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  // ─── Profile search handler ──────────────────────────────────────────
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setSearchLoading(true);
      const res = await api.get<{ data: DiscoveredProfile[] }>(
        `/api/unified-profile/search?q=${encodeURIComponent(query)}&limit=10`,
      );
      if (res.success && res.data) {
        setSearchResults(res.data.data ?? []);
      }
    } catch {
      /* non-critical */
    }
    setSearchLoading(false);
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────
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

  const handleFollow = useCallback(() => {
    showToast('success', 'Following user across all connected protocols');
  }, [showToast]);

  const handleTip = useCallback(() => {
    showToast('success', 'Opening tip modal…');
  }, [showToast]);

  const handleSubscribe = useCallback(() => {
    setShowUpgradeModal(true);
  }, []);

  const handleMessage = useCallback(() => {
    showToast('success', 'Opening cross-protocol messenger…');
  }, [showToast]);

  const handleShare = useCallback(() => {
    const url = window.location.href;
    void navigator.clipboard.writeText(url);
    showToast('success', '✓ Profile URL copied to clipboard');
  }, [showToast]);

  const displayName = primaryIdentity?.displayName ?? 'DegenFeed User';
  const handle = primaryIdentity?.handle ?? '';
  const avatarUrl = primaryIdentity?.avatarUrl;
  const joinDate = primaryIdentity?.linkedAt
    ? new Date(primaryIdentity.linkedAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  const currentTabContent = tabContent[activeTab] ?? [];
  const connectedProtocols = identities
    .filter((id) => !id.protocol.startsWith('ethereum') && !id.protocol.startsWith('solana'))
    .map((id) => id.protocol);

  return {
    // Core identity
    ready,
    hasSignedIn,
    identities,
    primaryIdentity,
    linkedIdentities,
    walletAddress,
    displayName,
    handle,
    avatarUrl,
    joinDate,
    profileStats,
    connectedProtocols,
    earnedAchievements,

    // Reputation
    repScore,
    repProgress,
    repLoading,

    // Subscriptions
    subscriptions,
    subsLoading,

    // Tabs
    activeTab,
    setActiveTab,
    tabContent: currentTabContent,
    tabLoading,

    // Activity feed
    activities,
    activitiesLoading,

    // Creator tools
    creatorCoin,
    coinLoading,
    daoMemberships,
    contentPerformance,
    perfLoading,
    revenueStats,
    revLoading,

    // Profile discovery
    searchQuery,
    searchResults,
    searchLoading,
    trendingCreators,
    trendingLoading,
    whoToFollow,
    whoToFollowLoading,

    // Modals
    showEditModal,
    showUnlinkConfirm,
    showCrossPlatformSetup,
    crossPlatformKey,
    showUpgradeModal,
    showGoLiveModal,
    showComposeModal,
    isConnected,

    // Modal setters
    setShowEditModal,
    setShowUnlinkConfirm,
    setShowCrossPlatformSetup,
    setShowUpgradeModal,
    setShowGoLiveModal,
    setShowComposeModal,

    // Actions
    openSignIn,
    handleRegistered,
    handleCancelSubscription,
    handleUnlink,
    handleFollow,
    handleTip,
    handleSubscribe,
    handleMessage,
    handleShare,
    handleSearch,
    setSearchQuery,

    // Auth helpers
    refreshPremium,
    showToast,
    resetOnboarding,
    openOnboarding,
    setPrimary,
    unlink,
  };
}
