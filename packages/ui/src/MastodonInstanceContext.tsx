'use client';

/**
 * @degenfeed/ui — MastodonInstanceContext
 *
 * Shows the Mastodon instance a post came from.
 * Instance icon, name, user count, and a "View original" link.
 * Includes fediverse context if the post is federated from another instance.
 *
 * Design: compact instance card with Mastodon purple, domain badge style.
 * Tonal reference: Mastodon's profile page — instance-aware, federated.
 */

import Image from 'next/image';
import { memo } from 'react';

// ─── Types ───────────────────────────────────────────────────────────

export interface MastodonInstanceContextProps {
  /** Instance domain (e.g. "mastodon.social", "hachyderm.io") */
  instance: string;
  /** Optional: instance display name */
  instanceName?: string;
  /** Approximate user count */
  userCount?: number;
  /** If the post was federated from a different instance, show origin */
  federatedFrom?: string;
  /** URL to the original post on the instance */
  postUrl?: string;
  /** Optional: instance description / short blurb */
  description?: string;
  /** Optional: instance favicon or icon URL */
  iconUrl?: string;
}

// ─── Constants ───────────────────────────────────────────────────────

const MASTODON_PURPLE = '#6364ff';

// ─── Component ───────────────────────────────────────────────────────

export const MastodonInstanceContext = memo(function MastodonInstanceContext({
  instance,
  instanceName,
  userCount,
  federatedFrom,
  postUrl,
  description,
  iconUrl,
}: MastodonInstanceContextProps) {
  const cleanInstance = instance.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const displayName = instanceName ?? cleanInstance;
  const hostLabel = cleanInstance.split('.').slice(-2).join('.');

  // Build the original post URL
  const originalUrl = postUrl ?? `https://${cleanInstance}`;

  return (
    <div
      className="mt-3 overflow-hidden rounded-xl border transition-colors"
      style={{ borderColor: `${MASTODON_PURPLE}22`, backgroundColor: `${MASTODON_PURPLE}08` }}
    >
      {/* ── Instance header ── */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Instance icon */}
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold"
          style={{ backgroundColor: `${MASTODON_PURPLE}18`, color: MASTODON_PURPLE }}
        >
          {iconUrl ? (
            <Image src={iconUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-lg object-cover" loading="lazy" decoding="async" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21.5 12.5C21.5 18 17.5 21 12 21C6.5 21 2.5 18 2.5 12.5V5.5L12 3L21.5 5.5V12.5Z" />
            </svg>
          )}
        </div>

        {/* Instance info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-200 truncate">{displayName}</span>
            <span
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${MASTODON_PURPLE}18`, color: MASTODON_PURPLE }}
            >
              {hostLabel}
            </span>
          </div>

          {description && (
            <p className="mt-0.5 text-xs text-[var(--color-muted)] line-clamp-1">{description}</p>
          )}

          {/* Stats row */}
          <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-600">
            {userCount != null && (
              <span className="inline-flex items-center gap-1">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="currentColor"
                  aria-hidden="true"
                  className="text-gray-700"
                >
                  <circle cx="4.5" cy="3.5" r="2" />
                  <path d="M0 10C0 8 2 7 4.5 7S9 8 9 10" />
                  <circle cx="8.5" cy="3.5" r="2" />
                  <path d="M6 10C6 8 7.5 7 9 7S12 8 12 10" />
                </svg>
                {userCount.toLocaleString()} users
              </span>
            )}

            {/* Federated from badge */}
            {federatedFrom && federatedFrom !== cleanInstance && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/20 px-1.5 py-0.5 text-[10px] text-amber-400">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="0.8" fill="none" />
                  <path d="M5 2V5L7 7" stroke="currentColor" strokeWidth="0.8" fill="none" />
                </svg>
                Federated from {federatedFrom.replace(/^https?:\/\//, '')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Fediverse context note ── */}
      {federatedFrom && federatedFrom !== cleanInstance && (
        <div className="border-t border-[var(--color-glass-border)] px-4 py-2">
          <p className="text-[11px] leading-relaxed text-gray-600">
            <span className="font-medium text-[var(--color-muted)]">Fediverse:</span> This post originated on{' '}
            <span className="text-[var(--color-muted)]">{federatedFrom.replace(/^https?:\/\//, '')}</span> and
            was federated to {displayName}.
          </p>
        </div>
      )}

      {/* ── "View original" link ── */}
      <a
        href={originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center border-t border-[var(--color-glass-border)] px-4 py-2 text-xs transition-colors"
        style={{ color: MASTODON_PURPLE }}
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
        View original on {cleanInstance}
      </a>
    </div>
  );
});
