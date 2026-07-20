'use client';

import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Optional breadcrumb items [{ label, href? }] */
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export default function PageHeader({
  title,
  description,
  icon,
  actions,
  className = '',
  breadcrumbs,
}: PageHeaderProps) {
  return (
    <div className={`mb-6 ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          className="mb-2 flex items-center gap-1.5 text-xs text-[var(--color-muted)]"
          aria-label="Breadcrumb"
        >
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.label} className="flex items-center gap-1.5">
              {i > 0 && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              )}
              {crumb.href ? (
                <a href={crumb.href} className="transition-colors hover:text-[var(--color-fg)]">
                  {crumb.label}
                </a>
              ) : (
                <span className="font-medium text-[var(--color-fg)]">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-degen-500/10 text-degen-400">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-[var(--color-fg)]">{title}</h1>
            {description && (
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export { PageHeader };
