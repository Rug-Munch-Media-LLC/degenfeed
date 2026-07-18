'use client';

import { addBookmark, removeBookmark } from '@degenfeed/storage';
import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, getProtocolColor } from '@degenfeed/ui';
import { formatTimeAgo } from '@degenfeed/utils';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useReadingSettings } from '../../../hooks/useReadingSettings';

const TipModal = dynamic(
  () => import('../../../components/TipModal').then((m) => ({ default: m.TipModal })),
  { ssr: false, loading: () => null },
);

import { Breadcrumbs } from '../../../components/Breadcrumbs';
import { sanitizeHtml } from '../../../lib/sanitize';

// ─── Read time helper ─────────────────────────────────────────

const WORDS_PER_MINUTE = 200;

function estimateReadTime(text: string): string {
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
  return `${minutes} min read`;
}

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

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${post.author.displayName} on ${protocolLabel(post.protocol)}`,
          text: post.text.slice(0, 200),
          url,
        });
      } catch {
        /* user cancelled or share failed */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* clipboard write failed */
      }
    }
  }, [post]);

  const handleEmbed = useCallback(async () => {
    const origin = window.location.origin;
    const embedCode = [
      `<iframe src="${origin}/embed/${encodeURIComponent(post.id)}"`,
      ' width="550" height="400" frameborder="0"',
      ' allowfullscreen></iframe>',
    ].join('');
    try {
      await navigator.clipboard.writeText(embedCode);
    } catch {
      /* clipboard write failed */
    }
  }, [post]);

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
            {post.text.length > 50 && <span>· {estimateReadTime(post.text)}</span>}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p
          className="whitespace-pre-wrap break-words text-[var(--color-fg)]"
          style={{
            fontSize: 'var(--reader-font-size, 1rem)',
            lineHeight: 'var(--reader-line-height, 1.6)',
          }}
        >
          {post.text}
        </p>
        {post.html && (
          <div
            // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via DOMPurify
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.html) }}
            className="mt-2"
            style={{
              fontSize: 'var(--reader-font-size, 1rem)',
              lineHeight: 'var(--reader-line-height, 1.6)',
              color: 'var(--color-muted)',
            }}
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
              alt="Post image"
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
            <div className="mt-0.5 font-medium text-sm text-[var(--color-fg)]">
              {embedData.title}
            </div>
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
                alt="Post image"
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

      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1 sm:gap-2 border-t border-[var(--color-glass-border)] pt-3">
        <button
          type="button"
          onClick={() => handleAction('like')}
          disabled={engaging === 'like'}
          className={`rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors flex-1 sm:flex-none ${liked ? 'bg-degen-500/20 text-degen-400' : 'text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
        >
          {liked ? '♥' : '♡'} {metrics.likes}
        </button>
        <button
          type="button"
          onClick={() => handleAction('repost')}
          disabled={engaging === 'repost'}
          className={`rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors flex-1 sm:flex-none ${reposted ? 'bg-green-500/20 text-green-400' : 'text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
        >
          ↻ {metrics.reposts}
        </button>
        <button
          type="button"
          onClick={() => handleAction(bookmarked ? 'unbookmark' : 'bookmark')}
          disabled={engaging === 'bookmark' || engaging === 'unbookmark'}
          className={`rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors flex-1 sm:flex-none ${bookmarked ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
        >
          {bookmarked ? '★' : '☆'}
        </button>
        <button
          type="button"
          onClick={() => onTip(post)}
          className="rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors flex-1 sm:flex-none"
        >
          Tip
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors flex-1 sm:flex-none"
          title="Share this post"
        >
          ↗
        </button>
        <button
          type="button"
          onClick={handleEmbed}
          className="rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors flex-1 sm:flex-none"
          title="Copy embed code"
        >
          &lt;/&gt;
        </button>
      </div>
    </article>
  );
}

/** UnifiedPost extended with cross-protocol thread metadata from /api/thread. */
interface ThreadReply extends UnifiedPost {
  bridged?: boolean;
  bridgeFrom?: string;
  viaCrossPost?: boolean;
  depth?: number;
  parentUri?: string;
}

interface ThreadData {
  post: UnifiedPost | null;
  replies: ThreadReply[];
  protocols: string[];
  bridgeCount: number;
  byProtocol: Record<string, number>;
}

type ThreadSort = 'chrono' | 'top' | 'protocol';

const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  threads: 'Threads',
  mastodon: 'Mastodon',
  lemmy: 'Lemmy',
  rss: 'RSS',
  reddit: 'Reddit',
};

