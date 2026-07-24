'use client';

/**
 * LikeButton — Heart button with particle burst animation.
 * On click, spawns N particles that burst outward in random directions.
 */

import { useCallback, useRef, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  angle: number;
  distance: number;
  size: number;
}

interface LikeButtonProps {
  initialCount?: number;
  initiallyLiked?: boolean;
  onToggle?: (liked: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const COLORS = ['#f91880', '#ff6b9d', '#ff99bb', '#ffccdd', '#f91880'];

export function LikeButton({
  initialCount = 0,
  initiallyLiked = false,
  onToggle,
  size = 'md',
  disabled,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initiallyLiked);
  const [count, setCount] = useState(initialCount);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [animating, setAnimating] = useState(false);
  const idRef = useRef(0);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(() => {
    if (disabled || animating) return;

    const newLiked = !liked;
    setLiked(newLiked);
    setCount((c) => c + (newLiked ? 1 : -1));
    setAnimating(true);
    onToggle?.(newLiked);

    if (newLiked) {
      // Spawn particles
      const btn = btnRef.current;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const newParticles: Particle[] = [];

        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.5;
          newParticles.push({
            id: idRef.current++,
            x: cx,
            y: cy,
            color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
            angle,
            distance: 30 + Math.random() * 40,
            size: 3 + Math.random() * 3,
          });
        }
        setParticles(newParticles);
      }

      setTimeout(() => {
        setParticles([]);
        setAnimating(false);
      }, 600);
    } else {
      setTimeout(() => setAnimating(false), 300);
    }
  }, [liked, animating, disabled, onToggle]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`post-action relative ${sizeClasses[size]}`}
      aria-label={liked ? 'Unlike' : 'Like'}
      aria-pressed={liked}
    >
      <svg
        width={size === 'sm' ? 16 : size === 'md' ? 18 : 22}
        height={size === 'sm' ? 16 : size === 'md' ? 18 : 22}
        viewBox="0 0 24 24"
        fill={liked ? 'var(--color-like-active)' : 'none'}
        stroke={liked ? 'var(--color-like-active)' : 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animating && liked ? 'animate-heart-pop' : ''}
        style={{
          transition: 'fill 0.2s ease-out, stroke 0.2s ease-out',
        }}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>

      {count > 0 && (
        <span
          className="text-xs font-semibold tabular-nums"
          style={{
            color: liked ? 'var(--color-like-active)' : 'var(--color-muted)',
            transition: 'color 0.2s ease-out',
          }}
        >
          {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
        </span>
      )}

      {/* Particle burst */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="like-particle"
          style={
            {
              '--particle-end': `${Math.cos(p.angle) * p.distance}px ${Math.sin(p.angle) * p.distance}px`,
              background: p.color,
              width: p.size,
              height: p.size,
              left: p.x,
              top: p.y,
              animation: 'particle-burst 0.6s ease-out forwards',
            } as React.CSSProperties
          }
        />
      ))}
    </button>
  );
}
