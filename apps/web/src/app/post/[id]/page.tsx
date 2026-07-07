'use client';

import { addBookmark, removeBookmark } from '@degenfeed/storage';
import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { TipModal } from '../../../components/TipModal';

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function stripTags(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function protocolColor(p: string): string {
  const c: Record<string, string> = {
    nostr: '#8e30eb', farcaster: '#8a63d2', lens: '#abfe2c',
    bluesky: '#1185fe', threads: '#888', mastodon: '#6364ff', rss: '#ffa500',
  };
  return c[p] ?? '#666';
}

function protocolEmoji(p: string): string {
  const m: Record<string, string> = {
    nostr: '⚡', farcaster: '🟣', lens: '🌿', bluesky: '🦋',
    mastodon: '🐘', threads: '🧵', rss: '📡',
  };
  return m[p] ?? '●';
}

function PostCard({ post, onEngage, onTip }: {
  post: UnifiedPost;
  onEngage: (action: EngagementAction, id: string) => Promise<{ ok: boolean; error?: string }>;
  onTip: (post: UnifiedPost) => void;
}) {
  const [liked, setLiked] = useState(post.engagement.viewerLiked);
  const [reposted, setReposted] = useState(post.engagement.viewerReposted);
  const [bookmarked, setBookmarked] = useState(post.engagement.viewerBookmarked);
  const [metrics, setMetrics] = useState(post.metrics);
  const [engaging, setEngaging] = useState<string | null>(null);

  const handleAction = useCallback(async (action: EngagementAction) => {
    setEngaging(action);
    const result = await onEngage(action, post.id);
    if (result.ok) {
      if (action === 'like') { setLiked((v) => !v); setMetrics((m) => ({ ...m, likes: m.likes + (liked ? -1 : 1) })); }
      if (action === 'repost') { setReposted((v) => !v); setMetrics((m) => ({ ...m, reposts: m.reposts + (reposted ? -1 : 1) })); }
      if (action === 'bookmark') { setBookmarked(true); }
      if (action === 'unbookmark') { setBookmarked(false); }
    }
    setEngaging(null);
  }, [post.id, onEngage, liked, reposted]);

  const imageEmbed = post.embeds.find((e) => e.kind === 'image');
  const linkEmbed = post.embeds.find((e) => e.kind === 'link');

  return (
    <article className="card border border-white/5">
      {/* Author */}
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
          style={{ backgroundColor: `${protocolColor(post.protocol)}22`, color: protocolColor(post.protocol) }}
        >
          {post.author.displayName[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">{post.author.displayName}</span>
            <span className="text-[10px] text-gray-500" style={{ color: protocolColor(post.protocol) }}>
              {protocolEmoji(post.protocol)} {post.protocol}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            <span>{formatTime(post.createdAt)} ago</span>
            {post.parentId && <span>· reply</span>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mb-4">
        <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap break-words">
          {post.text}
        </p>
        {post.html && (
          <div
            className="mt-2 text-sm leading-relaxed text-gray-400"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />
        )}
      </div>

      {/* Embeds */}
      {imageEmbed && (
        <div className="mb-4 overflow-hidden rounded-xl">
          <img src={imageEmbed.url} alt="" className="w-full object-cover" loading="lazy" />
        </div>
      )}
      {linkEmbed && (
        <a
          href={linkEmbed.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 block rounded-xl border border-white/5 bg-gray-900/50 p-3 text-xs text-gray-400 hover:border-degen-500/20 hover:text-degen-400 transition-colors"
        >
          {linkEmbed.url}
        </a>
      )}

      {/* Niches */}
      {post.niches.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {post.niches.map((n) => (
            <span key={n} className="rounded-full bg-gray-800/60 px-2 py-0.5 text-[10px] text-gray-500">
              #{n}
            </span>
          ))}
        </div>
      )}

      {/* Metrics */}
      <div className="mb-4 flex items-center gap-4 text-xs text-gray-500">
        <span>{metrics.likes} likes</span>
        <span>{metrics.reposts} reposts</span>
        <span>{metrics.replies} replies</span>
        <span>{metrics.quotes} quotes</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-white/5 pt-3">
        <button
          type="button"
          onClick={() => handleAction('like')}
          disabled={engaging === 'like'}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            liked ? 'bg-degen-500/20 text-degen-400' : 'text-gray-500 hover:bg-gray-800 hover:text-white'
          }`}
        >
          {liked ? '♥' : '♡'} {metrics.likes}
        </button>
        <button
          type="button"
          onClick={() => handleAction('repost')}
          disabled={engaging === 'repost'}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            reposted ? 'bg-green-500/20 text-green-400' : 'text-gray-500 hover:bg-gray-800 hover:text-white'
          }`}
        >
          ↻ {metrics.reposts}
        </button>
        <button
          type="button"
          onClick={() => handleAction(bookmarked ? 'unbookmark' : 'bookmark')}
          disabled={engaging === 'bookmark' || engaging === 'unbookmark'}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            bookmarked ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:bg-gray-800 hover:text-white'
          }`}
        >
          {bookmarked ? '★' : '☆'}
        </button>
        <button
          type="button"
          onClick={() => onTip(post)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
        >
          Tip
        </button>
      </div>
    </article>
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function PostPage({ params }: Props) {
  const [id, setId] = useState<string | null>(null);
  const [post, setPost] = useState<UnifiedPost | null>(null);
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [tipPost, setTipPost] = useState<UnifiedPost | null>(null);
  const { engage } = useAuth();

  useEffect(() => {
    params.then((p) => setId(decodeURIComponent(p.id)));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setState('loading');
      try {
        // Fetch the home feed and find the post by ID
        const res = await fetch('/api/feed/home?limit=100', { credentials: 'include' });
        const data = (await res.json()) as { data?: UnifiedPost[]; error?: string };
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        if (cancelled) return;
        const found = (data.data ?? []).find((p) => p.id === id);
        if (found) {
          setPost(found);
          setState('loaded');
        } else {
          setError('Post not found');
          setState('error');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load post');
          setState('error');
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const handleEngage = useCallback(async (action: EngagementAction, postId: string) => {
    if (action === 'bookmark' || action === 'unbookmark') {
      try {
        if (action === 'bookmark') await addBookmark(postId);
        else await removeBookmark(postId);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Bookmark failed' };
      }
    }
    return engage(action, postId, post?.protocol ?? 'rss');
  }, [engage, post]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <a
        href="/home"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-white"
      >
        &larr; Back to feed
      </a>

      {state === 'loading' && (
        <div className="card animate-pulse p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-800" />
            <div className="flex-1">
              <div className="mb-1 h-4 w-32 rounded bg-gray-800" />
              <div className="h-3 w-20 rounded bg-gray-800" />
            </div>
          </div>
          <div className="mb-3 h-4 w-full rounded bg-gray-800" />
          <div className="mb-3 h-4 w-3/4 rounded bg-gray-800" />
          <div className="h-4 w-1/2 rounded bg-gray-800" />
        </div>
      )}

      {state === 'error' && (
        <div className="card border-red-900/30 bg-red-950/20 py-12 text-center">
          <p className="text-red-300">{error || 'Post not found'}</p>
          <a href="/home" className="btn-primary mt-4 inline-block text-sm">
            Back to feed
          </a>
        </div>
      )}

      {state === 'loaded' && post && (
        <>
          <PostCard post={post} onEngage={handleEngage} onTip={setTipPost} />

          {/* Thread context */}
          {post.parentId && (
            <div className="mt-4 rounded-xl border border-white/5 bg-gray-900/30 p-3">
              <p className="text-[11px] text-gray-500">
                This is a reply. <a href={`/post/${encodeURIComponent(post.parentId)}`} className="text-degen-500 hover:underline">View parent post</a>
              </p>
            </div>
          )}

          {/* Raw data for power users */}
          <details className="mt-6">
            <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-400">
              Raw data
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-gray-950 p-4 text-[10px] text-gray-500">
              {JSON.stringify(post.raw, null, 2)}
            </pre>
          </details>
        </>
      )}

      {tipPost && (
        <TipModal
          open={!!tipPost}
          onClose={() => setTipPost(null)}
          recipientProtocol={tipPost.protocol}
          recipientAuthorId={tipPost.author.id}
          recipientDisplayName={tipPost.author.displayName}
          publicationId={tipPost.protocol === 'lens' ? (tipPost.raw as { id?: string })?.id : undefined}
        />
      )}
    </div>
  );
}
