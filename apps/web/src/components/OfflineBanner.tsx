'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Shows a yellow warning banner when the browser is offline.
 * Auto-hides when connection is restored.
 * Mount this high in the component tree (e.g. Shell).
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [show, setShow] = useState(false);

  const handleOnline = useCallback(() => {
    setOffline(false);
    // Keep visible for a moment to show the "back online" state
    setTimeout(() => setShow(false), 2000);
  }, []);

  const handleOffline = useCallback(() => {
    setOffline(true);
    setShow(true);
  }, []);

  useEffect(() => {
    // Check initial state
    setOffline(!navigator.onLine);
    setShow(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  if (!show) return null;

  return (
    <div
      className={`sticky top-16 z-50 w-full px-4 py-2 text-center text-sm font-medium transition-all duration-300 ${
        offline
          ? 'bg-amber-500/15 text-amber-400 border-b border-amber-500/20'
          : 'bg-degen-500/10 text-degen-400 border-b border-degen-500/20'
      }`}
      role="alert"
      aria-live="polite"
    >
      {offline ? (
        <span className="flex items-center justify-center gap-2">
          <span aria-hidden="true">📡</span>
          You&apos;re offline. Some features may be limited.
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          <span aria-hidden="true">✅</span>
          Back online
        </span>
      )}
    </div>
  );
}
