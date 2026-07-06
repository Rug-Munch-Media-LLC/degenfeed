import type { UnifiedPost } from '@degenfeed/types';
import { useState } from 'react';
import { ProtocolBadge, getProtocolColor } from './ProtocolBadge';

export type { UnifiedPost };

export interface PostCardProps {
  post: UnifiedPost;
  onEngage?: (action: 'like' | 'repost' | 'reply', postId: string) => void;
  onClick?: (postId: string) => void;
  expanded?: boolean;
  /** Called when user clicks the tip button for this post's author */
  onTip?: (post: UnifiedPost) => void;
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

export function PostCard({ post, onEngage, onClick, expanded, onTip }: PostCardProps) {
  const [showFullText, setShowFullText] = useState(expanded ?? false);
  const needsTruncation = !expanded && post.text.length > MAX_TEXT_LENGTH;
  const displayText =
    needsTruncation && !showFullText ? `${post.text.slice(0, MAX_TEXT_LENGTH)}...` : post.text;

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

      {/* Engagement metrics + Tip */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <button
          type="button"
          className={`flex items-center gap-1 transition-colors hover:text-red-400 ${post.engagement.viewerLiked ? 'text-red-400' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onEngage?.('like', post.id);
          }}
          aria-label={`${post.metrics.likes} likes`}
        >
          {post.engagement.viewerLiked ? '❤' : '♡'} {formatCount(post.metrics.likes)}
        </button>
        <button
          type="button"
          className={`flex items-center gap-1 transition-colors hover:text-green-400 ${post.engagement.viewerReposted ? 'text-green-400' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onEngage?.('repost', post.id);
          }}
          aria-label={`${post.metrics.reposts} reposts`}
        >
          ↻ {formatCount(post.metrics.reposts)}
        </button>
        <button
          type="button"
          className="flex items-center gap-1 transition-colors hover:text-blue-400"
          onClick={(e) => {
            e.stopPropagation();
            onEngage?.('reply', post.id);
          }}
          aria-label={`${post.metrics.replies} replies`}
        >
          ↩ {formatCount(post.metrics.replies)}
        </button>
        {/* Tip button */}
        {onTip && (
          <button
            type="button"
            className="flex items-center gap-1 transition-colors hover:text-yellow-400 ml-auto"
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
    </article>
  );
}
