'use client';

/**
 * @degenfeed/ui — LemmyThreadView
 *
 * Renders a Lemmy post as a threaded Reddit-style discussion.
 * Community name, upvotes/downvotes, nested comments with
 * colored thread lines (like old Reddit), and links to the
 * community instance.
 *
 * Design: compact, information-rich, green-accented threaded lines.
 * Tonal reference: old.reddit.com with degenfeed cyberpunk accents.
 */

import type { UnifiedPost } from '@degenfeed/types';
import Image from 'next/image';
import { memo, useEffect, useState } from 'react';

import type { LemmyComment, LemmyThreadViewProps } from './lemmy-types';
export type { LemmyComment, LemmyThreadViewProps };
export { VirtualizedCommentList } from './lemmy-comment-node';
export { buildCommentTree, extractComments, extractLemmyData } from './lemmy-comment-tree';

import { formatScore } from './lemmy-helpers';
import { VirtualizedCommentList } from './lemmy-comment-node';
import { extractComments, extractLemmyData } from './lemmy-comment-tree';
import { LemmyTipButton } from './LemmyTipButton';

// ─── Root Component ─────────────────────────────────────────────────

export const LemmyThreadView = memo(function LemmyThreadView({
  post,
  comments: externalComments,
  communityName: externalCommunityName,
  communityIcon: externalCommunityIcon,
  instanceDomain: externalInstanceDomain,
}: LemmyThreadViewProps) {
  const { communityName, communityIcon, instanceDomain } = {
    communityName: externalCommunityName ?? extractLemmyData(post).communityName,
    communityIcon: externalCommunityIcon ?? extractLemmyData(post).communityIcon,
    instanceDomain: externalInstanceDomain ?? extractLemmyData(post).instanceDomain,
  };

  const comments = externalComments ?? extractComments(post);
  const domainDisplay = instanceDomain.replace(/^https?:\/\//, '');

  const [postTipCount, setPostTipCount] = useState(0);
  const [postTipTotal, setPostTipTotal] = useState(0);
  const authorEvmAddress = post.author.keys.evmAddress;
  const authorSolanaAddress = post.author.keys.solanaAddress;
  const hasAuthorWallet = !!(authorEvmAddress || authorSolanaAddress);

  useEffect(() => {
    if (!hasAuthorWallet) return;
    let cancelled = false;
    fetch(`/api/lemmy/tip/stats?contentId=${encodeURIComponent(post.id)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ totalCount: number; totalUsd: number }>) : null))
      .then((data) => { if (!cancelled && data) { setPostTipCount(data.totalCount); setPostTipTotal(data.totalUsd); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [post.id, hasAuthorWallet]);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]">
      {/* Community header */}
      <a href={`https://${domainDisplay}/${communityName.startsWith('c/') ? communityName : `c/${communityName}`}`}
        target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5 transition-colors hover:bg-[var(--color-muted)]"
        onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
          style={{ backgroundColor: '#00b86822', color: '#00b868' }}>
          {communityIcon ? (
            <Image src={communityIcon} alt="" width={24} height={24}
              className="h-6 w-6 rounded-full object-cover" unoptimized />
          ) : communityName.charAt(0).toUpperCase()}
        </span>
        <span className="text-sm font-semibold text-gray-200">{communityName}</span>
        <span className="ml-auto text-xs text-gray-600">
          View on <span className="text-degen-500">{domainDisplay}</span>
        </span>
      </a>

      {/* Post header (upvote + title) */}
      <div className="flex gap-3 px-4 py-3">
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          <button type="button"
            className="rounded p-1 text-gray-600 transition-colors hover:bg-orange-500/10 hover:text-orange-400"
            aria-label="Upvote" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><path d="M9 2L16 14H2L9 2Z" /></svg>
          </button>
          <span className="text-xs font-bold tabular-nums"
            style={{ color: post.metrics.likes >= 0 ? '#00b868' : '#6b7280' }}>
            {formatScore(post.metrics.likes - post.metrics.reposts || post.metrics.likes)}
          </span>
          <button type="button"
            className="rounded p-1 text-gray-600 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
            aria-label="Downvote" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><path d="M9 16L2 4H16L9 16Z" /></svg>
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="mb-1 text-sm font-semibold leading-snug text-gray-100">
            {post.text.split('\n')[0] || post.text.slice(0, 120)}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span>Posted by <span className="font-medium text-[var(--color-muted)]">{post.author.displayName}</span></span>
            <span aria-hidden="true">·</span>
            <span>{post.metrics.replies} comments</span>
            <span aria-hidden="true">·</span>
            <span>{post.metrics.reposts} shares</span>
            {hasAuthorWallet && (
              <LemmyTipButton contentId={post.id} contentType="post"
                authorEvmAddress={authorEvmAddress} authorSolanaAddress={authorSolanaAddress}
                tipCount={postTipCount} tipTotalUsd={postTipTotal} />
            )}
          </div>
        </div>
      </div>

      {/* Comments section */}
      {comments.length > 0 && (
        <div className="border-t border-[var(--color-border)] px-2 py-2">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Comments ({comments.length})
            </span>
          </div>
          <VirtualizedCommentList comments={comments} depth={0}
            fallbackEvmAddress={authorEvmAddress} fallbackSolanaAddress={authorSolanaAddress} />
        </div>
      )}

      {/* "View on community" link */}
      <a href={`https://${domainDisplay}/${communityName.startsWith('c/') ? communityName : `c/${communityName}`}`}
        target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center border-t border-[var(--color-border)] px-4 py-2 text-xs text-degen-500 transition-colors hover:bg-[var(--color-muted)] hover:text-degen-400"
        onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="mr-1" aria-hidden="true">
          <path d="M5 2H2V10H10V7M6 6L10 2M10 2H7M10 2V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        View on {domainDisplay}
      </a>
    </div>
  );
});
