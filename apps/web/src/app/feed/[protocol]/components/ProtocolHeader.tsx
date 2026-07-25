'use client';

interface ProtocolInfo {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  postNoun: string;
  health: 'online' | 'degraded' | 'offline';
  followers?: number;
}

const PROTOCOL_METADATA: Record<string, ProtocolInfo> = {
  nostr: {
    id: 'nostr',
    label: 'Nostr',
    icon: '⚡',
    color: '#8e30eb',
    description:
      'Notes and Other Stuff Transmitted by Relays — decentralized, censorship-resistant social network',
    postNoun: 'note',
    health: 'online',
  },
  farcaster: {
    id: 'farcaster',
    label: 'Farcaster',
    icon: '◈',
    color: '#8a63d2',
    description: 'Sufficiently decentralized social network — identities anchored to Ethereum',
    postNoun: 'cast',
    health: 'online',
  },
  lens: {
    id: 'lens',
    label: 'Lens Protocol',
    icon: '◎',
    color: '#abfe2c',
    description: 'User-owned social graph built on Polygon — own your content and connections',
    postNoun: 'publication',
    health: 'online',
  },
  bluesky: {
    id: 'bluesky',
    label: 'Bluesky',
    icon: '☁',
    color: '#1185fe',
    description:
      'Open social network built on the AT Protocol — portable identity, algorithmic choice',
    postNoun: 'skeet',
    health: 'online',
  },
  mastodon: {
    id: 'mastodon',
    label: 'Mastodon',
    icon: 'M',
    color: '#6364ff',
    description: 'Federated microblogging on ActivityPub — join the fediverse',
    postNoun: 'toot',
    health: 'online',
  },
  reddit: {
    id: 'reddit',
    label: 'Reddit',
    icon: '🔴',
    color: '#ff4500',
    description: 'Crypto subreddits and community discussions — the front page of the internet',
    postNoun: 'post',
    health: 'online',
  },
  rss: {
    id: 'rss',
    label: 'RSS/News',
    icon: '📰',
    color: '#ffa500',
    description: 'Aggregated from 350+ crypto news sources — stay informed',
    postNoun: 'article',
    health: 'online',
  },
  threads: {
    id: 'threads',
    label: 'Threads',
    icon: '⊞',
    color: '#888',
    description: "Instagram's text-based conversation app — federated via ActivityPub",
    postNoun: 'thread',
    health: 'degraded',
  },
  lemmy: {
    id: 'lemmy',
    label: 'Lemmy',
    icon: '🗣',
    color: '#2d9cdb',
    description: 'Federated link aggregator and discussion platform — like Reddit, but open',
    postNoun: 'post',
    health: 'online',
  },
  pixelfed: {
    id: 'pixelfed',
    label: 'Pixelfed',
    icon: '📷',
    color: '#f9a825',
    description: 'Decentralized image sharing on ActivityPub — Instagram without the algorithm',
    postNoun: 'photo',
    health: 'online',
  },
  peertube: {
    id: 'peertube',
    label: 'PeerTube',
    icon: '🎬',
    color: '#f1680d',
    description: 'Decentralized video platform on ActivityPub — YouTube but federated',
    postNoun: 'video',
    health: 'online',
  },
  zora: {
    id: 'zora',
    label: 'Zora',
    icon: '🎨',
    color: '#6b21a8',
    description: 'NFT minting protocol with creator coins — mint, collect, trade onchain',
    postNoun: 'mint',
    health: 'online',
  },
  audius: {
    id: 'audius',
    label: 'Audius',
    icon: '🎵',
    color: '#cc0fe0',
    description: 'Decentralized music streaming — artists own their music, fans own the platform',
    postNoun: 'track',
    health: 'online',
  },
  rarible: {
    id: 'rarible',
    label: 'NFT Markets',
    icon: '🖼',
    color: '#feda02',
    description: 'Cross-chain NFT sales, mints and trending collections',
    postNoun: 'sale',
    health: 'online',
  },
  github: {
    id: 'github',
    label: 'GitHub',
    icon: '◉',
    color: '#6e40c9',
    description: 'Developer activity, repos, and discussions from the open source community',
    postNoun: 'event',
    health: 'online',
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    icon: '▶',
    color: '#ff0000',
    description: 'Video content from crypto creators, tutorials, and live streams',
    postNoun: 'video',
    health: 'online',
  },
  telegram: {
    id: 'telegram',
    label: 'Telegram',
    icon: '✈',
    color: '#26a5e4',
    description: 'Crypto community chats, announcements, and trading signals',
    postNoun: 'message',
    health: 'online',
  },
  discord: {
    id: 'discord',
    label: 'Discord',
    icon: '💬',
    color: '#5865f2',
    description: 'Crypto community discussions, announcements, and governance',
    postNoun: 'message',
    health: 'online',
  },
  misskey: {
    id: 'misskey',
    label: 'Misskey',
    icon: '♾',
    color: '#86b300',
    description: 'Decentralized microblogging with rich media support — a fediverse alternative',
    postNoun: 'note',
    health: 'degraded',
  },
  pleroma: {
    id: 'pleroma',
    label: 'Pleroma',
    icon: '◉',
    color: '#fba740',
    description: 'Lightweight federated social networking server — ActivityPub compatible',
    postNoun: 'post',
    health: 'degraded',
  },
  hive: {
    id: 'hive',
    label: 'Hive',
    icon: '◆',
    color: '#e31337',
    description: 'Blockchain-based social blogging platform with token rewards',
    postNoun: 'post',
    health: 'online',
  },
};

