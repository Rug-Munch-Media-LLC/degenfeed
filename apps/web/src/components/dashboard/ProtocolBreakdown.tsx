'use client';

/**
 * ProtocolBreakdown — SVG pie chart showing revenue distribution by protocol
 *
 * Lightweight pie chart using only SVG arcs. Shows percentage and USD value
 * on hover. Falls back to a simple list when no data is available.
 */

import { type PointerEvent, useMemo, useState } from 'react';

interface ProtocolBreakdownProps {
  /** Revenue distribution by protocol (protocol name → USD amount) */
  data: Record<string, number>;
  /** Total USD value (computed if not provided) */
  total?: number;
  /** Loading state */
  loading?: boolean;
}

const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
  threads: '#888888',
  reddit: '#ff4500',
  unknown: '#666666',
};

const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  threads: 'Threads',
  reddit: 'Reddit',
  unknown: 'Other',
};

/** Polar to Cartesian */
function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** SVG arc path */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return [
    'M',
    cx,
    cy,
    'L',
    start.x,
    start.y,
    'A',
    r,
    r,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    'Z',
  ].join(' ');
}

export function ProtocolBreakdown({
  data,
  total: totalProp,
  loading = false,
}: ProtocolBreakdownProps) {
  const [hoveredProtocol, setHoveredProtocol] = useState<string | null>(null);

  const { segments, total } = useMemo(() => {
    const entries = Object.entries(data).filter(([, v]) => v > 0);
    const sum = totalProp ?? entries.reduce((s, [, v]) => s + v, 0);
    let currentAngle = 0;

    const segs = entries
      .sort(([, a], [, b]) => b - a)
      .map(([protocol, value]) => {
        const angle = sum > 0 ? (value / sum) * 360 : 0;
        const startAngle = currentAngle;
        currentAngle += angle;
        return {
          protocol,
          value,
          percentage: sum > 0 ? (value / sum) * 100 : 0,
          startAngle,
          endAngle: currentAngle,
        };
      });

    return { segments: segs, total: sum };
  }, [data, totalProp]);

  const cx = 80;
  const cy = 80;
  const r = 68;
  const innerR = 40; // donut hole

  function formatUsd(n: number): string {
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 animate-pulse">
        <div className="h-4 w-28 rounded bg-[var(--color-muted)]/20 mb-4" />
        <div className="flex items-center gap-4">
          <div className="h-32 w-32 rounded-full bg-[var(--color-muted)]/10 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-full rounded bg-[var(--color-muted)]/10" />
            <div className="h-3 w-3/4 rounded bg-[var(--color-muted)]/10" />
            <div className="h-3 w-1/2 rounded bg-[var(--color-muted)]/10" />
          </div>
        </div>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">Revenue by Protocol</h3>
        <p className="text-xs text-[var(--color-muted)]">No revenue data available yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">Revenue by Protocol</h3>
        <span className="text-[10px] text-[var(--color-muted)]">Total: {formatUsd(total)}</span>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* Donut chart */}
        <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
          <svg
            viewBox="0 0 160 160"
            className="w-full h-full select-none"
            role="img"
            aria-label="Revenue distribution by protocol"
          >
            {/* Segments */}
            {segments.map((seg) => {
              const color = PROTOCOL_COLORS[seg.protocol] ?? '#666';
              const isHovered = hoveredProtocol === seg.protocol;

              // For hover effect, slightly pull out the segment
              const midAngle = (seg.startAngle + seg.endAngle) / 2;
              const pullDist = isHovered ? 4 : 0;
              const midRad = ((midAngle - 90) * Math.PI) / 180;
              const offsetX = pullDist * Math.cos(midRad);
              const offsetY = pullDist * Math.sin(midRad);

              // Outer arc (full slice)
              const outerArc = describeArc(
                cx + offsetX,
                cy + offsetY,
                r,
                seg.startAngle,
                seg.endAngle,
              );

              // Inner arc (donut hole — subtract by drawing a smaller arc going the opposite way)
              const innerStart = polarToCartesian(cx + offsetX, cy + offsetY, innerR, seg.endAngle);
              const innerEnd = polarToCartesian(cx + offsetX, cy + offsetY, innerR, seg.startAngle);
              const largeArc = seg.endAngle - seg.startAngle > 180 ? 1 : 0;

              // Donut path: outer arc + line to inner + inner arc (reverse) + close
              const outerStart = polarToCartesian(cx + offsetX, cy + offsetY, r, seg.endAngle);
              const outerEnd = polarToCartesian(cx + offsetX, cy + offsetY, r, seg.startAngle);

              const donutPath = [
                'M',
                outerStart.x,
                outerStart.y,
                'A',
                r,
                r,
                0,
                largeArc,
                0,
                outerEnd.x,
                outerEnd.y,
                'L',
                innerEnd.x,
                innerEnd.y,
                'A',
                innerR,
                innerR,
                0,
                largeArc,
                1,
                innerStart.x,
                innerStart.y,
                'Z',
              ].join(' ');

              return (
                <path
                  key={seg.protocol}
                  d={donutPath}
                  fill={color}
                  fillOpacity={isHovered ? 0.9 : 0.7}
                  stroke="var(--color-card)"
                  strokeWidth="1.5"
                  className="cursor-pointer transition-all"
                  onPointerEnter={() => setHoveredProtocol(seg.protocol)}
                  onPointerLeave={() => setHoveredProtocol(null)}
                />
              );
            })}

            {/* Center total */}
            <text
              x="80"
              y="76"
              textAnchor="middle"
              className="fill-[var(--color-fg)] text-xs font-bold"
            >
              {formatUsd(total)}
            </text>
            <text
              x="80"
              y="90"
              textAnchor="middle"
              className="fill-[var(--color-muted)] text-[9px]"
            >
              total
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1.5 w-full">
          {segments.map((seg) => {
            const color = PROTOCOL_COLORS[seg.protocol] ?? '#666';
            const label = PROTOCOL_LABELS[seg.protocol] ?? seg.protocol;
            const isHovered = hoveredProtocol === seg.protocol;

            return (
              <div
                key={seg.protocol}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer ${
                  isHovered ? 'bg-[var(--color-muted)]/10' : 'hover:bg-[var(--color-muted)]/5'
                }`}
                onPointerEnter={() => setHoveredProtocol(seg.protocol)}
                onPointerLeave={() => setHoveredProtocol(null)}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-[var(--color-fg)]">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[var(--color-fg)]">
                    {formatUsd(seg.value)}
                  </span>
                  <span className="text-[10px] text-[var(--color-muted)] w-8 text-right">
                    {seg.percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
