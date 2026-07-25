'use client';

/**
 * Nostr-Specific Coin Page — Shows coin data through a Nostr lens.
 * Displays Nostr engagement (zaps, notes, relays), Nostr-native buy via
 * NIP-57 zap, and Nostr-specific metrics.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface NostrCoinView {
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
  };
  nostrEventId?: string;
  relayCount?: number;
  zapCount?: number;
  totalZapped?: string;
}

const PROTOCOL_META = {
  name: 'Nostr',
  icon: '⚡',
  color: '#7c3aed',
  gradient: 'from-purple-600 to-violet-400',
  description: 'Decentralized, censorship-resistant social protocol',
  buyMethod: 'NIP-57 Zap',
};

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function NostrCoinPage() {
  const params = useParams();
  const symbol = typeof params.symbol === 'string' ? params.symbol.toUpperCase() : '';
  const [coin, setCoin] = useState<NostrCoinView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/coin/discover/nostr/${symbol}`);
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
        <div className="text-4xl mb-4">⚡</div>
        <h1 className="text-xl font-bold text-[var(--color-fg)] mb-2">Coin not found on Nostr</h1>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          This coin hasn't been announced on Nostr yet.
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
        <Link href="/coins" className="hover:text-degen-400 transition-colors">Coins</Link>
        <span>/</span>
        <Link href={`/coins/${symbol}`} className="hover:text-degen-400 transition-colors">${symbol}</Link>
        <span>/</span>
        <span className="font-medium text-purple-400">Nostr</span>
      </nav>

      {/* Protocol Header */}
      <div className="mb-6 rounded-xl border border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-violet-500/5 p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{PROTOCOL_META.icon}</span>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-fg)]">
              ${coin.symbol} on Nostr
            </h1>
            <p className="text-xs text-[var(--color-muted)]">{PROTOCOL_META.description}</p>
          </div>
          <span className="ml-auto rounded-full bg-purple-500/15 px-3 py-1 text-xs font-semibold text-purple-400">
            Buy via {PROTOCOL_META.buyMethod}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-4 lg:col-span-2">
          {/* Nostr Engagement Card */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">⚡ Nostr Engagement</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-black text-purple-400 tabular-nums">
                  {formatCompact(coin.engagement.mentions)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">Mentions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-purple-400 tabular-nums">
                  {formatCompact(coin.engagement.likes || 0)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">Zaps</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-purple-400 tabular-nums">
                  {coin.relayCount || '-'}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">Relays</div>
              </div>
            </div>
          </div>

          {/* Nostr-Specific Buy Card */}
          <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-violet-500/5 p-4">
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">⚡ Buy via Nostr Zap</h2>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              Send a NIP-57 zap with $SYMBOL in the note content to buy this coin.
              Your zap amount is converted to a coin purchase automatically.
            </p>
            <div className="rounded-lg bg-[var(--color-overlay)] p-3 font-mono text-xs text-[var(--color-muted)]">
              Send zap to nostr:note...
              <br />
              Content: /buy ${symbol}
            </div>
            <div className="mt-3 flex gap-2">
              <Link
                href={coin.buyLink}
                className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 py-2.5 text-center text-xs font-bold text-white hover:from-purple-500 hover:to-violet-400 transition-all"
              >
                View Coin Page
              </Link>
              <Link
                href={coin.degenfeedUrl}
                className="flex-1 rounded-xl border border-[var(--color-glass-border)] py-2.5 text-center text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-all"
              >
                Buy on DegenFeed
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Coin Stats */}
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
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Chain</span>
                <span className="text-[var(--color-fg)]">
                  {coin.chain === 'solana' ? '◎ Solana' : '⧫ Base'}
                </span>
              </div>
            </div>
          </div>

          {/* Protocol Info */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
            <div className="mb-2 text-xs font-semibold text-[var(--color-fg)]">About Nostr</div>
            <p className="text-[10px] text-[var(--color-muted)] leading-relaxed">
              Nostr is a decentralized protocol supporting censorship-resistant social networking.
              Creator coins on Nostr can be bought via NIP-57 zaps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
