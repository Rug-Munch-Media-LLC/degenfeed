'use client';

import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { formatCount } from '@degenfeed/utils';
import { memo, useCallback, useState } from 'react';
import { getProtocolLabel as _getProtocolLabel } from './ProtocolBadge';
import { QuickTipButton } from './QuickTipButton';

// ─── Action vocabulary per protocol ──────────────────────────────

const ACTION_VERBS: Record<string, { repost: string; like: string; reply: string }> = {
  mastodon: { repost: 'Boost', like: 'Favorite', reply: 'Reply' },
  bluesky: { repost: 'Repost', like: 'Like', reply: 'Reply' },
  farcaster: { repost: 'Recast', like: 'Like', reply: 'Reply' },
  nostr: { repost: 'Repost', like: 'Zap', reply: 'Reply' },
  lens: { repost: 'Mirror', like: 'Like', reply: 'Comment' },
  lemmy: { repost: 'Boost', like: 'Upvote', reply: 'Reply' },
  reddit: { repost: 'Share', like: 'Upvote', reply: 'Reply' },
  rss: { repost: 'Share', like: 'Like', reply: 'Comment' },
  threads: { repost: 'Repost', like: 'Like', reply: 'Reply' },
  peertube: { repost: 'Share', like: 'Like', reply: 'Comment' },
};

function getActionVerb(protocol: string, action: 'repost' | 'like' | 'reply'): string {
  return ACTION_VERBS[protocol]?.[action] ?? action.charAt(0).toUpperCase() + action.slice(1);
}

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

// ─── Like Particle Burst ─────────────────────────────────────────

function LikeParticles({ active }: { active: boolean }) {
  if (!active) return null;
  const particles = [
    { dx: -10, dy: -12, color: '#f91880' },
    { dx: 10, dy: -12, color: '#ff6b9d' },
    { dx: -15, dy: -5, color: '#ff8fab' },
    { dx: 15, dy: -5, color: '#f91880' },
    { dx: 0, dy: -16, color: '#ff6b9d' },
  ];
  return (
    <>
      {particles.map((p, i) => (
        <span
          /* biome-ignore lint/suspicious/noArrayIndexKey: static ephemeral particle burst */
          key={i}
          className="like-particle"
          style={
            {
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              backgroundColor: p.color,
              animationDelay: `${i * 30}ms`,
            } as React.CSSProperties
          }
          aria-hidden="true"
        />
      ))}
    </>
  );
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
  const [likeParticles, setLikeParticles] = useState(false);

  const handleLike = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!localState.engagement.viewerLiked) {
        setLikeParticles(true);
        setTimeout(() => setLikeParticles(false), 600);
      }
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
            {/* TASK 4: Like button with Twitter-style heart animation + particle burst */}
            <button
              type="button"
              className={`action-btn group relative ${
                localState.engagement.viewerLiked ? 'liked' : ''
              }`}
              onClick={handleLike}
              aria-label={`${getActionVerb(post.protocol, 'like')} post`}
              aria-pressed={localState.engagement.viewerLiked}
            >
              <LikeParticles active={likeParticles} />
              <span
                className={`like-particle-container inline-block ${
                  animatingLike ? 'animate-heart-pop' : ''
                }`}
                aria-hidden="true"
              >
                {localState.engagement.viewerLiked ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="var(--color-like-active)"
                    aria-hidden="true"
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                )}
              </span>{' '}
              <span aria-label={`${localState.metrics.likes} ${getActionVerb(post.protocol, 'like').toLowerCase()}s`}>
                {formatCount(localState.metrics.likes)}
              </span>
            </button>

            {/* TASK 4: Repost with green pulse animation */}
            <button
              type="button"
              className={`action-btn group ${
                localState.engagement.viewerReposted ? 'reposted' : ''
              }`}
              onClick={handleRepost}
              aria-label={`${getActionVerb(post.protocol, 'repost')} post`}
              aria-pressed={localState.engagement.viewerReposted}
            >
              <span
                className={`inline-block ${animatingRepost ? 'animate-repost-pulse' : ''}`}
                aria-hidden="true"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7 23 3 19 7 15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              </span>{' '}
              <span aria-label={`${localState.metrics.reposts} ${getActionVerb(post.protocol, 'repost').toLowerCase()}s`}>
                {formatCount(localState.metrics.reposts)}
              </span>
            </button>

            {/* TASK 4: Reply button */}
            <button
              type="button"
              className={`action-btn group ${animatingReply ? 'animate-heart-pop' : ''}`}
              onClick={handleReplyToggle}
              aria-label={`${getActionVerb(post.protocol, 'reply')} to post`}
              aria-expanded={showReply}
            >
              <span className="inline-block" aria-hidden="true">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </span>{' '}
              <span
                aria-label={`${localState.metrics.replies} ${getActionVerb(post.protocol, 'reply').toLowerCase()}s`}
              >
                {formatCount(localState.metrics.replies)}
              </span>
            </button>

            {onCrossReplyOpen && (
              <button
                type="button"
                className="action-btn hover:text-purple-400"
                onClick={(e) => {
                  e.stopPropagation();
                  onCrossReplyOpen(post);
                }}
                aria-label="Reply from another protocol"
                title="Reply from another protocol via the DegenFeed bridge"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
                <span className="hidden sm:inline">Bridge</span>
              </button>
            )}

            {/* TASK 4: Bookmark with star fill animation */}
            <button
              type="button"
              className={`action-btn group ${
                localState.engagement.viewerBookmarked ? 'bookmarked' : ''
              }`}
              onClick={handleBookmark}
              aria-label="Bookmark post"
              aria-pressed={localState.engagement.viewerBookmarked}
            >
              <span
                className={`inline-block ${animatingBookmark ? 'animate-bookmark-pop' : ''}`}
                aria-hidden="true"
              >
                {localState.engagement.viewerBookmarked ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="var(--color-accent-secondary)"
                    aria-hidden="true"
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                )}
              </span>
            </button>
          </>
        )}
        <button
          type="button"
          className="action-btn hover:text-purple-400"
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
            className="action-btn hover:text-degen-400 font-mono"
            onClick={(e) => {
              e.stopPropagation();
              void navigator.clipboard.writeText(post.dfUri as string);
            }}
            aria-label="Copy df:// URI"
            title={post.dfUri as string}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span className="hidden sm:inline">df://</span>
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
            className="action-btn text-yellow-400 hover:text-yellow-300"
            onClick={(e) => {
              e.stopPropagation();
              onTip(post);
            }}
            aria-label={`${post.metrics.quotes} zaps for post`}
            title={`${post.metrics.quotes} zaps`}
          >
            <span className="inline-block tip-available">⚡</span>
            <span>{post.metrics.quotes}</span>
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
