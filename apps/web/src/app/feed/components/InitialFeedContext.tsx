'use client';

/**
 * InitialFeedContext — typed server→client handoff for SSR feed data.
 *
 * feed/layout.tsx (server component) fetches the initial timeline with a
 * bounded budget and provides it here; feed/page.tsx seeds its state from
 * this context so the first SSR + hydration render already shows content.
 * This replaces the old `#feed-initial-data` JSON <script> + DOM-parsing hack.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { createContext, useContext } from 'react';

const InitialFeedContext = createContext<UnifiedPost[]>([]);

export function InitialFeedProvider({
  initialPosts,
  children,
}: {
  initialPosts: UnifiedPost[];
  children: React.ReactNode;
}) {
  return <InitialFeedContext.Provider value={initialPosts}>{children}</InitialFeedContext.Provider>;
}

/** Server-preloaded posts for the unified feed (empty when SSR preload found nothing). */
export function useInitialFeed(): UnifiedPost[] {
  return useContext(InitialFeedContext);
}
