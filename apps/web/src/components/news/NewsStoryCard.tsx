'use client';

import Image from 'next/image';
import { categoryFallback } from './categoryFallback';
import type { NewsStory } from './types';
import {
  BIAS_STYLES,
  FACTUAL_STYLES,
  formatTime,
  sentimentColor,
  sentimentEmoji,
  sentimentScoreColor,
  sentimentScoreEmoji,
  TIER_STYLES,
} from './types';

const CATEGORY_COLORS: Record<string, { badge: string; text: string; bg: string }> = {
  bitcoin: { badge: 'bg-orange-500/15', text: 'text-orange-300', bg: 'bg-orange-950/40' },
  ethereum: { badge: 'bg-blue-500/15', text: 'text-blue-300', bg: 'bg-blue-950/40' },
  solana: { badge: 'bg-green-500/15', text: 'text-green-300', bg: 'bg-green-950/40' },
  defi: { badge: 'bg-cyan-500/15', text: 'text-cyan-300', bg: 'bg-cyan-950/40' },
  nft: { badge: 'bg-violet-500/15', text: 'text-violet-300', bg: 'bg-violet-950/40' },
  regulation: { badge: 'bg-yellow-500/15', text: 'text-yellow-300', bg: 'bg-yellow-950/40' },
  security: { badge: 'bg-red-500/15', text: 'text-red-300', bg: 'bg-red-950/40' },
  markets: { badge: 'bg-emerald-500/15', text: 'text-emerald-300', bg: 'bg-emerald-950/40' },
  // Expanded categories (2026-08-03)
  layer2: { badge: 'bg-purple-500/15', text: 'text-purple-300', bg: 'bg-purple-950/40' },
  bridges: { badge: 'bg-sky-500/15', text: 'text-sky-300', bg: 'bg-sky-950/40' },
  'zero-knowledge': { badge: 'bg-violet-500/15', text: 'text-violet-300', bg: 'bg-violet-950/40' },
  staking: { badge: 'bg-sky-500/15', text: 'text-sky-300', bg: 'bg-sky-950/40' },
  mev: { badge: 'bg-amber-500/15', text: 'text-amber-300', bg: 'bg-amber-950/40' },
  rwa: { badge: 'bg-amber-500/15', text: 'text-amber-300', bg: 'bg-amber-950/40' },
  stablecoin: { badge: 'bg-cyan-500/15', text: 'text-cyan-300', bg: 'bg-cyan-950/40' },
  payments: { badge: 'bg-emerald-500/15', text: 'text-emerald-300', bg: 'bg-emerald-950/40' },
  gaming: { badge: 'bg-rose-500/15', text: 'text-rose-300', bg: 'bg-rose-950/40' },
  ai: { badge: 'bg-fuchsia-500/15', text: 'text-fuchsia-300', bg: 'bg-fuchsia-950/40' },
  aicrypto: { badge: 'bg-purple-500/15', text: 'text-purple-300', bg: 'bg-purple-950/40' },
  storage: { badge: 'bg-teal-500/15', text: 'text-teal-300', bg: 'bg-teal-950/40' },
  identity: { badge: 'bg-indigo-500/15', text: 'text-indigo-300', bg: 'bg-indigo-950/40' },
  social: { badge: 'bg-pink-500/15', text: 'text-pink-300', bg: 'bg-pink-950/40' },
  insurance: { badge: 'bg-orange-500/15', text: 'text-orange-300', bg: 'bg-orange-950/40' },
  carbon: { badge: 'bg-lime-500/15', text: 'text-lime-300', bg: 'bg-lime-950/40' },
  memecoin: { badge: 'bg-amber-500/15', text: 'text-amber-300', bg: 'bg-amber-950/40' },
  etf: { badge: 'bg-fuchsia-500/15', text: 'text-fuchsia-300', bg: 'bg-fuchsia-950/40' },
  onchain: { badge: 'bg-emerald-500/15', text: 'text-emerald-300', bg: 'bg-emerald-950/40' },
  token: { badge: 'bg-yellow-500/15', text: 'text-yellow-300', bg: 'bg-yellow-950/40' },
  dex: { badge: 'bg-teal-500/15', text: 'text-teal-300', bg: 'bg-teal-950/40' },
  oracle: { badge: 'bg-purple-500/15', text: 'text-purple-300', bg: 'bg-purple-950/40' },
  wallet: { badge: 'bg-blue-500/15', text: 'text-blue-300', bg: 'bg-blue-950/40' },
  mining: { badge: 'bg-orange-500/15', text: 'text-orange-300', bg: 'bg-orange-950/40' },
  privacy: { badge: 'bg-violet-500/15', text: 'text-violet-300', bg: 'bg-violet-950/40' },
  governance: { badge: 'bg-indigo-500/15', text: 'text-indigo-300', bg: 'bg-indigo-950/40' },
  dao: { badge: 'bg-purple-500/15', text: 'text-purple-300', bg: 'bg-purple-950/40' },
  macro: { badge: 'bg-emerald-500/15', text: 'text-emerald-300', bg: 'bg-emerald-950/40' },
  business: { badge: 'bg-stone-500/15', text: 'text-stone-300', bg: 'bg-stone-950/40' },
  geopolitics: { badge: 'bg-blue-500/15', text: 'text-blue-300', bg: 'bg-blue-950/40' },
  tech: { badge: 'bg-slate-500/15', text: 'text-slate-300', bg: 'bg-slate-950/40' },
  science: { badge: 'bg-teal-500/15', text: 'text-teal-300', bg: 'bg-teal-950/40' },
  startups: { badge: 'bg-orange-500/15', text: 'text-orange-300', bg: 'bg-orange-950/40' },
  mobile: { badge: 'bg-gray-500/15', text: 'text-gray-300', bg: 'bg-gray-950/40' },
  culture: { badge: 'bg-pink-500/15', text: 'text-pink-300', bg: 'bg-pink-950/40' },
  crypto: { badge: 'bg-orange-500/15', text: 'text-orange-300', bg: 'bg-orange-950/40' },
};

