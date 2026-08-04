'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SearchResult {
  title: string;
  href: string;
  section: string;
  content: string;
  matchStart: number;
  matchEnd: number;
}

const searchIndex: { title: string; href: string; section: string; content: string }[] = [
  // Quickstart
  {
    title: 'Quickstart Guide',
    href: '/docs/quickstart',
    section: 'Getting Started',
    content:
      '5-minute getting started guide. Connect wallet, link protocol, browse feed, make first post, tip a creator.',
  },
  {
    title: 'Step 1: Connect Wallet',
    href: '/docs/quickstart#connect-wallet',
    section: 'Getting Started',
    content:
      'Connect your Solana or EVM wallet to DegenFeed. Supports Phantom, Backpack, Solflare, MetaMask, Rainbow, WalletConnect.',
  },
  {
    title: 'Step 2: Link First Protocol',
    href: '/docs/quickstart#link-protocol',
    section: 'Getting Started',
    content: 'Link your first social protocol. Nostr, Farcaster, Lens, Bluesky, or Mastodon.',
  },
  {
    title: 'Step 3: Browse Feed',
    href: '/docs/quickstart#browse-feed',
    section: 'Getting Started',
    content: 'Browse your aggregated feed. See posts from all connected protocols in one timeline.',
  },
  {
    title: 'Step 4: First Post',
    href: '/docs/quickstart#first-post',
    section: 'Getting Started',
    content:
      'Make your first cross-protocol post. Publish to Nostr, Farcaster, Lens, Bluesky, and Mastodon simultaneously.',
  },
  {
    title: 'Step 5: Tip a Creator',
    href: '/docs/quickstart#tip-creator',
    section: 'Getting Started',
    content: 'Send a crypto tip to a creator. Supports ETH, SOL, USDC, and Lightning Network zaps.',
  },

  // API Reference
  {
    title: 'API Reference',
    href: '/docs/api',
    section: 'API Reference',
    content:
      'Full API reference for DegenFeed. Authentication, rate limits, feed endpoints, tipping, identity, search.',
  },
  {
    title: 'API Authentication',
    href: '/docs/api#authentication',
    section: 'API Reference',
    content:
      'API authentication methods. Public read endpoints, API keys, rate limits, session auth.',
  },
  {
    title: 'Feed Endpoints',
    href: '/docs/api#feed-endpoints',
    section: 'API Reference',
    content:
      'Feed API endpoints. Home feed, trending, news, stream, per-protocol, category, post details.',
  },
  {
    title: 'Tipping Endpoints',
    href: '/docs/api#tipping-endpoints',
    section: 'API Reference',
    content: 'Tipping API endpoints. Create tips, resolve methods, Lightning invoices.',
  },
  {
    title: 'Identity Endpoints',
    href: '/docs/api#identity-endpoints',
    section: 'API Reference',
    content:
      'Identity and auth API endpoints. Wallet auth, session management, profile resolution.',
  },
  {
    title: 'Search Endpoints',
    href: '/docs/api#search-endpoints',
    section: 'API Reference',
    content: 'Search API endpoints. Cross-protocol text search, identity search.',
  },
  {
    title: 'Error Codes',
    href: '/docs/api#error-codes',
    section: 'API Reference',
    content:
      'API error codes reference. 400 Bad Request, 401 Unauthorized, 429 Rate Limited, 500 Internal Error.',
  },
  {
    title: 'API Rate Limits',
    href: '/docs/api#rate-limits',
    section: 'API Reference',
    content:
      'API rate limits. 60 requests per 5-second window per IP. Higher limits for authenticated sessions.',
  },

  // User Guide
  {
    title: 'User Guide',
    href: '/docs/user-guide',
    section: 'User Guide',
    content:
      'Complete user guide. Wallet setup, posting, tipping, communities, messages, spaces, analytics, settings.',
  },
  {
    title: 'Wallet Setup',
    href: '/docs/user-guide#getting-started',
    section: 'User Guide',
    content: 'Set up your wallet. Connect Solana and EVM wallets.',
  },
  {
    title: 'Cross-Protocol Posting',
    href: '/docs/user-guide#posting-engagement',
    section: 'User Guide',
    content: 'Post across multiple protocols simultaneously.',
  },
  {
    title: 'Tipping',
    href: '/docs/user-guide#tipping-monetization',
    section: 'User Guide',
    content: 'Send and receive crypto tips. ETH, SOL, USDC, Lightning.',
  },

  // Protocols
  {
    title: 'Protocol Integration Guide',
    href: '/docs/protocols',
    section: 'Protocols',
    content:
      'Protocol integration guide. How each protocol is integrated, data fetched, limitations.',
  },
  {
    title: 'Nostr Integration',
    href: '/docs/protocols#nostr',
    section: 'Protocols',
    content:
      'Nostr protocol integration. WebSocket relay connection, Kind 1 notes, NIP-05, NIP-07, NIP-46.',
  },
  {
    title: 'Farcaster Integration',
    href: '/docs/protocols#farcaster',
    section: 'Protocols',
    content: 'Farcaster protocol integration. Hub API, protobuf messages, Ed25519 signatures.',
  },
  {
    title: 'Bluesky Integration',
    href: '/docs/protocols#bluesky',
    section: 'Protocols',
    content: 'Bluesky/AT Protocol integration. XRPC methods, DID identity, PDS.',
  },
  {
    title: 'Adding New Protocols',
    href: '/docs/protocols#adding-new-protocols',
    section: 'Protocols',
    content: 'How to add a new protocol to DegenFeed. Provider interface, normalization, testing.',
  },

  // Architecture
  {
    title: 'System Architecture',
    href: '/docs/architecture',
    section: 'Architecture',
    content:
      'System architecture overview. Next.js frontend, Cloudflare Workers, providers, data flow.',
  },
  {
    title: 'Data Flow',
    href: '/docs/architecture#data-flow',
    section: 'Architecture',
    content:
      'Data flow from protocol to feed to user. Provider polling, caching, ranking, rendering.',
  },
  {
    title: 'KV Storage',
    href: '/docs/architecture#kv-storage',
    section: 'Architecture',
    content: 'KV storage schema. Feed cache, post store, rate limiting, subscriptions.',
  },
  {
    title: 'Deployment Architecture',
    href: '/docs/architecture#deployment',
    section: 'Architecture',
    content: 'Deployment architecture. Cloudflare Pages, Workers, KV, CI/CD.',
  },

  // Contributing
  {
    title: 'Contributing Guide',
    href: '/docs/contributing',
    section: 'Contributing',
    content: 'How to contribute to DegenFeed. Development setup, code style, PR process, testing.',
  },
  {
    title: 'Development Setup',
    href: '/docs/contributing#development-setup',
    section: 'Contributing',
    content: 'Set up your local development environment. Clone, install, configure.',
  },
  {
    title: 'Code Style',
    href: '/docs/contributing#code-style',
    section: 'Contributing',
    content: 'Code style guide. TypeScript, Biome, naming conventions, component patterns.',
  },
  {
    title: 'PR Process',
    href: '/docs/contributing#pr-process',
    section: 'Contributing',
    content: 'Pull request process. Branch naming, commit messages, review requirements.',
  },
  {
    title: 'Testing Guide',
    href: '/docs/contributing#testing',
    section: 'Contributing',
    content: 'Testing guide. Unit tests, integration tests, E2E tests.',
  },

  // Changelog
  {
    title: 'Changelog',
    href: '/docs/changelog',
    section: 'Changelog',
    content: 'Release history and changelog for DegenFeed.',
  },
  {
    title: 'v0.2.0',
    href: '/docs/changelog#v020',
    section: 'Changelog',
    content: 'Version 0.2.0. Cross-protocol posting, tipping, Farcaster Frames, audio Spaces.',
  },
  {
    title: 'v0.1.0',
    href: '/docs/changelog#v010',
    section: 'Changelog',
    content:
      'Version 0.1.0. Initial release. Multi-protocol feed, Nostr, Farcaster, Lens, Bluesky.',
  },

  // Troubleshooting
  {
    title: 'Troubleshooting Guide',
    href: '/docs/troubleshooting',
    section: 'Troubleshooting',
    content: 'Troubleshooting common issues. Empty feed, publishing problems, tipping issues.',
  },

  // Platform Comparison
  {
    title: 'Platform Comparison',
    href: '/docs/comparison',
    section: 'Comparison',
    content: 'Compare DegenFeed to Twitter/X, Farcaster, Lens, and Bluesky.',
  },

  // Self-hosting / landing page sections
  {
    title: 'Ranking Algorithm',
    href: '/docs#ranking',
    section: 'DegenFeed',
    content:
      'Transparent 7-factor ranking algorithm. Recency, engagement, relevance, quality, diversity, source, velocity.',
  },
  {
    title: 'Self-Hosting',
    href: '/docs#self-hosting',
    section: 'DegenFeed',
    content: 'Self-host DegenFeed. MIT licensed. Cloudflare Pages and Workers deployment.',
  },
  {
    title: 'Environment Variables',
    href: '/docs#env',
    section: 'DegenFeed',
    content: 'Environment variables configuration. AUTH_SECRET, RELAY_URLS, API keys.',
  },
];

