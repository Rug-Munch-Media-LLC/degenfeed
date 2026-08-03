'use client';

import { useRecordInteraction } from '../../hooks/useRecommendations';

interface ContinueWatchingItem {
  contentId: string;
  title: string;
  creatorName: string;
  creatorAvatar?: string;
  thumbnailUrl?: string;
  duration: number;
  progress: number; // 0-1 completion
  url: string;
}

interface ContinueWatchingProps {
  /** External progress data — in production, loaded from local storage or server */
  recentlyWatched?: ContinueWatchingItem[];
  onResume?: (item: ContinueWatchingItem) => void;
}

/**
 * "Continue Watching" — recently watched content with progress bars.
 * Shows what the user was in the middle of watching so they can pick
 * up where they left off.
 */
export function ContinueWatching({ recentlyWatched, onResume }: ContinueWatchingProps) {
  const recordInteraction = useRecordInteraction();

  // For the MVP, we show loading state while the recommendation engine
  // warms up. In production, progress data comes from localStorage.
  if (!recentlyWatched?.length) return null;

  // Sort by progress ascending (least finished first = higher priority to continue)
  const sorted = [...recentlyWatched].sort((a, b) => a.progress - b.progress);

  return (
    <section className="continue-watching mt-6">
      <h2 className="text-lg font-bold mb-3 text-foreground">Continue Watching</h2>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
        {sorted.slice(0, 8).map((item) => (
          <a
            key={item.contentId}
            href={item.url}
            className="flex-shrink-0 w-56 group"
            onClick={(e) => {
              if (onResume) {
                e.preventDefault();
                onResume(item);
              }
              recordInteraction({
                contentId: item.contentId,
                action: 'watch',
                duration: item.duration,
                creatorId: item.creatorName,
              });
            }}
          >
            {/* Thumbnail with progress bar */}
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden mb-2">
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <svg
                    aria-hidden="true"
                    className="w-8 h-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                  </svg>
                </div>
              )}

              {/* Progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${item.progress * 100}%` }}
                />
              </div>

              {/* Play overlay on hover */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <svg
                  aria-hidden="true"
                  className="w-10 h-10 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>

            {/* Info */}
            <div className="px-0.5">
              <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-tight mb-1">
                {item.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {item.creatorAvatar && (
                  <img src={item.creatorAvatar} alt="" className="w-4 h-4 rounded-full" />
                )}
                <span className="truncate">{item.creatorName}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {Math.round(item.progress * 100)}% watched
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// === Barrel export for convenience =======================================

export { BecauseYouWatched } from './BecauseYouWatched';
export { DiscoverNew } from './DiscoverNew';
export { RecommendationCard } from './RecommendationCard';
export { RecommendedRow } from './RecommendedRow';
export { TrendingForYou } from './TrendingForYou';
