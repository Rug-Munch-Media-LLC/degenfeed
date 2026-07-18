'use client';

/**
 * @degenfeed/ui — BlueskyPostContext
 *
 * Shows Bluesky-specific metadata for a post.
 * AT Protocol DID, PDS host, custom feed information.
 *
 * Design: blue-accented info card with DID display, PDS badge.
 * Tonal reference: Bluesky's blue brand, AT Protocol developer culture.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { memo } from 'react';

// ─── Types ───────────────────────────────────────────────────────────

export interface BlueskyPostContextProps {
  post: UnifiedPost;
  /** AT Protocol DID (overrides extraction from post.raw) */
  did?: string;
  /** PDS host URL (overrides extraction) */
  pdsHost?: string;
  /** Custom feed display name if from a custom feed */
  customFeed?: string;
  /** Custom feed creator handle */
  feedCreator?: string;
  /** AT Protocol record key (rkey) */
  recordKey?: string;
  /** Collection/record type */
  collection?: string;
}

// ─── Constants ───────────────────────────────────────────────────────

const BSKY_BLUE = '#1185fe';

// ─── Helpers ─────────────────────────────────────────────────────────

function extractBlueskyData(post: UnifiedPost): {
  did?: string;
  pdsHost?: string;
} {
  const raw = post.raw as Record<string, unknown> | undefined;
  // Attempt extraction from post.raw
  const did = (raw?.did as string) ?? post.author.keys.did ?? undefined;
  const pdsHost = (raw?.pdsHost as string) ?? (raw?.pds_host as string) ?? undefined;
  return { did, pdsHost };
}

function formatDid(did: string): string {
  if (did.startsWith('did:plc:')) {
    return `${did.slice(0, 12)}…${did.slice(-6)}`;
  }
  if (did.startsWith('did:web:')) {
    return did.replace('did:web:', '');
  }
  return did.length > 20 ? `${did.slice(0, 12)}…` : did;
}

// ─── Component ───────────────────────────────────────────────────────

export const BlueskyPostContext = memo(function BlueskyPostContext({
  post,
  did: externalDid,
  pdsHost: externalPdsHost,
  customFeed,
  feedCreator,
  recordKey,
  collection,
}: BlueskyPostContextProps) {
  const { did, pdsHost } = {
    did: externalDid ?? extractBlueskyData(post).did,
    pdsHost: externalPdsHost ?? extractBlueskyData(post).pdsHost,
  };

  // Extract record key from post.id
  const idParts = post.id.split(':');
  const rkey = recordKey ?? idParts[idParts.length - 1] ?? undefined;

  // Build AT Protocol URI
  const atUri =
    did && rkey ? `at://${did}/${collection ?? 'app.bsky.feed.post'}/${rkey}` : undefined;

  // Build PDS URL to view original
  const viewUrl = did && rkey ? `https://bsky.app/profile/${did}/post/${rkey}` : undefined;

  return (
    <div
      className="mt-3 overflow-hidden rounded-xl border transition-colors"
      style={{ borderColor: `${BSKY_BLUE}22`, backgroundColor: `${BSKY_BLUE}06` }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Blue sky icon */}
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${BSKY_BLUE}18` }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 4C12 4 8 8 4 10C2 11 2 13 4 14C8 16 12 20 12 20C12 20 16 16 20 14C22 13 22 11 20 10C16 8 12 4 12 4Z"
              fill={BSKY_BLUE}
              opacity="0.9"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-200">AT Protocol</span>
          {did && <span className="ml-1.5 text-xs text-gray-500 font-mono">{formatDid(did)}</span>}
        </div>

        {/* PDS badge */}
        {pdsHost && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0"
            style={{ backgroundColor: `${BSKY_BLUE}15`, color: BSKY_BLUE }}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
              <circle cx="4" cy="4" r="3" />
            </svg>
            {pdsHost.replace('https://', '').split('.')[0]}
          </span>
        )}
      </div>

      {/* ── AT Protocol details ── */}
      <div className="space-y-1.5 px-4 pb-3">
        {/* DID */}
        {did && (
          <div className="flex items-center gap-2 text-xs">
            <span className="w-16 flex-shrink-0 text-gray-600">DID</span>
            <code className="truncate font-mono text-gray-400" title={did}>
              {did}
            </code>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard.writeText(did);
              }}
              className="flex-shrink-0 text-gray-700 transition-colors hover:text-gray-400"
              aria-label="Copy DID"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <rect
                  x="3"
                  y="3"
                  width="8"
                  height="8"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <path d="M1 9V2C1 1.5 1.5 1 2 1H9" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
          </div>
        )}

        {/* PDS */}
        {pdsHost && (
          <div className="flex items-center gap-2 text-xs">
            <span className="w-16 flex-shrink-0 text-gray-600">PDS</span>
            <code className="truncate font-mono text-gray-400">{pdsHost}</code>
          </div>
        )}

        {/* Record key */}
        {rkey && (
          <div className="flex items-center gap-2 text-xs">
            <span className="w-16 flex-shrink-0 text-gray-600">Record</span>
            <code className="truncate font-mono text-gray-400">{rkey}</code>
          </div>
        )}

        {/* AT URI */}
        {atUri && (
          <div className="flex items-start gap-2 text-xs">
            <span className="w-16 flex-shrink-0 pt-0.5 text-gray-600">AT URI</span>
            <code className="truncate font-mono text-[10px] text-gray-500 break-all" title={atUri}>
              {atUri}
            </code>
          </div>
        )}

        {/* Repository info */}
        <div className="flex items-center gap-2 text-xs">
          <span className="w-16 flex-shrink-0 text-gray-600">Author</span>
          <span className="text-gray-400 truncate">{post.author.displayName}</span>
          {post.author.handles.bluesky && (
            <span className="text-gray-600">@{post.author.handles.bluesky}</span>
          )}
        </div>
      </div>

      {/* ── Custom feed context ── */}
      {customFeed && (
        <div
          className="border-t border-[var(--color-glass-border)] px-4 py-2"
          style={{ backgroundColor: `${BSKY_BLUE}08` }}
        >
          <p className="text-[11px] text-gray-500">
            <span className="font-medium text-gray-400">Custom feed:</span> {customFeed}
            {feedCreator && (
              <>
                {' '}
                by <span className="text-gray-400">@{feedCreator}</span>
              </>
            )}
          </p>
        </div>
      )}

      {/* ── "View on Bluesky" link ── */}
      {viewUrl && (
        <a
          href={viewUrl}
          target="_blank" rel="noopener noreferrer"
          rel="noopener noreferrer"
          className="flex items-center justify-center border-t border-[var(--color-glass-border)] px-4 py-2 text-xs text-blue-400 transition-colors hover:bg-white/[0.03] hover:text-blue-300"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="mr-1"
            aria-hidden="true"
          >
            <path
              d="M5 2H2V10H10V7M6 6L10 2M10 2H7M10 2V5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          View on Bluesky
        </a>
      )}

      {/* ── Fallback site link ── */}
      {!viewUrl && did && (
        <a
          href={`https://bsky.app/profile/${did}`}
          target="_blank" rel="noopener noreferrer"
          rel="noopener noreferrer"
          className="flex items-center justify-center border-t border-[var(--color-glass-border)] px-4 py-2 text-xs text-blue-400 transition-colors hover:bg-white/[0.03] hover:text-blue-300"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="mr-1"
            aria-hidden="true"
          >
            <path
              d="M5 2H2V10H10V7M6 6L10 2M10 2H7M10 2V5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          View on Bluesky
        </a>
      )}
    </div>
  );
});
