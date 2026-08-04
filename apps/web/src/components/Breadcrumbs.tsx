'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useMemo } from 'react';

interface BreadcrumbSegment {
  label: string;
  href: string;
}

function HomeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-[var(--color-muted)]"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/**
 * Breadcrumb navigation for deep pages.
 * Auto-generates from the current pathname.
 * Shows: Home icon > Section > Subsection > Current
 */
export function Breadcrumbs({
  overrides,
  className = '',
  forceShow = false,
}: {
  overrides?: Record<string, string>;
  className?: string;
  /** Render even on shallow (2-segment) paths like /feed/nostr. Default false. */
  forceShow?: boolean;
}) {
  const pathname = usePathname();

  const segments = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbSegment[] = [{ label: 'Home', href: '/' }];

    let current = '';
    for (const part of parts) {
      current += `/${part}`;
      const decoded = decodeURIComponent(part);
      const label =
        overrides?.[part] ?? decoded.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      crumbs.push({ label, href: current });
    }

    return crumbs;
  }, [pathname, overrides]);

  // Don't show on top-level pages (unless forced for deep feed pages)
  if (!forceShow && segments.length <= 2) return null;

  return (
    <nav aria-label="Breadcrumb" className={`mb-3 ${className}`}>
      <ol className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          const isRoot = i === 0;
          return (
            <Fragment key={seg.href}>
              {i > 0 && (
                <li aria-hidden="true" className="flex items-center">
                  <ChevronIcon />
                </li>
              )}
              <li>
                {isLast ? (
                  <span className="flex items-center gap-1 font-medium text-[var(--color-fg)] truncate max-w-[200px]">
                    {isRoot && <HomeIcon />}
                    {!isRoot && seg.label}
                  </span>
                ) : (
                  <Link
                    href={seg.href}
                    className="flex items-center gap-1 transition-colors hover:text-[var(--color-fg)] truncate max-w-[150px]"
                  >
                    {isRoot && <HomeIcon />}
                    {!isRoot && seg.label}
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
