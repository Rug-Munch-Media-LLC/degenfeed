/**
 * @degenfeed/api-worker — Live Shorts: Types & Constants
 */

import type { AnnouncementResults } from '../lib/stream-announcer';

export type Protocol =
  | 'activitypub'
  | 'atproto'
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'zora'
  | 'degenfeed';

export const DEFAULT_PROTOCOLS: Protocol[] = [
  'activitypub',
  'atproto',
  'nostr',
  'farcaster',
  'lens',
];

export const MAX_LIVE_SHORT_DURATION_SECONDS = 60;

export type LiveShortRecord = {}
