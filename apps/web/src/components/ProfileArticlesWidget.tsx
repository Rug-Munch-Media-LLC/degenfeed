'use client';

import { formatTimeAgo } from '@degenfeed/utils';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// === Types =========================================================

interface GhostPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  featuredImage?: string;
  readingTime: number;
  publishedAt: string;
  tags: string[];
  tippedAmount: string;
  subscriberOnly: boolean;
}

// === Props =========================================================

interface ProfileArticlesWidgetProps {
  /** Limit number of articles shown */
  limit?: number;
  /** Optional tag filter */
  tag?: string;
  /** Show compact variant for sidebar */
  compact?: boolean;
}

// === Component =====================================================

export function ProfileArticlesWidget({
  limit = 5,
  tag,
  compact = false,
}: ProfileArticlesWidgetProps) {
  const [articles, setArticles] = useState<GhostPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (tag) params.set('tag', tag);
        const res = await fetch(`/api/ghost/posts?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to load');
        const data = (await res.json()) as { posts: GhostPost[] };
        setArticles(data.posts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, [limit, tag]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg bg-[var(--color-border)] p-3">
            <div className="mb-2 h-4 w-3/4 rounded bg-[var(--color-border)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--color-border)]" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] p-4 text-center">
        <p className="text-xs text-[var(--color-danger)]">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 rounded bg-[var(--color-accent)] px-3 py-1 text-xs text-black"
        >
          Retry
        </button>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] p-4 text-center">
        <p className="text-xs text-[var(--color-muted)]">No articles published yet.</p>
      </div>
    );
  }

  if (compact) {
    // Sidebar compact variant
    return (
      <div className="space-y-2">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            📄 Latest Articles
          </h3>
          <Link href="/articles" className="text-[10px] text-[var(--color-accent)] hover:underline">
            View All
          </Link>
        </div>
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/articles/${article.slug}`}
            className="group block rounded-lg border border-[var(--color-border)] p-3 transition-colors hover:border-[var(--color-accent)]/20"
          >
            <h4 className="text-sm font-medium text-[var(--color-fg)] group-hover:text-[var(--color-accent)] transition-colors line-clamp-1">
              {article.title}
            </h4>
            <p className="mt-1 text-xs text-[var(--color-muted)] line-clamp-1">
              {article.excerpt?.slice(0, 100) || ''}
            </p>
            <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
              <span>{article.readingTime} min read</span>
              <span>·</span>
              <span>{formatTimeAgo(new Date(article.publishedAt).getTime())}</span>
              {article.subscriberOnly && (
                <>
                  <span>·</span>
                  <span className="text-[#f5a623]">🔒</span>
                </>
              )}
            </div>
          </Link>
        ))}
      </div>
    );
  }

  // Full variant
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--color-fg)]">📄 Articles</h2>
        <Link href="/articles" className="text-xs text-[var(--color-accent)] hover:underline">
          View All
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/articles/${article.slug}`}
            className="group overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] transition-colors hover:border-[var(--color-accent)]/30"
          >
            {article.featuredImage && (
              <div className="aspect-video overflow-hidden">
                <img
                  src={article.featuredImage}
                  alt={article.title}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
            )}
            <div className="p-4">
              <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)] group-hover:text-[var(--color-accent)] transition-colors line-clamp-2">
                {article.title}
              </h3>
              <p className="mb-3 text-xs text-[var(--color-muted)] line-clamp-2">
                {article.excerpt?.slice(0, 150) || ''}
              </p>
              <div className="flex items-center justify-between text-[10px] text-[var(--color-muted)]">
                <span>{article.readingTime} min read</span>
                <span>{formatTimeAgo(new Date(article.publishedAt).getTime())}</span>
              </div>
              {Number(article.tippedAmount) > 0 && (
                <div className="mt-2 text-[10px] text-[var(--color-success)]">
                  ✦ {article.tippedAmount} tipped
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
