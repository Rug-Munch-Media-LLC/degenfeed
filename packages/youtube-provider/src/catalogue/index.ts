/**
 * Build the channel catalogue: merge the existing CRYPTO_CHANNELS with the curated
 * top-250 list and de-duplicate hard.
 *
 * Identity rules, in order:
 *   1. same `channel_id`  → duplicate
 *   2. same normalised `@handle` → duplicate
 *   3. same normalised display name → duplicate
 * Existing config entries win (they carry a verified channel_id and weight).
 */

import { CRYPTO_CHANNELS } from '../youtube/config';
import type { YouTubeChannel } from '../youtube/types';
import { CURATED_ROWS } from './data';
import { parseRows } from './parse';
import type { Catalogue, CatalogueEntry } from './types';

const NON_ALNUM = /[^a-z0-9]/g;

/** `@Coin Bureau` / `CoinBureau` / `Coin Bureau` all collapse to `coinbureau`. */
export function normaliseKey(value: string): string {
  return value.toLowerCase().replace(/^@/, '').replace(NON_ALNUM, '');
}

function keysOf(entry: CatalogueEntry): string[] {
  const keys: string[] = [];
  if (entry.channelId) keys.push(`id:${entry.channelId}`);
  if (entry.handle) keys.push(`h:${normaliseKey(entry.handle)}`);
  keys.push(`n:${normaliseKey(entry.name)}`);
  return keys;
}

export interface CatalogueInput {
  /** Raw curated rows (already parsed by `parseRows`). */
  curated: CatalogueEntry[];
  /** Existing curated channel list (channel_id verified). */
  existing: readonly YouTubeChannel[];
}

function fromExisting(channels: readonly YouTubeChannel[]): CatalogueEntry[] {
  return channels.map((channel) => ({
    channelId: channel.channelId,
    handle: null,
    name: channel.name,
    category: channel.category,
    subcategory: channel.subcategory,
    weight: channel.weight,
    niches: channel.niches,
    provenance: {
      source: 'existing-config',
      selectedAt: null,
      ...(channel.subscriberCount ? { approxSubscribers: channel.subscriberCount } : {}),
    },
  }));
}

/** Merge + de-duplicate. `entries` is ordered: existing config first, then curated rank. */
export function buildCatalogue(input: CatalogueInput): Catalogue {
  const seen = new Set<string>();
  const entries: CatalogueEntry[] = [];
  let duplicatesDropped = 0;

  const push = (entry: CatalogueEntry): void => {
    const keys = keysOf(entry);
    if (keys.some((key) => seen.has(key))) {
      duplicatesDropped++;
      return;
    }
    for (const key of keys) seen.add(key);
    entries.push(entry);
  };

  for (const entry of fromExisting(input.existing)) push(entry);
  for (const entry of input.curated) push(entry);

  return {
    entries,
    duplicatesDropped,
    pendingIds: entries.filter((entry) => !entry.channelId).length,
  };
}

/** Convenience: parse raw rows and merge in one call. */
export function buildCatalogueFromRows(
  raw: string,
  existing: readonly YouTubeChannel[],
): Catalogue {
  return buildCatalogue({
    curated: parseRows(raw, { selectedAt: '2026-10-25', source: 'curated-manual' }),
    existing,
  });
}

/** The shipped catalogue: curated rows merged over the existing CRYPTO_CHANNELS. */
export function buildDefaultCatalogue(
  existing: readonly YouTubeChannel[] = CRYPTO_CHANNELS,
): Catalogue {
  return buildCatalogueFromRows(CURATED_ROWS, existing);
}
