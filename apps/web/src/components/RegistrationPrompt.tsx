'use client';

/**
 * RegistrationPrompt — non-blocking registration nudge for anonymous browsers.
 *
 * Tracks page views in localStorage and surfaces a gentle call-to-action:
 *   - After 5  page views: a subtle dismissible banner
 *   - After 10 page views: a modal with a "Continue browsing" escape hatch
 *
 * Content is NEVER blocked — the modal always has a "Continue browsing"
 * option, closes on Escape/backdrop click, and everything disappears as
 * soon as the user signs in.
 */

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  decidePromptSurface,
  dismissBanner,
  incrementPageView,
  markModalSeen,
  type PromptSurface,
  readFlags,
} from '../lib/registrationPrompt';
import { useAuth } from './AuthProvider';

export function RegistrationPrompt() {
  const { walletAddress, primaryIdentity, signedInProtocols, openSignUp, openSignIn } = useAuth();
  const pathname = usePathname();
  const lastCountedPath = useRef<string | null>(null);

  const [count, setCount] = useState(0);
  const [surface, setSurface] = useState<PromptSurface>('none');

  const signedIn =
    !!walletAddress || !!primaryIdentity || Object.keys(signedInProtocols).length > 0;

  // Increment the anonymous page-view counter once per route.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (lastCountedPath.current === pathname) return;
    lastCountedPath.current = pathname;
    setCount(incrementPageView());
  }, [pathname]);

  // Decide whether to show the banner or modal based on the counter.
  useEffect(() => {
    if (signedIn) {
      setSurface('none');
      return;
    }
    if (count === 0) return;

    const next = decidePromptSurface(count, readFlags());
    setSurface(next);
    // The modal is a once-per-browser experience — mark it seen immediately
    // so navigating around does not re-trigger it every page.
    if (next === 'modal') markModalSeen();
  }, [count, signedIn]);

  const handleDismissBanner = useCallback(() => {
    setSurface((prev) => (prev === 'banner' ? 'none' : prev));
    dismissBanner();
  }, []);

  const handleCloseModal = useCallback(() => {
    setSurface((prev) => (prev === 'modal' ? 'none' : prev));
  }, []);

  if (signedIn) return null;

  return (
    <>
      {/* ── Subtle banner (≥5 page views) ─────────────────────────────── */}
      {surface === 'banner' && (
        <div
          className="fixed bottom-4 right-4 z-40 flex max-w-sm items-center gap-3 rounded-2xl border border-degen-500/25 bg-[var(--color-card)]/95 p-4 shadow-2xl backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <span className="text-2xl" aria-hidden="true">
            🍿
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-fg)]">Enjoying DegenFeed?</p>
            <p className="text-xs text-[var(--color-muted)]">
              Create a free account to customize your feed.
            </p>
            <button
              type="button"
              onClick={openSignUp}
              className="mt-2 text-xs font-bold text-degen-400 hover:underline"
            >
              Create free account →
            </button>
          </div>
          <button
            type="button"
            onClick={handleDismissBanner}
            className="shrink-0 rounded-lg p-1.5 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]"
            aria-label="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}

      {/* ── Modal (≥10 page views) — never blocks content ─────────────── */}
      {surface === 'modal' && (
        <section
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create a free DegenFeed account"
            className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCloseModal();
            }}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-fg)]">
                  You&apos;ve been browsing anonymously
                </h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Create an account to save your feed, follow creators, and post across every
                  protocol.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="shrink-0 rounded-lg p-2 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M15 5L5 15M5 5l10 10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <ul className="mb-5 space-y-2">
              {[
                'Personalized feed tuned to your interests',
                'Follow creators across all networks',
                'Post to Nostr, Farcaster, Lens, Bluesky & more',
                'Your keys, your identity — fully self-custody',
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-sm text-[var(--color-fg)]">
                  <span className="mt-0.5 text-degen-400" aria-hidden="true">
                    ✓
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>

            <div className="space-y-2">
              <button type="button" onClick={openSignUp} className="btn-primary w-full">
                Create free account
              </button>
              <button
                type="button"
                onClick={openSignIn}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm font-semibold text-[var(--color-fg)] transition-colors hover:border-gray-600"
              >
                I already have an account
              </button>
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-full py-1 text-center text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                Continue browsing
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
