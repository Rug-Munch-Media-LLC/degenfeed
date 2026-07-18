'use client';

import { useEffect, useState } from 'react';

interface TocItem {
  id: string;
  label: string;
  level: number;
}

export function DocToc({ contentSelector = 'main' }: { contentSelector?: string }) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const main = document.querySelector(contentSelector);
    if (!main) return;

    const headings = main.querySelectorAll('h2, h3');
    const tocItems: TocItem[] = [];

    headings.forEach((h) => {
      if (h.id) {
        tocItems.push({
          id: h.id,
          label: h.textContent?.replace(/#$/, '').trim() ?? '',
          level: h.tagName === 'H2' ? 2 : 3,
        });
      }
    });

    setItems(tocItems);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -80% 0px' },
    );

    for (const item of tocItems) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [contentSelector]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Table of Contents" className="text-sm">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        On this page
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`block border-l-2 py-1 pr-3 text-xs transition-colors ${
                item.level === 3 ? 'pl-5' : 'pl-3'
              } ${
                activeId === item.id
                  ? 'border-degen-400 text-degen-400 font-medium'
                  : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-muted)] hover:border-gray-500'
              }`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
