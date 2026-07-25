'use client';

import type { UnifiedPost } from '@degenfeed/types';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

interface NewsSourceMeta {
  id: string;
  name: string;
  tier: number;
  credibility: number;
}

interface SentimentResult {
  label: 'bullish' | 'bearish' | 'neutral';
  score: number;
  confidence: number;
  signals: string[];
}

interface StoryEntities {
  tokens: string[];
  protocols: string[];
  people: string[];
  companies: string[];
  chains: string[];
  nfts: string[];
}

interface StoryCluster {
  id: string;
  title: string;
  storyCount: number;
  topCategories: string[];
  aggregateSentiment: SentimentResult;
}

interface NewsStory {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  sourceMeta: NewsSourceMeta;
  author: string;
  publishedAt: number;
  imageUrl?: string;
  categories: string[];
  niches: string[];
  sentiment: SentimentResult;
  entities: StoryEntities;
  alsoCoveredBy: string[];
  isBreaking: boolean;
  velocity: number;
  score: number;
  readingTime?: number;
  heroImage?: string;
  authorName?: string;
  isDiscovery?: boolean;
  scoreComponents?: {
    topicalRelevance: number;
    sourceCredibility: number;
    freshness: number;
    engagementVelocity: number;
    depthMatch: number;
    total: number;
  };
}

interface NewsMeta {
  total: number;
  sourceCount: number;
  fetchedAt: number;
  errors: string[];
  sentiment: { bullish: number; bearish: number; neutral: number };
  trending: Array<{ topic: string; count: number; score: number }>;
  category: string;
  query?: string;
  personalized: boolean;
  topCategories: Array<{
    categoryId: string;
    label: string;
    emoji: string;
    count: number;
    avgConfidence: number;
  }>;
}

// ─── Constants ────────────────────────────────────────────────────────────

const CATEGORY_TABS = [
  { id: '', label: 'All', emoji: '🌐' },
  { id: 'bitcoin', label: 'Bitcoin', emoji: '₿' },
  { id: 'ethereum', label: 'Ethereum', emoji: '⟠' },
  { id: 'solana', label: 'Solana', emoji: '◎' },
  { id: 'defi', label: 'DeFi', emoji: '🏦' },
  { id: 'ai', label: 'AI', emoji: '🤖' },
  { id: 'nft', label: 'NFTs', emoji: '🖼️' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'privacy', label: 'Privacy', emoji: '👁️' },
  { id: 'macro', label: 'Macro', emoji: '📊' },
  { id: 'tech', label: 'Tech', emoji: '💻' },
  { id: 'security', label: 'Security', emoji: '🛡️' },
  { id: 'regulation', label: 'Regulation', emoji: '⚖️' },
  { id: 'markets', label: 'Markets', emoji: '📈' },
  { id: 'layer2', label: 'L2', emoji: '⚡' },
  { id: 'onchain', label: 'On-Chain', emoji: '🔗' },
  { id: 'memes', label: 'Memes', emoji: '🐸' },
];

const SORT_OPTIONS = [
  { id: 'score', label: 'Recommended' },
  { id: 'newest', label: 'Newest' },
  { id: 'trending', label: 'Trending' },
];

const TIER_STYLES: Record<number, { label: string; bg: string; text: string; ring: string }> = {
  1: { label: 'Gold', bg: 'bg-yellow-500/15', text: 'text-yellow-300', ring: 'ring-yellow-500/30' },
  2: { label: 'Silver', bg: 'bg-slate-400/15', text: 'text-slate-300', ring: 'ring-slate-400/30' },
  3: { label: 'Bronze', bg: 'bg-amber-700/15', text: 'text-amber-400', ring: 'ring-amber-700/30' },
  4: { label: 'Standard', bg: 'bg-gray-500/15', text: 'text-gray-400', ring: 'ring-gray-500/30' },
};

