'use client';

/**
 * EarningsChart — SVG-based line chart of earnings over time
 *
 * Lightweight, no external chart library required. Renders a responsive
 * SVG with tooltips on hover. Falls back to a message when no data.
 */

import { type PointerEvent, useMemo, useRef, useState } from 'react';

interface EarningsChartProps {
  /** Daily earnings values in USD */
  data: number[];
  /** Labels for each data point (dates) */
  labels: string[];
  /** Currency label (default "USD") */
  currency?: string;
  /** Loading state */
  loading?: boolean;
}

export function EarningsChart({
  data,
  labels,
  currency = 'USD',
  loading = false,
}: EarningsChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);

  const chartDimensions = {
    width: 600,
    height: 200,
    padding: { top: 20, right: 16, bottom: 28, left: 48 },
  };

  const { path, points, yMax, yMin } = useMemo(() => {
    const { width, height, padding } = chartDimensions;
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const values = data.map((v) => (v === 0 && data.some((d) => d > 0) ? 0.001 : v));
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);

    const xScaleFn = (i: number) => padding.left + (i / Math.max(values.length - 1, 1)) * chartW;
    const yScaleFn = (v: number) => padding.top + chartH - ((v - min) / (max - min || 1)) * chartH;

    const pts = values.map((v, i) => ({
      x: xScaleFn(i),
      y: yScaleFn(v),
      value: v,
      label: labels[i] ?? '',
    }));
    const p = pts
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
      .join(' ');

    return {
      path: p,
      points: pts,
      yMax: max,
      yMin: min,
      xScale: xScaleFn,
      yScale: yScaleFn,
    };
  }, [data, labels]);

  // Y-axis tick labels
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const max = yMax;
    const min = yMin;
    const range = max - min || 1;
    const step = range / 4;
    for (let i = 0; i <= 4; i++) {
      ticks.push(min + step * i);
    }
    return ticks;
  }, [yMax, yMin]);

  function formatCurrency(n: number): string {
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    if (n >= 1) return `$${n.toFixed(0)}`;
    return `$${n.toFixed(2)}`;
  }

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Find closest data point
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i]!.x - x);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    setTooltipIndex(closest);
  }

  function handlePointerLeave() {
    setTooltipIndex(null);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <div className="h-4 w-28 rounded bg-[var(--color-muted)]/20 mb-4 animate-pulse" />
        <div className="h-[200px] rounded bg-[var(--color-muted)]/10 animate-pulse" />
      </div>
    );
  }

  if (!data.length || data.every((d) => d === 0)) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-4">Earnings Over Time</h3>
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-xs text-[var(--color-muted)]">
            No earnings data yet. Start earning tips to see your chart.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
      ref={containerRef}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">Earnings Over Time</h3>
        <span className="text-[10px] text-[var(--color-muted)]">
          Total: {formatCurrency(data.reduce((s, v) => s + v, 0))} {currency}
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`}
          className="w-full h-auto select-none"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          style={{ touchAction: 'none' }}
          role="img"
          aria-label="Earnings chart"
        >
          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={chartDimensions.padding.left}
                y1={
                  points.length > 0
                    ? (points.find((p) => Math.abs(p.value - tick) < 0.01)?.y ??
                      chartDimensions.padding.top +
                        (chartDimensions.height -
                          chartDimensions.padding.top -
                          chartDimensions.padding.bottom) *
                          (1 - i / 4))
                    : chartDimensions.padding.top +
                      (chartDimensions.height -
                        chartDimensions.padding.top -
                        chartDimensions.padding.bottom) *
                        (1 - i / 4)
                }
                x2={chartDimensions.width - chartDimensions.padding.right}
                y2={
                  points.length > 0
                    ? (points.find((p) => Math.abs(p.value - tick) < 0.01)?.y ??
                      chartDimensions.padding.top +
                        (chartDimensions.height -
                          chartDimensions.padding.top -
                          chartDimensions.padding.bottom) *
                          (1 - i / 4))
                    : chartDimensions.padding.top +
                      (chartDimensions.height -
                        chartDimensions.padding.top -
                        chartDimensions.padding.bottom) *
                        (1 - i / 4)
                }
                stroke="currentColor"
                strokeOpacity={0.08}
                strokeDasharray="4 4"
              />
              <text
                x={chartDimensions.padding.left - 8}
                y={
                  (points.length > 0
                    ? (points.find((p) => Math.abs(p.value - tick) < 0.01)?.y ??
                      chartDimensions.padding.top +
                        (chartDimensions.height -
                          chartDimensions.padding.top -
                          chartDimensions.padding.bottom) *
                          (1 - i / 4))
                    : chartDimensions.padding.top +
                      (chartDimensions.height -
                        chartDimensions.padding.top -
                        chartDimensions.padding.bottom) *
                        (1 - i / 4)) + 4
                }
                textAnchor="end"
                className="fill-[var(--color-muted)] text-[10px]"
              >
                {formatCurrency(tick)}
              </text>
            </g>
          ))}

          {/* Area fill */}
          <defs>
            <linearGradient id="earnings-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent, #16a34a)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--color-accent, #16a34a)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path
            d={`${path} L${points[points.length - 1]?.x ?? 0},${chartDimensions.height - chartDimensions.padding.bottom} L${points[0]?.x ?? 0},${chartDimensions.height - chartDimensions.padding.bottom} Z`}
            fill="url(#earnings-gradient)"
          />

          {/* Line */}
          <path
            d={path}
            fill="none"
            stroke="var(--color-accent, #16a34a)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {points.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={tooltipIndex === i ? 4 : 2}
              fill={tooltipIndex === i ? 'var(--color-accent, #16a34a)' : 'var(--color-card)'}
              stroke="var(--color-accent, #16a34a)"
              strokeWidth="2"
              className="transition-all"
            />
          ))}

          {/* X-axis labels (show first, middle, last) */}
          {[0, Math.floor(points.length / 2), points.length - 1]
            .filter((i) => points[i])
            .map((i) => (
              <text
                key={i}
                x={points[i]!.x}
                y={chartDimensions.height - 4}
                textAnchor="middle"
                className="fill-[var(--color-muted)] text-[9px]"
              >
                {points[i]!.label}
              </text>
            ))}
        </svg>

        {/* Tooltip */}
        {tooltipIndex !== null && points[tooltipIndex] && (
          <div
            className="absolute pointer-events-none z-10 -translate-x-1/2 -translate-y-full px-2 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg text-xs"
            style={{
              left: `${(points[tooltipIndex].x / chartDimensions.width) * 100}%`,
              top: `${(points[tooltipIndex].y / chartDimensions.height) * 100}%`,
            }}
          >
            <p className="font-medium text-[var(--color-fg)]">
              {formatCurrency(points[tooltipIndex].value)}
            </p>
            <p className="text-[10px] text-[var(--color-muted)]">{points[tooltipIndex].label}</p>
          </div>
        )}
      </div>
    </div>
  );
}
