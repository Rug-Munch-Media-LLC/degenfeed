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
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
      {/* Premium illustration */}
      <div className="mb-8 flex items-center justify-center">
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          aria-hidden="true"
          className="opacity-80"
        >
          <rect
            x="8"
            y="8"
            width="64"
            height="64"
            rx="16"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.12"
          />
          <circle cx="40" cy="34" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
          <path
            d="M26 56c0-8 5-12 14-12s14 4 14 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.2"
          />
          <path
            d="M36 30l8 8M44 30l-8 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.35"
          />
        </svg>
      </div>

      <h1 className="mb-2 text-2xl font-bold text-[var(--color-fg)]">Page not found</h1>
      <p className="mb-8 text-sm text-[var(--color-muted)]">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      {/* Search bar — premium styled */}
      <form onSubmit={handleSearch} className="mb-8 w-full max-w-sm">
        <div className="relative group">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search DegenFeed…"
            className="input pl-10"
            aria-label="Search DegenFeed"
          />
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] transition-colors group-focus-within:text-degen-400"
            aria-hidden="true"
          >
            ⌕
          </span>
        </div>
      </form>

      <Link href="/" className="btn-primary mb-10">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M1 8l7-6 7 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3 6v7h3v-4h4v4h3V6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
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
              className="card-hover flex items-start gap-3 p-4"
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
