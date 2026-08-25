'use client';

/**
 * @degenfeed/ui — ScreenReaderAnnouncer
 *
 * Accessible live region for announcing dynamic content changes
 * to screen readers without visual disruption.
 *
 * Hook: useAnnouncer() → { announce(message, priority?) }
 *
 * Usage:
 *   const { announce } = useAnnouncer();
 *   announce("Feed refreshed with 5 new posts");
 *   announce("Error loading profile", 'assertive');
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

/* ─── Context ──────────────────────────────────────────────── */

interface AnnouncerContextValue {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const AnnouncerContext = createContext<AnnouncerContextValue>({
  announce: () => {},
});

export function useAnnouncer() {
  return useContext(AnnouncerContext);
}

/* ─── Provider ─────────────────────────────────────────────── */

interface AnnouncerProviderProps {
  children: ReactNode;
}

export function AnnouncerProvider({ children }: AnnouncerProviderProps) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const politeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const assertiveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const setter = priority === 'assertive' ? setAssertiveMessage : setPoliteMessage;
    const timer = priority === 'assertive' ? assertiveTimer : politeTimer;

    // Clear previous timer and message
    clearTimeout(timer.current);
    setter('');

    // Use rAF to ensure DOM clears the old message before setting new one
    requestAnimationFrame(() => {
      setter(message);
    });

    // Auto-clear after 5s so subsequent same-text announcements re-fire
    timer.current = setTimeout(() => {
      setter('');
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(politeTimer.current);
      clearTimeout(assertiveTimer.current);
    };
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Polite - non-critical updates */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {politeMessage}
      </div>
      {/* Assertive - critical updates */}
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}

/* ─── useAltTextReminder ───────────────────────────────────── */

/**
 * Prompts user to add alt text when they attach images.
 * Returns { reminder, setHasImage, dismissReminder }
 */
export function useAltTextReminder() {
  const [hasImage, setHasImage] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [altTextAdded, setAltTextAdded] = useState(false);

  useEffect(() => {
    if (hasImage && !altTextAdded) {
      const timer = setTimeout(() => setShowReminder(true), 500);
      return () => clearTimeout(timer);
    }
    setShowReminder(false);
    return undefined;
  }, [hasImage, altTextAdded]);

  const dismissReminder = useCallback(() => {
    setShowReminder(false);
    setAltTextAdded(true);
  }, []);

  return {
    reminder: showReminder,
    setHasImage,
    dismissReminder,
    altText: {
      added: altTextAdded,
      setAdded: setAltTextAdded,
    },
  };
}

/* ─── Inline styles for accessibility hooks ────────────────── */

/**
 * CSS for `.sr-only` must exist in your global CSS:
 * .sr-only {
 *   position: absolute;
 *   width: 1px;
 *   height: 1px;
 *   padding: 0;
 *   margin: -1px;
 *   overflow: hidden;
 *   clip: rect(0,0,0,0);
 *   white-space: nowrap;
 *   border: 0;
 * }
 */
