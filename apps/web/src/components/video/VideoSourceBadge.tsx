'use client';

/**
 * @degenfeed/web — VideoSourceBadge
 *
 * Color-coded source indicator for videos across the multi-platform aggregator.
 * YouTube (red, via Invidious), Twitch (purple), Rumble (green),
 * PeerTube (orange), Zora (blue), DegenFeed Creator (green).
 */

interface VideoSourceBadgeProps {
  source:
    | 'youtube'
    | 'twitch'
    | 'rumble'
    | 'peertube'
    | 'zora'
    | 'creator'
    | 'shorts'
    | 'livestream'
    | 'odysee'
    | 'dtube'
    | 'bitchute'
    | 'dailymotion'
    | 'vimeo'
    | 'lbry';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showIcon?: boolean;
  className?: string;
}

const SOURCE_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  youtube: {
    label: 'YouTube (via Invidious)',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
  twitch: {
    label: 'Twitch',
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
  rumble: {
    label: 'Rumble',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  peertube: {
    label: 'PeerTube',
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
  zora: {
    label: 'Zora',
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  creator: {
    label: 'DegenFeed',
    bg: 'bg-degen-500/15',
    text: 'text-degen-400',
    border: 'border-degen-500/30',
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
  odysee: {
    label: 'Odysee',
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
  dtube: {
    label: 'DTube',
    bg: 'bg-red-600/15',
    text: 'text-red-400',
    border: 'border-red-600/30',
  },
  bitchute: {
    label: 'BitChute',
    bg: 'bg-red-800/15',
    text: 'text-red-600',
    border: 'border-red-800/30',
  },
  dailymotion: {
    label: 'Dailymotion',
    bg: 'bg-blue-600/15',
    text: 'text-blue-400',
    border: 'border-blue-600/30',
  },
  vimeo: {
    label: 'Vimeo',
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
  },
  lbry: {
    label: 'LBRY',
    bg: 'bg-orange-600/15',
    text: 'text-orange-400',
    border: 'border-orange-600/30',
  },
};

export function VideoSourceBadge({
  source,
  label,
  size = 'sm',
  showLabel = true,
  showIcon = false,
  className = '',
}: VideoSourceBadgeProps) {
  const style = (SOURCE_STYLES[source] ?? SOURCE_STYLES.youtube)! as {
    label: string;
    bg: string;
    text: string;
    border: string;
  };
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
      {/* Platform dot icon */}
      {showIcon && (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'currentColor' }} />
      )}

      {/* Live pulse indicator */}
      {source === 'livestream' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-500" />
        </span>
      )}

      {showLabel && displayLabel}

      {/* Source hint for youtube */}
      {source === 'youtube' && showLabel && <span className="opacity-60">(Invidious)</span>}
    </span>
  );
}

/** Short platform icon for dense layouts (returns SVG markup as string). */
export const PLATFORM_ICONS: Record<string, string> = {
  youtube:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
  twitch:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>',
  rumble:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-12.5v7l6-3.5-6-3.5z"/></svg>',
  peertube:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 6L2 18h20L12 6zm0 4.5L17.5 16H6.5L12 10.5z"/></svg>',
  zora: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>',
  creator:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  odysee:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>',
  dtube:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l7 3.5v7l-7 3.5-7-3.5v-7l7-3.5zM9.5 8.5v7l5.5-3.5-5.5-3.5z"/></svg>',
  bitchute:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-12.5v7l6-3.5-6-3.5z"/></svg>',
  dailymotion:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M0 0v24h24V0H0zm14.1 16.5c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5c1.2 0 2.3.5 3.1 1.2l1.4-1.4c-1.1-1.1-2.7-1.8-4.5-1.8-3.6 0-6.5 2.9-6.5 6.5s2.9 6.5 6.5 6.5c1.8 0 3.4-.7 4.5-1.8l-1.4-1.4c-.8.7-1.9 1.2-3.1 1.2z"/></svg>',
  vimeo:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.396 7.164c-.093 2.026-1.508 4.8-4.245 8.32C15.322 19.08 12.988 21 11.037 21c-1.128 0-2.084-1.043-2.867-3.128l-1.58-5.796C5.86 10.038 5.04 9 3.92 9c-.12 0-.567.265-1.34.788l-.798-.642c.428-.377.85-.754 1.267-1.13C4.06 7.347 5.305 6.588 6.7 6.407c1.416-.194 2.287.425 2.613 1.856.35 1.54.56 2.5.63 2.88.35 1.584.734 2.376 1.152 2.376.324 0 .812-.512 1.463-1.536.65-1.024.998-1.805 1.045-2.34.093-1.03-.296-1.545-1.168-1.545-.416 0-.845.095-1.287.285.854-2.795 2.488-4.153 4.9-4.076 1.787.046 2.63 1.208 2.527 3.488z"/></svg>',
  lbry: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-3 5-3v6zm6-3l-5 3v-6l5 3z"/></svg>',
};
