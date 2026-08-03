'use client';

export function MarketPriceCard({
  symbol,
  price,
  change24h,
  loading,
}: {
  symbol: string;
  price: string;
  change24h: number;
  loading: boolean;
}) {
  const isPositive = change24h >= 0;
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="w-8 text-xs font-bold text-gray-400">{symbol}</span>
        {loading ? (
          <div className="h-4 w-16 animate-pulse rounded bg-gray-700" />
        ) : (
          <span className="text-xs font-medium text-white">${price}</span>
        )}
      </div>
      {loading ? (
        <div className="h-4 w-12 animate-pulse rounded bg-gray-700" />
      ) : (
        <span
          className={`text-xs font-mono font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}
        >
          {isPositive ? '+' : ''}
          {change24h.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

export function NewsMarketSidebar({
  marketPrices,
  pricesLoading,
}: {
  marketPrices: Record<string, { price: string; change24h: number }>;
  pricesLoading: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Market Prices
      </h3>
      <div className="space-y-2">
        <MarketPriceCard
          symbol="BTC"
          price={marketPrices.BTC?.price || '—'}
          change24h={marketPrices.BTC?.change24h ?? 0}
          loading={pricesLoading}
        />
        <MarketPriceCard
          symbol="ETH"
          price={marketPrices.ETH?.price || '—'}
          change24h={marketPrices.ETH?.change24h ?? 0}
          loading={pricesLoading}
        />
        <MarketPriceCard
          symbol="SOL"
          price={marketPrices.SOL?.price || '—'}
          change24h={marketPrices.SOL?.change24h ?? 0}
          loading={pricesLoading}
        />
        <MarketPriceCard
          symbol="DOGE"
          price={marketPrices.DOGE?.price || '—'}
          change24h={marketPrices.DOGE?.change24h ?? 0}
          loading={pricesLoading}
        />
        <MarketPriceCard
          symbol="BNB"
          price={marketPrices.BNB?.price || '—'}
          change24h={marketPrices.BNB?.change24h ?? 0}
          loading={pricesLoading}
        />
      </div>
    </div>
  );
}
