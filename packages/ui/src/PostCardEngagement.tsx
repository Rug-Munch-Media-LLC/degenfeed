'use client';

import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { formatCount } from '@degenfeed/utils';
import { memo, useCallback, useState } from 'react';
import { getProtocolLabel as _getProtocolLabel } from './ProtocolBadge';
import { QuickTipButton } from './QuickTipButton';

// ─── Types ─────────────────────────────────────────────────────────

export interface EngageResult {
  ok: boolean;
  error?: string;
}

export type EngageHandler = (
  action: EngagementAction,
  postId: string,
  content?: string,
) => Promise<EngageResult> | EngageResult;

interface LocalState {
  engagement: UnifiedPost['engagement'];
  metrics: UnifiedPost['metrics'];
}

export function applyOptimistic(state: LocalState, action: EngagementAction): LocalState {
  const { engagement, metrics } = state;
  switch (action) {
    case 'like':
      return {
        engagement: { ...engagement, viewerLiked: true },
        metrics: { ...metrics, likes: metrics.likes + 1 },
      };
    case 'unlike':
      return {
        engagement: { ...engagement, viewerLiked: false },
        metrics: { ...metrics, likes: Math.max(0, metrics.likes - 1) },
      };
    case 'repost':
      return {
        engagement: { ...engagement, viewerReposted: true },
        metrics: { ...metrics, reposts: metrics.reposts + 1 },
      };
    case 'unrepost':
      return {
        engagement: { ...engagement, viewerReposted: false },
        metrics: { ...metrics, reposts: Math.max(0, metrics.reposts - 1) },
      };
    case 'bookmark':
      return {
        engagement: { ...engagement, viewerBookmarked: true },
        metrics,
      };
    case 'unbookmark':
      return {
        engagement: { ...engagement, viewerBookmarked: false },
        metrics,
      };
    case 'reply':
      return {
        engagement,
        metrics: { ...metrics, replies: metrics.replies + 1 },
      };
    case 'react':
      return { engagement, metrics };
    default:
      return state;
  }
}

// ─── Props ─────────────────────────────────────────────────────────

export interface PostCardEngagementProps {
  post: UnifiedPost;
  localState: LocalState;
  bridgeReplies: Record<string, number> | null;
  showReply: boolean;
  replyText: string;
  animatingLike: boolean;
  onPerform: (action: EngagementAction, content?: string) => Promise<void> | void;
  onSetShowReply: (v: boolean) => void;
  onSetReplyText: (v: string) => void;
  onShare: () => void;
  onTip?: (post: UnifiedPost) => void;
  onCrossReplyOpen?: (post: UnifiedPost) => void;
  viewerProtocols?: string[];
  /** New: called when user opens the enhanced share sheet */
  onOpenShareSheet?: () => void;
}

// ─── Component ─────────────────────────────────────────────────────

