'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────

interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
  socialVolume: number;
  rank: number;
}

interface TipActivity {
  id: string;
  fromLabel: string;
  toLabel: string;
  amountUsd: number;
  platform: string;
  entityLabel?: string;
  at: number;
}

interface CoinLaunch {
  coin: string;
  coinName: string;
  creator: string;
  creatorName: string;
  timestamp: number;
}

interface Subscription {
  creator: string;
  tier: string;
  amount: string;
  startDate: number;
  expiryDate: number;
  daysRemaining: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatUsd(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

function formatSmallUsd(amount: number): string {
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ─── Fallback Data ────────────────────────────────────────────────────────

const FALLBACK_TRENDING: TrendingCoin[] = [
  { id: '$DEGEN', symbol: 'DEGEN', name: 'Degen', priceUsd: 0.089, change24h: 24.5, socialVolume: 12500, rank: 1 },
  { id: '$BOB', symbol: 'BOB', name: 'Bob', priceUsd: 0.032, change24h: 15.2, socialVolume: 8900, rank: 2 },
  { id: '$FREN', symbol: 'FREN', name: 'Fren', priceUsd: 0.0045, change24h: 42.1, socialVolume: 7500, rank: 3 },
  { id: '$PEPE', symbol: 'PEPE', name: 'Pepe', priceUsd: 0.000012, change24h: 68.3, socialVolume: 32000, rank: 4 },
  { id: '$WIF', symbol: 'WIF', name: 'dogwifhat', priceUsd: 2.45, change24h: -5.8, socialVolume: 28000, rank: 5 },
];

const FALLBACK_TIPS: TipActivity[] = [
  { id: '1', fromLabel: 'Whale', toLabel: 'Vitalik', amountUsd: 2500, platform: 'ethereum', at: Date.now() - 60000 },
  { id: '2', fromLabel: 'Degen', toLabel: 'MemeLord', amountUsd: 500, platform: 'solana', at: Date.now() - 300000 },
  { id: '3', fromLabel: 'Trader', toLabel: 'DeFiDegen', amountUsd: 1000, platform: 'base', at: Date.now() - 600000 },
  { id: '4', fromLabel: 'Fan', toLabel: 'Artist', amountUsd: 150, platform: 'polygon', at: Date.now() - 1200000 },
  { id: '5', fromLabel: 'Supporter', toLabel: 'Creator', amountUsd: 300, platform: 'ethereum', at: Date.now() - 1800000 },
];

const FALLBACK_LAUNCHES: CoinLaunch[] = [
  { coin: '$FREN', coinName: 'Fren', creator: '@fren', creatorName: 'Fren', timestamp: Date.now() - 3600000 },
  { coin: '$TOSHI', coinName: 'Toshi', creator: '@toshi', creatorName: 'Toshi Fan', timestamp: Date.now() - 7200000 },
  { coin: '$MOON', coinName: 'MoonCoin', creator: '@astro', creatorName: 'Astro', timestamp: Date.now() - 14400000 },
];

// ─── Sub-component: Trending Coins ────────────────────────────────────────

function TrendingCoinsWidget({ coins }: { coins: TrendingCoin[] }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-glass-border)' }}>
      <h3 className="px-4 pt-3 pb-2 text-sm font-bold" style={{ color: 'var(--color-fg)' }}>
        Trending Coins
      </h3>
      <div className="divide-y" style={{ borderColor: 'var(--color-glass-border)' }}>
        {coins.map((coin) => (
          <Link
            key={coin.id}
            href={`/search?q=${coin.symbol}`}
            className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--color-overlay)]"
          >
            <div className="w-5 text-center text-xs font-bold font-mono" style={{ color: 'var(--color-muted)' }}>
              #{coin.rank}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: 'var(--color-fg)' }}>
                {coin.id}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                {coin.name}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
                ${coin.priceUsd < 0.01 ? coin.priceUsd.toFixed(6) : coin.priceUsd.toFixed(3)}
              </div>
              <div className={`text-[10px] font-medium ${coin.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(1)}%
              </div>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/leaderboard"
        className="block px-4 py-2.5 text-xs text-degen-400 transition-colors hover:bg-[var(--color-overlay)]"
      >
        View all coins →
      </Link>
    </div>
  );
}

// ─── Sub-component: Recent Tips ──────────────────────────────────────────

function RecentTipsWidget({ tips, compact }: { tips: TipActivity[]; compact?: boolean }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-glass-border)' }}>
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h3 className="text-sm font-bold" style={{ color: 'var(--color-fg)' }}>
          Recent Tips
        </h3>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-degen-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-degen-500" />
        </span>
      </div>
      <div className={`divide-y ${compact ? '' : 'max-h-48'} overflow-y-auto`} style={{ borderColor: 'var(--color-glass-border)' }}>
        {tips.slice(0, compact ? 3 : 5).map((tip) => (
          <div key={tip.id} className="flex items-center gap-2 px-4 py-2 transition-colors hover:bg-[var(--color-overlay)]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-xs">
                <span className="font-semibold truncate" style={{ color: 'var(--color-fg)' }}>
                  {tip.fromLabel}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-muted)' }}>
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
                <span className="font-semibold truncate" style={{ color: 'var(--color-fg)' }}>
                  {tip.toLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--color-muted)' }}>
                <span>{tip.platform}</span>
                <span>·</span>
                <span>{timeAgo(tip.at)}</span>
              </div>
            </div>
            <div className="text-xs font-bold tabular-nums shrink-0 text-degen-400">
              {formatSmallUsd(tip.amountUsd)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sub-component: Coin Launches ────────────────────────────────────────

function CoinLaunchesWidget({ launches }: { launches: CoinLaunch[] }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-glass-border)' }}>
      <h3 className="px-4 pt-3 pb-2 text-sm font-bold" style={{ color: 'var(--color-fg)' }}>
        New Launches
      </h3>
      <div className="divide-y" style={{ borderColor: 'var(--color-glass-border)' }}>
        {launches.slice(0, 3).map((launch, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--color-overlay)]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-sm">
              🚀
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>
                {launch.coin} by {launch.creatorName}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                {timeAgo(launch.timestamp)} ago
              </div>
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/trading"
        className="block px-4 py-2.5 text-xs text-degen-400 transition-colors hover:bg-[var(--color-overlay)]"
      >
        View all launches →
      </Link>
    </div>
  );
}

// ─── Sub-component: Your Subscriptions ───────────────────────────────────

function YourSubscriptionsWidget({ subscriptions }: { subscriptions: Subscription[] }) {
  if (subscriptions.length === 0) return null;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-glass-border)' }}>
      <h3 className="px-4 pt-3 pb-2 text-sm font-bold" style={{ color: 'var(--color-fg)' }}>
        Your Subscriptions
      </h3>
      <div className="divide-y" style={{ borderColor: 'var(--color-glass-border)' }}>
        {subscriptions.slice(0, 3).map((sub, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-xs font-bold text-green-400">
              ★
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: 'var(--color-fg)' }}>
                {sub.creator.slice(0, 8)}...{sub.creator.slice(-4)}
              </div>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--color-muted)' }}>
                <span className="capitalize">{sub.tier}</span>
                <span>·</span>
                <span className={sub.daysRemaining <= 3 ? 'text-yellow-400' : ''}>
                  {sub.daysRemaining}d remaining
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────

interface SocialFiSidebarProps {
  compact?: boolean;
}

export function SocialFiSidebar({ compact = false }: SocialFiSidebarProps) {
  const [trending, setTrending] = useState<TrendingCoin[]>([]);
  const [tips, setTips] = useState<TipActivity[]>([]);
  const [launches] = useState<CoinLaunch[]>(FALLBACK_LAUNCHES);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch('/api/trading/trending?limit=5');
      const data = await res.json();
      if (data.coins) setTrending(data.coins);
    } catch {
      setTrending(FALLBACK_TRENDING);
    }
  }, []);

  const fetchTips = useCallback(async () => {
    try {
      const res = await fetch('/api/tip/unified/activity?limit=5');
      const data = await res.json();
      if (data.activity) setTips(data.activity);
    } catch {
      setTips(FALLBACK_TIPS);
    }
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await fetch('/api/subscription/my');
      const data = await res.json();
      if (data.subscriptions) setSubscriptions(data.subscriptions);
    } catch {
      // Not authenticated or no subs
    }
  }, []);

  useEffect(() => {
    fetchTrending();
    fetchTips();
    fetchSubscriptions();
  }, [fetchTrending, fetchTips, fetchSubscriptions]);

  // Auto-refresh tips
  useEffect(() => {
    const interval = setInterval(fetchTips, 30000);
    return () => clearInterval(interval);
  }, [fetchTips]);

  if (compact) {
    return (
      <div className="flex flex-col gap-3">
        <TrendingCoinsWidget coins={trending.slice(0, 3)} />
        <RecentTipsWidget tips={tips} compact />
      </div>
    );
  }

  return (
    <aside className="flex flex-col gap-4" aria-label="SocialFi Sidebar">
      <TrendingCoinsWidget coins={trending} />
      <RecentTipsWidget tips={tips} />
      <CoinLaunchesWidget launches={launches} />
      <YourSubscriptionsWidget subscriptions={subscriptions} />

      {/* Quick actions */}
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-glass-border)' }}>
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-fg)' }}>
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/leaderboard"
            className="rounded-lg border px-3 py-2 text-xs font-medium text-center transition-colors hover:bg-[var(--color-overlay)]"
            style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
          >
            📊 Leaderboard
          </Link>
          <Link
            href="/trading"
            className="rounded-lg border px-3 py-2 text-xs font-medium text-center transition-colors hover:bg-[var(--color-overlay)]"
            style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
          >
            📈 Trading
          </Link>
          <Link
            href="/subscriptions"
            className="rounded-lg border px-3 py-2 text-xs font-medium text-center transition-colors hover:bg-[var(--color-overlay)]"
            style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
          >
            ⭐ Subscriptions
          </Link>
          <Link
            href="/rewards"
            className="rounded-lg border px-3 py-2 text-xs font-medium text-center transition-colors hover:bg-[var(--color-overlay)]"
            style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
          >
            🏆 Rewards
          </Link>
        </div>
      </div>
    </aside>
  );
}
