'use client';

/**
 * @degenfeed/ui — LemmyThreadView
 *
 * Renders a Lemmy post as a threaded Reddit-style discussion.
 * Shows community name, upvotes/downvotes, nested comments with
 * colored thread lines (like old Reddit), and links to the
 * community instance.
 *
 * Design: compact, nested, green-accent threaded lines.
 * Tonal reference: old.reddit.com — dense, information-rich.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { memo, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────

export interface LemmyComment {
  id: string;
  author: string;
  authorAvatar?: string;
  content: string;
  score: number;
  upvotes: number;
  downvotes: number;
  createdAt: number;
  depth: number;
  replies: LemmyComment[];
}

export interface LemmyThreadViewProps {
  post: UnifiedPost;
  /** Optionally pass pre-fetched comments. Falls back to post.raw. */
  comments?: LemmyComment[];
  communityName?: string;
  communityIcon?: string;
  /** Instance domain, e.g. "lemmy.world" */
  instanceDomain?: string;
}

// ─── Colors for thread lines ────────────────────────────────────────

const THREAD_COLORS = [
  '#00b868', // Lemmy green
  '#6364ff', // Mastodon purple
  '#ff4500', // Reddit orange
  '#1185fe', // Blue
  '#abfe2c', // Lens green
  '#e040fb', // Pink
  '#ffa726', // Amber
];

