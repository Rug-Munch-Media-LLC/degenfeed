'use client';

export interface SkeletonProps {
  className?: string;
  /** Number of skeleton rows (default 1) */
  count?: number;
  /** Variant shape */
  variant?: 'text' | 'card' | 'avatar' | 'feed-item' | 'custom';
  /** Width override (for custom variant) */
  width?: string;
  /** Height override (for custom variant) */
  height?: string;
}

function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton-shimmer rounded-md ${className}`} style={{ height: '0.75rem' }} />
  );
}

function SkeletonCard() {
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-3">
        <div className="skeleton-shimmer h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton-shimmer h-3 w-1/3 rounded-md" />
          <div className="skeleton-shimmer h-2 w-1/4 rounded-md" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="skeleton-shimmer h-3 w-full rounded-md" />
        <div className="skeleton-shimmer h-3 w-4/5 rounded-md" />
      </div>
    </div>
  );
}

function SkeletonFeedItem() {
  return (
    <div className="skeleton-feed-item">
      <div className="skeleton-avatar" />
      <div className="skeleton-body">
        <div className="skeleton-line skeleton-line-sm" />
        <div className="skeleton-line skeleton-line-lg" />
        <div className="skeleton-line skeleton-line-xl" />
      </div>
    </div>
  );
}

function SkeletonAvatar() {
  return <div className="skeleton-shimmer h-10 w-10 rounded-full" />;
}

export default function LoadingSkeleton({
  className = '',
  count = 1,
  variant = 'text',
  width,
  height,
}: SkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  const renderItem = (index: number) => {
    switch (variant) {
      case 'card':
        return <SkeletonCard key={index} />;
      case 'feed-item':
        return <SkeletonFeedItem key={index} />;
      case 'avatar':
        return <SkeletonAvatar key={index} />;
      case 'custom':
        return (
          <div key={index} className="skeleton-shimmer rounded-md" style={{ width, height }} />
        );
      default:
        return <SkeletonLine key={index} className={className} />;
    }
  };

  if (variant === 'text') {
    return (
      <div className={`space-y-2 ${className}`}>
        {items.map((i) => (
          <SkeletonLine key={i} />
        ))}
      </div>
    );
  }

  return <div className={`space-y-3 ${className}`}>{items.map(renderItem)}</div>;
}

export { LoadingSkeleton };
