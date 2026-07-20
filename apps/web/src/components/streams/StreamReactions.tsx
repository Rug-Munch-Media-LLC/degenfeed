'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ─── Types ──────────────────────────────────────────────────── */

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  createdAt: number;
}

interface StreamReactionsProps {
  streamId: string;
  onReact?: (emoji: string) => void;
}

/* ─── Quick-reaction emojis ──────────────────────────────────── */

const QUICK_EMOJIS = ['🔥', '🚀', '💎', '🙌', '😂', '😱', '💯', '🎯'];

/* ─── Floating reaction bubble ───────────────────────────────── */

function FloatingEmojiBubble({ item, onDone }: { item: FloatingEmoji; onDone: () => void }) {
  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    // Animate with Web Animation API for better control
    const anim = el.animate(
      [
        { opacity: 1, transform: 'translateY(0) scale(0.5)' },
        { opacity: 1, transform: 'translateY(-30px) scale(1.2)', offset: 0.15 },
        { opacity: 0.8, transform: 'translateY(-80px) scale(1)', offset: 0.5 },
        { opacity: 0, transform: 'translateY(-160px) scale(0.4)' },
      ],
      {
        duration: 2000 + Math.random() * 1000,
        easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      },
    );

    anim.onfinish = onDone;

    return () => {
      if (anim.playState !== 'finished') anim.cancel();
    };
  }, [onDone]);

  const size = 1 + Math.random() * 0.6;

  return (
    <span
      ref={elRef}
      className="pointer-events-none absolute bottom-0 z-10"
      style={{
        left: `${item.x}%`,
        fontSize: `${size}rem`,
      }}
      aria-hidden="true"
    >
      {item.emoji}
    </span>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */

export function StreamReactions({ streamId: _streamId, onReact }: StreamReactionsProps) {
  const [floating, setFloating] = useState<FloatingEmoji[]>([]);
  const [burstKey, setBurstKey] = useState(0);

  const addReaction = useCallback(
    (emoji: string) => {
      const item: FloatingEmoji = {
        id: `fl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        emoji,
        x: Math.random() * 60 + 15,
        createdAt: Date.now(),
      };
      setFloating((prev) => [...prev.slice(-15), item]);
      onReact?.(emoji);
    },
    [onReact],
  );

  const removeReaction = useCallback((id: string) => {
    setFloating((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleBurst = useCallback(() => {
    const burstEmojis = ['🔥', '🚀', '💎', '🎉'];
    burstEmojis.forEach((emoji, i) => {
      setTimeout(() => {
        const item: FloatingEmoji = {
          id: `burst-${Date.now()}-${i}`,
          emoji,
          x: 20 + i * 18,
          createdAt: Date.now(),
        };
        setFloating((prev) => [...prev.slice(-15), item]);
      }, i * 100);
    });
    setBurstKey((k) => k + 1);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {/* Quick reaction buttons */}
      <div className="flex flex-wrap items-center gap-1">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => addReaction(emoji)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition-all hover:scale-125 hover:bg-[var(--color-overlay)] active:scale-90"
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          onClick={handleBurst}
          className="ml-auto flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
          aria-label="Send emoji burst"
        >
          <span aria-hidden="true">💥</span>
          Burst
        </button>
      </div>

      {/* Floating reactions container */}
      <div className="relative h-0 overflow-visible" key={burstKey}>
        {floating.map((item) => (
          <FloatingEmojiBubble key={item.id} item={item} onDone={() => removeReaction(item.id)} />
        ))}
      </div>
    </div>
  );
}
