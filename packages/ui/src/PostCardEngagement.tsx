import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { formatCount } from '@degenfeed/utils';
import { memo } from 'react';
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
}: PostCardEngagementProps) {
  return (
    <>
      <div className="actions flex items-center gap-4 text-xs text-gray-500">
        {post.protocol === 'lemmy' ? (
          <span className="text-xs text-gray-500">
            {formatCount(post.metrics.likes)} ↑ {formatCount(
              (post.raw as { counts?: { downvotes?: number } } | undefined)?.counts?.downvotes ?? 0,
            )} ↓
          </span>
        ) : (
          <>
            <button
              type="button"
              className={`flex items-center gap-1 transition-colors hover:text-red-400 press-effect ${
                localState.engagement.viewerLiked ? 'text-red-400' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                void onPerform(localState.engagement.viewerLiked ? 'unlike' : 'like');
              }}
              aria-label="Like post"
              aria-pressed={localState.engagement.viewerLiked}
            >
              <span
                className={`inline-block ${animatingLike ? 'animate-heart-pop' : ''}`}
                style={{
                  transformOrigin: 'center',
                  transition: 'transform var(--duration-fast) ease-out',
                }}
              >
                {localState.engagement.viewerLiked ? '❤' : '♡'}
              </span>{' '}
              <span aria-label={`${localState.metrics.likes} likes`}>{formatCount(localState.metrics.likes)}</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 transition-colors hover:text-green-400 ${localState.engagement.viewerReposted ? 'text-green-400' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                void onPerform(localState.engagement.viewerReposted ? 'unrepost' : 'repost');
              }}
              aria-label="Repost post"
              aria-pressed={localState.engagement.viewerReposted}
            >
              ↻ <span aria-label={`${localState.metrics.reposts} reposts`}>{formatCount(localState.metrics.reposts)}</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1 transition-colors hover:text-blue-400"
              onClick={(e) => {
                e.stopPropagation();
                onSetShowReply(!showReply);
              }}
              aria-label="Reply to post"
            >
              ↩ <span aria-label={`${localState.metrics.replies} replies`}>{formatCount(localState.metrics.replies)}</span>
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
              className={`flex items-center gap-1 transition-colors hover:text-purple-400 ${localState.engagement.viewerBookmarked ? 'text-purple-400' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                void onPerform(localState.engagement.viewerBookmarked ? 'unbookmark' : 'bookmark');
              }}
              aria-label="Bookmark post"
              aria-pressed={localState.engagement.viewerBookmarked}
            >
              {localState.engagement.viewerBookmarked ? '🔖' : '📑'}
            </button>
          </>
        )}
        <button
          type="button"
          className="flex items-center gap-1 transition-colors hover:text-purple-400"
          onClick={(e) => {
            e.stopPropagation();
            void onShare();
          }}
          aria-label="Share post"
        >
          ↗ Share
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
            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1.5 text-sm text-[var(--color-fg)] placeholder-gray-600 focus:border-degen-500 focus:outline-none"
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
