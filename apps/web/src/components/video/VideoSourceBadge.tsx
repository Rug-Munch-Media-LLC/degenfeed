'use client';

/**
 * @degenfeed/web — VideoSourceBadge
 *
 * Color-coded source indicator for videos.
 * YouTube = red, PeerTube = orange, Shorts = pink, Live = purple.
 */

interface VideoSourceBadgeProps {
  source: 'youtube' | 'peertube' | 'shorts' | 'livestream';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const SOURCE_STYLES: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  youtube: {
    label: 'YouTube',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
  peertube: {
    label: 'PeerTube',
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
  shorts: {
    label: 'Shorts',
    bg: 'bg-pink-500/15',
    text: 'text-pink-400',
    border: 'border-pink-500/30',
  },
  livestream: {
    label: 'Live',
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
};

export function VideoSourceBadge({
  source,
  label,
  size = 'sm',
  showLabel = true,
  className = '',
}: VideoSourceBadgeProps) {
  const style = SOURCE_STYLES[source] ?? SOURCE_STYLES.youtube;
  const displayLabel = label ?? style.label;

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-0.5 text-xs',
    lg: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${style.bg} ${style.text} ${style.border} ${sizeClasses[size]} ${className}`}
    >
      {source === 'livestream' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-500" />
        </span>
      )}
      {showLabel && displayLabel}
    </span>
  );
}
