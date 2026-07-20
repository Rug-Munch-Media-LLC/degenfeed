'use client';

import { useCallback, useRef, useEffect } from 'react';
import type { RankedContent } from '../../hooks/useRecommendations';

interface RecommendationCardProps {
  content: RankedContent;
  onImpression?: () => void;
  showSignals?: boolean;
}

/**
 * A single recommendation card — thumbnail, title, creator, and optional
 * signal breakdown explaining WHY this content was recommended.
 */
export function RecommendationCard({
  content,
  onImpression,
  showSignals = false,
}: RecommendationCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const impressed = useRef(false);

  // Intersection observer for impression tracking
  useEffect(() => {
    if (!cardRef.current || impressed.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !impressed.current) {
            impressed.current = true;
            onImpression?.();
            observer.disconnect();
          }
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [onImpression]);

  const formatDuration = useCallback((seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }, []);

  const timeAgo = useCallback((timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  }, []);

  return (
    <div
      ref={cardRef}
      className="recommendation-card flex-shrink-0 w-64 group cursor-pointer"
      data-content-id={content.id}
    >
      {/* Thumbnail */}
      <a
        href={content.url}
        className="block relative aspect-video bg-muted rounded-lg overflow-hidden mb-2"
        target="_blank"
        rel="noopener noreferrer"
      >
        {content.thumbnailUrl ? (
          <img
            src={content.thumbnailUrl}
            alt={content.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}

        {/* Duration badge */}
        {content.duration > 0 && (
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
            {formatDuration(content.duration)}
          </span>
        )}

        {/* Live badge */}
        {content.isLive && (
          <span className="absolute top-1 left-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            LIVE
          </span>
        )}

        {/* Score badge on hover */}
        {showSignals && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <div className="text-white text-xs text-center px-2">
              <div className="font-bold text-sm mb-1">Score: {content.score}/100</div>
              {content.signals.reasons.slice(0, 3).map((reason, i) => (
                <div key={i} className="truncate">{reason}</div>
              ))}
            </div>
          </div>
        )}
      </a>

      {/* Info */}
      <div className="px-0.5">
        <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-tight mb-1">
          {content.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {content.creatorAvatar && (
            <img
              src={content.creatorAvatar}
              alt=""
              className="w-4 h-4 rounded-full"
            />
          )}
          <span className="truncate">{content.creatorName}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>{content.metrics.views.toLocaleString()} views</span>
          <span>·</span>
          <span>{timeAgo(content.publishedAt)}</span>
        </div>
      </div>
    </div>
  );
}
