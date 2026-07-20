'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { TradeEvent } from '../../hooks/useBondingCurve';
import { useIsMobile } from '../../hooks/useMobileResponsive';

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
  /** Error message */
  error?: string | null;
  /** Retry callback */
  onRetry?: () => void;
  className?: string;

  // ── New Features ──────────────────────────────────────

  /** User's past buy points for "You bought here" markers */
  userBuys?: Array<{ timestamp: number; price: number; amount: number }>;
  /** Predicted price after N more buys */
  priceAfter10Buys?: number;
  priceAfter50Buys?: number;
  /** Volume data for bars at bottom */
  volumeData?: Array<{ timestamp: number; volume: number }>;
  /** Current timeframe view */
  timeframe?: '1h' | '6h' | '24h' | 'all';
  /** Timeframe change handler */
  onTimeframeChange?: (tf: '1h' | '6h' | '24h' | 'all') => void;
  /** Current bonding curve era name */
  eraName?: string;
}

const TIMEFRAMES = ['1h', '6h', '24h', 'all'] as const;
const ERA_COLORS: Record<string, string> = {
  'Steal Deal': '#06b6d4',
  'Early Bird': '#22c55e',
  'Cruise': '#eab308',
  'FOMO Zone': '#f97316',
  'Finale': '#ef4444',
};

