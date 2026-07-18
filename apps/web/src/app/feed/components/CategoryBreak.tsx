'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { UnifiedPost } from '@degenfeed/types';

/**
 * Category labels derived from post niches with human-readable names.
 */
const CATEGORY_LABELS: Record<string, { label: string; icon: string; href: string; color: string }> = {
  defi: { label: 'DeFi', icon: '🏦', href: '/feed?topic=defi', color: '#f59e0b' },
  nft: { label: 'NFTs', icon: '🖼️', href: '/feed?topic=nft', color: '#8b5cf6' },
  ai: { label: 'AI & ML', icon: '🤖', href: '/feed?topic=ai', color: '#06b6d4' },
  memecoin: { label: 'Memes', icon: '🎭', href: '/feed?topic=memecoin', color: '#ef4444' },
  bitcoin: { label: 'Bitcoin', icon: '₿', href: '/feed?topic=bitcoin', color: '#f7931a' },
  ethereum: { label: 'Ethereum', icon: '⬡', href: '/feed?topic=ethereum', color: '#627eea' },
  solana: { label: 'Solana', icon: '◎', href: '/feed?topic=solana', color: '#9945ff' },
  security: { label: 'Security', icon: '🛡️', href: '/feed?topic=security', color: '#dc2626' },
  regulation: { label: 'Regulation', icon: '⚖️', href: '/feed?topic=regulation', color: '#7c3aed' },
  macro: { label: 'Macro', icon: '📈', href: '/feed?topic=macro', color: '#059669' },
  tech: { label: 'Tech', icon: '⚡', href: '/feed?topic=tech', color: '#2563eb' },
  science: { label: 'Science', icon: '🔬', href: '/feed?topic=science', color: '#0d9488' },
  layer2: { label: 'L2s & Scaling', icon: '⚙️', href: '/feed?topic=layer2', color: '#6366f1' },
  stablecoin: { label: 'Stablecoins', icon: '💵', href: '/feed?topic=stablecoin', color: '#16a34a' },
  onchain: { label: 'On-chain', icon: '🔗', href: '/feed?topic=onchain', color: '#ca8a04' },
};

/**
 * Pick the most representative category from a set of niches.
 */
function pickCategory(niches: string[]): string | null {
  const priority = [
    'ai', 'defi', 'nft', 'memecoin', 'bitcoin', 'ethereum', 'solana',
    'security', 'regulation', 'macro', 'tech', 'science', 'layer2',
    'stablecoin', 'onchain',
  ];
  for (const p of priority) {
    if (niches.includes(p)) return p;
  }
  return niches[0] ?? null;
}

interface CategoryBreakProps {
  /** The set of niches detected across a batch of posts */
  niches: string[];
  /** Index of this break in the feed */
  index: number;
}

/**
 * A category break card inserted every ~12 posts in the feed.
 * Shows the dominant niche/category of the recent batch and a "See more" link.
 */
export function CategoryBreakCard({ niches, index }: CategoryBreakProps) {
  const category = useMemo(() => pickCategory(niches), [niches]);
  const meta = category ? CATEGORY_LABELS[category] : null;

  if (!meta) {
    // Fallback to first niche or generic
    const fallbackLabel = niches[0] ?? 'Content';
    return (
      <div
        className="category-break feed-item-enter border-b border-[var(--color-glass-border)] px-4 py-5"
        style={{ '--stagger-i': index } as React.CSSProperties}
        role="separator"
        aria-label={`${fallbackLabel} section`}
      >
        <hr className="border-t border-[var(--color-glass-border)]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className="category-break feed-item-enter border-b border-[var(--color-glass-border)] px-4 py-5"
      style={{ '--stagger-i': index } as React.CSSProperties}
      role="separator"
      aria-label={`${meta.label} section`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
            style={{ backgroundColor: `${meta.color}18` }}
            aria-hidden="true"
          >
            {meta.icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg)] truncate">
              {meta.label}
            </p>
            <p
              className="text-[10px] text-[var(--color-muted)] truncate"
            >
              Posts trending in this category
            </p>
          </div>
        </div>
        <Link
          href={meta.href}
          className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-glass-border)] px-3 py-1 text-[11px] font-medium text-[var(--color-muted)] transition-all hover:border-transparent hover:text-white"
          style={
            {
              '--hover-bg': `${meta.color}22`,
            } as React.CSSProperties
          }
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = `var(--hover-bg, ${meta.color}22)`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
          onClick={(e) => e.stopPropagation()}
        >
          See all
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5"
          >
            <path
              d="M6 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}

/**
 * Determines if a category break should be inserted at this index.
 * Returns the aggregated niches of the next batch if the break position matches.
 */
export function shouldInsertCategoryBreak(
  index: number,
  total: number,
): boolean {
  if (index === 0) return false;
  if (index >= total - 1) return false;

  // Insert every 12 posts
  const BREAK_INTERVAL = 12;
  return index % BREAK_INTERVAL === 0;
}

/**
 * Aggregate niches from a slice of posts for the category break label.
 */
export function aggregateNiches(
  posts: UnifiedPost[],
  startIndex: number,
  batchSize = 8,
): string[] {
  const nicheCounts = new Map<string, number>();
  for (let i = startIndex; i < Math.min(startIndex + batchSize, posts.length); i++) {
    const post = posts[i];
    if (!post) continue;
    for (const niche of post.niches) {
      nicheCounts.set(niche, (nicheCounts.get(niche) ?? 0) + 1);
    }
  }
  // Return niches sorted by frequency
  return [...nicheCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([niche]) => niche)
    .slice(0, 3);
}
