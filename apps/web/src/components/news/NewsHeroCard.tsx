'use client';

import Image from 'next/image';
import type { NewsStory } from './types';
import { TIER_STYLES, sentimentColor, sentimentEmoji, formatTime } from './types';

const CATEGORY_COLORS: Record<string, { badge: string; text: string; bg: string }> = {
  bitcoin: { badge: 'bg-orange-500/15', text: 'text-orange-300', bg: 'bg-orange-950/40' },
  ethereum: { badge: 'bg-blue-500/15', text: 'text-blue-300', bg: 'bg-blue-950/40' },
  solana: { badge: 'bg-green-500/15', text: 'text-green-300', bg: 'bg-green-950/40' },
  defi: { badge: 'bg-cyan-500/15', text: 'text-cyan-300', bg: 'bg-cyan-950/40' },
  nft: { badge: 'bg-violet-500/15', text: 'text-violet-300', bg: 'bg-violet-950/40' },
  regulation: { badge: 'bg-yellow-500/15', text: 'text-yellow-300', bg: 'bg-yellow-950/40' },
  security: { badge: 'bg-red-500/15', text: 'text-red-300', bg: 'bg-red-950/40' },
  markets: { badge: 'bg-emerald-500/15', text: 'text-emerald-300', bg: 'bg-emerald-950/40' },
  macro: { badge: 'bg-amber-500/15', text: 'text-amber-300', bg: 'bg-amber-950/40' },
};

export function NewsHeroCard({ story, onBookmark, isBookmarked, onShare }: {
  story: NewsStory; onBookmark?: () => void; isBookmarked?: boolean; onShare?: () => void;
}) {
  const img = story.heroImage || story.imageUrl;
  const tier = TIER_STYLES[story.sourceMeta.tier] || TIER_STYLES[4];
  const primaryCat = story.niches?.[0] || story.sourceMeta?.category || 'crypto';
  const catColor = CATEGORY_COLORS[primaryCat] || { badge: 'bg-gray-500/15', text: 'text-gray-300', bg: 'bg-gray-950/40' };

  return (
    <a href={story.url} target="_blank" rel="noopener"
      className="group relative flex flex-col overflow-hidden rounded-xl border border-degen-500/20 bg-gradient-to-b from-gray-800/90 to-gray-900/90 transition-all duration-300 hover:border-degen-500/40 hover:shadow-[0_0_32px_rgba(34,197,94,0.12)] md:flex-row">
      {/* Image: either og:image or gradient fallback */}
      <div className={`relative aspect-video w-full overflow-hidden md:w-2/5 md:aspect-auto ${!img ? `bg-gradient-to-br ${catColor.bg}` : ''}`}>
        {img ? (
          <Image src={img} alt={story.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" priority />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl opacity-20">📰</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent md:bg-gradient-to-r md:from-gray-900/80 md:via-gray-900/40 md:to-transparent" />
        {/* Category badge */}
        <span className={`absolute left-3 top-3 rounded-md ${catColor.badge} px-2 py-0.5 text-[10px] font-bold ${catColor.text} ring-1 ring-white/10 backdrop-blur-sm`}>
          {primaryCat}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {story.isBreaking && (
            <span className="animate-pulse rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400 ring-1 ring-red-500/30">BREAKING</span>
          )}
          {/* Source + Tier badge */}
          <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${tier.bg} ${tier.text} ${tier.ring} ring-1`}>
            {story.source} · {tier.label}
          </span>
          {/* Sentiment indicator */}
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] ${sentimentColor(story.sentiment)}`}>
            {sentimentEmoji(story.sentiment)} {story.sentiment.label}
          </span>
          {story.readingTime && <span className="text-[10px] text-gray-500">{story.readingTime}m read</span>}
          <span className="ml-auto text-xs text-gray-400">{formatTime(story.publishedAt)}</span>
        </div>
        <h2 className="mb-2 text-xl font-bold leading-tight text-white transition-colors group-hover:text-degen-400 md:text-2xl">{story.title}</h2>
        <p className="mb-4 text-sm leading-relaxed text-gray-300 line-clamp-2">{story.summary || story.metaDescription}</p>
        <div className="flex flex-wrap items-center gap-3">
          {/* Also reported by cluster */}
          {(story.alsoCoveredByCount ?? story.alsoCoveredBy.length - 1) > 1 && (
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] text-blue-300 ring-1 ring-blue-500/20">
              📰 {(story.alsoCoveredByCount ?? story.alsoCoveredBy.length - 1) + 1} sources
            </span>
          )}
          {/* Token tags */}
          {story.entities?.tokens?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {story.entities.tokens.slice(0, 4).map((t) => (
                <span key={t} className="rounded-md bg-yellow-500/10 px-1.5 py-0.5 text-[9px] font-mono text-yellow-400 ring-1 ring-yellow-500/20">${t}</span>
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBookmark?.(); }}
              className={`rounded-lg p-1.5 text-xs transition-colors ${isBookmarked ? 'text-degen-400 bg-degen-500/15' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`}>🔖</button>
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onShare?.(); }}
              className="rounded-lg p-1.5 text-xs text-gray-500 transition-colors hover:text-gray-300 hover:bg-gray-800">↗</button>
          </div>
        </div>
      </div>
    </a>
  );
}
