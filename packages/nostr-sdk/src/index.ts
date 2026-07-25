/**
 * @degenfeed/nostr-sdk
 *
 * Full Nostr protocol client: relay management, event signing, NIP-19/05/42/46.
 *
 * Every post normalizes to @degenfeed/types `UnifiedPost` so consumers
 * never touch Nostr-native data unless they need to.
 */

// ─── Core re-exports ───────────────────────────────────────────────────

export type { NostrEvent, UnsignedEvent } from './event';
export {
  createDeletion,
  createReaction,
  createRepost,
  createTextNote,
  deserializeEvent,
  generateSecretKey,
  getEventHash,
  getPublicKey,
  serializeEvent,
  signEvent,
  verifyEvent,
} from './event';
export type { Nip05Result } from './nip05';
export { parseNip05, resolveNip05, verifyNip05 } from './nip05';
export type { Nip19Type, NsecDecodeResult } from './nip19';
export {
  decodeNip19,
  encodeNip19,
  noteDecode,
  noteEncode,
  npubDecode,
  npubEncode,
  nsecDecode,
  nsecEncode,
} from './nip19';
export type { Nip46ConnectOptions } from './nip46';
export { connectNostrConnect } from './nip46';
export type { NostrProfileContent } from './profile';

// ─── NIP-29 Group Chat ───────────────────────────────────────────────────
export type {
  Nip29Group,
  Nip29GroupMember,
  Nip29GroupSearchResult,
  Nip29Message,
} from './nip29';
export {
  createGroupJoinRequest,
  createGroupLeaveRequest,
  createGroupMembershipStatement,
  createGroupMessage,
  createGroupMetadataEvent,
  createGroupReply,
  createGroupThread,
  createRemoveUserEvent,
  discoverGroups,
  publishToGroupRelay,
  queryGroupMessages,
} from './nip29';
export {
  createProfileEvent,
  parseProfileContent,
  validateProfileFields,
} from './profile';
export type {
  NostrFilter,
  RelayEvent,
  RelayEventKind,
  RelayPoolOptions,
  RelaySubscription,
} from './relay';
export { RelayPool } from './relay';
export type { RelayListItem, RelayUsage } from './relay-metadata';
export {
  createRelayListEvent,
  getDefaultRelayList,
  isValidRelayUrl,
  parseRelayListEvent,
} from './relay-metadata';

// ─── Normalizers ───────────────────────────────────────────────────────

import {
  buildUnifiedPost,
  detectNiches,
  emptyIdentity,
  emptyMetrics,
  extractEmbeds,
} from '@degenfeed/feed-core';
import type { UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { NostrEvent } from './event';
import { npubEncode } from './nip19';

/**
 * Convert a kind 0 (metadata) Nostr event to a UnifiedIdentity.
 */
export function profileToIdentity(event: NostrEvent): UnifiedIdentity {
  let meta: Record<string, string> = {};
  try {
    meta = JSON.parse(event.content);
  } catch {
    // Invalid metadata
  }

  return {
    id: `nostr:${event.pubkey}`,
    primary: { protocol: 'nostr', id: event.pubkey },
    handles: {
      nostr: npubEncode(event.pubkey),
      farcaster: null,
      lens: null,
      bluesky: null,
    },
    displayName: meta.display_name ?? meta.name ?? `${npubEncode(event.pubkey).slice(0, 12)}…`,
    bio: meta.about ?? '',
    avatarUrl: meta.picture ?? '',
    bannerUrl: meta.banner,
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: { nostrPubkey: event.pubkey },
  };
}

/**
 * Convert a Nostr event to a UnifiedPost.
 * Handles kind 1 (text note), kind 6 (repost), kind 30023 (long-form).
 */
export function eventToUnifiedPost(event: NostrEvent, author?: UnifiedIdentity): UnifiedPost {
  const identity = author ?? emptyIdentity();
  identity.keys.nostrPubkey = event.pubkey;

  // Determine the original content for reposts
  let text = event.content;
  let embeds: unknown[] = [];
  let parentNativeId: string | undefined;
  let rootNativeId: string | undefined;

  // Extract parent/root from e tags
  for (const tag of event.tags) {
    if (tag[0] === 'e' && tag[3] === 'root') {
      rootNativeId = tag[1];
    } else if (tag[0] === 'e' && tag[3] === 'reply') {
      parentNativeId = tag[1];
    } else if (tag[0] === 'e' && !rootNativeId && !parentNativeId) {
      // First e tag without marker: assume root
      rootNativeId = tag[1];
    }
    // Handle kind 6 (repost) content
    if (event.kind === 6) {
      try {
        const originalEvent = JSON.parse(event.content) as NostrEvent;
        text = originalEvent.content;
        embeds = [
          {
            kind: 'quote' as const,
            url: `nostr:${originalEvent.id}`,
            meta: { originalEvent },
          },
        ];
      } catch {
        // Not a valid embedded event
      }
    }
  }

  const built = buildUnifiedPost({
    protocol: 'nostr',
    nativeId: event.id,
    author: identity,
    text,
    html: text, // Nostr doesn't have separate HTML, use plain text
    embeds: extractEmbeds(text, embeds),
    parentNativeId: parentNativeId ?? event.tags.find((t) => t[0] === 'e')?.[1],
    rootNativeId,
    createdAt: event.created_at * 1000,
    metrics: emptyMetrics(),
    viewer: { liked: false, reposted: false },
    raw: event,
  });

  built.niches = detectNiches(text);
  return built;
}
