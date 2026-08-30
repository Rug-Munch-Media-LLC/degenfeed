'use client';

import type { CreatorChain, DeployResult, TokenInfo } from '@degenfeed/creator-coin/types';
import { useCallback, useState } from 'react';
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

interface TradeResultState {
  txHash: string;
  explorerUrl: string;
  action: 'buy' | 'sell';
  amount: string;
  symbol: string;
}

/**
 * CreatorCoinDashboard — main dashboard for managing creator coins.
 * Shows all tokens, deploy button, and per-coin trading interface.
 *
 * All deploy/trade requests hit the real API routes. API errors are
 * surfaced in the UI — never swallowed, never simulated. The former
 * Math.random "live monitoring" loop was removed 2026-08-30: there is
 * no live-status data source wired up, so no live indicator is shown.
 */
export function CreatorCoinDashboard({
  creator,
  tokens: initialTokens,
}: CreatorCoinDashboardProps) {
  const [tokens, setTokens] = useState<TokenInfo[]>(initialTokens ?? []);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [showDeploy, setShowDeploy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [trading, setTrading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeResult, setTradeResult] = useState<TradeResultState | null>(null);

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
      setDeployError(null);
      try {
        // Real deployment path (proxy to Workers API). The former mock route
        // returned a fabricated txHash and was removed 2026-08-23 (TOP-100 #4).
        const res = await fetch('/api/creator/coin/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: config.name,
            symbol: config.symbol,
            creatorAllocation: config.creatorAllocationBps / 100,
            creator,
          }),
        });
        const data: DeployResult & { error?: string } = await res.json();
        if (!res.ok || !data?.primaryAddress) {
          throw new Error(data?.error ?? `Deployment failed (HTTP ${res.status})`);
        }

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
      } catch (err) {
        setDeployError(err instanceof Error ? err.message : 'Deployment failed');
      } finally {
        setLoading(false);
      }
    },
    [creator],
  );

  /**
   * POST /api/creator-coin/trade requires `amount` as a human-readable
   * decimal string (the route applies its own toSmallestUnit scaling).
   * TradePanel hands us bigint smallest-unit values, so convert back.
   * The former payload sent `amountIn`, which the zod schema strips —
   * every trade 400'd and the error was swallowed.
   */
  const postTrade = useCallback(
    async (action: 'buy' | 'sell', amount: string, minTokensOut?: string) => {
      if (!selectedToken) return;
      setTradeError(null);
      setTradeResult(null);
      setTrading(true);
      try {
        const res = await fetch('/api/creator-coin/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            amount,
            tokenAddress: selectedToken.address,
            chain: selectedToken.chain,
            ...(minTokensOut ? { minTokensOut } : {}),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          configured?: boolean;
          txHash?: string;
          explorerUrl?: string;
          error?: string;
        };
        if (data.configured === false) {
          setTradeError(data.error || 'Trading not configured — contracts are not deployed yet.');
          return;
        }
        if (data.txHash) {
          setTradeResult({
            txHash: data.txHash,
            explorerUrl: data.explorerUrl || '',
            action,
            amount,
            symbol: selectedToken.symbol,
          });
          return;
        }
        setTradeError(data.error || `Trade failed (HTTP ${res.status})`);
      } catch {
        setTradeError('Trade failed — network error. Please try again.');
      } finally {
        setTrading(false);
      }
    },
    [selectedToken],
  );

  const handleBuy = useCallback(
    async (amountIn: bigint, minOut: bigint) => {
      if (!selectedToken) return;
      const decimals = selectedToken.chain === 'solana' ? 9 : 18;
      const amount = (Number(amountIn) / 10 ** decimals).toString();
      await postTrade('buy', amount, minOut.toString());
    },
    [selectedToken, postTrade],
  );

  const handleSell = useCallback(
    async (amountIn: bigint) => {
      if (!selectedToken) return;
      const decimals = selectedToken.chain === 'solana' ? 9 : 18;
      const amount = (Number(amountIn) / 10 ** decimals).toString();
      await postTrade('sell', amount);
    },
    [selectedToken, postTrade],
  );

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

      {/* Deploy error — surfaced, never swallowed */}
      {deployError && (
        <div
          className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400"
          role="alert"
        >
          {deployError}
        </div>
      )}

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
            isLive: false,
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
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{selectedToken.chain === 'solana' ? '◎ Solana' : '⧫ Base'}</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedToken(null);
                  setTradeError(null);
                  setTradeResult(null);
                }}
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
            {/* No isLive/liveBoostBps: there is no live-status source, and the
                "live boost discount" was fabricated pricing. */}
            <TradePanel
              token={selectedToken}
              chain={selectedToken.chain}
              onBuy={handleBuy}
              onSell={handleSell}
            />
          </div>

          {/* Trade status — real API outcome, surfaced */}
          {trading && (
            <div className="mt-3 rounded-lg border border-white/10 bg-gray-900/50 p-2 text-center text-xs text-gray-400">
              ⏳ Submitting {tradeResult?.action ?? 'trade'} transaction…
            </div>
          )}
          {tradeError && (
            <div
              className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400"
              role="alert"
            >
              {tradeError}
            </div>
          )}
          {tradeResult && !trading && (
            <div className="mt-3 rounded-lg border border-degen-500/30 bg-degen-500/10 p-2 text-xs">
              <div className="font-semibold text-degen-400">
                ✅ {tradeResult.action === 'sell' ? 'Sold' : 'Bought'} {tradeResult.amount}{' '}
                {tradeResult.symbol}
              </div>
              {tradeResult.explorerUrl && (
                <a
                  href={tradeResult.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block font-mono text-gray-400 hover:text-degen-400"
                >
                  View transaction ↗
                </a>
              )}
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
