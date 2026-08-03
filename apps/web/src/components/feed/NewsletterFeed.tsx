'use client';

/**
 * @degenfeed/web — <NewsletterFeed />
 *
 * Renders the aggregated newsletter feed from /api/feed/newsletter.
 * Cards show: publication name, author, platform badge, excerpt, and link.
 * The bridge returns UnifiedPost[] with the normalized newsletter shape
 * available under post.raw.newsletter ({ title, author, platform, url,
 * date, excerpt, image, publication }).
 */

import type { UnifiedPost } from '@degenfeed/types';
import { useCallback, useEffect, useRef, useState } from 'react';

interface NewsletterMeta {
  total?: number;
  newsletterSources?: number;
  fetchedAt?: number;
}

type FeedState = 'loading' | 'loaded' | 'empty' | 'error';

const PLATFORM_STYLES: Record<string, { badge: string; text: string; label: string }> = {
  substack: { badge: 'bg-orange-500/15', text: 'text-orange-300', label: 'Substack' },
  medium: { badge: 'bg-gray-500/15', text: 'text-gray-200', label: 'Medium' },
  mirror: { badge: 'bg-violet-500/15', text: 'text-violet-300', label: 'Mirror' },
  paragraph: { badge: 'bg-sky-500/15', text: 'text-sky-300', label: 'Paragraph' },
  ghost: { badge: 'bg-emerald-500/15', text: 'text-emerald-300', label: 'Ghost' },
  custom: { badge: 'bg-pink-500/15', text: 'text-pink-300', label: 'Web' },
};

function platformLabel(platform: string): string {
  return PLATFORM_STYLES[platform]?.label ?? platform ?? 'Web';
}

function platformStyles(platform: string) {
  return (
    PLATFORM_STYLES[platform] ?? {
      badge: 'bg-gray-500/15',
      text: 'text-gray-300',
      label: platform,
    }
  );
}

