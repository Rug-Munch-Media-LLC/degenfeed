'use client';

import { createContext, type ReactNode, useCallback, useContext, useRef } from 'react';

export type AnnouncementPriority = 'polite' | 'assertive';

interface AnnouncerContextValue {
  announce: (message: string, priority?: AnnouncementPriority) => void;
}

const AnnouncerContext = createContext<AnnouncerContextValue | null>(null);

export function useAnnouncer(): AnnouncerContextValue {
  const ctx = useContext(AnnouncerContext);
  if (!ctx) throw new Error('useAnnouncer must be used within ScreenReaderAnnouncer');
  return ctx;
}

/**
 * ScreenReaderAnnouncer — Provides `aria-live` regions for dynamic content
 * announcements to screen readers.
 *
 * Usage:
 * ```tsx
 * const { announce } = useAnnouncer();
 * announce('3 new posts loaded');
 * announce('Message sent', 'assertive');
 * ```
 *
 * Two regions: `polite` (default, doesn't interrupt current task) and
 * `assertive` (immediate notification).
 */
export function ScreenReaderAnnouncerProvider({ children }: { children: ReactNode }) {
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);
  const politeTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const assertiveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const announce = useCallback((message: string, priority: AnnouncementPriority = 'polite') => {
    const ref = priority === 'assertive' ? assertiveRef : politeRef;
    const timeout = priority === 'assertive' ? assertiveTimeout : politeTimeout;

    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    // Clear and re-set to ensure the same message re-triggers
    if (ref.current) {
      ref.current.textContent = '';
      // Use requestAnimationFrame to ensure the clear takes effect before setting
      requestAnimationFrame(() => {
        if (ref.current) {
          ref.current.textContent = message;
        }
      });
    }

    // Auto-clear after announcement to avoid stale text
    timeout.current = setTimeout(() => {
      if (ref.current) {
        ref.current.textContent = '';
      }
    }, 3000);
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Polite — for non-urgent updates */}
      <div
        ref={politeRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      {/* Assertive — for time-sensitive updates */}
      <div
        ref={assertiveRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </AnnouncerContext.Provider>
  );
}
