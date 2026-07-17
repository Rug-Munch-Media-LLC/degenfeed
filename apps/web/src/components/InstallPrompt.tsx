'use client';

import { useEffect, useState } from 'react';

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);

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
      const timer = setTimeout(() => setShowPrompt(true), 30_000);
      return () => clearTimeout(timer);
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
      className="fixed bottom-20 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4 animate-slide-up"
      role="dialog"
      aria-label="Install app"
    >
      <div className="rounded-xl border bg-card p-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            D
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Install DegenFeed</h3>
            <p className="text-xs text-muted-foreground">Add to home screen for faster access</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleInstall}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Install
          </button>
          <button
            type="button"
            onClick={() => setShowPrompt(false)}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
