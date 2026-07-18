'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface OnboardingContextValue {
  /** Whether the onboarding modal is currently visible */
  show: boolean;
  /** Open the onboarding flow */
  open: () => void;
  /** Close/dismiss the onboarding flow */
  close: () => void;
  /** Mark onboarding as complete (stores to localStorage + closes) */
  complete: () => void;
  /** Reset onboarding flag so the modal shows again on next session */
  reset: () => void;
  /** Whether the user has completed onboarding before */
  hasCompleted: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const STORAGE_KEY = 'degenfeed_onboarded';
const EVENT_NAME = 'df-open-onboarding';

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  // Check localStorage on mount — ONLY reads status, does NOT auto-show
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const done = localStorage.getItem(STORAGE_KEY) === 'true';
      setHasCompleted(done);
    } catch {
      /* localStorage unavailable */
    }
    // NOTE: Onboarding modal is NEVER shown on page load.
    // It only opens after a successful sign-in via triggerOnboarding().
  }, []);

  // Listen for custom event from AuthProvider (post-sign-in trigger ONLY)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = () => {
      // Only open if not yet completed
      const done = localStorage.getItem(STORAGE_KEY) === 'true';
      if (!done) {
        setShow(true);
      }
    };

    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const open = useCallback(() => setShow(true), []);
  const close = useCallback(() => setShow(false), []);

  const complete = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      /* localStorage unavailable */
    }
    setHasCompleted(true);
    setShow(false);
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* localStorage unavailable */
    }
    setHasCompleted(false);
    setShow(true);
  }, []);

  return (
    <OnboardingContext.Provider value={{ show, open, close, complete, reset, hasCompleted }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}

/**
 * Dispatch a custom event to trigger the onboarding flow.
 * Called after successful sign-in from AuthProvider.
 */
export function triggerOnboarding() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}
