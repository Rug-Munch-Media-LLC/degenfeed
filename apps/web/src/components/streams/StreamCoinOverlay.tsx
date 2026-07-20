'use client';

import { useCallback } from 'react';
import { useAuth } from '../AuthProvider';
import { useToast } from '../Toast';
import type { LiveStream } from './useLiveStreams';

/* === Types ==================================================== */

interface StreamCoinOverlayProps {
  stream?: LiveStream;
  /** Coin address for standalone use */
  coinAddress?: string;
  /** Stream ID for coin context */
  streamId?: string;
  /** Token symbol for display */
  tokenSymbol?: string;
  /** Callback when buy button is clicked */
  onBuy?: () => void;
}

/* === Mini bonding curve sparkline SVG ========================= */

function BondingCurveChart({ progress }: { progress: number }) {
  // Generate a simple curve path based on progress
  const width = 200;
  const height = 48;
  const points: Array<{ x: number; y: number }> = [];

  // Simulate bonding curve: starts flat, curves up exponentially
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = t * width;
    // Bonding curve shape: y = height * (1 - t^1.5) modulated by progress
    const y = height * (1 - t ** 1.5 * (progress / 100));
    points.push({ x, y });
  }

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Gradient fill under curve
  const fillPathD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="curve-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <path d={fillPathD} fill="url(#curve-grad)" />
      <path
        d={pathD}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Current position dot */}
      <circle
        cx={points[points.length - 1]?.x ?? width}
        cy={points[points.length - 1]?.y ?? 0}
        r="4"
        fill="var(--color-accent)"
        stroke="var(--color-bg)"
        strokeWidth="2"
      />
    </svg>
  );
}

/* === Main Component =========================================== */

export function StreamCoinOverlay({ stream, coinAddress, streamId, tokenSymbol, onBuy }: StreamCoinOverlayProps) {
  const { showToast } = useToast();
  const { ready, signedInProtocols } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const handleBuy = useCallback(() => {
    if (!hasSignedIn) {
      showToast('info', 'Sign in to buy tokens');
      return;
    }
    // In a real app, this would open a swap modal or redirect
    showToast('success', `Opening buy flow for $${stream.tokenSymbol}...`);
  }, [hasSignedIn, stream.tokenSymbol, showToast]);

  if (stream.streamType !== 'launch' || !stream.tokenSymbol) return null;

  const progress = stream.bondingCurveProgress ?? 0;
  const remaining = 100 - progress;

  return (
    <div className="rounded-xl border border-pink-500/20 bg-gradient-to-br from-pink-600/10 via-fuchsia-600/5 to-rose-600/10 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500/20 to-fuchsia-500/20 text-sm">
            🪙
          </span>
          <div>
            <p className="text-sm font-bold text-[var(--color-fg)]">${stream.tokenSymbol} Launch</p>
            <p className="text-[10px] text-[var(--color-muted)]">
              Bonding curve — {remaining}% remaining
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-degen-400">{progress}%</p>
          <p className="text-[9px] text-[var(--color-muted)]">filled</p>
        </div>
      </div>

      {/* Bonding curve chart */}
      <div className="mb-3">
        <BondingCurveChart progress={progress} />
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-[var(--color-overlay)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-degen-500 via-emerald-400 to-pink-500 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stats */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[10px]">
        <div>
          <p className="font-semibold text-[var(--color-fg)]">{progress}%</p>
          <p className="text-[var(--color-muted)]">Filled</p>
        </div>
        <div>
          <p className="font-semibold text-[var(--color-fg)]">${(progress * 2.5).toFixed(1)}K</p>
          <p className="text-[var(--color-muted)]">Raised</p>
        </div>
        <div>
          <p className="font-semibold text-[var(--color-fg)]">{remaining}%</p>
          <p className="text-[var(--color-muted)]">Remaining</p>
        </div>
      </div>

      {/* Buy button */}
      <button
        type="button"
        onClick={handleBuy}
        className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-pink-500/20 transition-all hover:from-pink-400 hover:to-fuchsia-400 hover:shadow-pink-500/30 active:scale-[0.98]"
      >
        Buy ${stream.tokenSymbol}
      </button>
    </div>
  );
}
