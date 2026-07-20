'use client';

import { ErrorBoundary, LeaderboardCard, type LeaderboardCardEntry } from '@degenfeed/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getCached, setCache } from '../../lib/fetchWithCache';
import { retryFetch } from '../../lib/retryFetch';

// == Types =================================================================

interface TrendingEntry {
  id: string;
  rank: number;
  title: string;
  platform: string;
  url: string;
  engagementScore: number;
  tipCount: number;
  tipTotal: number;
  change: number;
  authorName: string;
  authorAvatar: string;
}

interface CommunityEntry {
  id: string;
  rank: number;
  name: string;
  icon: string;
  platform: string;
  memberCount: number;
  postCount: number;
  tipCount: number;
  tipTotal: number;
  change: number;
}

interface LeaderboardResponse {
  entries: LeaderboardCardEntry[];
  updatedAt: string;
  period?: string;
}

interface TrendingResponse {
  entries: TrendingEntry[];
  updatedAt: string;
  period?: string;
}

interface CommunitiesResponse {
  entries: CommunityEntry[];
  updatedAt: string;
}

type TabId = 'creators' | 'tippers' | 'trending' | 'communities';
type Period = 'daily' | 'weekly' | 'monthly' | 'alltime';
type Platform = 'all' | 'degenfeed' | 'lemmy' | 'peertube';

// == Constants =============================================================

const TABS: { id: TabId; label: string }[] = [
  { id: 'creators', label: 'Creators' },
  { id: 'tippers', label: 'Tippers' },
  { id: 'trending', label: 'Trending' },
  { id: 'communities', label: 'Communities' },
];

const PERIODS: { id: Period; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'alltime', label: 'All-Time' },
];

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'degenfeed', label: 'DegenFeed' },
  { id: 'lemmy', label: 'Lemmy' },
  { id: 'peertube', label: 'PeerTube' },
];

const PLATFORM_EMOJI: Record<string, string> = {
  degenfeed: '◆',
  lemmy: 'L',
  peertube: '▶',
};

// == Helpers ===============================================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function TimeAgo({ date }: { date: string }) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return <span>just now</span>;
  if (mins < 60) return <span>{mins}m ago</span>;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return <span>{hours}h ago</span>;
  return <span>{Math.floor(hours / 24)}d ago</span>;
}

// == Skeleton ==============================================================

function LeaderboardSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 animate-pulse"
        >
          <div className="h-9 w-9 rounded-xl bg-[var(--color-overlay)]" />
          <div className="h-10 w-10 rounded-full bg-[var(--color-overlay)]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-[var(--color-overlay)]" />
            <div className="h-3 w-24 rounded bg-[var(--color-overlay)]" />
          </div>
          <div className="h-8 w-16 rounded bg-[var(--color-overlay)]" />
        </div>
      ))}
    </div>
  );
}

function TrendingSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 animate-pulse"
        >
          <div className="mb-2 h-4 w-3/4 rounded bg-[var(--color-overlay)]" />
          <div className="mb-1 h-3 w-1/2 rounded bg-[var(--color-overlay)]" />
          <div className="h-3 w-1/4 rounded bg-[var(--color-overlay)]" />
        </div>
      ))}
    </div>
  );
}

function CommunitiesSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 animate-pulse"
        >
          <div className="h-10 w-10 rounded-xl bg-[var(--color-overlay)]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-[var(--color-overlay)]" />
            <div className="h-3 w-28 rounded bg-[var(--color-overlay)]" />
          </div>
          <div className="h-8 w-16 rounded bg-[var(--color-overlay)]" />
        </div>
      ))}
    </div>
  );
}

// == Change Badge ==========================================================

