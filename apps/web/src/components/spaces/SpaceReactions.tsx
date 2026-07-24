'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// === Types ========================================================

interface Reaction {
  userId: string;
  emoji: string;
  createdAt: number;
}

interface SpaceReactionsProps {
  spaceId: string;
  reactions: Reaction[];
  currentUserId: string;
  onSendReaction?: (emoji: string) => void;
}

// === Floating emoji animation =====================================

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  createdAt: number;
}

function FloatingEmojiBubble({ item, onDone }: { item: FloatingEmoji; onDone: () => void }) {
  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

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

// === Quick emojis =================================================

const QUICK_EMOJIS = ['🔥', '❤️', '🚀', '💎', '🙌', '😂', '🎙️', '🤯', '👏', '💯'];

// === Main Component ===============================================

export function SpaceReactions({
  spaceId: _spaceId,
  reactions,
  currentUserId: _currentUserId,
  onSendReaction,
}: SpaceReactionsProps) {
  const [floating, setFloating] = useState<FloatingEmoji[]>([]);
  const [reactionInput, setReactionInput] = useState('');
  const reactionsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new reactions come in
  useEffect(() => {
    reactionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const addReaction = useCallback(
    (emoji: string) => {
      if (!emoji.trim()) return;

      // Add floating bubble
      const item: FloatingEmoji = {
        id: `fl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        emoji,
        x: 20 + Math.random() * 60,
        createdAt: Date.now(),
      };
      setFloating((prev) => [...prev.slice(-10), item]);

      // Send reaction
      onSendReaction?.(emoji);
      setReactionInput('');
    },
    [onSendReaction],
  );

  const removeFloating = useCallback((id: string) => {
    setFloating((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // Send reaction on Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') addReaction(reactionInput);
    },
    [addReaction, reactionInput],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Quick emoji grid */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => addReaction(emoji)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] text-sm transition-all hover:border-degen-500/30 hover:bg-degen-500/5 active:scale-90"
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Custom emoji input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={reactionInput}
          onChange={(e) => setReactionInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Custom emoji..."
          maxLength={10}
          className="flex-1 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder-gray-600 outline-none focus:border-degen-500/50"
        />
        <button
          type="button"
          onClick={() => addReaction(reactionInput)}
          disabled={!reactionInput.trim()}
          className="rounded-lg bg-degen-500/15 px-3 py-2 text-xs font-semibold text-degen-400 transition-all hover:bg-degen-500/25 disabled:opacity-30"
        >
          Send
        </button>
      </div>

      {/* Reaction feed */}
      <div className="relative max-h-40 space-y-1 overflow-y-auto">
        {reactions.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-[var(--color-muted)]">No reactions yet</p>
        ) : (
          reactions.slice(-20).map((r, i) => (
            <div
              key={`${r.createdAt}-${i}`}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-muted)]/10 px-3 py-1.5"
            >
              <span className="text-lg">{r.emoji}</span>
              <span className="text-[10px] text-[var(--color-muted)]">
                {Math.floor((Date.now() - r.createdAt) / 1000)}s ago
              </span>
            </div>
          ))
        )}
        <div ref={reactionsEndRef} />
      </div>

      {/* Floating reactions overlay */}
      <div className="relative h-0 overflow-visible">
        {floating.map((item) => (
          <FloatingEmojiBubble key={item.id} item={item} onDone={() => removeFloating(item.id)} />
        ))}
      </div>
    </div>
  );
}

// Re-export quick emojis for other components
export { QUICK_EMOJIS };
