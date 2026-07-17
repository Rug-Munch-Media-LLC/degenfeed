'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'degenfeed_a2hs_dismissed';
const SHOW_DELAY_MS = 300_000; // 5 minutes

/**
 * Subtle toast that prompts the user to add DegenFeed to their home screen.
 * Appears after 5 minutes of browsing on first visit (non-installed, non-dismissed).
 * Separate from the beforeinstallprompt-based InstallPrompt component.
 */
export function AddToHomeScreenToast() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Already installed as PWA — no prompt needed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Check if the user previously dismissed the toast
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (dismissed === 'true') return;
    } catch {
      /* private browsing — still show */
    }

    // Show the toast after 5 minutes
    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, SHOW_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      /* ignore */
    }
  }, []);

  const handleShowInstructions = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      /* ignore */
    }
    // Show platform-specific instructions
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS || isSafari) {
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: {
            kind: 'info',
            message: 'Tap the Share icon, then scroll down and tap "Add to Home Screen".',
            duration: 8000,
          },
        }),
      );
    } else {
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: {
            kind: 'info',
            message: 'Open your browser menu and select "Install" or "Add to Home Screen".',
            duration: 8000,
          },
        }),
      );
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xs -translate-x-1/2 animate-slide-up sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0"
      role="status"
      aria-live="polite"
    >
      <div
        className="flex items-center gap-3 rounded-xl border border-degen-500/20 bg-gradient-to-r from-degen-500/10 to-degen-500/5 px-4 py-3 shadow-2xl backdrop-blur-xl"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-glass-bg)' }}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-degen-500/20 text-sm"
          aria-hidden="true"
        >
          📲
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>
            Add to Home Screen
          </p>
          <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
            Install DegenFeed for the best experience
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleShowInstructions}
            className="rounded-lg bg-degen-500/20 px-2.5 py-1.5 text-[10px] font-semibold text-degen-400 transition-colors hover:bg-degen-500/30"
          >
            How?
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg p-1.5 transition-colors hover:bg-white/5"
            style={{ color: 'var(--color-muted)' }}
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