const READING_LIST_KEY = 'degenfeed:reading-list';

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return formatTime(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sentimentColor(s: SentimentResult | null | undefined): string {
  if (!s) return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  if (s.label === 'bullish') return 'text-green-400 bg-green-500/10 border-green-500/20';
  if (s.label === 'bearish') return 'text-red-400 bg-red-500/10 border-red-500/20';
  return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
}

function sentimentEmoji(s: SentimentResult | null | undefined): string {
  if (!s) return '⚪';
  if (s.label === 'bullish') return '🟢';
  if (s.label === 'bearish') return '🔴';
  return '⚪';
}

function sourceIcon(source: string): string {
  const s = source.toLowerCase();
  if (s.includes('reddit')) return '🔴';
  if (s.includes('hacker') || s.includes('hn')) return '🟠';
  if (s.includes('nostr')) return '⚡';
  if (s.includes('farcaster')) return '🟣';
  if (s.includes('bluesky')) return '🦋';
  return '📡';
}

function getReadingList(): Set<string> {
  try {
    const raw = localStorage.getItem(READING_LIST_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function toggleReadingList(id: string): Set<string> {
  const list = getReadingList();
  if (list.has(id)) list.delete(id);
  else list.add(id);
  localStorage.setItem(READING_LIST_KEY, JSON.stringify(Array.from(list)));
  return list;
}

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

// ─── Trending Now Bar ─────────────────────────────────────────────────────

function TrendingBar({ stories }: { stories: NewsStory[] }) {
  const trendingStories = stories
    .filter((s) => s.isBreaking || s.velocity > 2)
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, 8);

  if (trendingStories.length === 0) return null;

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-red-900/30 bg-gradient-to-r from-red-950/40 via-red-900/20 to-red-950/40">
      <div className="flex items-center gap-3 overflow-x-auto px-4 py-2.5 scrollbar-thin scrollbar-thumb-red-900/30">
        <span className="flex shrink-0 items-center gap-1 text-xs font-bold uppercase tracking-wider text-red-400">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
          Trending Now
        </span>
        <div className="flex gap-3">
          {trendingStories.map((story) => (
            <a
              key={story.id}
              href={story.url}
              target="_blank"
              rel="noopener"
              className="group flex shrink-0 items-center gap-2 rounded-lg bg-red-950/30 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-red-900/30 hover:text-white"
            >
              {story.sourceMeta.tier === 1 && (
                <span className="shrink-0 rounded bg-yellow-500/20 px-1 py-0.5 text-[9px] font-bold text-yellow-400">
                  TIER1
                </span>
              )}
              <span className="line-clamp-1 max-w-[200px]">{story.title}</span>
              <span className="shrink-0 text-[10px] text-red-400/60">
                {story.alsoCoveredBy.length > 1 ? `+${story.alsoCoveredBy.length}` : ''}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Market Price Card ────────────────────────────────────────────────────

function MarketPriceCard({
  symbol,
  price,
  change24h,
  loading,
}: {
  symbol: string;
  price: string;
  change24h: number;
  loading: boolean;
}) {
  const isPositive = change24h >= 0;
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="w-8 text-xs font-bold text-gray-400">{symbol}</span>
        {loading ? (
          <div className="h-4 w-16 animate-pulse rounded bg-gray-700" />
        ) : (
          <span className="text-xs font-medium text-white">${price}</span>
        )}
      </div>
      {loading ? (
        <div className="h-4 w-12 animate-pulse rounded bg-gray-700" />
      ) : (
        <span
          className={`text-xs font-mono font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}
        >
          {isPositive ? '+' : ''}
          {change24h.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

// ─── Hero Card (Enhanced) ─────────────────────────────────────────────────

function HeroCard({
  story,
  onBookmark,
  isBookmarked,
  onShare,
}: {
  story: NewsStory;
  onBookmark?: () => void;
  isBookmarked?: boolean;
  onShare?: () => void;
}) {
  const displayImage = story.heroImage || story.imageUrl;
  const tier = TIER_STYLES[story.sourceMeta.tier] || TIER_STYLES[4];

  return (
    <a
      href={story.url}
      target="_blank"
      rel="noopener"
      className="group relative flex flex-col overflow-hidden rounded-xl border border-degen-500/20 bg-gradient-to-b from-gray-800/90 to-gray-900/90 transition-all duration-300 hover:border-degen-500/40 hover:shadow-[0_0_32px_rgba(34,197,94,0.12)] md:flex-row"
    >
      {displayImage && (
        <div className="relative aspect-video w-full overflow-hidden md:w-2/5 md:aspect-auto">
          <Image
            src={displayImage}
            alt={story.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent md:bg-gradient-to-r" />
        </div>
      )}
      <div className="flex flex-1 flex-col justify-center p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {story.isBreaking && (
            <span className="animate-pulse rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400 ring-1 ring-red-500/30">
              BREAKING
            </span>
          )}
          <span className="rounded-md bg-degen-500/15 px-2 py-0.5 text-[10px] font-bold text-degen-400 ring-1 ring-degen-500/20">
            FEATURED
          </span>
          <span className="text-xs text-gray-400">
            {sourceIcon(story.source)} {story.source}
          </span>
          <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${tier.bg} ${tier.text} ${tier.ring} ring-1`}>
            {tier.label}
          </span>
          {story.readingTime && (
            <span className="text-[10px] text-gray-500">{story.readingTime}m read</span>
          )}
          <span className="ml-auto text-xs text-gray-400">{formatTime(story.publishedAt)}</span>
        </div>
        <h2 className="mb-2 text-xl font-bold leading-tight text-white transition-colors group-hover:text-degen-400 md:text-2xl">
          {story.title}
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-gray-300 line-clamp-2">{story.summary}</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-md border px-2 py-0.5 text-xs ${sentimentColor(story.sentiment)}`}>
            {sentimentEmoji(story.sentiment)} {story.sentiment.label}
          </span>
          {story.alsoCoveredBy.length > 1 && (
            <span className="text-xs text-gray-400">
              Also covered by {story.alsoCoveredBy.filter((s) => s !== story.source).slice(0, 2).join(', ')}
              {story.alsoCoveredBy.length > 3 && ` +${story.alsoCoveredBy.length - 2} more`}
            </span>
          )}
          <div className="flex flex-wrap gap-1">
            {story.niches.slice(0, 3).map((niche) => (
              <span key={niche} className="rounded-full bg-gray-700/50 px-2 py-0.5 text-[10px] text-gray-400">
                #{niche}
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBookmark?.();
              }}
              className={`rounded-lg p-1.5 text-xs transition-colors ${
                isBookmarked
                  ? 'text-degen-400 bg-degen-500/15'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
              title={isBookmarked ? 'Remove from reading list' : 'Add to reading list'}
            >
              {isBookmarked ? '🔖' : '🔖'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onShare?.();
              }}
              className="rounded-lg p-1.5 text-xs text-gray-500 transition-colors hover:text-gray-300 hover:bg-gray-800"
              title="Share"
            >
              ↗
            </button>
          </div>
        </div>
        {story.entities.tokens.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {story.entities.tokens.slice(0, 5).map((token) => (
              <span
                key={token}
                className="rounded-md bg-yellow-500/10 px-2 py-0.5 text-[10px] font-mono text-yellow-400 ring-1 ring-yellow-500/20"
              >
                ${token}
              </span>
            ))}
          </div>
        )}
      </div>
    </a>
  );
}

// ─── Story Card (Enhanced) ────────────────────────────────────────────────

function StoryCard({
  story,
  compact = false,
  masonry = false,
  onBookmark,
  isBookmarked,
  onShare,
}: {
  story: NewsStory;
  compact?: boolean;
  masonry?: boolean;
  onBookmark?: () => void;
  isBookmarked?: boolean;
  onShare?: () => void;
}) {
  const displayImage = story.heroImage || story.imageUrl;
  const tier = TIER_STYLES[story.sourceMeta.tier] || TIER_STYLES[4];

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-gray-800/80 bg-gradient-to-b from-gray-900/90 to-gray-950/90 transition-all duration-300 hover:border-degen-500/20 hover:shadow-[0_0_16px_rgba(34,197,94,0.06)] dark ${
        masonry ? 'break-inside-avoid mb-4' : ''
      }`}
    >
      {displayImage && !compact && (
        <a href={story.url} target="_blank" rel="noopener" className="relative block w-full overflow-hidden" style={{ aspectRatio: masonry ? '16/10' : '16/9' }}>
          <Image
            src={displayImage}
            alt={story.title}
            width={400}
            height={masonry ? 250 : 225}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {masonry && (
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent" />
          )}
        </a>
      )}

      <div className="flex flex-1 flex-col p-4">
        {/* Meta row */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-gray-700/50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
            {sourceIcon(story.source)} {story.authorName || story.author}
          </span>
          {story.isBreaking && (
            <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-400 ring-1 ring-red-500/30">
              BREAKING
            </span>
          )}
          <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${tier.bg} ${tier.text} ${tier.ring} ring-1`}>
            {tier.label}
          </span>
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] ${sentimentColor(story.sentiment)}`}>
            {sentimentEmoji(story.sentiment)}
          </span>
          {story.readingTime && (
            <span className="text-[10px] text-gray-500">{story.readingTime}m</span>
          )}
          <span className="ml-auto text-[10px] text-gray-500">{formatTime(story.publishedAt)}</span>
        </div>

        {/* Title */}
        <a
          href={story.url}
          target="_blank"
          rel="noopener"
          className="mb-2 block text-sm font-semibold leading-snug text-white transition-colors group-hover:text-degen-400 line-clamp-2"
        >
          {story.title}
        </a>

        {/* Summary */}
        <p className="mb-3 text-xs leading-relaxed text-gray-400 line-clamp-2">{story.summary}</p>

        {/* Story metadata + actions */}
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {story.niches.slice(0, 2).map((niche) => (
              <span key={niche} className="rounded-full bg-gray-700/30 px-2 py-0.5 text-[10px] text-gray-400">
                #{niche}
              </span>
            ))}
            {story.alsoCoveredBy.length > 1 && (
              <span className="text-[10px] text-gray-500" title={`Also covered by: ${story.alsoCoveredBy.join(', ')}`}>
                📰 {story.alsoCoveredBy.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBookmark?.();
              }}
              className={`rounded p-1 text-xs transition-colors ${
                isBookmarked
                  ? 'text-degen-400'
                  : 'text-gray-500 opacity-0 group-hover:opacity-100 hover:text-gray-300'
              }`}
              title={isBookmarked ? 'Remove from reading list' : 'Add to reading list'}
            >
              {isBookmarked ? '🔖' : '🔖'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onShare?.();
              }}
              className="rounded p-1 text-xs text-gray-500 opacity-0 transition-all group-hover:opacity-100 hover:text-gray-300"
              title="Share"
            >
              ↗
            </button>
          </div>
        </div>

        {/* Token tags */}
        {story.entities.tokens.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {story.entities.tokens.slice(0, 3).map((token) => (
              <span
                key={token}
                className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[9px] font-mono text-yellow-400"
              >
                ${token}
              </span>
            ))}
          </div>
        )}

        {/* Score bar */}
        {story.scoreComponents && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-gray-700">
              <div
                className="h-1 rounded-full bg-degen-500 transition-all"
                style={{ width: `${Math.min(100, story.scoreComponents.topicalRelevance * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500">
              {Math.round(story.scoreComponents.total * 10) / 10}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────

function StorySkeleton({ masonry = false }: { masonry?: boolean }) {
  return (
    <div className={`animate-pulse rounded-xl border border-gray-800 bg-gray-900/50 ${masonry ? 'break-inside-avoid mb-4' : ''}`}>
      <div className="aspect-video w-full rounded-t-xl bg-gray-800" />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex gap-2">
          <div className="h-3 w-16 rounded bg-gray-800" />
          <div className="h-3 w-12 rounded bg-gray-800" />
          <div className="ml-auto h-3 w-10 rounded bg-gray-800" />
        </div>
        <div className="h-4 w-full rounded bg-gray-800" />
        <div className="h-4 w-3/4 rounded bg-gray-800" />
        <div className="h-3 w-full rounded bg-gray-800" />
        <div className="flex gap-2">
          <div className="h-5 w-12 rounded-full bg-gray-800" />
          <div className="h-5 w-16 rounded-full bg-gray-800" />
        </div>
      </div>
    </div>
  );
}

// ─── Cluster Card ─────────────────────────────────────────────────────────

function ClusterCard({ cluster, onClick }: { cluster: StoryCluster; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-gray-800 bg-gray-900/50 p-3 text-left transition-all hover:border-degen-500/20 hover:bg-gray-900/80"
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-bold text-degen-400">📊 CLUSTER</span>
        <span className="text-xs text-gray-500">{cluster.storyCount} stories</span>
      </div>
      <p className="text-sm font-medium text-white line-clamp-2">{cluster.title}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {cluster.topCategories.slice(0, 3).map((cat) => (
          <span key={cat} className="rounded-full bg-gray-700/30 px-2 py-0.5 text-[9px] text-gray-400">
            {cat}
          </span>
        ))}
      </div>
    </button>
  );
}

// ─── Sentiment Bar ────────────────────────────────────────────────────────

function SentimentBar({ sentiment }: { sentiment: { bullish: number; bearish: number; neutral: number } | undefined }) {
  if (!sentiment || Object.keys(sentiment).length === 0) return null;
  const total = sentiment.bullish + sentiment.bearish + sentiment.neutral;
  if (total === 0) return null;
  const bullish = (sentiment.bullish / total) * 100;
  const bearish = (sentiment.bearish / total) * 100;
  const neutral = (sentiment.neutral / total) * 100;
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
        <span>Market Sentiment</span>
        <span className="text-green-400">🟢 {Math.round(bullish)}%</span>
        <span className="text-gray-400">⚪ {Math.round(neutral)}%</span>
        <span className="text-red-400">🔴 {Math.round(bearish)}%</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-gray-700/50">
        <div className="bg-green-500 transition-all" style={{ width: `${bullish}%` }} />
        <div className="bg-gray-500 transition-all" style={{ width: `${neutral}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${bearish}%` }} />
      </div>
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────

function ShareModal({ story, onClose }: { story: NewsStory; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    await copyToClipboard(story.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-sm font-semibold text-white">Share Article</h3>
        <p className="mb-4 text-xs text-gray-400 line-clamp-1">{story.title}</p>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex w-full items-center gap-3 rounded-lg bg-gray-800 px-4 py-2.5 text-xs text-gray-300 transition-colors hover:bg-gray-700"
          >
            <span className="text-base">🔗</span>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          <a
            href={`https://warpcast.com/~/compose?text=${encodeURIComponent(story.title)}&embeds%5B%5D=${encodeURIComponent(story.url)}`}
            target="_blank"
            rel="noopener"
            className="flex w-full items-center gap-3 rounded-lg bg-gray-800 px-4 py-2.5 text-xs text-gray-300 transition-colors hover:bg-gray-700"
          >
            <span className="text-base">🟣</span>
            Share to Farcaster
          </a>

          <a
            href={`https://iris.to/#/publish?text=${encodeURIComponent(story.title + ' ' + story.url)}`}
            target="_blank"
            rel="noopener"
            className="flex w-full items-center gap-3 rounded-lg bg-gray-800 px-4 py-2.5 text-xs text-gray-300 transition-colors hover:bg-gray-700"
          >
            <span className="text-base">⚡</span>
            Share to Nostr
          </a>

          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(story.title)}&url=${encodeURIComponent(story.url)}`}
            target="_blank"
            rel="noopener"
            className="flex w-full items-center gap-3 rounded-lg bg-gray-800 px-4 py-2.5 text-xs text-gray-300 transition-colors hover:bg-gray-700"
          >
            <span className="text-base">🐦</span>
            Share to Twitter/X
          </a>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-gray-800 py-2 text-xs text-gray-400 transition-colors hover:bg-gray-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────

interface NewsClientProps {
  initialStories?: NewsStory[];
  initialMeta?: NewsMeta | null;
  initialClusters?: StoryCluster[];
}

export default function NewsClient({
  initialStories = [],
  initialMeta = null,
  initialClusters = [],
}: NewsClientProps) {
  const [stories, setStories] = useState<NewsStory[]>(initialStories);
  const [clusters, setClusters] = useState<StoryCluster[]>(initialClusters);
  const [meta, setMeta] = useState<NewsMeta | null>(initialMeta);
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loaded');
  const [error, setError] = useState<string>();
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<string>('score');
  const [searchInput, setSearchInput] = useState('');
  const [newAvailable, setNewAvailable] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedStory, setSelectedStory] = useState<NewsStory | null>(null);
  const [masonryLayout, setMasonryLayout] = useState(false);
  const [readingList, setReadingList] = useState<Set<string>>(getReadingList);
  const [shareStory, setShareStory] = useState<NewsStory | null>(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [marketPrices, setMarketPrices] = useState<Record<string, { price: string; change24h: number }>>({});
  const [pricesLoading, setPricesLoading] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchNews = useCallback(
    async (showIndicator = false, pageNum = 1) => {
      if (pageNum === 1 && !showIndicator) setState('loading');
      try {
        const params = new URLSearchParams();
        params.set('limit', String(50));
        params.set('sort', sort);
        params.set('page', String(pageNum));
        if (category) params.set('category', category);
        if (query) params.set('q', query);

        const res = await fetch(`/api/news/feed?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { 'cache-control': 'no-store' },
        });
        const data = (await res.json()) as {
          data?: NewsStory[];
          clusters?: StoryCluster[];
          meta?: NewsMeta;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'Failed to load news');

        if (showIndicator && data.data && data.data.length > 0) {
          setNewAvailable(true);
          return;
        }

        if (pageNum === 1) {
          setStories(data.data || []);
          setClusters(data.clusters || []);
        } else {
          setStories((prev) => {
            const existingIds = new Set(prev.map((s) => s.id));
            const newStories = (data.data || []).filter((s) => !existingIds.has(s.id));
            return [...prev, ...newStories];
          });
        }
        setMeta(data.meta || null);
        setHasMore((data.data?.length ?? 0) >= 50);
        setState('loaded');
        setLoadingMore(false);
      } catch (err) {
        if (!showIndicator) {
          setError(err instanceof Error ? err.message : 'Failed to load news');
          setState('error');
        }
        setLoadingMore(false);
      }
    },
    [category, query, sort],
  );

  // Fetch market prices
  const fetchMarketPrices = useCallback(async () => {
    setPricesLoading(true);
    try {
      const res = await fetch('/api/market/prices?tokens=BTC,ETH,SOL', {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, { price: string; change24h: number }>;
        setMarketPrices(data);
      }
    } catch {
      // Market data unavailable
    } finally {
      setPricesLoading(false);
    }
  }, []);

  const refreshNow = useCallback(() => {
    setNewAvailable(false);
    setPage(1);
    fetchNews(false, 1);
  }, [fetchNews]);

  useEffect(() => {
    setPage(1);
    fetchNews(false, 1);
    fetchMarketPrices();
  }, [category, sort, query, fetchNews, fetchMarketPrices]);

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchNews(true), 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNews]);

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && state === 'loaded') {
          setLoadingMore(true);
          setPage((p) => {
            const nextPage = p + 1;
            fetchNews(false, nextPage);
            return nextPage;
          });
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, state, fetchNews]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput);
    setPage(1);
  };

  const handleBookmark = useCallback(
    (storyId: string) => {
      const updated = toggleReadingList(storyId);
      setReadingList(new Set(updated));
    },
    [],
  );

  const handleShare = useCallback((story: NewsStory) => {
    setShareStory(story);
  }, []);

  const sentiment = meta?.sentiment ?? undefined;

  // Featured story (hero at top)
  const featuredStory = stories.find((s) => s.isBreaking) || stories[0];
  const remainingStories = stories.filter((s) => s.id !== featuredStory?.id) || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white">DegenFeed News</h1>
              <span className="rounded-full bg-degen-500/10 px-2.5 py-0.5 text-xs font-medium text-degen-400 ring-1 ring-degen-500/20">
                LIVE
              </span>
              {meta?.personalized && (
                <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-blue-500/20">
                  Personalized
                </span>
              )}
              <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-400 ring-1 ring-purple-500/20">
                {meta?.sourceCount || 100}+ Sources
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              Intelligent news from {meta?.sourceCount || '100+'} sources — RSS, Nostr,
              Farcaster, Bluesky, Reddit, newsletters, and research feeds
              {meta?.personalized ? ' — ranked for your interests' : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-right">
            {meta && (
              <p className="text-xs text-gray-400">
                <span className="text-degen-400">{stories.length}</span> stories · updated{' '}
                {formatTime(meta.fetchedAt)}
              </p>
            )}
          </div>
        </div>

        <SentimentBar sentiment={sentiment} />

        {/* Trending Now Bar */}
        <TrendingBar stories={stories} />

        {/* New stories banner */}
        {newAvailable && (
          <button
            type="button"
            onClick={refreshNow}
            className="mb-4 w-full animate-pulse rounded-xl border border-degen-500/20 bg-degen-500/10 py-2.5 text-center text-sm font-medium text-degen-400 transition-colors hover:bg-degen-500/20"
          >
            New stories available — click to refresh
          </button>
        )}

        {/* Search + Sort + Layout Toggle */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search news, tokens, topics..."
                className="w-full rounded-xl border border-gray-700 bg-gray-900/80 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-degen-500/50 focus:ring-1 focus:ring-degen-500/30"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-degen-500 px-3 py-1 text-xs font-medium text-black hover:bg-degen-400"
              >
                Search
              </button>
            </div>
          </form>

          {/* Sort options */}
          <div className="flex gap-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSort(opt.id)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  sort === opt.id
                    ? 'bg-degen-500/20 text-degen-400 ring-1 ring-degen-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Masonry toggle */}
          <button
            type="button"
            onClick={() => setMasonryLayout(!masonryLayout)}
            className={`rounded-lg border px-3 py-2 text-xs transition-all ${
              masonryLayout
                ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                : 'border-gray-700 text-gray-400 hover:border-gray-600'
            }`}
            title={masonryLayout ? 'Switch to grid layout' : 'Switch to masonry layout'}
          >
            {masonryLayout ? '⊞ Grid' : '⊟ Masonry'}
          </button>

          <button
            type="button"
            onClick={() => setShowSidebar(!showSidebar)}
            className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-400 transition-colors hover:border-gray-600"
          >
            {showSidebar ? 'Hide Sidebar' : 'Show Sidebar'}
          </button>
        </div>

        {/* Category Tabs (scrollable) */}
        <div className="mb-3 flex gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-800">
          {CATEGORY_TABS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                category === c.id
                  ? 'border-degen-500 bg-degen-500/20 text-degen-400 shadow-[0_0_12px_rgba(34,197,94,0.2)]'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className={`grid gap-6 ${showSidebar ? 'lg:grid-cols-4' : 'lg:grid-cols-1'}`}>
        {/* Left sidebar */}
        {showSidebar && (
          <aside className="space-y-4">
            {/* Market Prices */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Market Prices
              </h3>
              <div className="space-y-2">
                <MarketPriceCard
                  symbol="BTC"
                  price={marketPrices.BTC?.price || '—'}
                  change24h={marketPrices.BTC?.change24h ?? 0}
                  loading={pricesLoading}
                />
                <MarketPriceCard
                  symbol="ETH"
                  price={marketPrices.ETH?.price || '—'}
                  change24h={marketPrices.ETH?.change24h ?? 0}
                  loading={pricesLoading}
                />
                <MarketPriceCard
                  symbol="SOL"
                  price={marketPrices.SOL?.price || '—'}
                  change24h={marketPrices.SOL?.change24h ?? 0}
                  loading={pricesLoading}
                />
              </div>
            </div>

            {/* Top Categories */}
            {meta?.topCategories && meta.topCategories.length > 0 && (
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Top Categories
                </h3>
                <div className="space-y-2">
                  {meta.topCategories.slice(0, 8).map((cat) => (
                    <button
                      key={cat.categoryId}
                      type="button"
                      onClick={() => setCategory(cat.categoryId)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-all ${
                        category === cat.categoryId
                          ? 'bg-degen-500/10 text-degen-400'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <span>
                        {cat.emoji} {cat.label}
                      </span>
                      <span className="rounded-full bg-gray-700/50 px-2 py-0.5 text-[10px]">
                        {cat.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Daily Digest */}
            <div className="rounded-xl border border-degen-500/10 bg-gradient-to-br from-degen-500/5 to-gray-900/80 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-degen-400">
                Daily Digest
              </h3>
              <p className="mb-3 text-xs text-gray-400">
                The top stories delivered to your inbox every morning — with AI voice summaries,
                market data, and trending topics.
              </p>
              <a
                href="/newsletter"
                className="block rounded-lg bg-degen-500 px-3 py-2 text-center text-xs font-medium text-black hover:bg-degen-400"
              >
                Subscribe →
              </a>
            </div>

            {/* Trending Topics */}
            {meta?.trending && meta.trending.length > 0 && (
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  🔥 Trending
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {meta.trending.map((t) => (
                    <button
                      key={t.topic}
                      type="button"
                      onClick={() => {
                        setQuery(t.topic);
                        setSearchInput(t.topic);
                      }}
                      className="rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                    >
                      #{t.topic}
                      <span className="ml-1 text-[10px] text-gray-500">{t.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Story Clusters */}
            {clusters.length > 0 && (
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  📊 Story Clusters
                </h3>
                <div className="space-y-2">
                  {clusters.slice(0, 5).map((cluster) => (
                    <ClusterCard
                      key={cluster.id}
                      cluster={cluster}
                      onClick={() => {
                        feedRef.current?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Reading list */}
            {readingList.size > 0 && (
              <div className="rounded-xl border border-degen-500/10 bg-gradient-to-br from-degen-500/5 to-gray-900/80 p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-degen-400">
                  📚 Reading List
                </h3>
                <p className="text-xs text-gray-400">
                  {readingList.size} article{readingList.size !== 1 ? 's' : ''} saved
                </p>
              </div>
            )}

            {/* How it works */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                How it works
              </h3>
              <ul className="space-y-1.5 text-xs text-gray-400">
                <li>• Aggregated from 100+ RSS, Nostr, Farcaster, Bluesky, Reddit sources</li>
                <li>• Deduplicated by URL + content similarity (Jaccard index)</li>
                <li>• Categorized by keyword + source + TF-IDF + cross-reference</li>
                <li>• Entity extraction: tokens, protocols, people, companies</li>
                <li>• Sentiment-analyzed: bullish / bearish / neutral per story</li>
                <li>• Breaking news boosted 3× for first hour</li>
                <li>• Story clusters group related coverage</li>
                <li>• Credibility-scored by source tier + coverage breadth</li>
                <li>• Personalized if wallet connected</li>
              </ul>
            </div>
          </aside>
        )}

        {/* Center: news feed */}
        <div className={`${showSidebar ? 'lg:col-span-2' : 'lg:col-span-1'}`}>
          {state === 'error' && (
            <div className="rounded-xl border border-red-900/50 bg-red-900/10 py-12 text-center">
              <div className="mb-2 text-4xl text-red-400">!</div>
              <p className="mb-4 text-red-300">{error}</p>
              <button
                type="button"
                onClick={refreshNow}
                className="rounded-lg bg-degen-500 px-4 py-2 text-sm text-black hover:bg-degen-400"
              >
                Retry
              </button>
            </div>
          )}

          {state === 'loading' && stories.length === 0 && (
            <div className={masonryLayout ? 'columns-1 gap-4 sm:columns-2' : 'grid gap-4 sm:grid-cols-2'}>
              {Array.from({ length: 6 }).map((_, i) => (
                <StorySkeleton key={i} masonry={masonryLayout} />
              ))}
            </div>
          )}

          {state === 'loaded' && stories.length === 0 && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 py-12 text-center">
              <p className="text-gray-400">No news found for these filters.</p>
              <button
                type="button"
                onClick={() => {
                  setCategory('');
                  setQuery('');
                  setSort('score');
                }}
                className="mt-3 text-sm text-degen-400 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}

          {state === 'loaded' && stories.length > 0 && (
            <div ref={feedRef}>
              {/* Hero featured story */}
              {featuredStory && page === 1 && (
                <div className="mb-6">
                  <HeroCard
                    story={featuredStory}
                    isBookmarked={readingList.has(featuredStory.id)}
                    onBookmark={() => handleBookmark(featuredStory.id)}
                    onShare={() => handleShare(featuredStory)}
                  />
                </div>
              )}

              {/* Story grid/masonry */}
              {masonryLayout ? (
                <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
                  {(page === 1 ? remainingStories : stories).map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      masonry
                      isBookmarked={readingList.has(story.id)}
                      onBookmark={() => handleBookmark(story.id)}
                      onShare={() => handleShare(story)}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {(page === 1 ? remainingStories : stories).map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      isBookmarked={readingList.has(story.id)}
                      onBookmark={() => handleBookmark(story.id)}
                      onShare={() => handleShare(story)}
                    />
                  ))}
                </div>
              )}

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="h-4" />

              {/* Loading more indicator */}
              {loadingMore && (
                <div className={masonryLayout ? 'columns-1 gap-4 sm:columns-2' : 'grid gap-4 sm:grid-cols-2'}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <StorySkeleton key={`more-${i}`} masonry={masonryLayout} />
                  ))}
                </div>
              )}

              {!hasMore && stories.length > 0 && (
                <div className="py-8 text-center">
                  <p className="text-xs text-gray-500">All stories loaded</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        {showSidebar && (
          <aside className="space-y-4">
            {/* Sentiment Breakdown */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Sentiment Breakdown
              </h3>
              {meta?.sentiment ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-green-400">🟢 Bullish</span>
                    <span className="font-mono text-green-400">{meta.sentiment.bullish}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">⚪ Neutral</span>
                    <span className="font-mono text-gray-400">{meta.sentiment.neutral}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-red-400">🔴 Bearish</span>
                    <span className="font-mono text-red-400">{meta.sentiment.bearish}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-700/50">
                    <div className="flex h-full">
                      <div
                        className="bg-green-500"
                        style={{
                          width: `${(meta.sentiment.bullish / Math.max(1, meta.sentiment.bullish + meta.sentiment.bearish + meta.sentiment.neutral)) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-gray-500"
                        style={{
                          width: `${(meta.sentiment.neutral / Math.max(1, meta.sentiment.bullish + meta.sentiment.bearish + meta.sentiment.neutral)) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-red-500"
                        style={{
                          width: `${(meta.sentiment.bearish / Math.max(1, meta.sentiment.bullish + meta.sentiment.bearish + meta.sentiment.neutral)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">Loading...</p>
              )}
            </div>

            {/* Most Covered Stories */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                📰 Most Covered
              </h3>
              <div className="space-y-2">
                {stories
                  .filter((s) => s.alsoCoveredBy.length > 1)
                  .sort((a, b) => b.alsoCoveredBy.length - a.alsoCoveredBy.length)
                  .slice(0, 5)
                  .map((story) => (
                    <a
                      key={story.id}
                      href={story.url}
                      target="_blank"
                      rel="noopener"
                      className="group block rounded-lg p-2 text-xs transition-colors hover:bg-gray-800"
                    >
                      <p className="font-medium text-white group-hover:text-degen-400 line-clamp-2">
                        {story.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-500">
                        <span>{story.alsoCoveredBy.length} sources</span>
                        <span>{formatTime(story.publishedAt)}</span>
                      </div>
                    </a>
                  ))}
              </div>
            </div>

            {/* Token Mentions */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Token Mentions
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(
                  new Map(
                    stories
                      .flatMap((s) => s.entities.tokens)
                      .map((t) => [t, stories.filter((s) => s.entities.tokens.includes(t)).length]),
                  ).entries(),
                )
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([token, count]) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => {
                        setQuery(token);
                        setSearchInput(token);
                      }}
                      className="rounded-lg bg-yellow-500/10 px-2 py-1 text-xs font-mono text-yellow-400 ring-1 ring-yellow-500/20 transition-colors hover:bg-yellow-500/20"
                    >
                      ${token}
                      <span className="ml-1 text-[10px] text-gray-500">{count}</span>
                    </button>
                  ))}
              </div>
            </div>

            {/* Newsletter CTA */}
            <div className="rounded-xl border border-degen-500/10 bg-gradient-to-br from-degen-500/5 to-gray-900/80 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-degen-400">
                Daily Digest
              </h3>
              <p className="mb-3 text-xs text-gray-400">
                Get the top stories delivered to your inbox every morning with AI voice summaries.
              </p>
              <a
                href="/newsletter"
                className="block rounded-lg bg-degen-500 px-3 py-2 text-center text-xs font-medium text-black hover:bg-degen-400"
              >
                Subscribe →
              </a>
            </div>
          </aside>
        )}
      </div>

      {/* Share Modal */}
      {shareStory && <ShareModal story={shareStory} onClose={() => setShareStory(null)} />}
    </div>
  );
}
