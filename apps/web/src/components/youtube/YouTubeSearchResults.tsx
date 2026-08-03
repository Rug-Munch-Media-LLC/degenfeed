'use client';

/**
 * @degenfeed/web — YouTubeSearchResults
 *
 * Search results page for YouTube content.
 * Shows search query, result count, and video grid.
 * Results clearly labeled as YouTube.
 */

import { memo } from 'react';
import { useYouTubeSearch } from './useYouTube';
import { YouTubeVideoGrid } from './YouTubeVideoGrid';

// === Types ===============================================================

export interface YouTubeSearchResultsProps {
  /** Current search query */
  query: string;
  /** Called when a video is played */
  onPlay?: (video: Parameters<typeof useYouTubeSearch>[0] extends string ? unknown : never) => void;
}

// === Component ===========================================================

export const YouTubeSearchResults = memo(function YouTubeSearchResults({
  query,
}: YouTubeSearchResultsProps) {
  const { videos, isLoading, isError, error } = useYouTubeSearch(query, 30);

  return (
    <div className="w-full">
      {/* Search header */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[var(--color-fg)] flex items-center gap-2">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-red-500"
          >
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <path
              d="M21 21L16.65 16.65"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Search results for &ldquo;{query}&rdquo;
        </h2>
        {!isLoading && (
          <p className="text-sm text-[var(--color-muted)] mt-1">
            {videos.length} result{videos.length !== 1 ? 's' : ''} from YouTube
          </p>
        )}
      </div>

      {/* Results grid */}
      <YouTubeVideoGrid
        videos={videos}
        loading={isLoading}
        error={
          isError
            ? error instanceof Error
              ? error.message
              : 'Search failed. Please try again.'
            : null
        }
        emptyMessage={`No YouTube videos found for "${query}". Try a different search term.`}
      />
    </div>
  );
});

// === Search bar (standalone) =============================================

export interface YouTubeSearchBarProps {
  /** Current value */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Called on search submission */
  onSearch: (query: string) => void;
  /** Placeholder text */
  placeholder?: string;
}

export const YouTubeSearchBar = memo(function YouTubeSearchBar({
  value,
  onChange,
  onSearch,
  placeholder = 'Search YouTube...',
}: YouTubeSearchBarProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim().length >= 2) {
      onSearch(value.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-xl" role="search">
      <div className="relative">
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] pl-10 pr-4 py-2.5 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/30 transition-all"
          aria-label="Search YouTube videos"
        />
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
        >
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
          <path
            d="M21 21L16.65 16.65"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          aria-label="Clear search"
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6L18 18" />
          </svg>
        </button>
      )}
    </form>
  );
});
