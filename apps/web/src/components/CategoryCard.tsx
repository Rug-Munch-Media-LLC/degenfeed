'use client';

import Link from 'next/link';

interface CategoryCardProps {
  id: string;
  name: string;
  emoji: string;
  color: string;
  gradient: string;
  postCount: number;
  userCount: number;
  description: string;
  href: string;
}

export function CategoryCard({
  name,
  emoji,
  color,
  gradient,
  postCount,
  userCount,
  description,
  href,
}: CategoryCardProps) {
  function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 hover:scale-[1.02] hover:shadow-xl"
      style={{ borderColor: `${color}33` }}
    >
      {/* Gradient background */}
      <div
        className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-90"
        style={{ background: gradient }}
      />

      {/* Decorative pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, ${color} 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-3 p-5">
        {/* Emoji + name row */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-xl shadow-lg backdrop-blur-sm"
            style={{
              backgroundColor: `${color}33`,
              boxShadow: `0 4px 16px ${color}33`,
            }}
          >
            {emoji}
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
              {name}
            </h3>
            <p className="text-xs line-clamp-1" style={{ color: 'var(--color-muted)' }}>
              {description}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-muted)' }}>
          <div className="flex items-center gap-1.5">
            <span className="text-sm">📊</span>
            <span className="font-semibold tabular-nums" style={{ color }}>
              {formatCount(postCount)}
            </span>
            <span>posts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm">👤</span>
            <span className="font-semibold tabular-nums" style={{ color }}>
              {formatCount(userCount)}
            </span>
            <span>active</span>
          </div>
        </div>

        {/* Explore button */}
        <div className="mt-1">
          <span
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              backgroundColor: `${color}22`,
              color,
            }}
          >
            Explore {name}
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export const CATEGORIES: CategoryCardProps[] = [
  {
    id: 'crypto',
    name: 'Crypto',
    emoji: '₿',
    color: '#f59e0b',
    gradient: 'linear-gradient(145deg, #f59e0b25 0%, #f59e0b08 60%, transparent 100%)',
    postCount: 45231,
    userCount: 12840,
    description: 'Markets, prices, trading, alpha',
    href: '/feed?niche=crypto',
  },
  {
    id: 'defi',
    name: 'DeFi',
    emoji: '🏦',
    color: '#6366f1',
    gradient: 'linear-gradient(145deg, #6366f125 0%, #6366f108 60%, transparent 100%)',
    postCount: 28920,
    userCount: 8430,
    description: 'Yield, lending, DEXs, protocols',
    href: '/feed?niche=defi',
  },
  {
    id: 'nft',
    name: 'NFT',
    emoji: '🖼',
    color: '#ec4899',
    gradient: 'linear-gradient(145deg, #ec489925 0%, #ec489908 60%, transparent 100%)',
    postCount: 18450,
    userCount: 5620,
    description: 'Collections, mints, marketplaces',
    href: '/feed?niche=nft',
  },
  {
    id: 'ai',
    name: 'AI & ML',
    emoji: '🤖',
    color: '#06b6d4',
    gradient: 'linear-gradient(145deg, #06b6d425 0%, #06b6d408 60%, transparent 100%)',
    postCount: 31200,
    userCount: 9870,
    description: 'Research, agents, LLMs, tools',
    href: '/feed?niche=ai',
  },
  {
    id: 'trading',
    name: 'Trading',
    emoji: '📈',
    color: '#22c55e',
    gradient: 'linear-gradient(145deg, #22c55e25 0%, #22c55e08 60%, transparent 100%)',
    postCount: 22100,
    userCount: 7450,
    description: 'TA, signals, strategies, bots',
    href: '/feed?niche=trading',
  },
  {
    id: 'security',
    name: 'Security',
    emoji: '🔒',
    color: '#ef4444',
    gradient: 'linear-gradient(145deg, #ef444425 0%, #ef444408 60%, transparent 100%)',
    postCount: 12500,
    userCount: 3890,
    description: 'Exploits, audits, CVEs, threat intel',
    href: '/feed?niche=security',
  },
];
