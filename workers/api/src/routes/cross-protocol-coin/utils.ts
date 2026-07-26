/**
 * @degenfeed/api-worker — Cross-Protocol Creator Coin Utilities
 */

import type { Env } from '../../types';
import { COIN_PREFIX, type CrossProtocolCoinRecord, TTL_1Y } from './types';

// ─── KV Helpers ────────────────────────────────────────────────────────────

export async function kvGetJson<T>(kv: KVNamespace | undefined, key: string): Promise<T | null> {
