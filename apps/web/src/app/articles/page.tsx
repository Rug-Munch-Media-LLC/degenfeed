'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatTimeAgo } from '@degenfeed/utils';

// ─── Types ─────────────────────────────────────────────────────────

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

// ─── Article Card ──────────────────────────────────────────────────

function ArticleCard({ post }: { post: GhostPost }) {
  return (
    <Link
      href={`/articles/${post.slug}`}
      className="group block overflow-hidden rounded-xl border border-[#1f2937] bg-[#111827] transition-all hover:border-[#00ff41]/30 hover:shadow-lg hover:shadow-[#00ff41]/5"
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
              className="rounded-full border border-[#374151] px-2 py-0.5 text-[10px] text-[#9ca3af]"
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

        <h2 className="mb-2 text-base font-semibold leading-snug text-[#e5e7eb] group-hover:text-[#00ff41] transition-colors">
          {post.title}
        </h2>

        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-[#9ca3af]">
          {post.excerpt || post.html.replace(/<[^>]+>/g, '').slice(0, 200)}
        </p>

        <div className="flex items-center justify-between text-xs text-[#6b7280]">
          <div className="flex items-center gap-2">
            {post.authors.length > 0 && (
              <span>{post.authors[0]!.name}</span>
            )}
            <span>·</span>
            <span>{post.readingTime} min read</span>
          </div>
          <span>{formatTimeAgo(new Date(post.publishedAt).getTime())}</span>
        </div>

        {Number(post.tippedAmount) > 0 && (
          <div className="mt-3 rounded-md bg-[#00ff41]/5 px-2.5 py-1.5 text-xs text-[#00ff41]">
            ✦ {post.tippedAmount} in tips
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Loading Grid ──────────────────────────────────────────────────

function LoadingGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-[#1f2937] bg-[#111827] p-5">
          <div className="mb-3 h-32 rounded-lg bg-[#1f2937]" />
          <div className="mb-2 h-5 w-3/4 rounded bg-[#1f2937]" />
          <div className="mb-1 h-3 w-full rounded bg-[#1f2937]" />
          <div className="mb-4 h-3 w-2/3 rounded bg-[#1f2937]" />
          <div className="h-3 w-1/3 rounded bg-[#1f2937]" />
        </div>
      ))}
    </div>
  );
}

// ─── Newsletter Banner ─────────────────────────────────────────────

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
      <div className="rounded-xl border border-[#00ff41]/30 bg-[#00ff41]/5 p-6 text-center">
        <p className="text-sm font-medium text-[#00ff41]">✓ Subscribed!</p>
        <p className="mt-1 text-xs text-[#9ca3af]">Check your inbox for confirmation.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1f2937] bg-gradient-to-r from-[#111827] to-[#0d1117] p-6 md:p-8">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="mb-2 text-lg font-semibold text-[#e5e7eb]">📫 Never Miss an Article</h2>
        <p className="mb-5 text-sm text-[#9ca3af]">
          Get the best of web3, AI, and crypto delivered to your inbox. Free + Premium tiers available.
        </p>
        <form onSubmit={handleSubscribe} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 rounded-lg border border-[#374151] bg-[#1f2937] px-4 py-2.5 text-sm text-[#e5e7eb] outline-none placeholder:text-[#6b7280] focus:border-[#00ff41]"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#00ff41] px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#00cc34] disabled:opacity-50"
          >
            {loading ? '...' : 'Subscribe Free'}
          </button>
        </form>
        <p className="mt-3 text-xs text-[#6b7280]">
          <a href="/premium" className="text-[#00ff41] hover:underline">Upgrade to Premium</a> for exclusive deep dives
        </p>
      </div>
    </div>
  );
}

// ─── Filter Bar ────────────────────────────────────────────────────

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
        onClick={() => onSelectTag(null)}
        className={`rounded-full px-3 py-1 text-xs transition-colors ${
          selectedTag === null
            ? 'bg-[#00ff41] text-black'
            : 'border border-[#374151] text-[#9ca3af] hover:border-[#6b7280]'
        }`}
      >
        All
      </button>
      {uniqueTags.map((tag) => (
        <button
          key={tag}
          onClick={() => onSelectTag(tag)}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            selectedTag === tag
              ? 'bg-[#00ff41] text-black'
              : 'border border-[#374151] text-[#9ca3af] hover:border-[#6b7280]'
          }`}
        >
          #{tag}
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────

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
        const data = await res.json() as { posts: GhostPost[]; meta: { total: number } };
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

  const filteredPosts = selectedTag
    ? posts.filter((p) => p.tags.includes(selectedTag))
    : posts;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#f9fafb]">Articles</h1>
        <p className="mt-2 text-sm text-[#9ca3af]">
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
        <div className="rounded-xl border border-[#1f2937] p-8 text-center">
          <p className="text-sm text-[#ef4444]">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-[#00ff41] px-4 py-2 text-sm font-semibold text-black"
          >
            Retry
          </button>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="rounded-xl border border-[#1f2937] p-8 text-center">
          <p className="text-sm text-[#9ca3af]">No articles found{selectedTag ? ` with tag #${selectedTag}` : ''}.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPosts.map((post) => (
              <ArticleCard key={post.id} post={post} />
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-[#6b7280]">
            Showing {filteredPosts.length} of {posts.length} articles
          </p>
        </>
      )}
    </div>
  );
}
