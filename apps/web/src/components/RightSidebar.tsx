'use client';

import Link from 'next/link';
import { memo, useEffect, useState } from 'react';

/* === Trending topics ======================================== */

interface TrendingTopic {
  tag: string;
  posts: string;
  category: string;
}

/* === Live now =============================================== */

interface LiveSpace {
  name: string;
  host: string;
  listeners: string;
  color: string;
}

interface LiveStreamItem {
  title?: string;
  name?: string;
  host?: string;
  hostName?: string;
  viewerCount?: number;
  listeners?: number;
  streamer?: { displayName?: string };
  category?: string;
  source?: string;
}

/* === Footer links =========================================== */

const FOOTER_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/protocols', label: 'Protocols' },
  { href: '/faq', label: 'FAQ' },
  { href: '/docs', label: 'Docs' },
  { href: '/api-docs', label: 'API' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/status', label: 'Status' },
  { href: 'https://git.rugmunch.io/RugMunchMedia/degenfeed', label: 'Source' },
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
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/trending/hashtags', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ topics?: TrendingTopic[] }>) : { topics: [] }))
      .then((data) => {
        if (!cancelled) setTopics(data.topics ?? []);
      })
      .catch(() => {
        if (!cancelled) setTopics([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
      <h2 className="px-4 pt-3 pb-2 text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
        Trending
      </h2>
      {!loaded ? (
        <div className="space-y-2 px-4 py-3">
          {[...Array(4)].map(() => (
            <div
              key={crypto.randomUUID()}
              className="h-10 animate-pulse rounded-md bg-white/[0.04]"
            />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <p className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted)' }}>
          No trending data right now.
        </p>
      ) : (
        <div className="divide-y divide-[var(--color-glass-border)]">
          {topics.map((topic) => (
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
      )}
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
      <p className="px-4 pb-4 text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>
        Follow suggestions are coming soon.
      </p>
      <Link
        href="/discover"
        className="block px-4 py-3 text-sm text-degen-400 transition-colors hover:bg-[var(--color-overlay)] rounded-b-xl"
        aria-label="Discover people to follow"
      >
        Discover
      </Link>
    </div>
  );
}

/* === Live now card ========================================== */

function LiveNowCard() {
  const [streams, setStreams] = useState<LiveSpace[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/streams/live', { credentials: 'include' })
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{ streams?: LiveStreamItem[]; total?: number }>)
          : { streams: [] },
      )
      .then((data) => {
        if (cancelled) return;
        const items = (data.streams ?? []).map((s) => ({
          name: s.title ?? s.name ?? 'Untitled stream',
          host: s.streamer?.displayName ?? s.host ?? s.hostName ?? 'unknown',
          listeners: String(s.viewerCount ?? s.listeners ?? 0),
          color: '#8b5cf6',
        }));
        setStreams(items);
      })
      .catch(() => {
        if (!cancelled) setStreams([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      {!loaded ? (
        <div className="space-y-2 px-4 py-3">
          {[...Array(2)].map(() => (
            <div
              key={crypto.randomUUID()}
              className="h-10 animate-pulse rounded-md bg-white/[0.04]"
            />
          ))}
        </div>
      ) : streams.length === 0 ? (
        <p className="px-4 pb-4 text-xs" style={{ color: 'var(--color-muted)' }}>
          No live spaces right now.
        </p>
      ) : (
        <div className="divide-y divide-[var(--color-glass-border)]">
          {streams.map((space) => (
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
                <div
                  className="text-sm font-semibold truncate"
                  style={{ color: 'var(--color-fg)' }}
                >
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
      )}
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
