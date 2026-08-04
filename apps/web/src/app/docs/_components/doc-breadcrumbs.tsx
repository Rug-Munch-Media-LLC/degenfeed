/**
 * DocBreadcrumbs — visible breadcrumb trail + BreadcrumbList structured data.
 *
 * Rendered server-side so search engines see the JSON-LD markup without JS.
 * The JSON-LD block uses next/script (data block, not an executable script)
 * and is therefore exempt from the CSP script-src policy.
 */
import Link from 'next/link';
import Script from 'next/script';

export interface Crumb {
  label: string;
  href?: string;
}

export function DocBreadcrumbs({ items }: { items: Crumb[] }) {
  const breadcrumbStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items
      .filter((i) => i.href)
      .map((i, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: i.label,
        ...(i.href ? { item: `https://degenfeed.xyz${i.href}` } : {}),
      })),
  };

  return (
    <>
      <Script
        id={`breadcrumb-${items
          .map((i) => i.label)
          .join('-')
          .toLowerCase()
          .replace(/\s+/g, '-')}`}
        type="application/ld+json"
        strategy="beforeInteractive"
      >
        {JSON.stringify(breadcrumbStructuredData)}
      </Script>
      <nav aria-label="Breadcrumb" className="mb-4 text-xs">
        <ol className="flex flex-wrap items-center gap-1.5 text-[var(--color-muted)]">
          {items.map((crumb, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={crumb.label} className="flex items-center gap-1.5">
                {index > 0 && (
                  <span aria-hidden="true" className="opacity-50">
                    /
                  </span>
                )}
                {crumb.href && !isLast ? (
                  <Link href={crumb.href} className="transition-colors hover:text-degen-400">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current={isLast ? 'page' : undefined} className="text-degen-400">
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
