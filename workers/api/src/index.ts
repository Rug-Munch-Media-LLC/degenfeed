/**
 * @degenfeed/api-worker — Module barrel
 *
 * Dispatches requests to route handler modules.
 * Shared utilities (Env, rateLimit, jsonResponse, GTS config) are
 * re-exported for route module use.
 *
 * Individual modules can be imported directly from their source files:
 *   - types.ts            for Env, RateLimitResult
 *   - response-helpers.ts for jsonResponse, noCacheJsonResponse
 *   - logger.ts           for log
 *   - constants.ts        for DEFAULT_RELAYS, FARCASTER_HUBS, etc.
 *   - rate-limit.ts       for rateLimit, tieredRateLimit, recordBruteForceFailure
 *   - gts-config.ts       for GTS_AUTH_CONFIG, getGtsConfig
 *   - cron-handler.ts     for scheduled()
 */

export { scheduled } from './cron-handler';
export { GTS_AUTH_CONFIG, getGtsConfig } from './gts-config';
export { log } from './logger';
export {
  rateLimit,
  recordBruteForceFailure,
  tieredRateLimit,
} from './rate-limit';
export { jsonResponse, noCacheJsonResponse } from './response-helpers';
export type { Env, RateLimitResult } from './types';

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
];
export const FARCASTER_HUBS = [
  'http://127.0.0.1:2281',
  'https://hubble.degenfeed.xyz',
  'https://hub.farcaster.standardcrypto.vc:2281',
];
export const LENS_APIS = ['https://api.lens.xyz/graphql', 'https://api-v2.lens.dev/graphql'];
export const BSKY_PUBLIC = 'https://public.api.bsky.app';
export const BSKY_SOCIAL = 'https://bsky.social';
export const THREADS_PUBLIC = 'https://public.threads.net';
