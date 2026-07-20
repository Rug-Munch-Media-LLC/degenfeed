'use client';

/**
 * LiveShortsReactions — Emoji reactions that float upward on the viewer.
 *
 * Users can tap to send a reaction emoji. Reactions appear at the bottom
 * and float upward with a fade. Max visible at a time to avoid clutter.
 *
 * Features:
 *   - Quick-reaction row (🔥, 💎, 🚀, 💀, ❤️, 👀)
 *   - Floating animated emojis
 *   - Auto-cleanup after animation completes
 *   - Real-time via SWR polling
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface LiveShortsReactionsProps {
  sessionId: string;
}

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number; // random horizontal offset %
  createdAt: number;
}

const QUICK_REACTIONS = ['🔥', '💎', '🚀', '💀', '❤️', '👀', '🎉', '🫡', '😤', '💯'];

const FLOAT_DURATION = 3000;
const MAX_FLOATING = 15;

// === Mock reaction generator ==========================================

const MOCK_EMOJIS = ['🔥', '💎', '🚀', '💀', '❤️', '👀', '🎉', '💯', '🦍', '🌙'];

export function LiveShortsReactions({ sessionId: _sessionId }: LiveShortsReactionsProps) {
  const [floating, setFloating] = useState<FloatingEmoji[]>([]);
  const counterRef = useRef(0);

  // In production, this would poll reactions from the API.
  // For now, simulate incoming reactions every 2-4s.
  useEffect(() => {
    const interval = setInterval(
      () => {
        const emojiIdx = Math.floor(Math.random() * MOCK_EMOJIS.length);
        const emoji = MOCK_EMOJIS[emojiIdx] ?? '🔥';
        const id = `reaction-${++counterRef.current}`;
        const newEmoji: FloatingEmoji = {
          id,
          emoji,
          x: Math.random() * 70 + 15, // 15-85% horizontal
          createdAt: Date.now(),
        };

        setFloating((prev) => [...prev.slice(-(MAX_FLOATING - 1)), newEmoji]);

        // Remove after animation
        setTimeout(() => {
          setFloating((prev) => prev.filter((e) => e.id !== id));
        }, FLOAT_DURATION);
      },
      2500 + Math.random() * 2000,
    );

    return () => clearInterval(interval);
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    const id = `reaction-${++counterRef.current}`;
    const newEmoji: FloatingEmoji = {
      id,
      emoji,
      x: Math.random() * 60 + 20,
      createdAt: Date.now(),
    };
    setFloating((prev) => [...prev.slice(-(MAX_FLOATING - 1)), newEmoji]);

    // In production: POST /api/live-shorts/session/{id}/react
    setTimeout(() => {
      setFloating((prev) => prev.filter((e) => e.id !== id));
    }, FLOAT_DURATION);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {/* Floating emojis */}
      {floating.map((f) => (
        <span
          key={f.id}
          className="absolute bottom-0 animate-float-up text-xl"
          style={{
            left: `${f.x}%`,
            animation: `floatUp ${FLOAT_DURATION}ms ease-out forwards`,
          }}
          aria-hidden="true"
        >
          {f.emoji}
        </span>
      ))}

      {/* Quick reaction buttons (bottom center) */}
      <div className="pointer-events-auto absolute bottom-20 left-1/2 z-20 -translate-x-1/2">
        <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-black/60 px-2 py-1.5 backdrop-blur-lg">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => sendReaction(emoji)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-base transition-transform hover:scale-125 hover:bg-white/10 active:scale-150"
              aria-label={`Send ${emoji} reaction`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translateY(0) scale(0.8);
          }
          50% {
            opacity: 1;
            transform: translateY(-80px) scale(1.1);
          }
          100% {
            opacity: 0;
            transform: translateY(-160px) scale(0.6);
          }
        }
      `}</style>
    </div>
  );
}
