import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { useEffect, useState } from 'react';
import { ProtocolBadge, getProtocolColor } from './ProtocolBadge';

export type { UnifiedPost };

export interface EngageResult {
  ok: boolean;
  error?: string;
}

export type EngageHandler = (
  action: EngagementAction,
  postId: string,
  content?: string,
) => Promise<EngageResult> | EngageResult;

export interface PostCardProps {
  post: UnifiedPost;
  onEngage?: EngageHandler;
  onClick?: (postId: string) => void;
  expanded?: boolean;
  onTip?: (post: UnifiedPost) => void;
  onPaywall?: (post: UnifiedPost) => void;
}

const MAX_TEXT_LENGTH = 500;

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface LocalState {
  engagement: UnifiedPost['engagement'];
  metrics: UnifiedPost['metrics'];
}

function applyOptimistic(state: LocalState, action: EngagementAction): LocalState {
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

export function PostCard({ post, onEngage, onClick, expanded, onTip, onPaywall }: PostCardProps) {
  const [showFullText, setShowFullText] = useState(expanded ?? false);
  const [localState, setLocalState] = useState<LocalState>({
    engagement: post.engagement,
    metrics: post.metrics,
  });
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    setLocalState({ engagement: post.engagement, metrics: post.metrics });
  }, [post.engagement, post.metrics]);

  const needsTruncation = !expanded && post.text.length > MAX_TEXT_LENGTH;
  const displayText =
    needsTruncation && !showFullText ? `${post.text.slice(0, MAX_TEXT_LENGTH)}...` : post.text;

  async function perform(action: EngagementAction, content?: string) {
    if (!onEngage) return;
    const previous = localState;
    setLocalState((s) => applyOptimistic(s, action));
    const result = await onEngage(action, post.id, content);
    if (!result.ok) {
      setLocalState(previous);
    } else if (action === 'reply') {
      setReplyText('');
      setShowReply(false);
    }
  }

  return (
    <article
      className="card cursor-pointer border-l-2 transition-all hover:border-l-4 hover:bg-gray-800/30"
      style={{ borderLeftColor: getProtocolColor(post.protocol) }}
      onClick={() => onClick?.(post.id)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick(post.id);
        }
      }}
      aria-label={`Post by ${post.author.displayName}`}
    >
      {/* Author row */}
      <div className="mb-2 flex items-center gap-3">
        <img
          src={
            post.author.avatarUrl ||
            'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 fill=%22%23333%22/%3E%3Ctext x=%2216%22 y=%2222%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2216%22%3E%40%3C/text%3E%3C/svg%3E'
          }
          alt={post.author.displayName}
          className="h-8 w-8 rounded-full bg-gray-800 object-cover"
          loading="lazy"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">
              {post.author.displayName}
            </span>
            <ProtocolBadge protocol={post.protocol} />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="truncate">
              {post.author.handles[post.protocol] ?? post.author.id.slice(0, 16)}
            </span>
            <span>·</span>
            <time
              dateTime={new Date(post.createdAt).toISOString()}
              title={new Date(post.createdAt).toLocaleString()}
            >
              {formatTime(post.createdAt)}
            </time>
          </div>
        </div>
      </div>

      {/* Content */}
      {post.paywall && (
        <div className="mb-3 rounded-xl border border-purple-900/30 bg-purple-900/10 p-4 text-center">
          <div className="mb-2 text-2xl">🔒</div>
          <p className="mb-3 text-sm text-gray-400">This post is locked.</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPaywall?.(post);
            }}
            className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition-colors"
          >
            Unlock for {post.paywall.amount} SOL
          </button>
        </div>
      )}
      <div className="mb-3 text-sm text-gray-300 whitespace-pre-wrap break-words">
        {displayText}
        {needsTruncation && !showFullText && (
          <button
            type="button"
            className="ml-1 text-degen-500 hover:text-degen-400 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setShowFullText(true);
            }}
          >
            Show more
          </button>
        )}
      </div>

      {/* Embeds */}
      {post.embeds.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {post.embeds.slice(0, 4).map((embed) =>
            embed.kind === 'image' ? (
              <img
                key={`img-${embed.url}`}
                src={embed.url}
                alt=""
                className="max-h-48 rounded-lg object-cover"
                loading="lazy"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
            ) : embed.kind === 'link' ? (
              <a
                key={`link-${embed.url}`}
                href={embed.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-lg border border-gray-700 bg-gray-800/50 p-2 text-xs text-degen-500 hover:text-degen-400 transition-colors truncate"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {embed.url.replace(/^https?:\/\//, '').slice(0, 60)}
              </a>
            ) : null,
          )}
        </div>
      )}

      {post.niches.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {post.niches.slice(0, 5).map((n) => (
            <span
              key={n}
              className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-400"
            >
              {n}
            </span>
          ))}
        </div>
      )}

      {/* Engagement metrics + Tip */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <button
          type="button"
          className={`flex items-center gap-1 transition-colors hover:text-red-400 ${localState.engagement.viewerLiked ? 'text-red-400' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            void perform(localState.engagement.viewerLiked ? 'unlike' : 'like');
          }}
          aria-label={`${localState.metrics.likes} likes`}
        >
          {localState.engagement.viewerLiked ? '❤' : '♡'} {formatCount(localState.metrics.likes)}
        </button>
        <button
          type="button"
          className={`flex items-center gap-1 transition-colors hover:text-green-400 ${localState.engagement.viewerReposted ? 'text-green-400' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            void perform(localState.engagement.viewerReposted ? 'unrepost' : 'repost');
          }}
          aria-label={`${localState.metrics.reposts} reposts`}
        >
          ↻ {formatCount(localState.metrics.reposts)}
        </button>
        <button
          type="button"
          className="flex items-center gap-1 transition-colors hover:text-blue-400"
          onClick={(e) => {
            e.stopPropagation();
            setShowReply((v) => !v);
          }}
          aria-label={`${localState.metrics.replies} replies`}
        >
          ↩ {formatCount(localState.metrics.replies)}
        </button>
        <button
          type="button"
          className={`flex items-center gap-1 transition-colors hover:text-purple-400 ${localState.engagement.viewerBookmarked ? 'text-purple-400' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            void perform(localState.engagement.viewerBookmarked ? 'unbookmark' : 'bookmark');
          }}
          aria-label={localState.engagement.viewerBookmarked ? 'Bookmarked' : 'Bookmark'}
        >
          {localState.engagement.viewerBookmarked ? '🔖' : '🔖'}
        </button>
        <button
          type="button"
          className="flex items-center gap-1 transition-colors hover:text-purple-400"
          onClick={(e) => {
            e.stopPropagation();
            void navigator.clipboard.writeText(
              `${window.location.origin}/post/${encodeURIComponent(post.id)}`,
            );
          }}
          aria-label="Share"
        >
          ↗ Share
        </button>
        {onTip && (
          <button
            type="button"
            className="ml-auto flex items-center gap-1 transition-colors hover:text-yellow-400"
            onClick={(e) => {
              e.stopPropagation();
              onTip(post);
            }}
            aria-label="Tip this author"
            title={`Tip ${post.author.displayName}`}
          >
            ⚡ Tip
          </button>
        )}
      </div>

      {showReply && (
        <form
          className="mt-3 flex gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            if (!replyText.trim()) return;
            void perform('reply', replyText.trim());
          }}
        >
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-degen-500 focus:outline-none"
            maxLength={1000}
          />
          <button type="submit" className="btn-primary text-xs">
            Reply
          </button>
        </form>
      )}
    </article>
  );
}
