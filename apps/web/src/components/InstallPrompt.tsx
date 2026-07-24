'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }
}

/**
 * InstallPrompt — "Add to Home Screen" PWA install prompt.
 *
 * Shows as a floating bottom sheet 30 seconds into browsing.
 * Uses the native `beforeinstallprompt` event.
 * Applies safe area inset and backdrop blur.
 * All touch targets ≥ 44px.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Already running as installed PWA — no prompt needed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after 30 seconds of browsing
      timerRef.current = setTimeout(() => setShowPrompt(true), 30_000);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setInstalled(true);
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt || installed) return null;

  return (
    <div
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)] z-50 mx-auto max-w-sm animate-slide-up"
      role="dialog"
      aria-label="Install app"
    >
      <div
        className="rounded-xl border p-4 shadow-2xl backdrop-blur-2xl"
        style={{
          backgroundColor: 'var(--color-glass-bg-heavy)',
          borderColor: 'var(--color-glass-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold"
            style={{
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21 20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.49a1 1 0 01.386-.79l8-6.222a1 1 0 011.228 0l8 6.222a1 1 0 01.386.79V20z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
              Install DegenFeed
            </p>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              Add to home screen for faster access
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleInstall}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-95"
            style={{
              background: 'var(--color-accent)',
              color: '#000',
              minHeight: '44px',
            }}
          >
            Install
          </button>
          <button
            type="button"
            onClick={() => setShowPrompt(false)}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: 'var(--color-muted)',
              background: 'var(--color-overlay)',
              minHeight: '44px',
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
