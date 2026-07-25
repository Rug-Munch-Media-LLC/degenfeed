'use client';

/**
 * CrossPlatformComments — Unified comment feed across all protocols.
 *
 * Aggregates comments from Loops, PeerTube, AT Protocol, Nostr, Farcaster,
 * Lens, YouTube, TikTok, Instagram into a single chronological feed.
 * Each comment shows its source protocol badge.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { sourceBadgeData } from './ShortsSourceBadge';

// ─── Types ───────────────────────────────────────────────────────────────

export interface CrossPlatformComment {
  id: string;
  shortId: string;
  text: string;
  authorName: string;
  authorAvatar?: string;
  authorHandle?: string;
  source: string;
  sourceLabel: string;
  createdAt: number;
  likes: number;
  liked?: boolean;
}

interface CrossPlatformCommentsProps {
  shortId: string;
  /** Which protocols this short is available on — fetches comments from each */
  availableProtocols: string[];
  /** Total comment count across all platforms */
  totalCommentCount?: number;
  /** Callback when user submits a new comment */
  onSubmitComment?: (text: string, protocol: string) => Promise<void>;
  /** Callback when user likes a comment */
  onLikeComment?: (commentId: string) => void;
  /** Whether to show in compact mode (for overlay) */
  compact?: boolean;
}

// ─── Mock protocol colors (matching ShortsSourceBadge) ───────────────────

const PROTOCOL_LABELS: Record<string, string> = {
  loops: 'Loops',
  peertube: 'PeerTube',
  atprotocol: 'AT Protocol',
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  pixelfed: 'Pixelfed',
  degenfeed: 'DegenFeed',
};

// ─── Format helpers ──────────────────────────────────────────────────────

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// ─── Component ───────────────────────────────────────────────────────────

export function CrossPlatformComments({
  shortId,
  availableProtocols,
  totalCommentCount,
  onSubmitComment,
  onLikeComment,
  compact = false,
}: CrossPlatformCommentsProps) {
  const [comments, setComments] = useState<CrossPlatformComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [selectedProtocol, setSelectedProtocol] = useState(availableProtocols[0] || 'degenfeed');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fetch comments on mount & refresh ──────────────────────────────

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const protocols = availableProtocols.join(',');
      const res = await fetch(
        `/api/shorts/${shortId}/comments?protocols=${encodeURIComponent(protocols)}`,
        { credentials: 'include' },
      );

      if (!res.ok) throw new Error(`Comments returned ${res.status}`);

      const data = (await res.json()) as { comments: CrossPlatformComment[] };
      // Sort: newest first
      const sorted = (data.comments ?? []).sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      setComments(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [shortId, availableProtocols]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  // ── Submit comment ─────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newComment.trim() || submitting) return;

      setSubmitting(true);
      try {
        if (onSubmitComment) {
          await onSubmitComment(newComment.trim(), selectedProtocol);
        } else {
          // Default: POST to unified comments API
          const res = await fetch(`/api/shorts/${shortId}/comments`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              text: newComment.trim(),
              protocol: selectedProtocol,
            }),
          });
          if (!res.ok) throw new Error('Failed to post comment');
        }

        setNewComment('');
        // Refresh comments to include the new one
        await fetchComments();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to post');
      } finally {
        setSubmitting(false);
      }
    },
    [newComment, selectedProtocol, submitting, onSubmitComment, shortId, fetchComments],
  );

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div
      className={`flex flex-col ${compact ? 'max-h-80' : 'max-h-[60vh]'} overflow-hidden rounded-xl border border-white/[0.06] bg-black/60 backdrop-blur-lg`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <h3 className="text-xs font-semibold text-white/80">
          Comments
          {totalCommentCount != null && (
            <span className="ml-1.5 text-[10px] text-white/40">
              · {totalCommentCount} total
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1 text-[9px] text-white/40">
          {availableProtocols.map((p) => {
            const badge = sourceBadgeData(p);
            return (
              <span
                key={p}
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5"
                style={{
                  backgroundColor: `${badge.color}15`,
                  color: badge.color,
                }}
              >
                {badge.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading && comments.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border border-white/20 border-t-degen-400" />
          </div>
        )}

        {error && (
          <div className="px-3 py-4 text-center">
            <p className="text-[11px] text-red-400/80">{error}</p>
            <button
              type="button"
              onClick={() => void fetchComments()}
              className="mt-1 text-[10px] text-degen-400 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && comments.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-[11px] text-white/40">
              No comments yet. Be the first!
            </p>
          </div>
        )}

        {comments.map((comment) => {
          const badge = sourceBadgeData(comment.source);
          return (
            <div
              key={comment.id}
              className="flex gap-2 border-b border-white/[0.03] px-3 py-2 transition-colors hover:bg-white/[0.02]"
            >
              {/* Avatar */}
              {comment.authorAvatar ? (
                <img
                  src={comment.authorAvatar}
                  alt={comment.authorName}
                  className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{ backgroundColor: `${badge.color}20`, color: badge.color }}
                >
                  {comment.authorName.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-white/90 truncate">
                    {comment.authorName}
                  </span>
                  {comment.authorHandle && (
                    <span className="text-[9px] text-white/40 truncate">
                      @{comment.authorHandle}
                    </span>
                  )}
                  <span className="text-[9px] text-white/30">·</span>
                  <span className="text-[9px] text-white/30 shrink-0">
                    {formatTimeAgo(comment.createdAt)}
                  </span>
                  {/* Source badge */}
                  <span
                    className="shrink-0 rounded px-1 py-0.5 text-[8px] font-medium uppercase tracking-wider"
                    style={{
                      backgroundColor: `${badge.color}15`,
                      color: badge.color,
                    }}
                  >
                    {badge.label}
                  </span>
                </div>

                <p className="mt-0.5 text-[11px] leading-snug text-white/70">
                  {comment.text}
                </p>

                {/* Like button */}
                <button
                  type="button"
                  onClick={() => onLikeComment?.(comment.id)}
                  className="mt-0.5 flex items-center gap-1 text-[9px] text-white/40 transition-colors hover:text-white/70"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill={comment.liked ? 'currentColor' : 'none'}
                    className={comment.liked ? 'text-red-400' : ''}
                  >
                    <path
                      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {comment.likes > 0 && (
                    <span>{comment.likes}</span>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comment input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-2"
      >
        {/* Protocol selector */}
        {availableProtocols.length > 0 && (
          <select
            value={selectedProtocol}
            onChange={(e) => setSelectedProtocol(e.target.value)}
            className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-1 text-[9px] text-white/60 outline-none"
            aria-label="Comment protocol"
          >
            {availableProtocols.map((p) => (
              <option key={p} value={p}>
                {PROTOCOL_LABELS[p] || p}
              </option>
            ))}
          </select>
        )}

        <input
          ref={inputRef}
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          maxLength={500}
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/40"
          disabled={submitting}
        />

        <button
          type="submit"
          disabled={!newComment.trim() || submitting}
          className="shrink-0 rounded-lg bg-degen-500 px-2.5 py-1.5 text-[10px] font-semibold text-black transition-all hover:bg-degen-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-black/30 border-t-black" />
          ) : (
            'Post'
          )}
        </button>
      </form>
    </div>
  );
}
