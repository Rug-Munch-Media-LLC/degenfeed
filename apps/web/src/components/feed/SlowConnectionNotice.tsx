'use client';

/**
 * @degenfeed/web — SlowConnectionNotice
 *
 * Renders a subtle "still working" hint when a feed has been loading for
 * more than 2 seconds on a slow connection. The skeleton is always shown
 * immediately; this notice appears on top of it so users on throttled
 * connections know the request is still in flight (not stuck).
 */

import { useEffect, useState } from 'react';

export function SlowConnectionNotice({ active }: { active: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active) {
      setShow(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShow(true), 2000);
    return () => window.clearTimeout(timer);
  }, [active]);

  if (!active || !show) return null;

  return (
    <div
      className="mb-3 flex items-center gap-2 rounded-lg border border-yellow-500/15 bg-yellow-500/5 px-3 py-2"
      role="status"
      aria-live="polite"
    >
      <span
        className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-yellow-400/40 border-t-yellow-400"
        aria-hidden="true"
      />
      <p className="text-xs text-yellow-400/90">
        Taking longer than expected on a slow connection — hang tight.
      </p>
    </div>
  );
}
