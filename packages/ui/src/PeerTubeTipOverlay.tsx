'use client';

/**
 * @degenfeed/ui — PeerTubeTipOverlay
 *
 * Overlay component shown during PeerTube video playback. Displays a
 * "⚡ Tip Creator" button in the video controls area with quick-tip
 * amounts ($1, $5, $10). Shows a pulse animation when tips arrive and
 * displays real-time tip count.
 *
 * Uses the same multi-currency tipping methods as the main app via
 * the POST /api/peertube/tip endpoint.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

export interface PeerTubeTipOverlayProps {
  /** UUID of the PeerTube video */
  videoId: string;
  /** Display name of the video creator */
  creatorName: string;
  /** Channel identifier (used for KV notification dedup) */
  creatorChannel: string;
  /** Video title */
  videoTitle: string;
  /** PeerTube instance domain (e.g. video.degenfeed.xyz) */
  instanceDomain: string;
  /** If true, renders in "live stream" mode with real-time emphasis */
  isLive?: boolean;
  /** Optional: pre-fetched tip count for server-rendered state */
  initialTipCount?: number;
  /** Optional: pre-fetched total amount */
  initialTipTotal?: number;
  /** Optional: class name for positioning */
  className?: string;
}

// ─── Falling-emoji animation component ───────────────────────────────────

interface TipAnimationProps {
  amount: number;
  sender: string;
  onComplete: () => void;
}

