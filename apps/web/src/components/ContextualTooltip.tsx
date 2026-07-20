'use client';

/**
 * @components/ContextualTooltip — Lightweight "first encounter" feature hints.
 *
 * Small tooltips that appear when a user first encounters a feature.
 * Auto-dismiss after 5 seconds or on click. Track "seen" state in localStorage.
 *
 * Design: Compact glass card with degen-green accent. Matches app cyberpunk tone.
 *
 * Usage:
 * ```tsx
 * <ContextualTooltip id="custom-feeds" align="right">
 *   New! Custom Feeds — build your own timeline
 * </ContextualTooltip>
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// === Types ================================================================

interface ContextualTooltipProps {
  /** Unique ID for localStorage tracking. Must be globally unique. */
  id: string;
  /** Tooltip content. Can include inline formatting. */
  children: React.ReactNode;
  /** Alignment relative to the parent element */
  align?: 'left' | 'right' | 'center';
  /** Auto-dismiss timeout in ms (default: 5000) */
  timeout?: number;
  /** Optional icon/emoji prefix */
  icon?: string;
  /** Callback when dismissed */
  onDismiss?: () => void;
}

// === Component ============================================================

export function ContextualTooltip({
  id,
  children,
  align = 'left',
  timeout = 5000,
  icon,
  onDismiss,
}: ContextualTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const seen = localStorage.getItem(`df_tooltip_${id}`);
      if (seen === 'true') return;
    } catch {
      /* ignore */
    }

    // Small delay so page layout is settled
    const showTimer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(showTimer);
  }, [id]);

  const handleDismiss = useCallback(() => {
    setDismissing(true);
    markSeen(id);
    setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 200);
  }, [id, onDismiss]);

  // Auto-dismiss after timeout
  useEffect(() => {
    if (!visible) return;
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, timeout);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, timeout, handleDismiss]);

  // Click anywhere to dismiss
  useEffect(() => {
    if (!visible) return;
    const handler = () => handleDismiss();
    // Delay adding the listener so the click that opened doesn't dismiss it
    const t = setTimeout(() => {
      document.addEventListener('click', handler);
    }, 100);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', handler);
    };
  }, [visible, handleDismiss]);

  if (!visible) return null;

  const alignClass =
    align === 'right' ? 'left-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0';

  return (
    <div
      className={`absolute -top-1 z-50 mt-1 transition-all duration-200 ${alignClass} ${
        dismissing ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex items-center gap-2 rounded-xl border border-degen-500/25 bg-black/90 px-3.5 py-2.5 shadow-lg shadow-degen-500/10 backdrop-blur-xl">
        {/* Arrow */}
        <div className="absolute -top-1 left-3 h-2 w-2 rotate-45 border-l border-t border-degen-500/25 bg-black/90" />

        {/* Icon */}
        {icon && <span className="shrink-0 text-sm leading-none">{icon}</span>}

        {/* Content */}
        <span className="text-xs font-medium leading-snug text-white/90">{children}</span>

        {/* Close button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          className="ml-1 shrink-0 rounded p-0.5 text-white/30 transition-colors hover:bg-white/10 hover:text-white/70"
          aria-label="Dismiss hint"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M9 3L3 9M3 3l6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Mark a tooltip as seen (dismisses permanently).
 */
export function markTooltipSeen(id: string) {
  markSeen(id);
}

/**
 * Reset ALL tooltips so they show again.
 */
export function resetAllTooltips() {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('df_tooltip_')) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}

// === Internal helpers =====================================================

function markSeen(id: string) {
  try {
    localStorage.setItem(`df_tooltip_${id}`, 'true');
  } catch {
    /* ignore */
  }
}
