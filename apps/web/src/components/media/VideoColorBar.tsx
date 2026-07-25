/**
 * @degenfeed/web — VideoColorBar & PlatformColors
 *
 * Tiny decorative color bar that shows the platform's brand color
 * at the top of each video card. Used by VideoGridCard.
 *
 * Platform accent colors for the video section.
 */

'use client';

// Platform accent map — each video platform gets its brand color
export const PLATFORM_COLORS: Record<string, { color: string; label: string; icon: string }> = {
  peertube: { color: '#f1680d', label: 'PeerTube', icon: '🎬' },
  youtube: { color: '#ff0000', label: 'YouTube', icon: '▶' },
  owncast: { color: '#4adf8b', label: 'Owncast', icon: '●' },
  twitch: { color: '#9146ff', label: 'Twitch', icon: '●' },
  odysee: { color: '#ef7c00', label: 'Odysee', icon: '◆' },
  dailymotion: { color: '#0066dc', label: 'DailyMotion', icon: '▶' },
  vimeo: { color: '#1ab7ea', label: 'Vimeo', icon: '▶' },
  tiktok: { color: '#ff0050', label: 'TikTok', icon: '♪' },
  rumble: { color: '#85c742', label: 'Rumble', icon: '◆' },
  bitchute: { color: '#ff6b00', label: 'BitChute', icon: '▶' },
  dlive: { color: '#ffd000', label: 'DLive', icon: '●' },
  kick: { color: '#53fc18', label: 'Kick', icon: '●' },
  zapstream: { color: '#00d4aa', label: 'Zap.Stream', icon: '⚡' },
  lbry: { color: '#4f9eff', label: 'LBRY', icon: '◆' },
  brighteon: { color: '#00a3e0', label: 'Brighteon', icon: '▶' },
};

export function getPlatformColor(source: string): string {
  return PLATFORM_COLORS[source]?.color ?? 'var(--color-accent)';
}

export function getPlatformLabel(source: string): string {
  return PLATFORM_COLORS[source]?.label ?? source;
}

export function getPlatformIcon(source: string): string {
  return PLATFORM_COLORS[source]?.icon ?? '▶';
}

interface VideoColorBarProps {
  source: string;
  className?: string;
}

/** Tiny horizontal color bar for video cards */
export function VideoColorBar({ source, className = '' }: VideoColorBarProps) {
  const color = getPlatformColor(source);
  return (
    <div
      className={`h-0.5 w-full shrink-0 ${className}`}
      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}50` }}
      aria-hidden="true"
    />
  );
}
