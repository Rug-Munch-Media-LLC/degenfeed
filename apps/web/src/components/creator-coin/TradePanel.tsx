'use client';

import type { CreatorChain, TokenInfo } from '@degenfeed/creator-coin/types';
import { useState } from 'react';

interface TradePanelProps {
  token: TokenInfo;
  chain: CreatorChain;
  onBuy: (amountIn: bigint, minOut: bigint) => Promise<void>;
  onSell: (amountIn: bigint, minOut?: bigint) => Promise<void>;
  isLive?: boolean;
  liveBoostBps?: number;
  disabled?: boolean;
}

/**
 * TradePanel — buy/sell interface for a creator coin.
 * Shows price, amount input, slippage, and live boost indicator.
 */
export function TradePanel({
  token,
  chain,
  onBuy,
  onSell,
  isLive,
  liveBoostBps,
  disabled,
}: TradePanelProps) {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [inputAmount, setInputAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [trading, setTrading] = useState(false);

  const nativeSymbol = chain === 'solana' ? 'SOL' : 'ETH';

  const priceNum = Number(token.price) / 1e18;
  const inputNum = parseFloat(inputAmount) || 0;
  const tokensOut = priceNum > 0 ? inputNum / priceNum : 0;
  const displayPrice = isLive && liveBoostBps ? priceNum * (1 - liveBoostBps / 10000) : priceNum;

  const handleTrade = async () => {
    if (!inputAmount || inputNum <= 0) return;

    setTrading(true);
    try {
      const nativeDecimals = chain === 'solana' ? 1e9 : 1e18;
      const amountIn = BigInt(Math.floor(inputNum * nativeDecimals));

      if (mode === 'buy') {
        const minOut = BigInt(Math.floor(tokensOut * (1 - slippage / 100) * 1e18));
        await onBuy(amountIn, minOut);
      } else {
        const tokenDecimals = chain === 'solana' ? 1e9 : 1e18;
        const amountTokens = BigInt(Math.floor(inputNum * tokenDecimals));
        await onSell(amountTokens);
      }

      setInputAmount('');
    } catch (err) {
      console.error('Trade failed:', err);
    } finally {
      setTrading(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/50 p-4">
      {/* Mode Toggle */}
      <div className="mb-4 flex rounded-lg bg-gray-800 p-1">
        <button
          onClick={() => setMode('buy')}
          className={`flex-1 rounded-md py-2 text-sm font-semibold transition-all ${
            mode === 'buy'
              ? 'bg-gradient-to-r from-degen-500 to-green-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setMode('sell')}
          className={`flex-1 rounded-md py-2 text-sm font-semibold transition-all ${
            mode === 'sell'
              ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Sell
        </button>
      </div>

      {/* Live Boost Banner */}
      {isLive && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="text-xs font-medium text-red-400">
            Creator is LIVE! {liveBoostBps ? `${liveBoostBps / 100}% discount` : 'Boost active'}
          </span>
        </div>
      )}

      {/* Current Price */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-gray-500">Price</span>
        <span className="text-sm font-bold text-white">
          {displayPrice < 0.000001 ? '<$0.000001' : `$${displayPrice.toFixed(8)}`}
          {isLive && liveBoostBps && (
            <span className="ml-1 text-xs text-red-400 line-through">${priceNum.toFixed(8)}</span>
          )}
        </span>
      </div>

      {/* Input */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>{mode === 'buy' ? 'You spend' : 'You sell'}</span>
          <button
            onClick={() => setInputAmount(mode === 'buy' ? '0.1' : '1000')}
            className="text-degen-400 hover:text-degen-300"
          >
            Max
          </button>
        </div>
        <div className="flex items-center rounded-lg border border-white/10 bg-gray-800 px-3">
          <input
            type="number"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            placeholder="0.0"
            min={0}
            className="flex-1 bg-transparent py-3 text-lg font-bold text-white placeholder-gray-600 outline-none"
          />
          <span className="text-sm font-medium text-gray-400">{nativeSymbol}</span>
        </div>
      </div>

      {/* Output */}
      <div className="mb-3">
        <div className="text-xs text-gray-500 mb-1">
          {mode === 'buy' ? 'You receive' : 'You receive'}
        </div>
        <div className="flex items-center rounded-lg border border-white/5 bg-gray-800/50 px-3 py-3">
          <span className="flex-1 text-lg font-bold text-gray-300">
            {tokensOut > 0
              ? tokensOut.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : '0.0'}
          </span>
          <span className="text-sm font-medium text-gray-400">{token.symbol}</span>
        </div>
      </div>

      {/* Slippage */}
      <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
        <span>Slippage tolerance</span>
        <div className="flex gap-1">
          {[0.5, 1.0, 2.0].map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              className={`rounded px-2 py-0.5 transition-all ${
                slippage === s
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>

      {/* Trade Button */}
      <button
        onClick={handleTrade}
        disabled={disabled || trading || !inputAmount || inputNum <= 0}
        className={`w-full rounded-lg py-3 font-bold text-white transition-all ${
          mode === 'buy'
            ? 'bg-gradient-to-r from-degen-500 to-green-600 hover:from-degen-400 hover:to-green-500'
            : 'bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-400 hover:to-orange-500'
        } disabled:opacity-50`}
      >
        {trading ? 'Processing...' : `${mode === 'buy' ? 'Buy' : 'Sell'} ${token.symbol}`}
      </button>

      {/* Fee info */}
      <div className="mt-3 space-y-1 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>Platform fee (0.5%)</span>
          <span>Included</span>
        </div>
        <div className="flex justify-between">
          <span>Creator fee ({token.chain === 'solana' ? '1%' : '1%'})</span>
          <span>Included</span>
        </div>
      </div>
    </div>
  );
}
