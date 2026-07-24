'use client';

/**
 * OrbitingProtocols — Animated protocol logos orbiting around a central glow.
 * Pure CSS animation, no JS library needed. Each protocol orbits at a different
 * radius and speed for a dynamic, living feel.
 */

const PROTOCOLS = [
  {
    id: 'nostr',
    label: 'Nostr',
    emoji: '🌩',
    color: 'var(--color-protocol-nostr)',
    radius: 140,
    speed: 20,
    phase: 0,
  },
  {
    id: 'farcaster',
    label: 'Farcaster',
    emoji: '⚡',
    color: 'var(--color-protocol-farcaster)',
    radius: 170,
    speed: 25,
    phase: 45,
  },
  {
    id: 'lens',
    label: 'Lens',
    emoji: '🔮',
    color: 'var(--color-protocol-lens)',
    radius: 110,
    speed: 18,
    phase: 90,
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    emoji: '🦋',
    color: 'var(--color-protocol-bluesky)',
    radius: 160,
    speed: 22,
    phase: 135,
  },
  {
    id: 'mastodon',
    label: 'Mastodon',
    emoji: '🐘',
    color: 'var(--color-protocol-mastodon)',
    radius: 130,
    speed: 28,
    phase: 180,
  },
  {
    id: 'reddit',
    label: 'Reddit',
    emoji: '🤖',
    color: 'var(--color-protocol-reddit)',
    radius: 180,
    speed: 30,
    phase: 225,
  },
  {
    id: 'peertube',
    label: 'PeerTube',
    emoji: '🎬',
    color: 'var(--color-protocol-peertube)',
    radius: 150,
    speed: 15,
    phase: 270,
  },
  {
    id: 'pixelfed',
    label: 'PixelFed',
    emoji: '📸',
    color: 'var(--color-protocol-pixelfed)',
    radius: 120,
    speed: 35,
    phase: 315,
  },
];

export function OrbitingProtocols() {
  return (
    <div className="relative flex items-center justify-center" style={{ height: 380, width: 380 }}>
      {/* Central glow */}
      <div
        className="absolute rounded-full"
        style={{
          width: 120,
          height: 120,
          background:
            'radial-gradient(circle, rgba(0,255,65,0.3) 0%, rgba(0,255,65,0.1) 40%, transparent 70%)',
          filter: 'blur(10px)',
          animation: 'pulse-glow 3s ease-in-out infinite',
        }}
      />
      {/* Inner core */}
      <div
        className="absolute flex items-center justify-center rounded-full"
        style={{
          width: 64,
          height: 64,
          background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))',
          boxShadow:
            '0 0 40px var(--color-accent-glow-strong), 0 0 80px var(--color-accent-secondary-glow)',
        }}
      >
        <span
          className="text-lg font-black text-black"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          DF
        </span>
      </div>

      {/* Orbiting protocols */}
      {PROTOCOLS.map((protocol) => (
        <div
          key={protocol.id}
          className="absolute"
          style={{
            width: 48,
            height: 48,
            animation: `orbit-spin ${protocol.speed}s linear infinite`,
            animationDelay: `-${protocol.phase}s`,
            transformOrigin: 'center',
          }}
        >
          <div
            className="flex items-center justify-center rounded-full text-lg backdrop-blur-sm transition-all hover:scale-125"
            style={{
              width: 48,
              height: 48,
              background: `${protocol.color}20`,
              border: `2px solid ${protocol.color}40`,
              boxShadow: `0 0 20px ${protocol.color}20`,
              transform: `translateX(${protocol.radius}px)`,
              animation: `float ${3 + (protocol.speed % 5)}s ease-in-out infinite`,
              animationDelay: `-${protocol.phase * 0.1}s`,
            }}
            title={protocol.label}
          >
            <span role="img" aria-label={protocol.label}>
              {protocol.emoji}
            </span>
          </div>
        </div>
      ))}

      {/* Outer ring decorations */}
      <svg
        className="absolute pointer-events-none"
        width="380"
        height="380"
        viewBox="0 0 380 380"
        aria-hidden="true"
      >
        <circle
          cx="190"
          cy="190"
          r="140"
          fill="none"
          stroke="rgba(0,255,65,0.04)"
          strokeWidth="0.5"
          strokeDasharray="4 8"
        />
        <circle
          cx="190"
          cy="190"
          r="170"
          fill="none"
          stroke="rgba(139,92,246,0.03)"
          strokeWidth="0.5"
          strokeDasharray="2 12"
        />
      </svg>
    </div>
  );
}
