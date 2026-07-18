/**
 * @degenfeed/utils — CrossProtocolIdentity
 *
 * Maps a wallet address to all its linked protocol identities.
 * Stored server-side in KV for persistence across devices.
 */

export interface CrossProtocolIdentity {
  /** Primary key — EVM or Solana wallet address (lowercased) */
  walletAddress: string;
  /** Nostr identity */
  nostr?: { npub: string; relays: string[]; verified: boolean; manualLinking?: boolean };
  /** Farcaster identity */
  farcaster?: {
    fid: number;
    username: string;
    custodyAddress: string;
    verified: boolean;
    manualLinking?: boolean;
  };
  /** Lens Protocol identity */
  lens?: { profileId: string; handle: string; verified: boolean; manualLinking?: boolean };
  /** Bluesky AT Protocol identity */
  bluesky?: { did: string; handle: string; verified: boolean; manualLinking?: boolean };
  /** Mastodon / fediverse identity */
  mastodon?: { handle: string; instance: string; verified: boolean; manualLinking?: boolean };
  /** Reddit identity */
  reddit?: { username: string; verified: boolean; manualLinking?: boolean };
  /** Threads (Meta / ActivityPub via Bridgy Fed) identity */
  threads?: { username: string; did?: string; verified: boolean; manualLinking?: boolean };
  /** Lemmy / ActivityPub federated community identity */
  lemmy?: { username: string; instance?: string; verified: boolean; manualLinking?: boolean };
  /** RSS source URL identity */
  rss?: { url: string; verified: boolean; manualLinking?: boolean };
  /** PeerTube / ActivityPub video identity */
  peertube?: {
    username: string;
    channelId?: string;
    instance?: string;
    verified: boolean;
    manualLinking?: boolean;
  };
  /** When the wallet first linked any identity */
  linkedAt: number;
  /** When any linked identity was last re-verified */
  lastVerified: number;
}

export type ProtocolId = keyof Omit<
  CrossProtocolIdentity,
  'walletAddress' | 'linkedAt' | 'lastVerified'
>;

/**
 * Registry of supported social/identity protocols.
 * Each entry has display metadata and the API endpoint to resolve/link.
 */
export const PROTOCOL_ID_REGISTRY: Record<
  ProtocolId,
  {
    displayName: string;
    icon: string;
    color: string;
    resolveEndpoint: string;
  }
> = {
  nostr: {
    displayName: 'Nostr',
    icon: '⚡',
    color: '#8b5cf6',
    resolveEndpoint: '/api/identity/resolve?protocol=nostr',
  },
  farcaster: {
    displayName: 'Farcaster',
    icon: '◈',
    color: '#8a63d2',
    resolveEndpoint: '/api/identity/resolve?protocol=farcaster',
  },
  lens: {
    displayName: 'Lens',
    icon: '◎',
    color: '#00501e',
    resolveEndpoint: '/api/identity/resolve?protocol=lens',
  },
  bluesky: {
    displayName: 'Bluesky',
    icon: '☁',
    color: '#1185fe',
    resolveEndpoint: '/api/identity/resolve?protocol=bluesky',
  },
  mastodon: {
    displayName: 'Mastodon',
    icon: '🐘',
    color: '#6364ff',
    resolveEndpoint: '/api/identity/resolve?protocol=mastodon',
  },
  reddit: {
    displayName: 'Reddit',
    icon: '🔴',
    color: '#ff4500',
    resolveEndpoint: '/api/identity/resolve?protocol=reddit',
  },
  threads: {
    displayName: 'Threads',
    icon: '🪡',
    color: '#000000',
    resolveEndpoint: '/api/identity/resolve?protocol=threads',
  },
  lemmy: {
    displayName: 'Lemmy',
    icon: '🍋',
    color: '#0a0',
    resolveEndpoint: '/api/identity/resolve?protocol=lemmy',
  },
  rss: {
    displayName: 'RSS',
    icon: '📡',
    color: '#ffa500',
    resolveEndpoint: '/api/identity/resolve?protocol=rss',
  },
  peertube: {
    displayName: 'PeerTube',
    icon: '📺',
    color: '#f2690d',
    resolveEndpoint: '/api/identity/resolve?protocol=peertube',
  },
};

/** KV key prefix for cross-protocol identity records */
export const IDENTITY_KV_PREFIX = 'identity:';

/** Build the KV key for a wallet address */
export function identityKey(address: string): string {
  return `${IDENTITY_KV_PREFIX}${address.toLowerCase()}`;
}
