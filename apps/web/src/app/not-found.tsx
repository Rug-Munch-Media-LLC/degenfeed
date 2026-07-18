'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

const SUGGESTED_PAGES = [
  { href: '/feed', label: '📰 Feed', desc: 'Your personalized content feed' },
  { href: '/trending', label: '🔥 Trending', desc: 'What is trending across web3' },
  { href: '/discover', label: '🔍 Discover', desc: 'Find new communities and content' },
  { href: '/leaderboard', label: '🏆 Leaderboard', desc: 'Top creators and tippers' },
  { href: '/news', label: '📰 News', desc: 'Crypto news across protocols' },
  { href: '/c', label: '👥 Communities', desc: 'Browse all communities' },
];

export default function NotFound() {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        window.location.href = `/search?q=${encodeURIComponent(query.trim())}`;
      }
    },
    [query],
  );

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10">
        <span className="text-4xl text-amber-400" aria-hidden="true">
          🔍
        </span>
      </div>
      <h1 className="mb-2 text-2xl font-bold text-[var(--color-fg)]">Page not found</h1>
      <p className="mb-8 text-sm text-[var(--color-muted)]">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-8 w-full max-w-sm">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search DegenFeed…"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 pl-10 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] outline-none transition-colors focus:border-degen-500/40"
            aria-label="Search DegenFeed"
          />
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
            aria-hidden="true"
          >
            ⌕
          </span>
        </div>
      </form>

      <Link href="/" className="btn-primary mb-10">
        Go Home
      </Link>

      {/* Suggested pages */}
      <div className="w-full">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Suggested pages
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SUGGESTED_PAGES.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left transition-all hover:border-degen-500/30 hover:shadow-[0_0_20px_-8px_rgba(34,197,94,0.15)]"
            >
              <span className="mt-0.5 text-lg" aria-hidden="true">
                {page.label.split(' ')[0]}
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">{page.label}</p>
                <p className="text-xs text-[var(--color-muted)]">{page.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
