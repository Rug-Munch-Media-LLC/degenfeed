'use client';

/**
 * @degenfeed/ui — Ctrl/Cmd+Enter submits the composer.
 */

import { useEffect } from 'react';

export function useSubmitShortcut(active: boolean, onSubmit: () => void): void {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onSubmit]);
}
