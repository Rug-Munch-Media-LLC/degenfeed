'use client';

/**
 * @degenfeed/web — PostEngagementBar
 *
 * Engagement bar for posts with integrated TipMenu.
 * Shows like, repost, bookmark, tip (with context-aware menu), share, and embed.
 *
 * @see ./TipMenu.tsx — Context-aware tipping menu
 */

import type { EngagementAction, EngagementMetrics } from '@degenfeed/types';
import { TipMenu } from '../tip/TipMenu';
import type { ContentVenue, PastTip } from '../tip/types';

export function PostEngagementBar({
  liked,
  reposted,
  bookmarked,
  metrics,
  engaging,
  onAction,
  onTip,
  onShare,
  onEmbed,
  // Context-aware tipping props (optional — enables inline TipMenu when provided)
  venue,
  protocol,
  authorId,
  authorDisplayName,
  publicationId,
  contentUrl,
  hasWallet,
  creatorAddresses,
  pastTips,
  totalTipsUsd,
}: {
  liked: boolean;
  reposted: boolean;
  bookmarked: boolean;
  metrics: EngagementMetrics;
  engaging: string | null;
  onAction: (action: EngagementAction) => void;
  onTip: () => void;
  onShare: () => void;
  onEmbed: () => void;
  // Optional context-aware tipping props
  venue?: ContentVenue;
  protocol?: string;
  authorId?: string;
  authorDisplayName?: string;
  publicationId?: string;
  contentUrl?: string;
  hasWallet?: boolean;
  creatorAddresses?: { evm?: string; solana?: string; lightning?: string };
  pastTips?: PastTip[];
  totalTipsUsd?: number;
}) {
  // Determine if we should show inline TipMenu (when context props are provided)
  const showContextTip = !!(venue && protocol && authorId);

  return (
    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1 sm:gap-2 border-t border-[var(--color-glass-border)] pt-3">
      <button
        type="button"
        onClick={() => onAction('like')}
        disabled={engaging === 'like'}
        className={`rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors flex-1 sm:flex-none ${liked ? 'bg-degen-500/20 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
      >
        {liked ? '♥' : '♡'} {metrics.likes}
      </button>
      <button
        type="button"
        onClick={() => onAction('repost')}
        disabled={engaging === 'repost'}
        className={`rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors flex-1 sm:flex-none ${reposted ? 'bg-green-500/20 text-green-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
      >
        ↻ {metrics.reposts}
      </button>
      <button
        type="button"
        onClick={() => onAction(bookmarked ? 'unbookmark' : 'bookmark')}
        disabled={engaging === 'bookmark' || engaging === 'unbookmark'}
        className={`rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors flex-1 sm:flex-none ${
          bookmarked
            ? 'bg-yellow-500/20 text-yellow-400'
            : 'text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'
        }`}
      >
        {bookmarked ? '★' : '☆'}
      </button>

      {/* Context-aware TipMenu when venue/protocol/authorId provided */}
      {showContextTip && (
        <TipMenu
          venue={venue!}
          protocol={protocol!}
          authorId={authorId!}
          authorDisplayName={authorDisplayName ?? 'Creator'}
          publicationId={publicationId}
          contentUrl={contentUrl}
          hasWallet={hasWallet ?? false}
          creatorAddresses={creatorAddresses}
          pastTips={pastTips}
          totalTipsUsd={totalTipsUsd}
          compact
        />
      )}

      {/* Fallback: basic Tip button when no context props */}
      {!showContextTip && (
        <button
          type="button"
          onClick={onTip}
          className="rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors flex-1 sm:flex-none"
        >
          Tip
        </button>
      )}

      <button
        type="button"
        onClick={onShare}
        className="rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors flex-1 sm:flex-none"
        title="Share this post"
      >
        ↗
      </button>
      <button
        type="button"
        onClick={onEmbed}
        className="rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors flex-1 sm:flex-none"
        title="Copy embed code"
      >
        &lt;/&gt;
      </button>
    </div>
  );
}
