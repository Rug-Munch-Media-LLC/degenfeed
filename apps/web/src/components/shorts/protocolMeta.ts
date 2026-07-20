'use client';

/**
 * protocolMeta — Client-side protocol metadata matching the backend's
 * PROTOCOL_META in workers/api/src/lib/unified-shorts.ts
 *
 * Used by PublishProgress, CreateShortModal, and ShortCreator for
 * consistent colors, labels, and icons across the UI.
 */

export type ShortProtocol =
  | 'activitypub'
  | 'atproto'
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'zora'
  | 'peertube'
  | 'degenfeed';

export const PROTOCOL_META: Record<
  ShortProtocol,
  { label: string; color: string; icon: string; shortLabel: string }
> = {
  activitypub: {
    label: 'ActivityPub',
    color: '#6364ff',
    icon: 'Mastodon',
    shortLabel: 'AP',
  },
  atproto: {
    label: 'AT Protocol',
    color: '#0085ff',
    icon: 'Bluesky',
    shortLabel: 'AT',
  },
  nostr: {
    label: 'Nostr',
    color: '#7c3aed',
    icon: 'Nostr',
    shortLabel: 'Nostr',
  },
  farcaster: {
    label: 'Farcaster',
    color: '#8b5cf6',
    icon: 'Farcaster',
    shortLabel: 'FC',
  },
  lens: {
    label: 'Lens',
    color: '#00501e',
    icon: 'Lens',
    shortLabel: 'Lens',
  },
  zora: {
    label: 'Zora',
    color: '#f5a623',
    icon: 'Zora',
    shortLabel: 'Zora',
  },
  peertube: {
    label: 'PeerTube',
    color: '#f1680d',
    icon: 'PeerTube',
    shortLabel: 'PT',
  },
  degenfeed: {
    label: 'DegenFeed',
    color: '#00ff41',
    icon: 'DegenFeed',
    shortLabel: 'DF',
  },
};

/** Share links builder per protocol */
export function buildShareUrl(
  protocol: ShortProtocol,
  shortId: string,
  title: string,
): string {
  const appUrl = `https://app.degenfeed.xyz/shorts/${shortId}`;
  const encodedUrl = encodeURIComponent(appUrl);
  const encodedTitle = encodeURIComponent(title);

  switch (protocol) {
    case 'activitypub':
      // Mastodon share intent
      return `https://mastodon.social/share?text=${encodedTitle}%20${encodedUrl}`;
    case 'atproto':
      return `https://bsky.app/intent/compose?text=${encodedTitle}%20${encodedUrl}`;
    case 'nostr':
      return `https://snort.social/new?message=${encodedTitle}%20${encodedUrl}`;
    case 'farcaster':
      return `https://warpcast.com/~/compose?text=${encodedTitle}%20${encodedUrl}`;
    case 'lens':
      return `https://hey.xyz/?compose=${encodedUrl}`;
    case 'zora':
      return appUrl; // Zora has its own collect URL
    case 'peertube':
      return appUrl;
    case 'degenfeed':
      return appUrl;
  }
}
