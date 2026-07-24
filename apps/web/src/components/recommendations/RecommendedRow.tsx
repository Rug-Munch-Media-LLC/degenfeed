'use client';

import { useRecordInteraction, useVideoRecommendations } from '../../hooks/useRecommendations';
import { RecommendationCard } from './RecommendationCard';

interface RecommendedRowProps {
  title?: string;
  limit?: number;
  sources?: string[];
  onError?: () => void;
}

/**
 * "Recommended for You" row — personalized video recommendations.
 * Learns from watch history, likes, follows, and every interaction.
 */
export function RecommendedRow({
  title = 'Recommended for You',
  limit = 10,
  onError,
}: RecommendedRowProps) {
  const { data: recommendations, error, isLoading } = useVideoRecommendations({ limit });
  const recordInteraction = useRecordInteraction();

  if (error) {
    onError?.();
    return null;
  }

  if (isLoading || !recommendations?.length) {
    return (
      <section className="recommended-row">
        <h2 className="text-lg font-bold mb-3 text-foreground">{title}</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-64 animate-pulse bg-muted rounded-lg h-40"
              aria-hidden="true"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="recommended-row">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        {recommendations.length > 0 && (
          <span className="text-xs text-muted-foreground">Based on what you watch</span>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
        {recommendations.map((content) => (
          <RecommendationCard
            key={content.id}
            content={content}
            onImpression={() => {
              recordInteraction({
                contentId: content.id,
                action: 'watch',
                category: content.categories[0],
                creatorId: content.creatorId,
                source: content.source,
                duration: content.duration,
              });
            }}
          />
        ))}
      </div>

      {recommendations.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Recommendations improve with every interaction
        </p>
      )}
    </section>
  );
}
