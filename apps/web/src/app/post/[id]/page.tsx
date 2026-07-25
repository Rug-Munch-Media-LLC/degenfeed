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
import { Breadcrumbs } from '../../../components/Breadcrumbs';
import { sanitizeHtml } from '../../../lib/sanitize';
import { PostEngagementBar, PostThread, PostReplyComposer, estimateReadTime, protocolLabel, buildThreadTree } from '../../../components/post';
import type { EmbedData, FrameData, ThreadReply, ThreadData, ThreadSort } from '../../../components/post';

const TipModal = dynamic(() => import('../../../components/TipModal').then((m) => ({ default: m.TipModal })), { ssr: false, loading: () => null });

function PostCard({ post, onEngage, onTip }: { post: UnifiedPost; onEngage: (action: EngagementAction, id: string) => Promise<{ ok: boolean; error?: string }>; onTip: (post: UnifiedPost) => void }) {
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
    if (linkEmbeds.length > 0) { const url = linkEmbeds[0]?.url ?? ''; if (url) fetch(`/api/embed/resolve?url=${encodeURIComponent(url)}`).then((r) => r.ok ? r.json() : null).then((d) => { if (d?.title) setEmbedData(d as EmbedData); }).catch(() => {}); }
  }, [post.embeds]);
  useEffect(() => {
    const fcEmbeds = post.embeds.filter((e) => e.kind === 'link' && e.url?.includes('fc:frame'));
    if (fcEmbeds.length > 0 || post.protocol === 'farcaster') { const url = fcEmbeds[0]?.url || post.embeds.find((e) => e.kind === 'link')?.url; if (url) fetch(`/api/frame/resolve?url=${encodeURIComponent(url)}`).then((r) => r.ok ? r.json() : null).then((d) => { if (d?.image) setFrameData(d as FrameData); }).catch(() => {}); }
  }, [post.embeds, post.protocol]);
  const handleFrameAction = async (buttonIndex: number, inputText?: string) => {
    if (!frameData?.postUrl) return; setFrameLoading(true);
    try { const res = await fetch('/api/frame/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ postUrl: frameData.postUrl, buttonIndex, inputText, state: (frameData as { state?: string }).state }) }); if (res.ok) setFrameData((await res.json()) as FrameData); } catch {} finally { setFrameLoading(false); }
  };
  const handleAction = useCallback(async (action: EngagementAction) => {
    setEngaging(action); const result = await onEngage(action, post.id);
    if (result.ok) {
      if (action === 'like') { setLiked((v) => !v); setMetrics((m) => ({ ...m, likes: m.likes + (liked ? -1 : 1) })); }
      if (action === 'repost') { setReposted((v) => !v); setMetrics((m) => ({ ...m, reposts: m.reposts + (reposted ? -1 : 1) })); }
      if (action === 'bookmark') setBookmarked(true);
      if (action === 'unbookmark') setBookmarked(false);
    }
    setEngaging(null);
  }, [post.id, onEngage, liked, reposted]);
  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (typeof navigator !== 'undefined' && navigator.share) { try { await navigator.share({ title: `${post.author.displayName} on ${protocolLabel(post.protocol)}`, text: post.text.slice(0, 200), url }); } catch {} } else { try { await navigator.clipboard.writeText(url); } catch {} }
  }, [post]);
  const handleEmbed = useCallback(async () => {
    const origin = window.location.origin;
    try { await navigator.clipboard.writeText([`<iframe src="${origin}/embed/${encodeURIComponent(post.id)}"`, ' width="550" height="400" frameborder="0"', ' allowfullscreen></iframe>'].join('')); } catch {}
  }, [post]);
  return (
    <article className="card border border-[var(--color-glass-border)]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: `${getProtocolColor(post.protocol)}22`, color: getProtocolColor(post.protocol) }}>{post.author.displayName[0]?.toUpperCase() || '?'}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="font-semibold text-sm text-[var(--color-fg)] truncate">{post.author.displayName}</span><span className="text-[10px] text-[var(--color-muted)]" style={{ color: getProtocolColor(post.protocol) }}>{post.protocol}</span></div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--color-muted)]"><span>{formatTimeAgo(post.createdAt)} ago</span>{post.parentId && <span>· reply</span>}{post.text.length > 50 && <span>· {estimateReadTime(post.text)}</span>}</div>
        </div>
      </div>
      <div className="mb-4">
        <p className="whitespace-pre-wrap break-words text-[var(--color-fg)]" style={{ fontSize: 'var(--reader-font-size, 1rem)', lineHeight: 'var(--reader-line-height, 1.6)' }}>{post.text}</p>
        {post.html && <div // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.html) }} className="mt-2" style={{ fontSize: 'var(--reader-font-size, 1rem)', lineHeight: 'var(--reader-line-height, 1.6)', color: 'var(--color-muted)' }} />}
      </div>
      {embedData && <a href={post.embeds.find((e) => e.kind === 'link')?.url || '#'} target="_blank" rel="noopener noreferrer" className="mb-4 block overflow-hidden rounded-xl border border-[var(--color-glass-border)] transition-colors hover:border-degen-500/20">
        {embedData.image && <Image src={embedData.image} alt="Post image" width={800} height={400} className="w-full object-cover" loading="lazy" />}
        <div className="p-3"><div className="text-[10px] text-[var(--color-muted)]">{embedData.siteName || new URL(post.embeds.find((e) => e.kind === 'link')?.url || '').hostname}</div><div className="mt-0.5 font-medium text-sm text-[var(--color-fg)]">{embedData.title}</div>{embedData.description && <div className="mt-0.5 text-xs text-[var(--color-muted)] line-clamp-2">{embedData.description}</div>}</div>
      </a>}
      {frameData && <div className="mb-4 overflow-hidden rounded-xl border border-white/10">
        <Image src={frameData.image} alt={frameData.title || 'Frame'} width={800} height={418} className="w-full object-cover" loading="lazy" />
        {frameData.buttons.length > 0 && <div className="flex gap-1.5 border-t border-[var(--color-glass-border)] p-2">{frameData.buttons.map((btn) => <button key={btn.index} type="button" disabled={frameLoading} onClick={() => handleFrameAction(btn.index)} className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:text-[var(--color-fg)] disabled:opacity-50">{btn.label}</button>)}</div>}
      </div>}
      {post.embeds.filter((e) => e.kind === 'image').map((img) => <div key={img.url} className="mb-3 overflow-hidden rounded-xl"><button type="button" onClick={() => setImageExpanded(!imageExpanded)} className="w-full"><Image src={img.url} alt="Post image" width={800} height={imageExpanded ? 1200 : 400} className={`w-full object-cover transition-all ${imageExpanded ? '' : 'max-h-96'}`} loading="lazy" /></button></div>)}
      {post.niches.length > 0 && <div className="mb-4 flex flex-wrap gap-1">{post.niches.map((n) => <span key={n} className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">#{n}</span>)}</div>}
      <div className="mb-4 flex items-center gap-4 text-xs text-[var(--color-muted)]"><span>{metrics.likes} likes</span><span>{metrics.reposts} reposts</span><span>{metrics.replies} replies</span>{metrics.quotes > 0 && <span>{metrics.quotes} zaps</span>}</div>
      <PostEngagementBar liked={liked} reposted={reposted} bookmarked={bookmarked} metrics={metrics} engaging={engaging} onAction={handleAction} onTip={() => onTip(post)} onShare={handleShare} onEmbed={handleEmbed} />
    </article>
  );
}

interface Props { params: Promise<{ id: string }>; }

export default function PostPage({ params }: Props) {
  const [id, setId] = useState<string | null>(null);
  const [post, setPost] = useState<UnifiedPost | null>(null);
  const [replies, setReplies] = useState<ThreadReply[]>([]);
  const [thread, setThread] = useState<ThreadData | null>(null);
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
  const pathname = usePathname();
  const dfUri = post?.dfUri ?? (id ? `df://${id}` : null);

  useEffect(() => { params.then((p) => setId(decodeURIComponent(p.id))); }, [params]);
  useEffect(() => { if (!id) return; let cancelled = false; async function load() { setState('loading'); try { const res = await fetch(`/api/feed/post/${encodeURIComponent(id)}`, { credentials: 'include' }); const data = (await res.json()) as { data?: UnifiedPost; error?: string }; if (!res.ok || !data.data) throw new Error(data.error || 'Post not found'); if (cancelled) return; setPost(data.data); setState('loaded'); } catch (err) { if (!cancelled) { setError(err instanceof Error ? err.message : 'Post not found'); setState('error'); } } } load(); return () => { cancelled = true; }; }, [id]);
  useEffect(() => { if (state !== 'loaded') return; const saved = sessionStorage.getItem(scrollPosKey); if (saved) { const top = Number(saved); if (top > 0) requestAnimationFrame(() => window.scrollTo({ top, behavior: 'instant' as ScrollBehavior })); } }, [state, scrollPosKey]);
  useEffect(() => { if (state !== 'loaded') return; const handler = () => { const st = window.scrollY; const dh = document.documentElement.scrollHeight - window.innerHeight; setScrollProgress(dh > 0 ? Math.min(st / dh, 1) : 0); sessionStorage.setItem(scrollPosKey, String(st)); }; window.addEventListener('scroll', handler, { passive: true }); handler(); return () => window.removeEventListener('scroll', handler); }, [state, scrollPosKey]);
  const loadThread = useCallback(async () => {
    if (!id) return;
    try { const res = await fetch(`/api/thread/${encodeURIComponent(`df://${id}`)}?limit=50`, { credentials: 'include' }); if (res.ok) { const data = (await res.json()) as ThreadData; setThread(data); setReplies(data.replies ?? []); return; } } catch {}
    try { const res = await fetch(`/api/feed/post/${encodeURIComponent(id)}/replies?limit=20`, { credentials: 'include' }); if (res.ok) { const d = (await res.json()) as { data?: ThreadReply[] }; if (d?.data) setReplies(d.data); } } catch {}
  }, [id]);
  useEffect(() => { if (id && post) loadThread(); }, [id, post, loadThread]);
  useEffect(() => { if (replyProtocol || !post) return; const signedIn = Object.entries(signedInProtocols).filter(([, v]) => v).map(([k]) => k); if (signedIn.length === 0) return; setReplyProtocol(signedIn.includes(post.protocol) ? post.protocol : (signedIn[0] ?? null)); }, [post, signedInProtocols, replyProtocol]);
  const handleEngage = useCallback(async (action: EngagementAction, postId: string) => {
    if (action === 'bookmark' || action === 'unbookmark') { try { if (action === 'bookmark') await addBookmark(postId, post?.dfUri ?? '', post?.protocol ?? '', post?.text.slice(0, 60) ?? '', post?.author.displayName || ''); else await removeBookmark(postId); return { ok: true }; } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Bookmark failed' }; } }
    return engage(action, postId, post?.protocol ?? 'rss');
  }, [engage, post]);
  const handleReply = async () => {
    if (!replyText.trim() || replying || !post || !id) return; setReplying(true); setReplyError(null);
    try { const target = replyProtocol ?? post.protocol; const result = target !== post.protocol ? await crossReply(dfUri ?? `df://${id}`, post.protocol, target, replyText.trim()) : await engage('reply', post.id, post.protocol, { content: replyText.trim() }); if (result.ok) { setReplyText(''); if (textareaRef.current) textareaRef.current.style.height = 'auto'; await loadThread(); } else { setReplyError(result.error || 'Reply failed'); } } catch (err) { setReplyError(err instanceof Error ? err.message : 'Reply failed'); } finally { setReplying(false); }
  };
  const signedIn = Object.entries(signedInProtocols).filter(([, v]) => v).map(([k]) => k);
  const threadTree = dfUri ? buildThreadTree(replies, dfUri, sortMode) : [];
  const byProtocol = thread?.byProtocol ?? replies.reduce<Record<string, number>>((acc, r) => { acc[r.protocol] = (acc[r.protocol] ?? 0) + 1; return acc; }, {});
  const lastSegment = pathname.split('/').filter(Boolean).pop() ?? '';
  const breadcrumbOverrides = post?.text ? { [lastSegment]: `${post.author.displayName}: ${post.text.slice(0, 48)}${post.text.length > 48 ? '…' : ''}` } : undefined;
  return (
    <ErrorBoundary>
      <div className="reading-progress" style={{ width: `${scrollProgress * 100}%` }} role="progressbar" aria-valuenow={Math.round(scrollProgress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Reading progress" />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Breadcrumbs className="mb-4 px-1" overrides={breadcrumbOverrides} />
        <div ref={contentRef} style={{ '--reader-font-size': settings.fontSize === 'sm' ? '0.875rem' : settings.fontSize === 'lg' ? '1.125rem' : '1rem', '--reader-line-height': settings.lineSpacing === 'compact' ? '1.4' : settings.lineSpacing === 'relaxed' ? '1.8' : '1.6' } as React.CSSProperties}>
          <div className="mb-4 flex items-center justify-between gap-2">
            <a href="/feed" className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]">&larr; Back to feed</a>
            <div className="relative flex items-center gap-1">
              <button type="button" onClick={() => setShowReaderControls(!showReaderControls)} className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors" aria-label="Reader settings" title="Text size & spacing">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4v16" /><path d="M18 4v16" /><path d="M4 20h16" /><path d="M10 8h4" /><path d="M9 12h6" /><path d="M11 16h2" /></svg>
              </button>
              {showReaderControls && <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-white/10 bg-[var(--color-card)] p-3 shadow-2xl backdrop-blur-xl min-w-[200px]">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Font Size</p>
                <div className="flex gap-1 mb-3">{(['sm', 'md', 'lg'] as const).map((size) => <button key={size} type="button" onClick={() => setFontSize(size)} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${settings.fontSize === size ? 'bg-degen-500/20 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-muted)]'}`}>{({ sm: 'S', md: 'M', lg: 'L' } as const)[size]}</button>)}</div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Line Spacing</p>
                <div className="flex gap-1">{(['compact', 'comfortable', 'relaxed'] as const).map((spacing) => <button key={spacing} type="button" onClick={() => setLineSpacing(spacing)} className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors ${settings.lineSpacing === spacing ? 'bg-degen-500/20 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-muted)]'}`}>{({ compact: 'Compact', comfortable: 'Comfy', relaxed: 'Relaxed' } as const)[spacing]}</button>)}</div>
              </div>}
            </div>
          </div>
          {state === 'loading' && <div className="card animate-pulse p-6"><div className="mb-4 flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-[var(--color-muted)]" /><div className="flex-1"><div className="mb-1 h-4 w-32 rounded bg-[var(--color-muted)]" /><div className="h-3 w-20 rounded bg-[var(--color-muted)]" /></div></div><div className="mb-3 h-4 w-full rounded bg-[var(--color-muted)]" /><div className="mb-3 h-4 w-3/4 rounded bg-[var(--color-muted)]" /><div className="h-4 w-1/2 rounded bg-[var(--color-muted)]" /></div>}
          {state === 'error' && <div className="card border-red-900/30 bg-red-950/20 py-12 text-center"><p className="text-red-300">{error || 'Post not found'}</p><a href="/home" className="btn-primary mt-4 inline-block text-sm">Back to feed</a></div>}
          {post && <>
            <PostCard post={post} onEngage={handleEngage} onTip={setTipPost} />
            <PostReplyComposer signedIn={signedIn} replyProtocol={replyProtocol} onReplyProtocolChange={setReplyProtocol} postProtocol={post.protocol} replyText={replyText} onReplyTextChange={setReplyText} onReply={handleReply} replying={replying} replyError={replyError} textareaRef={textareaRef} openSignIn={openSignIn} />
            <PostThread replies={replies} thread={thread} byProtocol={byProtocol} threadTree={threadTree} sortMode={sortMode} onSortModeChange={setSortMode} opAuthorId={post.author.id} parentProtocol={post.protocol} loaded={state === 'loaded'} />
          </>}
          {tipPost && <TipModal open={!!tipPost} onClose={() => setTipPost(null)} recipientProtocol={tipPost.protocol} recipientAuthorId={tipPost.author.id} recipientDisplayName={tipPost.author.displayName || tipPost.author.handles[tipPost.protocol] || ''} postContext={{ protocol: tipPost.protocol, authorId: tipPost.author.id }} />}
        </div>
      </div>
    </ErrorBoundary>
  );
}