export function DocSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on route change
  useEffect(() => {
    setOpen(false);
    setQuery('');
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const active = document.activeElement;
        if (active?.tagName !== 'INPUT' && active?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setOpen(true);
        }
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const found: SearchResult[] = [];

    for (const item of searchIndex) {
      const titleIdx = item.title.toLowerCase().indexOf(q);
      const contentIdx = item.content.toLowerCase().indexOf(q);

      if (titleIdx !== -1 || contentIdx !== -1) {
        found.push({
          ...item,
          matchStart: titleIdx !== -1 ? titleIdx : contentIdx + item.title.length + 1,
          matchEnd:
            titleIdx !== -1 ? titleIdx + q.length : contentIdx + q.length + item.title.length + 1,
        });
      }

      if (found.length >= 10) break;
    }

    // Group by section
    found.sort((a, b) => {
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.title.localeCompare(b.title);
    });

    setResults(found);
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        window.location.href = results[selectedIndex].href;
        setOpen(false);
      }
    },
    [results, selectedIndex],
  );

  // Group results by section
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.section]) acc[r.section] = [];
    acc[r.section].push(r);
    return acc;
  }, {});

  return (
    <>
      {/* Search trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] px-3 py-2 text-sm text-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:text-[var(--color-muted)]"
        aria-label="Search documentation"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          role="img"
          aria-labelledby="search-docs-title"
        >
          <title id="search-docs-title">Search</title>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="flex-1 text-left">Search docs...</span>
        <kbd className="hidden rounded border border-[var(--color-glass-border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted)] sm:inline-block">
          /
        </kbd>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-[var(--color-glass-border)] px-4 py-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[var(--color-muted)]"
                role="img"
                aria-labelledby="search-icon-title"
              >
                <title id="search-icon-title">Search documentation</title>
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search documentation..."
                className="flex-1 bg-transparent text-sm text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)]"
                aria-label="Search documentation"
              />
              <kbd className="rounded border border-[var(--color-glass-border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted)]">
                ESC
              </kbd>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="max-h-80 overflow-y-auto p-2">
                {Object.entries(grouped).map(([section, items]) => (
                  <div key={section} className="mb-2">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      {section}
                    </div>
                    {items.map((item, _i) => {
                      const globalIdx = results.indexOf(item);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                            globalIdx === selectedIndex
                              ? 'bg-degen-500/10 text-degen-400'
                              : 'text-[var(--color-muted)] hover:bg-white/[0.03]'
                          }`}
                        >
                          <span className="flex-1 truncate">{item.title}</span>
                          <span className="flex-shrink-0 text-[10px] text-[var(--color-muted)]">
                            {item.section}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {query.trim() && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                No results found for &ldquo;{query}&rdquo;
              </div>
            )}

            {!query.trim() && (
              <div className="px-4 py-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
                  Popular searches
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    'API',
                    'connect wallet',
                    'tip',
                    'Nostr',
                    'Farcaster',
                    'post',
                    'quickstart',
                    'rate limit',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setQuery(tag)}
                      className="rounded-lg border border-[var(--color-glass-border)] px-2.5 py-1 text-xs text-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:text-degen-400"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-4 border-t border-[var(--color-glass-border)] px-4 py-2 text-[10px] text-[var(--color-muted)]">
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
              <span>ESC Close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