function protocolLabel(p: string): string {
  return PROTOCOL_LABELS[p] ?? p;
}

interface ThreadNode {
  reply: ThreadReply;
  children: ThreadNode[];
}

function sortReplies(replies: ThreadReply[], mode: ThreadSort): ThreadReply[] {
  const score = (r: ThreadReply) => r.metrics.likes + r.metrics.reposts * 2 + r.metrics.replies;
  const out = [...replies];
  if (mode === 'top') {
    out.sort((a, b) => score(b) - score(a) || a.createdAt - b.createdAt);
  } else if (mode === 'protocol') {
    out.sort((a, b) => a.protocol.localeCompare(b.protocol) || a.createdAt - b.createdAt);
  } else {
    out.sort((a, b) => a.createdAt - b.createdAt);
  }
  return out;
}

/** Nest replies-to-replies under their parent; unmatched parents float to root. */
function buildThreadTree(replies: ThreadReply[], rootUri: string, mode: ThreadSort): ThreadNode[] {
  const sorted = sortReplies(replies, mode);
  const nodes = new Map<string, ThreadNode>();
  for (const r of sorted) {
    nodes.set(r.dfUri ?? `df://${r.id}`, { reply: r, children: [] });
  }
  const roots: ThreadNode[] = [];
  for (const node of nodes.values()) {
    const parentUri = node.reply.parentUri;
    const parent = parentUri && parentUri !== rootUri ? nodes.get(parentUri) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function ThreadReplyCard({
  node,
  opAuthorId,
  parentProtocol,
  depth = 0,
}: {
  node: ThreadNode;
  opAuthorId?: string;
  parentProtocol?: string;
  depth?: number;
}) {
  const { reply, children } = node;
  const color = getProtocolColor(reply.protocol);
  const isOp = !!opAuthorId && reply.author.id === opAuthorId;
  const bridgeSource = reply.bridgeFrom ?? reply.protocol;
  const isCrossProtocol = parentProtocol != null && reply.protocol !== parentProtocol;
  return (
    <div className={depth > 0 ? 'mt-2' : ''}>
      <div
        className={`rounded-xl border p-4 ${
          isOp
            ? 'border-degen-500/40 bg-degen-500/[0.04]'
            : 'border-[var(--color-glass-border)] bg-white/[0.01]'
        }`}
        style={{ borderLeftWidth: 3, borderLeftColor: color }}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-medium text-xs text-[var(--color-fg)] truncate">
            {reply.author.displayName}
          </span>
          {isOp && (
            <span className="rounded-full bg-degen-500/20 px-1.5 py-0.5 text-[9px] font-bold text-degen-400">
              OP
            </span>
          )}
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {protocolLabel(reply.protocol)}
          </span>
          {isCrossProtocol && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium text-degen-400"
              style={{ backgroundColor: '#a855f718' }}
              title={`Replied from ${bridgeSource !== reply.protocol ? protocolLabel(bridgeSource) : protocolLabel(reply.protocol)} via DegenFeed bridge`}
            >
              ↔ {protocolLabel(bridgeSource !== reply.protocol ? bridgeSource : reply.protocol)}
            </span>
          )}
          <span className="text-[10px] text-gray-600">{formatTimeAgo(reply.createdAt)} ago</span>
        </div>
        {isCrossProtocol && (
          <p className="mb-1.5 text-[10px] italic text-degen-400/80">
            ↔ Replied from {protocolLabel(bridgeSource)} via DegenFeed bridge
          </p>
        )}
        <p className="text-xs leading-relaxed text-gray-400 whitespace-pre-wrap break-words line-clamp-6">
          {reply.text}
        </p>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-600">
          <span>{reply.metrics.likes} likes</span>
          <span>{reply.metrics.reposts} reposts</span>
          <span>{reply.metrics.replies} replies</span>
        </div>
      </div>
      {children.length > 0 && (
        <div className="ml-4 border-l-2 pl-3" style={{ borderColor: `${color}44` }}>
          {children.map((child) => (
            <ThreadReplyCard
              key={child.reply.id}
              node={child}
              opAuthorId={opAuthorId}
              parentProtocol={parentProtocol}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Render inline colored protocol pills for reply breakdown. */
function ProtocolReplyPills({ byProtocol }: { byProtocol: Record<string, number> }) {
  const entries = Object.entries(byProtocol).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([p, n]) => {
        const color = getProtocolColor(p);
        return (
          <span
            key={p}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: `${color}18`, color }}
          >
            {protocolLabel(p)} {n}
          </span>
        );
      })}
    </div>
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function PostPage({ params }: Props) {
  const [id, setId] = useState<string | null>(null);
  const [post, setPost] = useState<UnifiedPost | null>(null);
  const [replies, setReplies] = useState<ThreadReply[]>([]);
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [_repliesState, setRepliesState] = useState<'idle' | 'loading' | 'loaded'>('idle');
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [tipPost, setTipPost] = useState<UnifiedPost | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showReaderControls, setShowReaderControls] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollPosKey = `df_scroll_pos_${id ?? ''}`;
  const { settings, setFontSize, setLineSpacing } = useReadingSettings();
  const { engage, crossReply, signedInProtocols, openSignIn } = useAuth();
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyProtocol, setReplyProtocol] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<ThreadSort>('chrono');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dfUri = post?.dfUri ?? (id ? `df://${id}` : null);

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

  // Restore scroll position on load
  useEffect(() => {
    if (state !== 'loaded') return;
    const saved = sessionStorage.getItem(scrollPosKey);
    if (saved) {
      const top = Number(saved);
      if (top > 0) {
        requestAnimationFrame(() => {
          window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
        });
      }
    }
  }, [state, scrollPosKey]);

  // Track scroll progress + save position
  useEffect(() => {
    if (state !== 'loaded') return;
    const handler = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
      setScrollProgress(progress);
      // Debounced save
      sessionStorage.setItem(scrollPosKey, String(scrollTop));
    };
    window.addEventListener('scroll', handler, { passive: true });
    // Initial call
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, [state, scrollPosKey]);

  const loadThread = useCallback(async () => {
    if (!id) return;
    const uri = `df://${id}`;
    setRepliesState('loading');
    try {
      const res = await fetch(`/api/thread/${encodeURIComponent(uri)}?limit=50`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as ThreadData;
        setThread(data);
        setReplies(data.replies ?? []);
        setRepliesState('loaded');
        return;
      }
      throw new Error(`Thread fetch failed (${res.status})`);
    } catch {
      // Fallback: native-only replies endpoint
      try {
        const res = await fetch(`/api/feed/post/${encodeURIComponent(id)}/replies?limit=20`, {
          credentials: 'include',
        });
        if (res.ok) {
          const d = (await res.json()) as { data?: ThreadReply[] };
          if (d?.data) setReplies(d.data);
        }
        setRepliesState('loaded');
      } catch {
        setRepliesState('idle');
      }
    }
  }, [id]);

  useEffect(() => {
    if (!id || !post) return;
    loadThread();
  }, [id, post, loadThread]);

  // Default the reply protocol: post's own protocol if signed in, else first signed-in
  useEffect(() => {
    if (replyProtocol || !post) return;
    const signedIn = Object.entries(signedInProtocols)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (signedIn.length === 0) return;
    setReplyProtocol(signedIn.includes(post.protocol) ? post.protocol : (signedIn[0] ?? null));
  }, [post, signedInProtocols, replyProtocol]);

  const handleEngage = useCallback(
    async (action: EngagementAction, postId: string) => {
      if (action === 'bookmark' || action === 'unbookmark') {
        try {
          if (action === 'bookmark')
            await addBookmark(
              postId,
              post?.dfUri ?? '',
              post?.protocol ?? '',
              post?.text.slice(0, 60) ?? '',
              post?.author.displayName || '',
            );
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
      const targetProtocol = replyProtocol ?? post.protocol;
      const content = replyText.trim();
      let result: { ok: boolean; error?: string };
      if (targetProtocol !== post.protocol) {
        // Cross-protocol reply through the bridge
        result = await crossReply(dfUri ?? `df://${id}`, post.protocol, targetProtocol, content);
      } else {
        result = await engage('reply', post.id, post.protocol, { content });
      }
      if (result.ok) {
        setReplyText('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        await loadThread();
      } else {
        setReplyError(result.error || 'Reply failed');
      }
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Reply failed');
    } finally {
      setReplying(false);
    }
  };

  const signedIn = Object.entries(signedInProtocols)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const threadTree = dfUri ? buildThreadTree(replies, dfUri, sortMode) : [];
  const byProtocol =
    thread?.byProtocol ??
    replies.reduce<Record<string, number>>((acc, r) => {
      acc[r.protocol] = (acc[r.protocol] ?? 0) + 1;
      return acc;
    }, {});

  // Breadcrumb override: show post preview instead of raw ID
  const pathname = usePathname();
  const lastSegment = pathname.split('/').filter(Boolean).pop() ?? '';
  const breadcrumbOverrides = post?.text
    ? {
        [lastSegment]: `${post.author.displayName}: ${post.text.slice(0, 48)}${post.text.length > 48 ? '…' : ''}`,
      }
    : undefined;

  // Reader controls
  const fontSizeLabel = { sm: 'S', md: 'M', lg: 'L' } as const;
  const lineSpacingLabel = {
    compact: 'Compact',
    comfortable: 'Comfy',
    relaxed: 'Relaxed',
  } as const;

  return (
    <ErrorBoundary>
      {/* Reading progress bar */}
      <div
        className="reading-progress"
        style={{ width: `${scrollProgress * 100}%` }}
        role="progressbar"
        aria-valuenow={Math.round(scrollProgress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
      />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Breadcrumbs className="mb-4 px-1" overrides={breadcrumbOverrides} />

        <div
          ref={contentRef}
          style={
            {
              '--reader-font-size':
                settings.fontSize === 'sm'
                  ? '0.875rem'
                  : settings.fontSize === 'lg'
                    ? '1.125rem'
                    : '1rem',
              '--reader-line-height':
                settings.lineSpacing === 'compact'
                  ? '1.4'
                  : settings.lineSpacing === 'relaxed'
                    ? '1.8'
                    : '1.6',
            } as React.CSSProperties
          }
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <a
              href="/feed"
              className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-[var(--color-fg)]"
            >
              &larr; Back to feed
            </a>
            {/* Reader controls */}
            <div className="relative flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowReaderControls(!showReaderControls)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                aria-label="Reader settings"
                title="Text size & spacing"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 4v16" />
                  <path d="M18 4v16" />
                  <path d="M4 20h16" />
                  <path d="M10 8h4" />
                  <path d="M9 12h6" />
                  <path d="M11 16h2" />
                </svg>
              </button>
              {showReaderControls && (
                <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-white/10 bg-[var(--color-card)] p-3 shadow-2xl backdrop-blur-xl min-w-[200px]">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Font Size
                  </p>
                  <div className="flex gap-1 mb-3">
                    {(['sm', 'md', 'lg'] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setFontSize(size)}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                          settings.fontSize === size
                            ? 'bg-degen-500/20 text-degen-400'
                            : 'text-gray-500 hover:bg-[var(--color-muted)]'
                        }`}
                      >
                        {fontSizeLabel[size]}
                      </button>
                    ))}
                  </div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Line Spacing
                  </p>
                  <div className="flex gap-1">
                    {(['compact', 'comfortable', 'relaxed'] as const).map((spacing) => (
                      <button
                        key={spacing}
                        type="button"
                        onClick={() => setLineSpacing(spacing)}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors ${
                          settings.lineSpacing === spacing
                            ? 'bg-degen-500/20 text-degen-400'
                            : 'text-gray-500 hover:bg-[var(--color-muted)]'
                        }`}
                      >
                        {lineSpacingLabel[spacing]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

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

              {signedIn.length > 0 ? (
                <div className="card mt-4 border border-[var(--color-glass-border)] bg-white/[0.02]">
                  <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--color-glass-border)] px-4 py-2.5">
                    <span className="mr-1 text-[11px] text-gray-500">Reply as:</span>
                    {signedIn.map((p) => {
                      const active = (replyProtocol ?? post.protocol) === p;
                      const color = getProtocolColor(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setReplyProtocol(p)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            active
                              ? ''
                              : 'border-[var(--color-glass-border)] text-gray-500 hover:text-[var(--color-fg)]'
                          }`}
                          style={
                            active
                              ? { backgroundColor: `${color}22`, color, borderColor: `${color}66` }
                              : undefined
                          }
                        >
                          {protocolLabel(p)}
                          {p !== post.protocol && ' ↔'}
                        </button>
                      );
                    })}
                  </div>
                  {replyProtocol && replyProtocol !== post.protocol && (
                    <p className="px-4 pt-2 text-[11px] text-degen-400">
                      ↔ Bridging your reply from {protocolLabel(replyProtocol)} to this{' '}
                      {protocolLabel(post.protocol)} post
                    </p>
                  )}
                  <textarea
                    ref={textareaRef}
                    value={replyText}
                    onChange={(e) => {
                      setReplyText(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`;
                    }}
                    placeholder="Post your reply"
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

              <section className="mt-6">
                {replies.length > 0 ? (
                  <>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="font-semibold text-[var(--color-fg)] text-sm">
                          {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                          {(thread?.protocols.length ?? 0) > 1 && (
                            <span className="ml-1.5 text-degen-400">
                              across {thread?.protocols.length} protocols
                            </span>
                          )}
                        </h2>
                        <ProtocolReplyPills byProtocol={byProtocol} />
                      </div>
                      <div className="flex gap-1">
                        {(
                          [
                            ['chrono', 'Chronological'],
                            ['top', 'Top'],
                            ['protocol', 'By Protocol'],
                          ] as [ThreadSort, string][]
                        ).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setSortMode(mode)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              sortMode === mode
                                ? 'bg-degen-500/20 text-degen-400'
                                : 'text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {threadTree.map((node) => (
                        <ThreadReplyCard
                          key={node.reply.id}
                          node={node}
                          opAuthorId={post.author.id}
                          parentProtocol={post.protocol}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  state === 'loaded' && (
                    <div className="card border border-[var(--color-glass-border)] bg-white/[0.02] py-12 text-center">
                      <p className="text-sm text-[var(--color-muted)]">No replies yet</p>
                      <p className="mt-1 text-xs text-gray-600">
                        Be the first to join the conversation
                      </p>
                    </div>
                  )
                )}
              </section>
            </>
          )}

          {tipPost && (
            <TipModal
              open={!!tipPost}
              onClose={() => setTipPost(null)}
              recipientProtocol={tipPost.protocol}
              recipientAuthorId={tipPost.author.id}
              recipientDisplayName={
                tipPost.author.displayName || tipPost.author.handles[tipPost.protocol] || ''
              }
              postContext={{ protocol: tipPost.protocol, authorId: tipPost.author.id }}
            />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