function getThreadColor(depth: number): string {
  return THREAD_COLORS[depth % THREAD_COLORS.length] ?? '#6364ff';
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatScore(n: number): string {
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

// ─── Single Comment Node ────────────────────────────────────────────

interface CommentNodeProps {
  comment: LemmyComment;
  depth: number;
}

const CommentNode = memo(function CommentNode({ comment, depth }: CommentNodeProps) {
  const [collapsed, setCollapsed] = useState(false);
  const color = getThreadColor(depth);
  const hasReplies = comment.replies.length > 0;

  return (
    <div className="group">
      <div className="flex">
        {/* Thread line column */}
        <div className="relative flex w-5 flex-shrink-0 flex-col items-center">
          {/* Vertical thread line */}
          <div
            className="w-0.5 flex-1 transition-opacity group-hover:opacity-80"
            style={{ backgroundColor: color, opacity: 0.4 }}
          />
          {/* Collapse handle dot */}
          {hasReplies && (
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="absolute top-3 z-10 h-3 w-3 rounded-full border-2 bg-[var(--color-card)] transition-transform hover:scale-125"
              style={{ borderColor: color, backgroundColor: collapsed ? color : '#030712' }}
              aria-label={collapsed ? 'Expand thread' : 'Collapse thread'}
            />
          )}
        </div>

        {/* Comment body */}
        <div className="min-w-0 flex-1 pb-2 pl-1.5">
          <div className="rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.03]">
            {/* Author row */}
            <div className="mb-1 flex items-center gap-2 text-xs">
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold uppercase"
                style={{ backgroundColor: `${color}22`, color }}
              >
                {comment.authorAvatar ? (
                  <img
                    src={comment.authorAvatar}
                    alt=""
                    className="h-4 w-4 rounded-full object-cover"
                  />
                ) : (
                  comment.author.charAt(0)
                )}
              </span>
              <span className="font-medium text-gray-300">{comment.author}</span>
              <span className="text-gray-600">{timeAgo(comment.createdAt)}</span>
              {collapsed && hasReplies && (
                <span className="text-gray-600">[{comment.replies.length} more]</span>
              )}
            </div>

            {/* Content (hidden when collapsed) */}
            {!collapsed && (
              <>
                <div className="mb-1.5 text-sm leading-relaxed text-gray-400 whitespace-pre-wrap break-words">
                  {comment.content}
                </div>

                {/* Score row */}
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <button
                    type="button"
                    className="flex items-center gap-0.5 transition-colors hover:text-orange-400"
                    aria-label="Upvote"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M6 1L11 9H1L6 1Z" />
                    </svg>
                    <span className="font-medium tabular-nums">{formatScore(comment.score)}</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-0.5 transition-colors hover:text-blue-400"
                    aria-label="Downvote"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M6 11L1 3H11L6 11Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="transition-colors hover:text-gray-400"
                    aria-label="Reply"
                  >
                    Reply
                  </button>
                </div>
              </>
            )}

            {/* Nested replies */}
            {!collapsed && hasReplies && (
              <div className="mt-1">
                {comment.replies.map((reply) => (
                  <CommentNode key={reply.id} comment={reply} depth={depth + 1} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Root Component ─────────────────────────────────────────────────

function extractLemmyData(post: UnifiedPost): {
  communityName: string;
  communityIcon?: string;
  instanceDomain: string;
} {
  const raw = post.raw as Record<string, unknown> | undefined;
  return {
    communityName:
      (raw?.community_name as string) ?? ((raw?.community as Record<string, string> | undefined)?.name) ?? 'c/crypto',
    communityIcon: raw?.community_icon as string | undefined,
    instanceDomain:
      (raw?.instance_domain as string) ?? (raw?.instance as string) ?? 'lemmy.degenfeed.xyz',
  };
}

export const LemmyThreadView = memo(function LemmyThreadView({
  post,
  comments: externalComments,
  communityName: externalCommunityName,
  communityIcon: externalCommunityIcon,
  instanceDomain: externalInstanceDomain,
}: LemmyThreadViewProps) {
  const { communityName, communityIcon, instanceDomain } = {
    communityName: externalCommunityName ?? extractLemmyData(post).communityName,
    communityIcon: externalCommunityIcon ?? extractLemmyData(post).communityIcon,
    instanceDomain: externalInstanceDomain ?? extractLemmyData(post).instanceDomain,
  };

  // Derive comments from post.raw if not pre-fetched
  const comments = externalComments ?? extractComments(post);

  const domainDisplay = instanceDomain.replace(/^https?:\/\//, '');

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]">
      {/* ── Community header ── */}
      <a
        href={`https://${domainDisplay}/${communityName.startsWith('c/') ? communityName : `c/${communityName}`}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5 transition-colors hover:bg-[var(--color-muted)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
          style={{ backgroundColor: '#00b86822', color: '#00b868' }}
        >
          {communityIcon ? (
            <img src={communityIcon} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            communityName.charAt(0).toUpperCase()
          )}
        </span>
        <span className="text-sm font-semibold text-gray-200">{communityName}</span>
        <span className="ml-auto text-xs text-gray-600">
          View on <span className="text-degen-500">{domainDisplay}</span>
        </span>
      </a>

      {/* ── Post header (upvote + title) ── */}
      <div className="flex gap-3 px-4 py-3">
        {/* Upvote/downvote column (Reddit-style) */}
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          <button
            type="button"
            className="rounded p-1 text-gray-600 transition-colors hover:bg-orange-500/10 hover:text-orange-400"
            aria-label="Upvote"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <path d="M9 2L16 14H2L9 2Z" />
            </svg>
          </button>
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: post.metrics.likes >= 0 ? '#00b868' : '#6b7280' }}
          >
            {formatScore(post.metrics.likes - post.metrics.reposts || post.metrics.likes)}
          </span>
          <button
            type="button"
            className="rounded p-1 text-gray-600 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
            aria-label="Downvote"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <path d="M9 16L2 4H16L9 16Z" />
            </svg>
          </button>
        </div>

        {/* Post content area */}
        <div className="min-w-0 flex-1">
          {/* Title */}
          <h3 className="mb-1 text-sm font-semibold leading-snug text-gray-100">
            {post.text.split('\n')[0] || post.text.slice(0, 120)}
          </h3>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span>
              Posted by <span className="font-medium text-gray-500">{post.author.displayName}</span>
            </span>
            <span>·</span>
            <span>{post.metrics.replies} comments</span>
            <span>·</span>
            <span>{post.metrics.reposts} shares</span>
          </div>
        </div>
      </div>

      {/* ── Comments section ── */}
      {comments.length > 0 && (
        <div className="border-t border-[var(--color-border)] px-2 py-2">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
            Comments ({comments.length})
          </div>
          {comments.map((comment) => (
            <CommentNode key={comment.id} comment={comment} depth={0} />
          ))}
        </div>
      )}

      {/* ── "View on community" link ── */}
      <a
        href={`https://${domainDisplay}/${communityName.startsWith('c/') ? communityName : `c/${communityName}`}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center border-t border-[var(--color-border)] px-4 py-2 text-xs text-degen-500 transition-colors hover:bg-[var(--color-muted)] hover:text-degen-400"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="mr-1"
          aria-hidden="true"
        >
          <path
            d="M5 2H2V10H10V7M6 6L10 2M10 2H7M10 2V5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        View on community.degenfeed.xyz
      </a>
    </div>
  );
});

// ─── Fallback comment extraction from raw ───────────────────────────

function extractComments(post: UnifiedPost): LemmyComment[] {
  const raw = post.raw as Record<string, unknown> | undefined;
  if (raw?.comments && Array.isArray(raw.comments)) {
    return buildCommentTree(raw.comments as RawComment[]);
  }
  // Generate a sample comment tree from post data for demo purposes
  return [];
}

interface RawComment {
  id: string;
  author: string;
  author_avatar?: string;
  content: string;
  score: number;
  upvotes?: number;
  downvotes?: number;
  created_at?: number;
  path?: string;
  parent_id?: string;
}

function buildCommentTree(flat: RawComment[]): LemmyComment[] {
  const map = new Map<string, LemmyComment & { parentId?: string }>();
  const roots: LemmyComment[] = [];

  // First pass: create nodes
  for (const rc of flat) {
    map.set(rc.id, {
      id: rc.id,
      author: rc.author,
      authorAvatar: rc.author_avatar,
      content: rc.content,
      score: rc.score ?? (rc.upvotes ?? 0) - (rc.downvotes ?? 0),
      upvotes: rc.upvotes ?? 0,
      downvotes: rc.downvotes ?? 0,
      createdAt: rc.created_at ?? Date.now(),
      depth: rc.path ? rc.path.split('.').length - 2 : 0,
      replies: [],
      parentId: rc.parent_id,
    });
  }

  // Second pass: link parents
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)?.replies.push(node as LemmyComment);
    } else {
      roots.push(node as LemmyComment);
    }
  }

  return roots;
}
