'use client';

import React from 'react';
import { getDynamicPrice, getProgressPercent, getEraName, TOTAL_SUPPLY, GRADUATION_SUPPLY } from '@degenfeed/creator-coin/bonding-curve';

interface BondingCurveChartProps {
  currentSupply: bigint;
  currentPrice: bigint;
  className?: string;
}

/**
 * BondingCurveChart — visualizes the bonding curve progression.
 * Shows the current price position, era, and graduation progress.
 * Uses pure SVG — no charting library needed.
 */
export function BondingCurveChart({ currentSupply, currentPrice, className = '' }: BondingCurveChartProps) {
  const progress = getProgressPercent(currentSupply);
  const eraIndex = getEraIndex(currentSupply);
  const eraName = getEraName(eraIndex);
  const graduated = currentSupply >= GRADUATION_SUPPLY;

  // Generate curve path points
  const width = 280;
  const height = 120;
  const points: Array<{ x: number; y: number }> = [];

  const steps = 50;
  for (let i = 0; i <= steps; i++) {
    const supply = (GRADUATION_SUPPLY * BigInt(i)) / BigInt(steps);
    const price = getDynamicPrice(supply);
    const x = (i / steps) * width;
    const priceNorm = Number(price) / Number(1000_000_000_000n); // normalize to 0-1
    const y = height - priceNorm * height;
    points.push({ x, y });
  }

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Current position on curve
  const currentX = (progress / 100) * width;
  const currentPriceNorm = Number(currentPrice) / Number(1000_000_000_000n);
  const currentY = height - currentPriceNorm * height;

  // Era colors
  const eraColors = ['#06b6d4', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444'];

  return (
    <div className={`rounded-xl border border-white/10 bg-gray-900/50 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Bonding Curve</h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
            {eraName}
          </span>
          {graduated && (
            <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
              Graduated
            </span>
          )}
        </div>
      </div>

      {/* SVG Chart */}
      <svg viewBox={`0 0 ${width} ${height + 30}`} className="w-full h-auto">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={0}
            y1={height - frac * height}
            x2={width}
            y2={height - frac * height}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        ))}

        {/* Era backgrounds */}
        {[0, 0.05, 0.15, 0.4, 0.7, 1].map((start, i) => {
          if (i === 5) return null;
          const end = [0.05, 0.15, 0.4, 0.7, 1][i]!;
          const x1 = start * width;
          const x2 = end * width;
          return (
            <rect
              key={i}
              x={x1}
              y={0}
              width={x2 - x1}
              height={height}
              fill={eraColors[i]}
              opacity={0.03}
            />
          );
        })}

        {/* Curve */}
        <path d={pathD} fill="none" stroke="url(#curveGradient)" strokeWidth="2.5" />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="curveGradient" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="25%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#22c55e" />
            <stop offset="75%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>

        {/* Current price dot */}
        {!graduated && (
          <>
            <circle cx={currentX} cy={currentY} r="5" fill="#f59e0b" stroke="#fff" strokeWidth="2">
              <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite" />
            </circle>
            {/* Dotted lines */}
            <line x1={currentX} y1={currentY} x2={currentX} y2={height} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
            <line x1={0} y1={currentY} x2={currentX} y2={currentY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
          </>
        )}

        {/* Labels */}
        <text x={0} y={height + 15} fill="rgba(255,255,255,0.3)" fontSize="9">0%</text>
        <text x={width / 2} y={height + 15} fill="rgba(255,255,255,0.3)" fontSize="9" textAnchor="middle">Supply →</text>
        <text x={width} y={height + 15} fill="rgba(255,255,255,0.3)" fontSize="9" textAnchor="end">100%</text>
        <text x={0} y={10} fill="rgba(255,255,255,0.3)" fontSize="9">Price ↑</text>
      </svg>

      {/* Stats */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-gray-800/50 p-2 text-center">
          <div className="text-gray-500">Progress</div>
          <div className="font-semibold text-white">{progress.toFixed(0)}%</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 p-2 text-center">
          <div className="text-gray-500">Supply Minted</div>
          <div className="font-semibold text-white">{(Number(currentSupply) / 1e18).toFixed(2)}M</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 p-2 text-center">
          <div className="text-gray-500">Era</div>
          <div className="font-semibold text-white">{eraName}</div>
        </div>
      </div>
    </div>
  );
}

function getEraIndex(supply: bigint): number {
  const thresholds = [5, 15, 40, 70, 100];
  const progress = getProgressPercent(supply);
  for (let i = 0; i < thresholds.length; i++) {
    if (progress <= thresholds[i]!) return i;
  }
  return thresholds.length - 1;
}
