'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * PostCardPrefetcher — adds hover and viewport-based prefetching
 * to post cards and other interactive elements that navigate via
 * `router.push()` (not `<Link>`).
 *
 * This component watches for:
 *  1. **Hover** — when the cursor enters a post card (`.post-card`),
 *     prefetch the post URL with a 200ms debounce
 *  2. **Viewport** — when a post card is within 200px of the viewport,
 *     prefetch the post URL
 *
 * It reads the `data-href` attribute from post card elements, or
 * falls back to constructing `/post/{id}` from a `data-post-id` attr.
 *
 * @example
 * ```tsx
 * <PostCardPrefetcher containerRef={feedContainerRef} />
 * ```
 */
interface PostCardPrefetcherProps {
  /** Ref to the scrollable container holding the post cards */
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export function PostCardPrefetcher({ containerRef }: PostCardPrefetcherProps) {
  const router = useRouter();
  const prefetchedRef = useRef<Set<string>>(new Set());
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetch = (href: string) => {
    if (!href || prefetchedRef.current.has(href)) return;
    prefetchedRef.current.add(href);
    try {
      router.prefetch(href);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const container = containerRef?.current ?? document.body;

    // Extract href from a card element
    const getHref = (el: Element): string | null => {
      const href = el.getAttribute('data-href');
      if (href) return href;
      const postId = el.getAttribute('data-post-id');
      if (postId) return `/post/${encodeURIComponent(postId)}`;
      return null;
    };

    // == Hover prefetch (delegated) ==
    const onMouseOver = (e: MouseEvent) => {
      const card = (e.target as Element).closest('[data-post-id],[data-href]');
      if (!card) return;

      const href = getHref(card);
      if (!href) return;

      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => prefetch(href), 200);
    };

    const onMouseOut = (e: MouseEvent) => {
      const card = (e.target as Element).closest('[data-post-id],[data-href]');
      if (!card) return;
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };

    // == Viewport prefetch (IntersectionObserver) ==
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const href = getHref(entry.target);
            if (href) prefetch(href);
          }
        }
      },
      { rootMargin: '200px 0px', threshold: 0 },
    );

    // Observe all existing post cards
    const cards = container.querySelectorAll<HTMLElement>('[data-post-id],[data-href]');
    for (const card of cards) {
      observer.observe(card);
    }

    // Observe new cards added dynamically (mutation observer)
    const mutationObserver = new MutationObserver(() => {
      container
        .querySelectorAll<HTMLElement>(
          '[data-post-id]:not([data-dfp-observed]),[data-href]:not([data-dfp-observed])',
        )
        .forEach((card) => {
          card.setAttribute('data-dfp-observed', 'true');
          observer.observe(card);
        });
    });

    mutationObserver.observe(container, { childList: true, subtree: true });

    // Listen for hover
    container.addEventListener('mouseover', onMouseOver);
    container.addEventListener('mouseout', onMouseOut);

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      container.removeEventListener('mouseover', onMouseOver);
      container.removeEventListener('mouseout', onMouseOut);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, [containerRef, prefetch]);

  return null;
}
