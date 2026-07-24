'use client';

import { ErrorBoundary, getProtocolColor, getProtocolIcon } from '@degenfeed/ui';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CATEGORIES, CategoryCard } from '../../components/CategoryCard';

// === Types =================================================================

interface TrendingPost {
  id: string;
  protocol: string;
  text: string;
  createdAt: number;
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    handles: Record<string, string>;
  };
  metrics: { likes: number; reposts: number; replies: number; quotes: number };
  niches: string[];
  image?: string | null;
}

interface DiscoverCommunity {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  icon?: string;
  memberCount: number;
  postCount: number;
  protocols: string[];
  tags?: string[];
  activityLevel: 'high' | 'medium' | 'low';
}

interface DiscoverPerson {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  protocol: string;
  protocols: string[];
  postCount: number;
  totalEngagement: number;
  topNiches: string[];
}

interface TrendingTopic {
  topic: string;
  count: number;
  score: number;
}

interface FeaturedSpace {
  id: string;
  title: string;
  description?: string;
  hostName: string;
  hostAvatarUrl?: string;
  status: 'live' | 'scheduled' | 'ended';
  listeners: number;
  speakers: Array<{ id: string; displayName: string; avatarUrl?: string }>;
  scheduledAt?: string;
}

// === Topic metadata ========================================================

const TOPIC_META: Record<string, { emoji: string; color: string; label: string }> = {
  bitcoin: { emoji: '\u20BF', color: '#f7931a', label: 'Bitcoin' },
  ethereum: { emoji: '\u039E', color: '#627eea', label: 'Ethereum' },
  solana: { emoji: '\u25C9', color: '#14f195', label: 'Solana' },
  defi: { emoji: '\uD83D\uDCCA', color: '#6366f1', label: 'DeFi' },
  nft: { emoji: '\uD83D\uDDBC', color: '#ec4899', label: 'NFT' },
  ai: { emoji: '\uD83E\uDD16', color: '#06b6d4', label: 'AI' },
  regulation: { emoji: '\u2696\uFE0F', color: '#ef4444', label: 'Regulation' },
  security: { emoji: '\uD83D\uDD12', color: '#dc2626', label: 'Security' },
  memes: { emoji: '\uD83D\uDE02', color: '#f59e0b', label: 'Memes' },
  privacy: { emoji: '\uD83D\uDC41\uFE0F', color: '#a855f7', label: 'Privacy' },
  gaming: { emoji: '\uD83C\uDFAE', color: '#22d3ee', label: 'Gaming' },
  layer2: { emoji: '\u26D3\uFE0F', color: '#8b5cf6', label: 'Layer 2' },
  crypto: { emoji: '\u20BF', color: '#f59e0b', label: 'Crypto' },
  macro: { emoji: '\uD83D\uDCC8', color: '#10b981', label: 'Macro' },
  stablecoin: { emoji: '\uD83D\uDCB5', color: '#22c55e', label: 'Stablecoin' },
};

function getTopicMeta(topic: string): { emoji: string; color: string; label: string } {
  const key = topic.toLowerCase().replace(/[^a-z0-9]/g, '');
  return TOPIC_META[key] ?? { emoji: '#', color: '#888', label: topic };
}