export default function BondingCurveChart({
  price,
  trades = [],
  priceHistory,
  compact = false,
  loading = false,
  error = null,
  onRetry,
  className = '',
  userBuys,
  priceAfter10Buys,
  priceAfter50Buys,
  volumeData,
  timeframe = 'all',
  onTimeframeChange,
  eraName,
}: BondingCurveChartProps) {
  const isMobile = useIsMobile();
  const svgRef = useRef<SVGSVGElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Responsive dimensions
  const height = useMemo(() => {
    if (compact) return isMobile ? 64 : 80;
    return isMobile ? 200 : 260;
  }, [compact, isMobile]);

  const width = 500;
  const volumeHeight = compact ? 0 : 30;

  // ── Swipe handler for timeframe change on mobile ──────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]!.clientX;
    touchStartY.current = e.touches[0]!.clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0]!.clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0]!.clientY - touchStartY.current);
    if (Math.abs(dx) < 50 || dy > Math.abs(dx)) return; // Minimum swipe + horizontal only

    const idx = TIMEFRAMES.indexOf(timeframe);
    if (dx > 0 && idx > 0) {
      onTimeframeChange?.(TIMEFRAMES[idx - 1]);
    } else if (dx < 0 && idx < TIMEFRAMES.length - 1) {
      onTimeframeChange?.(TIMEFRAMES[idx + 1]);
    }
  }, [timeframe, onTimeframeChange]);

  // ── Generate curve points ──────────────────────────────

  const points = useMemo(() => {
    if (priceHistory && priceHistory.length >= 2) return priceHistory;
    if (trades.length >= 2) {
      const sorted = [...trades].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      const derived: Array<[number, number]> = [];
      let runningPrice = 0.0001;
      for (const trade of sorted) {
        if (trade.type === 'buy') {
          runningPrice *= 1 + (Math.random() * 0.05 + 0.01);
        } else {
          runningPrice *= 1 - (Math.random() * 0.03 + 0.005);
        }
        derived.push([new Date(trade.timestamp).getTime(), runningPrice]);
      }
      return derived;
    }
    if (price && price > 0) {
      const p0 = price * 0.1;
      const k = Math.log(price / p0);
      return Array.from({ length: 20 }, (_, i) => {
        const t = i / 19;
        const curvePrice = p0 * Math.exp(k * t);
        return [t * Date.now(), curvePrice] as [number, number];
      });
    }
    return [];
  }, [price, trades, priceHistory]);

  // ── SVG path calculations ──────────────────────────────

  const { pathDef, gradientId, maxPrice, minPrice, timeRange, minTime } = useMemo(() => {
    if (points.length < 2) {
      return { pathDef: '', gradientId: 'curve-grad', maxPrice: 0, minPrice: 0, timeRange: 1, minTime: 0 };
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
    const tRange = maxT - minT || 1;

    const svgPoints = points.map(([t, p]) => {
      const x = ((t - minT) / tRange) * width;
      const y = volumeHeight + height - ((p - paddedMin) / (paddedMax - paddedMin)) * (height - volumeHeight);
      return `${x},${y}`;
    });

    const lastPrice = points[points.length - 1]?.[1] ?? 0;
    const firstPrice = points[0]?.[1] ?? 0;
    const isUptrend = lastPrice >= firstPrice;
    const def = isUptrend ? 'curve-up' : 'curve-volatile';

    return {
      pathDef: `M${svgPoints.join(' L')}`,
      gradientId: def,
      maxPrice: maxP,
      minPrice: minP,
      timeRange: tRange,
      minTime: minT,
    };
  }, [points, height, volumeHeight]);

  const lastVal = points.length >= 2 ? (points[points.length - 1]?.[1] ?? 0) : 0;
  const firstVal = points.length >= 2 ? (points[0]?.[1] ?? 0) : 0;
  const isUp = lastVal >= firstVal;
  const lineColor = isUp ? 'var(--color-accent)' : 'var(--color-danger)';

  // ── Volume bars ────────────────────────────────────────

  const volumeBars = useMemo(() => {
    if (!volumeData?.length) return [];
    const volumes = volumeData.map((d) => d.volume);
    const maxVol = Math.max(...volumes, 1);
    return volumeData.map((d) => ({
      x: ((d.timestamp - minTime) / timeRange) * width,
      height: (d.volume / maxVol) * volumeHeight * 0.8,
    }));
  }, [volumeData, minTime, timeRange]);

  // ── Prediction line points ─────────────────────────────

  const predictionPoints = useMemo(() => {
    if (!points.length || !priceAfter10Buys && !priceAfter50Buys) return null;

    const lastP = points[points.length - 1]!;
    const predictions: Array<[number, number]> = [[lastP[0], lastP[1]]];

    if (priceAfter10Buys) {
      predictions.push([lastP[0] + 1, priceAfter10Buys]);
    }
    if (priceAfter50Buys) {
      predictions.push([lastP[0] + 2, priceAfter50Buys]);
    }

    return predictions;
  }, [points, priceAfter10Buys, priceAfter50Buys]);

  // ── User buy markers ──────────────────────────────────

  const userBuyMarkers = useMemo(() => {
    if (!userBuys?.length || timeRange <= 1) return [];
    return userBuys.map((buy) => ({
      x: ((buy.timestamp - minTime) / timeRange) * width,
      y: volumeHeight + height - ((buy.price - minPrice) / (maxPrice - minPrice || maxPrice * 0.1)) * (height - volumeHeight),
      amount: buy.amount,
    }));
  }, [userBuys, minTime, timeRange, height, maxPrice, minPrice, volumeHeight]);

  // ── Era color ─────────────────────────────────────────

  const eraColor = eraName ? ERA_COLORS[eraName] ?? '#22c55e' : '#22c55e';

  // ── Loading skeleton ───────────────────────────────────

  if (loading) {
    return (
      <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] ${className}`}>
        <div className="skeleton w-full rounded-xl" style={{ height }} />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 ${className}`}
        style={{ minHeight: compact ? (isMobile ? 64 : 80) : isMobile ? 140 : 200 }}
      >
        <p className="text-xs text-red-400 text-center px-4">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-lg bg-red-500/20 px-3 py-1.5 text-[10px] font-medium text-red-400 hover:bg-red-500/30 touch-target"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────

  if (points.length < 2) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] ${className}`}
        style={{ height: compact ? (isMobile ? 64 : 80) : isMobile ? 140 : 200 }}
      >
        <span className="text-[10px] sm:text-xs text-[var(--color-muted)]">
          {price ? 'Insufficient trade data' : 'Awaiting first trade...'}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Current price badge */}
      {price !== null && !compact && (
        <div
          className={`absolute z-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-glass-bg)] px-2 sm:px-3 py-1 sm:py-1.5 backdrop-blur-xl ${
            isMobile
              ? 'left-1/2 -translate-x-1/2 top-1.5'
              : 'right-3 top-3'
          }`}
        >
          <span className="text-[8px] sm:text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Price
          </span>
          <div className={`text-sm sm:text-lg font-bold tabular-nums ${isUp ? 'text-degen-400' : 'text-red-400'}`}>
            ${price.toFixed(price < 0.01 ? 8 : price < 1 ? 6 : 4)}
          </div>
        </div>
      )}

      {/* Era badge */}
      {eraName && !compact && (
        <div
          className={`absolute z-10 rounded-lg border px-2 py-1 text-[9px] sm:text-[10px] font-medium backdrop-blur-xl ${
            isMobile ? 'right-2 top-1.5' : 'left-3 bottom-12'
          }`}
          style={{
            backgroundColor: `${eraColor}15`,
            borderColor: `${eraColor}30`,
            color: eraColor,
          }}
        >
          ⚡ {eraName}
        </div>
      )}

      {/* SVG Chart */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height + volumeHeight}`}
        className="w-full rounded-xl select-none"
        style={{ height: height + volumeHeight }}
        preserveAspectRatio="xMidYMid meet"
        aria-label={`Bonding curve chart — ${isUp ? 'upward' : 'downward'} trend, current price ${price ? `$${price}` : 'unknown'}`}
        role="img"
        onTouchStart={!compact ? handleTouchStart : undefined}
        onTouchEnd={!compact ? handleTouchEnd : undefined}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="volume-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {!compact && (
          <g opacity="0.08">
            {[0.25, 0.5, 0.75].map((frac) => (
              <line
                key={`grid-${frac}`}
                x1="0"
                y1={volumeHeight + height * frac}
                x2={width}
                y2={volumeHeight + height * frac}
                stroke="currentColor"
                strokeWidth="0.5"
              />
            ))}
          </g>
        )}

        {/* Volume bars */}
        {!compact && volumeBars.length > 0 && (
          <g opacity="0.5">
            {volumeBars.map((bar, i) => (
              <rect
                key={`vol-${i}`}
                x={bar.x}
                y={volumeHeight - bar.height}
                width={Math.max(2, width / volumeBars.length - 1)}
                height={bar.height}
                fill="url(#volume-grad)"
                rx="1"
              />
            ))}
          </g>
        )}

        {/* Area fill */}
        <path d={`${pathDef} L${width},${volumeHeight + height} L0,${volumeHeight + height} Z`} fill={`url(#${gradientId})`} />

        {/* Main curve line */}
        <path
          d={pathDef}
          fill="none"
          stroke={lineColor}
          strokeWidth={compact ? 1.5 : 2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-[0_0_6px_rgba(0,255,65,0.3)]"
        />

        {/* Prediction line (dashed) */}
        {predictionPoints && !compact && (
          <>
            <path
              d={`M${predictionPoints.map(([t, p], i) => {
                const x = ((t - minTime) / timeRange) * width;
                const yVal = volumeHeight + height - ((p - minPrice) / (maxPrice - minPrice || maxPrice * 0.1 + 0.01)) * (height - volumeHeight);
                return `${i === 0 ? '' : ' '}${x},${yVal}`;
              }).join(' L')}`}
              fill="none"
              stroke={lineColor}
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.5"
            />
            {/* Prediction labels */}
            {priceAfter10Buys && (
              <text
                x={width - 10}
                y={volumeHeight + height - ((priceAfter10Buys - minPrice) / (maxPrice - minPrice || maxPrice * 0.1 + 0.01)) * (height - volumeHeight) - 6}
                fill="var(--color-muted)"
                fontSize="8"
                textAnchor="end"
                opacity="0.6"
              >
                +10→${priceAfter10Buys.toFixed(6)}
              </text>
            )}
          </>
        )}

        {/* Current price dot (animated) */}
        {points.length > 0 && !compact && (
          <circle
            cx={width}
            cy={
              volumeHeight + height -
              (((points[points.length - 1]?.[1] ?? 0) - minPrice) /
                (maxPrice - minPrice || maxPrice * 0.1 + 0.01)) *
                (height - volumeHeight)
            }
            r="5"
            fill={lineColor}
            className="animate-pulse"
            style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
          />
        )}

        {/* "You bought here" markers */}
        {userBuyMarkers.map((marker, i) => (
          <g key={`buy-${i}`}>
            <circle cx={marker.x} cy={marker.y} r="4" fill="var(--color-fg)" stroke={lineColor} strokeWidth="1.5" />
            <line
              x1={marker.x - 4}
              y1={marker.y - 4}
              x2={marker.x + 4}
              y2={marker.y + 4}
              stroke="var(--color-fg)"
              strokeWidth="1"
            />
            <line
              x1={marker.x + 4}
              y1={marker.y - 4}
              x2={marker.x - 4}
              y2={marker.y + 4}
              stroke="var(--color-fg)"
              strokeWidth="1"
            />
          </g>
        ))}

        {/* Volume axis separator */}
        {!compact && volumeData?.length && (
          <line x1="0" y1={volumeHeight} x2={width} y2={volumeHeight} stroke="var(--color-border)" strokeWidth="0.5" opacity="0.3" />
        )}
      </svg>

      {/* Axis labels */}
      {!compact && (
        <div className="mt-1 flex justify-between text-[8px] sm:text-[10px] text-[var(--color-muted)] tabular-nums">
          <span>${minPrice.toFixed(6)}</span>
          <span>${maxPrice.toFixed(4)}</span>
        </div>
      )}

      {/* Timeframe selector */}
      {!compact && onTimeframeChange && (
        <div className="mt-2 flex justify-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onTimeframeChange(tf)}
              className={`rounded-md px-2 py-0.5 text-[9px] sm:text-[10px] font-medium transition-colors touch-target ${
                timeframe === tf
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
              aria-label={`View ${tf} timeframe`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
          {isMobile && (
            <span className="text-[7px] text-[var(--color-muted)] pl-1 self-center">← swipe →</span>
          )}
        </div>
      )}
    </div>
  );
}