function TipAnimation({ amount, sender, onComplete }: TipAnimationProps) {
  const emojis = ['⚡', '🔥', '💎', '🚀', '🌟', '💫', '✨', '🎯'];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)] ?? '⚡';

  useEffect(() => {
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const left = 20 + Math.random() * 60; // random horizontal position

  return (
    <div
      className="pointer-events-none absolute z-50 animate-fall-up"
      style={{
        left: `${left}%`,
        bottom: '40%',
        animation: 'tipFloat 2s ease-out forwards',
      }}
    >
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-3xl drop-shadow-lg"
          style={{ filter: 'drop-shadow(0 0 8px rgba(0,255,65,0.6))' }}
        >
          {emoji}
        </span>
        <span className="rounded-full bg-degen-500/20 px-2 py-0.5 text-xs font-bold text-degen-400 backdrop-blur-sm">
          ${amount}
        </span>
        {sender !== 'Anonymous' && (
          <span className="text-[10px] text-white/70 truncate max-w-[120px]">{sender}</span>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return n.toFixed(2);
}

// ─── Component ───────────────────────────────────────────────────────────

export function PeerTubeTipOverlay({
  videoId,
  creatorName,
  creatorChannel,
  videoTitle,
  instanceDomain,
  isLive = false,
  initialTipCount = 0,
  initialTipTotal = 0,
  className = '',
}: PeerTubeTipOverlayProps) {
  // ── State ──
  const [showTipMenu, setShowTipMenu] = useState(false);
  const [tipping, setTipping] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);
  const [animations, setAnimations] = useState<
    Array<{ id: string; amount: number; sender: string }>
  >([]);
  const [tipCount, setTipCount] = useState(initialTipCount);
  const [tipTotal, setTipTotal] = useState(initialTipTotal);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Quick tip amounts (USD) ──
  const quickAmounts = [1, 5, 10];

  // ── Poll for tip stats every 15s when visible ──
  useEffect(() => {
    if (!videoId) return;
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/peertube/tip/stats?videoId=${encodeURIComponent(videoId)}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          totalAmount: number;
          count: number;
          tips?: Array<{ amount: number; sender: string }>;
        };
        setTipCount(data.count);
        setTipTotal(data.totalAmount);

        // If new tips arrived since last poll, animate the latest
        if (data.tips && data.tips.length > 0) {
          const latest = data.tips[0];
          if (latest?.sender) {
            // Avoid re-animating the same tip
            setAnimations((prev) => {
              if (prev.length > 0 && prev[0]?.amount === latest.amount) return prev;
              return [
                ...prev,
                { id: `tip-anim-${Date.now()}`, amount: latest.amount, sender: latest.sender },
              ].slice(-3); // max 3 concurrent
            });
          }
        }
      } catch {
        // silent
      }
    };

    // Initial fetch
    void fetchStats();

    // For live streams, poll aggressively
    const interval = setInterval(fetchStats, isLive ? 5000 : 15000);

    return () => clearInterval(interval);
  }, [videoId, isLive]);

  // ── Close tip menu on outside click ──
  useEffect(() => {
    if (!showTipMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowTipMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTipMenu]);

  // ── Send tip ──
  const handleTip = useCallback(
    async (amount: number) => {
      setTipping(true);
      setShowTipMenu(false);
      try {
        const res = await fetch('/api/peertube/tip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId,
            creatorName,
            creatorChannel,
            videoTitle,
            instanceDomain,
            amount,
            currency: 'usd',
            sender: '',
          }),
        });
        if (res.ok) {
          setTipSuccess(true);
          setTipCount((c) => c + 1);
          setTipTotal((t) => t + amount);
          setAnimations((prev) =>
            [...prev, { id: `tip-anim-${Date.now()}`, amount, sender: 'You' }].slice(-3),
          );
          setTimeout(() => setTipSuccess(false), 2000);
        }
      } catch {
        // fail silently
      } finally {
        setTipping(false);
      }
    },
    [videoId, creatorName, creatorChannel, videoTitle, instanceDomain],
  );

  // ── Animation cleanup ──
  const removeAnimation = useCallback((id: string) => {
    setAnimations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Livestream "Super Tip" highlight ──
  const showSuperTip = isLive && tipTotal > 50;

  // ── Render ──
  return (
    <div className={`relative ${className}`}>
      {/* ── Tip animations ── */}
      {animations.map((anim) => (
        <TipAnimation
          key={anim.id}
          amount={anim.amount}
          sender={anim.sender}
          onComplete={() => removeAnimation(anim.id)}
        />
      ))}

      {/* ── Tip button ── */}
      <div ref={menuRef} className="relative inline-flex items-center">
        <button
          type="button"
          onClick={() => setShowTipMenu((v) => !v)}
          disabled={tipping}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
            tipSuccess
              ? 'bg-green-500/20 text-green-400 scale-105'
              : isLive
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse'
                : 'bg-degen-500/20 text-degen-400 hover:bg-degen-500/30'
          } ${isLive ? 'ring-2 ring-red-500/30' : ''}`}
          aria-label={`Tip ${creatorName}`}
        >
          {tipping ? (
            <span className="animate-spin">⚡</span>
          ) : tipSuccess ? (
            <>
              <span>✓</span>
              <span>Tipped!</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>{isLive ? 'Super Tip' : 'Tip Creator'}</span>
            </>
          )}
          {tipCount > 0 && !tipSuccess && (
            <span className="ml-0.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums">
              {tipCount} (${formatCurrency(tipTotal)})
            </span>
          )}
        </button>

        {/* ── Quick-tip menu ── */}
        {showTipMenu && (
          <div className="absolute bottom-full left-0 mb-2 flex flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2 shadow-2xl z-50 min-w-[130px] backdrop-blur-sm">
            <div className="px-2 py-1 text-[10px] text-[var(--color-muted)] border-b border-[var(--color-border)] mb-1">
              ⚡ Tip {creatorName}
            </div>
            <div className="flex flex-col gap-1">
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => handleTip(amount)}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-degen-500/10 hover:text-degen-400 text-[var(--color-muted)]"
                >
                  <span>${amount}</span>
                  <span className="text-[10px] text-gray-600">USD</span>
                </button>
              ))}
            </div>
            <div className="mt-1 border-t border-[var(--color-border)] pt-1">
              <p className="px-2 text-[9px] text-gray-600">Powered by DegenFeed</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Livestream tip total banner ── */}
      {isLive && tipCount > 0 && (
        <div
          className={`mt-1 rounded-lg px-2 py-1 text-center text-[10px] transition-all ${
            showSuperTip
              ? 'bg-gradient-to-r from-yellow-500/20 to-red-500/20 text-yellow-400 border border-yellow-500/30'
              : 'bg-degen-500/10 text-degen-400'
          }`}
        >
          <span className="font-bold">{tipCount} tips</span>
          <span className="mx-1">·</span>
          <span className="tabular-nums">${formatCurrency(tipTotal)} total</span>
          {showSuperTip && <span className="ml-1">🔥</span>}
        </div>
      )}

      {/* ── Keyframes for tip float animation ── */}
      <style>{`
        @keyframes tipFloat {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          50% { opacity: 1; transform: translateY(-40px) scale(1.15); }
          100% { opacity: 0; transform: translateY(-80px) scale(0.8); }
        }
      `}</style>
    </div>
  );
}
