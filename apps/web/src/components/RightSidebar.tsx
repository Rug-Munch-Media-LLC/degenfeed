'use client';

import Link from 'next/link';
import { memo } from 'react';

/* === Trending topics ======================================== */

interface TrendingTopic {
  tag: string;
  posts: string;
  category: string;
}

const TRENDING_TOPICS: TrendingTopic[] = [
  { tag: '#Bitcoin', posts: '124K posts', category: 'Crypto' },
  { tag: '#Solana', posts: '89K posts', category: 'Crypto' },
  { tag: '#Ethereum', posts: '72K posts', category: 'Crypto' },
  { tag: '#AI', posts: '56K posts', category: 'Technology' },
  { tag: '#DeFi', posts: '34K posts', category: 'Crypto' },
  { tag: '#Nostr', posts: '28K posts', category: 'Protocol' },
  { tag: '#Farcaster', posts: '22K posts', category: 'Protocol' },
  { tag: '#Web3', posts: '18K posts', category: 'Technology' },
];

/* === Who to follow ========================================== */

interface FollowSuggestion {
  handle: string;
  name: string;
  protocol: string;
}

const FOLLOW_SUGGESTIONS: FollowSuggestion[] = [
  { handle: '@jack', name: 'Jack Dorsey', protocol: 'Nostr' },
  { handle: '@balajis', name: 'Balaji S.', protocol: 'Farcaster' },
  { handle: '@preethi', name: 'Preethi K.', protocol: 'Lens' },
];

/* === Live now =============================================== */

interface LiveSpace {
  name: string;
  host: string;
  listeners: string;
  color: string;
}

const LIVE_SPACES: LiveSpace[] = [
  { name: 'Crypto AMA with Vitalik', host: '@vitalik.eth', listeners: '2.3K', color: '#8b5cf6' },
  { name: 'Solana Ecosystem Call', host: '@solana', listeners: '1.8K', color: '#00ff41' },
  { name: 'DeFi Deep Dive', host: '@defi_dad', listeners: '892', color: '#3b82f6' },
];

/* === Footer links =========================================== */

const FOOTER_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/docs', label: 'Docs' },
  { href: '/api-docs', label: 'API' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/status', label: 'Status' },
  { href: 'https://git.rugmunch.io/RugMunchMedia/degenfeed-web', label: 'Source' },
];

/* === Search bar ============================================= */

function SearchBar() {
  return (
    <div className="relative">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="search"
        placeholder="Search DegenFeed"
        className="w-full rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] py-2.5 pl-11 pr-4 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] outline-none transition-colors focus:border-degen-500/50 focus:ring-1 focus:ring-degen-500/20"
        aria-label="Search DegenFeed"
      />
    </div>
  );
}

/* === Trending card ========================================== */

function TrendingCard() {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
      <h2 className="px-4 pt-3 pb-2 text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
        Trending
      </h2>
      <div className="divide-y divide-[var(--color-glass-border)]">
        {TRENDING_TOPICS.slice(0, 5).map((topic) => (
          <Link
            key={topic.tag}
            href={`/search?q=${encodeURIComponent(topic.tag)}`}
            className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-[var(--color-overlay)]"
          >
            <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
              {topic.category} · Trending
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
              {topic.tag}
            </span>
            <span className="text-[11px] text-[var(--color-muted)]">{topic.posts}</span>
          </Link>
        ))}
      </div>
      <Link
        href="/trending"
        className="block px-4 py-3 text-sm text-degen-400 transition-colors hover:bg-[var(--color-overlay)] rounded-b-xl"
        aria-label="View all trending topics"
      >
        Show more
      </Link>
    </div>
  );
}

/* === Who to follow card ===================================== */

function WhoToFollowCard() {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
      <h2 className="px-4 pt-3 pb-2 text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
        Who to follow
      </h2>
      <div className="divide-y divide-[var(--color-glass-border)]">
        {FOLLOW_SUGGESTIONS.map((person) => (
          <div
            key={person.handle}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-overlay)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-degen-500/10 text-sm font-bold text-degen-400">
              {person.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-fg)' }}>
                {person.name}
              </div>
              <div className="text-xs truncate text-[var(--color-muted)]">
                {person.handle} · {person.protocol}
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full bg-[var(--color-fg)] px-4 py-1.5 text-xs font-bold text-[var(--color-bg)] transition-all hover:opacity-80 active:scale-95"
            >
              Follow
            </button>
          </div>
        ))}
      </div>
      <Link
        href="/discover"
        className="block px-4 py-3 text-sm text-degen-400 transition-colors hover:bg-[var(--color-overlay)] rounded-b-xl"
        aria-label="View more people to follow"
      >
        Show more
      </Link>
    </div>
  );
}

/* === Live now card ========================================== */

function LiveNowCard() {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-degen-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-degen-500" />
        </span>
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
          Live now
        </h2>
      </div>
      <div className="divide-y divide-[var(--color-glass-border)]">
        {LIVE_SPACES.map((space) => (
          <Link
            key={space.name}
            href="/spaces"
            className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-overlay)]"
          >
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
              style={{ backgroundColor: `${space.color}18`, color: space.color }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" />
                <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-fg)' }}>
                {space.name}
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                <span className="truncate">{space.host}</span>
                <span className="shrink-0">·</span>
                <span className="shrink-0">{space.listeners} listening</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/spaces"
        className="block px-4 py-3 text-sm text-degen-400 transition-colors hover:bg-[var(--color-overlay)] rounded-b-xl"
        aria-label="View all live spaces"
      >
        View all spaces
      </Link>
    </div>
  );
}

/* === Premium CTA ============================================ */

function PremiumCta() {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-gradient-to-br from-degen-500/5 to-transparent p-4">
      <div className="flex items-center gap-2 mb-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2l2 4 4 .5-3 3.5 1 5L12 11.5 8 14l1-5-3-3.5 4-.5L12 2z"
            fill="var(--color-accent)"
          />
        </svg>
        <h2 className="text-base font-bold" style={{ color: 'var(--color-fg)' }}>
          Premium
        </h2>
      </div>
      <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-muted)' }}>
        Unlock advanced features, cross-protocol analytics, and priority support.
      </p>
      <Link
        href="/premium"
        className="inline-flex items-center gap-1 rounded-full bg-degen-500/20 px-4 py-2 text-xs font-semibold text-degen-400 transition-all hover:bg-degen-500/30 active:scale-95"
      >
        Learn More
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M6 4l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </div>
  );
}

/* === Footer nav ============================================= */

function SidebarFooter() {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 px-1">
      {FOOTER_LINKS.map((link) =>
        link.href.startsWith('http') ? (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--color-muted)] transition-colors hover:underline"
          >
            {link.label}
          </a>
        ) : (
          <Link
            key={link.href}
            href={link.href}
            className="text-xs text-[var(--color-muted)] transition-colors hover:underline"
          >
            {link.label}
          </Link>
        ),
      )}
      <span className="text-xs text-[var(--color-muted)] opacity-50">
        &copy; {new Date().getFullYear()} DegenFeed
      </span>
    </div>
  );
}

/* === Main export ============================================ */

export const RightSidebar = memo(function RightSidebar() {
  return (
    <aside className="flex flex-col gap-4" aria-label="Sidebar">
      <div className="sticky top-20 z-10">
        <SearchBar />
      </div>
      <TrendingCard />
      <WhoToFollowCard />
      <LiveNowCard />
      <PremiumCta />
      <SidebarFooter />
    </aside>
  );
});
