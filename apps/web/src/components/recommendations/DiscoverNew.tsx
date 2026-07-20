'use client';

import { useDiscoverNew } from '../../hooks/useRecommendations';
import { RecommendationCard } from './RecommendationCard';

interface DiscoverNewProps {
  limit?: number;
}

/**
 * "Discover New Creators" — surfaces content from creators the user
 * hasn't interacted with, breaking filter bubbles.
 */
export function DiscoverNew({
  limit = 6,
}: DiscoverNewProps) {
  const { data: discoveries, error, isLoading } = useDiscoverNew();

  if (error || (!isLoading && !discoveries?.length)) return null;

  return (
    <section className="discover-new mt-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Discover New Creators</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Step outside your bubble — fresh voices you haven&apos;t seen yet
          </p>
        </div>
        <span className="text-lg" role="img" aria-label="sparkles">✨</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-muted rounded-lg aspect-video"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {discoveries!.slice(0, limit).map((content) => (
            <div key={content.id} className="group relative">
              <RecommendationCard content={content} />
              {/* New creator badge */}
              <div className="mt-1 flex items-center gap-1">
                <span className="inline-block bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">
                  New to you
                </span>
                {content.creatorQuality > 80 && (
                  <span className="inline-block bg-green-500/10 text-green-600 text-xs px-1.5 py-0.5 rounded-full">
                    Popular creator
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
