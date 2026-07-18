'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, TokenChart } from '@degenfeed/ui';
import { formatTimeAgo, shortenAddress } from '@degenfeed/utils';
import { useCallback, useEffect, useState } from 'react';

interface Props {
  params: Promise<{ id: string }>;
}

function PostRow({ post }: { post: UnifiedPost }) {
  return (
    <a
      href={`/post/${encodeURIComponent(post.id)}`}
      className="block border-b border-[var(--color-border)] px-4 py-3 transition-colors hover:bg-[var(--color-overlay)]"
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-[var(--color-fg)]">{post.author.displayName}</span>
        <span className="text-xs text-[var(--color-muted)]">{formatTimeAgo(post.createdAt)}</span>
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)] line-clamp-2">{post.text}</p>
      <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-muted)]">
        <span>{post.metrics.likes} likes</span>
        <span>{post.metrics.reposts} reposts</span>
        <span>{post.metrics.replies} replies</span>
      </div>
    </a>
  );
}

export default function TokenPage({ params }: Props) {
  const [id, setId] = useState<string | null>(null);
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [error, setError] = useState<string>();

  const isAddress = (s: string) =>
    /^0x[a-fA-F0-9]{40}$/.test(s) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
  const chain = id?.startsWith('0x') ? 'ethereum' : 'solana';

  useEffect(() => {
    params.then((p) => setId(decodeURIComponent(p.id)));
  }, [params]);

  const fetchPosts = useCallback(async () => {
    if (!id) return;
    setState('loading');
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(id)}&limit=50`, {
        credentials: 'include',
      });
      const data = (await res.json()) as { data?: UnifiedPost[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to fetch posts');
      setPosts(data.data ?? []);
      setState('loaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setState('error');
    }
  }, [id]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  const displayName = id ? (isAddress(id) ? shortenAddress(id) : `$${id.toUpperCase()}`) : '';

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <a
          href="/home"
          className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          &larr; Back to feed
        </a>

        <h1 className="mb-6 text-2xl font-bold text-[var(--color-fg)]">{displayName}</h1>

        {/* Price chart */}
        <div className="mb-6">
          {id && (
            <TokenChart
              symbol={isAddress(id) ? undefined : id}
              address={isAddress(id) ? id : undefined}
              chain={chain}
            />
          )}
        </div>

        {/* Recent mentions */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            Recent mentions
          </h2>

          {state === 'loading' && (
            <div className="space-y-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse border-b border-[var(--color-border)] px-4 py-3"
                >
                  <div className="mb-2 h-3 w-32 rounded bg-[var(--color-card)]" />
                  <div className="mb-1 h-3 w-full rounded bg-[var(--color-card)]" />
                  <div className="h-3 w-3/4 rounded bg-[var(--color-card)]" />
                </div>
              ))}
            </div>
          )}

          {state === 'error' && (
            <div className="rounded-xl border border-red-900/30 bg-red-950/20 py-8 text-center">
              <p className="text-sm text-red-300">{error || 'Failed to load posts'}</p>
              <button
                type="button"
                onClick={() => void fetchPosts()}
                className="btn-primary mt-3 text-xs"
              >
                Retry
              </button>
            </div>
          )}

          {state === 'loaded' && posts.length === 0 && (
            <div className="py-8 text-center text-sm text-[var(--color-muted)]">
              No posts mentioning {displayName} yet.
            </div>
          )}

          {state === 'loaded' && posts.length > 0 && (
            <div className="divide-y divide-white/5">
              {posts.map((post) => (
                <PostRow key={post.id} post={post} />
              ))}
            </div>
          )}
        </section>
      </div>
    </ErrorBoundary>
  );
}
