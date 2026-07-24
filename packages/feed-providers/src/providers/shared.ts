/**
 * Shared utilities for feed providers — consolidates duplicated patterns
 * like handle construction, identity creation, and HTML stripping.
 */

import type { Protocol, UnifiedIdentity } from '@degenfeed/types';

/**
 * Build the cross-protocol handles map that every provider needs.
 * All handle fields default to null; the caller sets the relevant one.
 */
export function emptyHandles(): UnifiedIdentity['handles'] {
  return {
    nostr: null,
    farcaster: null,
    lens: null,
    bluesky: null,
    threads: null,
    rss: null,
    mastodon: null,
  };
}

/**
 * Build a minimal UnifiedIdentity with cross-protocol handles.
 */
export function buildIdentity(
  id: string,
  protocol: Protocol,
  protocolId: string,
  handle: string | null,
  displayName: string,
  options?: {
    bio?: string;
    avatarUrl?: string;
    followerCount?: number;
    followingCount?: number;
    verified?: UnifiedIdentity['verified'];
    links?: UnifiedIdentity['links'];
    keys?: UnifiedIdentity['keys'];
    bannerUrl?: string;
  },
): UnifiedIdentity {
  const handles = emptyHandles();
  switch (protocol) {
    case 'nostr':
      handles.nostr = handle;
      break;
    case 'farcaster':
      handles.farcaster = handle;
      break;
    case 'lens':
      handles.lens = handle;
      break;
    case 'bluesky':
      handles.bluesky = handle;
      break;
    case 'threads':
      handles.threads = handle;
      break;
    case 'mastodon':
      handles.mastodon = handle;
      break;
    case 'reddit':
      handles.rss = handle;
      break;
    case 'rss':
      handles.rss = handle;
      break;
    case 'lemmy':
      handles.mastodon = handle;
      break;
    default:
      break;
  }

  return {
    id: `${protocol}:${id}`,
    primary: { protocol, id: protocolId },
    handles,
    displayName,
    bio: options?.bio ?? '',
    avatarUrl: options?.avatarUrl ?? '',
    verified: options?.verified ?? [],
    followerCount: options?.followerCount ?? 0,
    followingCount: options?.followingCount ?? 0,
    links: options?.links ?? [],
    keys: options?.keys ?? {},
  };
}

/** Strip HTML tags and common entities from a string. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
