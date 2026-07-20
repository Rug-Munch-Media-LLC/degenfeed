'use client';

import { useRelatedContent } from '../../hooks/useRecommendations';
import { RecommendationCard } from './RecommendationCard';

interface BecauseYouWatchedProps {
  source: 'youtube' | 'peertube' | 'tiktok' | 'instagram' | 'twitch' | 'kick' | 'rumble' | 'odysee';
  contentId: string;
  contentTitle?: string;
}

/**
 * "Because you watched X" — related content recommendations.
 * Shows when a user is viewing a specific video/short/stream.
 */
export function BecauseYouWatched({
  source,
  contentId,
  contentTitle,
}: BecauseYouWatchedProps) {
  const { data: related, error, isLoading } = useRelatedContent(source, contentId);

  if (error || (!isLoading && !related?.length)) return null;

  return (
    <section className="because-you-watched mt-6">
      <h2 className="text-lg font-bold mb-3 text-foreground">
        {contentTitle ? (
          <>Because you watched <span className="text-muted-foreground">&ldquo;{truncateTitle(contentTitle)}&rdquo;</span></>
        ) : (
          'Related content'
        )}
      </h2>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-56 animate-pulse bg-muted rounded-lg h-36"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
          {related!.map((content) => (
            <RecommendationCard
              key={content.id}
              content={content}
              showSignals
            />
          ))}
        </div>
      )}
    </section>
  );
}

function truncateTitle(title: string, maxLength = 40): string {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength) + '…';
}
