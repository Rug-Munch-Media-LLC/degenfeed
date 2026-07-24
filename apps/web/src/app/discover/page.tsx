'use client';

import { ErrorBoundary } from '@degenfeed/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CATEGORIES, CategoryCard } from '../../components/CategoryCard';
import {
  CommunityCard,
  NewItemCard,
  PersonCard,
  SectionHeader,
  SectionSkeleton,
  SpaceCard,
  TopicPill,
  TopicPillsSkeleton,
  TrendingPostCard,
} from './components';
import { formatCount } from './constants';
import type {
  DiscoverCommunity,
  DiscoverPerson,
  FeaturedSpace,
  SectionFetch,
  SectionState,
  TrendingItem,
  TrendingPost,
  TrendingTopic,
} from './types';

export default function DiscoverPage() {
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [communities, setCommunities] = useState<DiscoverCommunity[]>([]);
  const [people, setPeople] = useState<DiscoverPerson[]>([]);
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [spaces, setSpaces] = useState<FeaturedSpace[]>([]);
  const [newCommunities, setNewCommunities] = useState<DiscoverCommunity[]>([]);
  const [newPeople, setNewPeople] = useState<DiscoverPerson[]>([]);
  const [trendingPeriod, setTrendingPeriod] = useState<string>('hour');
  const [trendingState, setTrendingState] = useState<SectionState>('loading');
  const [communitiesState, setCommunitiesState] = useState<SectionState>('loading');
  const [peopleState, setPeopleState] = useState<SectionState>('loading');
  const [topicsState, setTopicsState] = useState<SectionState>('loading');
  const [spacesState, setSpacesState] = useState<SectionState>('loading');
  const [newState, setNewState] = useState<SectionState>('loading');
  const [popularThisHour, setPopularThisHour] = useState<TrendingPost[]>([]);
  const [popularThisHourState, setPopularThisHourState] = useState<SectionState>('loading');
  const [recommendedPosts, setRecommendedPosts] = useState<TrendingPost[]>([]);
  const [recommendedState, setRecommendedState] = useState<SectionState>('loading');
  const [trendingCreators, setTrendingCreators] = useState<DiscoverPerson[]>([]);
  const [trendingCreatorsState, setTrendingCreatorsState] = useState<SectionState>('loading');
  const [_recommendedCreators, _setRecommendedCreators] = useState<DiscoverPerson[]>([]);
  const [_recommendedCreatorsState, _setRecommendedCreatorsState] =
    useState<SectionState>('loading');
  const [crossNetworkTrending, setCrossNetworkTrending] = useState<TrendingItem[]>([]);
  const [crossTrendingState, setCrossTrendingState] = useState<SectionState>('loading');
  const [creatorSearchQuery, setCreatorSearchQuery] = useState('');
  const [creatorSearchResults, setCreatorSearchResults] = useState<DiscoverPerson[]>([]);
  const [creatorSearchState, setCreatorSearchState] = useState<
    'idle' | 'loading' | 'loaded' | 'empty' | 'error'
  >('idle');

  const cancelledRef = useRef(false);

  const fetchSection = useCallback(
    async <T,>(
      url: string,
      extractor: SectionFetch<T>,
      setState: (s: SectionState) => void,
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

  useEffect(() => {
    cancelledRef.current = false;
    async function loadAll() {
      const f = [
        fetchSection(
          `/api/discover/trending?period=${trendingPeriod}`,
          (d: { data: TrendingPost[] }) => ({ items: d.data }),
          setTrendingState,
          (items) => {
            if (!cancelledRef.current) setTrendingPosts(items as TrendingPost[]);
          },
        ),
        fetchSection(
          '/api/feed/home?limit=10&sort=hot&trending=1',
          (d: { data: TrendingPost[] }) => ({ items: d.data }),
          setPopularThisHourState,
          (items) => {
            if (!cancelledRef.current) setPopularThisHour(items as TrendingPost[]);
          },
        ),
        fetchSection(
          '/api/feed/for-you?limit=10&sort=scored&diverse=true',
          (d: { data: TrendingPost[] }) => ({ items: d.data }),
          setRecommendedState,
          (items) => {
            if (!cancelledRef.current) setRecommendedPosts(items as TrendingPost[]);
          },
        ),
        fetchSection(
          '/api/discover/communities',
          (d: { data: DiscoverCommunity[] }) => ({ items: d.data }),
          setCommunitiesState,
          (items) => {
            if (!cancelledRef.current) setCommunities(items as DiscoverCommunity[]);
          },
        ),
        fetchSection(
          '/api/discover/people',
          (d: { data: DiscoverPerson[] }) => ({ items: d.data }),
          setPeopleState,
          (items) => {
            if (!cancelledRef.current) setPeople(items as DiscoverPerson[]);
          },
        ),
        fetchSection(
          '/api/discover/topics',
          (d: { data: TrendingTopic[] }) => ({ items: d.data }),
          setTopicsState,
          (items) => {
            if (!cancelledRef.current) setTopics(items as TrendingTopic[]);
          },
        ),
        fetchSection(
          '/api/discover/featured',
          (d: { spaces: FeaturedSpace[] }) => ({ items: d.spaces }),
          setSpacesState,
          (items) => {
            if (!cancelledRef.current) setSpaces(items as FeaturedSpace[]);
          },
        ),
        (async () => {
          try {
            const res = await fetch('/api/discover/new');
            if (!res.ok) {
              if (!cancelledRef.current) setNewState('error');
              return;
            }
            const data = (await res.json()) as {
              communities: DiscoverCommunity[];
              people: DiscoverPerson[];
            };
            if (!cancelledRef.current) {
              setNewCommunities(data.communities || []);
              setNewPeople(data.people || []);
              setNewState(
                data.communities.length > 0 || data.people.length > 0 ? 'loaded' : 'empty',
              );
            }
          } catch {
            if (!cancelledRef.current) setNewState('error');
          }
        })(),
      ];
      await Promise.all(f);
    }
    loadAll();
    return () => {
      cancelledRef.current = true;
    };
  }, [trendingPeriod, fetchSection]);

  const renderSection = (state: SectionState, content: React.ReactNode, skeletonCount = 3) => {
    if (state === 'loading') return <SectionSkeleton count={skeletonCount} />;
    if (state === 'empty')
      return <p className="text-center text-xs text-[var(--color-muted)] py-8">Nothing yet</p>;
    if (state === 'error')
      return <p className="text-center text-xs text-red-400 py-8">Failed to load</p>;
    return content;
  };

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-5xl px-4 py-6 animate-page-enter">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">Discover</h1>
            <p className="text-sm text-[var(--color-muted)]">
              Trending posts, communities, and creators across all protocols
            </p>
          </div>
          <div className="flex items-center gap-2">
            {['hour', 'day', 'week'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTrendingPeriod(p)}
                className={`rounded-full px-3 py-1 text-[10px] font-medium transition-all ${trendingPeriod === p ? 'bg-degen-500/20 text-degen-400 border border-degen-500/30' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Categories Mosaic */}
        <div className="mb-8">
          <SectionHeader emoji="📂" title="Categories" subtitle="Explore by topic" href="/topics" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {CATEGORIES.map((cat) => (
              <CategoryCard key={cat.slug} cat={cat} />
            ))}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Trending main column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Trending */}
            <section>
              <SectionHeader
                emoji="🔥"
                title="Trending Across Protocols"
                subtitle={`Last ${trendingPeriod}`}
              />
              {renderSection(
                trendingState,
                <div className="grid gap-3 sm:grid-cols-2">
                  {trendingPosts.map((p) => (
                    <TrendingPostCard
                      key={p.id}
                      post={p}
                      onPostClick={(id) => {
                        window.location.href = `/post/${id}`;
                      }}
                    />
                  ))}
                </div>,
              )}
            </section>

            {/* Popular This Hour */}
            <section>
              <SectionHeader
                emoji="⚡"
                title="Popular This Hour"
                subtitle="High engagement in the last 60 minutes"
              />
              {renderSection(
                popularThisHourState,
                <div className="grid gap-3 sm:grid-cols-2">
                  {popularThisHour.map((p) => (
                    <TrendingPostCard
                      key={p.id}
                      post={p}
                      onPostClick={(id) => {
                        window.location.href = `/post/${id}`;
                      }}
                    />
                  ))}
                </div>,
                2,
              )}
            </section>

            {/* Recommended */}
            <section>
              <SectionHeader
                emoji="🎯"
                title="Because You Liked..."
                subtitle="Personalized recommendations"
              />
              {renderSection(
                recommendedState,
                <div className="grid gap-3 sm:grid-cols-2">
                  {recommendedPosts.map((p) => (
                    <TrendingPostCard
                      key={p.id}
                      post={p}
                      onPostClick={(id) => {
                        window.location.href = `/post/${id}`;
                      }}
                    />
                  ))}
                </div>,
                2,
              )}
            </section>

            {/* Trending Creators */}
            <section>
              <SectionHeader
                emoji="✨"
                title="Trending Creators"
                subtitle="Rising stars across networks"
              />
              {renderSection(
                trendingCreatorsState,
                <div className="grid gap-3 sm:grid-cols-2">
                  {trendingCreators.map((p) => (
                    <PersonCard key={p.id} person={p} />
                  ))}
                </div>,
                2,
              )}
            </section>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Topics */}
            <section>
              <SectionHeader emoji="🏷️" title="Trending Topics" />
              {topicsState === 'loading' ? (
                <TopicPillsSkeleton />
              ) : topicsState === 'error' ? (
                <p className="text-xs text-red-400">Failed to load</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {topics.slice(0, 12).map((t) => (
                    <TopicPill key={t.topic} topic={t} count={t.count} />
                  ))}
                </div>
              )}
            </section>

            {/* Featured Spaces */}
            <section>
              <SectionHeader emoji="🎙️" title="Featured Spaces" />
              {renderSection(
                spacesState,
                <div className="space-y-3">
                  {spaces.slice(0, 4).map((s) => (
                    <SpaceCard key={s.id} space={s} />
                  ))}
                </div>,
              )}
            </section>

            {/* Communities */}
            <section>
              <SectionHeader emoji="🏘️" title="Communities" />
              {renderSection(
                communitiesState,
                <div className="space-y-2">
                  {communities.slice(0, 6).map((c) => (
                    <CommunityCard key={c.id} community={c} />
                  ))}
                </div>,
              )}
            </section>

            {/* People */}
            <section>
              <SectionHeader emoji="👥" title="People to Follow" />
              {renderSection(
                peopleState,
                <div className="space-y-2">
                  {people.slice(0, 6).map((p) => (
                    <PersonCard key={p.id} person={p} />
                  ))}
                </div>,
              )}
            </section>

            {/* New Communities/People */}
            <section>
              <SectionHeader emoji="🆕" title="New This Week" />
              {renderSection(
                newState,
                <div className="space-y-2">
                  {newCommunities.slice(0, 3).map((c) => (
                    <NewItemCard
                      key={`community:${c.id}`}
                      name={c.displayName || c.name}
                      type="community"
                      subtitle={`${formatCount(c.memberCount)} members`}
                      href={`/c/${c.name}`}
                    />
                  ))}
                  {newPeople.slice(0, 3).map((p) => (
                    <NewItemCard
                      key={`person:${p.id}`}
                      name={p.displayName}
                      type="person"
                      subtitle={`@${p.handle}`}
                      href={`/post/${encodeURIComponent(p.id)}`}
                    />
                  ))}
                </div>,
              )}
            </section>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
