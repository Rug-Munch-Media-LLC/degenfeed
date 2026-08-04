'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TokenComment } from '../../hooks/useLiveComments';
import { useLiveComments } from '../../hooks/useLiveComments';
import { useIsMobile, useKeyboardHeight } from '../../hooks/useMobileResponsive';

/* === Config =========================================== */

const SOUND_ENABLED_KEY = 'df:comment-sound';

interface LiveCommentFeedProps {
  tokenAddress: string;
  compact?: boolean;
  className?: string;
}

/* === Badge display config ============================ */

interface BadgeStyle {
  label: string;
  className: string;
}

const BADGE_STYLES: Record<string, BadgeStyle> = {
  creator: { label: 'CREATOR', className: 'badge-creator' },
  og: { label: 'OG', className: 'badge-og' },
  early_bird: { label: 'EARLY', className: 'badge-early' },
  first_buyer: { label: 'FIRST', className: 'badge-first' },
  whale: { label: 'WHALE', className: 'badge-whale' },
  superfan: { label: 'FAN', className: 'badge-superfan' },
};

/* === Main Component ================================== */

export default function LiveCommentFeed({
  tokenAddress,
  compact = false,
  className = '',
}: LiveCommentFeedProps) {
  const isMobile = useIsMobile();
  const keyboardHeight = useKeyboardHeight();

  const { comments, sendComment, isConnected, onlineCount, isLoading } =
    useLiveComments(tokenAddress);

  const [text, setText] = useState('');
  const [collapsed, setCollapsed] = useState(isMobile && compact);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SOUND_ENABLED_KEY) !== 'false';
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-scroll on new comments
  useEffect(() => {
    if (comments.length > prevLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    prevLengthRef.current = comments.length;
  }, [comments.length]);

  // Scroll input into view when keyboard appears
  useEffect(() => {
    if (keyboardHeight > 0 && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [keyboardHeight]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setSendError(null);

    try {
      await sendComment(trimmed);
      setText('');
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send');
      setTimeout(() => setSendError(null), 3000);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(SOUND_ENABLED_KEY, String(next));
  };

  // Touch-to-retry for error state
  const handleRetry = useCallback(() => {
    setError(null);
    // Force re-fetch handled by parent
  }, []);

  // Error state
  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center ${className}`}
      >
        <p className="text-xs text-red-400">{error}</p>
        <button
          type="button"
          onClick={handleRetry}
          className="mt-2 rounded-lg bg-red-500/20 px-3 py-1.5 text-[10px] font-medium text-red-400 hover:bg-red-500/30 touch-target"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] ${className}`}
      style={keyboardHeight > 0 && isMobile ? { paddingBottom: keyboardHeight } : undefined}
    >
      {/* Header — collapsible on mobile */}
      <div
        className={`flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2 ${
          isMobile ? 'collapsible-mobile-header' : ''
        }`}
        onClick={() => {
          if (isMobile) setCollapsed(!collapsed);
        }}
        onKeyDown={(e) => {
          if (isMobile && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setCollapsed(!collapsed);
          }
        }}
        role="button"
        tabIndex={isMobile ? 0 : undefined}
        aria-label={collapsed ? 'Expand comments' : 'Collapse comments'}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full ${isConnected ? 'bg-degen-400' : 'bg-red-400'} opacity-75`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${isConnected ? 'bg-degen-500' : 'bg-red-500'}`}
            />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg)]">
            {isConnected ? 'LIVE' : 'RECONNECTING...'}
          </span>
          <span className="text-[11px] text-[var(--color-muted)]">{onlineCount} watching</span>
        </div>
        <div className="flex items-center gap-2">
          {!compact && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleSound();
              }}
              className="rounded p-1.5 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors touch-target"
              aria-label={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
          )}
          <span className="text-[10px] tabular-nums text-[var(--color-muted)]">
            {comments.length}
          </span>
          {isMobile && (
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className={`text-[var(--color-muted)] transition-transform ${collapsed ? '' : 'rotate-180'}`}
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          )}
        </div>
      </div>

      {/* Messages — hidden when collapsed */}
      {!collapsed && (
        <>
          <div
            ref={scrollRef}
            className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2"
            style={{
              maxHeight: isMobile ? '40vh' : compact ? 240 : 400,
              minHeight: compact ? 80 : 120,
            }}
          >
            {isLoading && comments.length === 0 && (
              <div className="space-y-2 py-4">
                {Array.from({ length: isMobile ? 2 : 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="skeleton h-5 w-5 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="skeleton h-3 w-24 rounded" />
                      <div className="skeleton h-4 w-full rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && comments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center">
                <div className="mb-2 text-xl opacity-30">💬</div>
                <span className="text-xs text-[var(--color-muted)]">
                  No comments yet. Be the first to shill!
                </span>
              </div>
            )}

            {comments.map((c) => (
              <CommentBubble key={c.id} comment={c} />
            ))}
          </div>

          {/* Error toast */}
          {sendError && (
            <div className="mx-3 mb-1 rounded-md bg-red-500/10 px-2 py-1 text-[10px] text-red-400">
              {sendError}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Shill this coin! 🚀"
              maxLength={1000}
              disabled={isSending}
              className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2.5 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none transition-colors focus:border-degen-500/30 disabled:opacity-50"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!text.trim() || isSending}
              className="btn-primary shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 touch-target"
              style={{ minHeight: 44 }}
            >
              {isSending ? '...' : 'Send'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* === Comment Bubble =================================== */

function CommentBubble({ comment }: { comment: TokenComment }) {
  const topBadge = comment.badges
    .map((b) => BADGE_STYLES[b])
    .filter((s): s is BadgeStyle => s !== undefined)
    .slice(0, 2);

  const creatorClass = comment.isCreator ? 'border-l-2 border-degen-400' : '';

  const displayName =
    comment.authorHandle || `${comment.author.slice(0, 6)}...${comment.author.slice(-4)}`;

  return (
    <div
      className={`group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--color-overlay)] ${creatorClass}`}
    >
      {/* Avatar */}
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-degen-500/20">
        {comment.authorAvatar ? (
          <img src={comment.authorAvatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[9px] font-bold text-degen-400">
            {comment.author.charAt(2).toUpperCase() || '?'}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 flex-wrap">
          <span
            className={`text-[11px] font-semibold ${comment.isCreator ? 'text-degen-400' : 'text-[var(--color-fg)]'}`}
          >
            {displayName}
          </span>
          {topBadge.map((b) => (
            <span
              key={b.label}
              className={`rounded px-1 text-[8px] font-bold uppercase leading-none ${b.className}`}
            >
              {b.label}
            </span>
          ))}
          <span className="text-[9px] text-[var(--color-muted)] ml-auto tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTimeAgo(comment.timestamp)}
          </span>
        </div>
        <p className="text-xs text-[var(--color-fg)] break-words leading-tight">{comment.text}</p>
      </div>
    </div>
  );
}

/* === Helpers =========================================== */

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}
