'use client';

/**
 * @degenfeed/web — Earnings Counter
 *
 * Real-time earnings display for creators during a live stream.
 * Shows total sats/USD earned from gifts with animated counting.
 * Integrates with tip:received and gift WebSocket events.
 *
 * Telegram-like: displays "You've earned 50,000 sats this stream"
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

// ─── Types ───────────────────────────────────────────────────────────────

interface EarningsResponse {
  streamId?: string;
  creatorId?: string;
  totalSats: number;
  totalUsd: number;
  totalGifts: number;
  streams: string[];
  feeRate: string;
  platformFeeBps: number;
}

interface EarningsCounterProps {
  /** Stream ID to track earnings for */
  streamId?: string;
  /** Creator ID to aggregate earnings across streams */
  creatorId?: string;
  /** Whether this is the creator view (shows stats) vs viewer view */
  isCreator: boolean;
  /** Display mode */
  variant?: 'counter' | 'summary' | 'compact';
  /** Refresh interval in ms (default: 5s when live) */
  refreshMs?: number;
  /** Callback when earnings update */
  onEarningsUpdate?: (totalSats: number, totalUsd: number) => void;
}

// ─── Animated Number ──────────────────────────────────────────────────────

function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  duration = 800,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;
    if (prev === value) return;

    const startTime = performance.now();
    const diff = value - prev;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(prev + diff * eased));

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [value, duration]);

  useEffect(() => {
    setDisplayValue(value);
    prevValueRef.current = value;
  }, [value]);

  return (
    <span className="tabular-nums">
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
}

// ─── Fetcher ──────────────────────────────────────────────────────────────

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
};

// ─── Component ────────────────────────────────────────────────────────────

