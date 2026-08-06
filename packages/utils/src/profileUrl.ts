/**
 * @degenfeed/utils — profileUrl
 *
 * Canonical profile URL generation for every protocol.
 *
 * Derives BOTH the internal DegenFeed profile path
 * (`/profile/{protocol}/{id}`) and the external platform-native profile
 * URL from a `UnifiedIdentity` at render time. The UI uses these helpers
 * so every author name/avatar is clickable even when the provider didn't
 * stamp `author.url` on the post (the URL is always derivable from the
 * identity's id/primary/handles/keys fields).
 *
 * Consumers:
 *  - packages/ui/src/post-card/PostHeader.tsx  (clickable author)
 *  - packages/ui/src/ProtocolBadge.tsx          (feed link)
 *  - apps/web/src/app/profile/[protocol]/[id]/page.tsx
 *  - apps/web/src/components/visual-feed/VisualFeedCard.tsx
 */

import type { Protocol, UnifiedIdentity } from '@degenfeed/types';

/**
 * Pick the best raw identifier for a protocol profile.
 * Prefers the canonical `primary.id` (pubkey, DID, FID, channel id…),
 * falling back to the per-protocol handle when the primary id is absent.
 */
export function getInternalProfileId(
  author: Pick<UnifiedIdentity, 'primary' | 'id' | 'handles'>,
  protocol?: string,
): string {
  const proto = protocol ?? author.primary?.protocol;
  const primaryId = author.primary?.id;
  if (primaryId) return primaryId;

  const handles = author.handles as Record<string, string | null> | undefined;
  const handle = handles?.[proto ?? ''] ?? '';
  if (handle !== '') return handle;

  // Fall back to the stable `protocol:id` id, stripped of the prefix.
  const raw = author.id ?? '';
  if (proto && raw.startsWith(`${proto}:`)) return raw.slice(proto.length + 1);
  if (raw.includes(':')) return raw.split(':').slice(1).join(':');
  return raw;
}

/**
 * Internal DegenFeed profile path: `/profile/{protocol}/{id}`.
 * Used for author click-through on post cards.
 */
export function getInternalProfilePath(
  author: Pick<UnifiedIdentity, 'primary' | 'id' | 'handles'>,
  protocol?: string,
): string {
  const proto = protocol ?? author.primary?.protocol;
  if (!proto) return '';
  const id = getInternalProfileId(author, proto);
  if (!id) return '';
  return `/profile/${encodeURIComponent(proto)}/${encodeURIComponent(id)}`;
}

/** Clean a lens handle (`lens/@foo` / `@foo` → `foo`). */
function cleanLensHandle(handle: string): string {
  return handle.replace(/^lens\//, '').replace(/^@/, '').trim();
}

/** Clean a reddit handle (`u/foo` → `foo`). */
function cleanRedditHandle(handle: string): string {
  return handle.replace(/^u\//, '').trim();
}

/**
 * External platform-native profile URL for a protocol identity.
 * Returns '' when no stable external URL can be built.
 */
export function getExternalProfileUrl(
  author: Pick<UnifiedIdentity, 'primary' | 'id' | 'handles' | 'keys' | 'url'>,
  protocol?: string,
): string {
  // Providers that stamp an explicit profile URL win.
  if (author.url) return author.url;

  const proto = protocol ?? author.primary?.protocol;
  const primaryId = author.primary?.id ?? '';
  const handle = author.handles?.[proto as Protocol] ?? '';

  switch (proto) {
    case 'nostr': {
      // njump.me accepts both bech32 npub and raw hex pubkeys.
      const hex = primaryId || '';
      if (/^[0-9a-f]{64}$/i.test(hex)) return `https://njump.me/${hex}`;
      if (handle.startsWith('npub1')) return `https://njump.me/${handle}`;
      return '';
    }
    case 'farcaster': {
      if (handle) return `https://warpcast.com/${encodeURIComponent(handle)}`;
      if (primaryId) return `https://warpcast.com/~/profiles/${encodeURIComponent(primaryId)}`;
      return '';
    }
    case 'bluesky': {
      if (handle) return `https://bsky.app/profile/${encodeURIComponent(handle)}`;
      if (primaryId.startsWith('did:')) return `https://bsky.app/profile/${encodeURIComponent(primaryId)}`;
      return '';
    }
    case 'mastodon':
    case 'gotosocial': {
      if (handle.includes('@')) {
        const [user, instance] = handle.split('@');
        if (user && instance) return `https://${instance}/@${user}`;
      }
      if (handle) return `https://social.degenfeed.xyz/@${handle}`;
      return '';
    }
    case 'lens': {
      const clean = handle ? cleanLensHandle(handle) : '';
      if (clean) return `https://hey.xyz/u/${encodeURIComponent(clean)}`;
      return '';
    }
    case 'reddit': {
      const clean = handle ? cleanRedditHandle(handle) : primaryId;
      if (clean) return `https://reddit.com/user/${encodeURIComponent(clean)}`;
      return '';
    }
    case 'youtube': {
      if (primaryId.startsWith('UC')) return `https://www.youtube.com/channel/${encodeURIComponent(primaryId)}`;
      if (handle) return `https://www.youtube.com/@${encodeURIComponent(handle.replace(/^@/, ''))}`;
      return '';
    }
    case 'soundcloud': {
      if (handle) return `https://soundcloud.com/${encodeURIComponent(handle.replace(/^@/, ''))}`;
      return '';
    }
    case 'peertube':
      if (handle) return `https://video.degenfeed.xyz/accounts/${encodeURIComponent(handle)}`;
      return '';
    case 'pixelfed':
      if (handle) return `https://pixelfed.social/${encodeURIComponent(handle)}`;
      return '';
    case 'telegram':
      if (handle) return `https://t.me/${encodeURIComponent(handle.replace(/^@/, ''))}`;
      return '';
    case 'lemmy':
    case 'piefed':
    case 'kbin':
    case 'mbin': {
      // `user@instance` → https://instance/u/user
      if (handle.includes('@')) {
        const [user, instance] = handle.split('@');
        if (user && instance) return `https://${instance}/u/${user}`;
      }
      return '';
    }
    default:
      return '';
  }
}

/**
 * Best href for author click-through:
 * internal `/profile/{protocol}/{id}` when a stable id exists, otherwise
 * the external platform URL.
 */
export function getAuthorProfileHref(
  author: Pick<UnifiedIdentity, 'primary' | 'id' | 'handles' | 'keys' | 'url'>,
  protocol?: string,
): string {
  const proto = protocol ?? author.primary?.protocol;
  const internal = getInternalProfilePath(author, proto);
  if (internal) return internal;
  return getExternalProfileUrl(author, proto);
}

/** Protocol feed path (used by ProtocolBadge links). */
export function getProtocolFeedPath(protocol: string): string {
  return `/feed/${protocol}`;
}

/**
 * External profile URL from protocol + id parts (used by the internal
 * profile page to offer a "View on {platform}" link).
 */
export function getProfileUrlFromParts(protocol: string, id: string, handle?: string): string {
  const author: Pick<UnifiedIdentity, 'primary' | 'id' | 'handles' | 'keys' | 'url'> = {
    id: `${protocol}:${id}`,
    primary: { protocol: protocol as Protocol, id },
    handles: handle ? ({ [protocol]: handle } as Partial<Record<Protocol, string>>) : {},
    keys: {},
  };
  return getExternalProfileUrl(author, protocol);
}
