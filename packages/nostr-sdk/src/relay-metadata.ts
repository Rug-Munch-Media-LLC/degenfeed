/**
 * Nostr Relay List Metadata (kind 10002).
 *
 * NIP-65: Relay List Metadata defines a replaceable event (kind 10002)
 * that lists a user's preferred relays with their read/write usage.
 *
 * This allows users to take their relay preferences wherever they go.
 */

import type { NostrEvent, UnsignedEvent } from './event';
import { getPublicKey, signEvent } from './event';

export type RelayUsage = 'read' | 'write' | 'both';

export interface RelayListItem {
  url: string;
  usage: RelayUsage;
}

/**
 * Create and sign a kind 10002 (Relay List Metadata) event.
 * This event tells Nostr clients which relays to use for reading/writing.
 */
export function createRelayListEvent(relays: RelayListItem[], secretKey: string): NostrEvent {
  const pubkey = getPublicKey(secretKey);
  const tags: string[][] = relays.map((r) => ['r', r.url, r.usage]);

  const unsigned: UnsignedEvent = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 10002,
    tags,
    content: '',
  };
  return signEvent(unsigned, secretKey);
}

/**
 * Parse relay list from a kind 10002 event's tags.
 */
export function parseRelayListEvent(event: NostrEvent): RelayListItem[] {
  if (event.kind !== 10002) return [];

  const relays: RelayListItem[] = [];
  for (const tag of event.tags) {
    if (tag[0] === 'r' && tag[1]) {
      relays.push({
        url: tag[1],
        usage: (tag[2] as RelayUsage) || 'both',
      });
    }
  }
  return relays;
}

/**
 * Get the default DegenFeed relay list.
 * Our relay is read+write, plus public relays for content discovery.
 */
export function getDefaultRelayList(): RelayListItem[] {
  return [
    { url: 'wss://nostr.degenfeed.xyz', usage: 'write' },
    { url: 'wss://nostr.degenfeed.xyz', usage: 'read' },
    { url: 'wss://relay.damus.io', usage: 'read' },
    { url: 'wss://nos.lol', usage: 'read' },
    { url: 'wss://relay.nostr.band', usage: 'read' },
    { url: 'wss://relay.primal.net', usage: 'read' },
  ];
}

/**
 * Check if a relay URL is valid.
 */
export function isValidRelayUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'wss:' || parsed.protocol === 'ws:';
  } catch {
    return false;
  }
}
