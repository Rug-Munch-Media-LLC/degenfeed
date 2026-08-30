'use client';

import { useEffect } from 'react';

/**
 * Dynamically loads layout CSS modules based on the user's layout preference.
 * Reduces initial bundle size by deferring 600+ lines of layout CSS.
 */
export function useLayoutCSS(): void {
  useEffect(() => {
    const layout = localStorage.getItem('df_layout') || 'default';

    async function loadCSS() {
      switch (layout) {
        case 'compact':
          await import('../styles/layout-compact.module.css');
          break;
        case 'media-grid':
          await import('../styles/layout-media-grid.module.css');
          break;
        case 'reader':
          await import('../styles/layout-reader.module.css');
          break;
        default:
          break;
      }
    }

    loadCSS().catch(() => {
      /* CSS module not critical — layout degrades gracefully */
    });
  }, []);
}
