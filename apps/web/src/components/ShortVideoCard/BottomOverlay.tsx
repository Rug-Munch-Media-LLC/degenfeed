'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { formatTimeAgo } from '@degenfeed/utils';
import Image from 'next/image';
import { QuickTipButton } from '../QuickTipButton';
import { truncateText } from './helpers';

interface BottomOverlayProps {
  post: UnifiedPost;
  showCaption: boolean;
  showOverlay: boolean;
  showInfoPanel: boolean;
  protocolColor: string;
  authorHandle: string;
  hashtags: string[];
  onToggleCaption: () => void;
  onInfoTouchStart: (e: React.TouchEvent) => void;
  onInfoTouchEnd: (e: React.TouchEvent) => void;
}

export function BottomOverlay({
  post,
  showCaption,
  showOverlay,
  showInfoPanel,
  protocolColor,
  authorHandle,
  hashtags,
  onToggleCaption,
  onInfoTouchStart,
  onInfoTouchEnd,
}: BottomOverlayProps) {
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-20 transition-all duration-300 ${
        showOverlay && !showInfoPanel
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      onTouchStart={onInfoTouchStart}
      onTouchEnd={onInfoTouchEnd}
    >
      {/* Creator row */}
      <div className="mb-2 flex items-center gap-2">
        <a
          href={`/profile?protocol=${post.protocol}&id=${encodeURIComponent(post.author.id)}`}
          className="flex items-center gap-2 group"
        >
          {post.author.avatarUrl ? (
            <Image
              src={post.author.avatarUrl}
              alt={post.author.displayName}
              width={28}
              height={28}
              className="h-7 w-7 rounded-full border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-degen-500/20 text-[10px] font-bold text-degen-400">
              {post.author.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-semibold text-white drop-shadow-lg">
            {post.author.displayName}
          </span>
          <span className="text-xs text-white/60 drop-shadow-lg">@{authorHandle}</span>
          <span
            className="ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
            style={{ backgroundColor: `${protocolColor}22`, color: protocolColor }}
          >
            {post.protocol}
          </span>
        </a>
      </div>

      {/* Caption */}
      <div className="mb-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCaption();
          }}
          className="block text-left"
          aria-expanded={showCaption}
        >
          <p className="text-sm leading-snug text-white/90 drop-shadow-lg">
            {showCaption ? post.text : truncateText(post.text, 80)}
          </p>
        </button>
      </div>

      {/* Hashtags */}
      {hashtags.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1.5">
          {hashtags.map((tag) => (
            <a
              key={tag}
              href={`/topics/${encodeURIComponent(tag.slice(1))}`}
              className="text-xs font-medium text-degen-400/90 transition-colors hover:text-degen-300 drop-shadow-lg"
            >
              {tag}
            </a>
          ))}
        </div>
      )}

      {/* Sound / Music */}
      <div className="mt-1 flex items-center gap-1.5">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-white/50"
        >
          <path
            d="M9 18V5l12-2v13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className="text-xs text-white/60 drop-shadow-lg">
          {post.protocol === 'rss'
            ? 'Podcast · RSS'
            : post.niches.length > 0
              ? `${post.niches[0]} · ${formatTimeAgo(post.createdAt)}`
              : formatTimeAgo(post.createdAt)}
        </span>
      </div>

      {/* Quick tip */}
      <div className="mt-1.5">
        <QuickTipButton
          recipientProtocol={post.protocol}
          recipientAuthorId={post.author.id}
          recipientDisplayName={post.author.displayName}
          publicationId={post.id}
          subtle
        />
      </div>

      {/* Swipe up hint */}
      {!showInfoPanel && (
        <div className="mt-3 flex items-center gap-1.5 opacity-40">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-white/50"
          >
            <path
              d="M12 5v14M5 12l7 7 7-7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[9px] text-white/40">Swipe up for details</span>
        </div>
      )}
    </div>
  );
}
