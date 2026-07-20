'use client';

/**
 * LiveShortsTips — Floating tip notifications that fly across the screen.
 *
 * Each tip appears as a brief, animated toast that slides in from the right,
 * stays for ~3s, then fades out. Tips stack vertically with a max of 3 visible.
 *
 * Features:
 *   - Animated entrance (slide + fade)
 *   - Sender avatar, amount, currency
 *   - Optional message
 *   - Auto-dismiss after 3s
 *   - Max 3 visible at a time
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveShortTip } from './useLiveShorts';

interface LiveShortsTipsProps {
  tips: LiveShortTip[];
}

interface VisibleTip extends LiveShortTip {
  visibleId: string;
}

const MAX_VISIBLE = 3;
const TIP_DURATION = 4000;

export function LiveShortsTips({ tips }: LiveShortsTipsProps) {
  const [visibleTips, setVisibleTips] = useState<VisibleTip[]>([]);
  const lastIndexRef = useRef(0);

  const addTip = useCallback((tip: LiveShortTip) => {
    const visibleId = `vtip-${tip.id}-${Date.now()}`;
    const newTip: VisibleTip = { ...tip, visibleId };

    setVisibleTips((prev) => {
      const updated = [...prev, newTip].slice(-MAX_VISIBLE);
      return updated;
    });

    // Auto-dismiss
    setTimeout(() => {
      setVisibleTips((prev) => prev.filter((t) => t.visibleId !== visibleId));
    }, TIP_DURATION);
  }, []);

  // Watch for new tips in the feed
  useEffect(() => {
    if (tips.length <= lastIndexRef.current) return;

    const newTips = tips.slice(lastIndexRef.current);
    lastIndexRef.current = tips.length;

    for (const tip of newTips) {
      addTip(tip);
    }
  }, [tips, addTip]);

  if (visibleTips.length === 0) return null;

  return (
      <div
        className="pointer-events-none absolute right-4 top-16 z-20 flex flex-col items-end gap-2"
        aria-live="polite"
        role="status"
        aria-label="Live tips"
      >
      {visibleTips.map((tip) => (
        <div
          key={tip.visibleId}
          className="animate-slide-in-right flex items-center gap-2 rounded-xl border border-degen-500/30 bg-black/80 px-3 py-2 backdrop-blur-lg shadow-2xl"
          style={{
            animation: 'tipSlideIn 0.4s ease-out',
          }}
          role="status"
        >
          {/* Sender avatar */}
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-[8px] font-bold text-degen-400"
            style={
              tip.senderAvatar
                ? {
                    backgroundImage: `url(${tip.senderAvatar})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            {tip.senderAvatar ? '' : tip.sender[0]?.toUpperCase() || '?'}
          </div>

          {/* Tip details */}
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="truncate text-xs font-semibold text-white">{tip.sender}</span>
              <span className="rounded bg-degen-500/20 px-1 py-0.5 text-[9px] font-bold text-degen-400">
                {tip.amount} {tip.currency}
              </span>
            </div>
            {tip.message && <p className="truncate text-[11px] text-white/60">{tip.message}</p>}
          </div>

          {/* Protocol badge */}
          <span className="rounded bg-white/10 px-1 py-0.5 text-[8px] font-bold uppercase text-white/50">
            {tip.protocol}
          </span>
        </div>
      ))}

      {/* Animation keyframes injected once */}
      <style>{`
        @keyframes tipSlideIn {
          from {
            opacity: 0;
            transform: translateX(60px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
