import type { StoredIdentity } from '@degenfeed/storage';
import type { ResolvedIdentity } from './types';

export const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8b5cf6',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
  threads: '#888',
  ethereum: '#627eea',
  solana: '#9945ff',
};

export const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  threads: 'Threads (Experimental)',
  ethereum: 'EVM',
  solana: 'Solana',
};

export function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function toResolved(identity: StoredIdentity): ResolvedIdentity {
  const isWallet = identity.protocol === 'ethereum' || identity.protocol === 'solana';
  return {
    id: identity.id,
    protocol: identity.protocol,
    displayName: identity.displayName,
    handle: identity.handle,
    avatarUrl: identity.avatarUrl,
    address: isWallet ? identity.publicId : undefined,
    color: PROTOCOL_COLORS[identity.protocol] ?? '#666',
    isPrimary: identity.isPrimary,
    verified: identity.verified ?? false,
  };
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