function ChangeBadge({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-degen-500/15 px-2 py-0.5 text-xs font-semibold text-degen-400">
        ↑ {change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
        ↓ {Math.abs(change)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold text-[var(--color-muted)]">
      – 0
    </span>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  const emoji = PLATFORM_EMOJI[platform];
  if (emoji) return <span className="mr-1">{emoji}</span>;
  return null;
}

// == Trending Card =========================================================

function TrendingCard({ entry }: { entry: TrendingEntry }) {
  return (
    <Link
      href={entry.url}
      className="block rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] to-[var(--color-card)] p-4 backdrop-blur-xl transition-all duration-200 hover:border-white/20 hover:shadow-[0_0_30px_-8px]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--color-muted)]">#{entry.rank}</span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              <PlatformIcon platform={entry.platform} />
              {entry.platform}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-fg)] line-clamp-2">
            {entry.title}
          </h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">by {entry.authorName}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-bold text-degen-400">
            {formatNumber(entry.engagementScore)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
            Score
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-muted)]">
        <span>{formatNumber(entry.tipCount)} tips</span>
        <span aria-hidden="true">·</span>
        <span>{formatNumber(entry.tipTotal)} total</span>
        <div className="ml-auto">
          <ChangeBadge change={entry.change} />
        </div>
      </div>
    </Link>
  );
}

// == Community Card ========================================================

function CommunityCard({ entry }: { entry: CommunityEntry }) {
  return (
    <Link
      href={`/c/${entry.name.toLowerCase().replace(/\s+/g, '-')}`}
      className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 backdrop-blur-xl transition-all duration-200 hover:border-white/20 hover:shadow-[0_0_20px_-8px]"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-degen-500/15 text-lg font-bold text-degen-400"
        aria-hidden="true"
      >
        {entry.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
            {entry.name}
          </span>
          <ChangeBadge change={entry.change} />
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <span>{formatNumber(entry.memberCount)} members</span>
          <span aria-hidden="true">·</span>
          <span>{formatNumber(entry.postCount)} posts</span>
          <span aria-hidden="true">·</span>
          <span>
            <PlatformIcon platform={entry.platform} />
            {entry.platform}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-bold text-degen-400">{formatNumber(entry.tipTotal)}</div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Tipped</div>
      </div>
    </Link>
  );
}

// == Tab Button ============================================================

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
        active
          ? 'bg-degen-500/15 text-degen-400 shadow-[0_0_12px_-4px_rgba(34,197,94,0.3)]'
          : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
      }`}
    >
      {children}
    </button>
  );
}

function FilterPill<_T extends string>({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
        active
          ? 'bg-white/10 text-[var(--color-fg)] ring-1 ring-white/20'
          : 'text-[var(--color-muted)] hover:bg-white/5 hover:text-[var(--color-fg)]'
      }`}
    >
      {children}
    </button>
  );
}

