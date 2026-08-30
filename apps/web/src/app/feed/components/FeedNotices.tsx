'use client';

/**
 * @degenfeed/web — Feed notices/errors strip
 *
 * Renders the bridge-reported `meta.notices` (info, e.g. fallback happened)
 * and `meta.errors` (warnings, e.g. a provider was unreachable) as a clean,
 * consistent stack above the timeline — replacing the previous raw <div> map.
 * Duplicates are collapsed (transient strings, no stable ids) so notices can
 * be keyed by content without index-key warnings.
 */

import type { FeedMeta } from '../../../hooks/feed/useUnifiedFeed';

export function FeedNotices({ meta }: { meta?: FeedMeta }) {
  const notices = [...new Set(meta?.notices ?? [])];
  const errors = [...new Set(meta?.errors ?? [])];
  if (notices.length === 0 && errors.length === 0) return null;
  return (
    <div className="mb-3 flex flex-col gap-2" role="status" aria-live="polite">
      {notices.map((n) => (
        <div
          key={n}
          className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-400"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M7 6.2v3.2M7 4.2v.2"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          <span className="min-w-0">{n}</span>
        </div>
      ))}
      {errors.map((e) => (
        <div
          key={e}
          className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          >
            <path
              d="M7 4.2v3.4M7 10.4v.1M6 1.8 1.2 10.6a1 1 0 0 0 .9 1.5h9.8a1 1 0 0 0 .9-1.5L8 1.8a1 1 0 0 0-2 0Z"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="min-w-0">{e}</span>
        </div>
      ))}
    </div>
  );
}
