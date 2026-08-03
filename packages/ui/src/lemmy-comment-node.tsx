/**
 * @degenfeed/ui — Lemmy Comment Node & Virtualized List
 *
 * Renders a single threaded comment with vote actions, tipping, media previews,
 * inline reply form, and nested children.
 */

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LemmyTipButton } from './LemmyTipButton';
import { formatScore, getExactTime, getThreadColor } from './lemmy-helpers';
import { MediaContent, parseContentMedia } from './lemmy-media';
import { ReplyForm } from './lemmy-reply-form';
import type { CommentNodeProps, VirtualizedCommentListProps } from './lemmy-types';

// ─── Single Comment Node ────────────────────────────────────────────

const CommentNode = memo(function CommentNode({
  comment,
  depth,
  fallbackEvmAddress,
  fallbackSolanaAddress,
  userVote: externalVote,
  onVote,
}: CommentNodeProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [localVote, setLocalVote] = useState<'up' | 'down' | null>(externalVote ?? null);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [commentTipCount, setCommentTipCount] = useState(0);

  const effectiveEvmAddress = comment.authorEvmAddress || fallbackEvmAddress;
  const effectiveSolanaAddress = comment.authorSolanaAddress || fallbackSolanaAddress;
  const [swipeAction] = useState<'vote' | 'reply' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const threadDotRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const color = getThreadColor(depth);
  const hasReplies = comment.replies.length > 0;

  useEffect(() => {
    if (externalVote !== undefined) setLocalVote(externalVote);
  }, [externalVote]);

  const { cleanText, media } = useMemo(() => parseContentMedia(comment.content), [comment.content]);

  useEffect(() => {
    if (!effectiveEvmAddress && !effectiveSolanaAddress) return;
    let cancelled = false;
    fetch(`/api/lemmy/tip/stats?contentId=${encodeURIComponent(comment.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { totalCount?: number } | null) => {
        if (!cancelled && data?.totalCount) setCommentTipCount(data.totalCount);
      });
    return () => {
      cancelled = true;
    };
  }, [comment.id, effectiveEvmAddress, effectiveSolanaAddress]);

  const handleVote = useCallback(
    (direction: 'up' | 'down') => {
      const newVote = localVote === direction ? null : direction;
      setLocalVote(newVote);
      onVote?.(comment.id, newVote);
    },
    [localVote, comment.id, onVote],
  );

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/lemmy/comment/${encodeURIComponent(comment.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: { kind: 'success', message: 'Comment link copied!' },
        }),
      );
    } catch {
      /* fallback */
    }
  }, [comment.id]);

  const toggleReplyForm = useCallback(() => setShowReplyForm((v) => !v), []);

  const borderColor = `${color}22`;

  return (
    <div
      ref={containerRef}
      className={`group relative ${depth > 0 ? 'ml-4 border-l-2 pl-3' : ''}`}
      style={{ borderColor, transition: 'border-color 0.2s' }}
    >
      {/* Thread line dot */}
      <button
        ref={threadDotRef}
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -left-[9.5px] top-[14px] z-10 h-3.5 w-3.5 cursor-pointer rounded-full border-2 transition-transform hover:scale-125"
        style={{ borderColor: color, backgroundColor: collapsed ? 'transparent' : `${color}33` }}
        aria-label={collapsed ? 'Expand thread' : 'Collapse thread'}
        aria-expanded={!collapsed}
      />

      <div
        className={`relative rounded-lg px-2.5 py-1.5 transition-colors ${depth % 2 === 1 ? 'bg-white/[0.01]' : ''}`}
        style={{ opacity: collapsed ? 0.5 : 1 }}
      >
        {/* Author line */}
        <div className="mb-0.5 flex items-center gap-1.5 text-xs">
          {comment.authorAvatar && (
            <img
              src={comment.authorAvatar}
              alt=""
              className="h-4 w-4 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <span className="font-semibold text-[var(--color-fg)]">{comment.author}</span>
          <span className="text-[10px] text-gray-600" title={getExactTime(comment.createdAt)}>
            {formatScore(comment.createdAt ? Date.now() - comment.createdAt : 0) === '0'
              ? 'just now'
              : `${Math.floor((Date.now() - comment.createdAt) / 60000)}m`}
          </span>
          {comment.editedAt && <span className="text-[10px] text-gray-700 italic">edited</span>}
        </div>

        {/* Content with inline media */}
        {!collapsed && (
          <>
            <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--color-muted)]">
              {cleanText || '(deleted)'}
            </p>
            <MediaContent images={media.images} videos={media.videos} links={media.links} />

            {/* Actions row */}
            <div className="mt-1 flex flex-wrap items-center gap-0.5 text-gray-600">
              <button
                type="button"
                onClick={() => handleVote('up')}
                className={`flex items-center gap-0.5 rounded-md px-1.5 py-1 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 min-h-[28px] ${localVote === 'up' ? 'bg-orange-500/15 text-orange-400' : 'hover:bg-orange-500/10 hover:text-orange-400 text-gray-600'}`}
                aria-label="Upvote"
                aria-pressed={localVote === 'up'}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="currentColor"
                  aria-hidden="true"
                  className={localVote === 'up' ? 'scale-110' : ''}
                >
                  <path d="M7 2.5L13 12.5H1L7 2.5Z" />
                </svg>
                {comment.score > 0 && (
                  <span className="text-[11px] tabular-nums">{formatScore(comment.score)}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleVote('down')}
                className={`flex items-center gap-0.5 rounded-md px-1.5 py-1 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 min-h-[28px] ${localVote === 'down' ? 'bg-blue-500/15 text-blue-400' : 'hover:bg-blue-500/10 hover:text-blue-400 text-gray-600'}`}
                aria-label="Downvote"
                aria-pressed={localVote === 'down'}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="currentColor"
                  aria-hidden="true"
                  className={localVote === 'down' ? 'scale-110' : ''}
                >
                  <path d="M7 12.5L1 2.5H13L7 12.5Z" />
                </svg>
              </button>

              <span className="text-gray-700" aria-hidden="true">
                ·
              </span>

              <button
                type="button"
                onClick={toggleReplyForm}
                className={`flex items-center gap-1 rounded-md px-1.5 py-1 transition-all duration-150 hover:bg-gray-500/10 hover:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-offset-1 min-h-[28px] ${showReplyForm ? 'text-degen-400' : 'text-gray-600'}`}
                aria-label="Reply"
                aria-expanded={showReplyForm}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M3 7.5L7 11.5M3 7.5L7 3.5M3 7.5H11.5"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Reply</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 transition-all duration-150 hover:bg-gray-500/10 hover:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-offset-1 min-h-[28px] text-gray-600"
                aria-label="Share comment"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M10 4.5C10.8284 4.5 11.5 3.82843 11.5 3C11.5 2.17157 10.8284 1.5 10 1.5C9.17157 1.5 8.5 2.17157 8.5 3C8.5 3.17157 8.52859 3.33631 8.58124 3.49021L5.41876 5.25979C5.17157 5.09333 4.87266 5 4.55 5C3.6125 5 2.8625 5.75 2.8625 6.6875C2.8625 7.625 3.6125 8.375 4.55 8.375C4.87266 8.375 5.17157 8.28167 5.41876 8.11521L8.58124 9.88479C8.52859 10.0387 8.5 10.2034 8.5 10.375C8.5 11.2125 9.1625 11.875 10 11.875C10.8375 11.875 11.5 11.2125 11.5 10.375C11.5 9.5375 10.8375 8.875 10 8.875C9.67734 8.875 9.37843 8.96833 9.13124 9.13479L5.96876 7.36521C6.02141 7.21131 6.05 7.04657 6.05 6.875C6.05 6.70343 6.02141 6.53869 5.96876 6.38479L9.13124 4.61521C9.37843 4.78167 9.67734 4.875 10 4.875V4.5Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </svg>
                <span>Share</span>
              </button>

              {(effectiveEvmAddress || effectiveSolanaAddress) && (
                <>
                  <span className="text-gray-700" aria-hidden="true">
                    ·
                  </span>
                  <LemmyTipButton
                    contentId={comment.id}
                    contentType="comment"
                    authorEvmAddress={effectiveEvmAddress}
                    authorSolanaAddress={effectiveSolanaAddress}
                    connectedProtocol={comment.authorProtocol}
                    tipCount={commentTipCount}
                    compact
                  />
                </>
              )}
            </div>

            {showReplyForm && (
              <ReplyForm
                parentId={comment.id}
                authorName={comment.author}
                onClose={() => setShowReplyForm(false)}
              />
            )}
          </>
        )}

        {/* Nested replies */}
        {hasReplies && comment.replies.length > 0 && (
          <div
            ref={contentRef}
            className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'}`}
          >
            <div className="mt-1">
              {comment.replies.map((reply) => (
                <CommentNode
                  key={reply.id}
                  comment={reply}
                  depth={depth + 1}
                  fallbackEvmAddress={effectiveEvmAddress}
                  fallbackSolanaAddress={effectiveSolanaAddress}
                  userVote={reply.userVote}
                  onVote={onVote}
                />
              ))}
            </div>
          </div>
        )}

        {swipeAction && (
          <div className="absolute inset-y-0 left-0 right-0 pointer-events-none flex items-center justify-center sm:hidden">
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-medium backdrop-blur-sm transition-all duration-300 ${swipeAction === 'vote' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}
            >
              {swipeAction === 'vote' ? 'Vote actions' : 'Reply'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

export { CommentNode };

// ─── Virtualized Comment List ───────────────────────────────────────

export const VirtualizedCommentList = memo(function VirtualizedCommentList({
  comments,
  depth,
  fallbackEvmAddress,
  fallbackSolanaAddress,
  onVote,
}: VirtualizedCommentListProps) {
  const [visibleRange, setVisibleRange] = useState({
    start: 0,
    end: Math.min(15, comments.length),
  });
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleRange.end >= comments.length) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleRange((prev) => ({ start: 0, end: Math.min(prev.end + 10, comments.length) }));
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [comments.length, visibleRange.end]);

  const visibleComments = useMemo(
    () => comments.slice(visibleRange.start, visibleRange.end),
    [comments, visibleRange],
  );

  return (
    <>
      {visibleComments.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          depth={depth}
          fallbackEvmAddress={fallbackEvmAddress}
          fallbackSolanaAddress={fallbackSolanaAddress}
          userVote={comment.userVote}
          onVote={onVote}
        />
      ))}
      {visibleRange.end < comments.length && (
        <div ref={sentinelRef} className="flex items-center justify-center py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-degen-400" />
        </div>
      )}
    </>
  );
});
