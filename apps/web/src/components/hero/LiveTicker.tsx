'use client';

/**
 * LiveTicker — "What's Hot Right Now" horizontal scrolling ticker.
 * Shows trending topics/protocols with real-time feel.
 */

const HOT_ITEMS = [
  { text: 'gm gm 🌞', protocol: 'farcaster', color: 'var(--color-protocol-farcaster)' },
  { text: 'nostr relays hitting新高', protocol: 'nostr', color: 'var(--color-protocol-nostr)' },
  { text: 'Bluesky hits 30M users', protocol: 'bluesky', color: 'var(--color-protocol-bluesky)' },
  { text: 'Lens v2 mainnet soon', protocol: 'lens', color: 'var(--color-protocol-lens)' },
  { text: 'Mastodon federates 50K', protocol: 'mastodon', color: 'var(--color-protocol-mastodon)' },
  { text: 'DeFi summer vibes 🏖️', protocol: 'farcaster', color: 'var(--color-protocol-farcaster)' },
  { text: 'Zap! ⚡ new tipping record', protocol: 'nostr', color: 'var(--color-protocol-nostr)' },
  { text: 'PeerTube 5.0 released', protocol: 'peertube', color: 'var(--color-protocol-peertube)' },
  { text: 'PixelFed gets Stories', protocol: 'pixelfed', color: 'var(--color-protocol-pixelfed)' },
  { text: 'Creator coins mooning 🚀', protocol: 'lens', color: 'var(--color-protocol-lens)' },
];

export function LiveTicker() {
  const items = [...HOT_ITEMS, ...HOT_ITEMS]; // Duplicate for seamless loop

  return (
    <div className="relative w-full overflow-hidden py-3">
      {/* Gradient edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-black to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-black to-transparent" />

      <div className="ticker-track flex items-center gap-4">
        {items.map((item, i) => (
          <span
            key={`${item.text}-${i}`}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-xs"
            style={{
              borderColor: `${item.color}30`,
              background: `${item.color}08`,
              color: 'var(--color-fg-secondary)',
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
            <span>{item.text}</span>
            <span
              className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: item.color, background: `${item.color}15` }}
            >
              {item.protocol}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