interface ProtocolHeaderProps {
  protocol: string;
  totalPosts?: number;
  activeUsers24h?: number;
}

export function ProtocolHeader({ protocol, totalPosts, activeUsers24h }: ProtocolHeaderProps) {
  const info: ProtocolInfo | undefined = PROTOCOL_METADATA[protocol];

  if (!info) {
    // Fallback for unknown protocols
    return (
      <div
        className="relative mb-6 overflow-hidden rounded-xl border p-5 sm:p-6"
        style={{
          borderColor: '#333',
          background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#888' }}
          >
            ●
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-[var(--color-fg)]">
              {protocol.charAt(0).toUpperCase() + protocol.slice(1)}
            </h1>
            <p className="mt-0.5 text-sm text-[var(--color-muted)]">Posts from {protocol}</p>
          </div>
        </div>
      </div>
    );
  }

  const healthColors: Record<string, string> = {
    online: '#22c55e',
    degraded: '#eab308',
    offline: '#ef4444',
  };
  const healthLabels: Record<string, string> = {
    online: 'Online',
    degraded: 'Degraded',
    offline: 'Offline',
  };

  return (
    <div
      className="relative mb-6 overflow-hidden rounded-xl border transition-all"
      style={{
        borderColor: `${info.color}33`,
        background: `linear-gradient(145deg, ${info.color}12 0%, ${info.color}04 50%, transparent 100%)`,
      }}
    >
      {/* Decorative glow */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-15 blur-3xl"
        style={{ backgroundColor: info.color }}
      />
      <div
        className="pointer-events-none absolute -bottom-8 -left-8 h-20 w-20 rounded-full opacity-10 blur-2xl"
        style={{ backgroundColor: info.color }}
      />

      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        {/* Top row: icon + title + health */}
        <div className="mb-4 flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl sm:h-16 sm:w-16 sm:text-3xl transition-transform hover:scale-105"
            style={{
              backgroundColor: `${info.color}20`,
              color: info.color,
              boxShadow: `0 0 24px ${info.color}22`,
            }}
            aria-hidden="true"
          >
            {info.icon}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1
                className="text-xl font-bold tracking-tight sm:text-2xl"
                style={{ color: 'var(--color-fg)' }}
              >
                {info.label}
              </h1>
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                style={{ backgroundColor: `${info.color}20`, color: info.color }}
              >
                {info.id}
              </span>
              {/* Health indicator */}
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: `${healthColors[info.health]}18`,
                  color: healthColors[info.health],
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: healthColors[info.health],
                    boxShadow:
                      info.health === 'online' ? `0 0 6px ${healthColors[info.health]}` : undefined,
                  }}
                />
                {healthLabels[info.health]}
              </span>
            </div>
            <p
              className="mt-1 max-w-lg text-sm leading-relaxed"
              style={{ color: 'var(--color-muted)' }}
            >
              {info.description}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {totalPosts !== undefined && (
            <div className="flex items-center gap-2">
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: info.color, opacity: 0.5 }}
              />
              <div>
                <span className="text-base font-bold tabular-nums" style={{ color: info.color }}>
                  {totalPosts.toLocaleString()}
                </span>
                <span className="ml-1.5 text-xs text-[var(--color-muted)]">{info.postNoun}s</span>
              </div>
            </div>
          )}
          {activeUsers24h !== undefined && (
            <div className="flex items-center gap-2">
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: info.color, opacity: 0.5 }}
              />
              <div>
                <span className="text-base font-bold tabular-nums" style={{ color: info.color }}>
                  {activeUsers24h.toLocaleString()}
                </span>
                <span className="ml-1.5 text-xs text-[var(--color-muted)]">active users</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
