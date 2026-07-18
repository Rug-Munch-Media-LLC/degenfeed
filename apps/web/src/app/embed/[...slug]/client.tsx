'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { formatTimeAgo } from '@degenfeed/utils';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

interface EmbedPageClientProps {
  dfUri: string;
}

function _truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function getProtocolColor(p: string): string {
  const colors: Record<string, string> = {
    nostr: '#8e30eb',
    farcaster: '#8a63d2',
    lens: '#abfe2c',
    bluesky: '#1185fe',
    mastodon: '#6364ff',
    threads: '#666666',
    reddit: '#ff4500',
    rss: '#ffa500',
  };
  return colors[p] || '#6b7280';
}

export function EmbedPageClient({ dfUri }: EmbedPageClientProps) {
  const [post, setPost] = useState<UnifiedPost | null>(null);
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!dfUri) {
      setState('error');
      setError('No post identifier provided');
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/content/${encodeURIComponent(dfUri)}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(res.status === 404 ? 'Post not found' : 'Failed to load post');
        const body = (await res.json()) as { data?: UnifiedPost };
        if (!body.data) throw new Error('Post not found');
        if (cancelled) return;
        setPost(body.data);
        setState('loaded');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load post');
          setState('error');
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dfUri]);

  const postUrl = post ? `/post/${encodeURIComponent(post.id)}` : '';

  const handleCopyLink = useCallback(() => {
    if (!postUrl) return;
    const url = `${window.location.origin}${postUrl}`;
    void navigator.clipboard.writeText(url);
  }, [postUrl]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="flex items-center gap-3 text-gray-500">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-degen-500" />
          <span className="text-sm">Loading post…</span>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="max-w-md text-center">
          <div className="mb-4 text-4xl">📭</div>
          <h1 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">Post not found</h1>
          <p className="mb-6 text-sm text-gray-500">{error || 'This post could not be loaded.'}</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-degen-500 px-4 py-2 text-sm font-semibold text-black hover:bg-degen-400 transition-colors"
          >
            &larr; Back to DegenFeed
          </a>
        </div>
      </div>
    );
  }

  if (!post) return null;

  const protocolColor = getProtocolColor(post.protocol);
  const author = post.author.displayName || post.author.handles[post.protocol] || 'Unknown';
  const handle = post.author.handles[post.protocol] || '';
  const protocolLabel = post.protocol.charAt(0).toUpperCase() + post.protocol.slice(1);
  const image = post.embeds.find((e) => e.kind === 'image')?.url || '';
  const text = post.text || '';

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      {/* Minimal header */}
      <header className="sticky top-0 z-10 border-b border-[var(--color-glass-border)] bg-[var(--color-bg)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <a
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-[var(--color-fg)] hover:text-degen-400 transition-colors"
          >
            <Image src="/icon.svg" alt="DegenFeed" width={20} height={20} className="h-5 w-5" />
            DegenFeed
          </a>
          <a
            href={postUrl}
            className="rounded-lg bg-degen-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-degen-400 transition-colors"
          >
            View on DegenFeed &rarr;
          </a>
        </div>
      </header>

      {/* Post card */}
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        <article className="overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] shadow-lg">
          {/* Author row */}
          <div className="p-5 pb-3">
            <div className="flex items-center gap-3">
              <Image
                src={
                  post.author.avatarUrl ||
                  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 fill=%22%23333%22/%3E%3Ctext x=%2216%22 y=%2222%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2216%22%3E%40%3C/text%3E%3C/svg%3E'
                }
                alt={author}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full bg-[var(--color-muted)] object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
                    {author}
                  </span>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${protocolColor}18`,
                      color: protocolColor,
                    }}
                  >
                    {protocolLabel}
                  </span>
                </div>
                {handle && <span className="text-xs text-gray-500">@{handle}</span>}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 pb-3">
            <p className="text-sm leading-relaxed text-[var(--color-fg)] whitespace-pre-wrap break-words">
              {text}
            </p>
          </div>

          {/* Image */}
          {image && (
            <div className="px-5 pb-3">
              <div className="overflow-hidden rounded-xl">
                <Image
                  src={image}
                  alt="Post author avatar"
                  width={800}
                  height={400}
                  className="w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          )}

          {/* Niches */}
          {post.niches.length > 0 && (
            <div className="flex flex-wrap gap-1 px-5 pb-3">
              {post.niches.slice(0, 5).map((n) => (
                <span
                  key={n}
                  className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-gray-500"
                >
                  #{n}
                </span>
              ))}
            </div>
          )}

          {/* Engagement */}
          <div className="flex items-center gap-4 border-t border-[var(--color-glass-border)] px-5 py-3 text-xs text-gray-500">
            {post.metrics.likes > 0 && <span>❤ {post.metrics.likes} likes</span>}
            {post.metrics.reposts > 0 && <span>↻ {post.metrics.reposts} reposts</span>}
            {post.metrics.replies > 0 && <span>↩ {post.metrics.replies} replies</span>}
            <span className="ml-auto">{formatTimeAgo(post.createdAt)} ago</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-[var(--color-glass-border)] px-5 py-3">
            <button
              type="button"
              onClick={handleCopyLink}
              className="rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-[var(--color-fg)] transition-colors"
            >
              Copy link
            </button>
            <a
              href={postUrl}
              className="rounded-lg bg-degen-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-degen-400 transition-colors"
            >
              View on DegenFeed &rarr;
            </a>
          </div>
        </article>

        {/* Embed hint */}
        <p className="mt-4 text-center text-[11px] text-gray-600">
          Embed this post on your site with{' '}
          <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 font-mono text-[10px] text-degen-400">
            {'<script src="https://app.degenfeed.xyz/embed.js"></script>'}
          </code>
        </p>
      </main>

      {/* Minimal footer */}
      <footer className="border-t border-[var(--color-glass-border)] py-4 text-center">
        <a href="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          Powered by DegenFeed — The social feed of web3
        </a>
      </footer>
    </div>
  );
}
