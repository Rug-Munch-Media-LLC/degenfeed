/**
 * @degenfeed/utils — Protocol list parsing
 *
 * Turns an untrusted `?protocols=` style query value into a validated list.
 * Single responsibility: allow-list filtering. Never invents protocols.
 */

import type { Protocol } from '@degenfeed/types';

/** Protocols accepted when the caller does not pass its own allow-list. */
const VALID_PROTOCOLS: Protocol[] = [
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'threads',
  'rss',
  'mastodon',
  'reddit',
  'ethereum',
  'solana',
  'lemmy',
  'peertube',
  'youtube',
  'atproto',
  'zora',
  'telegram',
  'ens',
  'unstoppable',
  'ion',
  'keri',
  'veramo',
  'storj',
  'sia',
  'filecoin',
  'swarm-eth',
  'orbis',
  'snapshot',
  'tally',
  'syndicate',
  'juicebox',
  'coinvise',
  'unlock',
  'mintgate',
  'bonfida',
];

/**
 * Parse a comma-separated protocol list against an allow-list.
 *
 * Contract invariants:
 * - a falsy `raw` returns every allowed protocol (the "no filter" case)
 * - unknown entries are dropped, never thrown on
 * - order and duplicates of the input are preserved
 * - whitespace around each entry is ignored
 */
export function parseProtocols(
  raw: string | null,
  allowed: Protocol[] = VALID_PROTOCOLS,
): Protocol[] {
  if (!raw) return allowed;
  const valid = new Set<Protocol>(allowed);
  return raw
    .split(',')
    .map((p) => p.trim() as Protocol)
    .filter((p): p is Protocol => valid.has(p));
}