function formatDate(ts: number): string {
  if (!ts || Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NewsletterFeed({ limit = 40 }: { limit?: number }) {
  const [state, setState] = useState<FeedState>('loading');
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [meta, setMeta] = useState<NewsletterMeta>({});
  const [error, setError] = useState<string>('');
  const lastPostIdRef = useRef<string>('');
  const [newPostCount, setNewPostCount] = useState(0);

  const fetchFeed = useCallback(async () => {
    setState('loading');
    try {
      const url = new URL('/api/feed/newsletter', window.location.origin);
      url.searchParams.set('limit', String(limit));
      const res = await fetch(url.toString(), { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(`Feed returned ${res.status}`);
      const json = (await res.json()) as {
        posts?: UnifiedPost[];
        data?: UnifiedPost[];
        meta?: NewsletterMeta;
      };
      const feed = json.posts ?? json.data ?? [];
      if (feed.length > 0) lastPostIdRef.current = feed[0]?.id ?? '';
      setPosts(feed);
      setMeta(json.meta ?? {});
      setState(feed.length ? 'loaded' : 'empty');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load newsletter feed');
      setState('error');
    }
  }, [limit]);

  useEffect(() => {
    void fetchFeed();
    const poll = setInterval(async () => {
      try {
        const url = new URL('/api/feed/newsletter', window.location.origin);
        url.searchParams.set('limit', '1');
        const res = await fetch(url.toString(), { credentials: 'include' });
        if (!res.ok) return;
        const json = (await res.json()) as { posts?: UnifiedPost[]; data?: UnifiedPost[] };
        const first = (json.posts ?? json.data ?? [])[0];
        if (first && first.id !== lastPostIdRef.current) {
          setNewPostCount((c) => c + 1);
        }
      } catch {
        // ignore polling errors
      }
    }, 60_000);
    return () => clearInterval(poll);
  }, [fetchFeed]);

  if (state === 'loading' && posts.length === 0) {
    const skeletons = Array.from({ length: 5 }, (_, i) => i);
    return (
      <div className="space-y-3" aria-busy="true">
        {skeletons.map((i) => (
          <div
            key={`newsletter-skeleton-${i}`}
            className="animate-pulse rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4"
          >
            <div className="mb-3 h-3 w-32 rounded bg-white/10" />
            <div className="mb-2 h-4 w-3/4 rounded bg-white/10" />
            <div className="h-3 w-full rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <p className="mb-2 text-sm text-red-300">Failed to load newsletter feed</p>
        <p className="mb-4 text-xs text-[var(--color-muted)]">{error}</p>
        <button
          type="button"
          onClick={() => void fetchFeed()}
          className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/25"
        >
          Retry
        </button>
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-10 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-overlay)] text-2xl">
          📬
        </div>
        <h3 className="mb-1 text-base font-bold text-[var(--color-fg)]">
          No newsletter posts right now
        </h3>
        <p className="mx-auto max-w-xs text-sm text-[var(--color-muted)]">
          The newsletter aggregator is warming up. Check back soon!
        </p>
        <button
          type="button"
          onClick={() => void fetchFeed()}
          className="mt-4 rounded-lg bg-degen-500/15 px-4 py-2 text-sm font-medium text-degen-300 transition-colors hover:bg-degen-500/25"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {newPostCount > 0 && (
        <button
          type="button"
          onClick={() => {
            setNewPostCount(0);
            void fetchFeed();
          }}
          className="w-full rounded-full bg-degen-500/15 px-4 py-2 text-xs font-semibold text-degen-300 transition-colors hover:bg-degen-500/25"
        >
          {newPostCount} new newsletter{newPostCount > 1 ? 's' : ''} — refresh
        </button>
      )}

      {meta.newsletterSources != null && (
        <p className="px-1 text-xs text-[var(--color-muted)]">
          Aggregating {meta.newsletterSources} curated publications across Substack, Medium, Mirror,
          Paragraph & Ghost
        </p>
      )}

      {posts.map((post) => {
        const n = (post.raw as { newsletter?: NewsletterRaw } | undefined)?.newsletter;
        const title = n?.title || post.text;
        const author = n?.author || post.author.displayName;
        const publication = n?.publication || post.author.displayName;
        const platform = n?.platform || post.protocol || 'custom';
        const url = n?.url || post.embeds.find((e) => e.kind === 'link')?.url || '';
        const excerpt = n?.excerpt || '';
        const image = n?.image;
        const date = n?.date || post.createdAt;
        const styles = platformStyles(platform);

        return (
          <article
            key={post.id}
            className="group flex gap-4 overflow-hidden rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 transition-all duration-200 hover:border-degen-500/25 hover:shadow-[0_0_16px_rgba(34,197,94,0.05)]"
          >
            {image && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden h-20 w-20 shrink-0 overflow-hidden rounded-lg sm:block"
              >
                {/* biome-ignore lint/performance/noImgElement: external newsletter images are dynamic */}
                <img
                  src={image}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </a>
            )}

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-[var(--color-fg)]">{publication}</span>
                <span className="text-[var(--color-muted)]">·</span>
                <span className="text-[var(--color-muted)]">{author}</span>
                {date ? (
                  <>
                    <span className="text-[var(--color-muted)]">·</span>
                    <time
                      dateTime={new Date(date).toISOString()}
                      className="text-[var(--color-muted)]"
                    >
                      {formatDate(date)}
                    </time>
                  </>
                ) : null}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ring-white/10 ${styles.badge} ${styles.text}`}
                >
                  {platformLabel(platform)}
                </span>
              </div>

              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-1 block text-base font-bold leading-snug text-[var(--color-fg)] transition-colors hover:text-degen-300"
              >
                {title}
              </a>

              {excerpt && (
                <p className="line-clamp-2 text-sm text-[var(--color-muted)]">{excerpt}</p>
              )}

              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-degen-300 transition-colors hover:text-degen-200"
              >
                Read on {platformLabel(platform)}
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M6 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          </article>
        );
      })}
    </div>
  );
}

interface NewsletterRaw {
  title: string;
  author: string;
  platform: string;
  url: string;
  date: number;
  excerpt: string;
  image?: string;
  publication: string;
}
