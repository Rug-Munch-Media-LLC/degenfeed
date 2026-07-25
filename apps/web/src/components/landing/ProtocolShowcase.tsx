'use client';

/**
 * ProtocolShowcase — Scrolling marquee row of protocol logos with gradient mask edges.
 * Duplicates the array for seamless infinite scroll.
 */

const PROTOCOLS = [
  { name: 'Nostr', color: 'var(--color-protocol-nostr)', emoji: '🌩' },
  { name: 'Farcaster', color: 'var(--color-protocol-farcaster)', emoji: '⚡' },
  { name: 'Lens', color: 'var(--color-protocol-lens)', emoji: '🔮' },
  { name: 'Bluesky', color: 'var(--color-protocol-bluesky)', emoji: '🦋' },
  { name: 'Mastodon', color: 'var(--color-protocol-mastodon)', emoji: '🐘' },
  { name: 'Reddit', color: 'var(--color-protocol-reddit)', emoji: '🤖' },
  { name: 'PeerTube', color: 'var(--color-protocol-peertube)', emoji: '🎬' },
  { name: 'PixelFed', color: 'var(--color-protocol-pixelfed)', emoji: '📸' },
  { name: 'Threads', color: '#888888', emoji: '🧵' },
  { name: 'Matrix', color: '#0dbd8b', emoji: '💬' },
  { name: 'Discord', color: '#5865f2', emoji: '💜' },
  { name: 'YouTube', color: '#ff0000', emoji: '▶' },
  { name: 'Substack', color: '#ff6719', emoji: '✉' },
  { name: 'Lemmy', color: '#00b868', emoji: '🍋' },
  { name: 'GoToSocial', color: '#6364ff', emoji: '🐘' },
  { name: 'Pleroma', color: '#ff6688', emoji: '💜' },
  { name: 'Misskey', color: '#ff88aa', emoji: '🌸' },
  { name: 'Friendica', color: '#dd88ff', emoji: '🤝' },
  { name: 'Diaspora', color: '#88aaff', emoji: '🌍' },
  { name: 'Gab', color: '#888888', emoji: '💬' },
  { name: 'Minds', color: '#ff8800', emoji: '🧠' },
  { name: 'WriteFreely', color: '#66ccff', emoji: '✍️' },
  { name: 'Micro.blog', color: '#ff6699', emoji: '📝' },
  { name: 'Plume', color: '#ffaa00', emoji: '📄' },
  { name: 'Write.as', color: '#888888', emoji: '✏️' },
  { name: 'Publii', color: '#888888', emoji: '📰' },
  { name: 'Aether', color: '#66ffaa', emoji: '🌐' },
  { name: 'Scuttlebutt', color: '#88aa00', emoji: '🏴‍☠️' },
  { name: 'Hive', color: '#ffaa00', emoji: '🍯' },
  { name: 'PieFed', color: '#88ff88', emoji: '🥧' },
  { name: 'Owncast', color: '#ff6688', emoji: '📺' },
  { name: 'Odysee', color: '#88aa00', emoji: '🪙' },
  { name: 'DTube', color: '#ff8800', emoji: '🎵' },
  { name: 'Rumble', color: '#ff6600', emoji: '📻' },
  { name: 'BitTube', color: '#888888', emoji: '🎥' },
  { name: 'Funkwhale', color: '#66ffaa', emoji: '🎧' },
  { name: 'Castopod', color: '#ff66aa', emoji: '🎙️' },
  { name: 'Steem', color: '#ffaa00', emoji: '⛓️' },
  { name: 'DeSo', color: '#88aaff', emoji: '🔷' },
  { name: 'Subsocial', color: '#ff6688', emoji: '🔗' },
  { name: 'CyberConnect', color: '#66ccff', emoji: '🔌' },
  { name: 'Ceramic', color: '#aa66ff', emoji: '🏺' },
  { name: 'Status', color: '#66ffaa', emoji: '📱' },
  { name: 'Session', color: '#888888', emoji: '🕵️' },
] as const;

export function ProtocolShowcase() {
  // Generate stable unique keys for the marquee duplicates
  const items = PROTOCOLS.flatMap((protocol, runIndex) =>
    [0, 1, 2].map((copy) => ({ ...protocol, key: `${protocol.name}-${runIndex}-${copy}` })),
  );

  return (
    <section className="relative overflow-hidden py-16 md:py-20" id="protocols">
      <div className="mx-auto mb-10 max-w-3xl px-4 text-center">
        <h2
          className="mb-3 text-3xl font-black md:text-4xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Every Protocol. <span className="gradient-text">One Window.</span>
        </h2>
        <p
          className="mx-auto max-w-xl text-sm leading-relaxed"
          style={{ color: 'var(--color-fg-secondary)' }}
        >
          44 decentralized networks. One unified timeline. The social graph belongs to the protocols
          — the window belongs to you.
        </p>
      </div>

      {/* Marquee wrapper */}
      <div className="group relative">
        {/* Gradient masks on edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-black to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-black to-transparent" />

        <div className="marquee-track flex items-center gap-3 overflow-hidden py-4">
          <div className="marquee-content flex shrink-0 items-center gap-3">
            {items.map((protocol) => (
              <span
                key={protocol.key}
                className="protocol-chip inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-300 hover:scale-105"
                style={{
                  borderColor: `${protocol.color}30`,
                  background: `${protocol.color}08`,
                  color: protocol.color,
                }}
              >
                <span className="text-base" role="img" aria-label={protocol.name}>
                  {protocol.emoji}
                </span>
                <span>{protocol.name}</span>
                <span
                  className="ml-0.5 h-1.5 w-1.5 rounded-full"
                  style={{ background: protocol.color, boxShadow: `0 0 6px ${protocol.color}` }}
                />
              </span>
            ))}
          </div>
          {/* Second track for seamless loop on slower hardware */}
          <div className="marquee-content flex shrink-0 items-center gap-3" aria-hidden="true">
            {items.map((protocol) => (
              <span
                key={`clone-${protocol.key}`}
                className="protocol-chip inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold"
                style={{
                  borderColor: `${protocol.color}30`,
                  background: `${protocol.color}08`,
                  color: protocol.color,
                }}
              >
                <span className="text-base">{protocol.emoji}</span>
                <span>{protocol.name}</span>
                <span
                  className="ml-0.5 h-1.5 w-1.5 rounded-full"
                  style={{ background: protocol.color, boxShadow: `0 0 6px ${protocol.color}` }}
                />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Pause on hover (allows reading the chips) — style handled by group-hover */}
    </section>
  );
}
