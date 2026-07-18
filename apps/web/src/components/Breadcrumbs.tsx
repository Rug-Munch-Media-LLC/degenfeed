'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useMemo } from 'react';

interface BreadcrumbSegment {
  label: string;
  href: string;
}

/**
 * Breadcrumb navigation for deep pages.
 * Auto-generates from the current pathname.
 * Shows: Home > Section > Subsection > Current
 *
 * Custom overrides can be passed for specific path segments.
 */
export function Breadcrumbs({
  overrides,
  className = '',
}: {
  overrides?: Record<string, string>;
  className?: string;
}) {
  const pathname = usePathname();

  const segments = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbSegment[] = [{ label: 'Home', href: '/' }];

    let current = '';
    for (const part of parts) {
      current += `/${part}`;
      // Decode URL-encoded segments and capitalize
      const decoded = decodeURIComponent(part);
      const label =
        overrides?.[part] ?? decoded.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      crumbs.push({ label, href: current });
    }

    return crumbs;
  }, [pathname, overrides]);

  // Don't show breadcrumbs on top-level pages
  if (segments.length <= 2) return null;

  return (
    <nav aria-label="Breadcrumb" className={`mb-3 ${className}`}>
      <ol className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          return (
            <Fragment key={seg.href}>
              {i > 0 && (
                <li aria-hidden="true" className="text-[10px] text-[var(--color-muted)]">
                  /
                </li>
              )}
              <li>
                {isLast ? (
                  <span className="font-medium text-[var(--color-fg)] truncate max-w-[200px] block">
                    {seg.label}
                  </span>
                ) : (
                  <Link
                    href={seg.href}
                    className="transition-colors hover:text-[var(--color-fg)] truncate max-w-[150px] block"
                  >
                    {seg.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