export function EarningsCounter({
  streamId,
  creatorId,
  isCreator,
  variant = 'counter',
  refreshMs = 5000,
  onEarningsUpdate,
}: EarningsCounterProps) {
  const [totalSats, setTotalSats] = useState(0);
  const [totalUsd, setTotalUsd] = useState(0);
  const [totalGifts, setTotalGifts] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const queryParams = streamId
    ? `streamId=${encodeURIComponent(streamId)}`
    : creatorId
      ? `creatorId=${encodeURIComponent(creatorId)}`
      : '';

  const { data, error } = useSWR<EarningsResponse>(
    queryParams ? `/api/live/gifts/earnings?${queryParams}` : null,
    fetcher,
    { refreshInterval: refreshMs, revalidateOnFocus: true },
  );

  // Update local state when API data changes
  useEffect(() => {
    if (data) {
      setTotalSats(data.totalSats);
      setTotalUsd(data.totalUsd);
      setTotalGifts(data.totalGifts);
      onEarningsUpdate?.(data.totalSats, data.totalUsd);
    }
  }, [data, onEarningsUpdate]);

  // Listen for WebSocket gift events for instant updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/realtime`;

    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Handle tip:received events with gift data
          if (msg.type === 'gift' || (msg.event === 'tip:received' && msg.data?.gift)) {
            // Increment by the gift amount
            const giftSats = msg.data?.gift?.sats ?? msg.sats ?? 0;
            const giftUsd = msg.data?.gift?.usd ?? msg.usd ?? 0;
            const creatorPct = 0.85;

            if (giftSats > 0) {
              setTotalSats((prev) => prev + giftSats);
              setTotalUsd((prev) => Math.round((prev + giftUsd * creatorPct) * 100) / 100);
              setTotalGifts((prev) => prev + 1);
            }
          }

          // Handle gift_leaderboard_update
          if (msg.type === 'gift_leaderboard_update') {
            if (msg.totalSats !== undefined) {
              setTotalSats(msg.totalSats);
            }
            if (msg.totalGifts !== undefined) {
              setTotalGifts(msg.totalGifts);
            }
          }
        } catch {
          // Non-JSON message, ignore
        }
      };
    } catch {
      // WebSocket connection failed — rely on polling
    }

    return () => {
      if (ws) ws.close();
    };
  }, [streamId, creatorId]);

  // ─── Compact Mode ────────────────────────────────────────────

  if (variant === 'compact') {
    if (totalSats === 0 && !isCreator) return null;

    return (
      <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 px-3 py-1.5">
        <span className="text-xs">⚡</span>
        <div className="flex items-baseline gap-1.5">
          <AnimatedNumber value={totalSats} suffix="" />
          <span className="text-[9px] text-white/50">sats</span>
        </div>
        <div className="h-3 w-px bg-white/10" />
        <span className="text-[10px] font-medium text-degen-400">
          ${totalUsd.toFixed(2)}
        </span>
      </div>
    );
  }

  // ─── Summary Mode (post-stream) ────────────────────────────

  if (variant === 'summary') {
    return (
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-yellow-500/5 via-orange-500/5 to-pink-500/5 p-4">
        <h3 className="flex items-center gap-2 text-xs font-bold text-white/70">
          🎁 Stream Earnings
        </h3>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-white/5 p-3 text-center">
            <div className="text-lg font-bold text-yellow-400">
              <AnimatedNumber value={totalSats} />
            </div>
            <div className="mt-0.5 text-[9px] text-white/40">Sats Earned</div>
          </div>

          <div className="rounded-lg bg-white/5 p-3 text-center">
            <div className="text-lg font-bold text-degen-400">
              <AnimatedNumber value={totalUsd} prefix="$" />
            </div>
            <div className="mt-0.5 text-[9px] text-white/40">USD Value</div>
          </div>

          <div className="rounded-lg bg-white/5 p-3 text-center">
            <div className="text-lg font-bold text-white/80">
              <AnimatedNumber value={totalGifts} />
            </div>
            <div className="mt-0.5 text-[9px] text-white/40">Gifts</div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-[9px] text-white/40">
          <span>Platform fee: 15%</span>
          <span>You earned {(totalUsd * 0.85).toFixed(2)} USD</span>
        </div>

        {totalSats > 0 && (
          <div className="mt-2 text-center">
            <button
              type="button"
              className="rounded-lg bg-degen-500/20 px-4 py-2 text-xs font-semibold text-degen-400 transition-colors hover:bg-degen-500/30"
              onClick={() => {
                // Trigger payout
                fetch('/api/live/gifts/process-payout', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ streamId, creatorId }),
                }).catch(() => {});
              }}
            >
              💰 Process Payout
            </button>
          </div>
        )}

        {/* Error state */}
        {error && (
          <p className="mt-2 text-[9px] text-red-400">
            Could not fetch earnings. Data may be delayed.
          </p>
        )}
      </div>
    );
  }

  // ─── Counter Mode (live stream) ───────────────────────────────

  if (!isCreator && totalSats === 0) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-white/40">
        <span>🎁</span>
        <span>Be the first to send a gift!</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border transition-all ${
        isCreator
          ? 'border-degen-500/30 bg-gradient-to-r from-degen-500/10 via-yellow-500/5 to-degen-500/10'
          : 'border-white/10 bg-white/5'
      } p-3`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-lg ${isCreator ? 'animate-pulse' : ''}`}>
            {isCreator ? '⚡' : '🎁'}
          </span>
          <div>
            {isCreator ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-yellow-400">
                    <AnimatedNumber value={totalSats} suffix="" />
                  </span>
                  <span className="text-[10px] text-white/50">sats earned</span>
                </div>
                <div className="text-[9px] text-degen-400">
                  ${totalUsd.toFixed(2)} USD · {totalGifts} gifts
                </div>
              </>
            ) : (
              <>
                <div className="text-[10px] font-medium text-white/60">
                  <AnimatedNumber value={totalSats} />
                  <span className="ml-1">sats in gifts</span>
                </div>
                <div className="text-[8px] text-white/40">
                  ${totalUsd.toFixed(2)} · {totalGifts} gifts from {data?.streams.length ?? 0} streams
                </div>
              </>
            )}
          </div>
        </div>

        {/* Creator: earnings rate info */}
        {isCreator && (
          <div className="text-right">
            <div className="text-[18px] font-bold text-degen-400">
              <AnimatedNumber value={totalUsd} prefix="$" />
            </div>
            <div className="text-[8px] text-white/40">You earn 85%</div>
          </div>
        )}
      </div>

      {/* Sats progress bar (for creator) */}
      {isCreator && totalSats > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[8px] text-white/30 mb-1">
            <span>Stream earnings</span>
            <span>{totalGifts} gifts · 15% platform fee</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-500 via-orange-500 to-pink-500 transition-all duration-500"
              style={{ width: `${Math.min((totalSats / 100000) * 100, 100)}%` }}
            />
          </div>
          <div className="mt-0.5 text-[8px] text-white/30">
            Next milestone: 100,000 sats (${(100000 * 0.0003).toFixed(2)})
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <p className="mt-1 text-[8px] text-red-400">
          Earnings data may be delayed.
        </p>
      )}
    </div>
  );
}
