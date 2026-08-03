'use client';

/**
 * @degenfeed/ui — CrossPostVersions
 *
 * Inline "Also on" pills for posts that were cross-posted to multiple
 * protocols. Reads `post.crossPostedTo` (populated by the bridge's
 * cross-post dedup) and renders one small, brand-colored pill per
 * sibling protocol. One click jumps to that protocol's feed, so
 * e.g. viewing a Nostr post with a Farcaster twin is one tap away.
 *
 * Renders nothing when the post has no cross-post siblings, so it is
 * safe to mount in every card in every feed.
 */

import Link from 'next/link';
import { memo } from 'react';
import { getProtocolColor, getProtocolIcon, getProtocolLabel } from './ProtocolBadge';

export interface CrossPostVersionsProps {
  post: { protocol: string; crossPostedTo?: string[] | null };
  className?: string;
  /** Override navigation target for a sibling protocol (default: /feed/{protocol}) */
  hrefFor?: (protocol: string) => string;
  /** When provided, used instead of a <Link> (e.g. to switch the active feed tab) */
  onSelect?: (protocol: string) => void;
}

/** Sibling protocols the post was also published to (excludes the source protocol). */
export function crossPostSiblings(
  protocol: string,
  crossPostedTo?: string[] | null,
): string[] {
  if (!crossPostedTo || crossPostedTo.length === 0) return [];
  return [...new Set(crossPostedTo)].filter((p) => p && p !== protocol);
}

export const CrossPostVersions = memo(function CrossPostVersions({
  post,
  className = '',
  hrefFor,
  onSelect,
}: CrossPostVersionsProps) {
  const siblings = crossPostSiblings(post.protocol, post.crossPostedTo);
  if (siblings.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
      aria-label={`Also published on ${siblings.map(getProtocolLabel).join(', ')}`}
    >
      <span
        className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]"
        aria-hidden="true"
      >
        Also on
      </span>
      {siblings.map((protocol) => {
        const color = getProtocolColor(protocol);
        const label = getProtocolLabel(protocol);
        const href = hrefFor ? hrefFor(protocol) : `/feed/${protocol}`;
        const content = (
          <>
            <span className="text-[0.75em]" aria-hidden="true">
              {getProtocolIcon(protocol)}
            </span>
            <span>{label}</span>
            <span className="opacity-60" aria-hidden="true">
              ↗
            </span>
          </>
        );
        const classNameInner =
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none transition-all hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]';
        const style = { backgroundColor: `${color}18`, color };
        const title = `Also published on ${label} — open the ${label} version`;

        if (onSelect) {
          return (
            <button
              key={protocol}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(protocol);
              }}
              className={classNameInner}
              style={style}
              title={title}
              aria-label={`Open ${label} version of this post`}
            >
              {content}
            </button>
          );
        }

        return (
          <Link
            key={protocol}
            href={href}
            onClick={(e) => e.stopPropagation()}
            className={classNameInner}
            style={style}
            title={title}
            aria-label={`Open ${label} version of this post`}
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
});
