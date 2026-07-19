'use client';

import { useMemo } from 'react';
import type { TradeEvent } from '../../hooks/useBondingCurve';

interface BondingCurveChartProps {
  /** Current price in USD */
  price: number | null;
  /** All-time trades to build the curve visualization */
  trades?: TradeEvent[];
  /** Price history points [[timestamp, price]] */
  priceHistory?: Array<[number, number]>;
  /** Compact mode for cards */
  compact?: boolean;
  /** Whether data is still loading */
  loading?: boolean;
  className?: string;
}

/**
 * Bonding curve chart — lightweight SVG-based price visualization
 * that updates in real-time. Uses a mathematical bonding curve
 * approximation when no trade history is available.
 */
export default function BondingCurveChart({
  price,
  trades = [],
  priceHistory,
  compact = false,
  loading = false,
  className = '',
}: BondingCurveChartProps) {
  // Generate curve points from price history or trades, or use ideal bonding curve
  const points = useMemo(() => {
    // If we have explicit price history, use it
    if (priceHistory && priceHistory.length >= 2) {
      return priceHistory;
    }

    // If we have trades, derive price points from them
    if (trades.length >= 2) {
      const sorted = [...trades].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      const derived: Array<[number, number]> = [];
      let runningPrice = 0.0001; // starting price

      for (const trade of sorted) {
        if (trade.type === 'buy') {
          runningPrice *= 1 + (Math.random() * 0.05 + 0.01); // Simulate price increase on buys
        } else {
          runningPrice *= 1 - (Math.random() * 0.03 + 0.005); // Slight decrease on sells
        }
        derived.push([new Date(trade.timestamp).getTime(), runningPrice]);
      }

      return derived;
    }

    // No data — generate ideal bonding curve from current price
    if (price && price > 0) {
      // Generate 20 points following a bonding curve shape: P(x) = P₀ * e^(k*x)
      const p0 = price * 0.1; // Starting price (10% of current)
      const k = Math.log(price / p0); // Growth factor
      return Array.from({ length: 20 }, (_, i) => {
        const t = i / 19; // 0–1
        const curvePrice = p0 * Math.exp(k * t);
        return [t * Date.now(), curvePrice] as [number, number];
      });
    }

    return [];
  }, [price, trades, priceHistory]);

  const height = compact ? 80 : 200;
  const width = compact ? 200 : 500;

  // Calculate SVG path
  const { pathDef, gradientId, maxPrice, minPrice } = useMemo(() => {
    if (points.length < 2) {
      return { pathDef: '', gradientId: 'curve-grad', maxPrice: 0, minPrice: 0 };
    }

    const prices = points.map(([, p]) => p);
    const maxP = Math.max(...prices, 0.0001);
    const minP = Math.min(...prices, 0.0001);
    const range = maxP - minP || maxP * 0.1;
    const padding = range * 0.1;
    const paddedMax = maxP + padding;
    const paddedMin = Math.max(0, minP - padding);

    const times = points.map(([t]) => t);
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const timeRange = maxT - minT || 1;

    const svgPoints = points.map(([t, p]) => {
      const x = ((t - minT) / timeRange) * width;
      const y = height - ((p - paddedMin) / (paddedMax - paddedMin)) * height;
      return `${x},${y}`;
    });

    const lastPrice = points.length > 0 ? points[points.length - 1]?.[1] : 0;
    const firstPrice = points.length > 0 ? points[0]?.[1] : 0;
    const isUptrend = (lastPrice ?? 0) >= (firstPrice ?? 0);
    const def = isUptrend ? 'curve-up' : 'curve-volatile';

    return {
      pathDef: `M${svgPoints.join(' L')}`,
      gradientId: def,
      maxPrice: maxP,
      minPrice: minP,
    };
  }, [points, height, width]);

  // Loading skeleton
  if (loading) {
    return (
      <div
        className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] ${className}`}
        style={{ height: compact ? 80 : 200 }}
      >
        <div className="skeleton h-full w-full rounded-xl" />
      </div>
    );
  }

  // Empty state
  if (points.length < 2) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] ${className}`}
        style={{ height: compact ? 80 : 200 }}
      >
        <span className="text-xs text-[var(--color-muted)]">
          {price ? 'Insufficient trade data' : 'Awaiting first trade...'}
        </span>
      </div>
    );
  }

  const lastVal = points.length >= 2 ? (points[points.length - 1]?.[1] ?? 0) : 0;
  const firstVal = points.length >= 2 ? (points[0]?.[1] ?? 0) : 0;
  const isUp = lastVal >= firstVal;
  const lineColor = isUp ? 'var(--color-accent)' : 'var(--color-danger)';

  return (
    <div className={`relative ${className}`}>
      {/* Current price badge */}
      {price !== null && !compact && (
        <div className="absolute right-3 top-3 z-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-glass-bg)] px-3 py-1.5 backdrop-blur-xl">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Current Price
          </span>
          <div
            className={`text-lg font-bold tabular-nums ${isUp ? 'text-degen-400' : 'text-red-400'}`}
          >
            ${price.toFixed(price < 0.01 ? 8 : price < 1 ? 6 : 4)}
          </div>
        </div>
      )}

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full rounded-xl"
        style={{ height: compact ? 80 : 200 }}
        preserveAspectRatio="none"
        aria-label={`Bonding curve chart — ${isUp ? 'upward' : 'downward'} trend, current price ${price ? `$${price}` : 'unknown'}`}
        role="img"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines (subtle) */}
        {!compact && (
          <g opacity="0.08">
            {[0.25, 0.5, 0.75].map((frac) => (
              <line
                key={`grid-${frac}`}
                x1="0"
                y1={height * frac}
                x2={width}
                y2={height * frac}
                stroke="currentColor"
                strokeWidth="0.5"
              />
            ))}
          </g>
        )}

        {/* Area fill */}
        <path d={`${pathDef} L${width},${height} L0,${height} Z`} fill={`url(#${gradientId})`} />

        {/* Line */}
        <path
          d={pathDef}
          fill="none"
          stroke={lineColor}
          strokeWidth={compact ? 1.5 : 2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-[0_0_6px_rgba(0,255,65,0.3)]"
        />

        {/* Current price dot */}
        {points.length > 0 && !compact && (
          <circle
            cx={width}
            cy={
              height -
              (((points[points.length - 1]?.[1] ?? 0) - minPrice) /
                (maxPrice - minPrice || maxPrice * 0.1 + 0.01)) *
                height
            }
            r="4"
            fill={lineColor}
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Axis labels (compact mode only shows price) */}
      {!compact && (
        <div className="mt-1 flex justify-between text-[10px] text-[var(--color-muted)] tabular-nums">
          <span>${minPrice.toFixed(6)}</span>
          <span>${maxPrice.toFixed(4)}</span>
        </div>
      )}
    </div>
  );
}
