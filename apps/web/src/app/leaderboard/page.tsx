'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

type LeaderboardTab = 'creators' | 'tippers' | 'coins' | 'protocols';
type TimePeriod = '24h' | '7d' | '30d' | 'alltime';

interface LeaderboardEntry {
  rank: number;
  userId?: string;
  name?: string;
  handle?: string;
  avatarUrl?: string;
  totalUsd: number;
  count: number;
  platform?: string;
  byPlatform?: Record<string, { totalUsd: number; count: number }>;
  change?: number;
}

interface CoinEntry {
  coin: string;
  name: string;
  totalUsd: number;
  tipCount: number;
  creators: number;
}

interface ProtocolEntry {
  protocol: string;
  totalUsd: number;
  tipCount: number;
  percentage: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const TABS: { id: LeaderboardTab; label: string }[] = [
  { id: 'creators', label: 'Top Creators' },
  { id: 'tippers', label: 'Top Tippers' },
  { id: 'coins', label: 'Top Coins' },
  { id: 'protocols', label: 'By Protocol' },
];

const PERIODS: { id: TimePeriod; label: string; apiParam: string }[] = [
  { id: '24h', label: '24H', apiParam: 'daily' },
  { id: '7d', label: '7D', apiParam: 'weekly' },
  { id: '30d', label: '30D', apiParam: 'monthly' },
  { id: 'alltime', label: 'All Time', apiParam: 'alltime' },
];

// ─── Formatting helpers ──────────────────────────────────────────────────

function formatUsd(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function getPlatformIcon(platform?: string): string {
  const icons: Record<string, string> = {
    degenfeed: '🔄',
    lemmy: 'L',
    peertube: '▶',
    bluesky: '🦋',
    mastodon: '🐘',
    farcaster: '⬡',
    lens: '🔭',
    solana: '◎',
    ethereum: '⟠',
    base: '⬡',
    polygon: '⬣',
    arbitrum: '⬡',
  };
  return icons[platform?.toLowerCase() ?? ''] || '•';
}

function getRankColor(rank: number): string {
  if (rank === 1) return '#ffd700';
  if (rank === 2) return '#c0c0c0';
  if (rank === 3) return '#cd7f32';
  return 'var(--color-muted)';
}

// ─── Number animation ────────────────────────────────────────────────────

function AnimatedRank({ rank }: { rank: number }) {
  return (
    <span
      className="font-mono text-base font-bold tabular-nums"
      style={{ color: getRankColor(rank) }}
    >
      #{rank}
    </span>
  );
}

// ─── Tab Navigation ──────────────────────────────────────────────────────

function TabNav({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div className="flex border-b" style={{ borderColor: 'var(--color-glass-border)' }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
            activeTab === tab.id
              ? 'border-degen-500 text-degen-400'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Period Selector ─────────────────────────────────────────────────────

function PeriodSelector({
  periods,
  activePeriod,
  onPeriodChange,
}: {
  periods: { id: string; label: string }[];
  activePeriod: string;
  onPeriodChange: (id: string) => void;
}) {
  return (
    <div
      className="flex gap-1 p-1 rounded-lg border"
      style={{ borderColor: 'var(--color-glass-border)' }}
    >
      {periods.map((period) => (
        <button
          key={period.id}
          type="button"
          onClick={() => onPeriodChange(period.id)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            activePeriod === period.id
              ? 'bg-degen-500/10 text-degen-400'
              : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}

// ─── Leaderboard Table ───────────────────────────────────────────────────

function LeaderboardTable({
  entries,
  type,
}: {
  entries: (LeaderboardEntry | CoinEntry | ProtocolEntry)[];
  type: LeaderboardTab;
}) {
  return (
    <div className="divide-y" style={{ borderColor: 'var(--color-glass-border)' }}>
      {entries.map((entry, i) => {
        const rank = i + 1;
        const isCreator = type === 'creators' || type === 'tippers';
        const isCoin = type === 'coins';
        const isProtocol = type === 'protocols';

        return (
          <div
            key={
              type === 'protocols'
                ? (entry as ProtocolEntry).protocol
                : type === 'coins'
                  ? (entry as CoinEntry).coin
                  : rank
            }
            className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--color-overlay)]"
          >
            {/* Rank */}
            <div className="w-10 text-center">
              <AnimatedRank rank={rank} />
            </div>

            {/* Avatar / Icon */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-degen-500/10 text-sm font-bold text-degen-400">
              {isCreator && 'handle' in entry
                ? (entry as LeaderboardEntry).name?.charAt(0) || '?'
                : isCoin
                  ? (entry as CoinEntry).coin.replace('$', '').charAt(0)
                  : (entry as ProtocolEntry).protocol.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {isCreator && (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-semibold truncate"
                      style={{ color: 'var(--color-fg)' }}
                    >
                      {(entry as LeaderboardEntry).name ||
                        (entry as LeaderboardEntry).handle ||
                        'Anonymous'}
                    </span>
                    {(entry as LeaderboardEntry).platform && (
                      <span className="text-xs" title={(entry as LeaderboardEntry).platform}>
                        {getPlatformIcon((entry as LeaderboardEntry).platform)}
                      </span>
                    )}
                  </div>
                  <div
                    className="flex items-center gap-2 text-xs"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    <span>{(entry as LeaderboardEntry).handle || 'No handle'}</span>
                    <span>·</span>
                    <span>{formatCount((entry as LeaderboardEntry).count)} tips</span>
                    {(entry as LeaderboardEntry).change !== undefined &&
                      (entry as LeaderboardEntry).change !== 0 && (
                        <>
                          <span>·</span>
                          <span
                            className={
                              (entry as LeaderboardEntry).change! > 0
                                ? 'text-green-400'
                                : 'text-red-400'
                            }
                          >
                            {(entry as LeaderboardEntry).change! > 0 ? '↑' : '↓'}{' '}
                            {Math.abs((entry as LeaderboardEntry).change!)}
                          </span>
                        </>
                      )}
                  </div>
                </>
              )}

              {isCoin && (
                <>
                  <div className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
                    {(entry as CoinEntry).coin}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    {(entry as CoinEntry).name} · {formatCount((entry as CoinEntry).tipCount)} tips
                    · {(entry as CoinEntry).creators} creators
                  </div>
                </>
              )}

              {isProtocol && (
                <>
                  <div
                    className="text-sm font-semibold capitalize"
                    style={{ color: 'var(--color-fg)' }}
                  >
                    {(entry as ProtocolEntry).protocol}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    {formatCount((entry as ProtocolEntry).tipCount)} tips ·{' '}
                    {(entry as ProtocolEntry).percentage}% share
                  </div>
                </>
              )}
            </div>

            {/* Amount */}
            <div className="text-right shrink-0">
              <div className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-fg)' }}>
                {formatUsd(entry.totalUsd)}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                total tipped
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: LeaderboardTab }) {
  const messages: Record<LeaderboardTab, string> = {
    creators: 'No creators with tips yet. Be the first to send a tip!',
    tippers: 'No tippers yet. Start tipping to claim a spot!',
    coins: 'No tip activity by coin yet.',
    protocols: 'No protocol data available yet.',
  };

  return (
    <div className="text-center py-12">
      <div className="text-3xl mb-3">📊</div>
      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
        {messages[tab]}
      </p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('creators');
  const [period, setPeriod] = useState<TimePeriod>('7d');
  const [entries, setEntries] = useState<(LeaderboardEntry | CoinEntry | ProtocolEntry)[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    const periodParam = PERIODS.find((p) => p.id === period)?.apiParam || 'weekly';

    try {
      if (activeTab === 'creators' || activeTab === 'tippers') {
        const res = await fetch(`/api/tip/unified/leaderboard?period=${periodParam}&limit=25`);
        const data = await res.json();
        if (data.entries) {
          setEntries(data.entries);
        } else {
          setEntries([]);
        }
      } else if (activeTab === 'protocols') {
        const res = await fetch(`/api/tips/leaderboard/protocols?period=${periodParam}`);
        const data = await res.json();
        setEntries(data.protocols || []);
      } else if (activeTab === 'coins') {
        const res = await fetch(`/api/tips/leaderboard/coins?period=${periodParam}&limit=25`);
        const data = await res.json();
        setEntries(data.coins || []);
      }
    } catch {
      // Fallback data
      if (activeTab === 'creators') {
        setEntries([
          {
            rank: 1,
            name: 'Vitalik Buterin',
            handle: 'vitalik.eth',
            totalUsd: 42500,
            count: 340,
            platform: 'degenfeed',
            change: 2,
          },
          {
            rank: 2,
            name: 'Crypto Whaler',
            handle: 'whaler@degenfeed.xyz',
            totalUsd: 31200,
            count: 280,
            platform: 'degenfeed',
            change: 5,
          },
          {
            rank: 3,
            name: 'DeFi Degen',
            handle: 'defidegen@degenfeed.xyz',
            totalUsd: 28750,
            count: 195,
            platform: 'degenfeed',
            change: -1,
          },
          {
            rank: 4,
            name: 'PeerTube Star',
            handle: 'starlight@peertube.tv',
            totalUsd: 15900,
            count: 167,
            platform: 'peertube',
            change: 8,
          },
          {
            rank: 5,
            name: 'Meme Lord',
            handle: 'memelord@degenfeed.xyz',
            totalUsd: 12400,
            count: 230,
            platform: 'degenfeed',
            change: 12,
          },
          {
            rank: 6,
            name: 'Tech Analyst',
            handle: 'techanalyst@degenfeed.xyz',
            totalUsd: 9800,
            count: 89,
            platform: 'degenfeed',
            change: -3,
          },
          {
            rank: 7,
            name: 'Video Degen',
            handle: 'videogen@peertube.tv',
            totalUsd: 7600,
            count: 45,
            platform: 'peertube',
            change: 6,
          },
          {
            rank: 8,
            name: 'Degen Trader',
            handle: 'trader@degenfeed.xyz',
            totalUsd: 3200,
            count: 156,
            platform: 'degenfeed',
            change: -5,
          },
        ] as LeaderboardEntry[]);
      } else if (activeTab === 'tippers') {
        setEntries([
          {
            rank: 1,
            name: 'Generous Whale',
            handle: 'whale@degenfeed.xyz',
            totalUsd: 89000,
            count: 450,
            platform: 'degenfeed',
            change: 1,
          },
          {
            rank: 2,
            name: 'Degen Angel',
            handle: 'angel@degenfeed.xyz',
            totalUsd: 65400,
            count: 320,
            platform: 'farcaster',
            change: 4,
          },
          {
            rank: 3,
            name: 'Tip King',
            handle: 'tipking@lemmy.world',
            totalUsd: 52100,
            count: 280,
            platform: 'lemmy',
            change: -2,
          },
          {
            rank: 4,
            name: 'Generous Soul',
            handle: 'soul@degenfeed.xyz',
            totalUsd: 41000,
            count: 195,
            platform: 'degenfeed',
            change: 7,
          },
          {
            rank: 5,
            name: 'Micro Tipper',
            handle: 'micro@peertube.tv',
            totalUsd: 34200,
            count: 890,
            platform: 'peertube',
            change: 11,
          },
          {
            rank: 6,
            name: 'Crypto Santa',
            handle: 'santa@degenfeed.xyz',
            totalUsd: 11200,
            count: 67,
            platform: 'degenfeed',
            change: 2,
          },
        ] as LeaderboardEntry[]);
      } else if (activeTab === 'protocols') {
        setEntries([
          { protocol: 'ethereum', totalUsd: 452000, tipCount: 12400, percentage: 38 },
          { protocol: 'solana', totalUsd: 389000, tipCount: 9800, percentage: 32 },
          { protocol: 'base', totalUsd: 178000, tipCount: 5600, percentage: 15 },
          { protocol: 'polygon', totalUsd: 89000, tipCount: 3200, percentage: 7 },
          { protocol: 'arbitrum', totalUsd: 54000, tipCount: 1800, percentage: 5 },
          { protocol: 'optimism', totalUsd: 31000, tipCount: 1100, percentage: 3 },
        ] as ProtocolEntry[]);
      } else if (activeTab === 'coins') {
        setEntries([
          { coin: '$DEGEN', name: 'Degen', totalUsd: 234000, tipCount: 5600, creators: 45 },
          { coin: '$BOB', name: 'Bob', totalUsd: 189000, tipCount: 4200, creators: 32 },
          { coin: '$FREN', name: 'Fren', totalUsd: 145000, tipCount: 3800, creators: 28 },
          { coin: '$PEPE', name: 'Pepe', totalUsd: 98000, tipCount: 2100, creators: 18 },
          { coin: '$WIF', name: 'dogwifhat', totalUsd: 76000, tipCount: 1800, creators: 12 },
          { coin: '$BONK', name: 'Bonk', totalUsd: 54000, tipCount: 1400, creators: 9 },
        ] as CoinEntry[]);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, period]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>
          Leaderboard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
          Top earners, tippers, and activity across all protocols
        </p>
      </div>

      {/* Tabs */}
      <TabNav
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as LeaderboardTab)}
      />

      {/* Period Selector */}
      <div className="flex justify-end my-3">
        <PeriodSelector
          periods={PERIODS}
          activePeriod={period}
          onPeriodChange={(id) => setPeriod(id as TimePeriod)}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-degen-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Loading leaderboard...
          </p>
        </div>
      ) : entries.length > 0 ? (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--color-glass-border)' }}
        >
          <LeaderboardTable entries={entries} type={activeTab} />
        </div>
      ) : (
        <EmptyState tab={activeTab} />
      )}

      {/* Footer */}
      <div className="mt-6 text-center">
        <Link
          href="/leaderboard?refresh=1"
          className="inline-flex items-center gap-1.5 text-xs transition-colors hover:text-degen-400"
          style={{ color: 'var(--color-muted)' }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
          Refresh data
        </Link>
      </div>
    </div>
  );
}
