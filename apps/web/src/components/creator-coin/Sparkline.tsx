'use client';

/**
 * Mini SVG sparkline chart for coin cards.
 * Shows 24h price trend with optional gradient fill.
 */

export function Sparkline({
  data,
  width = 80,
  height = 28,
  color = '#00ff41',
  fillColor,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
}) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`)
    .join(' ');

  if (data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="shrink-0"
        aria-hidden="true"
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--color-glass-border)"
          strokeWidth="1"
        />
      </svg>
    );
  }

  // Build fill polygon: path down to baseline
  const firstPt =
    data.length > 0 ? `0,${height - ((data[0]! - min) / range) * height}` : `0,${height}`;
  const lastPt =
    data.length > 0
      ? `${width},${height - ((data[data.length - 1]! - min) / range) * height}`
      : `${width},${height}`;
  const fillPath = `${points} ${lastPt} ${width},${height} 0,${height} ${firstPt.split(',')[0]},${height}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Gradient fill */}
      {fillColor && <polygon points={fillPath} fill={fillColor} opacity="0.15" />}
      {/* Line */}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* End dot */}
      <circle
        cx={width}
        cy={height - ((data[data.length - 1]! - min) / range) * height}
        r="2"
        fill={color}
      />
    </svg>
  );
}
