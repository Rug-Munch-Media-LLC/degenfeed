'use client';

import type { TopPost } from './types';
import { formatDate, formatUsd, protocolBadge, shortenPost } from './utils';

export function PostRow({ post, rank }: { post: TopPost; rank: number }) {
  const badge = protocolBadge(post.protocol);
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-3 transition-all duration-200 hover:border-[var(--color-border)] hover:bg-[var(--color-overlay)]">
      <span className="mt-0.5 w-5 shrink-0 text-center text-[11px] font-bold text-[var(--color-muted)]">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-[var(--color-muted)]">
          {shortenPost(post.content, 80)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: badge.bg, color: badge.fg }}
          >
            {badge.label}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-[var(--color-muted)]">
            ♥ {post.likes}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-[var(--color-muted)]">
            ↻ {post.reposts}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-[var(--color-muted)]">
            ⌨ {post.replies}
          </span>
          {post.tipsUsd > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-degen-400">
              ✦ {formatUsd(post.tipsUsd)}
            </span>
          )}
          <span className="ml-auto text-[9px] text-[var(--color-muted)]">
            {formatDate(post.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
