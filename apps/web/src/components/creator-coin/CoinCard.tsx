'use client';

import React from 'react';
import type { TokenInfo, CreatorChain } from '@degenfeed/creator-coin/types';

interface CoinCardProps {
  token: TokenInfo;
  onClick?: () => void;
  isLive?: boolean;
  liveBoostBps?: number;
}

/**
 * CoinCard — displays a creator coin summary.
 * Shows name, symbol, price, market cap, and live status.
 */
export function CoinCard({ token, onClick, isLive, liveBoostBps }: CoinCardProps) {
  const priceNum = Number(token.price) / 1e18;
  const supplyNum = Number(token.totalSupply) / 1e18;
  const marketCap = priceNum * supplyNum;

  return (
    <div
      onClick={onClick}
      className={`
        group relative cursor-pointer rounded-xl border border-white/10
        bg-gradient-to-br from-gray-900 to-gray-800 p-4
        transition-all duration-200 hover:border-degen-500/50 hover:shadow-lg hover:shadow-degen-500/10
        ${token.graduated ? 'ring-1 ring-purple-500/30' : ''}
      `}
    >
      {/* Live badge */}
      {isLive && (
        <div className="absolute -right-1 -top-1 flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-semibold text-white shadow-lg">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          LIVE
          {liveBoostBps ? ` ${liveBoostBps / 100}% off` : ''}
        </div>
      )}

      {/* Chain badge */}
      <div className="mb-2 flex items-center justify-between">
        <span className={`
          inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
          ${token.chain === 'solana'
            ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-cyan-400'
            : 'bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-400'}
        `}>
          {token.chain === 'solana' ? '◎ Solana' : '⧫ Base'}
        </span>
        {token.graduated && (
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
            Graduated
          </span>
        )}
      </div>

      {/* Name & Symbol */}
      <h3 className="text-lg font-bold text-white truncate">{token.name}</h3>
      <p className="text-sm text-gray-400">{token.symbol}</p>

      {/* Price */}
      <div className="mt-3 space-y-1">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-gray-500">Price</span>
          <span className="text-lg font-bold text-white">
            {priceNum < 0.0001 ? '<$0.0001' : `$${priceNum.toFixed(6)}`}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-gray-500">Market Cap</span>
          <span className="text-sm font-medium text-gray-300">
            ${marketCap.toFixed(2)}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-gray-500">Holders</span>
          <span className="text-sm font-medium text-gray-300">
            {token.uniqueBuyers}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Bonding Curve</span>
          <span>{token.graduated ? '100%' : `${Math.min(100, (supplyNum / 800_000_000) * 100).toFixed(0)}%`}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-700">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              token.graduated
                ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                : 'bg-gradient-to-r from-degen-500 to-yellow-500'
            }`}
            style={{ width: `${token.graduated ? 100 : Math.min(100, (supplyNum / 800_000_000) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
