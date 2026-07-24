'use client';

/**
 * @components/join/PlatformGreeting — Contextual greeting banner.
 *
 * Shows a platform-aware welcome message at the top of the join page.
 * Displays platform icon, greeting text, and a brief explanation.
 * Supports dismissal and reduced-motion preferences.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { PLATFORM_CONFIG, type SourcePlatform } from './types';

/* === Props ====================================================== */

interface PlatformGreetingProps {
  platform: SourcePlatform;
  /** If true, renders in a compact mode suitable for mobile. */
  compact?: boolean;
  /** Called when the user dismisses the greeting. */
  onDismiss?: () => void;
}

/* === Component ================================================== */

export function PlatformGreeting({ platform, compact = false, onDismiss }: PlatformGreetingProps) {
  const cfg = PLATFORM_CONFIG[platform];
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const isDegenFeed = platform === 'degenfeed';
  const isDirect = platform === 'direct';

  // Stagger entrance animation
  useEffect(() => {
    const timer = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  if (dismissed) return null;

  // Native dialog for accessibility
  const role = isDegenFeed ? 'status' : 'complementary';
  const ariaLabel = isDegenFeed
    ? 'Welcome back to DegenFeed'
    : `Welcome from ${cfg?.label ?? 'external platform'}`;

  return (
    <div
      ref={bannerRef}
      role={role}
      aria-label={ariaLabel}
      className={`
        relative overflow-hidden rounded-2xl border transition-all duration-500 ease-out
        ${visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}
        ${compact ? 'px-3 py-2.5' : 'px-5 py-4'}
        ${isDegenFeed ? 'border-degen-500/20 bg-gradient-to-r from-degen-500/[0.06] to-transparent' : ''}
        ${isDirect ? 'border-[var(--color-glass-border)] bg-[var(--color-card)]/80' : ''}
        ${!isDegenFeed && !isDirect ? 'bg-[var(--color-card)]/80' : ''}
      `}
      style={
        !isDegenFeed && !isDirect && cfg
          ? {
              borderColor: `${cfg.color}25`,
              background: `linear-gradient(135deg, ${cfg.color}08, transparent)`,
            }
          : undefined
      }
    >
      {/* Decorative top-right glow */}
      {cfg && !isDegenFeed && (
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.08] blur-2xl"
          style={{ backgroundColor: cfg.color }}
          aria-hidden="true"
        />
      )}

      <div className={`flex items-start gap-3 ${compact ? 'flex-row' : 'flex-row'}`}>
        {/* Platform icon */}
        {cfg && (
          <div
            className={`
              flex shrink-0 items-center justify-center rounded-xl
              ${compact ? 'h-8 w-8 text-base' : 'h-10 w-10 text-xl'}
            `}
            style={{
              backgroundColor: `${cfg.color}15`,
              color: cfg.color,
            }}
            aria-hidden="true"
          >
            {cfg.icon}
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-[var(--color-fg)] ${compact ? 'text-xs' : 'text-sm'}`}>
            {isDegenFeed
              ? 'Welcome back!'
              : isDirect
                ? 'Welcome to DegenFeed!'
                : cfg
                  ? `From ${cfg.label}? You're in the right place.`
                  : 'Welcome!'}
          </p>
          <p className={`mt-0.5 text-[var(--color-muted)] ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {isDegenFeed
              ? 'Full access unlocked.'
              : isDirect
                ? 'Watch the stream instantly — no account required.'
                : cfg
                  ? 'Watch the stream, chat as a guest, and tip the creator.'
                  : 'Watch and interact without an account.'}
          </p>
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--color-muted)] transition-colors hover:bg-[var(--color-glass-border)] hover:text-[var(--color-fg)]"
          aria-label="Dismiss greeting"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Reduced motion */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .translate-y-0,
          .-translate-y-2 {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
