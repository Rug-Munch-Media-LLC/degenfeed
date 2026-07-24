'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { DirectoryEntry, FeddyCategory } from './types';
import { CATEGORY_EMOJIS, CATEGORY_LABELS } from './types';

// === Helpers ===========================================================

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeSince(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// === Card ==============================================================

export function CommunityCard({ entry }: { entry: DirectoryEntry }) {
  const categoryEmoji = CATEGORY_EMOJIS[entry.category as FeddyCategory] || '🌐';
  const categoryLabel = CATEGORY_LABELS[entry.category as FeddyCategory] || entry.category;

  const isActive = entry.federationStatus === 'active';
  const cardBorder = isActive
    ? 'border-[var(--color-border)] hover:border-degen-500/30'
    : 'border-red-500/10 hover:border-red-500/20 opacity-60';

  return (
    <Link
      href={`/feddy/${entry.name}`}
      className={`group flex flex-col rounded-xl border bg-[var(--color-card)] p-4 transition-all hover:shadow-lg hover:shadow-degen-500/5 ${cardBorder}`}
    >
      {/* Header: avatar + meta */}
      <div className="mb-3 flex items-start gap-3">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-base font-bold text-degen-400">
          {entry.avatarUrl ? (
            <Image
              src={entry.avatarUrl}
              alt={entry.displayName}
              width={48}
              height={48}
              className="h-12 w-12 rounded-xl object-cover"
            />
          ) : (
            entry.displayName.charAt(0).toUpperCase()
          )}
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
              <span className="text-xs font-bold text-red-400">Suspended</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-[var(--color-fg)] group-hover:text-degen-400 transition-colors">
            {entry.displayName}
          </h3>
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-muted)]">
            <span>{formatCount(entry.memberCount)} members</span>
            <span>·</span>
            <span>{formatCount(entry.postCount)} posts</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-[var(--color-muted)]">
        {entry.description || 'No description'}
      </p>

      {/* Footer: category + tags */}
      <div className="mt-auto flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[9px] font-medium text-purple-400">
          <span>{categoryEmoji}</span>
          <span>{categoryLabel}</span>
        </span>

        {entry.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="truncate rounded-full bg-[var(--color-overlay)] px-2 py-0.5 text-[9px] text-[var(--color-muted)] max-w-[60px]"
          >
            {tag}
          </span>
        ))}

        {entry.linkedCoin && (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium text-amber-400"
            title="Linked creator coin"
          >
            <span>🪙</span>
          </span>
        )}

        <span className="ml-auto text-[9px] text-[var(--color-muted)]">
          {timeSince(entry.createdAt)}
        </span>
      </div>
    </Link>
  );
}
