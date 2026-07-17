'use client';

/**
 * @degenfeed/ui — LensPublicationBadge
 *
 * Shows Lens-specific metadata: mirror count, collects count.
 * Green badge with Leaf icon. Links to Hey/Lenster for full profile.
 *
 * Design: compact green-accented badge with leaf icon, expandable stats.
 * Tonal reference: Lens Protocol's green brand, leaf identity.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { memo, useCallback, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────

export interface LensPublicationBadgeProps {
  post: UnifiedPost;
  /** Mirror count (overrides post.metrics.reposts) */
  mirrors?: number;
  /** Collect count (unique collects, not in metrics by default) */
  collects?: number;
  /** Lens publication ID (overrides extraction from post.id) */
  publicationId?: string;
  /** Lens profile handle */
  handle?: string;
}

// ─── Constants ───────────────────────────────────────────────────────

const LENS_GREEN = '#abfe2c';

// ─── Helpers ─────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function extractLensHandle(post: UnifiedPost): string | undefined {
  const raw = post.raw as Record<string, unknown> | undefined;
  return (raw?.handle as string | undefined) ?? post.author.handles.lens ?? undefined;
}

function extractPublicationId(post: UnifiedPost): string | undefined {
  // Lens publication IDs are in the post.id: lens:0x...-0x...
  const prefix = 'lens:';
  if (post.id.startsWith(prefix)) {
    return post.id.slice(prefix.length);
  }
  const raw = post.raw as Record<string, unknown> | undefined;
  return raw?.publicationId as string | undefined;
}

function buildProfileUrl(handle?: string): string | undefined {
  if (!handle) return undefined;
  const clean = handle.replace(/\.lens$/, '');
  return `https://hey.xyz/u/${clean}`;
}

function buildPostUrl(publicationId?: string, handle?: string): string | undefined {
  if (!publicationId) return undefined;
  if (handle) {
    return `https://hey.xyz/posts/${publicationId}`;
  }
  return `https://hey.xyz/posts/${publicationId}`;
}

// ─── Component ───────────────────────────────────────────────────────

export const LensPublicationBadge = memo(function LensPublicationBadge({
  post,
  mirrors: externalMirrors,
  collects: externalCollects,
  publicationId: externalPubId,
  handle: externalHandle,
}: LensPublicationBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  const mirrors = externalMirrors ?? post.metrics.reposts;
  const collects = externalCollects ?? 0;
  const publicationId = externalPubId ?? extractPublicationId(post);
  const handle = externalHandle ?? extractLensHandle(post);

  const profileUrl = buildProfileUrl(handle);
  const postUrl = buildPostUrl(publicationId, handle);

  const toggleExpanded = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setExpanded((v) => !v);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded((v) => !v);
    }
    if (e.key === 'Escape') {
      setExpanded(false);
    }
  }, []);

  return (
    <div
      className="mt-3 overflow-hidden rounded-xl border transition-colors"
      style={{ borderColor: `${LENS_GREEN}22`, backgroundColor: `${LENS_GREEN}06` }}
    >
      {/* ── Badge header ── */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Leaf icon */}
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${LENS_GREEN}18` }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 3C12 3 4 7 4 15C4 19 7 22 12 22C17 22 20 19 20 15C20 7 12 3 12 3Z"
              fill={LENS_GREEN}
              opacity="0.9"
            />
            <path d="M12 3L12 22" stroke="#030712" strokeWidth="0.5" />
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-200">Lens Protocol</span>
          {handle && (
            <span className="ml-1.5 text-xs text-gray-500">@{handle.replace(/\.lens$/, '')}</span>
          )}
        </div>

        {/* Expand/collapse */}
        {collects > 0 && (
          <button
            type="button"
            onClick={toggleExpanded}
            onKeyDown={handleKeyDown}
            className="flex items-center gap-1 text-xs font-medium transition-colors"
            style={{ color: LENS_GREEN }}
            aria-label={expanded ? 'Collapse lens details' : 'Expand lens details'}
            aria-expanded={expanded}
          >
            {expanded ? 'Less' : 'More'}
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="currentColor"
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <path
                d="M2 3.5L5 6.5L8 3.5"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/* ── Stats row ── */}
      <div className="flex items-center gap-4 px-4 pb-2.5">
        {/* Mirrors */}
        <div className="flex items-center gap-1.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-gray-600"
          >
            <path
              d="M5 12H19M19 12L14 7M19 12L14 17"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-xs tabular-nums text-gray-400">
            <span className="font-semibold text-gray-300">{formatCount(mirrors)}</span> mirrors
          </span>
        </div>

        {/* Collects */}
        {collects > 0 && (
          <div className="flex items-center gap-1.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="text-gray-600"
            >
              <rect
                x="4"
                y="8"
                width="16"
                height="12"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M8 8V5C8 3 9 2 12 2C15 2 16 3 16 5V8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-xs tabular-nums text-gray-400">
              <span className="font-semibold text-gray-300">{formatCount(collects)}</span> collects
            </span>
          </div>
        )}

        {/* Open Action count from raw */}
        {post.metrics.quotes > 0 && (
          <div className="flex items-center gap-1.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="text-gray-600"
            >
              <path
                d="M21 16V8C21 6 20 5 18 5H6C4 5 3 6 3 8V16C3 18 4 19 6 19H18C20 19 21 18 21 16Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M12 12M12 8M12 16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-xs tabular-nums text-gray-400">
              <span className="font-semibold text-gray-300">
                {formatCount(post.metrics.quotes)}
              </span>{' '}
              quotes
            </span>
          </div>
        )}
      </div>

      {/* ── Expanded details ── */}
      {expanded && collects > 0 && (
        <div className="border-t border-[var(--color-glass-border)] px-4 py-2">
          <div className="flex flex-wrap gap-2 text-xs text-gray-600">
            {publicationId && (
              <span className="truncate max-w-full">
                <span className="text-gray-500">ID:</span>{' '}
                <code className="font-mono text-gray-400">{publicationId}</code>
              </span>
            )}
            {post.engagement.viewerLiked && (
              <span className="inline-flex items-center gap-1" style={{ color: LENS_GREEN }}>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M5 1L6.5 3.5L9 4L7 6.5L7.5 9.5L5 8L2.5 9.5L3 6.5L1 4L3.5 3.5L5 1Z" />
                </svg>
                Upvoted
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Action links ── */}
      <div className="flex divide-x divide-white/5 border-t border-[var(--color-glass-border)]">
        {postUrl && (
          <a
            href={postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1 px-3 py-2 text-xs transition-colors hover:bg-white/[0.03]"
            style={{ color: LENS_GREEN }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M5 2H2V10H10V7M6 6L10 2M10 2H7M10 2V5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            View on Hey
          </a>
        )}
        {profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1 px-3 py-2 text-xs text-gray-500 transition-colors hover:bg-white/[0.03] hover:text-gray-400"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M1 11C1 8.5 3 7 6 7S11 8.5 11 11"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            Profile
          </a>
        )}
        {publicationId && !postUrl && (
          <a
            href={`https://hey.xyz/posts/${publicationId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1 px-3 py-2 text-xs text-gray-500 transition-colors hover:bg-white/[0.03] hover:text-gray-400"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M5 2H2V10H10V7M6 6L10 2M10 2H7M10 2V5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            View on Lenster
          </a>
        )}
      </div>
    </div>
  );
});
