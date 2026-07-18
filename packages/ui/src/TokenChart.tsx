'use client';

import { useEffect, useState } from 'react';

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  priceChange: { h24?: number; h6?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  txns?: { h24?: { buys: number; sells: number } };
  volume?: { h24?: number };
}

export interface TokenChartProps {
  symbol?: string;
  address?: string;
  chain?: string;
  compact?: boolean; // small inline version for feed
}

export function TokenChart({
  symbol,
  address,
  chain = 'ethereum',
  compact = false,
}: TokenChartProps) {
  const [price, setPrice] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pair, setPair] = useState<DexScreenerPair | null>(null);

  useEffect(() => {
    const id = symbol ?? address;
    if (!id) {
      setLoading(false);
      setError(true);
      return;
    }

    let cancelled = false;

    fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ pairs?: DexScreenerPair[] }>) : null))
      .then((data) => {
        if (cancelled) return;
        const p = data?.pairs?.[0];
        if (p) {
          setPair(p);
          setPrice(Number.parseFloat(p.priceUsd));
          setChange24h(p.priceChange?.h24 ?? null);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, address]);

  if (loading) {
    return <div className="h-16 animate-pulse rounded-lg bg-muted" />;
  }

  if (error || price === null) return null;

  const changeColor = change24h !== null && change24h >= 0 ? 'text-green-500' : 'text-red-500';
  const displaySymbol = (pair?.baseToken?.symbol ?? symbol ?? '?').toUpperCase();

  if (compact) {
    return (
      <a
        href={pair?.url ? `https://dexscreener.com/${pair.chainId}/${pair.pairAddress}` : undefined}
        target="_blank" rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-sm transition-colors hover:bg-muted/80"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <span className="font-mono font-bold">
          ${price < 0.01 ? price.toFixed(6) : price.toFixed(2)}
        </span>
        {change24h !== null && (
          <span className={`font-mono ${changeColor}`}>
            {change24h >= 0 ? '+' : ''}
            {change24h.toFixed(2)}%
          </span>
        )}
        <span className="text-xs text-muted-foreground">{displaySymbol}</span>
      </a>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold">{displaySymbol}</span>
        <span className="font-mono text-lg">
          ${price < 0.01 ? price.toFixed(6) : price.toFixed(2)}
        </span>
      </div>
      {change24h !== null && (
        <div className={`text-sm ${changeColor}`}>
          24h: {change24h >= 0 ? '+' : ''}
          {change24h.toFixed(2)}%
        </div>
      )}
      {pair?.liquidity?.usd !== undefined && (
        <div className="mt-1 text-xs text-muted-foreground">
          Liq: ${(pair.liquidity.usd / 1000).toFixed(0)}K
        </div>
      )}
      {/* DexScreener chart iframe for full view */}
      {!compact && address && pair && (
        <iframe
          src={`https://dexscreener.com/${chain}/${pair.pairAddress}?embed=1&theme=dark&trades=0&info=0`}
          className="mt-2 h-64 w-full rounded-lg"
          loading="lazy"
          title={`${displaySymbol} price chart`}
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      )}
    </div>
  );
}
