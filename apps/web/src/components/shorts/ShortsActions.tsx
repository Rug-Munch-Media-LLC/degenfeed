'use client';

/**
 * ShortsActions — Right-side vertical action rail.
 *
 * Like, Comment, Share, Bookmark buttons with counts, plus
 * cross-platform tipping options:
 *   - "Tip via ETH (Base)" — buys creator coin
 *   - "Tip via SOL (Solana)" — buys SPL token
 *   - "Collect on Zora" — mints NFT edition
 *   - "Tip via Lightning" — for Nostr creators
 */

import { memo } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Types ────────────────────────────────────────────────────────────────

interface ShortsActionsProps {
  liked: boolean;
  likeCount: number;
  commentCount?: number;
  bookmarked: boolean;
  showCreatorCoin?: boolean;
  creatorCoinSymbol?: string;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onBookmark: () => void;
  onCreatorCoin?: () => void;
  /** Cross-platform tip callbacks */
  onTipEth?: () => void;
  onTipSol?: () => void;
  onCollectZora?: () => void;
  onTipLightning?: () => void;
  /** Whether cross-platform tips are available */
  hasEthTip?: boolean;
  hasSolTip?: boolean;
  hasZoraNft?: boolean;
  hasLightningTip?: boolean;
  visible: boolean;
}

// ─── Individual action button ─────────────────────────────────────────────

interface ActionBtnProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  color?: string;
  tooltip?: string;
}

const ActionButton = memo(function ActionButton({
  icon,
  label,
  count,
  active = false,
  onClick,
  color,
  tooltip,
}: ActionBtnProps) {
  return (
    <div className="group relative flex flex-col items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className="flex flex-col items-center gap-0.5 transition-transform active:scale-90"
        aria-label={`${label}${count != null && count > 0 ? ` — ${formatCount(count)}` : ''}`}
      >
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition-all duration-200
          ${
            active
              ? 'bg-degen-500/20 text-degen-400 shadow-[0_0_12px_rgba(0,255,65,0.2)]'
              : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
          }`}
          style={active && color ? { backgroundColor: `${color}22`, color } : undefined}
        >
          {icon}
        </span>
        {count != null && count > 0 && (
          <span className="text-[10px] font-medium tabular-nums text-white/70">
            {formatCount(count)}
          </span>
        )}
      </button>
      {tooltip && (
        <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[9px] text-white/80 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
          {tooltip}
        </span>
      )}
    </div>
  );
});

// ─── Separator ─────────────────────────────────────────────────────────────

function ActionSeparator() {
  return <div className="my-1 h-px w-6 bg-white/10" aria-hidden="true" />;
}

// ─── Main component ──────────────────────────────────────────────────────

export function ShortsActions({
  liked,
  likeCount,
  commentCount,
  bookmarked,
  showCreatorCoin,
  creatorCoinSymbol,
  onLike,
  onComment,
  onShare,
  onBookmark,
  onCreatorCoin,
  onTipEth,
  onTipSol,
  onCollectZora,
  onTipLightning,
  hasEthTip,
  hasSolTip,
  hasZoraNft,
  hasLightningTip,
  visible,
}: ShortsActionsProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 transition-all duration-300 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
      }`}
    >
      {/* ── Core actions ── */}
      {/* Like */}
      <ActionButton
        icon={
          liked ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )
        }
        label="Like"
        count={likeCount}
        active={liked}
        color="#ff2d55"
        onClick={onLike}
        tooltip={liked ? 'Unlike' : 'Like'}
      />

      {/* Comment */}
      <ActionButton
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        label="Comment"
        count={commentCount}
        onClick={onComment}
        tooltip="Comment"
      />

      {/* Share */}
      <ActionButton
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        label="Share"
        onClick={onShare}
        tooltip="Share"
      />

      {/* Bookmark */}
      <ActionButton
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d={
                bookmarked
                  ? 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'
                  : 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'
              }
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={bookmarked ? 'currentColor' : 'none'}
            />
          </svg>
        }
        label={bookmarked ? 'Saved' : 'Bookmark'}
        active={bookmarked}
        color="#00bfff"
        onClick={onBookmark}
        tooltip={bookmarked ? 'Unsave' : 'Save'}
      />

      {/* ── Creator Coin ── */}
      {showCreatorCoin && creatorCoinSymbol && (
        <ActionButton
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M12 7v10M8 12h8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          }
          label={creatorCoinSymbol}
          color="#f7931a"
          onClick={onCreatorCoin}
          tooltip={`Buy $${creatorCoinSymbol}`}
        />
      )}

      {/* ── Separator ── */}
      {(hasEthTip || hasSolTip || hasZoraNft || hasLightningTip) && <ActionSeparator />}

      {/* ── Cross-platform tip actions ── */}

      {/* Tip via ETH (Base) */}
      {hasEthTip && (
        <ActionButton
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5L12 2zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          }
          label="ETH"
          color="#627EEA"
          onClick={onTipEth}
          tooltip="Tip via ETH (Base)"
        />
      )}

      {/* Tip via SOL (Solana) */}
      {hasSolTip && (
        <ActionButton
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="12" r="10" opacity=".4" />
              <path d="M12 6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6z" />
            </svg>
          }
          label="SOL"
          color="#9945FF"
          onClick={onTipSol}
          tooltip="Tip via SOL (Solana)"
        />
      )}

      {/* Collect on Zora */}
      {hasZoraNft && (
        <ActionButton
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="4" opacity=".3" />
              <path
                d="M12 6v12M6 12h12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          }
          label="Zora"
          color="#0052FF"
          onClick={onCollectZora}
          tooltip="Collect on Zora"
        />
      )}

      {/* Tip via Lightning */}
      {hasLightningTip && (
        <ActionButton
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          }
          label="⚡"
          color="#F5A623"
          onClick={onTipLightning}
          tooltip="Tip via Lightning"
        />
      )}
    </div>
  );
}
