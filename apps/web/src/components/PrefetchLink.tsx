'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useHoverPrefetch } from '../hooks/useHoverPrefetch';

/**
 * PrefetchLink — Next.js Link that also prefetches the route on hover/touch.
 *
 * Combines standard `<Link prefetch>` (on-mount) with a hover debounce
 * that triggers router.prefetch() after 150ms of hovering. This gives
 * instant navigation on click even when the user's cursor passes over
 * many links quickly.
 *
 * Use this for post cards, video cards, notification items, community cards.
 */
export function PrefetchLink({
  href,
  prefetch = false,
  children,
  className,
  style,
  ...props
}: ComponentProps<typeof Link>) {
  const { onMouseEnter, onMouseLeave, onTouchStart } = useHoverPrefetch(150);

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={className}
      style={style}
      onMouseEnter={(e) => {
        onMouseEnter(typeof href === 'string' ? href : '');
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        onMouseLeave();
        props.onMouseLeave?.(e);
      }}
      onTouchStart={(e) => {
        onTouchStart(typeof href === 'string' ? href : '');
        props.onTouchStart?.(e);
      }}
      {...props}
    >
      {children}
    </Link>
  );
}
