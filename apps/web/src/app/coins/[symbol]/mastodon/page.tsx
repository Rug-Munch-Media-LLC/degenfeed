'use client';

/**
 * Mastodon/GTS-Specific Coin Page — Shows coin data through a Mastodon lens.
 * Displays Mastodon engagement (toots, boosts, favs), ActivityPub metrics,
 * and buy link for fediverse users.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface MastodonCoinView {
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
    shares?: number;
  };
  statusId?: string;
  instanceUrl?: string;
}

const PROTOCOL_META = {
  name: 'Mastodon',
  icon: '🐘',
  color: '#6364ff',
  gradient: 'from-indigo-500 to-purple-600',
  description: 'Federated social network (ActivityPub)',
  buyMethod: 'Link in Toot',
};

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function MastodonCoinPage() {
  const params = useParams();
  const symbol = typeof params.symbol === 'string' ? params.symbol.toUpperCase() : '';
  const [coin, setCoin] = useState<MastodonCoinView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/coin/discover/mastodon/${symbol}`);
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
        <div className="text-4xl mb-4">🐘</div>
        <h1 className="text-xl font-bold text-[var(--color-fg)] mb-2">Coin not found on Mastodon</h1>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          This coin hasn't been announced on Mastodon yet.
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
        <span className="font-medium text-indigo-400">Mastodon</span>
      </nav>

      <div className="mb-6 rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 to-purple-500/5 p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{PROTOCOL_META.icon}</span>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-fg)]">
              ${coin.symbol} on Mastodon
            </h1>
            <p className="text-xs text-[var(--color-muted)]">{PROTOCOL_META.description}</p>
          </div>
          <span className="ml-auto rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-400">
            Fediverse Ready
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Fediverse Activity */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">🐘 Fediverse Activity</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-black text-indigo-400 tabular-nums">
                  {formatCompact(coin.engagement.mentions)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">Toots</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-indigo-400 tabular-nums">
                  {formatCompact(coin.engagement.shares || 0)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">Boosts</div>
              </div>
            </div>
          </div>

          {/* Buy Card */}
          <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 p-4">
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">🐘 Buy from Mastodon</h2>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              Click the link in the announcement toot, or buy directly on DegenFeed.
            </p>
            <Link
              href={coin.degenfeedUrl}
              className="block w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3 text-center text-xs font-bold text-white hover:from-indigo-400 hover:to-purple-500 transition-all"
            >
              💎 Buy ${coin.symbol} on DegenFeed
            </Link>
            {coin.statusId && (
              <Link
                href={coin.statusId}
                className="mt-2 block text-center text-[10px] text-degen-400 hover:underline"
              >
                View announcement toot →
              </Link>
            )}
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
            <div className="mb-2 text-xs font-semibold text-[var(--color-fg)]">About Mastodon</div>
            <p className="text-[10px] text-[var(--color-muted)] leading-relaxed">
              Mastodon is a federated social network using the ActivityPub protocol.
              Join the fediverse and trade creator coins across instances.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
