'use client';

/**
 * Farcaster-Specific Coin Page — Shows coin data through a Farcaster lens.
 * Displays Farcaster engagement (casts, likes, recasts), buy frame,
 * and Farcaster-native metrics.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface FarcasterCoinView {
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
    likes?: number;
    shares?: number;
  };
  castHash?: string;
  channelName?: string;
  frameUrl?: string;
}

const PROTOCOL_META = {
  name: 'Farcaster',
  icon: '⬡',
  color: '#8b5cf6',
  gradient: 'from-indigo-600 to-purple-500',
  description: 'Sufficiently decentralized social network',
  buyMethod: 'Frame Button',
};

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function FarcasterCoinPage() {
  const params = useParams();
  const symbol = typeof params.symbol === 'string' ? params.symbol.toUpperCase() : '';
  const [coin, setCoin] = useState<FarcasterCoinView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/coin/discover/farcaster/${symbol}`);
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
        <div className="text-4xl mb-4">⬡</div>
        <h1 className="text-xl font-bold text-[var(--color-fg)] mb-2">
          Coin not found on Farcaster
        </h1>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          This coin hasn't been announced on Farcaster yet.
        </p>
        <Link href={`/coins/${symbol}`} className="text-degen-400 hover:underline text-sm">
          ← Back to main coin page
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 animate-page-enter">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <Link href="/coins" className="hover:text-degen-400 transition-colors">
          Coins
        </Link>
        <span>/</span>
        <Link href={`/coins/${symbol}`} className="hover:text-degen-400 transition-colors">
          ${symbol}
        </Link>
        <span>/</span>
        <span className="font-medium text-indigo-400">Farcaster</span>
      </nav>

      {/* Protocol Header */}
      <div className="mb-6 rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 to-purple-500/5 p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{PROTOCOL_META.icon}</span>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-fg)]">
              ${coin.symbol} on Farcaster
            </h1>
            <p className="text-xs text-[var(--color-muted)]">{PROTOCOL_META.description}</p>
          </div>
          <span className="ml-auto rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-400">
            Buy via {PROTOCOL_META.buyMethod}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-4 lg:col-span-2">
          {/* Buy Frame Embed */}
          <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 p-4">
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">◈ Buy Frame</h2>
            <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center">
              <div className="mb-2 text-lg font-black tabular-nums text-indigo-400">
                ${coin.price}
              </div>
              <p className="mb-3 text-xs text-[var(--color-muted)]">
                Buy ${coin.symbol} directly in this frame
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-500 py-3 text-xs font-bold text-white hover:from-indigo-500 hover:to-purple-400 transition-all active:scale-[0.98]"
                >
                  💎 Buy ${coin.symbol}
                </button>
                <Link
                  href={coin.degenfeedUrl}
                  className="flex-1 rounded-xl border border-[var(--color-glass-border)] py-3 text-center text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-all"
                >
                  Open in DegenFeed
                </Link>
              </div>
            </div>
          </div>

          {/* Farcaster Engagement */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">
              ⬡ Farcaster Engagement
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-black text-indigo-400 tabular-nums">
                  {formatCompact(coin.engagement.mentions)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">Casts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-indigo-400 tabular-nums">
                  {formatCompact(coin.engagement.likes || 0)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">Likes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-indigo-400 tabular-nums">
                  {formatCompact(coin.engagement.shares || 0)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">Recasts</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
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
                <span className="text-[var(--color-muted)]">24h Volume</span>
                <span className="font-mono text-[var(--color-fg)]">${coin.volume24h}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Holders</span>
                <span className="font-mono text-[var(--color-fg)]">{coin.holderCount}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
            <div className="mb-2 text-xs font-semibold text-[var(--color-fg)]">About Farcaster</div>
            <p className="text-[10px] text-[var(--color-muted)] leading-relaxed">
              Farcaster is a sufficiently decentralized social network. Creator coins can be bought
              directly inside frames without leaving the app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
