'use client';

import { BONDING_PHASES_DISPLAY } from './constants';

export default function BondingCurvePreview({ className }: { className?: string }) {
  const w = 320,
    h = 120,
    pad = { t: 10, b: 20, l: 30, r: 10 };
  const plotW = w - pad.l - pad.r,
    plotH = h - pad.t - pad.b;

  const points = Array.from({ length: 100 }, (_, i) => {
    const t = i / 99,
      supply = t * 80;
    let price: number;
    if (supply < 20) price = (supply / 20) ** 2.2 * 0.3;
    else if (supply < 40) price = 0.3 + ((supply - 20) / 20) ** 1.6 * 0.25;
    else if (supply < 60) price = 0.55 + ((supply - 40) / 20) * 0.15;
    else if (supply < 80) price = 0.7 + ((supply - 60) / 20) ** 1.5 * 0.15;
    else price = 0.85 + ((supply - 80) / 20) ** 2.0 * 0.15;
    const x = pad.l + (supply / 80) * plotW;
    const y = h - pad.b - price * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-label="Bonding curve preview">
      <line
        x1={pad.l}
        y1={h - pad.b}
        x2={w - pad.r}
        y2={h - pad.b}
        stroke="var(--color-glass-border)"
        strokeWidth="0.5"
      />
      <line
        x1={pad.l}
        y1={pad.t}
        x2={pad.l}
        y2={h - pad.b}
        stroke="var(--color-glass-border)"
        strokeWidth="0.5"
      />
      {BONDING_PHASES_DISPLAY.map((phase, i) => {
        const x1 = pad.l + ((i * 20) / 80) * plotW,
          x2 = pad.l + (((i + 1) * 20) / 80) * plotW;
        return (
          <rect
            key={phase.name}
            x={x1}
            y={pad.t}
            width={x2 - x1}
            height={plotH}
            fill={phase.color}
            opacity={i === 2 ? 0.12 : 0.06}
          />
        );
      })}
      <polyline
        fill="none"
        stroke="#00ff41"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {BONDING_PHASES_DISPLAY.map((phase, i) => (
        <text
          key={phase.name}
          x={pad.l + ((i * 20 + 10) / 80) * plotW}
          y={h - 4}
          textAnchor="middle"
          fill={phase.color}
          fontSize="6"
          fontFamily="monospace"
          className="opacity-60"
        >
          {phase.range}
        </text>
      ))}
      <text x={pad.l} y={h - 4} textAnchor="start" fill="#888" fontSize="6" fontFamily="monospace">
        0%
      </text>
      <text
        x={w - pad.r}
        y={h - 4}
        textAnchor="end"
        fill="#888"
        fontSize="6"
        fontFamily="monospace"
      >
        100%
      </text>
      <text x={pad.l + 2} y={pad.t + 8} fill="#888" fontSize="6" fontFamily="monospace">
        Price ↗
      </text>
    </svg>
  );
}
