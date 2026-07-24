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

export interface LiveShortRecord {
  /** Unique session ID (UUID). */
  id: string;
  /** Creator wallet address. */
  creator: string;
  /** Creator display handle (derived from identity or wallet). */
  creatorHandle: string;
  /** Live short title. */
  title: string;
  /** Protocols this was broadcast to. */
  protocols: Protocol[];
  /** RTMP stream key for broadcasting. */
  streamKey: string;
  /** RTMP ingest URL. */
  rtmpUrl: string;
  /** HLS playback URL for viewers. */
  playbackUrl: string;
  /** Whether a creator coin / token is linked. */
  hasCoinLinked: boolean;
  /** Linked coin address if hasCoinLinked is true. */
  coinAddress?: string;
  /** When the stream started (Unix ms). */
  startedAt: number;
  /** Auto-end timestamp (startedAt + 60s in ms). */
  endsAt: number;
  /** Whether the stream is currently live. */
  isLive: boolean;
  /** Cross-protocol announcement results (post IDs on each protocol). */
  protocolPosts: Record<string, string>;
  /** Announcement results metadata. */
  announcements?: AnnouncementResults;
  /** Recording URL (set after stream ends + processing). */
  recordingUrl?: string;
  /** Whether the recording has been published as a regular short. */
  recordingPublishedAsShort: boolean;
  /** Whether an NFT was minted from the recording (Zora). */
  nftMinted: boolean;
  /** Total tips received during this live short. */
  tipCount: number;
  /** Total tip amount in USD cents (aggregated). */
  tipTotalUsdCents: number;
  /** When the stream ended (Unix ms). */
  endedAt?: number;
}

export interface ViewerCounts {
  [protocol: string]: number;
  total: number;
}

export interface TipEvent {
  amount: string;
  chain: string;
  from: string;
  message: string;
}

export interface ActiveLiveShortResponse {
  id: string;
  creator: string;
  creatorHandle: string;
  title: string;
  protocols: Protocol[];
  playbackUrl: string;
  hasCoinLinked: boolean;
  startedAt: number;
  endsAt: number;
  timeRemaining: number;
  viewerCount: number;
}
