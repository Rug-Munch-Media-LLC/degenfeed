'use client';

/**
 * @degenfeed/web — /social
 *
 * GoToSocial (GTS) Embedded — Federated Microblogging
 *
 * Shows real-time content from the DegenFeed GoToSocial instance
 * at social.degenfeed.xyz. Fetches live posts via the bridge API.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────────────

interface GTSInstance {
  name: string;
  description: string;
  url: string;
  users: number;
  posts: number;
  category: string;
  featured: boolean;
  language: string;
  local: boolean;
}

interface MastodonPost {
  id: string;
  protocol: string;
  author: {
    displayName: string;
    handles: Record<string, string>;
    avatarUrl: string;
    bio: string;
    followerCount: number;
  };
  text: string;
  html: string;
  createdAt: number;
  metrics: {
    likes: number;
    reposts: number;
    replies: number;
  };
  niches: string[];
}

interface FeedResponse {
  data?: MastodonPost[];
  posts?: MastodonPost[];
  meta: {
    total: number;
    perProtocol?: Record<string, number>;
    fetchedAt: number;
  };
}

// ─── Constants ──────────────────────────────────────────────────────────

const GTS_COLOR = '#6366f1';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://degenfeed.xyz/api';

const INSTANCES: GTSInstance[] = [
  {
    name: 'social.degenfeed.xyz',
    description: 'Official DegenFeed GoToSocial instance — crypto, web3, fediverse',
    url: 'https://social.degenfeed.xyz',
    users: 1,
    posts: 13,
    category: 'Crypto/Web3',
    featured: true,
    language: 'English',
    local: true,
  },
  {
    name: 'mastodon.social',
    description: 'Flagship Mastodon instance — largest fediverse server',
    url: 'https://mastodon.social',
    users: 950000,
    posts: 15000000,
    category: 'General',
    featured: true,
    language: 'Multi',
    local: false,
  },
  {
    name: 'fosstodon.org',
    description: 'FOSS community — free and open source software',
    url: 'https://fosstodon.org',
    users: 45000,
    posts: 1200000,
    category: 'Tech',
    featured: true,
    language: 'English',
    local: false,
  },
  {
    name: 'hachyderm.io',
    description: 'Tech/DevOps focused — engineers and sysadmins',
    url: 'https://hachyderm.io',
    users: 52000,
    posts: 980000,
    category: 'Tech',
    featured: false,
    language: 'English',
    local: false,
  },
  {
    name: 'infosec.exchange',
    description: 'InfoSec / cybersecurity community',
    url: 'https://infosec.exchange',
    users: 38000,
    posts: 750000,
    category: 'Security',
    featured: false,
    language: 'English',
    local: false,
  },
  {
    name: 'bitcoinhackers.org',
    description: 'Bitcoin and crypto community fediverse',
    url: 'https://bitcoinhackers.org',
    users: 12000,
    posts: 310000,
    category: 'Crypto/Web3',
    featured: false,
    language: 'English',
    local: false,
  },
  {
    name: 'mas.to',
    description: 'General purpose — inclusive community',
    url: 'https://mas.to',
    users: 78000,
    posts: 2100000,
    category: 'General',
    featured: false,
    language: 'Multi',
    local: false,
  },
];

const CATEGORIES = Array.from(new Set(INSTANCES.map((i) => i.category)));

// ─── Page ───────────────────────────────────────────────────────────────

export default function SocialPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  // Live feed state
  const [feedPosts, setFeedPosts] = useState<MastodonPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);

  // Fetch live GTS/Mastodon feed via the bridge API
  useEffect(() => {
    let cancelled = false;
    setFeedLoading(true);
    setFeedError(null);

    async function loadFeed() {
      try {
        const res = await fetch(`${API_BASE}/feed/unified?sources=mastodon&limit=20`, {
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data: FeedResponse = await res.json();
        if (!cancelled) {
          setFeedPosts(data.data || data.posts || []);
        }
      } catch (err) {
        if (!cancelled) {
          setFeedError(err instanceof Error ? err.message : 'Failed to load feed');
        }
      } finally {
        if (!cancelled) setFeedLoading(false);
      }
    }

    loadFeed();
    // Refresh every 60 seconds
    const interval = setInterval(loadFeed, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const filtered = INSTANCES.filter((inst) => {
    if (activeCategory && inst.category !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        inst.name.toLowerCase().includes(q) ||
        inst.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleBrowse = useCallback((inst: GTSInstance) => {
    setEmbedUrl(inst.url);
  }, []);

  const handleBack = useCallback(() => {
    setEmbedUrl(null);
  }, []);

  // ─── Embedded view ────────────────────────────────────────────────

  if (embedUrl) {
    const instance = INSTANCES.find((i) => i.url === embedUrl)!;
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={handleBack}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--color-overlay-hover)]"
          style={{ color: 'var(--color-muted)' }}
        >
          ← Back to Social
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>
            {instance.name}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
            {instance.description}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs" style={{ color: 'var(--color-muted)' }}>
            <span>{instance.users.toLocaleString()} users</span>
            <span>{instance.posts.toLocaleString()} posts</span>
            <span>{instance.language}</span>
          </div>
        </div>

        {/* Embed the GTS instance */}
        <div
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: 'var(--color-glass-border)', height: '80vh' }}
        >
          <iframe
            src={instance.url}
            title={instance.name}
            className="h-full w-full"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            style={{ background: '#fff' }}
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  // ─── Directory view ───────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
        <Link href="/feed" className="transition-colors hover:text-[var(--color-fg)]">Feed</Link>
        <span className="opacity-40">/</span>
        <span style={{ color: 'var(--color-fg-secondary)' }}>Social</span>
      </nav>

      {/* Hero */}
      <header
        className="relative mb-8 overflow-hidden rounded-2xl border p-6 sm:p-8"
        style={{
          borderColor: `${GTS_COLOR}33`,
          background: `linear-gradient(135deg, ${GTS_COLOR}10 0%, var(--color-card) 60%)`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-[0.06] blur-3xl"
          style={{ backgroundColor: GTS_COLOR }}
          aria-hidden="true"
        />
        <div className="flex items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
            style={{
              backgroundColor: `${GTS_COLOR}18`,
              boxShadow: `0 0 24px ${GTS_COLOR}15`,
            }}
          >
            🐘
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--color-fg)' }}>
              Mastodon / ActivityPub
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
              Federated microblogging powered by GoToSocial. Browse real-time posts 
              from the fediverse — all inside DegenFeed.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wider uppercase"
                style={{
                  backgroundColor: `${GTS_COLOR}15`,
                  color: GTS_COLOR,
                }}
              >
                🐘 Powered by ActivityPub
              </span>
              <a
                href="https://gotosocial.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] underline underline-offset-2"
                style={{ color: 'var(--color-muted)' }}
              >
                About GoToSocial
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Live feed section */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
          🔴 Live Fediverse Feed
          {feedPosts.length > 0 && (
            <span className="ml-2 text-sm font-normal" style={{ color: 'var(--color-muted)' }}>
              ({feedPosts.length} posts)
            </span>
          )}
        </h2>

        {feedLoading && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border p-4"
                style={{ borderColor: 'var(--color-glass-border)' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-8 w-8 rounded-full bg-[var(--color-glass-border)]" />
                  <div className="h-4 w-32 rounded bg-[var(--color-glass-border)]" />
                </div>
                <div className="h-3 w-full rounded bg-[var(--color-glass-border)] mb-2" />
                <div className="h-3 w-3/4 rounded bg-[var(--color-glass-border)]" />
              </div>
            ))}
          </div>
        )}

        {feedError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            Failed to load live feed: {feedError}
          </div>
        )}

        {!feedLoading && !feedError && feedPosts.length === 0 && (
          <div
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-12"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <span className="mb-3 text-3xl">🐘</span>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              No posts available. Check back soon!
            </p>
          </div>
        )}

        {!feedLoading && feedPosts.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {feedPosts.slice(0, 10).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>

      {/* Search + filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="search"
            placeholder="Search instances..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border bg-[var(--color-card)] py-2.5 px-4 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] transition-colors focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--color-glass-border)',
              '--tw-ring-color': GTS_COLOR,
            } as React.CSSProperties}
            aria-label="Search social instances"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all"
          style={{
            borderColor: activeCategory === null ? GTS_COLOR : 'var(--color-glass-border)',
            backgroundColor: activeCategory === null ? `${GTS_COLOR}15` : 'transparent',
            color: activeCategory === null ? GTS_COLOR : 'var(--color-muted)',
          }}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all"
            style={{
              borderColor: activeCategory === cat ? GTS_COLOR : 'var(--color-glass-border)',
              backgroundColor: activeCategory === cat ? `${GTS_COLOR}15` : 'transparent',
              color: activeCategory === cat ? GTS_COLOR : 'var(--color-muted)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* All instances */}
      <section>
        <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
          {activeCategory || 'All Instances'}
          <span className="ml-2 text-sm font-normal" style={{ color: 'var(--color-muted)' }}>
            ({filtered.length})
          </span>
        </h2>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <span className="mb-3 text-3xl">🔍</span>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No instances match your search.</p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setActiveCategory(null); }}
              className="mt-3 rounded-lg px-4 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: `${GTS_COLOR}12`,
                color: GTS_COLOR,
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((inst) => (
              <InstanceCard key={inst.name} instance={inst} onBrowse={handleBrowse} color={GTS_COLOR} />
            ))}
          </div>
        )}
      </section>

      <footer className="mt-12 border-t py-8 text-center" style={{ borderColor: 'var(--color-glass-border)' }}>
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          Federated microblogging via ActivityPub. DegenFeed aggregates live content from the fediverse.
        </p>
      </footer>
    </div>
  );
}

