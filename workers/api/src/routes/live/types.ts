/** Types for the Live routes module. */
import type { UnifiedLiveStream } from '../../feed/live-aggregator';
export interface SourceCount {
  source: string;
  count: number;
}

/** Simulcast source types */
export type SimulcastSource =
  | 'youtube'
  | 'tiktok'
  | 'twitch'
  | 'kick'
  | 'loops'
  | 'farcaster'
  | 'nostr'
  | 'bluesky'
  | 'mastodon'
  | 'peertube'
  | 'owncast';
