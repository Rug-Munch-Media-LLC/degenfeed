'use client';

export interface NewsSourceMeta {
  id: string;
  name: string;
  tier: number;
  credibility: number;
}

export interface SentimentResult {
  label: 'bullish' | 'bearish' | 'neutral';
  score: number;
  confidence: number;
  signals: string[];
}

export interface StoryEntities {
  tokens: string[];
  protocols: string[];
  people: string[];
  companies: string[];
  chains: string[];
  nfts: string[];
}

export interface StoryCluster {
  id: string;
  title: string;
  storyCount: number;
  topCategories: string[];
  aggregateSentiment: SentimentResult;
}

export interface NewsStory {
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
  metaDescription?: string;
  alsoCoveredByDisplay?: string;
  alsoCoveredByCount?: number;
  contentHash?: string;
  dedupSimilarity?: number;
  scoreComponents?: {
    topicalRelevance: number;
    sourceCredibility: number;
    freshness: number;
    engagementVelocity: number;
    depthMatch: number;
    total: number;
  };
  // Ground News-style rating fields
  bias?: 'left' | 'center-left' | 'center' | 'center-right' | 'right';
  sentimentScore?: number; // -100 to +100
  sentimentLabel?: 'bullish' | 'slightly_bullish' | 'neutral' | 'slightly_bearish' | 'bearish';
  factualRating?: 'high' | 'medium' | 'low' | 'unrated';
  sourceTier?: number; // 1-3
  ratingConfidence?: number; // 0-1
}

export interface NewsMeta {
  total: number;
  sourceCount: number;
  sourcedCount?: number;
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

export const TIER_STYLES: Record<
  number,
  { label: string; bg: string; text: string; ring: string }
> = {
  1: { label: 'Gold', bg: 'bg-yellow-500/15', text: 'text-yellow-300', ring: 'ring-yellow-500/30' },
  2: { label: 'Silver', bg: 'bg-slate-400/15', text: 'text-slate-300', ring: 'ring-slate-400/30' },
  3: { label: 'Bronze', bg: 'bg-amber-700/15', text: 'text-amber-400', ring: 'ring-amber-700/30' },
  4: { label: 'Standard', bg: 'bg-gray-500/15', text: 'text-gray-400', ring: 'ring-gray-500/30' },
};

export const READING_LIST_KEY = 'degenfeed:reading-list';

export function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  if (Date.now() - d.getTime() < 86400000) return formatTime(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function sentimentColor(s: SentimentResult | null | undefined): string {
  if (!s) return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  if (s.label === 'bullish') return 'text-green-400 bg-green-500/10 border-green-500/20';
  if (s.label === 'bearish') return 'text-red-400 bg-red-500/10 border-red-500/20';
  return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
}

export function sentimentEmoji(s: SentimentResult | null | undefined): string {
  if (!s) return '⚪';
  if (s.label === 'bullish') return '🟢';
  if (s.label === 'bearish') return '🔴';
  return '⚪';
}

// ── Ground News-style rating helpers ──────────────────────────────

export const BIAS_STYLES: Record<
  string,
  { label: string; color: string; bg: string; ring: string }
> = {
  left: { label: 'Left', color: '#dc2626', bg: 'bg-red-500/15', ring: 'ring-red-500/30' },
  'center-left': {
    label: 'Lean Left',
    color: '#f97316',
    bg: 'bg-orange-500/15',
    ring: 'ring-orange-500/30',
  },
  center: { label: 'Center', color: '#6b7280', bg: 'bg-gray-500/15', ring: 'ring-gray-500/30' },
  'center-right': {
    label: 'Lean Right',
    color: '#3b82f6',
    bg: 'bg-blue-500/15',
    ring: 'ring-blue-500/30',
  },
  right: { label: 'Right', color: '#2563eb', bg: 'bg-blue-600/15', ring: 'ring-blue-600/30' },
};

export const FACTUAL_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'High', color: '#22c55e', bg: 'bg-green-500/15' },
  medium: { label: 'Medium', color: '#eab308', bg: 'bg-yellow-500/15' },
  low: { label: 'Low', color: '#ef4444', bg: 'bg-red-500/15' },
  unrated: { label: 'Unrated', color: '#6b7280', bg: 'bg-gray-500/10' },
};

export function sentimentScoreEmoji(score: number | null | undefined): string {
  if (score == null || score === 0) return '➖';
  if (score >= 30) return '🔥';
  if (score >= 10) return '📈';
  if (score <= -30) return '🧊';
  if (score <= -10) return '📉';
  return '➖';
}

export function sentimentScoreColor(score: number | null | undefined): string {
  if (score == null || score === 0) return 'text-gray-400';
  if (score >= 20) return 'text-green-400';
  if (score <= -20) return 'text-red-400';
  return 'text-yellow-400';
}

export function biasColor(bias: string | null | undefined): string {
  const style = BIAS_STYLES[bias || ''];
  return style?.color || '#6b7280';
}

export function factualColor(rating: string | null | undefined): string {
  const style = FACTUAL_STYLES[rating || ''];
  return style?.color || '#6b7280';
}

export function sourceIcon(source: string): string {
  const s = source.toLowerCase();
  if (s.includes('reddit')) return '🔴';
  if (s.includes('hacker') || s.includes('hn')) return '🟠';
  if (s.includes('nostr')) return '⚡';
  if (s.includes('farcaster')) return '🟣';
  if (s.includes('bluesky')) return '🦋';
  return '📡';
}

export function getReadingList(): Set<string> {
  try {
    const raw = localStorage.getItem(READING_LIST_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function toggleReadingList(id: string): Set<string> {
  const list = getReadingList();
  if (list.has(id)) list.delete(id);
  else list.add(id);
  localStorage.setItem(READING_LIST_KEY, JSON.stringify(Array.from(list)));
  return list;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
