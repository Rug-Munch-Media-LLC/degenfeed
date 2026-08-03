'use client';

import { useEffect } from 'react';

/**
 * usePageTransition — signals to the LoadingBar / template.tsx that
 * the current page has finished loading its data.
 *
 * Call this at the end of data-fetching effects in heavy pages.
 * It emits `df-content-ready` which the template listens for.
 *
 * @example
 * ```tsx
 * function FeedPage() {
 *   const [posts, setPosts] = useState([]);
 *   const [loading, setLoading] = useState(true);
 *
 *   useEffect(() => {
 *     fetch('/api/feed').then(data => {
 *       setPosts(data);
 *       setLoading(false);
 *     });
 *   }, []);
 *
 *   // Signal that we're ready — LoadingBar will complete
 *   usePageTransition(!loading);
 * }
 * ```
 */
export function usePageTransition(ready = true) {
  useEffect(() => {
    if (ready) {
      // Small delay to let React commit the paint
      const id = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('df-content-ready'));
      }, 50);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [ready]);
}
