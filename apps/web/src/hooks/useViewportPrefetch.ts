'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * useViewportPrefetch — prefetches routes for links that are about to enter the viewport.
 *
 * Uses IntersectionObserver with a rootMargin of +200px on the bottom
 * to detect links approaching the visible area, and prefetches them.
 *
 * Call once per page with a ref to the scrollable container.
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * useViewportPrefetch(containerRef, [
 *   { href: '/feed', priority: 1 },
 *   { href: '/trending', priority: 1 },
 * ]);
 * ```
 */
export function useViewportPrefetch(
  links: { href: string; priority?: number }[],
) {
  const router = useRouter();
  const prefetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Sort by priority (lower number = higher priority)
    const sorted = [...links].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

    // Prefetch high-priority links immediately
    for (const link of sorted) {
      if (link.priority !== undefined && link.priority <= 2) {
        if (!prefetchedRef.current.has(link.href)) {
          prefetchedRef.current.add(link.href);
          try {
            router.prefetch(link.href);
          } catch {
            // ignore
          }
        }
      }
    }

    // For the rest, use IntersectionObserver to prefetch when near viewport
    if (sorted.length === 0) return;

    // We observe the <body> for links — use mutation observer to find <a> tags
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const anchor = entry.target as HTMLAnchorElement;
            const href = anchor.getAttribute('href');
            if (href && !prefetchedRef.current.has(href)) {
              prefetchedRef.current.add(href);
              try {
                router.prefetch(href);
              } catch {
                // ignore
              }
            }
          }
        }
      },
      {
        rootMargin: '200px 0px',
        threshold: 0,
      },
    );

    // Find all internal <a> links and observe them
    const anchors = document.querySelectorAll<HTMLAnchorElement>(
      'a[href^="/"]:not([href^="//"])',
    );
    for (const anchor of anchors) {
      // Only observe internal navigation links
      const href = anchor.getAttribute('href');
      if (href && href !== '#' && !href.startsWith('http') && !href.startsWith('//')) {
        observer.observe(anchor);
      }
    }

    // Also observe new links added dynamically
    const mutationObserver = new MutationObserver(() => {
      document.querySelectorAll<HTMLAnchorElement>(
        'a[href^="/"]:not([href^="//"]):not([data-vp-observed])',
      ).forEach((anchor) => {
        const href = anchor.getAttribute('href');
        if (href && href !== '#' && !href.startsWith('http') && !href.startsWith('//')) {
          anchor.setAttribute('data-vp-observed', 'true');
          observer.observe(anchor);
        }
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [links, router]);
}
