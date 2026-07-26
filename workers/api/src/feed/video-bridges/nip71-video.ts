/**
 * @degenfeed/api-worker — Nostr NIP-71 Video Events Bridge
 *
 * Fetches video events from Nostr relays using NIP-71 specification.
 * NIP-71 defines kind 31388 for video events with `imeta` tags for
 * video URLs, dimensions, and metadata.
 *
 * Also falls back to kind 1 posts with video URLs.
 * Error recovery: individual relay failures never break the feed.
 */

import type { UnifiedVideo } from '../video-aggregator';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
];

export async function fetchNip71Videos(relayUrls: string[], limit = 20): Promise<UnifiedVideo[]> {

export async function searchNip71Videos(
  _relayUrls: string[],
  _query: string,
): Promise<UnifiedVideo[]> {

/**
 * Fetch kind 1 posts that contain video URLs (fallback for NIP-71).
 * Used when NIP-71 events are sparse.
 */
export async function fetchKind1Videos(relayUrls: string[], limit = 10): Promise<UnifiedVideo[]> {