// == Main Page =============================================================

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>('creators');
  const [period, setPeriod] = useState<Period>('weekly');
  const [platform, setPlatform] = useState<Platform>('all');

  const [creatorsData, setCreatorsData] = useState<LeaderboardResponse | null>(null);
  const [tippersData, setTippersData] = useState<LeaderboardResponse | null>(null);
  const [trendingData, setTrendingData] = useState<TrendingResponse | null>(null);
  const [communitiesData, setCommunitiesData] = useState<CommunitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      const params = new URLSearchParams({
        period: activeTab === 'communities' ? 'weekly' : period,
        platform,
        limit: '50',
      });

      if (activeTab === 'creators') {
        const res = await retryFetch(`/api/leaderboard/creators?${params}`);
        if (!res.ok) throw new Error(`Failed to fetch creators: ${res.status}`);
        const data = (await res.json()) as LeaderboardResponse;
        setCreatorsData(data);
        setCache('leaderboard_creators', data);
      } else if (activeTab === 'tippers') {
        const res = await retryFetch(`/api/leaderboard/tippers?${params}`);
        if (!res.ok) throw new Error(`Failed to fetch tippers: ${res.status}`);
        const data = (await res.json()) as LeaderboardResponse;
        setTippersData(data);
        setCache('leaderboard_tippers', data);
      } else if (activeTab === 'trending') {
        const res = await retryFetch(`/api/leaderboard/trending?${params}`);
        if (!res.ok) throw new Error(`Failed to fetch trending: ${res.status}`);
        const data = (await res.json()) as TrendingResponse;
        setTrendingData(data);
        setCache('leaderboard_trending', data);
      } else if (activeTab === 'communities') {
        const res = await retryFetch(`/api/leaderboard/communities?${params}`);
        if (!res.ok) throw new Error(`Failed to fetch communities: ${res.status}`);
        const data = (await res.json()) as CommunitiesResponse;
        setCommunitiesData(data);
        setCache('leaderboard_communities', data);
      }
    } catch (err) {
      // Graceful degradation: show cached on failure
      const cacheKey = `leaderboard_${activeTab}`;
      const cached = getCached<LeaderboardResponse | TrendingResponse | CommunitiesResponse>(
        cacheKey,
      );
      if (cached) {
        if (activeTab === 'creators') setCreatorsData(cached as LeaderboardResponse);
        else if (activeTab === 'tippers') setTippersData(cached as LeaderboardResponse);
        else if (activeTab === 'trending') setTrendingData(cached as TrendingResponse);
        else if (activeTab === 'communities') setCommunitiesData(cached as CommunitiesResponse);
        setError('Showing cached leaderboard');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, period, platform]);

  // Fetch on mount and when filters change
  useEffect(() => {
    setLoading(true);
    void fetchData();
  }, [fetchData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      void fetchData();
    }, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const currentData =
    activeTab === 'creators'
      ? creatorsData
      : activeTab === 'tippers'
        ? tippersData
        : activeTab === 'trending'
          ? trendingData
          : communitiesData;

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg)] sm:text-3xl">
            🏆 Leaderboard
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Top creators, tippers, and trending content across DegenFeed, Lemmy, and PeerTube.
            {currentData?.updatedAt && (
              <span className="ml-2 text-[10px]">
                Updated <TimeAgo date={currentData.updatedAt} />
              </span>
            )}
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Leaderboard category">
          {TABS.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </TabButton>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          {activeTab !== 'communities' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                Period:
              </span>
              <div className="flex flex-wrap gap-1">
                {PERIODS.map((p) => (
                  <FilterPill key={p.id} active={period === p.id} onClick={() => setPeriod(p.id)}>
                    {p.label}
                  </FilterPill>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              Platform:
            </span>
            <div className="flex flex-wrap gap-1">
              {PLATFORMS.map((p) => (
                <FilterPill key={p.id} active={platform === p.id} onClick={() => setPlatform(p.id)}>
                  {p.label}
                </FilterPill>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          activeTab === 'trending' ? (
            <TrendingSkeleton />
          ) : activeTab === 'communities' ? (
            <CommunitiesSkeleton />
          ) : (
            <LeaderboardSkeleton />
          )
        ) : activeTab === 'trending' ? (
          <div className="space-y-3">
            {trendingData?.entries.map((entry) => (
              <TrendingCard key={entry.id} entry={entry} />
            ))}
            {trendingData?.entries.length === 0 && (
              <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">
                No trending content for this period.
              </p>
            )}
          </div>
        ) : activeTab === 'communities' ? (
          <div className="space-y-3">
            {communitiesData?.entries.map((entry) => (
              <CommunityCard key={entry.id} entry={entry} />
            ))}
            {communitiesData?.entries.length === 0 && (
              <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">
                No communities found.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {(activeTab === 'creators' ? creatorsData : tippersData)?.entries.map((entry) => (
              <LeaderboardCard
                key={entry.id}
                entry={entry}
                variant={activeTab === 'creators' ? 'creators' : 'tippers'}
              />
            ))}
            {((activeTab === 'creators' ? creatorsData : tippersData)?.entries.length ?? 0) ===
              0 && (
              <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">
                No entries found for this period.
              </p>
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
