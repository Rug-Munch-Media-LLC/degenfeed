'use client';

/**
 * ShortsOverlay — Bottom info overlay on the shorts card.
 * Shows creator, caption, hashtags, sound info, and source badge.
 */

import Image from 'next/image';
import { ShortsSourceBadge } from './ShortsSourceBadge';

interface ShortsOverlayProps {
  source: string;
  sourceLabel: string;
  sourceColor?: string;
  avatarUrl?: string;
  displayName: string;
  handle: string;
  caption: string;
  hashtags: string[];
  niche?: string;
  publishedAt: number;
  visible: boolean;
  captionExpanded: boolean;
  onToggleCaption: () => void;
  onProfileClick?: (e: React.MouseEvent) => void;
}

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

function truncateText(text: string, maxLen = 80): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

export function ShortsOverlay({
  source,
  sourceLabel,
  sourceColor,
  avatarUrl,
  displayName,
  handle,
  caption,
  hashtags,
  niche,
  publishedAt,
  visible,
  captionExpanded,
  onToggleCaption,
  onProfileClick,
}: ShortsOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-20 transition-all duration-300">
      {/* Creator row */}
      <div className="mb-2 flex items-center gap-2">
        {onProfileClick ? (
          <button type="button" onClick={onProfileClick} className="flex items-center gap-2 group">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={28}
                height={28}
                className="h-7 w-7 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-degen-500/20 text-[10px] font-bold text-degen-400">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold text-white drop-shadow-lg">
              {displayName}
            </span>
            <span className="text-xs text-white/60 drop-shadow-lg">@{handle}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={28}
                height={28}
                className="h-7 w-7 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-degen-500/20 text-[10px] font-bold text-degen-400">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold text-white drop-shadow-lg">
              {displayName}
            </span>
            <span className="text-xs text-white/60 drop-shadow-lg">@{handle}</span>
          </div>
        )}

        {/* Source badge */}
        <ShortsSourceBadge source={source} label={sourceLabel} color={sourceColor} />
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
          aria-expanded={captionExpanded}
        >
          <p className="text-sm leading-snug text-white/90 drop-shadow-lg">
            {captionExpanded ? caption : truncateText(caption, 80)}
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
              onClick={(e) => e.stopPropagation()}
            >
              {tag}
            </a>
          ))}
        </div>
      )}

      {/* Sound / Niche */}
      <div className="mt-1 flex items-center gap-1.5">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-white/50"
        >
          <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className="text-xs text-white/60 drop-shadow-lg">
          {niche
            ? `${niche} · ${formatTimeAgo(publishedAt)}`
            : formatTimeAgo(publishedAt)}
        </span>
      </div>

      {/* Swipe up hint */}
      <div className="mt-3 flex items-center gap-1.5 opacity-40">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-white/50">
          <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[9px] text-white/40">Swipe up for details</span>
      </div>
    </div>
  );
}
