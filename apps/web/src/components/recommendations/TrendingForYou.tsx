'use client';

import { usePersonalizedTrending } from '../../hooks/useRecommendations';
import { RecommendationCard } from './RecommendationCard';

interface TrendingForYouProps {
  category?: string;
  limit?: number;
}

/**
 * "Trending For You" — personalized trending content.
 * Shows what's popular in the user's specific interest areas,
 * not global trending.
 */
export function TrendingForYou({
  category,
  limit = 8,
}: TrendingForYouProps) {
  const { data: trending, error, isLoading } = usePersonalizedTrending(category);

  if (error || (!isLoading && !trending?.length)) return null;

  return (
    <section className="trending-for-you mt-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-bold text-foreground">
          {category ? `Trending in ${capitalize(category)}` : 'Trending For You'}
        </h2>
        <span className="text-xs text-orange-500 font-medium">🔥</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-muted rounded-lg aspect-video"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {trending!.slice(0, limit).map((content, index) => (
            <div key={content.id} className="relative">
              {/* Trend rank badge */}
              <span className="absolute -top-1 -left-1 z-10 bg-orange-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {index + 1}
              </span>
              <RecommendationCard
                content={content}
              />
            </div>
          ))}
        </div>
      )}

      {trending && trending.length > limit && (
        <div className="mt-3 text-center">
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => window.location.href = '/trending'}
          >
            View all trending
          </button>
        </div>
      )}
    </section>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
