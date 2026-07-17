'use client';

/**
 * @degenfeed/ui — CommunityBadge
 *
 * Displays a community name with "c/" prefix and protocol color.
 * Used inline in PostCard for lemmy/reddit posts to show
 * "posted in c/[community-name]" with a clickable link.
 */

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export interface CommunityBadgeProps {
  name: string;
  title?: string;
  icon?: string;
  /** Optional protocol to color the badge (defaults to lemmy green) */
  protocol?: string;
  /** If true (default), renders as a clickable link to /c/[name] */
  clickable?: boolean;
  /** If true, shows full title instead of "c/name" */
  showTitle?: boolean;
  size?: 'xs' | 'sm';
}

export const COMMUNITY_COLORS: Record<string, string> = {
  lemmy: '#00b868',
  reddit: '#ff4500',
};

export function CommunityBadge({
  name,
  title,
  icon,
  protocol = 'lemmy',
  clickable = true,
  showTitle = false,
  size = 'xs',
}: CommunityBadgeProps) {
  const router = useRouter();
  const color = COMMUNITY_COLORS[protocol] ?? '#00b868';
  const sizeClass = size === 'xs' ? 'text-[10px]' : 'text-xs';

  const displayLabel = showTitle && title ? title : `c/${name}`;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (clickable) {
        router.push(`/c/${encodeURIComponent(name)}`);
      }
    },
    [clickable, name, router],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (clickable && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/c/${encodeURIComponent(name)}`);
      }
    },
    [clickable, name, router],
  );

  const inner = (
    <>
      {icon ? (
        // biome-ignore lint/performance/noImgElement: community icon
        <img
          src={icon}
          alt=""
          className="h-3 w-3 rounded-sm object-cover"
          loading="lazy"
        />
      ) : (
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          className="shrink-0"
        >
          <path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h8v2H2v-2z" />
        </svg>
      )}
      <span className="truncate max-w-[120px]">{displayLabel}</span>
    </>
  );

  const className = `inline-flex items-center gap-1 rounded-full font-medium ${sizeClass} ${
    clickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
  }`;

  if (clickable) {
    return (
      <span
        className={className}
        style={{
          backgroundColor: `${color}18`,
          color,
          padding: '1px 6px',
        }}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        title={`View community: ${displayLabel}`}
        aria-label={`Community: ${displayLabel}`}
      >
        {inner}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{
        backgroundColor: `${color}18`,
        color,
        padding: '1px 6px',
      }}
    >
      {inner}
    </span>
  );
}
