'use client';

import { formatTimeAgo } from '@degenfeed/utils';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// === Types =========================================================

interface GhostPost {
  id: string;
  slug: string;
  title: string;
  html: string;
  excerpt: string;
  featuredImage?: string;
  readingTime: number;
  publishedAt: string;
  tags: string[];
  authors: { name: string; avatar: string }[];
  tippedAmount: string;
  subscriberOnly: boolean;
  minTokenHold?: string;
}

// === Article Card ==================================================

function ArticleCard({ post }: { post: GhostPost }) {
  return (
    <Link
      href={`/articles/${post.slug}`}
      className="group block overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] transition-all hover:border-[var(--color-accent)]/30 hover:shadow-lg hover:shadow-[var(--color-accent)]/5"
    >
      {post.featuredImage && (
        <div className="aspect-video overflow-hidden">
          <img
            src={post.featuredImage}
            alt={post.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <div className="p-5">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {post.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]"
            >
              #{tag}
            </span>
          ))}
          {post.subscriberOnly && (
            <span className="rounded-full bg-[#f5a623]/10 px-2 py-0.5 text-[10px] text-[#f5a623]">
              🔒
            </span>
          )}
        </div>

        <h2 className="mb-2 text-base font-semibold leading-snug text-[var(--color-fg)] group-hover:text-[var(--color-accent)] transition-colors">
          {post.title}
        </h2>

        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-[var(--color-muted)]">
          {post.excerpt || post.html.replace(/<[^>]+>/g, '').slice(0, 200)}
        </p>

        <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
          <div className="flex items-center gap-2">
            {post.authors.length > 0 && <span>{post.authors[0]?.name}</span>}
            <span>·</span>
            <span>{post.readingTime} min read</span>
          </div>
          <span>{formatTimeAgo(new Date(post.publishedAt).getTime())}</span>
        </div>

        {Number(post.tippedAmount) > 0 && (
          <div className="mt-3 rounded-md bg-[var(--color-success)]/5 px-2.5 py-1.5 text-xs text-[var(--color-success)]">
            ✦ {post.tippedAmount} in tips
          </div>
        )}
      </div>
    </Link>
  );
}

// === Loading Grid ==================================================

function LoadingGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
        >
          <div className="mb-3 h-32 rounded-lg bg-[var(--color-border)]" />
          <div className="mb-2 h-5 w-3/4 rounded bg-[var(--color-border)]" />
          <div className="mb-1 h-3 w-full rounded bg-[var(--color-border)]" />
          <div className="mb-4 h-3 w-2/3 rounded bg-[var(--color-border)]" />
          <div className="h-3 w-1/3 rounded bg-[var(--color-border)]" />
        </div>
      ))}
    </div>
  );
}

// === Newsletter Banner =============================================

function NewsletterBanner() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ghost/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tier: 'free' }),
      });
      if (res.ok) setSubscribed(true);
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-6 text-center">
        <p className="text-sm font-medium text-[var(--color-accent)]">✓ Subscribed!</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">Check your inbox for confirmation.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-gradient-to-r from-[var(--color-card)] to-[var(--color-bg-secondary)] p-6 md:p-8">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">
          📫 Never Miss an Article
        </h2>
        <p className="mb-5 text-sm text-[var(--color-muted)]">
          Get the best of web3, AI, and crypto delivered to your inbox. Free + Premium tiers
          available.
        </p>
        <form onSubmit={handleSubscribe} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {loading ? '...' : 'Subscribe Free'}
          </button>
        </form>
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          <a href="/premium" className="text-[var(--color-accent)] hover:underline">
            Upgrade to Premium
          </a>{' '}
          for exclusive deep dives
        </p>
      </div>
    </div>
  );
}

// === Filter Bar ====================================================

function FilterBar({
  tags,
  selectedTag,
  onSelectTag,
}: {
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}) {
  const uniqueTags = [...new Set(tags)].sort();

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelectTag(null)}
        className={`rounded-full px-3 py-1 text-xs transition-colors ${
          selectedTag === null
            ? 'bg-[var(--color-accent)] text-black'
            : 'border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border)]'
        }`}
      >
        All
      </button>
      {uniqueTags.map((tag) => (
        <button
          type="button"
          key={tag}
          onClick={() => onSelectTag(tag)}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            selectedTag === tag
              ? 'bg-[var(--color-accent)] text-black'
              : 'border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border)]'
          }`}
        >
          #{tag}
        </button>
      ))}
    </div>
  );
}

// === Main Page =====================================================

export default function ArticlesPage() {
  const [posts, setPosts] = useState<GhostPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/ghost/posts?limit=50');
        if (!res.ok) throw new Error('Failed to load articles');
        const data = (await res.json()) as { posts: GhostPost[]; meta: { total: number } };
        setPosts(data.posts);
        // Collect all unique tags
        const tags = new Set<string>();
        for (const p of data.posts) {
          for (const t of p.tags) tags.add(t);
        }
        setAllTags([...tags]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const filteredPosts = selectedTag ? posts.filter((p) => p.tags.includes(selectedTag)) : posts;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--color-fg)]">Articles</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Long-form analysis, deep dives, and exclusive content from DegenFeed
        </p>
      </header>

      {/* Filters */}
      {allTags.length > 0 && (
        <div className="mb-8">
          <FilterBar tags={allTags} selectedTag={selectedTag} onSelectTag={setSelectedTag} />
        </div>
      )}

      {/* Newsletter Banner */}
      <div className="mb-8">
        <NewsletterBanner />
      </div>

      {/* Article Grid */}
      {loading ? (
        <LoadingGrid />
      ) : error ? (
        <div className="rounded-xl border border-[var(--color-border)] p-8 text-center">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black"
          >
            Retry
          </button>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] p-8 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            No articles found{selectedTag ? ` with tag #${selectedTag}` : ''}.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPosts.map((post) => (
              <ArticleCard key={post.id} post={post} />
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-[var(--color-muted)]">
            Showing {filteredPosts.length} of {posts.length} articles
          </p>
        </>
      )}
    </div>
  );
}
