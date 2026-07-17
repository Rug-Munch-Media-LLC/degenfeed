'use client';

import Link from 'next/link';

export const dynamic = 'force-dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface DocSection {
  id: string;
  label: string;
  icon?: string;
  subsections?: { id: string; label: string }[];
}

const sections: DocSection[] = [
  { id: 'overview', label: 'Overview', icon: '◎' },
  {
    id: 'quickstart',
    label: 'Quickstart',
    icon: '▶',
    subsections: [
      { id: 'browse', label: 'Browse the feed' },
      { id: 'account', label: 'Get an account' },
      { id: 'curl', label: 'curl examples' },
    ],
  },
  {
    id: 'protocols',
    label: 'Protocols',
    icon: '◇',
    subsections: [
      { id: 'nostr', label: 'Nostr' },
      { id: 'farcaster', label: 'Farcaster' },
      { id: 'lens', label: 'Lens' },
      { id: 'bluesky', label: 'Bluesky' },
      { id: 'mastodon', label: 'Mastodon / ActivityPub' },
      { id: 'lemmy', label: 'Lemmy' },
    ],
  },
  {
    id: 'api',
    label: 'API Reference',
    icon: '◎',
    subsections: [
      { id: 'feed', label: 'Feed endpoints' },
      { id: 'engagement', label: 'Engagement' },
      { id: 'identity', label: 'Identity & Auth' },
      { id: 'other', label: 'Other endpoints' },
    ],
  },
  { id: 'ranking', label: 'Ranking Algorithm', icon: '◆' },
  {
    id: 'self-hosting',
    label: 'Self-Hosting',
    icon: '⊞',
    subsections: [
      { id: 'setup', label: 'Setup' },
      { id: 'env', label: 'Environment variables' },
      { id: 'deploy', label: 'Deployment' },
    ],
  },
  { id: 'architecture', label: 'Architecture', icon: '◈' },
  { id: 'resources', label: 'Resources', icon: '☰' },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const _pathname = usePathname();
  const [activeId, setActiveId] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
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

    const ids = sections.flatMap((s) => [s.id, ...(s.subsections?.map((ss) => ss.id) ?? [])]);
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-white/5 bg-black transition-transform duration-200 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:bg-transparent ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto px-4 py-6">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <span className="font-semibold text-white text-sm">Documentation</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded p-1 text-gray-400 hover:text-white"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          <nav className="space-y-0.5">
            {sections.map((s) => (
              <div key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    activeId === s.id
                      ? 'bg-degen-500/10 text-degen-400 font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  {s.icon && <span className="text-xs opacity-60">{s.icon}</span>}
                  {s.label}
                </a>
                {s.subsections && (
                  <div className="ml-6 mt-0.5 space-y-0.5 border-l border-white/5 pl-2">
                    {s.subsections.map((ss) => (
                      <a
                        key={ss.id}
                        href={`#${ss.id}`}
                        onClick={() => setSidebarOpen(false)}
                        className={`block rounded px-2 py-1 text-xs transition-colors ${
                          activeId === ss.id
                            ? 'text-degen-400'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {ss.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="mt-auto border-t border-white/5 pt-4">
            <Link
              href="/status"
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-gray-500 transition-colors hover:text-white"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              All systems operational
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed bottom-4 left-4 z-20 rounded-full border border-white/10 bg-black p-3 text-white shadow-lg lg:hidden"
        aria-label="Open sidebar"
      >
        ☰
      </button>

      {/* Main content */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