export function NewsStoryCard({
  story,
  compact = false,
  masonry = false,
  onBookmark,
  isBookmarked,
  onShare: _onShare,
}: {
  story: NewsStory;
  compact?: boolean;
  masonry?: boolean;
  onBookmark?: () => void;
  isBookmarked?: boolean;
  onShare?: () => void;
}) {
  const img = story.heroImage || story.imageUrl;
  const tier = TIER_STYLES[story.sourceMeta.tier] ||
    TIER_STYLES[4] || {
      label: 'Standard',
      bg: 'bg-gray-500/15',
      text: 'text-gray-400',
      ring: 'ring-gray-500/30',
    };
  const primaryCat = story.niches?.[0] || story.sourceMeta?.category || 'crypto';
  const biasStyle = story.bias ? BIAS_STYLES[story.bias] : undefined;
  const factualStyle = story.factualRating ? FACTUAL_STYLES[story.factualRating] : undefined;
  const catColor = CATEGORY_COLORS[primaryCat] || {
    badge: 'bg-gray-500/15',
    text: 'text-gray-300',
    bg: 'bg-gray-950/40',
  };
  const isRecent = Date.now() - story.publishedAt < 3600000; // < 1hr

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-gray-800/80 bg-gradient-to-b from-gray-900/90 to-gray-950/90 transition-all duration-300 hover:border-degen-500/20 hover:shadow-[0_0_16px_rgba(34,197,94,0.06)] dark ${masonry ? 'break-inside-avoid mb-4' : ''}`}
    >
      {/* ALWAYS show image section — with gradient fallback if no image */}
      <a
        href={story.url}
        target="_blank"
        rel="noopener"
        className="relative block w-full overflow-hidden"
        style={{ aspectRatio: masonry ? '16/10' : '16/9' }}
      >
        {img ? (
          <Image
            src={img}
            alt={story.title}
            width={400}
            height={masonry ? 250 : 225}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          /* Branded category fallback (CSS gradient + category glyph, no image asset) */
          <div
            className={`h-full w-full ${categoryFallback(primaryCat).bg} flex items-center justify-center`}
          >
            <div className={`text-4xl ${categoryFallback(primaryCat).text}`}>
              {categoryFallback(primaryCat).glyph}
            </div>
          </div>
        )}
        {/* Bottom gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/20 to-transparent" />
        {/* Category badge */}
        <span
          className={`absolute left-2 top-2 rounded-md ${catColor.badge} px-1.5 py-0.5 text-[9px] font-bold ${catColor.text} ring-1 ring-white/10 backdrop-blur-sm`}
        >
          {primaryCat}
        </span>
        {/* "NEW" badge for <1hr */}
        {isRecent && (
          <span className="absolute right-2 top-2 animate-pulse rounded-md bg-red-500/80 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-[0_0_8px_rgba(239,68,68,0.5)]">
            NEW
          </span>
        )}
        {/* Sentiment indicator overlay */}
        <span
          className={`absolute right-2 bottom-2 rounded-full border px-1.5 py-0.5 text-[9px] backdrop-blur-sm ${sentimentColor(story.sentiment)}`}
        >
          {sentimentEmoji(story.sentiment)}
        </span>
      </a>

      <div className="flex flex-1 flex-col p-3">
        {/* Meta row */}
        <div className="mb-1.5 flex flex-wrap items-center gap-1">
          {/* Source + Tier badge — prominent colored chip */}
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${tier.bg} ${tier.text} ${tier.ring} ring-1`}
            title={`Source tier ${story.sourceMeta.tier || 4} — higher is more authoritative`}
          >
            T{story.sourceMeta.tier || 4} · {tier.label}
          </span>
          <span className="text-[10px] text-gray-500">{story.source}</span>
          {/* Ground News-style Bias Badge */}
          {biasStyle && (
            <span
              className={`rounded px-1 py-0.5 text-[8px] font-bold ${biasStyle.bg} ${biasStyle.ring} ring-1`}
              style={{ color: biasStyle.color }}
            >
              {biasStyle.label}
            </span>
          )}
          {/* Factual Rating Badge */}
          {factualStyle && (
            <span
              className={`rounded px-1 py-0.5 text-[8px] font-bold ${factualStyle.bg}`}
              style={{ color: factualStyle.color }}
            >
              {factualStyle.label}
            </span>
          )}
          {/* Sentiment Score Badge */}
          {story.sentimentScore != null && (
            <span
              className={`rounded px-1 py-0.5 text-[8px] font-bold ${sentimentScoreColor(story.sentimentScore)}`}
            >
              {sentimentScoreEmoji(story.sentimentScore)} {story.sentimentScore > 0 ? '+' : ''}
              {story.sentimentScore}
            </span>
          )}
          {/* Also covered by count */}
          {(story.alsoCoveredByCount ?? story.alsoCoveredBy.length - 1) > 1 && (
            <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[8px] text-blue-300">
              +{story.alsoCoveredByCount ?? story.alsoCoveredBy.length - 1}
            </span>
          )}
          <span className="ml-auto text-[9px] text-gray-500">{formatTime(story.publishedAt)}</span>
        </div>
        {/* Title */}
        <a
          href={story.url}
          target="_blank"
          rel="noopener"
          className="mb-1.5 block text-sm font-semibold leading-snug text-white transition-colors group-hover:text-degen-400 line-clamp-2"
        >
          {story.title}
        </a>
        {/* Summary (hidden in compact mode) */}
        {!compact && (
          <p className="mb-2 text-xs leading-relaxed text-gray-400 line-clamp-2">
            {story.summary || story.metaDescription}
          </p>
        )}
        {/* Niche category badges */}
        {story.niches && story.niches.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {story.niches.slice(0, 4).map((n) => {
              const nc = CATEGORY_COLORS[n] || {
                badge: 'bg-gray-500/15',
                text: 'text-gray-300',
                bg: 'bg-gray-950/40',
              };
              return (
                <span
                  key={n}
                  className={`rounded-md ${nc.badge} px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${nc.text} ring-1 ring-white/10`}
                >
                  {n}
                </span>
              );
            })}
          </div>
        )}
        {/* Bottom: tokens + actions */}
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {story.entities?.tokens?.slice(0, 2).map((t) => (
              <span
                key={t}
                className="rounded bg-yellow-500/10 px-1 py-0.5 text-[8px] font-mono text-yellow-400"
              >
                ${t}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {story.alsoCoveredByDisplay && (
              <span className="text-[8px] text-gray-500" title={story.alsoCoveredByDisplay}>
                📰
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBookmark?.();
              }}
              className={`rounded p-1 text-xs transition-colors ${isBookmarked ? 'text-degen-400' : 'text-gray-500 opacity-0 group-hover:opacity-100 hover:text-gray-300'}`}
            >
              🔖
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function StorySkeleton({ masonry = false }: { masonry?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded-xl border border-gray-800 bg-gray-900/50 ${masonry ? 'break-inside-avoid mb-4' : ''}`}
    >
      <div className="aspect-video w-full rounded-t-xl bg-gray-800" />
      <div className="flex flex-col gap-2 p-3">
        <div className="flex gap-2">
          <div className="h-3 w-14 rounded bg-gray-800" />
          <div className="h-3 w-10 rounded bg-gray-800" />
          <div className="ml-auto h-3 w-8 rounded bg-gray-800" />
        </div>
        <div className="h-4 w-full rounded bg-gray-800" />
        <div className="h-4 w-3/4 rounded bg-gray-800" />
        <div className="flex gap-2">
          <div className="h-4 w-12 rounded-full bg-gray-800" />
          <div className="h-4 w-14 rounded-full bg-gray-800" />
        </div>
      </div>
    </div>
  );
}