function topicSlug(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// === Helpers ===============================================================

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

// === Section Skeleton ======================================================

function SectionSkeleton({
  count = 3,
  layout = 'col',
}: {
  count?: number;
  layout?: 'col' | 'row';
}) {
  return (
    <div
      className={`grid gap-3 ${layout === 'row' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse h-24" />
      ))}
    </div>
  );
}

function TopicPillsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-[var(--color-overlay)]" />
      ))}
    </div>
  );
}

// === Section Header =======================================================

function SectionHeader({
  emoji,
  title,
  subtitle,
  href,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  href?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <div>
          <h2 className="text-base font-bold text-[var(--color-fg)]">{title}</h2>
          {subtitle && <p className="text-xs text-[var(--color-muted)]">{subtitle}</p>}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="text-xs font-medium text-degen-400 transition-colors hover:text-degen-300"
        >
          View all
        </Link>
      )}
    </div>
  );
}

// === Trending Post Card ====================================================

function TrendingPostCard({
  post,
  onPostClick,
}: {
  post: TrendingPost;
  onPostClick: (id: string) => void;
}) {
  const protocolColor = getProtocolColor(post.protocol);
  return (
    <button
      type="button"
      onClick={() => onPostClick(post.id)}
      className="card-hover flex w-full flex-col gap-2 p-3 text-left transition-colors"
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold"
          style={{ backgroundColor: `${protocolColor}22`, color: protocolColor }}
        >
          {post.author.avatarUrl ? (
            <Image
              src={post.author.avatarUrl}
              alt={post.author.displayName}
              width={28}
              height={28}
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            post.author.displayName[0]?.toUpperCase() || getProtocolIcon(post.protocol)
          )}
        </div>
        <span className="truncate text-xs font-semibold text-[var(--color-fg)]">
          {post.author.displayName}
        </span>
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
          style={{ backgroundColor: `${protocolColor}18`, color: protocolColor }}
        >
          {post.protocol}
        </span>
        <span className="ml-auto text-[10px] text-[var(--color-muted)]">
          {formatTime(post.createdAt)}
        </span>
      </div>
      <p className="line-clamp-2 text-xs text-[var(--color-muted)]">{stripHtml(post.text)}</p>
      {post.image && (
        <Image
          src={post.image}
          alt={`Post image from ${post.author.displayName || 'DegenFeed'}`}
          width={240}
          height={135}
          className="w-full rounded-lg object-cover"
          style={{ maxHeight: 120 }}
        />
      )}
      <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
        <span>&#9829; {post.metrics.likes}</span>
        <span>&#8631; {post.metrics.reposts}</span>
        <span>&#9998; {post.metrics.replies}</span>
      </div>
    </button>
  );
}

// === Community Card ========================================================

function CommunityCard({ community }: { community: DiscoverCommunity }) {
  const activityColor =
    community.activityLevel === 'high'
      ? '#22c55e'
      : community.activityLevel === 'medium'
        ? '#eab308'
        : '#6b7280';

  return (
    <Link
      href={`/c/${community.name}`}
      className="card-hover flex items-start gap-3 p-4 transition-colors"
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-bold"
        style={{
          backgroundColor: community.icon
            ? 'transparent'
            : `${getProtocolColor(community.protocols[0] ?? 'nostr')}22`,
        }}
      >
        {community.icon ? (
          <Image
            src={community.icon}
            alt={community.displayName || community.name}
            width={44}
            height={44}
            className="h-11 w-11 rounded-xl object-cover"
          />
        ) : (
          (community.displayName || community.name)[0]?.toUpperCase() || '#'
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
            {community.displayName || community.name}
          </span>
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: activityColor }}
            title={`${community.activityLevel} activity`}
          />
        </div>
        {community.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-muted)]">
            {community.description}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[10px] text-[var(--color-muted)]">
            {formatCount(community.memberCount)} members
          </span>
          <div className="flex gap-1">
            {community.protocols.slice(0, 3).map((p) => (
              <span
                key={p}
                className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                style={{ backgroundColor: `${getProtocolColor(p)}18`, color: getProtocolColor(p) }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

// === Person Card ==========================================================

function PersonCard({ person }: { person: DiscoverPerson }) {
  return (
    <div className="card-hover flex items-start gap-3 p-4 transition-colors">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
        style={{ backgroundColor: `${getProtocolColor(person.protocol)}22` }}
      >
        {person.avatarUrl ? (
          <Image
            src={person.avatarUrl}
            alt={person.displayName}
            width={44}
            height={44}
            className="h-11 w-11 rounded-full object-cover"
          />
        ) : (
          person.displayName[0]?.toUpperCase() || '?'
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
            {person.displayName}
          </span>
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
            style={{
              backgroundColor: `${getProtocolColor(person.protocol)}18`,
              color: getProtocolColor(person.protocol),
            }}
          >
            {person.protocol}
          </span>
        </div>
        <div className="truncate text-[10px] text-[var(--color-muted)]">@{person.handle}</div>
        {person.topNiches.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {person.topNiches.slice(0, 3).map((niche) => (
              <span
                key={niche}
                className="rounded-full bg-[var(--color-overlay)] px-1.5 py-0.5 text-[9px] text-[var(--color-muted)]"
              >
                {niche}
              </span>
            ))}
          </div>
        )}
        <div className="mt-1 text-[10px] text-[var(--color-muted)]">
          {formatCount(person.postCount)} posts
        </div>
      </div>
    </div>
  );
}

// === Topic Pill ============================================================

function TopicPill({ topic, count }: { topic: TrendingTopic; count: number }) {
  const meta = getTopicMeta(topic.topic);
  return (
    <Link
      href={`/t/${topicSlug(topic.topic)}`}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all hover:scale-105"
      style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
    >
      <span>{meta.emoji}</span>
      <span>{topic.topic}</span>
      <span className="opacity-60">({formatCount(count)})</span>
    </Link>
  );
}

// === Space Card ============================================================

function SpaceCard({ space }: { space: FeaturedSpace }) {
  const isLive = space.status === 'live';
  return (
    <Link href="/spaces" className="card-hover flex items-start gap-3 p-4 transition-colors">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-sm">
        {isLive ? '\uD83D\uDCE2' : '\uD83D\uDD54'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
            {space.title}
          </span>
          {isLive ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              LIVE
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400">
              Upcoming
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <span>by {space.hostName}</span>
          <span>&#8226;</span>
          <span>{formatCount(space.listeners)} listeners</span>
        </div>
      </div>
    </Link>
  );
}

// === New Item Card =========================================================

function NewItemCard({
  name,
  type,
  icon,
  subtitle,
  href,
}: {
  name: string;
  type: string;
  icon?: string;
  subtitle?: string;
  href: string;
}) {
  return (
    <Link href={href} className="card-hover flex items-center gap-3 p-3 transition-colors">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-bold"
        style={{ backgroundColor: `${type === 'community' ? '#6366f1' : '#22c55e'}22` }}
      >
        {icon ? (
          <Image
            src={icon}
            alt={name}
            width={36}
            height={36}
            className="h-9 w-9 rounded-lg object-cover"
          />
        ) : type === 'community' ? (
          '\uD83C\uDFD8\uFE0F'
        ) : (
          '\uD83D\uDC64'
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="truncate text-xs font-semibold text-[var(--color-fg)]">{name}</span>
        {subtitle && (
          <div className="truncate text-[10px] text-[var(--color-muted)]">{subtitle}</div>
        )}
      </div>
      <span
        className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
        style={{
          backgroundColor: type === 'community' ? '#6366f118' : '#22c55e18',
          color: type === 'community' ? '#6366f1' : '#22c55e',
        }}
      >
        {type}
      </span>
    </Link>
  );
}

// === Main Page =============================================================

export default function DiscoverPage() {
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [communities, setCommunities] = useState<DiscoverCommunity[]>([]);
  const [people, setPeople] = useState<DiscoverPerson[]>([]);
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [spaces, setSpaces] = useState<FeaturedSpace[]>([]);
  const [newCommunities, setNewCommunities] = useState<DiscoverCommunity[]>([]);
  const [newPeople, setNewPeople] = useState<DiscoverPerson[]>([]);

  const [trendingPeriod, setTrendingPeriod] = useState<string>('hour');

  // Per-section state management
  const [trendingState, setTrendingState] = useState<'loading' | 'loaded' | 'empty' | 'error'>(
    'loading',
  );
  const [communitiesState, setCommunitiesState] = useState<
    'loading' | 'loaded' | 'empty' | 'error'
  >('loading');
  const [peopleState, setPeopleState] = useState<'loading' | 'loaded' | 'empty' | 'error'>(
    'loading',
  );
  const [topicsState, setTopicsState] = useState<'loading' | 'loaded' | 'empty' | 'error'>(
    'loading',
  );
  const [spacesState, setSpacesState] = useState<'loading' | 'loaded' | 'empty' | 'error'>(
    'loading',
  );
  const [newState, setNewState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');

  const fetchSection = useCallback(
    async <T,>(
      url: string,
      extractor: (data: T) => { items: unknown[]; total?: number },
      setState: (s: 'loading' | 'loaded' | 'empty' | 'error') => void,
      setData: (items: unknown[]) => void,
    ) => {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          setState('error');
          return;
        }
        const raw = (await res.json()) as T;
        const { items } = extractor(raw);
        if (items.length === 0) {
          setState('empty');
          setData([]);
          return;
        }
        setData(items);
        setState('loaded');
      } catch {
        setState('error');
      }
    },
    [],
  );

  const [popularThisHour, setPopularThisHour] = useState<TrendingPost[]>([]);
  const [popularThisHourState, setPopularThisHourState] = useState<
    'loading' | 'loaded' | 'empty' | 'error'
  >('loading');
  const [recommendedPosts, setRecommendedPosts] = useState<TrendingPost[]>([]);
  const [recommendedState, setRecommendedState] = useState<
    'loading' | 'loaded' | 'empty' | 'error'
  >('loading');

  // == Creator Discovery state ==
  const [trendingCreators, setTrendingCreators] = useState<DiscoverPerson[]>([]);
  const [trendingCreatorsState, setTrendingCreatorsState] = useState<
    'loading' | 'loaded' | 'empty' | 'error'
  >('loading');
  const [_recommendedCreators, _setRecommendedCreators] = useState<DiscoverPerson[]>([]);
  const [_recommendedCreatorsState, _setRecommendedCreatorsState] = useState<
    'loading' | 'loaded' | 'empty' | 'error'
  >('loading');
  const [crossNetworkTrending, setCrossNetworkTrending] = useState<TrendingItem[]>([]);
  const [crossTrendingState, setCrossTrendingState] = useState<
    'loading' | 'loaded' | 'empty' | 'error'
  >('loading');
  const [creatorSearchQuery, setCreatorSearchQuery] = useState('');
  const [creatorSearchResults, setCreatorSearchResults] = useState<DiscoverPerson[]>([]);
  const [creatorSearchState, setCreatorSearchState] = useState<
    'idle' | 'loading' | 'loaded' | 'empty' | 'error'
  >('idle');

  interface TrendingItem {
    id: string;
    title: string;
    description: string;
    url: string;
    source: string;
    sourceLabel: string;
    sourceColor: string;
    score: number;
    velocity: number;
    engagement: number;
    thumbnailUrl?: string;
    publishedAt: number;
    metadata: Record<string, unknown>;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const fetches: Promise<void>[] = [
        fetchSection(
          `/api/discover/trending?period=${trendingPeriod}`,
          (d: { data: TrendingPost[]; meta: { total: number } }) => ({
            items: d.data,
            total: d.meta.total,
          }),
          setTrendingState,
          (items) => {
            if (!cancelled) setTrendingPosts(items as TrendingPost[]);
          },
        ),
        // "Popular this hour" — high-engagement posts from the last 60 minutes
        fetchSection(
          '/api/feed/home?limit=10&sort=hot&trending=1',
          (d: { data: TrendingPost[]; meta: { total: number } }) => ({
            items: d.data,
            total: d.meta.total,
          }),
          setPopularThisHourState,
          (items) => {
            if (!cancelled) setPopularThisHour(items as TrendingPost[]);
          },
        ),
        // "Because you liked..." — personalized recommendations
        fetchSection(
          '/api/feed/for-you?limit=10&sort=scored&diverse=true',
          (d: { data: TrendingPost[]; meta: { total: number } }) => ({
            items: d.data,
            total: d.meta.total,
          }),
          setRecommendedState,
          (items) => {
            if (!cancelled) setRecommendedPosts(items as TrendingPost[]);
          },
        ),
        fetchSection(
          '/api/discover/communities',
          (d: { data: DiscoverCommunity[]; meta: { total: number } }) => ({
            items: d.data,
            total: d.meta.total,
          }),
          setCommunitiesState,
          (items) => {
            if (!cancelled) setCommunities(items as DiscoverCommunity[]);
          },
        ),
        fetchSection(
          '/api/discover/people',
          (d: { data: DiscoverPerson[]; meta: { total: number } }) => ({
            items: d.data,
            total: d.meta.total,
          }),
          setPeopleState,
          (items) => {
            if (!cancelled) setPeople(items as DiscoverPerson[]);
          },
        ),
        fetchSection(
          '/api/discover/topics',
          (d: { data: TrendingTopic[]; meta: { total: number } }) => ({
            items: d.data,
            total: d.meta.total,
          }),
          setTopicsState,
          (items) => {
            if (!cancelled) setTopics(items as TrendingTopic[]);
          },
        ),
        fetchSection(
          '/api/discover/featured',
          (d: { spaces: FeaturedSpace[]; trending: TrendingTopic[] }) => ({
            items: d.spaces,
            total: d.spaces.length,
          }),
          setSpacesState,
          (items) => {
            if (!cancelled) setSpaces(items as FeaturedSpace[]);
          },
        ),
        (async () => {
          try {
            const res = await fetch('/api/discover/new');
            if (!res.ok) {
              if (!cancelled) setNewState('error');
              return;
            }
            const data = (await res.json()) as {
              communities: DiscoverCommunity[];
              people: DiscoverPerson[];
            };
            if (!cancelled) {
              const hasItems = data.communities.length > 0 || data.people.length > 0;
              setNewCommunities(data.communities || []);
              setNewPeople(data.people || []);
              setNewState(hasItems ? 'loaded' : 'empty');
            }
          } catch {
            if (!cancelled) setNewState('error');
          }
        })(),
      ];

      // Creator discovery — trending creators across protocols
      fetches.push(
        fetchSection(
          '/api/discover/people',
          (d: { data: DiscoverPerson[]; meta: { total: number } }) => ({
            items: d.data,
            total: d.meta.total,
          }),
          setTrendingCreatorsState,
          (items) => {
            if (!cancelled) setTrendingCreators(items as DiscoverPerson[]);
          },
        ),
      );

      // Cross-network trending
      fetches.push(
        (async () => {
          try {
            const res = await fetch('/api/trending/cross-network');
            if (!res.ok) {
              if (!cancelled) setCrossTrendingState('error');
              return;
            }
            const data = (await res.json()) as { data: TrendingItem[]; meta: { total: number } };
            if (!cancelled) {
              if (data.data.length > 0) {
                setCrossNetworkTrending(data.data);
                setCrossTrendingState('loaded');
              } else {
                setCrossTrendingState('empty');
              }
            }
          } catch {
            if (!cancelled) setCrossTrendingState('error');
          }
        })(),
      );

      await Promise.allSettled(fetches);
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [fetchSection, trendingPeriod]);

  // Re-fetch trending when period changes
  useEffect(() => {
    fetchSection(
      `/api/discover/trending?period=${trendingPeriod}`,
      (d: { data: TrendingPost[]; meta: { total: number } }) => ({
        items: d.data,
        total: d.meta.total,
      }),
      setTrendingState,
      (items) => setTrendingPosts(items as TrendingPost[]),
    );
  }, [trendingPeriod, fetchSection]);

  const handlePostClick = useCallback((id: string) => {
    window.location.href = `/post/${encodeURIComponent(id)}`;
  }, []);

  const handleTrendingPeriodChange = useCallback((period: string) => {
    setTrendingPeriod(period);
  }, []);

  // == Creator search ==
  const doCreatorSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setCreatorSearchResults([]);
      setCreatorSearchState('idle');
      return;
    }
    setCreatorSearchState('loading');
    try {
      const res = await fetch(`/api/search/creators?q=${encodeURIComponent(q)}&limit=12`);
      if (!res.ok) {
        setCreatorSearchState('error');
        return;
      }
      const data = (await res.json()) as { data: DiscoverPerson[]; meta: { total: number } };
      if (data.data.length === 0) {
        setCreatorSearchState('empty');
        setCreatorSearchResults([]);
      } else {
        setCreatorSearchState('loaded');
        setCreatorSearchResults(data.data);
      }
    } catch {
      setCreatorSearchState('error');
    }
  }, []);

  const creatorSearchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleCreatorSearchChange = useCallback(
    (val: string) => {
      setCreatorSearchQuery(val);
      if (creatorSearchDebounceRef.current) clearTimeout(creatorSearchDebounceRef.current);
      creatorSearchDebounceRef.current = setTimeout(() => doCreatorSearch(val), 250);
    },
    [doCreatorSearch],
  );

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-degen-500/20 to-purple-500/10 text-lg">
              {'\uD83D\uDD0D'}
            </span>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-fg)]">Discover</h1>
              <p className="text-sm text-[var(--color-muted)]">
                Trending posts, communities, and people across the open social graph
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-10">
          {/* ═══ 0. Browse by Category ═══ */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{'\uD83D\uDCC1'}</span>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-fg)]">Browse by Category</h2>
                  <p className="text-xs text-[var(--color-muted)]">
                    Explore topics across the open social graph
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CATEGORIES.slice(0, 6).map((cat) => (
                <CategoryCard key={cat.id} {...cat} />
              ))}
            </div>
          </section>

          {/* ═══ CREATOR DISCOVERY ═══ */}
          <section>
            <SectionHeader
              emoji={'\uD83D\uDC65'}
              title="Find Creators to Follow"
              subtitle="Search across Nostr, Farcaster, Lens, Bluesky, Mastodon, and more"
            />
            <div className="relative mb-4">
              <label htmlFor="creator-search" className="sr-only">
                Search creators
              </label>
              <input
                id="creator-search"
                type="text"
                value={creatorSearchQuery}
                onChange={(e) => handleCreatorSearchChange(e.target.value)}
                placeholder="Search creators by name, handle, or topic..."
                className="input h-11 w-full pl-11 pr-4 text-sm"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
                ⌕
              </span>
            </div>
            {creatorSearchState === 'loading' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="card animate-pulse h-20" />
                ))}
              </div>
            )}
            {creatorSearchState === 'loaded' && creatorSearchResults.length > 0 && (
              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {creatorSearchResults.map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </div>
            )}
            {creatorSearchState === 'empty' && (
              <p className="mb-6 text-xs text-[var(--color-muted)]">
                No creators found. Try a different search term.
              </p>
            )}
          </section>

          {/* ═══ TRENDING CREATORS ═══ */}
          {trendingCreatorsState === 'loaded' && trendingCreators.length > 0 && (
            <section>
              <SectionHeader
                emoji={'\uD83D\uDD25'}
                title="Trending Creators"
                subtitle="Across all protocols"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trendingCreators.slice(0, 6).map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </div>
            </section>
          )}

          {/* ═══ CROSS-NETWORK TRENDING ═══ */}
          {crossTrendingState === 'loaded' && crossNetworkTrending.length > 0 && (
            <section>
              <SectionHeader
                emoji={'\uD83C\uDF0D'}
                title="Cross-Network Trending"
                subtitle="What's hot across every protocol right now"
              />
              <div className="grid grid-cols-1 gap-2">
                {crossNetworkTrending.slice(0, 8).map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card-hover flex items-start gap-4 p-4 transition-colors"
                  >
                    {item.thumbnailUrl && (
                      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--color-card)]">
                        <Image
                          src={item.thumbnailUrl}
                          alt={item.title}
                          width={80}
                          height={56}
                          className="h-14 w-20 object-cover"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-[var(--color-fg)]">
                          {item.title}
                        </span>
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                          style={{
                            backgroundColor: `${item.sourceColor}18`,
                            color: item.sourceColor,
                          }}
                        >
                          {item.sourceLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-muted)]">
                        {item.description}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
                        <span>🔥 {item.score}</span>
                        <span>⚡ {Math.round(item.velocity)}/hr</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* ═══ RECOMMENDED FOR YOU ═══ */}
          {recommendedState === 'loaded' && recommendedPosts.length > 0 && (
            <section>
              <SectionHeader
                emoji={'\uD83D\uDCA1'}
                title="Recommended for You"
                subtitle="Based on your interests and activity"
              />
              <div className="flex gap-3 overflow-x-auto pb-2">
                {recommendedPosts.slice(0, 6).map((post) => (
                  <div key={post.id} className="w-72 shrink-0">
                    <TrendingPostCard post={post} onPostClick={handlePostClick} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══ 1. Trending Now ═══ */}
          <section>
            <SectionHeader
              emoji={'\uD83D\uDD25'}
              title="Trending Now"
              subtitle="Top posts by engagement velocity"
            />
            <div className="mb-3 flex gap-2">
              {['hour', 'day', 'week'].map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => handleTrendingPeriodChange(period)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    trendingPeriod === period
                      ? 'bg-degen-500/15 text-degen-400'
                      : 'border border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  {period === 'hour' ? 'This hour' : period === 'day' ? 'Today' : 'This week'}
                </button>
              ))}
            </div>
            {trendingState === 'loading' && <SectionSkeleton count={4} layout="row" />}
            {trendingState === 'empty' && (
              <p className="text-sm text-[var(--color-muted)]">No trending content right now.</p>
            )}
            {trendingState === 'error' && (
              <p className="text-sm text-red-400">Couldn&apos;t load trending content.</p>
            )}
            {trendingState === 'loaded' && trendingPosts.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {trendingPosts.slice(0, 10).map((post) => (
                  <div key={post.id} className="w-72 shrink-0">
                    <TrendingPostCard post={post} onPostClick={handlePostClick} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ═══ 1.5. Popular This Hour ═══ */}
          <section>
            <SectionHeader
              emoji="⏰"
              title="Popular This Hour"
              subtitle="Highest engagement posts from the last 60 minutes"
            />
            {popularThisHourState === 'loading' && <SectionSkeleton count={4} layout="row" />}
            {popularThisHourState === 'empty' && (
              <p className="text-sm text-[var(--color-muted)]">No popular content this hour.</p>
            )}
            {popularThisHourState === 'loaded' && popularThisHour.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {popularThisHour.slice(0, 8).map((post) => (
                  <div key={post.id} className="w-72 shrink-0">
                    <TrendingPostCard post={post} onPostClick={handlePostClick} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ═══ 2. Suggested Communities ═══ */}
          <section>
            <SectionHeader
              emoji={'\uD83C\uDFD8\uFE0F'}
              title="Suggested Communities"
              subtitle="Based on your interests"
              href="/c"
            />
            {communitiesState === 'loading' && <SectionSkeleton count={4} />}
            {communitiesState === 'empty' && (
              <p className="text-sm text-[var(--color-muted)]">No communities yet.</p>
            )}
            {communitiesState === 'error' && (
              <p className="text-sm text-red-400">Couldn&apos;t load communities.</p>
            )}
            {communitiesState === 'loaded' && communities.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {communities.slice(0, 9).map((community) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            )}
          </section>

          {/* ═══ 3. People to Follow ═══ */}
          <section>
            <SectionHeader
              emoji={'\uD83D\uDC65'}
              title="People to Follow"
              subtitle="Active creators across protocols"
            />
            {peopleState === 'loading' && <SectionSkeleton count={4} />}
            {peopleState === 'empty' && (
              <p className="text-sm text-[var(--color-muted)]">No suggestions yet.</p>
            )}
            {peopleState === 'error' && (
              <p className="text-sm text-red-400">Couldn&apos;t load suggestions.</p>
            )}
            {peopleState === 'loaded' && people.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {people.slice(0, 9).map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </div>
            )}
          </section>

          {/* ═══ 4. Popular Topics ═══ */}
          <section>
            <SectionHeader
              emoji={'\uD83D\uDCC8'}
              title="Popular Topics"
              subtitle="Trending hashtags and niches"
            />
            {topicsState === 'loading' && <TopicPillsSkeleton />}
            {topicsState === 'empty' && (
              <p className="text-sm text-[var(--color-muted)]">No trending topics.</p>
            )}
            {topicsState === 'error' && (
              <p className="text-sm text-red-400">Couldn&apos;t load topics.</p>
            )}
            {topicsState === 'loaded' && topics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {topics.slice(0, 20).map((topic) => (
                  <TopicPill key={topic.topic} topic={topic} count={topic.count} />
                ))}
              </div>
            )}
          </section>

          {/* ═══ 5. Featured Spaces ═══ */}
          {(spacesState === 'loading' || (spacesState === 'loaded' && spaces.length > 0)) && (
            <section>
              <SectionHeader
                emoji={'\uD83C\uDF99\uFE0F'}
                title="Featured Spaces"
                subtitle="Live and upcoming audio spaces"
                href="/spaces"
              />
              {spacesState === 'loading' && <SectionSkeleton count={2} />}
              {spacesState === 'loaded' && spaces.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {spaces.slice(0, 4).map((space) => (
                    <SpaceCard key={space.id} space={space} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ═══ 6. New on DegenFeed ═══ */}
          <section>
            <SectionHeader
              emoji={'\uD83C\uDD95'}
              title="New on DegenFeed"
              subtitle="Recently created communities and active accounts"
            />
            {newState === 'loading' && <SectionSkeleton count={3} />}
            {newState === 'empty' && (
              <p className="text-sm text-[var(--color-muted)]">Nothing new yet.</p>
            )}
            {newState === 'error' && (
              <p className="text-sm text-red-400">Couldn&apos;t load new content.</p>
            )}
            {newState === 'loaded' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                {newCommunities.slice(0, 6).map((c) => (
                  <NewItemCard
                    key={`community:${c.id}`}
                    name={c.displayName || c.name}
                    type="community"
                    icon={c.icon}
                    subtitle={`${formatCount(c.memberCount)} members`}
                    href={`/c/${c.name}`}
                  />
                ))}
                {newPeople.slice(0, 6).map((p) => (
                  <NewItemCard
                    key={`person:${p.id}`}
                    name={p.displayName}
                    type="person"
                    subtitle={`@${p.handle}`}
                    href={`/post/${encodeURIComponent(p.id)}`}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </ErrorBoundary>
  );
}
