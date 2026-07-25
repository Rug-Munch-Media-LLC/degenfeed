'use client';

/**
 * Bluesky-Specific Coin Page — Shows coin data through an AT Protocol lens.
 * Displays Bluesky engagement (posts, likes, reposts), custom feed info,
 * and Bluesky-native buy links.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface BlueskyCoinView {
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
  feedUri?: string;
  postUri?: string;
}

const PROTOCOL_META = {
  name: 'Bluesky',
  icon: '☁️',
  color: '#38bdf8',
  gradient: 'from-sky-500 to-blue-500',
  description: 'Open social web built on AT Protocol',
  buyMethod: 'Link in Post',
};

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function BlueskyCoinPage() {
  const params = useParams();
  const symbol = typeof params.symbol === 'string' ? params.symbol.toUpperCase() : '';
  const [coin, setCoin] = useState<BlueskyCoinView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/coin/discover/bluesky/${symbol}`);
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
        <div className="text-4xl mb-4">☁️</div>
        <h1 className="text-xl font-bold text-[var(--color-fg)] mb-2">Coin not found on Bluesky</h1>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          This coin hasn't been announced on Bluesky yet.
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
        <span className="font-medium text-sky-400">Bluesky</span>
      </nav>

      <div className="mb-6 rounded-xl border border-sky-500/20 bg-gradient-to-r from-sky-500/10 to-blue-500/5 p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{PROTOCOL_META.icon}</span>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-fg)]">
              ${coin.symbol} on Bluesky
            </h1>
            <p className="text-xs text-[var(--color-muted)]">{PROTOCOL_META.description}</p>
          </div>
          <span className="ml-auto rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-400">
            Custom Feed Available
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Feed subscription card */}
          <div className="rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/5 to-blue-500/5 p-4">
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">☁️ Bluesky Custom Feed</h2>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              Subscribe to the ${coin.symbol} custom feed on Bluesky for real-time updates,
              price alerts, and community posts.
            </p>
            <Link
              href={coin.feedUri || `https://bsky.app/profile/degenfeed.xyz/feed/coin-${symbol.toLowerCase()}`}
              className="inline-block rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-2 text-xs font-bold text-white hover:from-sky-400 hover:to-blue-400 transition-all"
            >
              Subscribe on Bluesky
            </Link>
          </div>

          {/* Bluesky Engagement */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">☁️ Bluesky Engagement</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-black text-sky-400 tabular-nums">
                  {formatCompact(coin.engagement.mentions)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">Posts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-sky-400 tabular-nums">
                  {formatCompact(coin.engagement.likes || 0)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">Likes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-sky-400 tabular-nums">
                  {formatCompact(coin.engagement.shares || 0)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">Reposts</div>
              </div>
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
            <div className="mb-2 text-xs font-semibold text-[var(--color-fg)]">About Bluesky</div>
            <p className="text-[10px] text-[var(--color-muted)] leading-relaxed">
              Bluesky is an open social web built on the AT Protocol. Follow the custom feed
              for ${coin.symbol} to stay updated.
            </p>
            <Link
              href={coin.buyLink}
              className="mt-3 block rounded-lg bg-[var(--color-overlay)] py-2 text-center text-[10px] font-medium text-degen-400 hover:underline"
            >
              Buy ${coin.symbol} on DegenFeed →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
