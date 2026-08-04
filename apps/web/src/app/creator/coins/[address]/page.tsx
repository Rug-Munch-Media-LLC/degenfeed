'use client';

import type { TokenInfo } from '@degenfeed/creator-coin/types';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CreatorCoinComingSoon } from '@/components/creator-coin/CreatorCoinComingSoon';
import { CREATOR_COIN_ENABLED } from '@/lib/creatorCoinConfig';

const BondingCurveChart = dynamic(
  () =>
    import('@/components/creator-coin/BondingCurveChart').then((m) => ({
      default: m.BondingCurveChart,
    })),
  { ssr: false },
);

const TradePanel = dynamic(
  () => import('@/components/creator-coin/TradePanel').then((m) => ({ default: m.TradePanel })),
  { ssr: false },
);

export default function CoinDetailPage() {
  const params = useParams();
  const address = params.address as string;

  const [token, setToken] = useState<TokenInfo | null>(null);
  const [isLive, _setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch coin info
    const fetchToken = async () => {
      try {
        const res = await fetch(`/api/creator-coin/info?address=${address}`);
        if (res.ok) {
          const data = await res.json();
          setToken(data);
        }
      } catch (err) {
        console.error('Failed to fetch token:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchToken();
  }, [address]);

  // Creator coin trading is gated behind CREATOR_COIN_ENABLED.
  if (!CREATOR_COIN_ENABLED) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <CreatorCoinComingSoon
          variant="page"
          title="Creator Coin Trading — Coming Soon"
          description="Trading this creator coin is not yet open to the public. The backend is live in closed testing; trading will be enabled once the contracts have passed end-to-end verification."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-gray-400">Coin not found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-white">{token.name}</h1>
          <span className="text-lg text-gray-500">{token.symbol}</span>
          {isLive && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-sm text-red-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              Creator is LIVE — 2% off!
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{token.chain === 'solana' ? '◎ Solana' : '⧫ Base'}</span>
          <span>{token.uniqueBuyers} holders</span>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(address)}
            className="font-mono text-degen-400 hover:text-degen-300"
          >
            {address.slice(0, 8)}...{address.slice(-6)}
          </button>
        </div>
      </div>

      {/* Trading Interface */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BondingCurveChart
          currentSupply={BigInt(token.totalSupply)}
          currentPrice={BigInt(token.price)}
        />
        <TradePanel
          token={token}
          chain={token.chain}
          onBuy={async (amountIn, minOut) => {
            await fetch('/api/creator-coin/trade', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'buy',
                tokenAddress: address,
                chain: token.chain,
                amountIn: amountIn.toString(),
                minTokensOut: minOut.toString(),
              }),
            });
          }}
          onSell={async (amountIn) => {
            await fetch('/api/creator-coin/trade', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'sell',
                tokenAddress: address,
                chain: token.chain,
                amountIn: amountIn.toString(),
              }),
            });
          }}
          isLive={isLive}
          liveBoostBps={200}
        />
      </div>

      {/* Cross-chain view */}
      {token.chain === 'solana' && (
        <div className="mt-6 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
              <span className="text-lg">⧫</span>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-400">Cross-Chain on Base</p>
              <p className="text-xs text-blue-400/60">
                This coin has a wrapped ERC-20 on Base. Trade on Uniswap V4 or view on Zora.
              </p>
            </div>
            <a
              href={`https://zora.co/coin/base:${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto rounded-lg bg-blue-500/20 px-3 py-1.5 text-sm text-blue-400 hover:bg-blue-500/30"
            >
              View on Zora →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