// ─── Post Card ──────────────────────────────────────────────────────

function PostCard({ post }: { post: MastodonPost }) {
  const handle = post.author.handles?.mastodon || post.author.handles?.nostr || '';
  const timeAgo = getTimeAgo(post.createdAt);

  return (
    <article
      className="rounded-xl border p-4 transition-all hover:-translate-y-0.5"
      style={{
        borderColor: 'var(--color-glass-border)',
        backgroundColor: 'var(--color-card)',
      }}
    >
      <div className="flex items-start gap-3 mb-2">
        <div
          className="h-8 w-8 shrink-0 rounded-full bg-cover bg-center"
          style={{
            backgroundImage: post.author.avatarUrl
              ? `url(${post.author.avatarUrl})`
              : undefined,
            backgroundColor: post.author.avatarUrl ? 'transparent' : GTS_COLOR,
          }}
        >
          {!post.author.avatarUrl && (
            <span className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
              {post.author.displayName[0]?.toUpperCase() || '?'}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-fg)' }}>
              {post.author.displayName}
            </span>
            {handle && (
              <span className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
                @{handle}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider rounded-full px-1.5 py-0.5"
              style={{
                backgroundColor: `${GTS_COLOR}15`,
                color: GTS_COLOR,
              }}
            >
              {post.protocol}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
              {timeAgo}
            </span>
          </div>
        </div>
      </div>

      <p
        className="text-sm leading-relaxed line-clamp-4"
        style={{ color: 'var(--color-fg-secondary)' }}
        dangerouslySetInnerHTML={{ __html: post.html || escapeHtml(post.text) }}
      />

      <div className="mt-3 flex items-center gap-4 text-xs" style={{ color: 'var(--color-muted)' }}>
        <span>❤️ {post.metrics.likes}</span>
        <span>🔄 {post.metrics.reposts}</span>
        <span>💬 {post.metrics.replies}</span>
      </div>
    </article>
  );
}

// ─── Instance Card ──────────────────────────────────────────────────

function InstanceCard({
  instance,
  onBrowse,
  color,
}: {
  instance: GTSInstance;
  onBrowse: (inst: GTSInstance) => void;
  color: string;
}) {
  return (
    <article
      className="group relative overflow-hidden rounded-xl border p-5 transition-all duration-[var(--duration-normal)] hover:-translate-y-0.5"
      style={{
        borderColor: `${color}22`,
        backgroundColor: 'var(--color-card)',
      }}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity group-hover:opacity-100"
        style={{ boxShadow: `0 0 30px ${color}10` }}
        aria-hidden="true"
      />

      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
          style={{ backgroundColor: `${color}15` }}
        >
          🐘
        </span>
        <div className="min-w-0">
          <h3 className="font-bold" style={{ color: 'var(--color-fg)' }}>
            {instance.local && (
              <span className="mr-1.5 inline-flex items-center rounded-full bg-green-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-green-400">
                Local
              </span>
            )}
            {instance.name}
          </h3>
          <p className="mt-0.5 text-xs line-clamp-2" style={{ color: 'var(--color-fg-secondary)' }}>
            {instance.description}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 flex gap-4 text-xs">
        <div>
          <span className="font-mono font-bold" style={{ color }}>{instance.users.toLocaleString()}</span>
          <span className="ml-1" style={{ color: 'var(--color-muted)' }}>users</span>
        </div>
        <div>
          <span className="font-mono font-bold" style={{ color }}>{instance.posts.toLocaleString()}</span>
          <span className="ml-1" style={{ color: 'var(--color-muted)' }}>posts</span>
        </div>
        <div className="ml-auto font-mono text-[10px]" style={{ color: 'var(--color-muted)' }}>
          {instance.language}
        </div>
      </div>

      {/* Category tag + browse */}
      <div className="mt-4 flex items-center justify-between">
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-mono font-medium"
          style={{
            backgroundColor: `${color}10`,
            color,
          }}
        >
          {instance.category}
        </span>
        <button
          type="button"
          onClick={() => onBrowse(instance)}
          className="rounded-lg px-3.5 py-1.5 text-[11px] font-semibold transition-all active:scale-[0.98]"
          style={{ backgroundColor: color, color: '#fff' }}
        >
          Browse Instance
        </button>
      </div>
    </article>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
