'use client';

/**
 * VisualFeedCard — Single card in the visual feed masonry grid.
 * Shows media with hover overlay actions, protocol badge, creator info,
 * and an integrated context-aware TipMenu.
 */

import type { VisualPost } from '@degenfeed/types';
import { useCallback, useMemo, useRef } from 'react';
import { TipMenu } from '../tip/TipMenu';
import { CardOverlay } from './CardOverlay';
import { MediaRenderer } from './MediaRenderer';

interface VisualFeedCardProps {
  post: VisualPost;
  onTip?: (post: VisualPost) => void;
  onMint?: (post: VisualPost) => void;
  onCollect?: (post: VisualPost) => void;
  onLike?: (post: VisualPost) => void;
  onComment?: (post: VisualPost) => void;
  onRepost?: (post: VisualPost) => void;
  onImageLoad?: () => void;
  priority?: boolean;
}

export function VisualFeedCard({
  post,
  onTip,
  onMint,
  onCollect,
  onLike,
  onComment,
  onRepost,
  onImageLoad,
}: VisualFeedCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(() => {
    if (post.url) {
      window.open(post.url, '_blank', 'noopener,noreferrer');
    }
  }, [post.url]);

  // ── Derive venue from post source ───────────────────────────────────────
  const venue = useMemo(() => {
    // Posts from our own ecosystem use 'our_network'
    if (post.source === 'farcaster' || post.source === 'nostr') {
      return 'our_network' as const;
    }
    // Zora posts get special Zora treatment
    if (post.source === 'zora' || post.protocol === 'zora') {
      return 'external_protocol' as const;
    }
    // Bluesky, Mastodon, etc.
    return 'external_protocol' as const;
  }, [post.source, post.protocol]);

  // ── Derive creator addresses from post author data ──────────────────────
  const creatorAddresses = useMemo(() => {
    const addresses: { evm?: string; solana?: string; lightning?: string } = {};
    const rawMeta = post.meta ?? {};

    if (post.creatorAddress && /^0x[a-f0-9]{40}$/i.test(post.creatorAddress)) {
      addresses.evm = post.creatorAddress;
    }

    // Check for wallet addresses in meta
    if (typeof rawMeta.evmAddress === 'string') addresses.evm = rawMeta.evmAddress;
    if (typeof rawMeta.solanaAddress === 'string') addresses.solana = rawMeta.solanaAddress;
    if (typeof rawMeta.lightningAddress === 'string')
      addresses.lightning = rawMeta.lightningAddress;

    return addresses;
  }, [post.creatorAddress, post.meta]);

  return (
    <div
      ref={cardRef}
      className="group relative overflow-hidden rounded-xl bg-[var(--color-card-bg)] transition-all duration-200 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5"
      style={{
        border: '1px solid var(--color-glass-border)',
        breakInside: 'avoid',
        marginBottom: '16px',
      }}
    >
      {/* Click to open original */}
      <button
        type="button"
        onClick={handleClick}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-degen-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-card-bg)] rounded-xl"
        aria-label={`View post by ${post.author.displayName || 'creator'}`}
      >
        {/* Media */}
        <MediaRenderer
          imageUrl={post.imageUrl}
          videoUrl={post.videoUrl}
          alt={post.text || `Visual post from ${post.author.displayName || post.sourceLabel}`}
          aspectRatio={post.aspectRatio || 4 / 3}
          mediaType={post.mediaType}
          blurHash={post.blurHash}
          isNFT={post.isNFT}
          onLoad={onImageLoad}
        />

        {/* Overlay with actions (desktop hover, mobile tap) */}
        <CardOverlay
          post={post}
          onTip={onTip}
          onMint={onMint}
          onCollect={onCollect}
          onLike={onLike}
          onComment={onComment}
          onRepost={onRepost}
        />
      </button>

      {/* Bottom info bar with context-aware TipMenu */}
      <div className="flex items-center justify-between px-3 py-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1.5 min-w-0">
          {post.author.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt=""
              className="h-5 w-5 flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-overlay)] text-[8px] font-bold text-[var(--color-muted)]">
              {post.author.displayName?.[0] ?? '?'}
            </div>
          )}
          <span className="truncate text-[11px] font-medium text-[var(--color-fg)]">
            {post.author.displayName || 'Anonymous'}
          </span>
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
            style={{
              backgroundColor: `${post.sourceColor}18`,
              color: post.sourceColor,
              border: `1px solid ${post.sourceColor}30`,
            }}
          >
            <span aria-hidden="true">{post.sourceBadge}</span>
            <span className="sr-only">{post.sourceLabel}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Like button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLike?.(post);
            }}
            className="text-[var(--color-muted)] hover:text-red-400 transition-colors"
            aria-label="Like"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          {/* Context-aware TipMenu instead of simple button */}
          <TipMenu
            venue={venue}
            protocol={post.protocol || post.source}
            authorId={post.author.id || post.creatorAddress || post.id}
            authorDisplayName={post.author.displayName || 'Creator'}
            contentUrl={post.url}
            hasWallet={false}
            creatorAddresses={creatorAddresses}
            compact
          />
        </div>
      </div>
    </div>
  );
}
