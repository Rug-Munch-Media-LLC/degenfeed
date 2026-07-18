'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DocSearch } from './_components/doc-search';
import { EditPage } from './_components/doc-edit-page';

interface DocSection {
  id: string;
  label: string;
  icon?: string;
  href?: string;
  subsections?: { id: string; label: string; href?: string }[];
}

const sections: DocSection[] = [
  { id: 'home', label: 'Home', icon: '◎', href: '/docs' },
  { id: 'quickstart', label: 'Quickstart', icon: '▶', href: '/docs/quickstart' },
  { id: 'user-guide', label: 'User Guide', icon: '📖', href: '/docs/user-guide' },
  {
    id: 'api',
    label: 'API Reference',
    icon: '◎',
    href: '/docs/api',
  },
  { id: 'protocols', label: 'Protocols', icon: '◇', href: '/docs/protocols' },
  { id: 'architecture', label: 'Architecture', icon: '◈', href: '/docs/architecture' },
  { id: 'contributing', label: 'Contributing', icon: '⊞', href: '/docs/contributing' },
  { id: 'changelog', label: 'Changelog', icon: '☰', href: '/docs/changelog' },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: '⚠', href: '/docs/troubleshooting' },
  { id: 'comparison', label: 'Comparison', icon: '◆', href: '/docs/comparison' },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Determine active section from pathname
  const activeSection = pathname === '/docs' ? 'home' : pathname.replace('/docs/', '').split('/')[0];

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay with explicit close action */}
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          role="presentation"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--color-glass-border)] bg-[var(--color-bg)] transition-transform duration-200 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:bg-transparent ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto px-4 py-6">
          {/* Mobile header */}
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <span className="font-semibold text-[var(--color-fg)] text-sm">Documentation</span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded p-1 text-gray-400 hover:text-[var(--color-fg)]"
              aria-label="Close sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" role="img" aria-labelledby="close-docs-title"><title id="close-docs-title">Close documentation sidebar</title><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Search */}
          <div className="mb-5">
            <DocSearch />
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-0.5">
            {sections.map((s) => {
              const isActive = activeSection === s.id;
              return (
                <div key={s.id}>
                  <Link
                    href={s.href ?? `#${s.id}`}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-degen-500/10 text-degen-400 font-medium'
                        : 'text-gray-400 hover:text-[var(--color-fg)] hover:bg-white/[0.03]'
                    }`}
                  >
                    {s.icon && <span className="text-xs opacity-60">{s.icon}</span>}
                    {s.label}
                  </Link>
                  {s.subsections && (
                    <div className="ml-6 mt-0.5 space-y-0.5 border-l border-[var(--color-glass-border)] pl-2">
                      {s.subsections.map((ss) => (
                        <a
                          key={ss.id}
                          href={ss.href ?? `#${ss.id}`}
                          onClick={() => setSidebarOpen(false)}
                          className="block rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:text-gray-300"
                        >
                          {ss.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Bottom status */}
          <div className="mt-auto border-t border-[var(--color-glass-border)] pt-4">
            <Link
              href="/status"
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-gray-500 transition-colors hover:text-[var(--color-fg)]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              All systems operational
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="fixed bottom-4 left-4 z-20 rounded-full border border-white/10 bg-black p-3 text-[var(--color-fg)] shadow-lg lg:hidden"
        aria-label="Open sidebar"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" role="img" aria-labelledby="open-docs-title"><title id="open-docs-title">Open documentation sidebar</title><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
      </button>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1">
        <main className="min-w-0 flex-1">{children}</main>

        {/* Right sidebar — Table of Contents + Edit */}
        <DocRightSidebar />
      </div>
    </div>
  );
}

function DocRightSidebar() {
  const pathname = usePathname();
  const [items, setItems] = useState<{ id: string; label: string; level: number }[]>([]);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;

    const headings = main.querySelectorAll('h2, h3');
    const tocItems: { id: string; label: string; level: number }[] = [];
    headings.forEach((h) => {
      if (h.id) {
        tocItems.push({
          id: h.id,
          label: (h.textContent ?? '').replace(/#$/, '').trim(),
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
  }, [pathname]);

  // Only show TOC on sub-pages (not the main docs landing page)
  const showToc = pathname !== '/docs' && items.length > 0;

  return (
    <aside className="hidden xl:block w-56 flex-shrink-0 border-l border-[var(--color-glass-border)] px-4 py-8">
      {showToc && (
        <nav aria-label="On this page" className="sticky top-24">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
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
                      : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-[var(--color-glass-border)] pt-4">
            <EditPage />
          </div>
        </nav>
      )}
    </aside>
  );
}
