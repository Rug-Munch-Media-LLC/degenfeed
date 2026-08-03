'use client';

/**
 * @degenfeed/web — VideoSearchBar
 *
 * Unified search bar with source filter dropdown.
 * Debounced input that navigates to the search results view.
 */

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SearchSourceOption {
  id: string;
  label: string;
  color: string;
}

const SEARCH_SOURCES: SearchSourceOption[] = [
  { id: 'all', label: 'All Sources', color: '#888' },
  { id: 'youtube', label: 'YouTube', color: '#FF0000' },
  { id: 'peertube', label: 'PeerTube', color: '#F1680D' },
  { id: 'shorts', label: 'Shorts', color: '#FF0050' },
  { id: 'livestream', label: 'Live', color: '#9146FF' },
];

interface VideoSearchBarProps {
  initialQuery?: string;
  initialSource?: string;
  onSearch?: (query: string, source: string) => void;
  className?: string;
  placeholder?: string;
}

export function VideoSearchBar({
  initialQuery = '',
  initialSource = 'all',
  onSearch,
  className = '',
  placeholder = 'Search videos across all sources...',
}: VideoSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [source, setSource] = useState(initialSource);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [_isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceMenuRef = useRef<HTMLDivElement>(null);

  const activeSource =
    SEARCH_SOURCES.find((s) => s.id === source) ?? (SEARCH_SOURCES[0] as SearchSourceOption);

  // Close source menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(e.target as Node)) {
        setShowSourceMenu(false);
      }
    };
    if (showSourceMenu) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
    return undefined;
  }, [showSourceMenu]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed || trimmed.length < 2) return;

      if (onSearch) {
        onSearch(trimmed, source);
      } else {
        const params = new URLSearchParams({ q: trimmed });
        if (source !== 'all') params.set('source', source);
        router.push(
          `/video?search=${encodeURIComponent(trimmed)}${source !== 'all' ? `&source=${source}` : ''}`,
        );
      }
    },
    [query, source, router, onSearch],
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      inputRef.current?.blur();
      setShowSourceMenu(false);
    }
  }, []);

  return (
    <form onSubmit={handleSubmit} className={`relative flex items-center ${className}`}>
      {/* Search icon */}
      <div className="pointer-events-none absolute left-3 z-10 text-[var(--color-muted)]">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] pl-10 pr-28 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] transition-all focus:border-degen-500/40 focus:outline-none focus:ring-1 focus:ring-degen-500/20"
        aria-label="Search videos"
      />

      {/* Source filter */}
      <div className="absolute right-2" ref={sourceMenuRef}>
        <button
          type="button"
          onClick={() => setShowSourceMenu((prev) => !prev)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeSource.color }} />
          <span>{activeSource.label}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className={`transition-transform ${showSourceMenu ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {/* Dropdown */}
        {showSourceMenu && (
          <div className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl">
            {SEARCH_SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSource(s.id);
                  setShowSourceMenu(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--color-overlay)] ${
                  source === s.id ? 'text-degen-400 bg-degen-500/10' : 'text-[var(--color-muted)]'
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
