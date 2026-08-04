'use client';

import type { CreatorChain, DeployResult, TokenInfo } from '@degenfeed/creator-coin/types';
import { useCallback, useEffect, useState } from 'react';
import { BondingCurveChart } from './BondingCurveChart';
import { CoinCardSimple, type CoinDisplayData } from './CoinCard';
import { DeployCoinDialog } from './DeployCoinDialog';
import { TradePanel } from './TradePanel';

interface CreatorCoinDashboardProps {
  /** Creator's wallet address */
  creator: string;
  /** List of tokens owned by this creator */
  tokens?: TokenInfo[];
  /** Solana RPC URL */
  solanaRpcUrl?: string;
  /** Base RPC URL */
  baseRpcUrl?: string;
}

/**
 * CreatorCoinDashboard — main dashboard for managing creator coins.
 * Shows all tokens, deploy button, and per-coin trading interface.
 */
export function CreatorCoinDashboard({
  creator,
  tokens: initialTokens,
}: CreatorCoinDashboardProps) {
  const [tokens, setTokens] = useState<TokenInfo[]>(initialTokens ?? []);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [showDeploy, setShowDeploy] = useState(false);
  const [liveTokens, setLiveTokens] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleDeploy = useCallback(
    async (config: {
      name: string;
      symbol: string;
      uri: string;
      chain: CreatorChain;
      creatorAllocationBps: number;
      creatorFeeBps: number;
      crossChain: boolean;
    }) => {
      setLoading(true);
      try {
        // In production: call API route that uses CreatorCoinClient
        const res = await fetch('/api/creator-coin/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...config, creator, crossChain: config.crossChain }),
        });
        const data: DeployResult = await res.json();

        const newToken: TokenInfo = {
          address: data.primaryAddress,
          name: config.name,
          symbol: config.symbol,
          price: '0',
          totalSupply: data.totalSupply,
          totalRaised: '0',
          uniqueBuyers: 1,
          graduated: false,
          decimals: config.chain === 'solana' ? 9 : 18,
          chain: config.chain,
          createdAt: Date.now(),
          creator,
        };

        setTokens((prev) => [...prev, newToken]);
      } finally {
        setLoading(false);
      }
    },
    [creator],
  );

  const handleBuy = useCallback(
    async (amountIn: bigint, minOut: bigint) => {
      if (!selectedToken) return;
      const res = await fetch('/api/creator-coin/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'buy',
          tokenAddress: selectedToken.address,
          chain: selectedToken.chain,
          amountIn: amountIn.toString(),
          minTokensOut: minOut.toString(),
        }),
      });
      const data = await res.json();
      console.log('Buy result:', data);
    },
    [selectedToken],
  );

  const handleSell = useCallback(
    async (amountIn: bigint) => {
      if (!selectedToken) return;
      const res = await fetch('/api/creator-coin/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sell',
          tokenAddress: selectedToken.address,
          chain: selectedToken.chain,
          amountIn: amountIn.toString(),
        }),
      });
      const data = await res.json();
      console.log('Sell result:', data);
    },
    [selectedToken],
  );

  // ─── Live monitoring (simulated) ───────────────────────────────────

  useEffect(() => {
    // In production: connect to LiveStreamMonitor
    const interval = setInterval(() => {
      // Randomly simulate live status for demo
      if (tokens.length > 0 && Math.random() > 0.95) {
        const randomToken = tokens[Math.floor(Math.random() * tokens.length)];
        if (randomToken) {
          setLiveTokens((prev) => {
            const next = new Set(prev);
            if (next.has(randomToken.address)) {
              next.delete(randomToken.address);
            } else {
              next.add(randomToken.address);
            }
            return next;
          });
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [tokens]);

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Creator Coins</h1>
          <p className="text-sm text-gray-400">Your tokens with bonding curve economics</p>
        </div>
        <button
          type="button"
          onClick={() => setShowDeploy(true)}
          className="rounded-lg bg-gradient-to-r from-degen-500 to-purple-600 px-4 py-2 text-sm font-bold text-white transition-all hover:from-degen-400 hover:to-purple-500"
        >
          + New Coin
        </button>
      </div>

      {/* Token Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tokens.length === 0 && !loading && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-gray-900/30 py-12">
            <div className="text-4xl mb-3">🪙</div>
            <p className="text-gray-400 mb-1">No creator coins yet</p>
            <p className="text-sm text-gray-600 mb-4">
              Deploy your first coin to start the bonding curve
            </p>
            <button
              type="button"
              onClick={() => setShowDeploy(true)}
              className="rounded-lg bg-degen-500/20 px-4 py-2 text-sm font-medium text-degen-400 hover:bg-degen-500/30"
            >
              Deploy your first coin
            </button>
          </div>
        )}

        {tokens.map((token) => {
          const priceNum = Number(token.price) / 1e18;
          const supplyNum = Number(token.totalSupply) / 1e18;
          const coinData: CoinDisplayData = {
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            chain: token.chain === 'solana' ? 'solana' : 'base',
            price: priceNum,
            priceChange24h: 0,
            marketCap: priceNum * supplyNum,
            volume24h: 0,
            holderCount: token.uniqueBuyers,
            totalSupply: supplyNum,
            graduated: token.graduated,
            bondingPhase: 0,
            createdAt: token.createdAt,
            creator: token.creator,
            isLive: liveTokens.has(token.address),
          };
          return (
            <CoinCardSimple
              key={token.address}
              coin={coinData}
              onClick={() => setSelectedToken(token)}
            />
          );
        })}
      </div>

      {/* Selected Token Detail */}
      {selectedToken && (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              {selectedToken.name}
              <span className="ml-2 text-sm font-normal text-gray-500">{selectedToken.symbol}</span>
              {liveTokens.has(selectedToken.address) && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                  LIVE
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{selectedToken.chain === 'solana' ? '◎ Solana' : '⧫ Base'}</span>
              <button
                type="button"
                onClick={() => setSelectedToken(null)}
                className="rounded-full bg-gray-800 px-2 py-1 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BondingCurveChart
              currentSupply={BigInt(selectedToken.totalSupply)}
              currentPrice={BigInt(selectedToken.price)}
            />
            <TradePanel
              token={selectedToken}
              chain={selectedToken.chain}
              onBuy={handleBuy}
              onSell={handleSell}
              isLive={liveTokens.has(selectedToken.address)}
              liveBoostBps={200}
            />
          </div>

          {/* Cross-chain info (if applicable) */}
          {selectedToken.chain === 'solana' && (
            <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <span>⧫</span>
                <span>
                  This coin has a wrapped version on Base.{' '}
                  <button type="button" className="underline hover:text-blue-300">
                    View on Base
                  </button>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deploy Dialog */}
      <DeployCoinDialog
        open={showDeploy}
        onClose={() => setShowDeploy(false)}
        onDeploy={handleDeploy}
      />
    </div>
  );
}
