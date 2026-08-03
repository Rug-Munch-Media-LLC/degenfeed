'use client';

/**
 * ProtocolQuickSwitcher — ⌘K-style palette for switching between protocols.
 *
 * Press ⌘K / Ctrl+K to open. Type to filter protocols and pages.
 * Navigate with arrow keys, select with Enter.
 */

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProtocolConnections } from '../hooks/useProtocolConnections';

interface QuickItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: string;
  color: string;
  type: 'protocol' | 'page' | 'action';
}

const PAGES: QuickItem[] = [
  {
    id: 'home',
    label: 'Home',
    description: 'Your home feed',
    href: '/feed',
    icon: '\u2302',
    color: '#00ff41',
    type: 'page',
  },
  {
    id: 'trending',
    label: 'Trending',
    description: "What's hot right now",
    href: '/trending',
    icon: '\u2B06',
    color: '#f97316',
    type: 'page',
  },
  {
    id: 'search',
    label: 'Search',
    description: 'Find people and posts',
    href: '/search',
    icon: '\u2315',
    color: '#6366f1',
    type: 'page',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Your alerts',
    href: '/notifications',
    icon: '\uD83D\uDD14',
    color: '#ec4899',
    type: 'page',
  },
  {
    id: 'messages',
    label: 'Messages',
    description: 'Direct messages',
    href: '/messages',
    icon: '\u2709',
    color: '#3b82f6',
    type: 'page',
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Preferences',
    href: '/settings',
    icon: '\u2699',
    color: '#6b7280',
    type: 'page',
  },
];

export interface QuickSwitcherProps {
  open: boolean;
  onClose: () => void;
}

export function ProtocolQuickSwitcher({ open, onClose }: QuickSwitcherProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { connections } = useProtocolConnections();

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const protocolItems: QuickItem[] = useMemo(
    () =>
      Object.entries(connections).map(([id, conn]) => ({
        id,
        label: conn.name,
        description: conn.connected ? `Connected as ${conn.handle ?? ''}` : 'Not connected',
        href: conn.route ?? `/${id}`,
        icon: conn.icon,
        color: conn.color,
        type: 'protocol' as const,
      })),
    [connections],
  );

  const allItems = useMemo(() => [...PAGES, ...protocolItems], [protocolItems]);

  const filtered = useMemo(
    () =>
      query.trim()
        ? allItems.filter(
            (item) =>
              item.label.toLowerCase().includes(query.toLowerCase()) ||
              item.description.toLowerCase().includes(query.toLowerCase()),
          )
        : allItems,
    [allItems, query],
  );

  const navigate = useCallback(
    (item: QuickItem) => {
      onClose();
      router.push(item.href);
    },
    [onClose, router],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[selectedIndex]) navigate(filtered[selectedIndex]);
          break;
      }
    },
    [filtered, selectedIndex, navigate],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className="fixed inset-x-4 top-[15%] z-[100] mx-auto max-w-lg animate-scale-in"
        role="dialog"
        aria-label="Quick switcher"
      >
        <div
          className="overflow-hidden rounded-2xl border border-[var(--color-glass-border)] shadow-2xl backdrop-blur-2xl"
          style={{ backgroundColor: 'var(--color-glass-bg, rgba(0,0,0,0.85))' }}
        >
          {/* Search input */}
          <div className="flex items-center border-b border-[var(--color-glass-border)] px-4">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
              style={{ color: 'var(--color-muted)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search protocols & pages..."
              className="flex-1 bg-transparent px-3 py-4 text-base outline-none placeholder:text-[var(--color-muted)]"
              style={{ color: 'var(--color-fg)' }}
              aria-label="Search protocols and pages"
            />
            <kbd
              className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] font-medium"
              style={{ color: 'var(--color-muted)' }}
            >
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto p-2">
            {filtered.length === 0 && (
              <div className="py-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
                No results for &quot;{query}&quot;
              </div>
            )}
            {filtered.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                  i === selectedIndex
                    ? 'bg-[var(--color-accent-glow)] scale-[1.02]'
                    : 'hover:bg-[var(--color-overlay)]'
                }`}
                style={
                  i === selectedIndex
                    ? { backgroundColor: `${item.color}18`, transform: 'scale(1.02)' }
                    : undefined
                }
              >
                {/* Icon */}
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                  style={{
                    backgroundColor: `${item.color}1a`,
                    color: item.color,
                  }}
                >
                  {item.icon}
                </span>
                {/* Label + desc */}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
                    {item.label}
                  </div>
                  <div className="truncate text-xs" style={{ color: 'var(--color-muted)' }}>
                    {item.description}
                  </div>
                </div>
                {/* Type badge */}
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${item.color}12`,
                    color: item.color,
                  }}
                >
                  {item.type}
                </span>
              </button>
            ))}
          </div>

          {/* Footer hint */}
          <div
            className="flex items-center gap-3 border-t border-[var(--color-glass-border)] px-4 py-2 text-[11px]"
            style={{ color: 'var(--color-muted)' }}
          >
            <span>
              <kbd className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px]">
                ↑↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px]">
                ↵
              </kbd>{' '}
              Open
            </span>
            <span className="ml-auto">
              <kbd className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px]">
                Esc
              </kbd>{' '}
              Close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
