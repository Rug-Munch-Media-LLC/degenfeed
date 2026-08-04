'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import type {
  CommunityResult,
  FlatItem,
  IdentityResult,
  SearchResult,
  VideoResult,
} from './SearchTypes';
import { CommunitiesSection, PeopleSection, PostsSection, VideosSection } from './sections';

export interface SearchResultsContainerProps {
  query: string;
  results: SearchResult[];
  identities: IdentityResult[];
  communities: CommunityResult[];
  videos: VideoResult[];
  flatItems: FlatItem[];
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  onClose: () => void;
  protocolFilter: string | null;
  onCommitSearch: (q: string) => void;
}

export function SearchResultsContainer({
  query,
  results,
  identities,
  communities,
  videos,
  flatItems,
  selectedIndex,
  onSelectIndex,
  onClose,
  protocolFilter,
  onCommitSearch,
}: SearchResultsContainerProps) {
  const router = useRouter();

  // Extract unique topics/niches from all results
  const topics = useMemo(() => {
    const topicSet = new Set<string>();
    results.forEach((r) => {
      r.niches?.forEach((n) => topicSet.add(n));
    });
    return Array.from(topicSet).slice(0, 8);
  }, [results]);

  const hasAnyResults =
    identities.length > 0 ||
    results.length > 0 ||
    communities.length > 0 ||
    videos.length > 0 ||
    topics.length > 0;

  if (!hasAnyResults) {
    return (
      <div className="rounded-2xl bg-[var(--color-card)] shadow-lg shadow-black/10">
        <div className="py-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">No results for &ldquo;{query}&rdquo;</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Try different keywords or check your spelling
          </p>
          {protocolFilter && (
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Try removing the protocol filter
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[55vh] overflow-y-auto rounded-2xl bg-[var(--color-card)] shadow-lg shadow-black/10">
      {/* Topics section */}
      {topics.length > 0 && (
        <div>
          <div className="sticky top-0 z-10 bg-[var(--color-card)]/95 backdrop-blur-sm px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)] border-b border-[var(--color-border)]">
            Topics
          </div>
          <div className="flex flex-wrap gap-1.5 px-4 py-2.5">
            {topics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => {
                  onCommitSearch(query);
                  router.push(`/search?q=${encodeURIComponent(topic)}`);
                  onClose();
                }}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-fg)] hover:border-degen-500/30 hover:text-degen-400 transition-colors"
              >
                <span className="text-[10px]">#</span>
                {topic}
              </button>
            ))}
          </div>
        </div>
      )}

      <PeopleSection
        identities={identities}
        flatItems={flatItems}
        selectedIndex={selectedIndex}
        onSelectIndex={onSelectIndex}
        onClose={onClose}
        query={query}
        onCommitSearch={onCommitSearch}
      />
      <PostsSection
        results={results}
        flatItems={flatItems}
        selectedIndex={selectedIndex}
        onSelectIndex={onSelectIndex}
        onClose={onClose}
        query={query}
        onCommitSearch={onCommitSearch}
      />
      <CommunitiesSection
        communities={communities}
        flatItems={flatItems}
        selectedIndex={selectedIndex}
        onSelectIndex={onSelectIndex}
        onClose={onClose}
        query={query}
        onCommitSearch={onCommitSearch}
      />
      <VideosSection
        videos={videos}
        flatItems={flatItems}
        selectedIndex={selectedIndex}
        onSelectIndex={onSelectIndex}
        onClose={onClose}
        query={query}
        onCommitSearch={onCommitSearch}
      />
      {query.length >= 2 && (
        <a
          href={`/search?q=${encodeURIComponent(query)}${protocolFilter ? `&protocols=${protocolFilter}` : ''}`}
          onClick={(e) => {
            e.preventDefault();
            onCommitSearch(query);
            router.push(
              `/search?q=${encodeURIComponent(query)}${protocolFilter ? `&protocols=${protocolFilter}` : ''}`,
            );
            onClose();
          }}
          className="sticky bottom-0 z-10 flex items-center justify-center gap-2 bg-[var(--color-card)]/95 backdrop-blur-sm px-4 py-3 text-xs font-medium text-degen-400 hover:bg-[var(--color-overlay)] transition-colors border-t border-[var(--color-border)]"
        >
          View all results
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </a>
      )}
    </div>
  );
}
