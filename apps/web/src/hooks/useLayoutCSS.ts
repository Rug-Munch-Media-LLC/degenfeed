'use client';

import { useEffect } from 'react';

/**
 * Dynamically loads layout CSS modules based on the user's layout preference.
 * Reduces initial bundle size by deferring 600+ lines of layout CSS.
 */
export function useLayoutCSS(): void {
  useEffect(() => {
    const layout = localStorage.getItem('df_layout') || 'default';
    let cleanup: (() => void) | undefined;

    async function loadCSS() {
      switch (layout) {
        case 'compact':
          (await import('../styles/layout-compact.module.css')).default;
          break;
        case 'media-grid':
          (await import('../styles/layout-media-grid.module.css')).default;
          break;
        case 'reader':
          (await import('../styles/layout-reader.module.css')).default;
          break;
        default:
          break;
      }
    }

    loadCSS().catch(() => {
      /* CSS module not critical — layout degrades gracefully */
    });

    return () => {
      cleanup?.();
    };
  }, []);
}
