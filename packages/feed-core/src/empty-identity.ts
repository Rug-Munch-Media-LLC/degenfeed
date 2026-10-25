// ─── Empty unified identity ─────────────────────────────────────────────
// Single responsibility: the canonical blank identity used before linking.
import type { UnifiedIdentity } from '@degenfeed/types';

/** Every protocol that receives an explicit null handle on a blank identity. */
const HANDLE_PROTOCOLS = [
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'threads',
  'rss',
  'mastodon',
  'pixelfed',
  'dtube',
  'lbry',
  'gab',
  'minds',
  'aether',
  'scuttlebutt',
  'hive',
  'mirror',
  'diaspora',
  'friendica',
  'pleroma',
  'misskey',
  'writefreely',
  'funkwhale',
  'castopod',
  'bookwyrm',
  'mobilizon',
  'bonfire',
  'mitra',
  'takahe',
  'forgejo',
  'owncast',
  'faircamp',
  'orbis',
  'xmtp',
  'push',
  'huddle01',
  'ceramic',
  'tableland',
  'subsocial',
  'steem',
  'session',
  'microblog',
  'cyberconnect',
  'arena',
  'telegram',
  'discord',
  'matrix',
  'github',
] as const;

/** A fresh handles map: identical keys, all null. Never shared between calls. */
export function emptyHandles(): UnifiedIdentity['handles'] {
  const handles: Record<string, null> = {};
  for (const protocol of HANDLE_PROTOCOLS) handles[protocol] = null;
  return handles as UnifiedIdentity['handles'];
}

export function emptyIdentity(): UnifiedIdentity {
  return {
    id: '',
    primary: { protocol: 'nostr', id: '' },
    handles: emptyHandles(),
    displayName: '',
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: {},
  };
}
