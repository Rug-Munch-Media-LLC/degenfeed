/**
 * @degenfeed/api-worker — Cross-Protocol Creator Coin Types
 */

export const COIN_PREFIX = 'coin:';
export const SYMBOL_INDEX_PREFIX = 'coin:symbol:';
export const TTL_1Y = 60 * 60 * 24 * 365;

export const BASE_CHAIN_ID = 8453;
export const SOLANA_CHAIN_ID = 901;

export const VALID_PROTOCOLS = new Set([
  'farcaster',
  'nostr',
  'bluesky',
  'threads',
  'lens',
  'mastodon',
  'activitypub',
]);

export type CrossProtocolCoinRecord = {};
