'use client';

/**
 * Lens-Specific Coin Page — Shows coin data through a Lens Protocol lens.
 * Displays Lens engagement (mirrors, collects, comments), collect module info,
 * and Lens-native buy capabilities.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface LensCoinView {
  symbol: string;
  name: string;
  coinAddress: string;
  chain: string;
  price: string;
  marketCap: string;
  volume24h: string;
  holderCount: number;
  degenfeedUrl: string;
  buyLink: string;
  engagement: {
    mentions: number;
    comments?: number;
  };
  publicationId?: string;
  profileId?: string;
  collectModule?: string;
}

const PROTOCOL_META = {
  name: 'Lens',
  icon: '👁️',
  color: '#abfe2c',
  gradient: 'from-green-400 to-emerald-500',
  description: 'Decentralized social graph for creators',
  buyMethod: 'Collect Module',
};

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function LensCoinPage() {
  const params = useParams();
  const symbol = typeof params.symbol === 'string' ? params.symbol.toUpperCase() : '';
  const [coin, setCoin] = useState<LensCoinView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/coin/discover/lens/${symbol}`);
        if (res.ok) {
          const data = await res.json();
          setCoin(data);
        }
      } catch {
        // Fall through
      }
      setLoading(false);
    };
    fetchData();
  }, [symbol]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="skeleton h-8 w-48 rounded-lg mb-6" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (!coin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center">
        <div className="text-4xl mb-4">👁️</div>
        <h1 className="text-xl font-bold text-[var(--color-fg)] mb-2">Coin not found on Lens</h1>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          This coin hasn't been published on Lens Protocol yet.
        </p>
        <Link href={`/coins/${symbol}`} className="text-degen-400 hover:underline text-sm">
          ← Back to main coin page
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 animate-page-enter">
      <nav className="mb-4 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <Link href="/coins" className="hover:text-degen-400 transition-colors">Coins</Link>
        <span>/</span>
        <Link href={`/coins/${symbol}`} className="hover:text-degen-400 transition-colors">${symbol}</Link>
        <span>/</span>
        <span className="font-medium text-emerald-400">Lens</span>
      </nav>

      <div className="mb-6 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-green-500/5 p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{PROTOCOL_META.icon}</span>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-fg)]">
              ${coin.symbol} on Lens
            </h1>
            <p className="text-xs text-[var(--color-muted)]">{PROTOCOL_META.description}</p>
          </div>
          <span className="ml-auto rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
            {coin.collectModule ? 'Collectible' : 'View Only'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Lens Engagement */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">👁️ Lens Engagement</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-black text-emerald-400 tabular-nums">
                  {formatCompact(coin.engagement.mentions)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">Mirrors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-emerald-400 tabular-nums">
                  {formatCompact(coin.engagement.comments || 0)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">Comments</div>
              </div>
            </div>
          </div>

          {/* Collect Module */}
          <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-green-500/5 p-4">
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">👁️ Collect Module</h2>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              {coin.collectModule
                ? `This publication supports collecting with the ${coin.collectModule} module. Collect to buy the coin directly.`
                : 'This publication can be collected to signal interest.'}
            </p>
            <div className="flex gap-2">
              <Link
                href={coin.collectModule ? coin.buyLink : coin.degenfeedUrl}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 py-2.5 text-center text-xs font-bold text-white hover:from-emerald-400 hover:to-green-500 transition-all"
              >
                {coin.collectModule ? '💰 Collect This Post' : '💎 Buy on DegenFeed'}
              </Link>
              {coin.publicationId && (
                <Link
                  href={`https://hey.xyz/posts/${coin.publicationId}`}
                  className="flex-1 rounded-xl border border-[var(--color-glass-border)] py-2.5 text-center text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-all"
                >
                  View on Lens
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
            <div className="mb-2 text-xs font-semibold text-[var(--color-fg)]">Coin Stats</div>
            <div className="space-y-2 text-[10px]">
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Price</span>
                <span className="font-mono text-[var(--color-fg)]">${coin.price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Market Cap</span>
                <span className="font-mono text-[var(--color-fg)]">${coin.marketCap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Holders</span>
                <span className="font-mono text-[var(--color-fg)]">{coin.holderCount}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
            <div className="mb-2 text-xs font-semibold text-[var(--color-fg)]">About Lens</div>
            <p className="text-[10px] text-[var(--color-muted)] leading-relaxed">
              Lens Protocol is a decentralized social graph. Publications can include
              collect modules that let followers buy creator coins directly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