export const PostCardEngagement = memo(function PostCardEngagement({
  post,
  localState,
  bridgeReplies,
  showReply,
  replyText,
  animatingLike,
  onPerform,
  onSetShowReply,
  onSetReplyText,
  onShare,
  onTip,
  onCrossReplyOpen,
  onOpenShareSheet,
}: PostCardEngagementProps) {
  const [animatingRepost, setAnimatingRepost] = useState(false);
  const [animatingBookmark, setAnimatingBookmark] = useState(false);
  const [animatingReply, setAnimatingReply] = useState(false);

  const handleLike = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void onPerform(localState.engagement.viewerLiked ? 'unlike' : 'like');
    },
    [onPerform, localState.engagement.viewerLiked],
  );

  const handleRepost = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setAnimatingRepost(true);
      setTimeout(() => setAnimatingRepost(false), 400);
      void onPerform(localState.engagement.viewerReposted ? 'unrepost' : 'repost');
    },
    [onPerform, localState.engagement.viewerReposted],
  );

  const handleBookmark = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setAnimatingBookmark(true);
      setTimeout(() => setAnimatingBookmark(false), 400);
      void onPerform(localState.engagement.viewerBookmarked ? 'unbookmark' : 'bookmark');
    },
    [onPerform, localState.engagement.viewerBookmarked],
  );

  const handleReplyToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setAnimatingReply(true);
      setTimeout(() => setAnimatingReply(false), 300);
      onSetShowReply(!showReply);
    },
    [onSetShowReply, showReply],
  );

  const handleShareClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onOpenShareSheet) {
        onOpenShareSheet();
      } else {
        onShare();
      }
    },
    [onOpenShareSheet, onShare],
  );

  return (
    <>
      <div className="actions flex items-center gap-4 text-xs text-[var(--color-muted)]">
        {post.protocol === 'lemmy' ? (
          <span className="text-xs text-[var(--color-muted)]">
            {formatCount(post.metrics.likes)} ↑{' '}
            {formatCount(
              (post.raw as { counts?: { downvotes?: number } } | undefined)?.counts?.downvotes ?? 0,
            )}{' '}
            ↓
          </span>
        ) : (
          <>
            <button
              type="button"
              className={`flex items-center gap-1 transition-all duration-200 hover:text-red-400 press-effect ${
                localState.engagement.viewerLiked ? 'text-red-400' : 'text-[var(--color-muted)]'
              }`}
              onClick={handleLike}
              aria-label="Like post"
              aria-pressed={localState.engagement.viewerLiked}
            >
              <span
                className={`inline-block transition-transform duration-200 ${
                  animatingLike ? 'animate-heart-bounce' : ''
                } ${localState.engagement.viewerLiked ? 'scale-110' : ''}`}
                style={{
                  transformOrigin: 'center',
                }}
                aria-hidden="true"
              >
                {localState.engagement.viewerLiked ? '❤️' : '♡'}
              </span>{' '}
              <span aria-label={`${localState.metrics.likes} likes`}>
                {formatCount(localState.metrics.likes)}
              </span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 transition-all duration-200 hover:text-green-400 ${
                localState.engagement.viewerReposted
                  ? 'text-green-400'
                  : 'text-[var(--color-muted)]'
              }`}
              onClick={handleRepost}
              aria-label="Repost post"
              aria-pressed={localState.engagement.viewerReposted}
            >
              <span
                className={`inline-block ${animatingRepost ? 'animate-repost-spin' : ''}`}
                aria-hidden="true"
              >
                ↻
              </span>{' '}
              <span aria-label={`${localState.metrics.reposts} reposts`}>
                {formatCount(localState.metrics.reposts)}
              </span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 transition-all duration-200 hover:text-blue-400 ${
                animatingReply ? 'scale-110' : ''
              }`}
              onClick={handleReplyToggle}
              aria-label="Reply to post"
              aria-expanded={showReply}
            >
              <span className="inline-block transition-transform" aria-hidden="true">
                ↩
              </span>{' '}
              <span aria-label={`${localState.metrics.replies} replies`}>
                {formatCount(localState.metrics.replies)}
              </span>
            </button>
            {onCrossReplyOpen && (
              <button
                type="button"
                className="flex items-center gap-1 transition-colors hover:text-purple-400"
                onClick={(e) => {
                  e.stopPropagation();
                  onCrossReplyOpen(post);
                }}
                aria-label="Reply from another protocol"
                title="Reply from another protocol via the DegenFeed bridge"
              >
                ⇄ <span className="hidden sm:inline">Bridge</span>
              </button>
            )}
            <button
              type="button"
              className={`flex items-center gap-1 transition-all duration-200 hover:text-purple-400 ${
                localState.engagement.viewerBookmarked
                  ? 'text-purple-400'
                  : 'text-[var(--color-muted)]'
              }`}
              onClick={handleBookmark}
              aria-label="Bookmark post"
              aria-pressed={localState.engagement.viewerBookmarked}
            >
              <span
                className={`inline-block ${animatingBookmark ? 'animate-bookmark-pop' : ''}`}
                aria-hidden="true"
              >
                {localState.engagement.viewerBookmarked ? '🔖' : '📑'}
              </span>
            </button>
          </>
        )}
        <button
          type="button"
          className="flex items-center gap-1 transition-all duration-200 hover:text-purple-400 text-[var(--color-muted)]"
          onClick={handleShareClick}
          aria-label="Share post"
          title="Share post to other platforms"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          <span className="hidden sm:inline">Share</span>
        </button>
        {post.dfUri && (
          <button
            type="button"
            className="flex items-center gap-1 font-mono text-xs transition-colors hover:text-degen-400"
            onClick={(e) => {
              e.stopPropagation();
              void navigator.clipboard.writeText(post.dfUri as string);
            }}
            aria-label="Copy df:// URI"
            title={post.dfUri as string}
          >
            ⛓ df://
          </button>
        )}
        {onTip && (
          <QuickTipButton
            postId={post.id}
            authorAddress={post.author.keys.evmAddress || post.author.keys.solanaAddress}
            tipCount={post.tipCount}
            onOpenModal={() => onTip(post)}
          />
        )}
        {post.protocol === 'nostr' && post.metrics.quotes > 0 && onTip && (
          <button
            type="button"
            className="flex items-center gap-1 text-yellow-400 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onTip(post);
            }}
            aria-label={`${post.metrics.quotes} zaps for post`}
            title={`${post.metrics.quotes} zaps`}
          >
            ⚡{post.metrics.quotes}
          </button>
        )}
      </div>

      {bridgeReplies && Object.keys(bridgeReplies).length > 0 && (
        <p
          className="mt-2 flex items-center gap-1.5 text-[11px] text-purple-300"
          title="Cross-protocol replies bridged via DegenFeed"
        >
          <span className="font-bold text-purple-400">⇄</span>
          Replies from:{' '}
          {Object.entries(bridgeReplies)
            .map(([protocol, count]) => `${_getProtocolLabel(protocol)} (${count})`)
            .join(', ')}
        </p>
      )}

      {showReply && (
        <form
          className="mt-3 flex gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            if (!replyText.trim()) return;
            void onPerform('reply', replyText.trim());
          }}
        >
          <input
            type="text"
            value={replyText}
            onChange={(e) => onSetReplyText(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-glow)]"
            maxLength={1000}
          />
          <button type="submit" className="btn-primary text-xs">
            Reply
          </button>
        </form>
      )}
    </>
  );
});
