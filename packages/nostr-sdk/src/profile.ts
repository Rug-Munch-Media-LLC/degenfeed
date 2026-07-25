/**
 * Nostr Profile (kind 0) creation and management.
 *
 * NIP-01: kind 0 events contain metadata about the user.
 * Content is a JSON string with fields like name, about, picture, nip05.
 */

import type { NostrEvent, UnsignedEvent } from './event';
import { getPublicKey, signEvent } from './event';

export interface NostrProfileContent {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud06?: string;
  lud16?: string;
  website?: string;
  [key: string]: string | undefined;
}

/**
 * Create and sign a kind 0 (metadata/profile) event.
 */
export function createProfileEvent(profile: NostrProfileContent, secretKey: string): NostrEvent {
  const pubkey = getPublicKey(secretKey);
  const unsigned: UnsignedEvent = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 0,
    tags: [],
    content: JSON.stringify(profile),
  };
  return signEvent(unsigned, secretKey);
}

/**
 * Parse kind 0 event content into profile fields.
 */
export function parseProfileContent(content: string): NostrProfileContent {
  try {
    return JSON.parse(content) as NostrProfileContent;
  } catch {
    return {};
  }
}

/**
 * Validate fields for a profile event.
 */
export function validateProfileFields(profile: NostrProfileContent): string[] {
  const errors: string[] = [];
  if (profile.name && profile.name.length > 40) {
    errors.push('name must be 40 characters or fewer');
  }
  if (profile.display_name && profile.display_name.length > 80) {
    errors.push('display_name must be 80 characters or fewer');
  }
  if (profile.about && profile.about.length > 300) {
    errors.push('about must be 300 characters or fewer');
  }
  if (profile.nip05 && !profile.nip05.includes('@')) {
    errors.push('nip05 must be a valid identifier (user@domain)');
  }
  if (profile.picture && !profile.picture.startsWith('http')) {
    errors.push('picture must be a valid URL');
  }
  if (profile.banner && !profile.banner.startsWith('http')) {
    errors.push('banner must be a valid URL');
  }
  return errors;
}
