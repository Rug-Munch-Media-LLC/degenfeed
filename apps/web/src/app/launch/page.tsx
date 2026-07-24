'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { CoinCardData } from '../../components/launch/CoinCard';
import CoinCard from '../../components/launch/CoinCard';
import LaunchCTA from '../../components/launch/LaunchCTA';
import LaunchHeader from '../../components/launch/LaunchHeader';
import PrebondingLeaderboard from '../../components/launch/PrebondingLeaderboard';

/* === Dynamic imports (heavy components) =============== */

const TrendingSidebar = dynamic(
  () => import('@degenfeed/ui').then((m) => ({ default: m.TrendingSidebar })),
  { ssr: false },
);

/* === Mock data for development ======================== */

function generateMockCoins(): CoinCardData[] {
  const names = [
    { name: 'Degen Alice', symbol: 'ALICE', creator: 'alice.eth' },
    { name: 'Bob Protocol', symbol: 'BOB', creator: 'bob.nostr' },
    { name: 'Charlie Coin', symbol: 'CHAR', creator: 'charlie.lens' },
    { name: 'Diana Token', symbol: 'DIA', creator: 'diana.bsky' },
    { name: 'Eve Finance', symbol: 'EVE', creator: 'eve.eth' },
    { name: 'Frank DeFi', symbol: 'FRANK', creator: 'frank.farc' },
    { name: 'Grace Swap', symbol: 'GRACE', creator: 'grace.nostr' },
    { name: 'Harry Hedge', symbol: 'HARRY', creator: 'harry.lens' },
  ];

  const phases: CoinCardData['phase'][] = ['early', 'growth', 'late', 'graduated'];

  return names.map((n, i) => ({
    address: `0x${Math.random().toString(16).slice(2, 42)}`,
    symbol: n.symbol,
    name: n.name,
    price: 0.001 + Math.random() * 0.5,
    priceChange24h: -20 + Math.random() * 50,
    progress: Math.random() * 100,
    totalRaised: 0.1 + Math.random() * 50,
    holderCount: Math.floor(Math.random() * 500) + 1,
    marketCap: 10000 + Math.random() * 5000000,
    phase: phases[i % phases.length]!,
    creator: {
      name: n.creator,
      reputation: Math.floor(Math.random() * 100),
    },
    socialProof: Math.floor(Math.random() * 300),
  }));
}

/* === Page ============================================= */

export default function LaunchPage() {
  const [coins, setCoins] = useState<CoinCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalLaunched: 0, totalVolume: 0, activePrebonding: 0 });
  const [error, _setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/creator/coins');
        // Fall back to mock data if API not available yet
        if (res.ok) {
          const data = (await res.json()) as {
            coins: CoinCardData[];
            totalLaunched: number;
            totalVolume: number;
            activePrebonding: number;
          };
          if (!cancelled) {
            setCoins(data.coins);
            setStats({
              totalLaunched: data.totalLaunched,
              totalVolume: data.totalVolume,
              activePrebonding: data.activePrebonding,
            });
          }
        } else {
          // Dev mock
          if (!cancelled) {
            const mockCoins = generateMockCoins();
            setCoins(mockCoins);
            setStats({
              totalLaunched: 47,
              totalVolume: 284_000,
              activePrebonding: 12,
            });
          }
        }
      } catch (err) {
        console.error('[LaunchPage] Failed to fetch creator coins:', err);
        if (!cancelled) {
          setCoins(generateMockCoins());
          setStats({ totalLaunched: 47, totalVolume: 284_000, activePrebonding: 12 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      {/* Page header with stats */}
      <LaunchHeader
        totalLaunched={stats.totalLaunched}
        totalVolume={stats.totalVolume}
        activePrebonding={stats.activePrebonding}
        loading={loading}
        className="mb-8"
      />

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Trending leaderboard */}
          <PrebondingLeaderboard
            coins={coins}
            loading={loading}
            error={error}
            maxItems={12}
            className="mb-8"
          />

          {/* Launch CTA */}
          <LaunchCTA className="mb-8" />

          {/* Graduated coins section */}
          {coins.filter((c) => c.phase === 'graduated').length > 0 && (
            <section className="mb-8">
              <h2 className="mb-4 text-lg font-bold text-[var(--color-fg)]">
                ✅ Recently Graduated
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {coins
                  .filter((c) => c.phase === 'graduated')
                  .slice(0, 4)
                  .map((coin) => (
                    <CoinCard key={coin.address} coin={coin} />
                  ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-full shrink-0 lg:w-80 xl:w-96">
          <div className="sticky top-24 space-y-6">
            {/* Quick stats */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Quick Stats
              </h3>
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-muted)]">Avg. Raise</span>
                  <span className="font-medium tabular-nums text-[var(--color-fg)]">
                    {stats.totalLaunched > 0
                      ? `$${(stats.totalVolume / stats.totalLaunched / 1000).toFixed(1)}K`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-muted)]">Success Rate</span>
                  <span className="font-medium tabular-nums text-degen-400">94%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-muted)]">Avg. Holders</span>
                  <span className="font-medium tabular-nums text-[var(--color-fg)]">142</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-muted)]">Avg. Time to Graduate</span>
                  <span className="font-medium tabular-nums text-[var(--color-fg)]">6.2h</span>
                </div>
              </div>
            </div>

            {/* Protocol trending */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                DegenFeed Trending
              </h3>
              <TrendingSidebar />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
