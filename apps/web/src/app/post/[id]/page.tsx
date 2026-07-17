'use client';

import { addBookmark, removeBookmark } from '@degenfeed/storage';
import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, getProtocolColor } from '@degenfeed/ui';
import { formatTimeAgo } from '@degenfeed/utils';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '../../../components/AuthProvider';

const TipModal = dynamic(
  () => import('../../../components/TipModal').then((m) => ({ default: m.TipModal })),
  { ssr: false, loading: () => null },
);
import { sanitizeHtml } from '../../../lib/sanitize';

export const revalidate = 3600;

interface EmbedData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

interface FrameData {
  image: string;
  title?: string;
  buttons: Array<{ index: number; label: string; action?: string; target?: string }>;
  postUrl?: string;
  version: string;
}

function PostCard({
  post,
  onEngage,
  onTip,
}: {
  post: UnifiedPost;
  onEngage: (action: EngagementAction, id: string) => Promise<{ ok: boolean; error?: string }>;
  onTip: (post: UnifiedPost) => void;
}) {
  const [liked, setLiked] = useState(post.engagement.viewerLiked);
  const [reposted, setReposted] = useState(post.engagement.viewerReposted);
  const [bookmarked, setBookmarked] = useState(post.engagement.viewerBookmarked);
  const [metrics, setMetrics] = useState(post.metrics);
  const [engaging, setEngaging] = useState<string | null>(null);
  const [embedData, setEmbedData] = useState<EmbedData | null>(null);
  const [frameData, setFrameData] = useState<FrameData | null>(null);
  const [frameLoading, setFrameLoading] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);

  useEffect(() => {
    const linkEmbeds = post.embeds.filter((e) => e.kind === 'link');
    if (linkEmbeds.length > 0) {
      const url = linkEmbeds[0]?.url ?? '';
      if (url)
        fetch(`/api/embed/resolve?url=${encodeURIComponent(url)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.title) setEmbedData(d as EmbedData);
          })
          .catch(() => {});
    }
  }, [post.embeds]);

  useEffect(() => {
    const fcEmbeds = post.embeds.filter((e) => e.kind === 'link' && e.url?.includes('fc:frame'));
    if (fcEmbeds.length > 0 || post.protocol === 'farcaster') {
      const frameUrl = fcEmbeds[0]?.url || post.embeds.find((e) => e.kind === 'link')?.url;
      if (frameUrl) {
        fetch(`/api/frame/resolve?url=${encodeURIComponent(frameUrl)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.image) setFrameData(d as FrameData);
          })
          .catch(() => {});
      }
    }
  }, [post.embeds, post.protocol]);

  const handleFrameAction = async (buttonIndex: number, inputText?: string) => {
    if (!frameData?.postUrl) return;
    setFrameLoading(true);
    try {
      const res = await fetch('/api/frame/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          postUrl: frameData.postUrl,
          buttonIndex,
          inputText,
          state: (frameData as { state?: string }).state,
        }),
      });
      if (res.ok) {
        const next = (await res.json()) as FrameData;
        setFrameData(next);
      }
    } catch {}
    setFrameLoading(false);
  };

  const handleAction = useCallback(
    async (action: EngagementAction) => {
      setEngaging(action);
      const result = await onEngage(action, post.id);
      if (result.ok) {
        if (action === 'like') {
          setLiked((v) => !v);
          setMetrics((m) => ({ ...m, likes: m.likes + (liked ? -1 : 1) }));
        }
        if (action === 'repost') {
          setReposted((v) => !v);
          setMetrics((m) => ({ ...m, reposts: m.reposts + (reposted ? -1 : 1) }));
        }
        if (action === 'bookmark') setBookmarked(true);
        if (action === 'unbookmark') setBookmarked(false);
      }
      setEngaging(null);
    },
    [post.id, onEngage, liked, reposted],
  );

  return (
    <article className="card border border-[var(--color-glass-border)]">
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
          style={{
            backgroundColor: `${getProtocolColor(post.protocol)}22`,
            color: getProtocolColor(post.protocol),
          }}
        >
          {post.author.displayName[0]?.toUpperCase() || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-[var(--color-fg)] truncate">
              {post.author.displayName}
            </span>
            <span
              className="text-[10px] text-gray-500"
              style={{ color: getProtocolColor(post.protocol) }}
            >
              {post.protocol}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            <span>{formatTimeAgo(post.createdAt)} ago</span>
            {post.parentId && <span>· reply</span>}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap break-words">
          {post.text}
        </p>
        {post.html && (
          <div
            // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via DOMPurify
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.html) }}
            className="mt-2 text-sm leading-relaxed text-gray-400"
          />
        )}
      </div>

      {/* Rich link preview */}
      {embedData && (
        <a
          href={post.embeds.find((e) => e.kind === 'link')?.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 block overflow-hidden rounded-xl border border-[var(--color-glass-border)] transition-colors hover:border-degen-500/20"
        >
          {embedData.image && (
            <Image
              src={embedData.image}
              alt=""
              width={800}
              height={400}
              className="w-full object-cover"
              loading="lazy"
            />
          )}
          <div className="p-3">
            <div className="text-[10px] text-gray-500">
              {embedData.siteName ||
                new URL(post.embeds.find((e) => e.kind === 'link')?.url || '').hostname}
            </div>
            <div className="mt-0.5 font-medium text-sm text-[var(--color-fg)]">{embedData.title}</div>
            {embedData.description && (
              <div className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                {embedData.description}
              </div>
            )}
          </div>
        </a>
      )}

      {/* Farcaster Frame */}
      {frameData && (
        <div className="mb-4 overflow-hidden rounded-xl border border-white/10">
          <Image
            src={frameData.image}
            alt={frameData.title || 'Frame'}
            width={800}
            height={418}
            className="w-full object-cover"
            loading="lazy"
          />
          {frameData.buttons.length > 0 && (
            <div className="flex gap-1.5 border-t border-[var(--color-glass-border)] p-2">
              {frameData.buttons.map((btn) => (
                <button
                  key={btn.index}
                  type="button"
                  disabled={frameLoading}
                  onClick={() => handleFrameAction(btn.index)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-degen-500/30 hover:text-[var(--color-fg)] disabled:opacity-50"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image embeds with lightbox */}
      {post.embeds
        .filter((e) => e.kind === 'image')
        .map((img, _i) => (
          <div key={img.url} className="mb-3 overflow-hidden rounded-xl">
            <button
              type="button"
              onClick={() => setImageExpanded(!imageExpanded)}
              className="w-full"
            >
              <Image
                src={img.url}
                alt=""
                width={800}
                height={imageExpanded ? 1200 : 400}
                className={`w-full object-cover transition-all ${imageExpanded ? '' : 'max-h-96'}`}
                loading="lazy"
              />
            </button>
          </div>
        ))}

      {post.niches.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {post.niches.map((n) => (
            <span
              key={n}
              className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-gray-500"
            >
              #{n}
            </span>
          ))}
        </div>
      )}

      <div className="mb-4 flex items-center gap-4 text-xs text-gray-500">
        <span>{metrics.likes} likes</span>
        <span>{metrics.reposts} reposts</span>
        <span>{metrics.replies} replies</span>
        {metrics.quotes > 0 && <span>{metrics.quotes} zaps</span>}
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--color-glass-border)] pt-3">
        <button
          type="button"
          onClick={() => handleAction('like')}
          disabled={engaging === 'like'}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${liked ? 'bg-degen-500/20 text-degen-400' : 'text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
        >
          {liked ? '♥' : '♡'} {metrics.likes}
        </button>
        <button
          type="button"
          onClick={() => handleAction('repost')}
          disabled={engaging === 'repost'}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${reposted ? 'bg-green-500/20 text-green-400' : 'text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
        >
          ↻ {metrics.reposts}
        </button>
        <button
          type="button"
          onClick={() => handleAction(bookmarked ? 'unbookmark' : 'bookmark')}
          disabled={engaging === 'bookmark' || engaging === 'unbookmark'}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${bookmarked ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
        >
          {bookmarked ? '★' : '☆'}
        </button>
        <button
          type="button"
          onClick={() => onTip(post)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          Tip
        </button>
      </div>
    </article>
  );
}

function ReplyCard({ reply }: { reply: UnifiedPost }) {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.01] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-medium text-xs text-[var(--color-fg)] truncate">{reply.author.displayName}</span>
        <span className="text-[10px] text-gray-600">{formatTimeAgo(reply.createdAt)} ago</span>
      </div>
      <p className="text-xs leading-relaxed text-gray-400 whitespace-pre-wrap break-words line-clamp-6">
        {reply.text}
      </p>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-600">
        <span>{reply.metrics.likes} likes</span>
        <span>{reply.metrics.reposts} reposts</span>
        <span>{reply.metrics.replies} replies</span>
      </div>
    </div>
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function PostPage({ params }: Props) {
  const [id, setId] = useState<string | null>(null);
  const [post, setPost] = useState<UnifiedPost | null>(null);
  const [replies, setReplies] = useState<UnifiedPost[]>([]);
  const [_repliesState, setRepliesState] = useState<'idle' | 'loading' | 'loaded'>('idle');
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [tipPost, setTipPost] = useState<UnifiedPost | null>(null);
  const { engage, signedInProtocols, openSignIn } = useAuth();
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    params.then((p) => setId(decodeURIComponent(p.id)));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    const postId = id;
    let cancelled = false;
    async function load() {
      setState('loading');
      try {
        const res = await fetch(`/api/feed/post/${encodeURIComponent(postId)}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as { data?: UnifiedPost; error?: string };
        if (!res.ok || !data.data) throw new Error(data.error || 'Post not found');
        if (cancelled) return;
        setPost(data.data);
        setState('loaded');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Post not found');
          setState('error');
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !post) return;
    setRepliesState('loading');
    fetch(`/api/feed/post/${encodeURIComponent(id)}/replies?limit=20`, { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ data?: UnifiedPost[] }>) : null))
      .then((d) => {
        if (d?.data) setReplies(d.data);
        setRepliesState('loaded');
      })
      .catch(() => setRepliesState('idle'));
  }, [id, post]);

  const handleEngage = useCallback(
    async (action: EngagementAction, postId: string) => {
      if (action === 'bookmark' || action === 'unbookmark') {
        try {
          if (action === 'bookmark') await addBookmark(postId, post?.dfUri ?? '', post?.protocol ?? '', post?.text.slice(0, 60) ?? '', post?.author.displayName || '');
          else await removeBookmark(postId);
          return { ok: true };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : 'Bookmark failed' };
        }
      }
      return engage(action, postId, post?.protocol ?? 'rss');
    },
    [engage, post],
  );

  const handleReply = async () => {
    if (!replyText.trim() || replying || !post || !id) return;
    setReplying(true);
    setReplyError(null);
    try {
      const result = await engage('reply', post.id, post.protocol, { content: replyText.trim() });
      if (result.ok) {
        setReplyText('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        const res = await fetch(`/api/feed/post/${encodeURIComponent(id)}/replies?limit=20`, {
          credentials: 'include',
        });
        if (res.ok) {
          const d = (await res.json()) as { data?: UnifiedPost[] };
          if (d?.data) setReplies(d.data);
        }
      } else {
        setReplyError(result.error || 'Reply failed');
      }
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Reply failed');
    } finally {
      setReplying(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <a
          href="/home"
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-[var(--color-fg)]"
        >
          &larr; Back to feed
        </a>

        {state === 'loading' && (
          <div className="card animate-pulse p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--color-muted)]" />
              <div className="flex-1">
                <div className="mb-1 h-4 w-32 rounded bg-[var(--color-muted)]" />
                <div className="h-3 w-20 rounded bg-[var(--color-muted)]" />
              </div>
            </div>
            <div className="mb-3 h-4 w-full rounded bg-[var(--color-muted)]" />
            <div className="mb-3 h-4 w-3/4 rounded bg-[var(--color-muted)]" />
            <div className="h-4 w-1/2 rounded bg-[var(--color-muted)]" />
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

        {post && (
          <>
            <PostCard post={post} onEngage={handleEngage} onTip={setTipPost} />

            {Object.keys(signedInProtocols).length > 0 ? (
              <div className="card mt-4 border border-[var(--color-glass-border)] bg-white/[0.02]">
                <textarea
                  ref={textareaRef}
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`;
                  }}
                  placeholder="Write a reply..."
                  rows={3}
                  className="w-full resize-none bg-transparent p-4 text-sm text-[var(--color-fg)] placeholder-gray-600 outline-none"
                />
                {replyError && <p className="px-4 pb-1 text-xs text-red-400">{replyError}</p>}
                <div className="flex items-center justify-between border-t border-[var(--color-glass-border)] px-4 py-3">
                  <span
                    className={`text-xs ${
                      replyText.length > 500
                        ? 'text-red-400'
                        : replyText.length > 400
                          ? 'text-yellow-400'
                          : 'text-gray-500'
                    }`}
                  >
                    {replyText.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleReply}
                    disabled={!replyText.trim() || replying}
                    className="btn-primary px-4 text-sm disabled:opacity-50"
                  >
                    {replying ? 'Replying…' : 'Reply'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="card mt-4 border border-[var(--color-glass-border)] bg-white/[0.02] py-6 text-center">
                <p className="text-sm text-gray-500">
                  <button
                    type="button"
                    onClick={openSignIn}
                    className="text-degen-400 hover:text-degen-300 transition-colors underline"
                  >
                    Sign in
                  </button>{' '}
                  to reply to this post
                </p>
              </div>
            )}

            {replies.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-3 font-semibold text-[var(--color-fg)] text-sm">
                  {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </h2>
                <div className="space-y-2">
                  {replies.map((r) => (
                    <ReplyCard key={r.id} reply={r} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {tipPost && (
          <TipModal open={!!tipPost} onClose={() => setTipPost(null)} recipientProtocol={tipPost.protocol} recipientAuthorId={tipPost.author.id} recipientDisplayName={tipPost.author.displayName || tipPost.author.handles[tipPost.protocol] || ''} postContext={{ protocol: tipPost.protocol, authorId: tipPost.author.id }} />
        )}
      </div>
    </ErrorBoundary>
  );
}
